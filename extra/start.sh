#!/bin/sh

# Set environment variables for proper Python logging
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# Wait for database and redis if connection strings point to external services
# (In docker-compose, depends_on handles this, but useful for standalone)
if [ -n "$PLATFORM_SQL_CONNECTION_STRING" ]; then
    DB_HOST=$(echo "$PLATFORM_SQL_CONNECTION_STRING" | sed -n 's/.*@\([^:]*\):\([0-9]*\)\/.*/\1/p')
    if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_HOST" != "db" ]; then
        echo "Waiting for external database at $DB_HOST..."
        timeout 30 sh -c 'until nc -z '"$DB_HOST"' 5432; do sleep 1; done' || true
    fi
fi

# Start the services
# Use server-wrapper.js for runtime environment variable injection
pm2 start server-wrapper.js --cwd /app/web --name ashyq-bilim-web > /dev/null 2>&1
# Start API with `uv` so the uv-managed environment (and installed deps) are used.
# This runs `uv run uvicorn app:app` under pm2 so modules installed by `uv sync` are available.
pm2 start uv --name ashyq-bilim-api -- run uvicorn app:app -- --host 0.0.0.0 --port 9000 > /dev/null 2>&1

# Check if the services are running and log the status
pm2 status

# Create nginx cache directory before starting nginx
mkdir -p /var/cache/nginx/next

# Start Nginx in the background
nginx -g 'daemon off;' &

# Tail PM2 logs with proper formatting
pm2 logs --raw
