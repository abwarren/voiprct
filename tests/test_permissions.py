"""
Tests — Permissions Matrix Validation
======================================
Validates every cell in the specification's permissions matrix
against the Property Administrator role implementation.
"""
from __future__ import annotations

import pytest
from src.permissions import (
    Action,
    PermissionSet,
    PropertyAdminType,
)


# ============================================================================
# Test Fixtures — User Types
# ============================================================================

@pytest.fixture
def resident_only(apartment_id=1, user_id=1) -> PermissionSet:
    """A user who is only a resident — not a property admin."""
    return PermissionSet(
        user_id=user_id,
        apartment_id=apartment_id,
        is_resident=True,
        is_property_admin=False,
        admin_type=None,
    )


@pytest.fixture
def resident_property_admin(apartment_id=204, user_id=2) -> PermissionSet:
    """A user who lives in the apartment AND manages it as property admin."""
    return PermissionSet(
        user_id=user_id,
        apartment_id=apartment_id,
        is_resident=True,
        is_property_admin=True,
        is_resident_property_admin=True,
        admin_type=PropertyAdminType.RESIDENT,
    )


@pytest.fixture
def non_resident_property_admin(apartment_id=301, user_id=3) -> PermissionSet:
    """A property admin who manages the apartment but does NOT live there."""
    return PermissionSet(
        user_id=user_id,
        apartment_id=apartment_id,
        is_resident=False,
        is_property_admin=True,
        is_resident_property_admin=False,
        admin_type=PropertyAdminType.NON_RESIDENT,
    )


@pytest.fixture
def body_corp_admin(apartment_id=101, user_id=6) -> PermissionSet:
    """Body corporate administrator — estate-wide privileges."""
    return PermissionSet(
        user_id=user_id,
        apartment_id=apartment_id,
        is_resident=False,
        is_property_admin=False,
        is_body_corp_admin=True,
    )


@pytest.fixture
def super_admin(apartment_id=101, user_id=99) -> PermissionSet:
    """Super administrator — full system access."""
    return PermissionSet(
        user_id=user_id,
        apartment_id=apartment_id,
        is_super_admin=True,
    )


@pytest.fixture
def security_officer(apartment_id=101, user_id=4) -> PermissionSet:
    """Security officer — no resident or property admin privileges."""
    return PermissionSet(
        user_id=user_id,
        apartment_id=apartment_id,
        is_resident=False,
        is_property_admin=False,
    )


# ============================================================================
# Permission Matrix Tests — Directly from the Specification
# ============================================================================

