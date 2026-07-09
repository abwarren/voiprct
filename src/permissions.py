"""
AnfieldVoice — Permissions Matrix
=================================
Determines what a user can do on a given apartment based on their additive roles.

Key design principle: a Non-Resident Property Administrator must NEVER
appear as an apartment occupant or receive resident-only notifications.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Optional

from src.models import PropertyAdminType


class Action(StrEnum):
    """Actions subject to permission checks."""
    RECEIVE_GATE_CALLS      = "receive_gate_calls"
    GENERATE_VISITOR_PIN    = "generate_visitor_pin"
    CREATE_EXPECTED_ARRIVAL = "create_expected_arrival"
    ADD_TENANTS             = "add_tenants"
    REMOVE_TENANTS          = "remove_tenants"
    ACTIVATE_RESIDENTS      = "activate_residents"
    VIEW_APARTMENT_ACTIVITY = "view_apartment_activity"
    ESTATE_ADMINISTRATION   = "estate_administration"


# Actions that require the user to be a RESIDENT of the apartment
_RESIDENT_ONLY_ACTIONS: set[Action] = {
    Action.RECEIVE_GATE_CALLS,
    Action.GENERATE_VISITOR_PIN,
    Action.CREATE_EXPECTED_ARRIVAL,
}

# Actions available to ANY property administrator (resident or not)
_PROPERTY_ADMIN_ACTIONS: set[Action] = {
    Action.ADD_TENANTS,
    Action.REMOVE_TENANTS,
    Action.ACTIVATE_RESIDENTS,
    Action.VIEW_APARTMENT_ACTIVITY,
}

# Actions requiring body_corp_admin or super_admin
_ESTATE_ACTIONS: set[Action] = {
    Action.ESTATE_ADMINISTRATION,
}


@dataclass
class PermissionSet:
    """A user's complete permissions on a specific apartment."""
    user_id: int
    apartment_id: int
    is_resident: bool = False
    is_property_admin: bool = False
    is_resident_property_admin: bool = False  # lives there AND manages it
    is_body_corp_admin: bool = False
    is_super_admin: bool = False
    admin_type: Optional[PropertyAdminType] = None

    def can(self, action: Action) -> bool:
        """Check permission for a single action."""
        # Super admins and body corp admins can do anything on any apartment
        if self.is_super_admin or self.is_body_corp_admin:
            return True

        # Resident-only actions — user MUST be a resident of THIS apartment
        if action in _RESIDENT_ONLY_ACTIONS:
            return self.is_resident

        # Property admin actions — user MUST be a property admin for THIS apartment
        if action in _PROPERTY_ADMIN_ACTIONS:
            return self.is_property_admin

        # Estate administration — body corp or super admin only (already handled above)
        if action in _ESTATE_ACTIONS:
            return False

        return False

    def as_matrix(self) -> dict:
        """Full permissions matrix as a dict (matches the specification table)."""
        return {
            "receive_gate_calls":      self.can(Action.RECEIVE_GATE_CALLS),
            "generate_visitor_pin":    self.can(Action.GENERATE_VISITOR_PIN),
            "create_expected_arrival": self.can(Action.CREATE_EXPECTED_ARRIVAL),
            "add_tenants":             self.can(Action.ADD_TENANTS),
            "remove_tenants":          self.can(Action.REMOVE_TENANTS),
            "activate_residents":      self.can(Action.ACTIVATE_RESIDENTS),
            "view_apartment_activity": self.can(Action.VIEW_APARTMENT_ACTIVITY),
            "estate_administration":   self.can(Action.ESTATE_ADMINISTRATION),
        }

    def as_user_permissions(self) -> dict:
        """Full permission model for API responses."""
        return {
            **self.as_matrix(),
            "user_id": self.user_id,
            "apartment_id": self.apartment_id,
            "is_resident": self.is_resident,
            "is_property_admin": self.is_property_admin,
            "admin_type": self.admin_type.value if self.admin_type else None,
        }


# ============================================================================
# Permission Resolution
# ============================================================================

async def resolve_permissions(
    db_pool,
    user_id: int,
    apartment_id: int,
) -> PermissionSet:
    """
    Resolve complete permissions for a user on an apartment.
    Queries the DB to determine:
      - Is the user a resident of this apartment?
      - Is the user a property admin for this apartment?
      - If property admin: resident or non-resident?
      - Is the user a body_corp_admin or super_admin?
    """
    import asyncpg

    async with db_pool.acquire() as conn:
        # Single query to get all relevant state
        row = await conn.fetchrow("""
            SELECT
                -- Is this user an active resident of this apartment?
                EXISTS (
                    SELECT 1 FROM apartment_residents
                    WHERE user_id = $1 AND apartment_id = $2 AND is_active = TRUE
                ) AS is_resident,

                -- Is this user a property admin for this apartment?
                EXISTS (
                    SELECT 1 FROM property_admin_assignments
                    WHERE user_id = $1 AND apartment_id = $2 AND revoked_at IS NULL
                ) AS is_property_admin,

                -- If property admin, do they live there?
                (
                    SELECT is_resident FROM property_admin_assignments
                    WHERE user_id = $1 AND apartment_id = $2 AND revoked_at IS NULL
                ) AS admin_is_resident,

                -- Does user have body_corp_admin role?
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.role_id
                    WHERE ur.user_id = $1 AND r.role_name = 'body_corp_admin'
                ) AS is_body_corp_admin,

                -- Does user have super_admin role?
                EXISTS (
                    SELECT 1 FROM user_roles ur
                    JOIN roles r ON ur.role_id = r.role_id
                    WHERE ur.user_id = $1 AND r.role_name = 'super_admin'
                ) AS is_super_admin
        """, user_id, apartment_id)

        if row is None:
            raise ValueError(f"Apartment {apartment_id} not found")

        is_resident = row["is_resident"]
        is_property_admin = row["is_property_admin"]
        admin_is_resident = row["admin_is_resident"] or False

        # Determine admin type
        admin_type = None
        if is_property_admin:
            admin_type = (
                PropertyAdminType.RESIDENT
                if admin_is_resident
                else PropertyAdminType.NON_RESIDENT
            )

        return PermissionSet(
            user_id=user_id,
            apartment_id=apartment_id,
            is_resident=is_resident,
            is_property_admin=is_property_admin,
            is_resident_property_admin=(is_resident and is_property_admin and admin_is_resident),
            is_body_corp_admin=row["is_body_corp_admin"],
            is_super_admin=row["is_super_admin"],
            admin_type=admin_type,
        )


async def get_user_roles(db_pool, user_id: int) -> set[str]:
    """Get all role names for a user."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT r.role_name
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.role_id
            WHERE ur.user_id = $1
        """, user_id)
        return {r["role_name"] for r in rows}


async def get_managed_apartments(db_pool, user_id: int) -> list[int]:
    """Get all apartment IDs this user manages as a property admin."""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT apartment_id FROM property_admin_assignments
            WHERE user_id = $1 AND revoked_at IS NULL
        """, user_id)
        return [r["apartment_id"] for r in rows]
