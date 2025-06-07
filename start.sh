#!/bin/bash

# --- Configuration ---
# Set this variable to 'konsole' or 'zellij' to force a specific target,
# or leave commented to auto-detect Zellij.
# LAUNCH_TARGET="konsole"
# LAUNCH_TARGET="zellij"
# ---------------------

# Auto-detect if inside Zellij
if [ -z "$LAUNCH_TARGET" ] && [ -n "$ZELLIJ_PANE_ID" ]; then
    CURRENT_TARGET="zellij"
elif [ -z "$LAUNCH_TARGET" ]; then
    CURRENT_TARGET="konsole"
else
    CURRENT_TARGET="$LAUNCH_TARGET"
fi

echo "Launching services using target: $CURRENT_TARGET"

# Function to run a command in the selected target
launch_in_target() {
    local command="$1"
    local name="$2" # Optional: name for Zellij pane/tab if supported/needed

    echo "Starting $name..."

    case "$CURRENT_TARGET" in
        konsole)
            # Konsole: Open in a new window
            # Note: --new-tab might be preferred if you want them in one Konsole window
            konsole --new-window -e "/bin/bash -c \"$command; echo 'Press Enter to close...'; read\"" &
            ;;
        zellij)
            # Zellij: Open in a new pane in the current tab
            # The -- command part is crucial for zellij run
            zellij run -- /bin/bash -c "$command" &
            ;;
        *)
            echo "Error: Unknown launch target '$CURRENT_TARGET'. Running in background."
            /bin/bash -c "$command" &
            ;;
    esac
}

# Start Frontend
# We wrap the command in /bin/bash -c "" to ensure proper execution,
# and add 'read' in Konsole to keep the window open after the process exits.
launch_in_target "pnpm dev" "frontend (in a new window/pane)"

# Start API
# Use a subshell (cd ... && ...) to run the command in the correct directory.
launch_in_target "cd apps/api && uv run app.py" "API (in a new window/pane)"

echo "Starting PostgreSQL, Redis and ChromaDB with Docker Compose..."
# Docker Compose command remains the same
docker compose up -d db chromadb redis

echo "All services started."
echo "Note: Frontend and API processes are running in separate Konsole windows or Zellij panes."
