FROM python:3.14.2-slim-trixie
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set UV_COMPILE_BYTECODE to compile Python source files to bytecode for improved startup time.
ENV UV_COMPILE_BYTECODE=1

# Set UV_LINK_MODE to copy to silence warnings when using cache mounts.
ENV UV_LINK_MODE=copy

# Copy the project into the image
ADD . /app

# Sync the project into a new environment, asserting the lockfile is up to date
WORKDIR /app
RUN uv sync --locked

# Run the application
CMD ["uv", "run", "app.py"]