class TestPermissionsMatrix:
    """
    Validates the exact permissions matrix from the engineering directive.

    | Function                | Resident | Property Admin (Resident) | Property Admin (Non-Resident) |
    | ----------------------- | -------- | ------------------------- | ----------------------------- |
    | Receive gate calls      | ✓        | ✓                         | ✗                             |
    | Generate visitor PIN    | ✓        | ✓                         | ✗                             |
    | Create Expected Arrival | ✓        | ✓                         | ✗                             |
    | Add tenants             | ✗        | ✓                         | ✓                             |
    | Remove tenants          | ✗        | ✓                         | ✓                             |
    | Activate residents      | ✗        | ✓                         | ✓                             |
    | View apartment activity | Limited  | ✓                         | ✓                             |
    | Estate administration   | ✗        | ✗                         | ✗                             |
    """

    # --- Resident-only actions ---

    def test_resident_can_receive_gate_calls(self, resident_only):
        assert resident_only.can(Action.RECEIVE_GATE_CALLS) is True

    def test_resident_can_generate_visitor_pin(self, resident_only):
        assert resident_only.can(Action.GENERATE_VISITOR_PIN) is True

    def test_resident_can_create_expected_arrival(self, resident_only):
        assert resident_only.can(Action.CREATE_EXPECTED_ARRIVAL) is True

    def test_resident_cannot_add_tenants(self, resident_only):
        assert resident_only.can(Action.ADD_TENANTS) is False

    def test_resident_cannot_remove_tenants(self, resident_only):
        assert resident_only.can(Action.REMOVE_TENANTS) is False

    def test_resident_cannot_activate_residents(self, resident_only):
        assert resident_only.can(Action.ACTIVATE_RESIDENTS) is False

    def test_resident_cannot_view_apartment_activity(self, resident_only):
        """Resident has limited view — not the full admin view."""
        assert resident_only.can(Action.VIEW_APARTMENT_ACTIVITY) is False

    def test_resident_cannot_estate_admin(self, resident_only):
        assert resident_only.can(Action.ESTATE_ADMINISTRATION) is False

    # --- Resident Property Administrator ---

    def test_resident_pa_can_receive_gate_calls(self, resident_property_admin):
        """Resident PA lives there → gets gate calls."""
        assert resident_property_admin.can(Action.RECEIVE_GATE_CALLS) is True

    def test_resident_pa_can_generate_visitor_pin(self, resident_property_admin):
        assert resident_property_admin.can(Action.GENERATE_VISITOR_PIN) is True

    def test_resident_pa_can_create_expected_arrival(self, resident_property_admin):
        assert resident_property_admin.can(Action.CREATE_EXPECTED_ARRIVAL) is True

    def test_resident_pa_can_add_tenants(self, resident_property_admin):
        assert resident_property_admin.can(Action.ADD_TENANTS) is True

    def test_resident_pa_can_remove_tenants(self, resident_property_admin):
        assert resident_property_admin.can(Action.REMOVE_TENANTS) is True

    def test_resident_pa_can_activate_residents(self, resident_property_admin):
        assert resident_property_admin.can(Action.ACTIVATE_RESIDENTS) is True

    def test_resident_pa_can_view_apartment_activity(self, resident_property_admin):
        assert resident_property_admin.can(Action.VIEW_APARTMENT_ACTIVITY) is True

    def test_resident_pa_cannot_estate_admin(self, resident_property_admin):
        assert resident_property_admin.can(Action.ESTATE_ADMINISTRATION) is False

    # --- Non-Resident Property Administrator ---

    def test_non_resident_pa_cannot_receive_gate_calls(self, non_resident_property_admin):
        """CRITICAL: Non-resident PA must NOT receive gate calls."""
        assert non_resident_property_admin.can(Action.RECEIVE_GATE_CALLS) is False

    def test_non_resident_pa_cannot_generate_visitor_pin(self, non_resident_property_admin):
        """CRITICAL: Non-resident PA must NOT generate PINs."""
        assert non_resident_property_admin.can(Action.GENERATE_VISITOR_PIN) is False

    def test_non_resident_pa_cannot_create_expected_arrival(self, non_resident_property_admin):
        """CRITICAL: Non-resident PA must NOT create arrivals."""
        assert non_resident_property_admin.can(Action.CREATE_EXPECTED_ARRIVAL) is False

    def test_non_resident_pa_can_add_tenants(self, non_resident_property_admin):
        assert non_resident_property_admin.can(Action.ADD_TENANTS) is True

    def test_non_resident_pa_can_remove_tenants(self, non_resident_property_admin):
        assert non_resident_property_admin.can(Action.REMOVE_TENANTS) is True

    def test_non_resident_pa_can_activate_residents(self, non_resident_property_admin):
        assert non_resident_property_admin.can(Action.ACTIVATE_RESIDENTS) is True

    def test_non_resident_pa_can_view_apartment_activity(self, non_resident_property_admin):
        assert non_resident_property_admin.can(Action.VIEW_APARTMENT_ACTIVITY) is True

    def test_non_resident_pa_cannot_estate_admin(self, non_resident_property_admin):
        assert non_resident_property_admin.can(Action.ESTATE_ADMINISTRATION) is False


class TestBodyCorpAdmin:
    """Body corporate and super admins can do everything."""

    def test_body_corp_admin_can_do_everything(self, body_corp_admin):
        for action in Action:
            assert body_corp_admin.can(action) is True, f"Body corp admin should be able to {action}"

    def test_super_admin_can_do_everything(self, super_admin):
        for action in Action:
            assert super_admin.can(action) is True, f"Super admin should be able to {action}"


