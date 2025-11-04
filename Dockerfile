# syntax=docker/dockerfile:latest
# Base image for Python backend
FROM python:3.13.9-slim-trixie AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1 \
  PYTHONHASHSEED=random \
  PIP_NO_CACHE_DIR=1 \
  UV_COMPILE_BYTECODE=1 \
  UV_LINK_MODE=copy

# Install Nginx, curl, and build-essential with cached apt layers
RUN --mount=type=cache,target=/var/cache/apt \
  --mount=type=cache,target=/var/lib/apt \
  apt-get update \
  && apt-get install -y --no-install-recommends nginx curl build-essential ca-certificates gnupg \
  && rm /etc/nginx/sites-enabled/default \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Bring in a reproducible Node.js toolchain and install PM2 globally
COPY --from=node:24-bullseye-slim /usr/local /usr/local
RUN npm install -g pm2 && corepack enable pnpm

# Ensure uv is available for dependency management at runtime
RUN pip install --upgrade pip \
  && pip install uv

# Frontend dependencies
FROM node:24-alpine AS frontend-deps
RUN corepack enable pnpm
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install ALL dependencies (including dev dependencies for pnpm dev)
COPY .npmrc ./.npmrc
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY apps/web/package.json ./package.json
COPY apps/web/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --no-frozen-lockfile

# Backend dependencies layer for better caching
FROM base AS backend-deps
WORKDIR /app/api
COPY --link ./apps/api/pyproject.toml ./pyproject.toml
COPY --link ./apps/api/uv.lock ./uv.lock
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

# Final image combining frontend and backend
FROM base AS runner

# Set development environment
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Copy frontend source code and dependencies for dev mode
WORKDIR /app/web
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY apps/web ./

# Backend runtime
WORKDIR /app/api
COPY --link ./apps/api ./
COPY --from=backend-deps /app/api/.venv ./.venv
ENV PATH="/app/api/.venv/bin:${PATH}"

# Run the backend
WORKDIR /app
COPY ./extra/nginx.conf /etc/nginx/conf.d/default.conf
ENV PORT=8000 PLATFORM_PORT=9000 HOSTNAME=0.0.0.0
COPY ./extra/start.sh /app/start.sh
RUN chmod +x /app/start.sh
EXPOSE 80 443
CMD ["sh", "/app/start.sh"]
