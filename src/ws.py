"""
AnfieldVoice — WebSocket Gateway
=================================
Real-time signalling for gate calls, visitor events, and push notifications.

Connection lifecycle:
  1. Client connects to /ws?token=<jwt>
  2. Server authenticates via JWT, extracts user_id + roles + apartment_ids
  3. Server registers the connection keyed by user_id
  4. Inbound gate calls are routed to all active residents of the target apartment
  5. Actions (answer/reject) flow back over the same connection

Horizontal scaling: In production, swap the in-memory dict for Redis pub/sub.
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect, status

from src.auth import decode_token

logger = logging.getLogger("anfieldvoice.ws")

# ── In-Memory Connection Manager ──────────────────────────────────────────
# Maps user_id → list of active WebSocket connections
# A user may have multiple connections (phone + tablet).
_connections: dict[int, list[WebSocket]] = defaultdict(list)

# Reverse lookup: apartment_id → set of user_ids currently connected
_apartment_roster: dict[int, set[int]] = defaultdict(set)


async def on_connect(ws: WebSocket, token: str) -> Optional[dict]:
    """Authenticate the WebSocket connection via JWT token."""
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
        roles: list[str] = payload.get("roles", [])
        return {"user_id": user_id, "roles": roles}
    except Exception as exc:
        logger.warning("WebSocket auth failed: %s", exc)
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return None


def register(ws: WebSocket, user_id: int, apartment_ids: list[int]):
    """Register a connection for a user."""
    _connections[user_id].append(ws)
    for apt_id in apartment_ids:
        _apartment_roster[apt_id].add(user_id)
    logger.info("WS registered user=%d (total=%d)", user_id, len(_connections))


def unregister(ws: WebSocket, user_id: int, apartment_ids: list[int]):
    """Unregister a connection."""
    conns = _connections.get(user_id, [])
    if ws in conns:
        conns.remove(ws)
    if not conns:
        _connections.pop(user_id, None)
    for apt_id in apartment_ids:
        s = _apartment_roster.get(apt_id, set())
        s.discard(user_id)
        if not s:
            _apartment_roster.pop(apt_id, None)
    logger.info("WS unregistered user=%d", user_id)


async def send_to_apartment(apartment_id: int, event: dict) -> list[int]:
    """Send an event to all connected residents of an apartment.
    Returns list of user_ids that received the event.
    """
    user_ids = _apartment_roster.get(apartment_id, set())
    reached: list[int] = []
    payload = json.dumps(event, default=str)
    for uid in list(user_ids):
        for ws in list(_connections.get(uid, [])):
            try:
                await ws.send_text(payload)
                if uid not in reached:
                    reached.append(uid)
            except Exception:
                # Stale connection — will be cleaned on next WS receive
                pass
    return reached


async def send_to_user(user_id: int, event: dict) -> bool:
    """Send an event to a specific user. Returns True if sent."""
    payload = json.dumps(event, default=str)
    for ws in list(_connections.get(user_id, [])):
        try:
            await ws.send_text(payload)
            return True
        except Exception:
            pass
    return False


def get_connected_user_ids(apartment_id: int) -> set[int]:
    """Return set of user ids currently connected for an apartment."""
    return _apartment_roster.get(apartment_id, set())


# ── WebSocket Endpoint Handler ─────────────────────────────────────────────


async def ws_handler(ws: WebSocket, db_pool):
    """Main WebSocket loop: authenticate → register → dispatch messages."""
    await ws.accept()

    # Read auth token from query param
    token = ws.query_params.get("token")
    if not token:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    user_info = await on_connect(ws, token)
    if user_info is None:
        return

    user_id = user_info["user_id"]
    roles = user_info["roles"]

    # Resolve apartment IDs this user cares about
    apartment_ids = await _resolve_user_apartments(db_pool, user_id, roles)
    register(ws, user_id, apartment_ids)

    try:
        # Confirm connection
        await ws.send_text(json.dumps({
            "type": "connected",
            "user_id": user_id,
            "apartment_ids": apartment_ids,
        }))

        # Listen for client messages
        while True:
            raw = await ws.receive_text()
            await _handle_client_message(ws, raw, user_id, db_pool)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("WS error user=%d: %s", user_id, exc)
    finally:
        unregister(ws, user_id, apartment_ids)


async def _resolve_user_apartments(db_pool, user_id: int, roles: list[str]) -> list[int]:
    """Get all apartment IDs relevant to this user for call routing."""
    import asyncpg

    apartment_ids: set[int] = set()

    async with db_pool.acquire() as conn:
        # Apartments where user is a resident
        if "resident" in roles:
            rows = await conn.fetch(
                "SELECT apartment_id FROM apartment_residents WHERE user_id = $1 AND is_active = TRUE",
                user_id,
            )
            apartment_ids.update(r["apartment_id"] for r in rows)

        # Apartments where user is a property admin
        if "property_admin" in roles:
            rows = await conn.fetch(
                "SELECT apartment_id FROM property_admin_assignments WHERE user_id = $1 AND revoked_at IS NULL",
                user_id,
            )
            apartment_ids.update(r["apartment_id"] for r in rows)

        # Body corp / super admin: all apartments
        if "body_corp_admin" in roles or "super_admin" in roles:
            rows = await conn.fetch(
                "SELECT apartment_id FROM apartments WHERE is_active = TRUE",
            )
            apartment_ids.update(r["apartment_id"] for r in rows)

    return list(apartment_ids)


async def _handle_client_message(ws: WebSocket, raw: str, user_id: int, db_pool):
    """Process an incoming message from the client."""
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        await ws.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
        return

    msg_type = msg.get("type")

    if msg_type == "ping":
        await ws.send_text(json.dumps({"type": "pong"}))

    elif msg_type == "answer_call":
        call_id = msg.get("call_id")
        action = msg.get("action", "answer")
        await _handle_call_action(call_id, user_id, action, db_pool, ws)

    else:
        await ws.send_text(json.dumps({
            "type": "error",
            "message": f"Unknown message type: {msg_type}",
        }))


async def _handle_call_action(call_id: int, user_id: int, action: str, db_pool, ws: WebSocket):
    """Handle answer/reject actions for a gate call."""
    import asyncpg

    allowed_status = "ringing"
    new_status = "answered" if action == "answer" else "rejected"

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM gate_calls WHERE call_id = $1 AND call_status = $2",
            call_id, allowed_status,
        )
        if not row:
            await ws.send_text(json.dumps({
                "type": "error",
                "message": f"Call {call_id} is no longer active",
            }))
            return

        # Verify user is a resident of this apartment
        is_resident = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM apartment_residents WHERE user_id = $1 AND apartment_id = $2 AND is_active = TRUE)",
            user_id, row["apartment_id"],
        )
        if not is_resident:
            await ws.send_text(json.dumps({
                "type": "error",
                "message": "You are not a resident of this apartment",
            }))
            return

        if action == "answer":
            await conn.execute(
                "UPDATE gate_calls SET call_status = $1, answered_at = NOW() WHERE call_id = $2",
                new_status, call_id,
            )
        else:
            await conn.execute(
                "UPDATE gate_calls SET call_status = $1, ended_at = NOW() WHERE call_id = $2",
                new_status, call_id,
            )

        # Notify caller unit (gate hardware) via the gate call REST endpoints
        await ws.send_text(json.dumps({
            "type": "call_action_result",
            "call_id": call_id,
            "action": action,
            "status": new_status,
        }))

        # Notify other connections for this apartment
        await send_to_apartment(row["apartment_id"], {
            "type": "call_updated",
            "call_id": call_id,
            "call_status": new_status,
        })
