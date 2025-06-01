#!/bin/sh

# Ensure pm2 is in PATH if it's not globally configured for the shell
# export PATH=$PATH:/usr/local/bin # Uncomment and adjust if pm2 is not found

# Start web service
pm2 start server.js --cwd /app/web --name learnhouse-web > /dev/null 2>&1 || { echo "Failed to start learnhouse-web"; exit 1; }

# Change to API directory
cd /app/api || { echo "Failed to change directory to /app/api"; exit 1; }

# Start API service
pm2 start app.py --cwd /app/api --interpreter /app/api/.venv/bin/python --name learnhouse-api > /dev/null 2>&1 || { echo "Failed to start learnhouse-api"; exit 1; }

# Change back to app root
cd /app || { echo "Failed to change directory to /app"; exit 1; }

# Check if the services are running and log the status
pm2 status
echo "SUCCESSSUCCESSSUCCESSSUCCESSSUCCESSSUCCESS"
# Start Nginx in the background
nginx -g 'daemon off;' &

# Tail Nginx error and access logs
pm2 logs
