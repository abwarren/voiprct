## CURRENT OBJECTIVE
Slice 1 (WebSocket + Gate Call Signalling) complete. Proceed to Slice 2 — WebRTC audio integration.

## LOCKED REQUIREMENTS
- One codebase (React Native), single app for residents
- Gate call audio via `react-native-webrtc` + Asterisk WebRTC bridge
- No Linphone SDK, no native module builds
- Dark theme only
- WebSocket for signalling, WebRTC for media
- All data encrypted in transit (HTTPS/DTLS)

## SYSTEM STATE
Backend runs, 40/40 tests pass, gate call lifecycle works end-to-end over WebSocket. Mobile app has Gate tab with incoming call UI and history.

## COMPLETED SLICE
**Tracer Bullet (Slice 1)** — WebSocket gateway + gate call lifecycle:
- Gate calls table in PostgreSQL
- WebSocket connection manager (in-memory, Redis-ready)
- REST endpoints: initiate call, answer/reject, history
- Mobile: Gate screen with pulse animation, vibration, answer/reject, call history, WS status badge
- All quick action cards on Home screen wired to Gate tab
- Role-conditional tab visibility (residents + property admins see Gate tab)

## FILES CHANGED
```
NEW:  src/ws.py                        (267 lines — WS manager + handler)
NEW:  src/models.py                    (+42 lines — GateCall models)
NEW:  src/api/__init__.py              (+181 lines — gate call REST endpoints)
NEW:  src/main.py                      (+12 lines — /ws route + WebSocket import)
NEW:  db/schema.sql                    (+25 lines — gate_calls table)
NEW:  anfieldvoice-mobile/app/(tabs)/gate.tsx  (387 lines — gate call screen)
NEW:  anfieldvoice-mobile/src/hooks/useWebSocket.ts  (98 lines — WS hook)
MOD:  anfieldvoice-mobile/app/(tabs)/_layout.tsx  (Gate tab + role visibility)
MOD:  anfieldvoice-mobile/app/(tabs)/home.tsx      (quick actions → Gate tab)
MOD:  anfieldvoice-mobile/src/types/index.ts        (+37 lines — gate call types)
MOD:  anfieldvoice-mobile/src/api/client.ts         (+28 lines — gate call API fns)
```

## TESTS & RESULTS
- 40/40 permission tests PASS
- 8 DB integration tests SKIPPED (no PostgreSQL in CI)
- Backend imports compile clean

## CRITICAL DISCOVERIES
- WebSocket reconnection needs 3s retry — implemented in useWebSocket.ts
- Vibration API requires user gesture on iOS — implement post-MVP
- Incoming call overlay uses absolute positioning with z-index — test on various devices

## KNOWN ISSUES
- No fallback for when WS disconnects AND REST fails simultaneously (edge case)
- Gate history only shows current user's accessible apartments (by design — role-filtered)

## NEXT VERTICAL SLICE
**Slice 2: WebRTC Audio Integration**

Goal: When user taps "Answer" on an incoming gate call, establish a WebRTC audio stream.

Changes needed:
1. Install `react-native-webrtc` in package.json
2. Create `src/hooks/useWebRTC.ts` — manage RTCPeerConnection lifecycle
3. Update `src/ws.py` to exchange SDP offers/answers over WebSocket
4. Create `src/components/CallScreen.tsx` — active call UI (mute, speaker, end call)
5. Update `app/(tabs)/gate.tsx` to launch CallScreen on answer
6. Update `db/schema.sql` to store SDP payloads in gate_calls table

---

## FIRST ACTION ON RESUME
```
cd ~/projects/voiprct/anfieldvoice-mobile
npx expo install react-native-webrtc
```
Then create `src/hooks/useWebRTC.ts` with RTCPeerConnection setup, SDP exchange over WebSocket, and audio stream handling.
