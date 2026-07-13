#!/bin/bash
# ── AnfieldVoice — One-Command Production Deploy ──────────────────────────
# Usage: ./deploy.sh
# Requires: Docker + docker compose plugin
# ────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║     AnfieldVoice — Docker Deploy        ║"
echo "╚══════════════════════════════════════════╝"

# ── .env check ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo ""
    echo "  ❌ Missing .env file"
    echo "  Copy .env.example to .env and fill in your production values:"
    echo "    cp .env.example .env"
    echo "    nano .env"
    echo ""
    exit 1
fi

# ── Build ──────────────────────────────────────────────────────────────────
echo ""
echo "  [1/4] Building images..."
docker compose build 2>&1

# ── Stop stale ─────────────────────────────────────────────────────────────
echo ""
echo "  [2/4] Stopping stale containers..."
docker compose down --remove-orphans 2>/dev/null || true

# ── Start ──────────────────────────────────────────────────────────────────
echo ""
echo "  [3/4] Starting services..."
docker compose up -d

# ── Wait for healthy ───────────────────────────────────────────────────────
echo ""
echo "  [4/4] Waiting for health checks..."
for svc in anfieldvoice-app anfieldvoice-db; do
    echo -n "    $svc..."
    for i in $(seq 1 30); do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
        if [ "$STATUS" = "healthy" ]; then
            echo " OK"
            break
        fi
        sleep 2
        echo -n "."
    done
done

# ── Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "  ── Health Check ──"
curl -sf http://localhost:${ANFIELDVOICE_PORT:-8000}/health && echo "  ✅ API healthy" || echo "  ❌ API unhealthy"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Deploy Complete                      ║"
echo "║  Web:  http://localhost:${ANFIELDVOICE_PORT:-8000}          ║"
echo "║  API:  http://localhost:${ANFIELDVOICE_PORT:-8000}/health   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Logs:  docker compose logs -f"
echo "Stop:  docker compose down"
echo ""
