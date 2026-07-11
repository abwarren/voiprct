-- ============================================================================
-- AnfieldVoice — Database Schema v1.0
-- Property Administrator Role Implementation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Roles (additive — users may possess multiple roles simultaneously)
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
    role_id         SERIAL PRIMARY KEY,
    role_name       VARCHAR(50) UNIQUE NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'System-wide roles. Roles are additive, not exclusive.';

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    user_id         SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(50),
    full_name       VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (LOWER(email));
CREATE INDEX idx_users_active ON users (is_active) WHERE is_active = TRUE;

COMMENT ON TABLE users IS 'All system users — residents, property admins, security, maintenance, body corp admins.';

-- ----------------------------------------------------------------------------
-- User Roles (many-to-many)
-- ----------------------------------------------------------------------------
CREATE TABLE user_roles (
    user_role_id    SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id         INT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    granted_by      INT REFERENCES users(user_id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles (user_id);
CREATE INDEX idx_user_roles_role ON user_roles (role_id);

COMMENT ON TABLE user_roles IS 'Many-to-many: users may possess multiple additive roles.';

-- ----------------------------------------------------------------------------
-- Apartments
-- ----------------------------------------------------------------------------
CREATE TABLE apartments (
    apartment_id    SERIAL PRIMARY KEY,
    building        VARCHAR(50),
    unit_number     VARCHAR(20) NOT NULL,
    max_residents   INT NOT NULL DEFAULT 4,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (building, unit_number)
);

CREATE INDEX idx_apartments_active ON apartments (is_active) WHERE is_active = TRUE;

COMMENT ON TABLE apartments IS 'Individual residential units within the estate.';

-- ----------------------------------------------------------------------------
-- Apartment Residents (user <-> apartment)
-- A user may be a resident of multiple apartments.
-- A property admin who also lives there has a row here AND in property_admin_assignments.
-- ----------------------------------------------------------------------------
CREATE TABLE apartment_residents (
    resident_id     SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    move_in_date    DATE,
    move_out_date   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, apartment_id)
);

CREATE INDEX idx_apartment_residents_apt ON apartment_residents (apartment_id);
CREATE INDEX idx_apartment_residents_user ON apartment_residents (user_id);
CREATE INDEX idx_apartment_residents_active ON apartment_residents (apartment_id, is_active)
    WHERE is_active = TRUE;

COMMENT ON TABLE apartment_residents IS 'Maps users to apartments as occupants. '
    'A user can be a resident of multiple apartments. '
    'is_active = FALSE means the tenant has been suspended/removed by the property admin.';

-- ----------------------------------------------------------------------------
-- Property Administrator Assignments
-- Maps property administrators to the apartments they manage.
-- is_resident = TRUE  → lives there (row also exists in apartment_residents)
-- is_resident = FALSE → manages remotely, does NOT live there
-- ----------------------------------------------------------------------------
CREATE TABLE property_admin_assignments (
    assignment_id   SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    is_resident     BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_by     INT REFERENCES users(user_id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    UNIQUE (user_id, apartment_id)
);

CREATE INDEX idx_paa_user ON property_admin_assignments (user_id);
CREATE INDEX idx_paa_apartment ON property_admin_assignments (apartment_id);
CREATE INDEX idx_paa_active ON property_admin_assignments (user_id, apartment_id)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE property_admin_assignments IS 'Maps property administrators to apartments they manage. '
    'is_resident distinguishes between a property admin who lives there vs one who manages remotely. '
    'A non-resident property admin must never appear as an apartment occupant.';

-- ----------------------------------------------------------------------------
-- Audit Log
-- Records every administrative action for full traceability.
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
    audit_id        SERIAL PRIMARY KEY,
    admin_user_id   INT NOT NULL REFERENCES users(user_id),
    apartment_id    INT REFERENCES apartments(apartment_id),
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       INT,
    previous_value  JSONB,
    new_value       JSONB,
    reason          TEXT,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_admin ON audit_log (admin_user_id);
CREATE INDEX idx_audit_apartment ON audit_log (apartment_id);
CREATE INDEX idx_audit_action ON audit_log (action);
CREATE INDEX idx_audit_created ON audit_log (created_at DESC);

COMMENT ON TABLE audit_log IS 'Immutable audit trail for all administrative actions. '
    'previous_value and new_value capture the full before/after state.';

-- ----------------------------------------------------------------------------
-- Activation Invitations
-- Sent by property administrators to onboard new residents.
-- ----------------------------------------------------------------------------
CREATE TABLE activation_invitations (
    invitation_id   SERIAL PRIMARY KEY,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    token           UUID NOT NULL DEFAULT uuid_generate_v4(),
    created_by      INT NOT NULL REFERENCES users(user_id),
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON activation_invitations (token);
CREATE INDEX idx_invitations_email ON activation_invitations (email);
CREATE INDEX idx_invitations_status ON activation_invitations (status)
    WHERE status = 'pending';

COMMENT ON TABLE activation_invitations IS 'Time-limited invitations sent by property admins to onboard new residents.';

-- ----------------------------------------------------------------------------
-- Views (convenience)
-- ----------------------------------------------------------------------------

-- All active residents within an apartment (for notifications, directory, etc.)
CREATE VIEW active_apartment_residents AS
SELECT
    ar.apartment_id,
    ar.user_id,
    u.full_name,
    u.email,
    u.phone,
    ar.is_primary,
    ar.move_in_date
FROM apartment_residents ar
JOIN users u ON ar.user_id = u.user_id
WHERE ar.is_active = TRUE
  AND u.is_active = TRUE;

-- Property administrators for an apartment, with resident/non-resident distinction
CREATE VIEW apartment_property_admins AS
SELECT
    paa.apartment_id,
    paa.user_id,
    u.full_name,
    u.email,
    u.phone,
    paa.is_resident,
    CASE
        WHEN paa.is_resident THEN 'Resident Property Administrator'
        ELSE 'Non-Resident Property Administrator'
    END AS admin_type,
    EXISTS (
        SELECT 1 FROM apartment_residents ar
        WHERE ar.apartment_id = paa.apartment_id
          AND ar.user_id = paa.user_id
          AND ar.is_active = TRUE
    ) AS is_active_resident
FROM property_admin_assignments paa
JOIN users u ON paa.user_id = u.user_id
WHERE paa.revoked_at IS NULL
  AND u.is_active = TRUE;

-- ============================================================================
-- Seed Data — System Roles
-- ============================================================================
INSERT INTO roles (role_name, description) VALUES
    ('resident',                'Apartment occupant. Receives gate calls, generates visitor PINs, manages recurring visitors.'),
    ('property_admin',          'Manages tenancy and user access for assigned apartments. May or may not be a resident.'),
    ('security',                'Gate security officer. Processes visitors, admits/denies access, calls residents.'),
    ('maintenance',             'Estate maintenance staff. Manages work orders and facility access.'),
    ('body_corp_admin',         'Body corporate administrator. Estate-wide configuration, analytics, resident management.'),
    ('super_admin',             'Platform super administrator. Full system access.');

-- ============================================================================
-- Gate Calls (Slice 1 — WebSocket Signalling)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gate_calls (
    call_id         SERIAL PRIMARY KEY,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id),
    caller_unit     VARCHAR(50) NOT NULL,
    call_status     VARCHAR(20) NOT NULL DEFAULT 'ringing'
                    CHECK (call_status IN ('ringing', 'answered', 'missed', 'rejected', 'completed')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at     TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_secs   INT,
    sdp_offer       TEXT,
    sdp_answer      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE gate_calls IS 'Real-time gate call records for WebRTC/SIP intercom.';

CREATE INDEX IF NOT EXISTS idx_gate_calls_apartment ON gate_calls (apartment_id, call_status)
    WHERE call_status = 'ringing';
CREATE INDEX IF NOT EXISTS idx_gate_calls_history ON gate_calls (apartment_id, created_at DESC);
