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

# ── DOMAIN check ──────────────────────────────────────────────────────────────
if [ -z "${ANFIELDVOICE_DOMAIN:-}" ]; then
    echo "  ℹ️  ANFIELDVOICE_DOMAIN not set — skipping nginx setup."
    echo "  Set ANFIELDVOICE_DOMAIN=yourdomain.com in .env to enable nginx steps."
    echo ""
    SKIP_NGINX=true
else
    SKIP_NGINX=false
fi

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

# ── Nginx Reverse Proxy Setup (optional) ───────────────────────────────────
if [ "$SKIP_NGINX" = false ]; then
    echo "╔══════════════════════════════════════════╗"
    echo "║     Nginx SSL Setup                     ║"
    echo "╚══════════════════════════════════════════╝"
    echo ""
    echo "  Config: deploy/nginx.conf"
    echo "  To install nginx and set up SSL termination:"
    echo ""
    echo "  # 1. Install nginx"
    echo "  sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx"
    echo ""
    echo "  # 2. Copy nginx config"
    echo "  sudo cp deploy/nginx.conf /etc/nginx/sites-available/anfieldvoice"
    echo "  sudo sed -i 's/anfieldvoice\\.example\\.com/${ANFIELDVOICE_DOMAIN}/g' \\"
    echo "      /etc/nginx/sites-available/anfieldvoice"
    echo "  sudo ln -sf /etc/nginx/sites-available/anfieldvoice \\"
    echo "      /etc/nginx/sites-enabled/"
    echo ""
    echo "  # 3. Obtain SSL certificate (replaces placeholder cert paths)"
    echo "  sudo mkdir -p /var/www/html"
    echo "  sudo certbot --nginx -d ${ANFIELDVOICE_DOMAIN}"
    echo ""
    echo "  # 4. Verify and restart"
    echo "  sudo nginx -t && sudo systemctl reload nginx"
    echo ""
    echo "  ── Access ──"
    echo "  Web:  https://${ANFIELDVOICE_DOMAIN}"
    echo "  API:  https://${ANFIELDVOICE_DOMAIN}/health"
    echo "  WS:   wss://${ANFIELDVOICE_DOMAIN}/ws"
    echo ""
fi
