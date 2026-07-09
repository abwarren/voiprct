-- ============================================================================
-- Seed Data — Test scenarios covering the full permissions matrix
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Seed Apartments
-- ----------------------------------------------------------------------------
INSERT INTO apartments (building, unit_number, max_residents) VALUES
    ('West Wing',   '101', 4),
    ('West Wing',   '102', 4),
    ('West Wing',   '204', 4),
    ('East Wing',   '301', 2),
    ('East Wing',   '302', 4),
    ('North Block', '401', 6),
    ('North Block', '402', 4),
    ('South Gate',  'G01', 1);

-- ----------------------------------------------------------------------------
-- Seed Users (password = 'changeme123' hashed with bcrypt)
--   bcrypt hash for 'changeme123' —
--   generated with: python3 -c "import bcrypt; print(bcrypt.hashpw(b'changeme123', bcrypt.gensalt()).decode())"
-- ----------------------------------------------------------------------------

-- 1. RESIDENT ONLY (Apartment 101)
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('alice@example.com', '+27710000001', 'Alice Smith',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 2. RESIDENT + PROPERTY ADMIN (lives in 204, also owns 204) — RESIDENT PROPERTY ADMIN
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('john@example.com', '+27710000002', 'John Owner',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 3. PROPERTY ADMIN ONLY (manages 301, 302 — does NOT live there) — NON-RESIDENT PROPERTY ADMIN
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('abc@propertymgmt.co.za', '+27710000003', 'ABC Property Management',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 4. SECURITY OFFICER
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('mike.security@estate.co.za', '+27710000004', 'Mike Khumalo',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 5. PROPERTY ADMIN + SECURITY (rare but valid — additive roles)
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('david@example.com', '+27710000005', 'David Nkosi',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 6. BODY CORPORATE ADMIN
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('sarah.admin@estate.co.za', '+27710000006', 'Sarah van der Merwe',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 7. TENANT who will be added/removed by property admin (starts inactive for apt 204)
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('tenant1@example.com', '+27710000007', 'Tenant One',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 8. SECOND TENANT for apt 204
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('tenant2@example.com', '+27710000008', 'Tenant Two',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- 9. RESIDENT of 401 (large apartment)
INSERT INTO users (email, phone, full_name, password_hash) VALUES
    ('family@example.com', '+27710000009', 'Family Smith',
     '$2b$12$LJ3m4ys3Lk0TSwHCpNqrLeYFJz0hNXjBmPtCJBPMYHMnnh.3NqvQW');

-- ----------------------------------------------------------------------------
-- Assign Roles
-- ----------------------------------------------------------------------------
-- role_id: 1=resident, 2=property_admin, 3=security, 4=maintenance, 5=body_corp_admin, 6=super_admin

-- Alice: resident only
INSERT INTO user_roles (user_id, role_id) VALUES (1, 1);

-- John: resident + property_admin
INSERT INTO user_roles (user_id, role_id) VALUES (2, 1), (2, 2);

-- ABC Property Management: property_admin only (not resident)
INSERT INTO user_roles (user_id, role_id) VALUES (3, 2);

-- Mike: security
INSERT INTO user_roles (user_id, role_id) VALUES (4, 3);

-- David: property_admin + security (additive)
INSERT INTO user_roles (user_id, role_id) VALUES (5, 2), (5, 3);

-- Sarah: body_corp_admin
INSERT INTO user_roles (user_id, role_id) VALUES (6, 5);

-- Tenant One: resident only
INSERT INTO user_roles (user_id, role_id) VALUES (7, 1);

-- Tenant Two: resident only
INSERT INTO user_roles (user_id, role_id) VALUES (8, 1);

-- Family Smith: resident only
INSERT INTO user_roles (user_id, role_id) VALUES (9, 1);

-- ----------------------------------------------------------------------------
-- Assign Apartments to Residents
-- ----------------------------------------------------------------------------
-- Alice lives in 101
INSERT INTO apartment_residents (user_id, apartment_id, is_primary) VALUES (1, 1, TRUE);

-- John lives in 204 (and also OWNS it as property admin)
INSERT INTO apartment_residents (user_id, apartment_id, is_primary) VALUES (2, 3, TRUE);

-- Tenant One lives in 204 (added by John)
INSERT INTO apartment_residents (user_id, apartment_id, is_primary, is_active)
VALUES (7, 3, FALSE, TRUE);

-- Tenant Two lives in 204 (added by John)
INSERT INTO apartment_residents (user_id, apartment_id, is_primary, is_active)
VALUES (8, 3, FALSE, TRUE);

-- Family Smith in 401
INSERT INTO apartment_residents (user_id, apartment_id, is_primary) VALUES (9, 6, TRUE);

-- ----------------------------------------------------------------------------
-- Assign Property Administrators to Apartments
-- ----------------------------------------------------------------------------
-- John manages 204 (and LIVES there — is_resident = TRUE)
INSERT INTO property_admin_assignments (user_id, apartment_id, is_resident)
VALUES (2, 3, TRUE);

-- ABC Property Management manages 301 and 302 (does NOT live there — is_resident = FALSE)
INSERT INTO property_admin_assignments (user_id, apartment_id, is_resident)
VALUES (3, 4, FALSE), (3, 5, FALSE);

-- David manages 101 (and does NOT live there)
INSERT INTO property_admin_assignments (user_id, apartment_id, is_resident)
VALUES (5, 1, FALSE);

-- ----------------------------------------------------------------------------
-- Test Verification Queries
-- ----------------------------------------------------------------------------
-- Uncomment to verify seed data:

-- -- All users with their roles
-- SELECT u.full_name, STRING_AGG(r.role_name, ', ' ORDER BY r.role_name) AS roles
-- FROM users u
-- JOIN user_roles ur ON u.user_id = ur.user_id
-- JOIN roles r ON ur.role_id = r.role_id
-- GROUP BY u.user_id
-- ORDER BY u.user_id;

-- -- Property admins with resident/non-resident status
-- SELECT u.full_name, apt.unit_number, apa.is_resident,
--        CASE WHEN apa.is_resident THEN 'LIVES THERE' ELSE 'MANAGES REMOTELY' END AS status
-- FROM property_admin_assignments apa
-- JOIN users u ON apa.user_id = u.user_id
-- JOIN apartments apt ON apa.apartment_id = apt.apartment_id
-- WHERE apa.revoked_at IS NULL;

-- -- Active residents per apartment
-- SELECT apt.unit_number, u.full_name, ar.is_primary
-- FROM apartment_residents ar
-- JOIN apartments apt ON ar.apartment_id = apt.apartment_id
-- JOIN users u ON ar.user_id = u.user_id
-- WHERE ar.is_active = TRUE
-- ORDER BY apt.unit_number, ar.is_primary DESC;
