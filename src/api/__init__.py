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

import json

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
    GateCallAction,
    GateCallCreate,
    GateCallOut,
    InvitationOut,
    PermissionCheck,
    PropertyAdminAssignmentOut,
    PropertyAdminType,
    RemoveResidentRequest,
    RevokePropertyAdminRequest,
    RoleName,
    UserOut,
    UserPermissions,
    VisitorPinCreate,
    VisitorPinOut,
    PinVerifyRequest,
    PinVerifyResponse,
    ExpectedArrivalCreate,
    ExpectedArrivalOut,
    ArrivalAction,
    PushTokenCreate,
    PushTokenOut,
    RecurringVisitorCreate,
    RecurringVisitorOut,
    RecurringVisitorUpdate,
    NfcCredentialOut,
    ActivatePhoneNfcRequest,
    RegisterTagRequest,
    VerifyNfcRequest,
    NfcVerifyResponse,
    GateAccessLogOut,
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
    """Authenticate with email or username and password. Returns a JWT token."""
    import json

    body = await request.json()
    email = body.get("email", "").strip().lower()
    username = body.get("username", "").strip().lower()
    password = body.get("password", "")

    if not password or (not email and not username):
        raise HTTPException(status_code=400, detail="Password and email or username are required")

    async with db_pool.acquire() as conn:
        if email:
            user = await conn.fetchrow(
                "SELECT user_id, email, username, password_hash, full_name, is_active FROM users WHERE LOWER(email) = $1",
                email,
            )
        else:
            user = await conn.fetchrow(
                "SELECT user_id, email, username, password_hash, full_name, is_active FROM users WHERE username = $1",
                username,
            )
        if not user or not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

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