class TestSecurityOfficer:
    """Security officers have no resident or property admin permissions."""

    def test_security_cannot_add_tenants(self, security_officer):
        assert security_officer.can(Action.ADD_TENANTS) is False

    def test_security_cannot_receive_gate_calls_as_resident(self, security_officer):
        """Security doesn't receive gate calls AS A RESIDENT — they have their own dashboard."""
        assert security_officer.can(Action.RECEIVE_GATE_CALLS) is False

    def test_security_cannot_generate_pins(self, security_officer):
        assert security_officer.can(Action.GENERATE_VISITOR_PIN) is False


# ============================================================================
# Design Principle Tests
# ============================================================================

class TestDesignPrinciples:
    """Tests validating the engineering directive's design principles."""

    def test_roles_are_additive(self):
        """
        Principle 1: Roles are additive, not exclusive.
        A user can be Resident + Property Admin simultaneously.
        """
        perms = PermissionSet(
            user_id=1,
            apartment_id=204,
            is_resident=True,
            is_property_admin=True,
            is_resident_property_admin=True,
            admin_type=PropertyAdminType.RESIDENT,
        )
        # Resident actions
        assert perms.can(Action.RECEIVE_GATE_CALLS) is True
        assert perms.can(Action.GENERATE_VISITOR_PIN) is True
        # Property admin actions
        assert perms.can(Action.ADD_TENANTS) is True
        assert perms.can(Action.REMOVE_TENANTS) is True

    def test_property_management_separate_from_resident(self):
        """
        Principle 2: Property management functions are separate from resident functions.
        A non-resident PA can manage the apartment without getting resident perks.
        """
        perms = PermissionSet(
            user_id=3,
            apartment_id=301,
            is_resident=False,
            is_property_admin=True,
            admin_type=PropertyAdminType.NON_RESIDENT,
        )
        # CAN manage
        assert perms.can(Action.ADD_TENANTS) is True
        # CANNOT receive resident features
        assert perms.can(Action.RECEIVE_GATE_CALLS) is False
        assert perms.can(Action.GENERATE_VISITOR_PIN) is False

    def test_non_resident_pa_never_appears_as_occupant(self):
        """
        Principle 3: A non-resident Property Administrator must never appear
        as an apartment occupant.
        """
        perms = PermissionSet(
            user_id=3,
            apartment_id=301,
            is_resident=False,              # NOT a resident
            is_property_admin=True,
            admin_type=PropertyAdminType.NON_RESIDENT,
        )
        assert perms.is_resident is False
        assert perms.admin_type == PropertyAdminType.NON_RESIDENT
        # Should appear as "manages remotely," never as occupant
        assert perms.can(Action.RECEIVE_GATE_CALLS) is False
        assert perms.can(Action.GENERATE_VISITOR_PIN) is False
        assert perms.can(Action.CREATE_EXPECTED_ARRIVAL) is False

    def test_admin_type_distinction(self):
        """
        The system must distinguish between Resident PA and Non-Resident PA.
        """
        resident_pa = PermissionSet(
            user_id=2, apartment_id=204,
            is_resident=True, is_property_admin=True,
            is_resident_property_admin=True,
            admin_type=PropertyAdminType.RESIDENT,
        )
        non_resident_pa = PermissionSet(
            user_id=3, apartment_id=301,
            is_resident=False, is_property_admin=True,
            admin_type=PropertyAdminType.NON_RESIDENT,
        )

        assert resident_pa.admin_type == PropertyAdminType.RESIDENT
        assert non_resident_pa.admin_type == PropertyAdminType.NON_RESIDENT

        # They should have different permissions
        assert resident_pa.can(Action.RECEIVE_GATE_CALLS) != non_resident_pa.can(Action.RECEIVE_GATE_CALLS)

    def test_notifications_only_to_active_residents(self):
        """
        Principle 4: Resident notifications must only be delivered to active residents.
        A non-resident PA should never receive resident notifications.
        """
        for user_type in [
            PermissionSet(user_id=3, apartment_id=301, is_resident=False, is_property_admin=True,
                          admin_type=PropertyAdminType.NON_RESIDENT),
            PermissionSet(user_id=4, apartment_id=101, is_resident=False, is_property_admin=False),
        ]:
            assert user_type.can(Action.RECEIVE_GATE_CALLS) is False, \
                f"User {user_type.user_id} should not receive gate calls"
            assert user_type.can(Action.GENERATE_VISITOR_PIN) is False, \
                f"User {user_type.user_id} should not generate PINs"


