FROM python:3.14.3-slim-trixie
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
  UV_LINK_MODE=copy \
  PYTHONUNBUFFERED=1 \
  PYTHONIOENCODING=utf-8

WORKDIR /app

# Install deps in a separate layer for better caching
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked --no-dev --no-install-project

# Copy application source
COPY . .

# Sync the project itself (no-op if no src install needed, but keeps lockfile integrity)
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked --no-dev

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PLATFORM_PORT:-8000}/ || exit 1

CMD ["uv", "run", "app.py"]
