"""AnfieldVoice — Push Notification Dispatcher (Slice 6)

Sends push notifications via Expo Push API.
Callable from any backend service (gate calls, PIN events, arrivals).
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import aiohttp

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

logger = logging.getLogger(__name__)


async def send_expo_push(
    db_pool,
    user_ids: list[int],
    title: str,
    body: str,
    data: Optional[dict] = None,
    sound: str = "default",
) -> int:
    """Send a push notification to all active devices of the given users.

    Returns the number of tokens we attempted to send to.
    """
    if not user_ids:
        return 0

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT token, platform FROM push_tokens "
            "WHERE user_id = ANY($1::int[]) AND is_active = TRUE",
            user_ids,
        )

    if not rows:
        logger.info("No push tokens found for users %s", user_ids)
        return 0

    messages = []
    for row in rows:
        messages.append({
            "to": row["token"],
            "title": title,
            "body": body,
            "sound": sound,
            "priority": "high",
            "data": data or {},
            "_platform": row["platform"],
        })

    # Expo accepts batches of up to 100
    batch_size = 100
    sent = 0

    async with aiohttp.ClientSession() as session:
        for i in range(0, len(messages), batch_size):
            batch = messages[i:i + batch_size]
            # Strip internal _platform field before sending
            clean = [{k: v for k, v in m.items() if not k.startswith("_")} for m in batch]
            try:
                async with session.post(
                    EXPO_PUSH_URL,
                    json=clean,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        # Log individual receipt errors
                        if result.get("data"):
                            for receipt in result["data"]:
                                if receipt.get("status") == "error":
                                    logger.warning("Push send error: %s", receipt.get("message"))
                    else:
                        logger.warning("Expo push API returned %d", resp.status)
                    sent += len(batch)
            except asyncio.TimeoutError:
                logger.warning("Expo push API timeout on batch %d", i // batch_size)
            except Exception as e:
                logger.error("Expo push API error: %s", e)

    return sent


# ── Convenience wrappers for common events ──


async def notify_incoming_call(db_pool, user_ids: list[int], caller_unit: str, call_id: int):
    """Notify residents of an incoming gate call."""
    return await send_expo_push(
        db_pool,
        user_ids,
        title="Incoming Gate Call",
        body=f"Someone is at the {caller_unit} gate.",
        data={"type": "incoming_call", "call_id": call_id, "caller_unit": caller_unit},
        sound="default",
    )


async def notify_visitor_pin(db_pool, user_ids: list[int], visitor_name: Optional[str], pin_code: str):
    """Notify resident that a visitor PIN has been generated."""
    name = visitor_name or "A visitor"
    return await send_expo_push(
        db_pool,
        user_ids,
        title="Visitor PIN Generated",
        body=f"{name} has a PIN: {pin_code}",
        data={"type": "pin_generated", "pin_code": pin_code},
    )


async def notify_arrival_reminder(db_pool, user_ids: list[int], visitor_name: str, minutes_from_now: int):
    """Remind resident of an upcoming expected arrival."""
    return await send_expo_push(
        db_pool,
        user_ids,
        title="Expected Arrival Soon",
        body=f"{visitor_name} is expected in {minutes_from_now} minutes.",
        data={"type": "arrival_reminder"},
    )
