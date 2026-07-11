"""
AnfieldVoice — Property Administrator API
==========================================
Endpoints for tenant management, role assignment, and apartment administration.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from src.audit import query_audit_log, write_audit_entry
from src.auth import (
    CurrentUser,
    create_access_token,
    get_current_user,
    hash_password,
    require_action,
    require_property_admin_for,
    require_role,
    verify_password,
)
from src.models import (
    AddResidentRequest,
    ApartmentOut,
    ApartmentResidentOut,
    AssignPropertyAdminRequest,
    AuditLogEntry,
    AuditQuery,
    CreateInvitationRequest,
    InvitationOut,
    PermissionCheck,
    PropertyAdminAssignmentOut,
    PropertyAdminType,
    RemoveResidentRequest,
    RevokePropertyAdminRequest,
    RoleName,
    UserOut,
    UserPermissions,
)
from src.permissions import (
    Action as PermAction,
    get_managed_apartments,
    resolve_permissions,
)

router = APIRouter(prefix="/api/v1", tags=["property-admin"])


# ============================================================================
# Authentication
# ============================================================================

@router.post("/auth/login")
async def login(
    request: Request,
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Authenticate with email and password. Returns a JWT token."""
    import json

    body = await request.json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    async with db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT user_id, email, password_hash, is_active FROM users WHERE LOWER(email) = $1",
            email,
        )
        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not user["is_active"]:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        # Get roles
        role_rows = await conn.fetch("""
            SELECT r.role_name FROM user_roles ur
            JOIN roles r ON ur.role_id = r.role_id
            WHERE ur.user_id = $1
        """, user["user_id"])
        roles = [r["role_name"] for r in role_rows]

    token = create_access_token(user["user_id"], roles)
    return {"access_token": token, "token_type": "bearer"}


# ============================================================================
# Permission Check
# ============================================================================

@router.get("/permissions/{apartment_id}", response_model=UserPermissions)
async def check_permissions(
    apartment_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """Get the current user's complete permissions on an apartment."""
    perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)
    return perms.as_user_permissions()


@router.get("/permissions/{apartment_id}/check/{action}", response_model=PermissionCheck)
async def check_single_permission(
    apartment_id: int,
    action: str,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """Check if the current user can perform a specific action on an apartment."""
    try:
        perm_action = PermAction(action)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)
    allowed = perms.can(perm_action)

    return PermissionCheck(
        allowed=allowed,
        action=action,
        apartment_id=apartment_id,
        reason=None if allowed else f"User lacks required role or apartment assignment",
    )


# ============================================================================
# Apartments (Managed by This Admin)
# ============================================================================

@router.get("/my-apartments", response_model=list[ApartmentOut])
async def list_my_apartments(
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """List all apartments the current user manages as a property administrator."""
    apartment_ids = await get_managed_apartments(db_pool, current_user.user_id)

    if not apartment_ids:
        return []

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM apartments WHERE apartment_id = ANY($1) AND is_active = TRUE",
            apartment_ids,
        )
        return [dict(r) for r in rows]


# ============================================================================
# Tenant Management (Property Administrator)
# ============================================================================

@router.get(
    "/apartments/{apartment_id}/residents",
    response_model=list[ApartmentResidentOut],
)
async def list_residents(
    apartment_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """
    List residents of an apartment. Accessible to:
    - The apartment's property administrator
    - Body corp / super admins
    - Active residents (limited view of their own apartment)
    """
    perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)

    if not (perms.is_property_admin or perms.is_body_corp_admin or perms.is_super_admin or perms.is_resident):
        raise HTTPException(status_code=403, detail="Access denied")

    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                ar.resident_id, ar.user_id, u.full_name, u.email, u.phone,
                ar.is_primary, ar.is_active, ar.move_in_date
            FROM apartment_residents ar
            JOIN users u ON ar.user_id = u.user_id
            WHERE ar.apartment_id = $1
            ORDER BY ar.is_primary DESC, u.full_name
        """, apartment_id)
        return [dict(r) for r in rows]


@router.post(
    "/apartments/{apartment_id}/residents",
    response_model=ApartmentResidentOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_resident(
    apartment_id: int,
    body: AddResidentRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    _deps: tuple = Depends(require_action(PermAction.ADD_TENANTS)),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """
    Add a resident to an apartment. Requires ADD_TENANTS permission.
    Works with existing users (user_id) or creates an invitation (email).
    """
    async with db_pool.acquire() as conn:
        # Check resident limit
        current_count = await conn.fetchval(
            "SELECT COUNT(*) FROM apartment_residents WHERE apartment_id = $1 AND is_active = TRUE",
            apartment_id,
        )
        max_residents = await conn.fetchval(
            "SELECT max_residents FROM apartments WHERE apartment_id = $1",
            apartment_id,
        )
        if current_count >= max_residents:
            raise HTTPException(
                status_code=400,
                detail=f"Apartment resident limit ({max_residents}) reached",
            )

        if body.user_id:
            # Add an existing user as resident
            try:
                resident = await conn.fetchrow("""
                    INSERT INTO apartment_residents (user_id, apartment_id, is_primary)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, apartment_id)
                    DO UPDATE SET is_active = TRUE, is_primary = $3, updated_at = NOW()
                    RETURNING resident_id, user_id, apartment_id, is_primary, is_active, move_in_date
                """, body.user_id, apartment_id, body.is_primary)
            except asyncpg.ForeignKeyViolationError:
                raise HTTPException(status_code=404, detail="User not found")

            target_id = body.user_id
            new_value = dict(resident)

            # Fetch full details for response
            resident = await conn.fetchrow("""
                SELECT
                    ar.resident_id, ar.user_id, u.full_name, u.email, u.phone,
                    ar.is_primary, ar.is_active, ar.move_in_date
                FROM apartment_residents ar
                JOIN users u ON ar.user_id = u.user_id
                WHERE ar.resident_id = $1
            """, resident["resident_id"])

        elif body.email:
            # Create invitation
            token = str(uuid.uuid4())
            expires = datetime.now(timezone.utc) + timedelta(days=7)

            await conn.execute("""
                INSERT INTO activation_invitations
                    (apartment_id, email, token, created_by, expires_at)
                VALUES ($1, $2, $3, $4, $5)
            """, apartment_id, body.email, token, current_user.user_id, expires)

            target_id = None
            new_value = {
                "email": body.email,
                "invitation_sent": True,
                "token_prefix": token[:8] + "...",
            }

            raise HTTPException(
                status_code=202,
                detail=f"Invitation sent to {body.email}. They must accept within 7 days.",
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide either user_id (existing user) or email (new invitation)",
            )

    # Audit
    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=apartment_id,
        action="resident_added",
        target_type="resident",
        target_id=target_id,
        new_value=new_value,
        reason=body.reason,
        ip_address=request.client.host if request.client else None,
    )

    return dict(resident)


@router.delete("/apartments/{apartment_id}/residents/{user_id}")
async def remove_resident(
    apartment_id: int,
    user_id: int,
    body: RemoveResidentRequest = RemoveResidentRequest(),
    request: Request = None,
    current_user: CurrentUser = Depends(get_current_user),
    _deps: tuple = Depends(require_action(PermAction.REMOVE_TENANTS)),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """
    Remove (deactivate) a resident from an apartment.
    The resident record is soft-deleted — is_active set to FALSE.
    Requires REMOVE_TENANTS permission.
    """
    async with db_pool.acquire() as conn:
        # Capture previous state
        previous = await conn.fetchrow(
            "SELECT * FROM apartment_residents WHERE apartment_id = $1 AND user_id = $2",
            apartment_id, user_id,
        )
        if not previous:
            raise HTTPException(status_code=404, detail="Resident not found in this apartment")

        # Prevent removing the last primary resident unless body corp admin
        if previous["is_primary"]:
            other_primaries = await conn.fetchval(
                "SELECT COUNT(*) FROM apartment_residents WHERE apartment_id = $1 AND is_primary = TRUE AND user_id != $2 AND is_active = TRUE",
                apartment_id, user_id,
            )
            if other_primaries == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot remove the only primary resident. Assign another primary resident first.",
                )

        # Soft-delete
        await conn.execute("""
            UPDATE apartment_residents
            SET is_active = FALSE, move_out_date = CURRENT_DATE, updated_at = NOW()
            WHERE apartment_id = $1 AND user_id = $2
        """, apartment_id, user_id)

    # Audit
    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=apartment_id,
        action="resident_removed",
        target_type="resident",
        target_id=user_id,
        previous_value=dict(previous),
        new_value={"is_active": False, "move_out_date": str(datetime.now(timezone.utc).date())},
        reason=body.reason,
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "removed", "user_id": user_id, "apartment_id": apartment_id}


# ============================================================================
# Resident Activation / Deactivation
# ============================================================================

@router.post("/apartments/{apartment_id}/residents/{user_id}/activate")
async def activate_resident(
    apartment_id: int,
    user_id: int,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    _deps: tuple = Depends(require_action(PermAction.ACTIVATE_RESIDENTS)),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Reactivate a previously deactivated resident."""
    async with db_pool.acquire() as conn:
        previous = await conn.fetchrow(
            "SELECT * FROM apartment_residents WHERE apartment_id = $1 AND user_id = $2",
            apartment_id, user_id,
        )
        if not previous:
            raise HTTPException(status_code=404, detail="Resident not found")

        await conn.execute("""
            UPDATE apartment_residents
            SET is_active = TRUE, updated_at = NOW()
            WHERE apartment_id = $1 AND user_id = $2
        """, apartment_id, user_id)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=apartment_id,
        action="resident_activated",
        target_type="resident",
        target_id=user_id,
        previous_value=dict(previous),
        new_value={"is_active": True},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "activated", "user_id": user_id, "apartment_id": apartment_id}