@router.get("/property-admins/{apartment_id}", response_model=list[PropertyAdminAssignmentOut])
async def list_property_admins(
    apartment_id: int,
    current_user: CurrentUser = Depends(require_role(RoleName.BODY_CORP_ADMIN, RoleName.SUPER_ADMIN)),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """List all property administrators for an apartment."""
    import asyncpg

    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                pa.assignment_id, pa.user_id, pa.apartment_id,
                pa.is_resident, pa.assigned_at, pa.revoked_at,
                u.full_name, u.email
            FROM property_admin_assignments pa
            JOIN users u ON pa.user_id = u.user_id
            WHERE pa.apartment_id = $1 AND pa.revoked_at IS NULL
        """, apartment_id)
    return [dict(r) for r in rows]


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
# Gate Calls (Slice 1 — WebSocket Signalling)
# ============================================================================


@router.post("/gate-calls", response_model=GateCallOut, status_code=status.HTTP_201_CREATED)
async def initiate_gate_call(
    body: GateCallCreate,
    request: Request,
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Gate/intercom hardware initiates a call to an apartment.

    This is typically called by the gate terminal (Asterisk, Fanvil, Htek, etc.)
    when someone presses the call button at the entrance.
    """
    import asyncpg

    # Verify apartment exists and is active
    async with db_pool.acquire() as conn:
        apt = await conn.fetchval(
            "SELECT apartment_id FROM apartments WHERE apartment_id = $1 AND is_active = TRUE",
            body.apartment_id,
        )
        if not apt:
            raise HTTPException(status_code=404, detail="Apartment not found")

        call = await conn.fetchrow("""
            INSERT INTO gate_calls (apartment_id, caller_unit)
            VALUES ($1, $2)
            RETURNING call_id, apartment_id, caller_unit, call_status,
                      started_at, answered_at, ended_at, duration_secs
        """, body.apartment_id, body.caller_unit)

    # Notify connected residents via WebSocket
    from src.ws import send_to_apartment

    reached = await send_to_apartment(body.apartment_id, {
        "type": "incoming_call",
        "call_id": call["call_id"],
        "apartment_id": body.apartment_id,
        "caller_unit": body.caller_unit,
        "started_at": call["started_at"].isoformat(),
    })

    # Audit
    await write_audit_entry(
        db_pool,
        admin_user_id=0,  # System-initiated (gate hardware)
        apartment_id=body.apartment_id,
        action="gate_call_initiated",
        target_type="gate_call",
        target_id=call["call_id"],
        new_value={"caller_unit": body.caller_unit, "reached_residents": len(reached)},
        ip_address=request.client.host if request.client else None,
    )

    return dict(call)


@router.post("/gate-calls/{call_id}/action")
async def gate_call_action(
    call_id: int,
    body: GateCallAction,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Answer or reject a gate call. Used when WebSocket is not available (REST fallback).

    The user must be an active resident of the apartment the call is ringing for.
    """
    import asyncpg

    if body.action not in ("answer", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'answer' or 'reject'")

    new_status = "answered" if body.action == "answer" else "rejected"

    async with db_pool.acquire() as conn:
        call = await conn.fetchrow(
            "SELECT * FROM gate_calls WHERE call_id = $1 AND call_status = 'ringing'",
            call_id,
        )
        if not call:
            raise HTTPException(status_code=404, detail="Call not found or no longer active")

        # Verify user is a resident
        is_resident = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM apartment_residents WHERE user_id = $1 AND apartment_id = $2 AND is_active = TRUE)",
            current_user.user_id, call["apartment_id"],
        )
        if not is_resident:
            raise HTTPException(status_code=403, detail="You are not a resident of this apartment")

        if body.action == "answer":
            await conn.execute(
                "UPDATE gate_calls SET call_status = $1, answered_at = NOW() WHERE call_id = $2",
                new_status, call_id,
            )
        else:
            await conn.execute(
                "UPDATE gate_calls SET call_status = $1, ended_at = NOW() WHERE call_id = $2",
                new_status, call_id,
            )

    # Notify apartment via WS
    from src.ws import send_to_apartment

    await send_to_apartment(call["apartment_id"], {
        "type": "call_updated",
        "call_id": call_id,
        "call_status": new_status,
    })

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=call["apartment_id"],
        action=f"gate_call_{body.action}ed",
        target_type="gate_call",
        target_id=call_id,
        ip_address=request.client.host if request.client else None,
    )

    return {"call_id": call_id, "status": new_status}


@router.get("/gate-calls", response_model=list[GateCallOut])
async def list_gate_calls(
    apartment_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """List gate call history. Residents see their apartment's calls.
    Property admins see assigned apartments. Body corp sees all.
    """
    from src.permissions import get_user_roles, get_managed_apartments

    roles = await get_user_roles(db_pool, current_user.user_id)
    is_body_corp = "body_corp_admin" in roles or "super_admin" in roles

    async with db_pool.acquire() as conn:
        if apartment_id:
            # Specific apartment — check access
            if not is_body_corp and apartment_id not in await get_managed_apartments(db_pool, current_user.user_id):
                # Check if user is a resident
                is_res = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM apartment_residents WHERE user_id = $1 AND apartment_id = $2 AND is_active = TRUE)",
                    current_user.user_id, apartment_id,
                )
                if not is_res:
                    raise HTTPException(status_code=403, detail="Access denied")
            rows = await conn.fetch(
                "SELECT call_id, apartment_id, caller_unit, call_status, started_at, answered_at, ended_at, duration_secs "
                "FROM gate_calls WHERE apartment_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                apartment_id, limit, offset,
            )
        elif is_body_corp:
            rows = await conn.fetch(
                "SELECT call_id, apartment_id, caller_unit, call_status, started_at, answered_at, ended_at, duration_secs "
                "FROM gate_calls ORDER BY created_at DESC LIMIT $1 OFFSET $2",
                limit, offset,
            )
        else:
            # Resident sees their own apartment's calls
            managed = await get_managed_apartments(db_pool, current_user.user_id)
            rows = await conn.fetch(
                "SELECT call_id, apartment_id, caller_unit, call_status, started_at, answered_at, ended_at, duration_secs "
                "FROM gate_calls WHERE apartment_id = ANY($1) ORDER BY created_at DESC LIMIT $2 OFFSET $3",
                managed or [0], limit, offset,
            )

    return [dict(r) for r in rows]


# ============================================================================
# Visitor PINs (Slice 3)
# ============================================================================


@router.post("/visitor-pins", response_model=VisitorPinOut, status_code=status.HTTP_201_CREATED)
async def create_visitor_pin(
    body: VisitorPinCreate,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Generate a time-bound visitor PIN for gate access."""
    import random

    # Verify user is a resident of this apartment
    async with db_pool.acquire() as conn:
        is_resident = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM apartment_residents WHERE user_id = $1 AND apartment_id = $2 AND is_active = TRUE)",
            current_user.user_id, body.apartment_id,
        )
        is_pa = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM property_admin_assignments WHERE user_id = $1 AND apartment_id = $2 AND revoked_at IS NULL)",
            current_user.user_id, body.apartment_id,
        )
        is_body_corp = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = $1 AND r.role_name IN ('body_corp_admin', 'super_admin'))",
            current_user.user_id,
        )
        if not (is_resident or is_pa or is_body_corp):
            raise HTTPException(status_code=403, detail="You are not associated with this apartment")

        # Generate 6-digit PIN
        pin_code = str(random.randint(100000, 999999))
        expires_at = datetime.now(timezone.utc) + timedelta(hours=body.expires_in_hours)

        pin = await conn.fetchrow("""
            INSERT INTO visitor_pins (apartment_id, created_by, pin_code, visitor_name, purpose, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING pin_id, apartment_id, created_by, pin_code, visitor_name, purpose, expires_at, used_at, is_active, created_at
        """, body.apartment_id, current_user.user_id, pin_code, body.visitor_name, body.purpose, expires_at)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="visitor_pin_created",
        target_type="visitor_pin",
        target_id=pin["pin_id"],
        new_value={"visitor_name": body.visitor_name, "expires_in_hours": body.expires_in_hours},
        ip_address=request.client.host if request.client else None,
    )

    return dict(pin)


