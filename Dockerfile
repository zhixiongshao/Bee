# ---- frontend build ----
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- runtime ----
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ASSETS_DIR=/app/data \
    STATIC_DIR=/app/frontend/dist

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
# includes variants_index.db (Git LFS; Render must clone with LFS enabled)
COPY data ./data
COPY --from=frontend /fe/dist ./frontend/dist

# sanity check: fail build early if LFS pointer was not smudged
RUN python - <<'PY'
from pathlib import Path
p = Path('data/variants_index.db')
assert p.exists(), 'missing data/variants_index.db'
size = p.stat().st_size
# Git LFS pointer files are tiny; real sqlite is hundreds of MB
assert size > 10_000_000, f'variants_index.db looks like an LFS pointer ({size} bytes). Enable Git LFS on the host/clone.'
print(f'variants_index.db ok: {size} bytes')
PY

EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
