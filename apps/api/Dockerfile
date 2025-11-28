FROM python:3.13.9-slim-trixie

# Install curl and netcat for health checks and service waiting
RUN apt-get update && apt-get install -y curl netcat-openbsd && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set UV_COMPILE_BYTECODE to compile Python source files to bytecode for improved startup time.
ENV UV_COMPILE_BYTECODE=1

# Set UV_LINK_MODE to copy to silence warnings when using cache mounts.
ENV UV_LINK_MODE=copy

# Copy the project into the image
ADD . /app

# Sync the project into a new environment, asserting the lockfile is up to date
WORKDIR /app
RUN uv sync --frozen

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 9000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:9000/api/v1/health || exit 1

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
