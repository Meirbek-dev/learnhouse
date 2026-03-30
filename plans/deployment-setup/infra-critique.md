## 3. Infrastructure

### 3.1 Two Processes in One Container

The `Dockerfile` uses `supervisord` to run the FastAPI backend (port 9000) and Next.js frontend
(port 8000) in a single container. Both share a 2 CPU / 2 GB resource envelope.

This creates real problems:

- A memory spike in the Python process (e.g. analytics loading a large dataset) starves the Node.js
  process
- Crash isolation is gone: if supervisord itself dies, both services vanish
- Deployment requires rebuilding and restarting both services for any change to either
- Horizontal scaling is all-or-nothing: you can't scale the API without scaling the frontend

The only benefit is simpler Docker Compose configuration.

**Fix**: Separate into two services (`app-api` and `app-web`) in `docker-compose.yml`. They can
still share the same Docker network and communicate via service name. Build time increases slightly
(two builds) but deploy flexibility improves dramatically.

---

### 3.2 `NEXT_PUBLIC_*` Variables Baked Into the Build

```dockerfile
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MEDIA_URL
```

These are baked into the Next.js bundle at build time. Changing `NEXT_PUBLIC_API_URL` for a staging
vs. production deploy requires a full rebuild. This is the opposite of the 12-factor app principle.

**Fix**: Use Next.js `publicRuntimeConfig` or move to a runtime config endpoint (`/api/config`) that
the client fetches once. This allows the same Docker image to run in staging and production with
different config.

---

### 3.3 Postgres Port Exposed on the Host

```yaml
db:
  ports:
    - '5432:5432' # exposed to the host network
```

The database port is mapped to the host, meaning it is reachable from outside the Docker network
(and potentially outside the machine if firewall rules are permissive). The API service reaches
Postgres via the Docker network — host exposure is unnecessary.

**Fix**: Remove `ports` from the `db` service. Keep `expose: ["5432"]` if internal-only access is
needed for documentation.

---
