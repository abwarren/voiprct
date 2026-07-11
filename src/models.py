"""
AnfieldVoice — Pydantic models for Property Administrator role management.
Roles are additive. A user may possess multiple roles simultaneously.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ============================================================================
# Role System
# ============================================================================

class RoleName(StrEnum):
    """System roles. Additive — a user can have many."""
    RESIDENT = "resident"
    PROPERTY_ADMIN = "property_admin"
    SECURITY = "security"
    MAINTENANCE = "maintenance"
    BODY_CORP_ADMIN = "body_corp_admin"
    SUPER_ADMIN = "super_admin"


class RoleOut(BaseModel):
    role_id: int
    role_name: RoleName
    description: Optional[str] = None


# ============================================================================
# User
# ============================================================================

class UserBase(BaseModel):
    email: EmailStr
    phone: Optional[str] = None
    full_name: str


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserOut(UserBase):
    user_id: int
    is_active: bool
    roles: list[RoleOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    """Fields a property administrator may update on a tenant."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


# ============================================================================
# Apartment
# ============================================================================

class ApartmentBase(BaseModel):
    building: Optional[str] = None
    unit_number: str
    max_residents: int = Field(default=4, ge=1, le=20)


class ApartmentCreate(ApartmentBase):
    pass


class ApartmentOut(ApartmentBase):
    apartment_id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ============================================================================
# Apartment Residents
# ============================================================================

class ApartmentResidentOut(BaseModel):
    """A resident assigned to an apartment."""
    resident_id: int
    user_id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    is_primary: bool
    is_active: bool
    move_in_date: Optional[date] = None

    model_config = {"from_attributes": True}


class AddResidentRequest(BaseModel):
    """Property admin adds a resident to their apartment."""
    user_id: Optional[int] = None        # Existing user
    email: Optional[EmailStr] = None     # OR invite a new user
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_primary: bool = False
    reason: Optional[str] = None         # Audit trail


class RemoveResidentRequest(BaseModel):
    """Property admin removes a resident from their apartment."""
    reason: Optional[str] = None


# ============================================================================
# Property Administrator
# ============================================================================

class PropertyAdminType(StrEnum):
    RESIDENT = "Resident Property Administrator"
    NON_RESIDENT = "Non-Resident Property Administrator"


class PropertyAdminAssignmentOut(BaseModel):
    """Property administrator's relationship to an apartment."""
    assignment_id: int
    user_id: int
    apartment_id: int
    is_resident: bool
    admin_type: PropertyAdminType
    assigned_at: datetime

    model_config = {"from_attributes": True}


class AssignPropertyAdminRequest(BaseModel):
    """Body corp admin assigns a property admin to an apartment."""
    user_id: int
    apartment_id: int
    is_resident: bool = False            # TRUE if they also live there
    reason: Optional[str] = None


class RevokePropertyAdminRequest(BaseModel):
    reason: Optional[str] = None


# ============================================================================
# Activation Invitations
# ============================================================================

class CreateInvitationRequest(BaseModel):
    apartment_id: int
    email: EmailStr
    reason: Optional[str] = None


class InvitationOut(BaseModel):
    invitation_id: int
    apartment_id: int
    email: str
    token: str
    status: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class AcceptInvitationRequest(BaseModel):
    token: str
    full_name: str
    password: str = Field(min_length=8)
    phone: Optional[str] = None


# ============================================================================
# Audit
# ============================================================================

class AuditLogEntry(BaseModel):
    audit_id: int
    admin_user_id: int
    admin_name: Optional[str] = None
    apartment_id: Optional[int] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    previous_value: Optional[dict] = None
    new_value: Optional[dict] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditQuery(BaseModel):
    apartment_id: Optional[int] = None
    admin_user_id: Optional[int] = None
    action: Optional[str] = None
    target_type: Optional[str] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)


# ============================================================================
# Permissions Response
# ============================================================================

