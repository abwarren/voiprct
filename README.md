# AnfieldVoice — Property Administrator Role System

## Overview

Role-based access control for residential estate management. Implements a **Property Administrator** role that enables landlords, estate agents, and property managers to manage resident access for assigned apartments. The system distinguishes between property administrators who live in the apartment (Resident PA) and those who manage remotely (Non-Resident PA).

## Design Principles

1. **Roles are additive, not exclusive.** A user may possess multiple roles simultaneously (e.g., Resident + Property Administrator).
2. **Property management functions are separate from resident functions.**
3. **A Non-Resident Property Administrator must never appear as an apartment occupant.**
4. **Resident notifications are only delivered to active residents.**
5. **All administrative actions are fully audited.**

## Quick Start

```bash
# 1. Create database
createdb anfieldvoice

# 2. Install dependencies
pip install -r requirements.txt --break-system-packages

# 3. Run schema + seed data
psql -d anfieldvoice -f db/schema.sql
psql -d anfieldvoice -f db/seed.sql

# 4. Run unit tests (no DB needed)
python -m pytest tests/test_permissions.py -v

# 5. Run integration tests (requires DB)
ANFIELDVOICE_TEST_DB=1 python -m pytest tests/test_db_integration.py -v

# 6. Start API server
python -m uvicorn src.main:app --reload
```

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/v1/me` | Current user profile with roles |

### Permissions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/permissions/{apartment_id}` | Full permissions matrix |
| GET | `/api/v1/permissions/{apartment_id}/check/{action}` | Single action check |

### Property Administrator — Tenant Management
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/my-apartments` | property_admin | List managed apartments |
| GET | `/api/v1/apartments/{id}/residents` | Any apartment access | List residents |
| POST | `/api/v1/apartments/{id}/residents` | ADD_TENANTS | Add resident |
| DELETE | `/api/v1/apartments/{id}/residents/{uid}` | REMOVE_TENANTS | Remove resident |
| POST | `/api/v1/apartments/{id}/residents/{uid}/activate` | ACTIVATE_RESIDENTS | Activate resident |
| POST | `/api/v1/apartments/{id}/residents/{uid}/deactivate` | REMOVE_TENANTS | Suspend resident |

### Body Corp Admin — Property Admin Assignment
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/property-admins` | body_corp_admin | Assign property admin |
| DELETE | `/api/v1/property-admins/{apt_id}/{uid}` | body_corp_admin | Revoke property admin |

### Invitations
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/invitations` | Create activation invitation |
| GET | `/api/v1/invitations/{apartment_id}` | List invitations |

### Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/audit/{apartment_id}` | Query audit log |

## Permissions Matrix

| Function | Resident | Property Admin (Resident) | Property Admin (Non-Resident) |
|----------|----------|---------------------------|-------------------------------|
| Receive gate calls | ✓ | ✓ | ✗ |
| Generate visitor PIN | ✓ | ✓ | ✗ |
| Create Expected Arrival | ✓ | ✓ | ✗ |
| Add tenants | ✗ | ✓ | ✓ |
| Remove tenants | ✗ | ✓ | ✓ |
| Activate residents | ✗ | ✓ | ✓ |
| View apartment activity | Limited | ✓ | ✓ |
| Estate administration | ✗ | ✗ | ✗ |

## Role System

Roles are additive — a user can be:

- **Resident** — lives in the apartment
- **Property Administrator** — manages tenancy (may or may not live there)
- **Resident Property Administrator** — lives there AND manages it
- **Non-Resident Property Administrator** — manages remotely
- **Security** — gate officer
- **Maintenance** — estate maintenance
- **Body Corporate Administrator** — estate-wide configuration
- **Super Administrator** — full system access

Users may possess multiple roles simultaneously (e.g., Security + Maintenance, Resident + Property Admin).

## Database Schema

- `roles` — System roles (additive)
- `users` — All system users
- `user_roles` — Many-to-many user ↔ role
- `apartments` — Individual units
- `apartment_residents` — Maps users to apartments as occupants
- `property_admin_assignments` — Maps property admins to apartments with `is_resident` flag
- `audit_log` — Immutable audit trail
- `activation_invitations` — Time-limited new resident invitations

## Architecture

```
src/
├── __init__.py
├── config.py         # Environment-based settings
├── database.py       # asyncpg connection pool
├── models.py         # Pydantic models
├── auth.py           # JWT auth + permission dependencies
├── permissions.py    # Permission resolution + matrix
├── audit.py          # Audit trail writer + query
├── main.py           # FastAPI application
└── api/
    └── __init__.py   # API router + endpoints

db/
├── schema.sql        # Full schema + roles seed
└── seed.sql          # Test data (9 users, 8 apartments)

tests/
├── __init__.py
├── test_permissions.py       # Unit tests (no DB needed)
└── test_db_integration.py    # Integration tests (requires DB)
```

## Running Tests

```bash
# Unit tests — validates the entire permissions matrix
python -m pytest tests/test_permissions.py -v

# Integration tests — validates DB-level permission resolution
ANFIELDVOICE_TEST_DB=1 python -m pytest tests/test_db_integration.py -v

# All tests
python -m pytest -v
```

68 tests cover:
- Every cell in the permissions matrix
- Resident Property Admin vs Non-Resident Property Admin distinction
- Additive roles (Resident + Property Admin + Security)
- Design principles (3, 4, 5 from the engineering directive)
- Future compatibility (new roles, multiple apartments, configurable types)
- DB-level permission resolution against seed data

## Future Compatibility

The role model supports expansion to:
- Estate Agencies
- Rental Portfolios
- Corporate Housing
- Retirement Villages
- Student Accommodation
- Multi-estate management

All user types are role-based and configurable rather than hard-coded.
