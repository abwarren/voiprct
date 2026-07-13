#!/bin/bash
# ── AnfieldVoice — Container Entrypoint ───────────────────────────────────
# Starts the FastAPI app with uvicorn (gunicorn workers optional)
# ──────────────────────────────────────────────────────────────────────────
set -e

echo "AnfieldVoice starting..."
echo "  DB_HOST: ${ANFIELDVOICE_DB_HOST:-localhost}"
echo "  Port:    ${ANFIELDVOICE_PORT:-8000}"

# Run DB migrations (schema.sql is idempotent — CREATE TABLE IF NOT EXISTS)
echo "Running schema migration..."
if command -v psql &> /dev/null; then
    PGPASSWORD="$ANFIELDVOICE_DB_PASSWORD" psql \
        -h "$ANFIELDVOICE_DB_HOST" \
        -p "${ANFIELDVOICE_DB_PORT:-5432}" \
        -U "$ANFIELDVOICE_DB_USER" \
        -d "$ANFIELDVOICE_DB_NAME" \
        -f /app/db/schema.sql 2>&1 || echo "  ⚠️  Schema migration skipped (psql not available or DB not ready)"
else
    echo "  ⚠️  psql not installed — schema migration happens at app startup via init_db()"
fi

# Start the application
echo "Starting server on 0.0.0.0:${ANFIELDVOICE_PORT:-8000}..."
exec uvicorn src.main:app \
    --host 0.0.0.0 \
    --port "${ANFIELDVOICE_PORT:-8000}" \
    --workers "${ANFIELDVOICE_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips '*'
