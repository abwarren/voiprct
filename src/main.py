"""
AnfieldVoice — FastAPI Application
===================================
Property Administrator Role Management API
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from src.api import router
from src.config import settings
from src.database import create_pool, init_db
from src.ws import ws_handler


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


# ── Health — registered before static/catch-all so it takes precedence ────


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Static Files (Web Dashboard) ──────────────────────────────────────────────


import os

WEB_DIR = os.path.join(os.path.dirname(__file__), "..", "web")
INDEX_PATH = os.path.join(WEB_DIR, "index.html")

if os.path.isdir(WEB_DIR):
    app.mount("/static", StaticFiles(directory=WEB_DIR, html=False), name="web_static")

    @app.get("/{full_path:path}")
    async def serve_web(full_path: str):
        # Don't intercept API routes, health, or WebSocket
        if full_path.startswith("api/") or full_path == "ws" or full_path == "health" or full_path.startswith("static/"):
            return JSONResponse({"error": "not found"}, status_code=404)
        if os.path.isfile(INDEX_PATH):
            return FileResponse(INDEX_PATH)
        return JSONResponse({"error": "not found"}, status_code=404)


# ── WebSocket Gateway ───────────────────────────────────────────────────────


@app.websocket("/ws")
async def websocket_gateway(ws: WebSocket):
    """Real-time signalling gateway for gate calls."""
    await ws_handler(ws, ws.app.state.db_pool)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )
