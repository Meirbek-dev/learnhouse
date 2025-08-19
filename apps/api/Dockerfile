# Stage 1: Builder
# Use a uv image with Python pre-installed.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

# Set the working directory
WORKDIR /app

# Set UV_COMPILE_BYTECODE to compile Python source files to bytecode for improved startup time.
ENV UV_COMPILE_BYTECODE=1

# Set UV_LINK_MODE to copy to silence warnings when using cache mounts.
ENV UV_LINK_MODE=copy

# Install dependencies in a separate layer for better caching.
# We're using cache mounts for uv's cache.
# We're also binding pyproject.toml and uv.lock to leverage Docker's caching,
# so changes to the project's dependencies will invalidate this layer.
RUN --mount=type=cache,target=/root/.cache/uv \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  --mount=type=bind,source=uv.lock,target=uv.lock \
  uv sync --locked --no-install-project --no-editable

# Copy the project into the intermediate image.
# This step is intentionally separate from the dependency installation to allow for better caching
# when only the project code changes.
COPY . /app

# Re-sync the project to install the project itself (non-editable mode for production).
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked --no-editable

# Stage 2: Production
# Use a lean Python-only image for the final production image.
# This reduces the final image size as uv is not needed at runtime.
FROM python:3.13.7-slim-trixie

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1 \
  PYTHONHASHSEED=random \
  PIP_NO_CACHE_DIR=1

# Set the working directory
WORKDIR /app

# Copy only the installed virtual environment from the builder stage.
# This ensures a minimal final image without the build tools or source code.
COPY --from=builder /app/.venv /app/.venv

# Ensure the virtual environment's bin directory is on the PATH
ENV PATH="/app/.venv/bin:$PATH"

# Run the application using the activated virtual environment
CMD ["python", "app.py"]