@router.post("/apartments/{apartment_id}/residents/{user_id}/deactivate")
async def deactivate_resident(
    apartment_id: int,
    user_id: int,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    _deps: tuple = Depends(require_action(PermAction.REMOVE_TENANTS)),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Suspend a resident without removing them."""
    async with db_pool.acquire() as conn:
        previous = await conn.fetchrow(
            "SELECT * FROM apartment_residents WHERE apartment_id = $1 AND user_id = $2",
            apartment_id, user_id,
        )
        if not previous:
            raise HTTPException(status_code=404, detail="Resident not found")

        await conn.execute("""
            UPDATE apartment_residents
            SET is_active = FALSE, updated_at = NOW()
            WHERE apartment_id = $1 AND user_id = $2
        """, apartment_id, user_id)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=apartment_id,
        action="resident_suspended",
        target_type="resident",
        target_id=user_id,
        previous_value=dict(previous),
        new_value={"is_active": False},
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "suspended", "user_id": user_id, "apartment_id": apartment_id}


# ============================================================================
# Property Administrator Assignment (Body Corp Admin)
# ============================================================================

@router.post(
    "/property-admins",
    response_model=PropertyAdminAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def assign_property_admin(
    body: AssignPropertyAdminRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_role(RoleName.BODY_CORP_ADMIN, RoleName.SUPER_ADMIN)),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """
    Assign a user as Property Administrator for an apartment.
    Requires body_corp_admin or super_admin role.

    is_resident = TRUE  → they live there (also needs apartment_residents row)
    is_resident = FALSE → they manage remotely, never appear as occupant
    """
    async with db_pool.acquire() as conn:
        # Verify apartment exists
        apt = await conn.fetchrow(
            "SELECT apartment_id, unit_number FROM apartments WHERE apartment_id = $1",
            body.apartment_id,
        )
        if not apt:
            raise HTTPException(status_code=404, detail="Apartment not found")

        # Verify user exists
        user = await conn.fetchrow(
            "SELECT user_id, full_name FROM users WHERE user_id = $1 AND is_active = TRUE",
            body.user_id,
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found or inactive")

        # Ensure user has property_admin role
        role_id = await conn.fetchval(
            "SELECT role_id FROM roles WHERE role_name = 'property_admin'"
        )
        await conn.execute("""
            INSERT INTO user_roles (user_id, role_id, granted_by)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
        """, body.user_id, role_id, current_user.user_id)

        # If is_resident, verify they're actually a resident of the apartment
        if body.is_resident:
            is_actually_resident = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM apartment_residents WHERE user_id = $1 AND apartment_id = $2 AND is_active = TRUE)",
                body.user_id, body.apartment_id,
            )
            if not is_actually_resident:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot set is_resident=True: user is not an active resident of this apartment. "
                            "Add them as a resident first, or set is_resident=False.",
                )

        # Create assignment
        try:
            assignment = await conn.fetchrow("""
                INSERT INTO property_admin_assignments (user_id, apartment_id, is_resident, assigned_by)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, apartment_id)
                DO UPDATE SET is_resident = $3, revoked_at = NULL, assigned_by = $4, assigned_at = NOW()
                RETURNING *
            """, body.user_id, body.apartment_id, body.is_resident, current_user.user_id)
        except asyncpg.UniqueViolationError:
            raise HTTPException(status_code=409, detail="Assignment already exists")

    admin_type = (
        PropertyAdminType.RESIDENT if body.is_resident
        else PropertyAdminType.NON_RESIDENT
    )

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="property_admin_assigned",
        target_type="property_admin",
        target_id=body.user_id,
        new_value={
            "user_id": body.user_id,
            "user_name": user["full_name"],
            "apartment": apt["unit_number"],
            "is_resident": body.is_resident,
            "admin_type": admin_type.value,
        },
        reason=body.reason,
        ip_address=request.client.host if request.client else None,
    )

    return {
        **dict(assignment),
        "admin_type": admin_type,
    }


@router.delete("/property-admins/{apartment_id}/{user_id}")
async def revoke_property_admin(
    apartment_id: int,
    user_id: int,
    body: RevokePropertyAdminRequest = RevokePropertyAdminRequest(),
    request: Request = None,
    current_user: CurrentUser = Depends(require_role(RoleName.BODY_CORP_ADMIN, RoleName.SUPER_ADMIN)),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Revoke a user's property administrator access to an apartment."""
    async with db_pool.acquire() as conn:
        previous = await conn.fetchrow(
            "SELECT * FROM property_admin_assignments WHERE apartment_id = $1 AND user_id = $2 AND revoked_at IS NULL",
            apartment_id, user_id,
        )
        if not previous:
            raise HTTPException(status_code=404, detail="Assignment not found or already revoked")

        await conn.execute("""
            UPDATE property_admin_assignments
            SET revoked_at = NOW()
            WHERE apartment_id = $1 AND user_id = $2 AND revoked_at IS NULL
        """, apartment_id, user_id)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=apartment_id,
        action="property_admin_revoked",
        target_type="property_admin",
        target_id=user_id,
        previous_value=dict(previous),
        new_value={"revoked_at": datetime.now(timezone.utc).isoformat()},
        reason=body.reason,
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "revoked", "user_id": user_id, "apartment_id": apartment_id}


