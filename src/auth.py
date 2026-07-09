"""
AnfieldVoice — Authentication & Authorisation
==============================================
JWT-based auth with role extraction and permission enforcement dependencies.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.models import RoleName
from src.permissions import (
    Action,
    PermissionSet,
    resolve_permissions,
)


# ---------------------------------------------------------------------------
# JWT Configuration
# ---------------------------------------------------------------------------
JWT_SECRET = os.getenv("ANFIELDVOICE_JWT_SECRET", "anfieldvoice-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

security_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Token Management
# ---------------------------------------------------------------------------

def create_access_token(user_id: int, roles: list[str]) -> str:
    """Create a JWT containing user_id and roles."""
    payload = {
        "sub": str(user_id),
        "roles": roles,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# DB Pool Dependency
# ---------------------------------------------------------------------------

def get_db_pool(request: Request):
    """Extract the database pool from the app state."""
    return request.app.state.db_pool


# ---------------------------------------------------------------------------
# Current User Dependency
# ---------------------------------------------------------------------------

class CurrentUser:
    """Extracted from JWT — available to all authenticated endpoints."""

    def __init__(self, payload: dict):
        self.user_id = int(payload["sub"])
        self.roles: set[str] = set(payload.get("roles", []))

    def has_role(self, role: RoleName | str) -> bool:
        return str(role) in self.roles

    def has_any_role(self, *roles: RoleName | str) -> bool:
        return any(str(r) in self.roles for r in roles)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> CurrentUser:
    """FastAPI dependency: extracts the current user from the JWT."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(credentials.credentials)
    return CurrentUser(payload)


# ---------------------------------------------------------------------------
# Permission Enforcement Dependencies
# ---------------------------------------------------------------------------

def require_role(*roles: RoleName | str):
    """Dependency factory: user must have at least one of the specified roles."""

    async def dependency(current_user: CurrentUser = Depends(get_current_user)):
        if not current_user.has_any_role(*roles):
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of roles: {[str(r) for r in roles]}",
            )
        return current_user

    return dependency


def require_property_admin_for(apartment_id_param: str = "apartment_id"):
    """
    Dependency factory: user must be a property admin for the apartment
    specified in the given path/query parameter. Body corp and super admins pass through.
    """

    async def dependency(
        request: Request,
        current_user: CurrentUser = Depends(get_current_user),
        db_pool=Depends(get_db_pool),
    ) -> tuple[CurrentUser, int, PermissionSet]:
        apartment_id = _extract_apartment_id(request, apartment_id_param)

        # Super admins and body corp admins bypass apartment-level checks
        if current_user.has_any_role(RoleName.SUPER_ADMIN, RoleName.BODY_CORP_ADMIN):
            perms = PermissionSet(
                user_id=current_user.user_id,
                apartment_id=apartment_id,
                is_body_corp_admin=current_user.has_role(RoleName.BODY_CORP_ADMIN),
                is_super_admin=current_user.has_role(RoleName.SUPER_ADMIN),
            )
            return current_user, apartment_id, perms

        perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)

        if not perms.is_property_admin:
            raise HTTPException(
                status_code=403,
                detail="You are not a property administrator for this apartment",
            )

        return current_user, apartment_id, perms

    return dependency


def require_resident_of(apartment_id_param: str = "apartment_id"):
    """
    Dependency factory: user must be an active resident of the apartment.
    """

    async def dependency(
        request: Request,
        current_user: CurrentUser = Depends(get_current_user),
        db_pool=Depends(get_db_pool),
    ) -> tuple[CurrentUser, int, PermissionSet]:
        apartment_id = _extract_apartment_id(request, apartment_id_param)

        perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)

        if not perms.is_resident:
            raise HTTPException(
                status_code=403,
                detail="You are not an active resident of this apartment",
            )

        return current_user, apartment_id, perms

    return dependency


def require_action(action: Action, apartment_id_param: str = "apartment_id"):
    """
    Dependency factory: user must have permission for the specific action
    on the specified apartment.
    """

    async def dependency(
        request: Request,
        current_user: CurrentUser = Depends(get_current_user),
        db_pool=Depends(get_db_pool),
    ) -> tuple[CurrentUser, int, PermissionSet]:
        apartment_id = _extract_apartment_id(request, apartment_id_param)

        perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)

        if not perms.can(action):
            raise HTTPException(
                status_code=403,
                detail=f"You do not have permission to '{action.value}' on this apartment",
            )

        return current_user, apartment_id, perms

    return dependency


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_apartment_id(request: Request, param_name: str) -> int:
    """Extract apartment_id from path params or query params."""
    raw = request.path_params.get(param_name) or request.query_params.get(param_name)
    if raw is None:
        raise HTTPException(status_code=400, detail=f"Missing {param_name}")
    try:
        return int(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {param_name}: {raw}")
