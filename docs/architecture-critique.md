# Architecture Critique: Ashyq Bilim

> Written: 2026-03-21
> Branch: `feat/analytics-dashboard`
> Scope: Backend (FastAPI/Python), Frontend (Next.js/TypeScript), Infrastructure

---

## TL;DR

The codebase is well-intentioned and has clear domain separation, but it accumulates **layered complexity that slows every layer**: too many caching layers that fight each other, a styling migration frozen mid-way, 72 frontend dependencies that overlap in purpose, and analytics that loads entire datasets into Python memory. The biggest wins are not rewrites — they are _deletions_.

---

## 1. Backend

### 1.1 The AI Service Has Three Caching Layers for One Thing

The AI service caches the LLM/embedding model in **three** different places simultaneously:

```
init.py          → @lru_cache(maxsize=1)  on get_llm() / get_embedding_function()
cache_manager.py → ThreadSafeCache (TTLCache wrapper, 307 LOC)  → AICacheManager
base.py          → LRUCache from cachetools  → _agent_cache
```

`init.py`'s `@lru_cache` is the only necessary one — it returns the same object forever (no TTL needed for a model client). `AICacheManager` then wraps _that_ in a TTL-aware cache on top. This means the model object can expire from `AICacheManager` but remain alive in `lru_cache`, so callers get a cache miss but actually reconstruct nothing — wasted overhead.

**Fix**: Keep `@lru_cache` in `init.py`. Delete `cache_manager.py` (307 LOC). Move agent caching directly into `base.py` with a plain `dict`.

---

### 1.2 `ChromaDBPool` Solves a Problem That Doesn't Exist

`chromadb_pool.py` (232 LOC) implements a connection pool for ChromaDB with `asyncio.Lock`, `threading.Lock`, max-connection management, and a singleton fallback for local mode. But:

- **Local mode** (the default): ChromaDB's `PersistentClient` is already a module-level singleton in the ChromaDB library. A pool of one is not a pool.
- **Remote mode**: ChromaDB's `HttpClient` uses `httpx` with its own connection pooling internally. Wrapping it in another pool adds queue overhead without benefit.
- The pool's `_lock` property creates an `asyncio.Lock` lazily inside a `@property`, which is fragile in multi-loop scenarios (the very thing it claims to avoid).

**Fix**: Delete `chromadb_pool.py`. Hold a single `Chroma` instance (or `chromadb.Client`) as a module-level variable in `base.py`. 232 LOC → 3 LOC.

---

### 1.3 `ThreadSafeCache` Is a 307-LOC Wrapper Around a 3-LOC Import

```python
# cache_manager.py — what it does:
from cachetools import TTLCache
cache = TTLCache(maxsize=100, ttl=3600)
value = cache.get(key)          # with a Lock()
cache[key] = value
```

The file adds: docstrings on every method, `_hit_count`/`_miss_count` metrics that are never exposed anywhere, a `cached_property` for a lazy async lock, and a `get_or_set` helper. None of these are used outside this file.

**Fix**: Replace with direct `TTLCache` usage at call sites, or a 10-line utility function. Remove `cache_manager.py`.

---

### 1.4 `WindowedChatMessageHistory` Is a Slice in 80 Lines

The class implements `BaseChatMessageHistory` (abstract base, 15 required methods) just to return `messages[-window_size:]`. The full history lives in Redis anyway. The window is applied _before_ messages are read, not at storage.

```python
# What it actually does:
windowed = full_history[-window_size:]
```

**Fix**: Apply the slice at the call site in `get_chat_session_history()`. Delete the class.

---

### 1.5 Analytics Loads the Entire Database into Python Memory

`services/analytics/queries.py` builds an `AnalyticsContext` dataclass that fetches:

```python
courses_by_id, activities_by_id, chapters_by_id,
course_chapters, chapter_activities, trail_runs, trail_steps,
certificates, assignments, assignment_submissions,
exams, exam_attempts, quiz_attempts, quiz_question_stats,
code_submissions, ...
```

...all at once, joining 15+ tables into Python dicts and lists, then passing the whole structure to 8 service modules that each filter it. For a platform with 100+ students and 20 courses, this is fine. At 1 000 students it serialises several MB per request. At 10 000 it becomes unusable.

The correct approach is SQL aggregation: let Postgres `GROUP BY`, `FILTER`, and `COUNT` — it has indexes, the Python process does not.

**Fix**: Replace `AnalyticsContext` (Python-side data loading) with targeted SQL queries per analytics module. Use `func.count()`, `func.avg()`, `FILTER (WHERE ...)` in SQLAlchemy. Each analytics function should issue 1–3 queries, not load everything and iterate.

---

### 1.6 The Roles Router Is 446 LOC of CRUD That Should Be 50

`routers/roles.py` has endpoints for listing, creating, assigning, removing, and auditing role permissions. Most of the code is boilerplate `SELECT` / `INSERT` / `DELETE` with manual permission checks inlined. The same RBAC logic is duplicated across `security/rbac.py` (560 LOC) and `routers/rbac.py` (separate file).

**Fix**: Extract a `RoleRepository` class. Use a `PermissionChecker` dependency more consistently instead of inline `if not user.has_permission(...)` blocks.

---

### 1.7 10 Custom Exception Types for One Service

`services/ai/exceptions.py` defines:
`AIServiceError`, `AIProcessingError`, `AITimeoutError`, `ChatSessionError`,
`EmbeddingError`, `VectorStoreError`, `RateLimitError`, `ModelNotFoundError`,
`ContextLengthError`, `InvalidRequestError`.

In practice, callers catch `AIServiceError` (the base) or `Exception`. The granular types add import complexity without being handled differently anywhere in the codebase (checked via grep — no `except EmbeddingError` or `except VectorStoreError` calls exist outside `exceptions.py` itself).

**Fix**: Keep `AIServiceError` as the single custom type. Let the message carry the detail.

---

### 1.8 Only 1 Alembic Migration for 52 Tables

The `migrations/versions/` directory has a single file: dropping an old org table. This means all 52 tables are either created by `SQLModel.metadata.create_all()` on startup or were applied manually. There is no reproducible migration history.

This is a ticking bomb: any schema change made outside Alembic is invisible to new deployments. `create_all()` silently skips existing tables, so column additions and index changes are never applied to production.

**Fix**: Generate initial migrations for all current tables (`alembic revision --autogenerate`). Enforce the rule: every schema change gets a migration file.

---

## 2. Frontend

### 2.1 TipTap Imported as 20 Separate npm Packages

```json
"@tiptap/extension-blockquote": "3.20.4",
"@tiptap/extension-bold": "3.20.4",
"@tiptap/extension-code": "3.20.4",
"@tiptap/extension-code-block": "3.20.4",
"@tiptap/extension-code-block-lowlight": "3.20.4",
"@tiptap/extension-document": "3.20.4",
...
"@tiptap/starter-kit": "3.20.4"  ← this already includes most of the above
```

`@tiptap/starter-kit` bundles bold, italic, strike, code, blockquote, heading, list, and more. The individual packages are listed _in addition_ to starter-kit. This means both are resolved, bundled, and shipped. It bloats `node_modules`, slows installs, and risks version drift between the kit and the individual overrides.

**Fix**: Use `@tiptap/starter-kit` only. Add individual extensions only for features starter-kit doesn't include (table, youtube, monaco, etc.).

---

### 2.2 Overlapping Dependencies

| Pair | Overlap |
|------|---------|
| `highlight.js` + `lowlight` | `lowlight` _is_ highlight.js wrapped for ProseMirror. Both ship the same language grammars. |
| `marked` + TipTap | TipTap has its own markdown parsing. `marked` is loaded separately for other contexts. |
| `motion` + `tw-animate-css` | Both provide CSS animations. `motion` (Framer Motion) is the heavy one. `tw-animate-css` adds minimal Tailwind utilities. Keep one strategy. |
| `clsx` + `tailwind-merge` | Already wrapped in a `cn()` utility — the raw `clsx` import can be removed from direct call sites. |

These overlaps add ~150KB to the client bundle and complicate upgrade paths.

**Fix**: Remove `highlight.js` (use `lowlight` only). Consolidate animation strategy. Audit `marked` usage — likely replaceable with TipTap's built-in parser.

---

### 2.3 Two Styling Systems Stuck Mid-Migration

The codebase has been "migrating" from styled-components to Tailwind v4 for some time. Ten components still use styled-components, including `Editor.tsx`, `DynamicCanva.tsx`, and `TableOfContents.tsx`. The migration is blocked on components with dynamic props and child selectors — legitimate reasons — but the hybrid state has real costs:

- Two different CSS runtimes loaded in every page
- styled-components injects a `<style>` tag per component tree on every SSR render
- Tailwind's JIT purges unused classes; styled-components bypasses this
- Developer has to context-switch between two mental models in the same file

**Fix options**:
1. **Finish the migration**: Replace `${(props) => ...}` styled-component patterns with `cva()` (class-variance-authority, already in deps) + Tailwind variants. This handles dynamic props cleanly.
2. **Accept the hybrid permanently**: Document which components use which system and stop mid-migration. At least it's intentional.

Option 1 is better. `cva` was added for exactly this purpose.

---

### 2.4 `next-auth` Beta in Production

```json
"next-auth": "5.0.0-beta.30"
```

`next-auth` v5 has been in beta for over a year with breaking changes between beta versions. The auth flow (Google OAuth, JWT, session management) is one of the most security-critical parts of the app. Running beta authentication middleware in production is an unnecessary risk.

The auth.ts file is 431 LOC. Much of that complexity exists because of the beta API surface being unstable.

**Fix**: Either pin to a stable v4 release (well-documented, production-proven) or upgrade to v5 stable once released. Do not stay on a moving beta target.

---

### 2.5 Giant Contexts Cause Unnecessary Re-renders

`GamificationContext.tsx` (380 LOC) and `CourseContext.tsx` (286 LOC) hold large state objects. Any state change — even a toast animation flag — re-renders every consumer of that context.

```tsx
// Every component that calls useGamification() re-renders when
// isLoading, profile, dashboard, OR leaderboard changes.
const { profile, isLoading } = useGamification();
```

For course pages with 20+ components all subscribed to `CourseContext`, a single activity completion triggers a cascade re-render.

**Fix**: Split contexts into smaller slices (data vs. actions vs. UI state). Or use `useMemo`/`useCallback` aggressively at the provider level. For heavier state, consider Zustand — it has selector support so components only re-render when their specific slice changes.

---

### 2.6 `useActivityChat` and `useTestGuard` Mix Too Many Concerns

`useTestGuard.ts` (286 LOC) handles: timer countdown, tab-switch detection, copy-paste blocking, fullscreen enforcement, network-disconnect detection, and answer auto-save. These are six different concerns in one hook, making it hard to test, hard to debug, and impossible to reuse any individual piece.

`useActivityChat.ts` (284 LOC) handles: SSE streaming, local buffer state, context dispatch, abort controller lifecycle, session management, and error recovery.

**Fix**: Each hook should do one thing. Extract `useExamTimer`, `useProctoring`, `useAutoSave` from `useTestGuard`. Extract `useSSEStream`, `useChatSession` from `useActivityChat`.

---

### 2.7 Marginal Dependencies That Should Be Deleted

| Package | What it does | Replace with |
|---------|-------------|--------------|
| `nextjs-toploader` | Progress bar on navigation | Next.js 14+ has built-in loading UI |
| `currency-codes` | ISO 4217 currency list | A 3KB JSON file in `/lib` |
| `react-confetti` | Confetti animation | CSS keyframes or one canvas component |
| `nuqs` | URL search param state | `useSearchParams` + `useRouter` (built-in) |
| `nanoid` | ID generation | `crypto.randomUUID()` (Web API, built-in) |

Five dependencies removed, zero functionality lost.

---

## 3. Infrastructure

### 3.1 Two Processes in One Container

The `Dockerfile` uses `supervisord` to run the FastAPI backend (port 9000) and Next.js frontend (port 8000) in a single container. Both share a 2 CPU / 2 GB resource envelope.

This creates real problems:
- A memory spike in the Python process (e.g. analytics loading a large dataset) starves the Node.js process
- Crash isolation is gone: if supervisord itself dies, both services vanish
- Deployment requires rebuilding and restarting both services for any change to either
- Horizontal scaling is all-or-nothing: you can't scale the API without scaling the frontend

The only benefit is simpler Docker Compose configuration.

**Fix**: Separate into two services (`app-api` and `app-web`) in `docker-compose.yml`. They can still share the same Docker network and communicate via service name. Build time increases slightly (two builds) but deploy flexibility improves dramatically.

---

### 3.2 `NEXT_PUBLIC_*` Variables Baked Into the Build

```dockerfile
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MEDIA_URL
```

These are baked into the Next.js bundle at build time. Changing `NEXT_PUBLIC_API_URL` for a staging vs. production deploy requires a full rebuild. This is the opposite of the 12-factor app principle.

**Fix**: Use Next.js `publicRuntimeConfig` or move to a runtime config endpoint (`/api/config`) that the client fetches once. This allows the same Docker image to run in staging and production with different config.

---

### 3.3 Postgres Port Exposed on the Host

```yaml
db:
  ports:
    - "5432:5432"  # exposed to the host network
```

The database port is mapped to the host, meaning it is reachable from outside the Docker network (and potentially outside the machine if firewall rules are permissive). The API service reaches Postgres via the Docker network — host exposure is unnecessary.

**Fix**: Remove `ports` from the `db` service. Keep `expose: ["5432"]` if internal-only access is needed for documentation.

---

## 4. Cross-Cutting Issues

### 4.1 Zero Frontend Tests

There are 22 backend test files. There are zero frontend test files (no Playwright, no Vitest, no Jest).

