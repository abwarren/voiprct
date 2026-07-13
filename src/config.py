"""
AnfieldVoice — Configuration
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Settings:
    # Database
    DB_HOST: str = os.getenv("ANFIELDVOICE_DB_HOST", "localhost") or "localhost"
    DB_PORT: int = int(os.getenv("ANFIELDVOICE_DB_PORT", "5432") or "5432")
    DB_USER: str = os.getenv("ANFIELDVOICE_DB_USER", "postgres") or "postgres"
    DB_PASSWORD: str = os.getenv("ANFIELDVOICE_DB_PASSWORD", "postgres") or "postgres"
    DB_NAME: str = os.getenv("ANFIELDVOICE_DB_NAME", "anfieldvoice") or "anfieldvoice"
    DB_POOL_MIN: int = int(os.getenv("ANFIELDVOICE_DB_POOL_MIN", "2") or "2")
    DB_POOL_MAX: int = int(os.getenv("ANFIELDVOICE_DB_POOL_MAX", "10") or "10")

    # Server
    HOST: str = os.getenv("ANFIELDVOICE_HOST", "0.0.0.0") or "0.0.0.0"
    PORT: int = int(os.getenv("ANFIELDVOICE_PORT", "8000") or "8000")
    DEBUG: bool = os.getenv("ANFIELDVOICE_DEBUG", "false").lower() == "true"

    # Auth
    JWT_SECRET: str = os.getenv("ANFIELDVOICE_JWT_SECRET", "anfieldvoice-dev-secret-change-in-production") or "anfieldvoice-dev-secret-change-in-production"
    JWT_EXPIRY_HOURS: int = int(os.getenv("ANFIELDVOICE_JWT_EXPIRY_HOURS", "24") or "24")


settings = Settings()
