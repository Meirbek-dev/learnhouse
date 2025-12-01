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
RUN npm install -g pm2

# Ensure uv is available for dependency management at runtime
RUN pip install --upgrade pip \
  && pip install uv

# Frontend Build
FROM node:24-alpine AS frontend-base
RUN corepack enable pnpm

# Install dependencies only when needed
FROM frontend-base AS frontend-deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY .npmrc ./.npmrc
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY apps/web/package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --prod --no-frozen-lockfile

# Rebuild the source code only when needed
FROM frontend-base AS frontend-builder
WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY apps/web .

# Set environment variables for the build
# ENV NEXT_PUBLIC_PLATFORM_API_URL=http://localhost/api/v1/
# ENV NEXT_PUBLIC_PLATFORM_BACKEND_URL=http://localhost/
# ENV NEXT_PUBLIC_PLATFORM_DOMAIN=localhost
ENV NEXT_PUBLIC_PLATFORM_API_URL=https://cs-mooc.tou.edu.kz/api/v1/
ENV NEXT_PUBLIC_PLATFORM_BACKEND_URL=https://cs-mooc.tou.edu.kz/
ENV NEXT_PUBLIC_PLATFORM_DOMAIN=cs-mooc.tou.edu.kz
ENV NEXT_PUBLIC_PLATFORM_HTTPS=true
ENV NEXT_PUBLIC_PLATFORM_MEDIA_URL=https://cs-mooc.tou.edu.kz/

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Remove .env files from the final image
# This is a good practice to avoid leaking sensitive data
# Learn more about it in the Next.js documentation: https://nextjs.org/docs/basic-features/environment-variables
RUN rm -f .env*

RUN pnpm run build
RUN pnpm prune --prod

# Backend dependencies layer for better caching
FROM base AS backend-deps
WORKDIR /app/api
COPY --link ./apps/api/pyproject.toml ./pyproject.toml
COPY --link ./apps/api/uv.lock ./uv.lock
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

# Production image, copy all the files and run next
FROM frontend-base AS frontend-runner
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=frontend-builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=frontend-builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=frontend-builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Final image combining frontend and backend
FROM base AS runner

# Copy the frontend standalone build
COPY --from=frontend-runner /app /app/web

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
