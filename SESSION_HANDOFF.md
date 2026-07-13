## CURRENT OBJECTIVE
All 9 planned vertical slices complete. Project is ready for production deployment.

## PROJECT STATUS
- **Repository**: github.com/abwarren/voiprct (main)
- **Backend**: FastAPI + asyncpg + PostgreSQL
- **Mobile**: React Native / Expo SDK 52 (anfieldvoice-mobile/)
- **Web**: Vanilla JS SPA served by FastAPI static files
- **Deploy**: Docker Compose (app + PostgreSQL)
- **Tests**: 40/40 permission tests passing, 8 DB integration tests skipped (no PG in CI)

## COMPLETED SLICES

| Slice | Feature | Files Changed |
|-------|---------|--------------|
| 1 | WebSocket gateway + gate call lifecycle | src/ws.py, gate call models, gate.tsx, useWebSocket.ts |
| 2 | WebRTC audio integration | useWebRTC.ts, CallScreen.tsx, SDP exchange via WS |
| 3 | Visitor PINs + Expected Arrivals | visitor_pins/arrivals tables, endpoints, modals |
| 4 | Tenant Management UI | activate/suspend residents, Residents tab (mobile + web) |
| 5 | Property Admin Assignment UI | assign/revoke PAs, Estate screen (mobile + web) |
| 6 | Push Notifications | Expo push tokens, usePushNotifications.ts, Android channels |
| 7 | Security Dashboard + Directory | security/overview, directory/search, Security tab |
| 8 | Recurring Visitors | recurring_visitors table, CRUD endpoints, Recurring tab |
| 9 | NFC Phone-as-Tag | nfc_credentials + gate_access_log, 7 endpoints, NFC tab |

## SYSTEM STATE
- 40/40 permission tests pass consistently
- Full role system: resident, property_admin, security, maintenance, body_corp_admin, super_admin
- Additive roles, non-resident PA constraints, immutable audit trail
- All mutations audited via write_audit_entry()
- WebRTC SDP/ICE exchange over WebSocket for gate calls
- Push notifications via Expo (FCM/APNs)
- NFC mutual exclusivity (phone HCE ⇄ physical tag)
- Account deletion per Play Store requirements (anonymizes PII, preserves audit trail)

## DEPLOYMENT
```bash
# Production deploy (requires Docker + PostgreSQL)
cp .env.example .env  # Edit with your production values
./deploy.sh            # Build, start, health check
```

## INFRASTRUCTURE REMAINING
- [ ] SSL/HTTPS termination (reverse proxy — nginx/Caddy/Traefik)
- [ ] Asterisk SIP ↔ WebRTC bridge configuration
- [ ] Live gate hardware integration
- [ ] App Store submission (Google Play + Apple App Store)
- [ ] Production domain + DNS

## FILES CHANGED (complete)
```
src/
├── api/__init__.py       1428→~1900 lines — all REST endpoints
├── auth.py               JWT + bcrypt + FastAPI deps
├── permissions.py        PermissionSet engine (6 roles, additive)
├── models.py             All Pydantic models
├── audit.py              Immutable audit trail
├── database.py           asyncpg pool
├── config.py             Env-based config
├── main.py               FastAPI app + WS + static files
├── ws.py                 WebSocket connection manager + handlers
└── notifications.py      Expo push dispatch
db/
├── schema.sql            Complete schema (all tables + indexes + views)
└── seed.sql              Seed data
web/                      Vanilla JS SPA (8 views)
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
└── .env.example
```

## NEXT ACTION
```bash
cd ~/projects/voiprct
docker compose build && docker compose up -d
python3 -m pytest tests/ -v
```
