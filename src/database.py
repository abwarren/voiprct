"""
AnfieldVoice — Database Connection Pool
"""
from __future__ import annotations

import asyncpg

from src.config import settings


async def create_pool() -> asyncpg.Pool:
    """Create an asyncpg connection pool from settings."""
    return await asyncpg.create_pool(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        min_size=settings.DB_POOL_MIN,
        max_size=settings.DB_POOL_MAX,
    )


async def init_db(pool: asyncpg.Pool) -> None:
    """Run schema.sql and seed.sql against the database.

    Idempotent — skips tables/objects that already exist so this works
    both as a first-run initialiser and when the schema is already loaded
    (e.g. via PostgreSQL's /docker-entrypoint-initdb.d/).
    """
    import os

    schema_path = os.path.join(os.path.dirname(__file__), "..", "db", "schema.sql")
    seed_path = os.path.join(os.path.dirname(__file__), "..", "db", "seed.sql")

    async with pool.acquire() as conn:
        for path in [schema_path, seed_path]:
            if os.path.exists(path):
                with open(path) as f:
                    sql = f.read()
                try:
                    await conn.execute(sql)
                except asyncpg.exceptions.DuplicateTableError:
                    pass  # tables already exist — Docker init-db ran first
                except asyncpg.exceptions.DuplicateObjectError:
                    pass  # extensions, types, etc. already exist
                except asyncpg.exceptions.UniqueViolationError:
                    pass  # seed data already inserted
