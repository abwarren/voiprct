"""
AnfieldVoice — FastAPI Application
===================================
Property Administrator Role Management API
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api import router
from src.config import settings
from src.database import create_pool, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown: create DB pool, run migrations."""
    app.state.db_pool = await create_pool()
    await init_db(app.state.db_pool)
    yield
    await app.state.db_pool.close()


app = FastAPI(
    title="AnfieldVoice API",
    description="Property Administrator Role Management for Residential Estates",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow mobile apps and dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )
