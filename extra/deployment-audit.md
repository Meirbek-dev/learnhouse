# Deployment Audit — Ashyq Bilim

> **Scope:** Root `Dockerfile`, `docker-compose.yml`, `extra/nginx.conf`, `extra/supervisord.conf`,
> `extra/start.sh`, `apps/web/Dockerfile`, `apps/api/Dockerfile`, `apps/web/next.config.ts`, and
> related configuration files.
>
> Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low / nitpick

---

## 1. Architecture — Monolith Container Anti-Pattern

### 🔴 Both services run inside one container managed by supervisord

`Dockerfile` (line 114–127) and `supervisord.conf` bundle Next.js (port 8000) and FastAPI
(port 9000) into a single image. This is fundamentally at odds with container best practices.

**Consequences:**

- **Zero independent scaling.** Spike in AI traffic? You must scale the frontend too, and vice
  versa.
- **Single point of failure.** If one service crashes and cannot be restarted by supervisord within
  `startretries=5`, the entire container is still considered "healthy" because the health check only
  probes port 8000 (Next.js). The FastAPI backend can be completely dead while Docker reports the
  container as healthy.
- **Enormous image size.** The final stage inherits a full Python 3.14 base with build tools, then
  grafts the entire `/usr/local` tree from a Node 25 image on top. You carry two full runtimes plus
  all build dependencies into production.
- **One deployment for two services.** Any change to either codebase — even a one-line frontend
  tweak — forces a full rebuild and restart of everything.
- **Resource limits are shared.** The `deploy.resources` in `docker-compose.yml` gives the `app`
  container 2 CPUs / 2 GB. These are indivisibly shared between the Node and Python processes.

**Fix:** Split into three containers: `web` (Next.js), `api` (FastAPI), `proxy` (nginx). The
`apps/web/Dockerfile` and `apps/api/Dockerfile` already exist and are ready for this.

---

### 🟠 `extra/start.sh` is dead code referencing a non-existent tool

