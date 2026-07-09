"""
AnfieldVoice — Audit Trail
==========================
Records every administrative action with full before/after state.
Immutable — events are inserted, never updated or deleted.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable, Optional


async def write_audit_entry(
    db_pool,
    *,
    admin_user_id: int,
    apartment_id: Optional[int],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    previous_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> int:
    """
    Write an immutable audit log entry.
    Returns the audit_id of the created entry.
    """
    async with db_pool.acquire() as conn:
        audit_id = await conn.fetchval("""
            INSERT INTO audit_log (
                admin_user_id, apartment_id, action, target_type, target_id,
                previous_value, new_value, reason, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::inet, $10)
            RETURNING audit_id
        """,
            admin_user_id,
            apartment_id,
            action,
            target_type,
            target_id,
            json.dumps(previous_value) if previous_value else None,
            json.dumps(new_value) if new_value else None,
            reason,
            ip_address,
            user_agent,
        )
        return audit_id


def audited_action(action: str, target_type: str):
    """
    Decorator for API endpoints that need audit logging.

    Usage:
        @audited_action("tenant_added", "resident")
        async def add_tenant(request, ...):
            ...

    The decorated function must:
      1. Accept `admin_user_id` as a keyword argument
      2. Accept `apartment_id` as a keyword argument
      3. Return a dict with optional `previous_value` and required `target_id` + `new_value`
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)

            # Extract audit fields from kwargs
            admin_user_id = kwargs.get("admin_user_id")
            apartment_id = kwargs.get("apartment_id")
            reason = kwargs.get("reason")
            ip_address = kwargs.get("ip_address")
            user_agent = kwargs.get("user_agent")
            db_pool = kwargs.get("db_pool")

            if db_pool and admin_user_id:
                target_id = result.get("target_id") if isinstance(result, dict) else None
                previous_value = result.get("previous_value") if isinstance(result, dict) else None
                new_value = result.get("new_value") if isinstance(result, dict) else None

                await write_audit_entry(
                    db_pool,
                    admin_user_id=admin_user_id,
                    apartment_id=apartment_id,
                    action=action,
                    target_type=target_type,
                    target_id=target_id,
                    previous_value=previous_value,
                    new_value=new_value,
                    reason=reason,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )

            return result
        return wrapper
    return decorator


async def query_audit_log(
    db_pool,
    *,
    apartment_id: Optional[int] = None,
    admin_user_id: Optional[int] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Query the audit log with optional filters."""
    conditions = ["1=1"]
    params: list[Any] = []
    param_idx = 0

    if apartment_id is not None:
        param_idx += 1
        conditions.append(f"al.apartment_id = ${param_idx}")
        params.append(apartment_id)
    if admin_user_id is not None:
        param_idx += 1
        conditions.append(f"al.admin_user_id = ${param_idx}")
        params.append(admin_user_id)
    if action is not None:
        param_idx += 1
        conditions.append(f"al.action = ${param_idx}")
        params.append(action)
    if target_type is not None:
        param_idx += 1
        conditions.append(f"al.target_type = ${param_idx}")
        params.append(target_type)
    if from_date is not None:
        param_idx += 1
        conditions.append(f"al.created_at >= ${param_idx}")
        params.append(from_date)
    if to_date is not None:
        param_idx += 1
        conditions.append(f"al.created_at <= ${param_idx}")
        params.append(to_date)

    param_idx += 1
    limit_param = param_idx
    params.append(limit)
    param_idx += 1
    offset_param = param_idx
    params.append(offset)

    where = " AND ".join(conditions)

    async with db_pool.acquire() as conn:
        rows = await conn.fetch(f"""
            SELECT
                al.audit_id, al.admin_user_id, u.full_name AS admin_name,
                al.apartment_id, al.action, al.target_type, al.target_id,
                al.previous_value, al.new_value, al.reason,
                al.ip_address::text, al.created_at
            FROM audit_log al
            LEFT JOIN users u ON al.admin_user_id = u.user_id
            WHERE {where}
            ORDER BY al.created_at DESC
            LIMIT ${limit_param} OFFSET ${offset_param}
        """, *params)

        return [dict(r) for r in rows]
