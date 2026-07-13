## CURRENT OBJECTIVE
All 10 vertical slices complete. Production deployment verified and operational.

## PROJECT STATUS
- **Repository**: github.com/abwarren/voiprct (main)
- **Backend**: FastAPI + asyncpg + PostgreSQL
- **Mobile**: React Native / Expo SDK 52 (anfieldvoice-mobile/)
- **Web**: Vanilla JS SPA served by FastAPI static files
- **Deploy**: Docker Compose (app + PostgreSQL 16-alpine)
- **Tests**: 40/40 permission tests passing, 8 DB integration tests skipped (no PG in CI)

## COMPLETED SLICES

| Slice | Feature | Status |
|-------|---------|--------|
| 1 | WebSocket gateway + gate call lifecycle | ✓ |
| 2 | WebRTC audio integration | ✓ |
| 3 | Visitor PINs + Expected Arrivals | ✓ |
| 4 | Tenant Management UI | ✓ |
| 5 | Property Admin Assignment UI | ✓ |
| 6 | Push Notifications | ✓ |
| 7 | Security Dashboard + Directory | ✓ |
| 8 | Recurring Visitors | ✓ |
| 9 | NFC Phone-as-Tag | ✓ |
| 10 | Docker Compose + production config | ✓ |

## DEPLOYMENT VERIFIED
```bash
docker compose build           # ✅ Builds clean (60s cached)
docker compose up -d           # ✅ App + DB start healthy
curl localhost:8000/health     # ✅ Returns {"status":"ok","version":"1.0.0"}
```

### Production Deploy
```bash
cp .env.example .env           # Edit with production values
./deploy.sh                    # Build, start, health check
```

## INFRASTRUCTURE REMAINING (external / out-of-repo)
- [ ] SSL/HTTPS termination — nginx/Caddy/Traefik reverse proxy (see deploy/nginx.conf)
- [ ] Asterisk SIP ↔ WebRTC bridge configuration
- [ ] Live gate hardware integration
- [ ] App Store submission (Google Play + Apple App Store)
- [ ] Production domain + DNS

## SYSTEM STATE
- 40/40 permission tests pass consistently
- Full role system: resident, property_admin, security, maintenance, body_corp_admin, super_admin
- Additive roles, non-resident PA constraints, immutable audit trail
- All mutations audited via write_audit_entry()
- WebRTC SDP/ICE exchange over WebSocket for gate calls
- Push notifications via Expo (FCM/APNs)
- NFC mutual exclusivity (phone HCE ⇄ physical tag)
- Account deletion per Play Store requirements (anonymizes PII, preserves audit trail)
- init_db() idempotent — handles DuplicateTableError in Docker context
- Health endpoint registered before catch-all route

## FILES (complete)

```
src/
├── api/__init__.py        ~1900 lines — all REST endpoints
├── auth.py               JWT + bcrypt + FastAPI deps
├── permissions.py        PermissionSet engine (6 roles, additive)
├── models.py             All Pydantic models
├── audit.py              Immutable audit trail
├── database.py           asyncpg pool + idempotent init_db()
├── config.py             Env-based config
├── main.py               FastAPI app + WS + static files + health
├── ws.py                 WebSocket connection manager + handlers
└── notifications.py      Expo push dispatch
db/
├── schema.sql            Complete schema (all tables + indexes + views)
└── seed.sql              Seed data (9 test users)
web/                      Vanilla JS SPA (9 views)
├── index.html + css/style.css
└── js/views/             login, dashboard, gate, visitors, tenants,
                           estate, profile, security, nfc
anfieldvoice-mobile/      Expo/React Native (Expo SDK 52)
├── app/(tabs)/           home, gate, visitors, directory, residents,
│                          estate, profile, nfc
└── src/                  api, hooks, components, contexts, types
deploy/
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
├── deploy.sh
├── .env.example
└── nginx.conf (if deploying with SSL)
```

## NEXT ACTION
```bash
cd ~/projects/voiprct
docker compose ps                           # Verify both containers healthy
python3 -m pytest tests/ -v                 # Run backend tests
```