@router.get("/visitor-pins/{apartment_id}", response_model=list[VisitorPinOut])
async def list_visitor_pins(
    apartment_id: int,
    show_expired: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """List visitor PINs for an apartment."""
    async with db_pool.acquire() as conn:
        if show_expired:
            rows = await conn.fetch(
                "SELECT pin_id, apartment_id, created_by, pin_code, visitor_name, purpose, expires_at, used_at, is_active, created_at "
                "FROM visitor_pins WHERE apartment_id = $1 ORDER BY created_at DESC LIMIT 50",
                apartment_id,
            )
        else:
            rows = await conn.fetch(
                "SELECT pin_id, apartment_id, created_by, pin_code, visitor_name, purpose, expires_at, used_at, is_active, created_at "
                "FROM visitor_pins WHERE apartment_id = $1 AND is_active = TRUE AND expires_at > NOW() ORDER BY created_at DESC",
                apartment_id,
            )
    return [dict(r) for r in rows]


@router.post("/visitor-pins/verify", response_model=PinVerifyResponse)
async def verify_visitor_pin(
    body: PinVerifyRequest,
    request: Request,
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Security/terminal verifies a visitor PIN at the gate."""
    async with db_pool.acquire() as conn:
        pin = await conn.fetchrow(
            "SELECT * FROM visitor_pins WHERE pin_code = $1 AND is_active = TRUE",
            body.pin_code,
        )
        if not pin:
            return PinVerifyResponse(valid=False, reason="Invalid or inactive PIN")

        if pin["expires_at"] < datetime.now(timezone.utc):
            await conn.execute(
                "UPDATE visitor_pins SET is_active = FALSE WHERE pin_id = $1",
                pin["pin_id"],
            )
            return PinVerifyResponse(valid=False, reason="PIN has expired")

        # Mark as used
        await conn.execute(
            "UPDATE visitor_pins SET used_at = NOW() WHERE pin_id = $1",
            pin["pin_id"],
        )

    await write_audit_entry(
        db_pool,
        admin_user_id=0,
        apartment_id=pin["apartment_id"],
        action="visitor_pin_verified",
        target_type="visitor_pin",
        target_id=pin["pin_id"],
        new_value={"gate_unit": body.gate_unit, "visitor_name": pin["visitor_name"]},
        ip_address=request.client.host if request.client else None,
    )

    return PinVerifyResponse(
        valid=True,
        apartment_id=pin["apartment_id"],
        visitor_name=pin["visitor_name"],
        reason="Access granted",
    )


@router.delete("/visitor-pins/{pin_id}")
async def revoke_visitor_pin(
    pin_id: int,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Revoke a visitor PIN before it expires."""
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE visitor_pins SET is_active = FALSE WHERE pin_id = $1",
            pin_id,
        )

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=None,
        action="visitor_pin_revoked",
        target_type="visitor_pin",
        target_id=pin_id,
        ip_address=request.client.host if request.client else None,
    )

    return {"status": "revoked", "pin_id": pin_id}