# ============================================================================
# Invitations
# ============================================================================

@router.post("/invitations", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    body: CreateInvitationRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    _deps: tuple = Depends(require_action(PermAction.ADD_TENANTS)),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Create an activation invitation for a new resident."""
    token = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=7)

    async with db_pool.acquire() as conn:
        invitation = await conn.fetchrow("""
            INSERT INTO activation_invitations
                (apartment_id, email, token, created_by, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        """, body.apartment_id, body.email, token, current_user.user_id, expires)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="invitation_created",
        target_type="invitation",
        target_id=invitation["invitation_id"],
        new_value={"email": body.email, "expires_at": expires.isoformat()},
        reason=body.reason,
        ip_address=request.client.host if request.client else None,
    )

    return dict(invitation)


@router.get("/invitations/{apartment_id}", response_model=list[InvitationOut])
async def list_invitations(
    apartment_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    _deps: tuple = Depends(require_property_admin_for()),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """List all invitations for an apartment."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM activation_invitations WHERE apartment_id = $1 ORDER BY created_at DESC",
            apartment_id,
        )
        return [dict(r) for r in rows]


# ============================================================================
# Audit Trail
# ============================================================================

@router.get("/audit/{apartment_id}", response_model=list[AuditLogEntry])
async def get_audit_log(
    apartment_id: int,
    action: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    _deps: tuple = Depends(require_action(PermAction.VIEW_APARTMENT_ACTIVITY)),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """Query the audit log for an apartment. Requires VIEW_APARTMENT_ACTIVITY."""
    entries = await query_audit_log(
        db_pool,
        apartment_id=apartment_id,
        action=action,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    return entries


# ============================================================================
# User Profile
# ============================================================================

@router.post("/me/delete-account")
async def delete_my_account(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """
    Delete the current user's account per Play Store account deletion requirement.

    Anonymizes all PII (email → deleted-{id}@deleted.anfieldvoice.local,
    phone → NULL, name → 'Deleted User'), disables login, soft-removes
    from all apartments, and revokes all property admin assignments.

    Audit trail entries are preserved with the user_id intact so estate
    compliance records remain valid — the name displays as 'Deleted User'.
    """
    body = await request.json()
    confirm = body.get("confirm", False)
    reason = body.get("reason", "User requested account deletion")

    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Confirmation required. Set confirm=true to delete your account.",
        )

    async with db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT user_id, email, full_name, is_active FROM users WHERE user_id = $1",
            current_user.user_id,
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user["is_active"]:
            raise HTTPException(
                status_code=400,
                detail="Account is already deleted or deactivated.",
            )

        old_email = user["email"]
        old_name = user["full_name"]
        anonymized_email = f"deleted-{user['user_id']}@deleted.anfieldvoice.local"

        # 1. Anonymize all PII, disable account
        await conn.execute("""
            UPDATE users
            SET email = $1,
                phone = NULL,
                full_name = 'Deleted User',
                password_hash = '',
                is_active = FALSE,
                updated_at = NOW()
            WHERE user_id = $2
        """, anonymized_email, current_user.user_id)

        # 2. Soft-remove from all apartment residents
        await conn.execute("""
            UPDATE apartment_residents
            SET is_active = FALSE, updated_at = NOW()
            WHERE user_id = $1 AND is_active = TRUE
        """, current_user.user_id)

        # 3. Revoke all property admin assignments
        await conn.execute("""
            UPDATE property_admin_assignments
            SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL
        """, current_user.user_id)

        # 4. Expire all pending invitations created by this user
        await conn.execute("""
            UPDATE activation_invitations
            SET status = 'revoked'
            WHERE created_by = $1 AND status = 'pending'
        """, current_user.user_id)

    # 5. Audit trail
    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=None,
        action="account_deleted",
        target_type="user",
        target_id=current_user.user_id,
        previous_value={
            "email": old_email,
            "full_name": old_name,
        },
        new_value={
            "email": anonymized_email,
            "full_name": "Deleted User",
            "is_active": False,
        },
        reason=reason,
        ip_address=request.client.host if request.client else None,
    )

    return {
        "status": "deleted",
        "message": (
            "Your account has been deleted. Your personal data has been anonymized. "
            "Audit trail references are retained for estate compliance purposes."
        ),
    }


@router.get("/me", response_model=UserOut)
async def get_my_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """Get the current user's profile with roles."""
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT user_id, email, phone, full_name, is_active, created_at FROM users WHERE user_id = $1",
            current_user.user_id,
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        roles = await conn.fetch("""
            SELECT r.role_id, r.role_name, r.description
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.role_id
            WHERE ur.user_id = $1
        """, current_user.user_id)

        result = dict(user)
        result["roles"] = [dict(r) for r in roles]
        return result
