Write-Host "Starting frontend (in a new window)..."
Start-Process pnpm.cmd -ArgumentList "dev"

Write-Host "Starting API (in a new window)..."
Start-Process powershell -ArgumentList "-Command `"cd apps/api; uv run app.py`""

Write-Host "Starting PostgreSQL, Redis and ChromaDB with Docker Compose..."
docker compose up -d db chromadb redis

Write-Host "All services started."