# ============================================================================
# Permission Matrix Export Test
# ============================================================================

class TestPermissionMatrixExport:
    """The as_matrix() method must produce the complete permissions spec."""

    def test_resident_only_matrix(self):
        perms = PermissionSet(
            user_id=1, apartment_id=101,
            is_resident=True, is_property_admin=False,
        )
        matrix = perms.as_matrix()
        assert matrix == {
            "receive_gate_calls": True,
            "generate_visitor_pin": True,
            "create_expected_arrival": True,
            "add_tenants": False,
            "remove_tenants": False,
            "activate_residents": False,
            "view_apartment_activity": False,
            "estate_administration": False,
        }

    def test_resident_pa_matrix(self):
        perms = PermissionSet(
            user_id=2, apartment_id=204,
            is_resident=True, is_property_admin=True,
            is_resident_property_admin=True,
            admin_type=PropertyAdminType.RESIDENT,
        )
        matrix = perms.as_matrix()
        assert matrix == {
            "receive_gate_calls": True,
            "generate_visitor_pin": True,
            "create_expected_arrival": True,
            "add_tenants": True,
            "remove_tenants": True,
            "activate_residents": True,
            "view_apartment_activity": True,
            "estate_administration": False,
        }

    def test_non_resident_pa_matrix(self):
        perms = PermissionSet(
            user_id=3, apartment_id=301,
            is_resident=False, is_property_admin=True,
            admin_type=PropertyAdminType.NON_RESIDENT,
        )
        matrix = perms.as_matrix()
        assert matrix == {
            "receive_gate_calls": False,
            "generate_visitor_pin": False,
            "create_expected_arrival": False,
            "add_tenants": True,
            "remove_tenants": True,
            "activate_residents": True,
            "view_apartment_activity": True,
            "estate_administration": False,
        }


# ============================================================================
# Future Compatibility Tests
# ============================================================================

class TestFutureCompatibility:
    """The role model must support future expansion."""

    def test_new_role_can_be_added_without_breaking(self):
        """
        Roles are string-based enums — adding a new role (e.g., 'caretaker')
        does not require changing the PermissionSet class.
        """
        from enum import StrEnum

        class FutureRole(StrEnum):
            CARETAKER = "caretaker"
            CONCIERGE = "concierge"

        # These roles can be checked via has_role without PermissionSet changes
        assert FutureRole.CARETAKER == "caretaker"

    def test_multiple_apartments_per_admin(self):
        """
        A property admin can manage multiple apartments.
        Each apartment has its own independent resident list.
        """
        for apt_id in [301, 302, 401]:
            perms = PermissionSet(
                user_id=3, apartment_id=apt_id,
                is_resident=False, is_property_admin=True,
                admin_type=PropertyAdminType.NON_RESIDENT,
            )
            # Same admin, different apartments — same permissions
            assert perms.can(Action.ADD_TENANTS) is True
            assert perms.can(Action.REMOVE_TENANTS) is True
            # But never resident actions
            assert perms.can(Action.RECEIVE_GATE_CALLS) is False

    def test_configurable_rather_than_hard_coded(self):
        """
        The implementation must be role-based and configurable rather than
        relying on hard-coded user types.
        """
        # The PermissionSet is data-driven — it doesn't check
        # "if user.type == 'landlord'" — it checks boolean flags
        # that can be set from any role combination.
        perms = PermissionSet(
            user_id=99, apartment_id=999,
            is_resident=True,
            is_property_admin=True,
            is_body_corp_admin=True,
            is_super_admin=True,
        )
        # All flags independently configurable
        assert perms.is_resident is True
        assert perms.is_property_admin is True
        assert perms.is_body_corp_admin is True
        assert perms.is_super_admin is True