`start.sh` starts services with `pm2`, which is not installed anywhere in any Dockerfile. The file
is never called. It lives in `extra/` alongside real production configs, creating genuine confusion
about how the app starts (it's supervisord, not pm2). This script should be deleted.

---

## 2. Security

### 🔴 All backing services are exposed directly to the host network

```yaml
# docker-compose.yml
db:      ports: ["5432:5432"]   # PostgreSQL — no auth beyond weak password
redis:   ports: ["6379:6379"]   # Redis — ZERO authentication
chromadb: ports: ["8001:8000"]  # ChromaDB — no auth
judge0_server: ports: ["2358:2358"]  # Remote code execution service
```

Every single internal service is bound to `0.0.0.0` on the host. On a typical VPS this means they
are reachable from the public internet. Redis in particular has no password configured — anyone who
can reach port 6379 owns the cache (and potentially can use `SLAVEOF` or `CONFIG SET` to achieve
RCE). ChromaDB has no built-in authentication in the default community image.

**Fix:** Replace all `ports:` with `expose:` for services that are only consumed internally. Create
explicit named networks and segment them:

```yaml
networks:
  frontend: {} # nginx → web, api
  backend: {} # api → db, redis, chromadb
  sandbox: {} # judge0 → db, redis only
```

---

### 🔴 No HTTPS anywhere in the nginx config

`nginx.conf` only has a single `server { listen 80; }` block. There is no TLS termination, no
HTTP→HTTPS redirect, no HSTS header. The app handles auth cookies, JWT tokens, and user-uploaded
content entirely over plaintext HTTP — despite the Dockerfile hardcoding
`NEXT_PUBLIC_PLATFORM_HTTPS=true` and `https://cs-mooc.tou.edu.kz` as the domain.

This means:

- Session tokens and JWTs are transmitted in cleartext.
- `secure` cookie flag is never set (because `PLATFORM_SSL` is False in the example config and the
  nginx proxy always forwards `X-Forwarded-Proto: http`).
- `__Secure-` cookie name prefix in `auth.ts` (line 98) will **never** apply because the
  `cookieSecure` flag can't become `true` when SSL is never presented.

**Fix:** Add TLS termination to nginx (Let's Encrypt / certbot), an HTTP→HTTPS redirect server
block, and `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;`.

---

### 🔴 Weak, hardcoded PostgreSQL credentials

```yaml
environment:
  POSTGRES_USER: openu
  POSTGRES_PASSWORD: openu # password == username
  POSTGRES_DB: openu
```

The same string is used for username, password, and database name. The connection string in the
example env confirms this: `postgresql+psycopg://openu:openu@db:5432/openu`. Even if the port is not
exposed publicly, any container on the default Docker network can connect without brute-forcing
anything.

---

### 🔴 Judge0 running with `privileged: true`

```yaml
judge0_server:
  privileged: true
judge0_workers:
  privileged: true
```

`privileged: true` grants the container full access to the host kernel — equivalent to running as
root on the host with every capability. Judge0 executes arbitrary user-submitted code. A container
escape from a privileged container is trivially achievable with well-known techniques. If Judge0
requires cgroup v1 access, this should be granted via targeted capabilities (`--cap-add SYS_ADMIN`)
and a read-only cgroup mount, not blanket `privileged`.

---

### 🟠 No Content-Security-Policy or additional security headers in nginx

The nginx config adds three security headers:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

Missing entirely:

- `Content-Security-Policy` — no XSS protection
- `Strict-Transport-Security` — no HSTS (and no HTTPS anyway)
- `Permissions-Policy` — no feature policy
- `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`

## Note: Make sure media uploading will work fine

### 🟠 No rate limiting in nginx

There are no `limit_req_zone` or `limit_req` directives anywhere. The `/api/auth` endpoint
(credential login), `/api/v1` (AI endpoints), and even the entire frontend are completely
unprotected from brute force and flood attacks. FastAPI does use `slowapi` for some routes, but this
is a last line of defence — nginx should be the first.

---

### 🟠 FastAPI docs proxied in production nginx config

```nginx
location /api/v1/docs  { proxy_pass http://app:9000; ... }
location /api/v1/redoc { proxy_pass http://app:9000; ... }
```

The comment reads "only available in development mode", but these routes are actively proxied in the
production nginx config. `app.py` disables these endpoints when `development_mode` is False
(returning 404), so they are harmless today — but they are also never cleaned up, and a
misconfiguration of `development_mode` would immediately expose the full API schema in production.

---

### 🟠 CORS configured with `allow_methods=["*"]` and `allow_headers=["*"]`

`app.py` line 51–56 permits all HTTP methods and all headers from any origin matching the regex.
This should enumerate only the verbs and headers actually used by the frontend.

---

### 🟡 Backup container has access to the Docker socket

```yaml
backup:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

Even mounted read-only, the Docker socket can be used to list all containers, inspect environment
variables (which may contain secrets), and read container logs. The Docker socket should never be
mounted unless strictly required.

---

## 3. Docker Image Quality

### 🔴 `bun install --no-frozen-lockfile` in both Dockerfiles

```dockerfile
# Root Dockerfile, line 39
RUN bun install --no-frozen-lockfile

# apps/web/Dockerfile, line 6
RUN bun install --no-frozen-lockfile
```

`--no-frozen-lockfile` explicitly allows bun to modify `bun.lock` during install. This means:

- Builds are **non-deterministic** — different runs may install different package versions.
- Supply-chain attacks can silently slip in dependency upgrades.
- It defeats the entire purpose of committing a lockfile.

**Fix:** Remove the flag entirely. `bun install` respects `bun.lock` by default. If the lockfile is
legitimately out of date, update it locally and commit it — never in CI/CD or Docker.

---

### 🟠 Copying the entire Node.js runtime from another image

```dockerfile
# Root Dockerfile, line 22
COPY --from=node:25-bullseye-slim /usr/local /usr/local
```

This grafts the entire Node.js `/usr/local` (including npm, corepack, yarn, npx, etc.) onto the
Python base image. It is crude and brittle:

- Imports whatever file layout the Node image uses at that timestamp — forward incompatible.
- Copies tools (npm, corepack) that are never used in the image.
- The Python and Node runtimes share `/usr/local/lib` which can cause conflicts.

The correct approach for the monolith pattern (if it is kept) is multi-stage with an explicit
`COPY --from=node /usr/local/bin/node`, `COPY --from=node /usr/local/lib/node_modules` etc.

---

### 🟠 `uv` installed via `pip install uv` with no version pin

```dockerfile
RUN pip install --upgrade pip && pip install uv
```

This fetches the latest `uv` at build time. Pin it: `pip install uv==0.x.y`. The
`apps/api/ Dockerfile` correctly uses `COPY --from=ghcr.io/astral-sh/uv:latest` — but `:latest` is
also a non-deterministic pin. Fix: `COPY --from=ghcr.io/astral-sh/uv:0.7.x`.

---

### 🟠 `NEXT_PUBLIC_*` URLs hardcoded in the root Dockerfile

```dockerfile
ENV NEXT_PUBLIC_PLATFORM_API_URL=https://cs-mooc.tou.edu.kz/api/v1/
ENV NEXT_PUBLIC_PLATFORM_BACKEND_URL=https://cs-mooc.tou.edu.kz/
ENV NEXT_PUBLIC_PLATFORM_DOMAIN=cs-mooc.tou.edu.kz
```

`NEXT_PUBLIC_` variables are baked into the JavaScript bundle at build time. Hard-coding the
production domain makes the image non-reusable in staging or other deployments without a full
rebuild. These should be `ARG` declarations that become `ENV` only during build:

```dockerfile
ARG NEXT_PUBLIC_PLATFORM_API_URL
ARG NEXT_PUBLIC_PLATFORM_BACKEND_URL
ENV NEXT_PUBLIC_PLATFORM_API_URL=$NEXT_PUBLIC_PLATFORM_API_URL
```

---

### 🟡 `supervisord` runs as root

```ini
[supervisord]
user=root
```

Both child processes (Next.js, FastAPI) are spawned under root unless they drop privileges
themselves. Neither does. Running production application processes as root violates the principle of
least privilege. If either service is compromised, the attacker has full root inside the container.

---

### 🟡 Health check only monitors the frontend, not the backend

```dockerfile
HEALTHCHECK CMD curl -fsS http://localhost:8000/health || exit 1
```

Port 8000 is the Next.js frontend. Port 9000 is the FastAPI backend. Docker marks the container
`healthy` as long as Next.js responds, regardless of whether FastAPI is running. Heavy AI endpoints
on port 9000 can be completely down while the container appears healthy to both Docker and nginx's
`depends_on`.

**Fix:** Health check should probe both, or the services should be split into separate containers
with independent health checks.

---

## 4. nginx Configuration Quality

### 🟠 Highly repetitive proxy_set_header blocks (DRY violation)

Every `location` block repeats the same four headers:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

This appears 8 times. Define them once in a shared snippet or at `server` level. Repetition creates
maintenance risk — one forgotten update produces inconsistent header forwarding.

---

### 🟠 `client_max_body_size 500M` applies to all routes

A 500 MB request body limit is applied globally, including to the login endpoint, API queries, and
static file requests. This makes it trivial to exhaust the server's disk and memory with a single
connection. File upload size limits should be scoped to upload-specific locations only.

---

### 🟡 No proxy timeouts configured

Nginx defaults (`proxy_read_timeout 60s`, `proxy_send_timeout 60s`) may be insufficient for
long-running AI/LLM inference endpoints that stream responses. No explicit timeout configuration
exists. For SSE/streaming endpoints this will cause premature disconnections; for synchronous
inference endpoints, 60 s may be too short or wasteful.

---

### 🔵 No `X-Cache-Status` debug header

`proxy_cache_bypass $http_cache_control` is configured but there is no corresponding
`add_header X-Cache-Status $upstream_cache_status;`. This makes it impossible to verify whether
caching is functioning correctly in production without checking nginx logs.

---

## 6. Operational Readiness

### 🟠 No structured log aggregation

Both services write to stdout/stderr (good for Docker), but there is no log aggregation solution, no
log rotation policy, and no alerting. `app_logs` is a volume that persists FastAPI logs, but there
is no rotation configured, so it will grow unboundedly.

---

### 🟡 No resource limits on ChromaDB or Judge0

The `chromadb` service has resource limits but the `judge0_server` and `judge0_workers` have none.
Code execution is the most CPU/memory-intensive workload — unconstrained, a surge of submissions can
starve the database and API containers.

---

### 🟡 No readiness probe distinct from health check

Docker Compose supports only a single `healthcheck`. Both the health check (liveness) and readiness
(is the service ready to serve traffic?) are conflated. A slow startup of FastAPI (which loads LLM
models and ChromaDB connections) can cause nginx to start forwarding traffic before the backend is
ready, resulting in 502 errors.

---

## Summary Table

| #   | Issue                                              | Severity |
| --- | -------------------------------------------------- | -------- |
| 1   | Monolith container (Next.js + FastAPI)             | 🔴       |
| 2   | DB/Redis/ChromaDB/Judge0 ports exposed to internet | 🔴       |
| 3   | No HTTPS/TLS in nginx                              | 🔴       |
| 4   | Weak hardcoded DB credentials                      | 🔴       |
| 5   | Judge0 running with `privileged: true`             | 🔴       |
| 7   | `bun install --no-frozen-lockfile`                 | 🔴       |
| 10  | No rate limiting in nginx                          | 🟠       |
| 11  | No CSP or HSTS headers                             | 🟠       |
| 13  | FastAPI docs proxied in production nginx           | 🟠       |
| 14  | `NEXT_PUBLIC_*` domain hardcoded in Dockerfile     | 🟠       |
| 15  | Grafting `/usr/local` from Node image into Python  | 🟠       |
| 16  | `uv` installed without version pin                 | 🟠       |
| 21  | `supervisord` runs as root                         | 🟡       |
| 22  | Health check ignores FastAPI (port 9000)           | 🟡       |
| 23  | No image digest pinning                            | 🟡       |
| 24  | Repetitive nginx proxy_set_header blocks           | 🟠       |
| 25  | `client_max_body_size 500M` applied globally       | 🟠       |
| 26  | No proxy timeout configuration                     | 🟡       |
| 27  | Docker socket in backup container                  | 🟡       |
| 28  | No structured log aggregation / rotation           | 🟠       |
| 30  | No resource limits on Judge0                       | 🟡       |

---

## Top Priority Fixes (Ordered by Impact / Effort Ratio)

1. **Remove all `ports:` from backing services** — prevents public exposure in minutes.
2. **Switch to real, stable image tags** — prerequisite for everything else working.
3. **Add TLS to nginx** (Let's Encrypt + certbot container) — eliminates credential exposure.
4. **Fix `bun install --no-frozen-lockfile`** — removes supply-chain risk in builds.
5. **Split monolith into separate `web` and `api` containers** — enables independent scaling, proper
   health checks, and correct resource allocation.
6. **Set strong, randomised DB/Redis passwords** and add Redis `requirepass`.