The highest-risk user flows — login, course enrollment, exam taking, payment — have no automated coverage. Any regression in these flows is caught by a user in production.

**Fix order of priority**:
1. Playwright E2E: login → view course → complete activity (smoke test)
2. Vitest unit tests for the three largest hooks (`useTestGuard`, `useActivityChat`, `useExamPersistence`)
3. Component tests for form validation (auth flows)

---

### 4.2 Duplicate API Client Pattern

The `/services/` directory has 40 files. Most follow the same shape:

```typescript
// services/courses/courses.ts
export async function getCourse(id: string) {
  return fetchWithAuth(`/api/v1/courses/${id}`)
}

// services/users/users.ts
export async function getUser(id: string) {
  return fetchWithAuth(`/api/v1/users/${id}`)
}
```

These are thin wrappers around `fetch`. There's value in organizing them by domain, but many of the files are 3–10 lines of identical patterns. The typing is duplicated across service files and API response types.

**Fix**: Generate the API client from the FastAPI OpenAPI schema using `openapi-typescript` + `openapi-fetch`. This gives type-safe client code for free, eliminates 40 hand-maintained files, and keeps types in sync with the backend automatically.

---

### 4.3 Config File Is 481 LOC of Pydantic Nesting

`config/config.py` has 7 nested config classes (`GeneralConfig`, `SecurityConfig`, `ChromaDBConfig`, `DatabaseConfig`, etc.) assembled into one `Settings` class. Most validators do string normalization (`strip`, `lower`, default substitution) that Pydantic already handles with `Field(default=...)` and `@field_validator`.

Some validators are surprisingly complex for config:
```python
def _normalize_cookie_domain(cls, v):
    # Rejects IPs, localhost, strips port numbers...
```

This belongs in a startup health-check, not in a config validator that runs on every import.

**Fix**: Flatten into 2–3 config classes (App, Database, AI). Move complex validation to a `validate_config()` function called once at startup. Use Pydantic's `model_config = ConfigDict(env_prefix="PLATFORM_")` more aggressively to reduce boilerplate.

---

## 5. Summary Table

| Area | Issue | Effort to Fix | Impact |
|------|-------|--------------|--------|
| AI service | 3 overlapping caching layers | Low | Medium — less memory, clearer code |
| AI service | ChromaDB pool for a problem that doesn't exist | Low | Medium — 232 LOC deleted |
| AI service | `ThreadSafeCache` wrapping cachetools | Low | Low — 307 LOC deleted |
| AI service | 10 custom exceptions, 1 is used | Low | Low — less noise |
| Analytics | Loads full DB into Python memory | Medium | High — will not scale |
| Migrations | 1 migration for 52 tables | Medium | High — schema drift risk |
| Frontend | TipTap as 20 packages + starter-kit | Low | Medium — bundle size, install speed |
| Frontend | Overlapping deps (highlight.js, marked, motion) | Low | Medium — ~150KB bundle reduction |
| Frontend | `next-auth` beta in production | Medium | High — security risk |
| Frontend | Giant contexts → cascade re-renders | Medium | High — perceived performance |
| Frontend | Two styling systems mid-migration | Medium | Medium — DX and bundle |
| Frontend | 5 marginal/replaceable dependencies | Low | Low — simpler dependency graph |
| Frontend | 0 tests | High | High — regression risk |
| Frontend | 40 hand-written API clients | Medium | Medium — auto-generate from OpenAPI |
| Infrastructure | Two processes in one container | Medium | Medium — reliability, scaling |
| Infrastructure | Postgres port exposed to host | Low | High — security |
| Infrastructure | Build-time `NEXT_PUBLIC_*` | Medium | Medium — deployment flexibility |
| Config | 481 LOC Pydantic nesting | Low | Low — readability |

---

## What to Do First

**This week (low effort, meaningful payoff)**:
1. Remove `chromadb_pool.py` and `cache_manager.py` — delete ~540 LOC of infrastructure for a problem that doesn't exist
2. Remove Postgres host port mapping — one line, security fix
3. Deduplicate TipTap packages in `package.json` — faster installs, smaller bundle
4. Remove 5 marginal frontend dependencies

**This month (medium effort, high payoff)**:
5. Replace `AnalyticsContext` Python-side loading with SQL aggregations — this is the most impactful performance fix
6. Pin or upgrade `next-auth` off the beta track
7. Generate API client from OpenAPI schema — delete 40 service files
8. Write Playwright smoke tests for critical flows

**Ongoing**:
9. Generate and maintain Alembic migrations for every schema change
10. Finish styled-components → Tailwind migration using `cva()`
11. Split giant contexts and hooks into single-responsibility units
