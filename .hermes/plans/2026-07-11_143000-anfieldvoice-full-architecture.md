# AnfieldVoice — Full Architecture & Implementation Plan (A–Z)

> **Status**: Planning phase — no code written yet
> **Last updated**: July 2026
> **Author**: Red Cape Technologies (Pty) Ltd

---

## PART I: SYSTEM ARCHITECTURE

### 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ANFIELDVOICE PLATFORM                     │
├──────────────────────┬──────────────────┬──────────────────┤
│   MOBILE CLIENTS     │   BACKEND API     │   INFRASTRUCTURE │
│                      │                  │                  │
│  ┌────────────────┐  │  ┌────────────┐  │  ┌────────────┐  │
│  │ React Native   │  │  │ FastAPI    │  │  │ PostgreSQL │  │
│  │ (Expo SDK 52)  │◄─┼──┤ REST API   │◄─┼──┤ (RDS)      │  │
│  │                │  │  │ Port 8000  │  │  │            │  │
│  │ ─ Gate calls   │  │  └─────┬──────┘  │  └────────────┘  │
│  │ ─ PIN gen      │  │        │         │                  │
│  │ ─ Visitors     │  │  ┌─────┴──────┐  │  ┌────────────┐  │
│  │ ─ Tenant mgmt  │  │  │ WebSocket  │  │  │ Redis      │  │
│  │ ─ Audit        │  │  │ Gateway    │  │  │ (Pub/Sub   │  │
│  │                │  │  │ Port 8001  │  │  │  + Session)│  │
│  └───────┬────────┘  │  └─────┬──────┘  │  └────────────┘  │
│          │           │        │         │                  │
│  ┌───────┴────────┐  │  ┌─────┴──────┐  │  ┌────────────┐  │
│  │ SIP / WebRTC   │  │  │ SIP        │  │  │ S3 / DO    │  │
│  │ Engine         │◄─┼──┤ Gateway    │◄─┼──┤ Spaces     │  │
│  │ (react-native- │  │  │ (Asterisk) │  │  │ (Audit     │  │
│  │  webrtc)       │  │  │ Port 5060  │  │  │  exports)  │  │
│  └────────────────┘  │  └────────────┘  │  └────────────┘  │
└──────────────────────┴──────────────────┴──────────────────┘
```

### 2. Component Breakdown

#### 2.1 Mobile App (React Native / Expo SDK 52)

| Component | Tech | Purpose |
|-----------|------|---------|
| **Auth layer** | JWT + SecureStore | Login/logout, token persistence |
| **Navigation** | Expo Router (file-based) | Role-conditional tab visibility |
| **API client** | `fetch` + typed functions | All REST communication |
| **WebSocket client** | `react-native-websocket` | Real-time gate calls, events |
| **WebRTC engine** | `react-native-webrtc` | Audio for gate calls |
| **Push notifications** | Expo Notifications (FCM/APNs) | Background gate call alerts |
| **UI theme** | Dark theme tokens | Design system |

#### 2.2 Backend (FastAPI + asyncpg)

| Component | File | Purpose |
|-----------|------|---------|
| **REST API** | `src/api/__init__.py` | All CRUD endpoints (EXISTS) |
| **Auth** | `src/auth.py` | JWT + bcrypt + FastAPI deps (EXISTS) |
| **Permissions** | `src/permissions.py` | PermissionSet engine (EXISTS) |
| **Models** | `src/models.py` | Pydantic schemas (EXISTS) |
| **Audit** | `src/audit.py` | Immutable audit trail (EXISTS) |
| **DB** | `src/database.py` | asyncpg pool (EXISTS) |
| **WebSocket handler** | `src/ws/__init__.py` | NEW — real-time gate call signalling |
| **SIP gateway** | `src/sip/__init__.py` | NEW — bridge WebRTC ↔ Asterisk |
| **Push notifications** | `src/notifications.py` | NEW — FCM/APNs dispatch |
| **Visitor PIN service** | `src/visitors.py` | NEW — PIN generation + verification |
| **Media server client** | `src/media/__init__.py` | NEW — Janus/mediasoup integration |

#### 2.3 Infrastructure

| Component | Tech | Purpose |
|-----------|------|---------|
| **Database** | PostgreSQL (RDS or DO Managed DB) | All persistent state |
| **Cache/pubsub** | Redis (ElastiCache or DO) | WebSocket session mgmt + pub/sub |
| **SIP server** | Asterisk (self-hosted or cloud) | SIP ↔ WebRTC bridging |
| **Media server** | Janus Gateway or mediasoup | WebRTC media relay |
| **File storage** | S3 / DO Spaces | Audit export files |
| **Push notifications** | FCM + APNs via Expo | Mobile alerts |

---

## PART II: DATA MODEL CHANGES (NEW TABLES)

### 3. New Database Entities

#### 3.1 gate_calls

```sql
CREATE TABLE gate_calls (
    call_id         SERIAL PRIMARY KEY,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id),
    caller_unit     VARCHAR(50) NOT NULL,          -- Gate booth / entrance ID
    call_status     VARCHAR(20) NOT NULL DEFAULT 'ringing'
                    CHECK (call_status IN ('ringing', 'answered', 'missed', 'rejected', 'completed')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at     TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_secs   INT,
    session_id      VARCHAR(100),                   -- WebRTC session ID
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 3.2 visitor_pins

```sql
CREATE TABLE visitor_pins (
    pin_id          SERIAL PRIMARY KEY,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id),
    created_by      INT NOT NULL REFERENCES users(user_id),
    pin_code        VARCHAR(6) NOT NULL,
    visitor_name    VARCHAR(255),
    purpose         VARCHAR(255),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,                    -- NULL = unused
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visitor_pins_code ON visitor_pins (pin_code) WHERE is_active = TRUE;
CREATE INDEX idx_visitor_pins_apartment ON visitor_pins (apartment_id);
```

#### 3.3 expected_arrivals

```sql
CREATE TABLE expected_arrivals (
    arrival_id      SERIAL PRIMARY KEY,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id),
    created_by      INT NOT NULL REFERENCES users(user_id),
    visitor_name    VARCHAR(255) NOT NULL,
    vehicle_plate   VARCHAR(20),
    expected_at     TIMESTAMPTZ NOT NULL,
    notes           TEXT,
    arrived_at      TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'arrived', 'cancelled', 'expired')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 3.4 recurring_visitors

```sql
CREATE TABLE recurring_visitors (
    recurring_id    SERIAL PRIMARY KEY,
    apartment_id    INT NOT NULL REFERENCES apartments(apartment_id),
    created_by      INT NOT NULL REFERENCES users(user_id),
    visitor_name    VARCHAR(255) NOT NULL,
    vehicle_plate   VARCHAR(20),
    schedule_type   VARCHAR(20) NOT NULL
                    CHECK (schedule_type IN ('daily', 'weekly', 'weekdays', 'custom')),
    schedule_data   JSONB,                          -- Flex schedule config
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from      DATE,
    valid_until     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 3.5 push_tokens

```sql
CREATE TABLE push_tokens (
    token_id        SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    platform        VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    token           VARCHAR(500) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, platform)
);
```

#### 3.6 device_credentials (SIP auth)

```sql
CREATE TABLE device_credentials (
    credential_id   SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    sip_username    VARCHAR(100) UNIQUE NOT NULL,
    sip_password    VARCHAR(255) NOT NULL,
    sip_domain      VARCHAR(255) NOT NULL DEFAULT 'sip.anfieldvoice.co.za',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);
```

---

## PART III: NEW BACKEND ENDPOINTS

### 4. API Extension Plan

#### 4.1 Gate Call Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/ws` | WebSocket upgrade — real-time signalling |
| `POST` | `/api/v1/gate-calls` | Gate hardware initiates a call |
| `POST` | `/api/v1/gate-calls/{id}/answer` | Resident answers |
| `POST` | `/api/v1/gate-calls/{id}/reject` | Resident rejects |
| `GET` | `/api/v1/gate-calls/history` | Call history (filtered by role) |

#### 4.2 Visitor PIN Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/visitor-pins` | Generate PIN |
| `GET` | `/api/v1/visitor-pins/{apartment_id}` | List active PINs |
| `POST` | `/api/v1/visitor-pins/{pin}/verify` | Security validates PIN |
| `DELETE` | `/api/v1/visitor-pins/{id}` | Revoke PIN |

#### 4.3 Expected Arrival Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/arrivals` | Create expected arrival |
| `GET` | `/api/v1/arrivals/{apartment_id}` | List arrivals |
| `PATCH` | `/api/v1/arrivals/{id}/arrive` | Security marks as arrived |
| `DELETE` | `/api/v1/arrivals/{id}` | Cancel arrival |

#### 4.4 Recurring Visitors

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/recurring-visitors` | Create recurring visitor |
| `GET` | `/api/v1/recurring-visitors/{apartment_id}` | List |
| `PATCH` | `/api/v1/recurring-visitors/{id}` | Update |
| `DELETE` | `/api/v1/recurring-visitors/{id}` | Delete |

#### 4.5 Push Notifications

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/push-tokens` | Register device token |
| `DELETE` | `/api/v1/push-tokens` | Remove device token |

#### 4.6 SIP Device Credentials

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/sip-credentials` | Create SIP auth (auto on user create) |
| `GET` | `/api/v1/sip-credentials/me` | Get own SIP creds |
| `POST` | `/api/v1/sip-credentials/me/rotate` | Rotate SIP password |

---

## PART IV: MOBILE SCREEN MAP (COMPLETE)

### 5. Navigation Tree

```
App Root (_layout.tsx)
├── Auth check → Login (/login.tsx) or Tabs
│
└── Tab Navigator ((tabs)/_layout.tsx)
    │
    ├── 🏠 Home (home.tsx) ← EXISTS, needs wiring
    │   ├── Welcome + role badges
    │   ├── Quick actions grid
    │   │   ├── [Gate Call] → Gate tab or modal
    │   │   ├── [Visitor PIN] → PIN generator modal
    │   │   ├── [Expected Arrival] → New arrival modal
    │   │   └── [Directory] → Directory tab
    │   └── Apartment list (PA / body corp only)
    │
    ├── 🚪 Gate (gate.tsx) ← NEW
    │   ├── Incoming call (full-screen when ringing)
    │   │   ├── Answer → WebRTC + ringtone
    │   │   └── Reject
    │   ├── Call history list
    │   └── Security dashboard (security role only)
    │
    ├── 📋 Directory (directory.tsx) ← NEW
    │   ├── Apartment picker
    │   ├── Residents list per apartment
    │   └── Quick dial (SIP call)
    │
    ├── ⚙️ Estate (estate.tsx) ← EXISTS (stub)
    │   ├── Apartments list (body corp)
    │   ├── Property admin assignment
    │   └── Invitations management
    │
    └── 👤 Profile (profile.tsx) ← EXISTS (updated)
        ├── User info + roles
        ├── SIP credentials
        ├── Privacy policy
        └── Account deletion
```

---

## PART VI: RISK ASSESSMENT & PREEMPTION

### 9. Known Risks from Community Research

#### 9.1 Linphone SDK in React Native

| Risk | Source | Impact | Mitigation |
|------|--------|--------|------------|
| No official RN binding | GitHub issues, community | High — must build native module | Use WebRTC via `react-native-webrtc` instead. Bridge SIP ↔ WebRTC at server level with Asterisk. |
| SDK is 40MB+ (Android) | Linphone docs | Large APK size | WebRTC approach is ~5MB. Skip Linphone SDK for MVP. |
| Native crashes in background | StackOverflow | Call quality, app rejection | Test background audio mode early. iOS requires `voip` background mode entitlement. |
| Frequent ABI changes | Linphone commit history (~35k commits) | Maintenance burden | Pin SDK version. Use stable releases only. |

#### 9.2 WebRTC in React Native

| Risk | Source | Impact | Mitigation |
|------|--------|--------|------------|
| `react-native-webrtc` v104+ API changes | GitHub issues | Breaking changes on upgrade | Pin to known-working version. Lock in package.json. |
| ICE/TURN server costs | Operational | Per-call bandwidth costs | Deploy coturn on the same VPC. Keep media local when possible. |
| Audio routing (speaker vs earpiece) | StackOverflow | UX — user can't hear | Test `mediaDevices.enumerateAudioOutputs()` early. Implement speaker toggle. |
| iOS Simulator WebRTC | Known limitation | Cannot test on iOS simulator | Must use physical device or EAS build for iOS testing. |
| CallKit integration (iOS) | Apple docs, forum posts | Complex, required for native feel | MVP: skip CallKit. Use in-app call screen. Add CallKit post-MVP. |

#### 9.3 Push Notifications Timing

| Risk | Source | Impact | Mitigation |
|------|--------|--------|------------|
| Push delivery delays (2-30s) | Firebase docs | Gate call feels slow | Use WebSocket for foreground, push for background. Show "Connecting..." immediately. |
| FCM high-priority quota | Google policies | Throttled after abuse | Only use high-priority for gate calls, not for info notifications. |
| APNs sandbox vs production | Apple docs | Dev vs prod confusion | Use Expo's built-in environment detection. Handle both. |

#### 9.4 Store Compliance Gotchas

| Risk | Source | Impact | Mitigation |
|------|--------|--------|------------|
| VoIP background mode entitlement | Apple App Store Review | Rejected if using SIP/VoIP | Declare VoIP background mode only when adding CallKit. For MVP with in-app calls only, use standard audio background mode. |
| Encryption export (EAR) | Apple ITS | Rejected if declared wrong | `ITSAppUsesNonExemptEncryption: false` (WebRTC DTLS-SRTP is system-provided) |
| Account deletion deadline extension | Google Play policy (2024) | Removal if not compliant | ✓ Done — in-app deletion active |
| "Minimal functionality" rejection | Apple 4.0 guideline | Rejected if too many stubs | Fill all placeholder screens before submitting |

---

## PART VII: VERTICAL SLICE EXECUTION PLAN

### 10. Slice Map

```
TB-001: Tracer Bullet — Real-time Signalling
Slice 1:  WebSocket gateway + basic gate call lifecycle
Slice 2:  WebRTC audio call + gate call screen UI
Slice 3:  Visitor PIN + expected arrivals
Slice 4:  Tenant management UI (add/remove residents)
Slice 5:  Invitations flow + accept
Slice 6:  Property admin assignment UI
Slice 7:  Push notifications + background call handling
Slice 8:  Remaining screens (directory, residents tab, history)
Slice 9:  Store submission prep + final polish
```

---

## PART III V2: MOBILE VERTICAL SLICE EXECUTION

### 6. Tracer Bullet 001 — WebSocket + Gate Call Lifecycle

**Files changed:**
- NEW: `src/ws/__init__.py` — WebSocket handler
- NEW: `src/ws/gate_calls.py` — Gate call state machine
- NEW: `src/models_gate.py` — Gate call Pydantic models  
- NEW: `db/migration_001_gate_calls.sql` — Migration SQL
- MOD: `src/main.py` — Register WebSocket routes
- MOD: `src/api/__init__.py` — REST endpoints for gate calls
- NEW: `anfieldvoice-mobile/app/(tabs)/gate.tsx` — Gate call screen
- NEW: `anfieldvoice-mobile/src/hooks/useWebSocket.ts` — WS hook
- MOD: `anfieldvoice-mobile/app/(tabs)/_layout.tsx` — Add Gate tab
- MOD: `anfieldvoice-mobile/app/(tabs)/home.tsx` — Wire quick actions

**Tests:**
- `tests/test_ws_gate_calls.py` — Unit tests for gate call state machine
- `tests/test_api_gate_calls.py` — API endpoint tests

**Acceptance:**
- [ ] WebSocket connects and authenticates via JWT
- [ ] POST /api/v1/gate-calls creates a call, triggers WS event
- [ ] Mobile app receives WS event and shows incoming call UI
- [ ] User answers/rejects via WS
- [ ] Call history persisted

---

### 7. Slice 2 — WebRTC Audio Call

**Dependencies:** Slice 1 complete and passing.

**Files changed:**
- NEW: `src/media/__init__.py` — Media negotiation
- MOD: `src/ws/gate_calls.py` — Add SDP offer/answer
- NEW: `anfieldvoice-mobile/src/hooks/useWebRTC.ts` — WebRTC hook
- NEW: `anfieldvoice-mobile/src/components/CallScreen.tsx` — Full-screen call UI
- MOD: `anfieldvoice-mobile/app/(tabs)/gate.tsx` — Integrate WebRTC
- MOD: `anfieldvoice-mobile/src/api/client.ts` — WS methods
- MOD: `package.json` — Add `react-native-webrtc`

**Tests:**
- Manual (WebRTC needs real devices)

**Acceptance:**
- [ ] Two devices can establish audio call via the platform
- [ ] Answering a gate call opens WebRTC stream
- [ ] Call terminates cleanly on hangup
- [ ] Call duration logged

---

### 8. Slice 3 — Visitor PIN Generation

**Dependencies:** None (independent core feature).

**Files changed:**
- NEW: `db/migration_002_visitor_pins.sql`
- NEW: `src/visitors.py` — PIN logic + generation
- MOD: `src/api/__init__.py` — Visitor PIN endpoints
- NEW: `anfieldvoice-mobile/src/components/VisitorPinModal.tsx`
- NEW: `anfieldvoice-mobile/src/components/ExpectedArrivalModal.tsx`
- MOD: `src/permissions.py` — Add PIN/arrival permissions if needed

**Tests:**
- `tests/test_visitor_pins.py` — PIN generation, validation, expiry

**Acceptance:**
- [ ] Resident can generate 6-digit PIN from home screen
- [ ] PIN expires after configurable duration (default 24h)
- [ ] Security can verify PIN at gate terminal
- [ ] Resident can view active PINs and revoke
- [ ] Expected arrival can be created and marked as arrived by security
- [ ] All actions audited

---

### 9. Slice 4 — Tenant Management UI

**Dependencies:** None (builds on existing backend).

**Files changed:**
- MOD: `anfieldvoice-mobile/app/apartment/[id].tsx` — Add resident modals
- NEW: `anfieldvoice-mobile/src/components/AddResidentModal.tsx`
- NEW: `anfieldvoice-mobile/src/components/InviteResidentModal.tsx`
- MOD: `anfieldvoice-mobile/src/api/client.ts` — Already has functions

**Tests:**
- Manual UI testing + existing backend test suite

**Acceptance:**
- [ ] Property admin can add existing user as resident
- [ ] Property admin can invite new user via email
- [ ] Property admin can remove resident with reason
- [ ] Resident status toggle (active/suspended) works
- [ ] Audit entries visible in audit tab

---

### 10. Slice 5 — Estate Admin & Property Admin Assignment UI

**Dependencies:** None (builds on existing backend).

**Files changed:**
- MOD: `anfieldvoice-mobile/app/(tabs)/estate.tsx` — Full implementation
- NEW: `anfieldvoice-mobile/src/components/AssignPropertyAdminModal.tsx`
- NEW: `anfieldvoice-mobile/src/components/CreateInvitationModal.tsx`

**Tests:**
- Manual UI testing

**Acceptance:**
- [ ] Body corp admin can view all apartments
- [ ] Body corp admin can assign/revoke property admins
- [ ] Body corp admin can add new apartments
- [ ] Invitations list visible

---

### 11. Slice 6 — Push Notifications

**Dependencies:** Slice 1 (WebSocket) should be working (fallback for foreground).

**Files changed:**
- NEW: `src/notifications.py` — Push dispatch service
- NEW: `db/migration_003_push_tokens.sql`
- MOD: `src/api/__init__.py` — Push token registration endpoints
- MOD: `src/ws/gate_calls.py` — Push fallback when recipient offline
- MOD: `anfieldvoice-mobile/src/contexts/AuthContext.tsx` — Register push token on login
- NEW: `anfieldvoice-mobile/src/hooks/usePushNotifications.ts`
- MOD: `app.json` — Add Expo Notifications plugin
- MOD: `package.json` — Add Expo Notifications

**Tests:**
- Manual (push needs real device + FCM/APNs creds)

**Acceptance:**
- [ ] Push token registered on app launch
- [ ] Gate call triggers push notification when app is backgrounded
- [ ] Tapping push opens gate call screen
- [ ] Expo's notification channel configured

---

### 12. Slice 7 — Remaining Screens & Polish

**Files changed:**
- MOD: `app/(tabs)/residents.tsx` — Directory/neighbours view
- NEW: `app/(tabs)/history.tsx` — Call history + audit feed
- MOD: All screens — Loading states, error boundaries, empty states
- MOD: Home screen — Wire remaining quick action cards

**Tests:**
- Manual + end-to-end walkthrough

---

### 13. Slice 8 — Store Submission Prep

**Files already updated in earlier commits. Final verification:**
- [ ] Privacy Policy hosted at public URL
- [ ] Screenshots taken at all required sizes
- [ ] Data Safety form filled in Play Console
- [ ] App Store Connect privacy labels filled
- [ ] No stub screens with empty content
- [ ] TestFlight build submitted for internal testing

---

## PART VIII: DECISION LOG

### 14. Architecture Decisions Locked

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| D1 | **Skip Linphone SDK for MVP** | No RN binding exists. Building one is 2-4 weeks. Use `react-native-webrtc` + Asterisk bridge instead. | July 2026 |
| D2 | **WebRTC + WebSocket signalling** | WebSocket provides sub-second gate call signalling. WebRTC handles media. Simple, proven stack. | July 2026 |
| D3 | **Asterisk as SIP gateway** | Bridges SIP-based hardware intercoms to WebRTC. Industry standard. Can be introduced post-MVP if not needed initially. | July 2026 |
| D4 | **WebSocket on separate port (8001)** | Keeps REST API responsive during real-time events. Can scale separately. | July 2026 |
| D5 | **Redis for pub/sub + session mgmt** | Required for horizontal scaling of WebSocket servers. Each WS server subscribes to gate call events. | July 2026 |
| D6 | **No CallKit in MVP** | CallKit requires VoIP certificate, entitlement approval, complex integration. In-app call screen first. | July 2026 |
| D7 | **Push notifications as background fallback** | Foreground: WebSocket. Background: push notification with deep link. Don't attempt dual-stream. | July 2026 |
| D8 | **Dark theme only (no light mode)** | Already established in existing design tokens. Saves design/QA effort. | July 2026 |
| D9 | **No offline support for MVP** | App requires network connectivity. Offline cache (WatermelonDB) is post-MVP. | July 2026 |
| D10 | **6-digit numeric PINs** | Easy to key at a gate terminal. Time-bound (default 24h). Can configure per-estate. | July 2026 |

---

## PART IX: EXECUTION DIRECTIVE

### 15. First Action

```
Open the repo at ~/projects/voiprct.
Execute Slice 1 (Tracer Bullet — WebSocket gateway).
Start with db/migration_001_gate_calls.sql to create the gate_calls table,
then build src/ws/__init__.py as the WebSocket handler,
then add REST endpoints to src/api/__init__.py,
then create the mobile gate call screen.

Run tests/test_permissions.py after every backend change.
Push after each completed slice.
```