# ============================================================================
# Expected Arrivals (Slice 3)
# ============================================================================


@router.post("/arrivals", response_model=ExpectedArrivalOut, status_code=status.HTTP_201_CREATED)
async def create_expected_arrival(
    body: ExpectedArrivalCreate,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Pre-register a visitor arrival for gate notification."""
    async with db_pool.acquire() as conn:
        is_resident = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM apartment_residents WHERE user_id = $1 AND apartment_id = $2 AND is_active = TRUE)",
            current_user.user_id, body.apartment_id,
        )
        if not is_resident:
            raise HTTPException(status_code=403, detail="You are not a resident of this apartment")

        arrival = await conn.fetchrow("""
            INSERT INTO expected_arrivals (apartment_id, created_by, visitor_name, vehicle_plate, expected_at, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        """, body.apartment_id, current_user.user_id, body.visitor_name,
            body.vehicle_plate, body.expected_at, body.notes)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="expected_arrival_created",
        target_type="expected_arrival",
        target_id=arrival["arrival_id"],
        ip_address=request.client.host if request.client else None,
    )

    return dict(arrival)


@router.get("/arrivals/{apartment_id}", response_model=list[ExpectedArrivalOut])
async def list_expected_arrivals(
    apartment_id: int,
    status_filter: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda request: request.app.state.db_pool),
):
    """List expected arrivals for an apartment."""
    async with db_pool.acquire() as conn:
        if status_filter:
            rows = await conn.fetch(
                "SELECT * FROM expected_arrivals WHERE apartment_id = $1 AND status = $2 ORDER BY expected_at DESC LIMIT 50",
                apartment_id, status_filter,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM expected_arrivals WHERE apartment_id = $1 ORDER BY expected_at DESC LIMIT 50",
                apartment_id,
            )
    return [dict(r) for r in rows]


@router.post("/arrivals/{arrival_id}/action")
async def arrival_action(
    arrival_id: int,
    body: ArrivalAction,
    request: Request,
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Security marks an arrival as arrived, or resident cancels."""
    if body.action not in ("arrive", "cancel"):
        raise HTTPException(status_code=400, detail="Action must be 'arrive' or 'cancel'")

    new_status = "arrived" if body.action == "arrive" else "cancelled"
    update_field = "arrived_at = NOW()" if body.action == "arrive" else ""

    async with db_pool.acquire() as conn:
        if body.action == "arrive":
            await conn.execute(
                "UPDATE expected_arrivals SET status = $1, arrived_at = NOW() WHERE arrival_id = $2",
                new_status, arrival_id,
            )
        else:
            await conn.execute(
                "UPDATE expected_arrivals SET status = $1 WHERE arrival_id = $2",
                new_status, arrival_id,
            )

    return {"arrival_id": arrival_id, "status": new_status}


# ============================================================================
# Security Dashboard (Slice 7)
# ============================================================================


@router.get("/security/overview")
async def security_overview(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Estate-wide overview for security: today's expected arrivals, active PINs, recent calls."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start.replace(hour=23, minute=59, second=59)

    async with db_pool.acquire() as conn:
        # Check if user has security/body-corp access
        has_access = await conn.fetchval("""
            SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id
            WHERE ur.user_id = $1 AND r.role_name IN ('security', 'body_corp_admin', 'super_admin'))
        """, current_user.user_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

        # Today's expected arrivals
        arrivals = await conn.fetch("""
            SELECT ea.*, a.building, a.unit_number, u.full_name as resident_name
            FROM expected_arrivals ea
            JOIN apartments a ON ea.apartment_id = a.apartment_id
            JOIN users u ON ea.created_by = u.user_id
            WHERE ea.expected_at >= $1 AND ea.expected_at <= $2 AND ea.status = 'scheduled'
            ORDER BY ea.expected_at ASC
        """, today_start, today_end)

        # Active visitor PINs
        pins = await conn.fetch("""
            SELECT vp.*, a.building, a.unit_number, u.full_name as created_by_name
            FROM visitor_pins vp
            JOIN apartments a ON vp.apartment_id = a.apartment_id
            JOIN users u ON vp.created_by = u.user_id
            WHERE vp.is_active = TRUE AND vp.expires_at > NOW()
            ORDER BY vp.created_at DESC
        """)

        # Recent gate calls (last 24h)
        calls = await conn.fetch("""
            SELECT gc.*, a.building, a.unit_number
            FROM gate_calls gc
            JOIN apartments a ON gc.apartment_id = a.apartment_id
            WHERE gc.started_at >= $1
            ORDER BY gc.started_at DESC
            LIMIT 50
        """, today_start)

    return {
        "expected_arrivals": [dict(r) for r in arrivals],
        "active_pins": [dict(r) for r in pins],
        "recent_calls": [dict(r) for r in calls],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================================
# Directory (Slice 7) — Search by exact unit number
# ============================================================================


@router.get("/directory/search")
async def directory_search(
    unit: str,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Search for a neighbour by exact unit number.

    Only returns residents who have opted into the directory.
    Resident must have a pre-existing relationship (know the unit number).
    Returns unit info + resident names (no email/phone without consent).
    """
    async with db_pool.acquire() as conn:
        apt = await conn.fetchrow(
            "SELECT apartment_id, building, unit_number FROM apartments WHERE unit_number = $1 AND is_active = TRUE",
            unit.strip(),
        )
        if not apt:
            return {"found": False, "apartment": None, "residents": []}

        residents = await conn.fetch("""
            SELECT u.full_name, u.user_id, ar.is_primary
            FROM apartment_residents ar
            JOIN users u ON ar.user_id = u.user_id
            WHERE ar.apartment_id = $1 AND ar.is_active = TRUE
            ORDER BY ar.is_primary DESC, u.full_name ASC
        """, apt["apartment_id"])

    return {
        "found": True,
        "apartment": {
            "building": apt["building"],
            "unit_number": apt["unit_number"],
            "apartment_id": apt["apartment_id"],
        },
        "residents": [dict(r) for r in residents],
    }


# ============================================================================
# Push Notifications (Slice 6)
# ============================================================================


@router.post("/push-tokens", response_model=PushTokenOut, status_code=status.HTTP_201_CREATED)
async def register_push_token(
    body: PushTokenCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Register an Expo push notification token for the current user."""
    if body.platform not in ("ios", "android"):
        raise HTTPException(status_code=400, detail="Platform must be 'ios' or 'android'")

    async with db_pool.acquire() as conn:
        # Upsert token
        token = await conn.fetchrow("""
            INSERT INTO push_tokens (user_id, platform, token)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, platform, token)
            DO UPDATE SET is_active = TRUE, updated_at = NOW()
            RETURNING token_id, platform, token, is_active, created_at
        """, current_user.user_id, body.platform, body.token)

    return dict(token)


@router.get("/push-tokens", response_model=list[PushTokenOut])
async def list_push_tokens(
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """List the current user's registered push tokens."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT token_id, platform, token, is_active, created_at FROM push_tokens WHERE user_id = $1 ORDER BY created_at DESC",
            current_user.user_id,
        )
    return [dict(r) for r in rows]


@router.delete("/push-tokens/{token_id}")
async def remove_push_token(
    token_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Deactivate a push token (e.g. on logout)."""
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE push_tokens SET is_active = FALSE WHERE token_id = $1 AND user_id = $2",
            token_id, current_user.user_id,
        )
    return {"status": "removed"}


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
            "SELECT user_id, email, username, phone, full_name, is_active, created_at FROM users WHERE user_id = $1",
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

# ============================================================================
# Recurring Visitors (Slice 8)
# ============================================================================


@router.get("/recurring-visitors/{apartment_id}")
async def get_recurring_visitors(
    apartment_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """List recurring visitors for an apartment. Accessible by residents, PAs, and body corp."""
    from src.permissions import resolve_permissions
    perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)
    if not (perms.is_resident or perms.is_property_admin or perms.is_body_corp_admin or perms.is_super_admin):
        raise HTTPException(status_code=403, detail="Access denied")

    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT rv.*, u.full_name AS created_by_name
            FROM recurring_visitors rv
            JOIN users u ON rv.created_by = u.user_id
            WHERE rv.apartment_id = $1
            ORDER BY rv.visitor_name
        """, apartment_id)
        return [dict(r) for r in rows]


@router.post("/recurring-visitors", status_code=status.HTTP_201_CREATED)
async def create_recurring_visitor(
    body: RecurringVisitorCreate,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Create a recurring visitor for an apartment."""
    from src.permissions import resolve_permissions
    perms = await resolve_permissions(db_pool, current_user.user_id, body.apartment_id)
    if not (perms.is_resident or perms.is_property_admin or perms.is_body_corp_admin or perms.is_super_admin):
        raise HTTPException(status_code=403, detail="Access denied")

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO recurring_visitors
                (apartment_id, created_by, visitor_name, vehicle_plate,
                 schedule_type, schedule_data, valid_from, valid_until)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """, body.apartment_id, current_user.user_id, body.visitor_name,
            body.vehicle_plate or None, body.schedule_type,
            json.dumps(body.schedule_data) if body.schedule_data else None,
            body.valid_from, body.valid_until)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="recurring_visitor_created",
        target_type="recurring_visitor",
        target_id=row["recurring_id"],
        new_value={"visitor_name": body.visitor_name, "schedule_type": body.schedule_type},
        ip_address=request.client.host if request.client else None,
    )
    return dict(row)


@router.patch("/recurring-visitors/{recurring_id}")
async def update_recurring_visitor(
    recurring_id: int,
    body: RecurringVisitorUpdate,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Update a recurring visitor."""
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT * FROM recurring_visitors WHERE recurring_id = $1", recurring_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Recurring visitor not found")

        from src.permissions import resolve_permissions
        perms = await resolve_permissions(db_pool, current_user.user_id, existing["apartment_id"])
        if not (perms.is_resident or perms.is_property_admin or perms.is_body_corp_admin or perms.is_super_admin):
            raise HTTPException(status_code=403, detail="Access denied")

        updates = {}
        for field in ["visitor_name", "vehicle_plate", "schedule_type", "schedule_data", "is_active", "valid_from", "valid_until"]:
            val = getattr(body, field, None)
            if val is not None:
                updates[field] = val
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        set_clause = ", ".join([f"{k} = ${i+2}" for i, k in enumerate(updates.keys())])
        updates["updated_at"] = "NOW()"
        set_clause += ", updated_at = NOW()"

        sql = f"UPDATE recurring_visitors SET {set_clause} WHERE recurring_id = $1 RETURNING *"
        values = [recurring_id] + list(updates.values())
        row = await conn.fetchrow(sql, *values)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=existing["apartment_id"],
        action="recurring_visitor_updated",
        target_type="recurring_visitor",
        target_id=recurring_id,
        previous_value={"visitor_name": existing["visitor_name"], "schedule_type": existing["schedule_type"]},
        new_value=updates,
        ip_address=request.client.host if request.client else None,
    )
    return dict(row)


@router.delete("/recurring-visitors/{recurring_id}")
async def delete_recurring_visitor(
    recurring_id: int,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Delete a recurring visitor."""
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT * FROM recurring_visitors WHERE recurring_id = $1", recurring_id
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Recurring visitor not found")

        from src.permissions import resolve_permissions
        perms = await resolve_permissions(db_pool, current_user.user_id, existing["apartment_id"])
        if not (perms.is_resident or perms.is_property_admin or perms.is_body_corp_admin or perms.is_super_admin):
            raise HTTPException(status_code=403, detail="Access denied")

        await conn.execute("DELETE FROM recurring_visitors WHERE recurring_id = $1", recurring_id)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=existing["apartment_id"],
        action="recurring_visitor_deleted",
        target_type="recurring_visitor",
        target_id=recurring_id,
        previous_value={"visitor_name": existing["visitor_name"]},
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "deleted", "id": recurring_id}


# ============================================================================
# NFC Phone-as-Tag Gate Access (Slice 9)
# ============================================================================


@router.post("/nfc/activate-phone")
async def nfc_activate_phone(
    body: ActivatePhoneNfcRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Activate phone NFC for an apartment. Deactivates any physical tag."""
    from src.permissions import resolve_permissions
    perms = await resolve_permissions(db_pool, current_user.user_id, body.apartment_id)
    if not (perms.is_resident or perms.is_super_admin):
        raise HTTPException(status_code=403, detail="Only residents can activate phone NFC for their apartment")

    async with db_pool.acquire() as conn:
        async with conn.transaction():
            # Deactivate any existing phone credential for this user+apartment
            await conn.execute("""
                UPDATE nfc_credentials
                SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW()
                WHERE user_id = $1 AND apartment_id = $2 AND credential_type = 'phone' AND is_active = TRUE
            """, current_user.user_id, body.apartment_id)

            # Deactivate physical tag for this apartment (mutual exclusivity)
            await conn.execute("""
                UPDATE nfc_credentials
                SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW()
                WHERE apartment_id = $1 AND credential_type = 'tag' AND is_active = TRUE
            """, body.apartment_id)

            # Generate new phone token
            phone_token = str(uuid.uuid4())

            row = await conn.fetchrow("""
                INSERT INTO nfc_credentials
                    (user_id, apartment_id, phone_token, credential_type, is_active, activated_at)
                VALUES ($1, $2, $3, 'phone', TRUE, NOW())
                RETURNING *
            """, current_user.user_id, body.apartment_id, phone_token)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="nfc_phone_activated",
        target_type="nfc_credential",
        target_id=row["credential_id"],
        new_value={"credential_type": "phone", "apartment_id": body.apartment_id},
        ip_address=request.client.host if request.client else None,
    )
    return dict(row)


@router.post("/nfc/deactivate-phone")
async def nfc_deactivate_phone(
    body: ActivatePhoneNfcRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Deactivate phone NFC. The physical tag (if any) becomes active again."""
    from src.permissions import resolve_permissions
    perms = await resolve_permissions(db_pool, current_user.user_id, body.apartment_id)
    if not (perms.is_resident or perms.is_super_admin):
        raise HTTPException(status_code=403, detail="Access denied")

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE nfc_credentials
            SET is_active = FALSE, deactivated_at = NOW(), updated_at = NOW()
            WHERE user_id = $1 AND apartment_id = $2 AND credential_type = 'phone' AND is_active = TRUE
            RETURNING *
        """, current_user.user_id, body.apartment_id)

        if not row:
            raise HTTPException(status_code=404, detail="No active phone credential found")

        # Reactivate physical tag for this apartment
        await conn.execute("""
            UPDATE nfc_credentials
            SET is_active = TRUE, activated_at = NOW(), updated_at = NOW()
            WHERE apartment_id = $1 AND credential_type = 'tag' AND deactivated_at IS NOT NULL
        """, body.apartment_id)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="nfc_phone_deactivated",
        target_type="nfc_credential",
        target_id=row["credential_id"],
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "deactivated", "credential_id": row["credential_id"]}


@router.post("/nfc/verify")
async def nfc_verify_credential(
    body: VerifyNfcRequest,
    request: Request,
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Gate reader verifies a credential (tag UID or phone token)."""
    if not body.tag_uid and not body.phone_token:
        raise HTTPException(status_code=400, detail="Either tag_uid or phone_token is required")

    async with db_pool.acquire() as conn:
        if body.phone_token:
            cred = await conn.fetchrow("""
                SELECT nc.credential_id, nc.apartment_id, nc.credential_type,
                       u.full_name AS resident_name
                FROM nfc_credentials nc
                JOIN users u ON nc.user_id = u.user_id
                WHERE nc.phone_token = $1 AND nc.is_active = TRUE AND u.is_active = TRUE
            """, body.phone_token)
        else:
            cred = await conn.fetchrow("""
                SELECT nc.credential_id, nc.apartment_id, nc.credential_type,
                       u.full_name AS resident_name
                FROM nfc_credentials nc
                JOIN users u ON nc.user_id = u.user_id
                WHERE nc.tag_uid = $1 AND nc.is_active = TRUE AND u.is_active = TRUE
            """, body.tag_uid)

        if not cred:
            await conn.execute("""
                INSERT INTO gate_access_log (credential_id, apartment_id, gate_unit, access_type, granted, reason)
                VALUES (0, 0, $1, $2, FALSE, 'Credential not found or inactive')
            """, body.gate_unit, 'phone' if body.phone_token else 'tag')
            return {"granted": False, "reason": "Credential not found or inactive"}

        await conn.execute("""
            INSERT INTO gate_access_log (credential_id, apartment_id, gate_unit, access_type, granted)
            VALUES ($1, $2, $3, $4, TRUE)
        """, cred["credential_id"], cred["apartment_id"], body.gate_unit, cred["credential_type"])

    return {"granted": True, "apartment_id": cred["apartment_id"], "resident_name": cred["resident_name"]}


@router.get("/nfc/credentials")
async def nfc_list_credentials(
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """List the current user's NFC credentials."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM nfc_credentials
            WHERE user_id = $1
            ORDER BY created_at DESC
        """, current_user.user_id)
        return [dict(r) for r in rows]


@router.post("/nfc/register-tag", status_code=status.HTTP_201_CREATED)
async def nfc_register_tag(
    body: RegisterTagRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Admin registers a physical tag UID for a resident."""
    from src.permissions import resolve_permissions
    perms = await resolve_permissions(db_pool, current_user.user_id, body.apartment_id)
    if not (perms.is_body_corp_admin or perms.is_super_admin):
        raise HTTPException(status_code=403, detail="Only body corp admins can register physical tags")

    async with db_pool.acquire() as conn:
        await conn.execute("""
            UPDATE nfc_credentials
            SET is_active = FALSE, updated_at = NOW()
            WHERE apartment_id = $1 AND credential_type = 'tag' AND is_active = TRUE
        """, body.apartment_id)

        row = await conn.fetchrow("""
            INSERT INTO nfc_credentials
                (user_id, apartment_id, tag_uid, credential_type, is_active, activated_at)
            VALUES ($1, $2, $3, 'tag', TRUE, NOW())
            RETURNING *
        """, body.user_id, body.apartment_id, body.tag_uid)

    await write_audit_entry(
        db_pool,
        admin_user_id=current_user.user_id,
        apartment_id=body.apartment_id,
        action="nfc_tag_registered",
        target_type="nfc_credential",
        target_id=row["credential_id"],
        new_value={"tag_uid": body.tag_uid, "user_id": body.user_id},
        ip_address=request.client.host if request.client else None,
    )
    return dict(row)


@router.delete("/nfc/credentials/{credential_id}")
async def nfc_delete_credential(
    credential_id: int,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Delete an NFC credential (tag or phone)."""
    async with db_pool.acquire() as conn:
        cred = await conn.fetchrow("SELECT * FROM nfc_credentials WHERE credential_id = $1", credential_id)
        if not cred:
            raise HTTPException(status_code=404, detail="Credential not found")

        if cred["user_id"] != current_user.user_id:
            from src.permissions import resolve_permissions
            perms = await resolve_permissions(db_pool, current_user.user_id, cred["apartment_id"])
            if not (perms.is_body_corp_admin or perms.is_super_admin):
                raise HTTPException(status_code=403, detail="Access denied")

        await conn.execute("DELETE FROM nfc_credentials WHERE credential_id = $1", credential_id)

    return {"status": "deleted", "id": credential_id}


@router.get("/nfc/access-log")
async def nfc_access_log(
    apartment_id: Optional[int] = Query(None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(get_current_user),
    db_pool=Depends(lambda req: req.app.state.db_pool),
):
    """Gate access history. Filterable by apartment."""
    from src.permissions import resolve_permissions

    if apartment_id:
        perms = await resolve_permissions(db_pool, current_user.user_id, apartment_id)
        if not (perms.is_resident or perms.is_property_admin or perms.is_body_corp_admin or perms.is_super_admin):
            raise HTTPException(status_code=403, detail="Access denied")

    async with db_pool.acquire() as conn:
        if apartment_id:
            rows = await conn.fetch("""
                SELECT gal.*, nc.credential_type, nc.tag_uid, nc.phone_token
                FROM gate_access_log gal
                JOIN nfc_credentials nc ON gal.credential_id = nc.credential_id
                WHERE gal.apartment_id = $1
                ORDER BY gal.created_at DESC
                LIMIT $2 OFFSET $3
            """, apartment_id, limit, offset)
        else:
            rows = await conn.fetch("""
                SELECT gal.*, nc.credential_type
                FROM gate_access_log gal
                JOIN nfc_credentials nc ON gal.credential_id = nc.credential_id
                WHERE nc.user_id = $1
                ORDER BY gal.created_at DESC
                LIMIT $2 OFFSET $3
            """, current_user.user_id, limit, offset)

        return [dict(r) for r in rows]