class PermissionCheck(BaseModel):
    """Response to 'can this user perform this action on this apartment?'"""
    allowed: bool
    action: str
    apartment_id: int
    reason: Optional[str] = None


class UserPermissions(BaseModel):
    """Complete permission set for a user on a specific apartment."""
    user_id: int
    apartment_id: int
    receive_gate_calls: bool = False
    generate_visitor_pin: bool = False
    create_expected_arrival: bool = False
    add_tenants: bool = False
    remove_tenants: bool = False
    activate_residents: bool = False
    view_apartment_activity: bool = False
    estate_administration: bool = False
    is_resident: bool = False
    is_property_admin: bool = False
    admin_type: Optional[PropertyAdminType] = None


# ============================================================================
# Gate Calls (Slice 1 — WebSocket Signalling)
# ============================================================================


class GateCallOut(BaseModel):
    """Outbound model for gate call records."""
    call_id: int
    apartment_id: int
    caller_unit: str
    call_status: str
    started_at: datetime
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_secs: Optional[int] = None

    model_config = {"from_attributes": True}


class GateCallCreate(BaseModel):
    """A gate/intercom hardware initiates a call to an apartment."""
    apartment_id: int
    caller_unit: str = "Main Gate"


class GateCallAnswer(BaseModel):
    """Resident answers or rejects a gate call."""
    action: str  # "answer" or "reject"


class GateCallAction(BaseModel):
    """REST fallback action for a gate call."""
    action: str  # "answer" or "reject"


class GateCallHistory(BaseModel):
    """Filter for call history queries."""
    apartment_id: Optional[int] = None
    limit: int = 50
    offset: int = 0


# ============================================================================
# WebRTC Signalling (Slice 2)
# ============================================================================


class SdpOffer(BaseModel):
    """SDP offer sent from the answering client."""
    call_id: int
    sdp: str
    type: str = "offer"


class SdpAnswer(BaseModel):
    """SDP answer sent back to the answering client."""
    call_id: int
    sdp: str
    type: str = "answer"


class IceCandidate(BaseModel):
    """ICE candidate for trickle ICE."""
    call_id: int
    candidate: str
    sdp_mid: Optional[str] = None
    sdp_mline_index: Optional[int] = None


# ============================================================================
# Visitor PINs (Slice 3)
# ============================================================================


class VisitorPinCreate(BaseModel):
    """Create a new visitor PIN."""
    apartment_id: int
    visitor_name: Optional[str] = None
    purpose: Optional[str] = None
    expires_in_hours: int = 24


class VisitorPinOut(BaseModel):
    """Visitor PIN response."""
    pin_id: int
    apartment_id: int
    created_by: int
    pin_code: str
    visitor_name: Optional[str] = None
    purpose: Optional[str] = None
    expires_at: datetime
    used_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PinVerifyRequest(BaseModel):
    """Security verifies a PIN at the gate."""
    pin_code: str
    gate_unit: str = "Main Gate"


class PinVerifyResponse(BaseModel):
    """PIN verification result."""
    valid: bool
    apartment_id: Optional[int] = None
    visitor_name: Optional[str] = None
    reason: Optional[str] = None


# ============================================================================
# Expected Arrivals (Slice 3)
# ============================================================================


class ExpectedArrivalCreate(BaseModel):
    """Pre-register a visitor arrival."""
    apartment_id: int
    visitor_name: str
    vehicle_plate: Optional[str] = None
    expected_at: datetime
    notes: Optional[str] = None


class ExpectedArrivalOut(BaseModel):
    """Expected arrival response."""
    arrival_id: int
    apartment_id: int
    created_by: int
    visitor_name: str
    vehicle_plate: Optional[str] = None
    expected_at: datetime
    notes: Optional[str] = None
    arrived_at: Optional[datetime] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ArrivalAction(BaseModel):
    """Mark an arrival as arrived or cancelled."""
    action: str  # "arrive" or "cancel"
