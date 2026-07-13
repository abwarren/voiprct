# ── AnfieldVoice — Production Dockerfile ──────────────────────────────────
# FastAPI backend + Web Dashboard (vanilla JS served as static files)
# Multi-process: entrypoint runs the main app with gunicorn/uvicorn
# ──────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gcc python3-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# Application code
COPY . .

# Runtime dirs
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -sf http://127.0.0.1:8000/health || exit 1

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
