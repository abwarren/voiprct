"""
Integration Tests — Database-Level Permission Resolution

Requires a running PostgreSQL instance with the AnfieldVoice schema.
Set ANFIELDVOICE_TEST_DB=1 to run these tests.
"""
from __future__ import annotations

import os

import pytest
import pytest_asyncio
import asyncpg

from src.permissions import (
    Action,
    PropertyAdminType,
    resolve_permissions,
)


# Skip unless explicitly enabled
pytestmark = pytest.mark.skipif(
    not os.getenv("ANFIELDVOICE_TEST_DB"),
    reason="Set ANFIELDVOICE_TEST_DB=1 to run DB integration tests",
)


@pytest_asyncio.fixture
async def db_pool():
    """Create a test database pool. Assumes PostgreSQL is running."""
    pool = await asyncpg.create_pool(
        host=os.getenv("ANFIELDVOICE_DB_HOST", "localhost"),
        port=int(os.getenv("ANFIELDVOICE_DB_PORT", "5432")),
        user=os.getenv("ANFIELDVOICE_DB_USER", "postgres"),
        password=os.getenv("ANFIELDVOICE_DB_PASSWORD", "postgres"),
        database=os.getenv("ANFIELDVOICE_DB_NAME", "anfieldvoice"),
        min_size=1,
        max_size=2,
    )
    yield pool
    await pool.close()


class TestResolvePermissions:
    """
    Validates that resolve_permissions() correctly identifies
    Resident vs Non-Resident Property Administrators from the DB.
    """

    async def test_alice_is_resident_only(self, db_pool):
        """Alice (user_id=1) lives in apartment 101 — resident only."""
        perms = await resolve_permissions(db_pool, user_id=1, apartment_id=1)
        assert perms.is_resident is True
        assert perms.is_property_admin is False
        assert perms.admin_type is None

        # Resident actions
        assert perms.can(Action.RECEIVE_GATE_CALLS) is True
        assert perms.can(Action.GENERATE_VISITOR_PIN) is True
        # Admin actions
        assert perms.can(Action.ADD_TENANTS) is False

    async def test_john_is_resident_property_admin(self, db_pool):
        """John (user_id=2) lives in AND manages apartment 204."""
        perms = await resolve_permissions(db_pool, user_id=2, apartment_id=3)
        assert perms.is_resident is True
        assert perms.is_property_admin is True
        assert perms.is_resident_property_admin is True
        assert perms.admin_type == PropertyAdminType.RESIDENT

        # Has both resident and admin permissions
        assert perms.can(Action.RECEIVE_GATE_CALLS) is True
        assert perms.can(Action.GENERATE_VISITOR_PIN) is True
        assert perms.can(Action.ADD_TENANTS) is True
        assert perms.can(Action.REMOVE_TENANTS) is True

    async def test_abc_is_non_resident_property_admin(self, db_pool):
        """ABC Property Management (user_id=3) manages 301 but does NOT live there."""
        perms = await resolve_permissions(db_pool, user_id=3, apartment_id=4)
        assert perms.is_resident is False           # CRITICAL
        assert perms.is_property_admin is True
        assert perms.is_resident_property_admin is False
        assert perms.admin_type == PropertyAdminType.NON_RESIDENT

        # Admin actions
        assert perms.can(Action.ADD_TENANTS) is True
        assert perms.can(Action.REMOVE_TENANTS) is True
        assert perms.can(Action.VIEW_APARTMENT_ACTIVITY) is True

        # Must NOT have resident privileges
        assert perms.can(Action.RECEIVE_GATE_CALLS) is False
        assert perms.can(Action.GENERATE_VISITOR_PIN) is False
        assert perms.can(Action.CREATE_EXPECTED_ARRIVAL) is False

    async def test_abc_manages_multiple_apartments(self, db_pool):
        """ABC manages both 301 and 302 — permissions are per-apartment."""
        for apt_id in [4, 5]:  # 301, 302
            perms = await resolve_permissions(db_pool, user_id=3, apartment_id=apt_id)
            assert perms.is_property_admin is True
            assert perms.is_resident is False        # Not a resident of either
            assert perms.can(Action.ADD_TENANTS) is True

    async def test_sarah_is_body_corp_admin(self, db_pool):
        """Sarah (user_id=6) is body corp admin — can do anything on any apartment."""
        perms = await resolve_permissions(db_pool, user_id=6, apartment_id=1)
        assert perms.is_body_corp_admin is True

        for action in Action:
            assert perms.can(action) is True, f"Body corp admin should be able to {action}"

    async def test_mike_is_security_only(self, db_pool):
        """Mike (user_id=4) is security — no resident or admin permissions."""
        perms = await resolve_permissions(db_pool, user_id=4, apartment_id=1)
        assert perms.is_resident is False
        assert perms.is_property_admin is False
        assert perms.is_body_corp_admin is False

        for action in Action:
            assert perms.can(action) is False, f"Security should not have {action}"

    async def test_tenant_has_resident_permissions(self, db_pool):
        """Tenant One (user_id=7) lives in 204 — resident only."""
        perms = await resolve_permissions(db_pool, user_id=7, apartment_id=3)
        assert perms.is_resident is True
        assert perms.is_property_admin is False

        assert perms.can(Action.RECEIVE_GATE_CALLS) is True
        assert perms.can(Action.ADD_TENANTS) is False

    async def test_david_is_dual_role(self, db_pool):
        """David (user_id=5) is property_admin + security (additive roles)."""
        # David manages apartment 101 but does NOT live there
        perms = await resolve_permissions(db_pool, user_id=5, apartment_id=1)
        assert perms.is_property_admin is True
        assert perms.is_resident is False  # Not a resident of 101
        assert perms.admin_type == PropertyAdminType.NON_RESIDENT

        assert perms.can(Action.ADD_TENANTS) is True
        assert perms.can(Action.RECEIVE_GATE_CALLS) is False  # Doesn't live there
