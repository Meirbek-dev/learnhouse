#!/bin/sh

# Set environment variables for proper Python logging
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8
export NODE_ENV=development

# Start the services in development mode
pm2 start pnpm --cwd /app/web --name ashyq-bilim-web -- dev --hostname 0.0.0.0 --port 8000
pm2 start uv --cwd /app/api --name ashyq-bilim-api -- run app.py

# Check if the services are running and log the status
pm2 status

# Start Nginx in the background
nginx -g 'daemon off;' &

# Tail PM2 logs with proper formatting
pm2 logs --raw
