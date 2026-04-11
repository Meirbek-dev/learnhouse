# Backend Rewrite Plan — April 2026

> Stack: FastAPI 0.135, psycopg 3.3 (binary+pool), SQLModel 0.0.38, SQLAlchemy 2.0,
> pydantic 2.12, pydantic-settings 2.13, redis-py 7.4, logfire 4.32,
> orjson 3.11, pgvector 0.4.2, pydantic-ai-slim 1.80, PostgreSQL 18.

---

## Part 1 — Critical Analysis

### 1.1 DB Engine — Global Mutable Singleton

**File:** `src/infra/db/engine.py`

```python
_engine: Engine | None = None          # module-level mutable
_session_factory: sessionmaker | None = None
```

**Problems:**

- Module-level mutations are not thread-safe in the general case; initialization is guarded
  only by a `None` check, not a lock.
- `initialize_database()` silently no-ops if called twice, masking misconfiguration in tests.
- `dispose_database()` sets both to `None` without acquiring any lock — a concurrent request
  landing after dispose but before reinit will call `get_database_engine()` and raise a
  `RuntimeError("Database runtime has not been initialized")` instead of returning a 503.
- Uses **synchronous SQLAlchemy** (`sqlmodel.Session`, `sqlmodel.create_engine`). Every DB
  call from async route handlers must be wrapped in `asyncio.to_thread(...)`, which:
  - Consumes a thread from the default thread pool (capped at ~32 threads by asyncio default).
  - Adds per-call overhead (~0.05–0.2 ms thread wakeup).
  - Cannot participate in async cancellation or timeouts.
- `TESTING` env var bakes SQLite routing into production code; this logic belongs in test
  fixtures only.
- `pool_use_lifo=True` is a LIFO strategy fine for low-concurrency, but its interaction with
  `pool_pre_ping` can cause unexpected latency spikes under load burst: a newly-returned
  connection goes to the top of the stack, and every first-use triggers a ping round-trip even
  for connections returned seconds ago.

**Root fix:** Migrate to `create_async_engine` + `async_sessionmaker` + `AsyncSession`
(see Phase 2).

---

### 1.2 `strict_base_model.py` — Conditional Class Identity

**File:** `src/db/strict_base_model.py`

```python
if is_dev_mode:
    class PydanticStrictBaseModel(TruePydanticStrictBaseModel):
        pass
else:
    class PydanticStrictBaseModel(FalsePydanticStrictBaseModel):   # type: ignore[no-redef]
        pass
```

**Problems:**

- **Type system violation.** `PydanticStrictBaseModel` has a different MRO in dev vs prod.
  mypy / pyright see `no-redef` errors suppressed by ignore comments; the type of the symbol
  is indeterminate. Subclasses inherit incompatible MROs depending on the environment, which
  means a model passing `isinstance(obj, PydanticStrictBaseModel)` in dev could fail in prod
  if tested against the opposite branch's class object.
- **`validate_call=True` in `model_config` is not a valid Pydantic v2 key.** Pydantic v2
  silently drops unknown config keys (as of 2.x the validation was tightened but legacy keys
  still slip through). The intent (wrapping all method calls with input validation) is not
  actually achieved.
- **`slots=True` with SQLModel table models.** SQLModel's `table=True` models rely on
  SQLAlchemy's instrumented descriptor machinery, which is incompatible with `__slots__`.
  This is currently masked because `SQLModelStrictBaseModel` (not `PydanticStrictBaseModel`)
  is used for table models, but the `slots=True` in `TruePydanticStrictBaseModel` propagates
  to pure read/response models where it can cause problems with `@property` and `@validator`
  inheritance.
- **Environment-at-import-time via raw `os.environ`** (`_parse_env_bool`) cannot see
  `.env` file values that pydantic-settings reads at settings instantiation time.
  If the container sets `PLATFORM_DEVELOPMENT_MODE` before Python starts this works;
  but if `.env` is the primary source and the env var is absent from the real environment,
  all models get the production (non-strict) config even in dev.

**Root fix:** Single concrete class with a config dict built once from `os.environ` (see Phase 1).

---

### 1.3 Dual Model Registration

**Files:** `src/db/model_registry.py` (explicit imports) + `migrations/env.py` (`os.walk`)

Two completely separate systems discover ORM models:

- `model_registry.py` — hand-maintained list of 35 `import src.db.*` statements.
  Called at app startup via `initialize_database`.
- `migrations/env.py` — recursive `os.walk("src/db/")` importing every `.py` file.
  Called only during `alembic` CLI invocations.

**Problems:**

- Adding a new model file satisfies the migrations autogenerate (walk finds it) but autogenerate
  creates the migration while the app's runtime model registry is stale.
- Deleting or moving a file silently breaks the explicit list without any import error until
  the module is actually accessed.
- No test enforces that both lists are in sync.

**Root fix:** Single canonical import list in `model_registry.py`, call it from both
`initialize_database` and `migrations/env.py` (see Phase 1).

---

### 1.4 Config Layer — Fragmented BaseSettings

**File:** `config/config.py`

Each section (`GeneralConfig`, `SecurityConfig`, `AIConfig`, `HostingConfig`, etc.) extends
`PlatformSectionSettings(BaseSettings)`. This means:

- Each section class re-reads the `.env` file on instantiation.
- Direct instantiation of any section (e.g., `SecurityConfig()` in a test) reads env
  independently without the aggregate cache.
- `_INSECURE_DEFAULT_SECRETS = {"", "changeme", "secret"}` is defined at module level but
  **never referenced** anywhere in the codebase. Intended secret-strength validation was never
  implemented.
- `AppSettings` uses `@lru_cache(maxsize=1)` wrapping a constructor call — not wrapping the
  class itself — which means the cache key is the no-arg call. This works but means
  `reload_platform_config_cache()` (used by tests) must clear the lru_cache explicitly.
- pydantic-settings 2.13 has native `env_nested_delimiter` support that makes section
  composition cleaner and removes the need for sections to be `BaseSettings` subclasses.

---

### 1.5 `get_db_session` — Dual Lookup with Silent Fallback

**File:** `src/infra/db/session.py`

```python
def get_db_session(request: Request) -> Iterator[Session]:
    session_factory = getattr(request.app.state, "session_factory", None)
    session = session_factory() if session_factory is not None else open_db_session()
```

The `else open_db_session()` fallback is reachable only if `request.app.state.session_factory`
was never set — i.e., lifespan never ran or the factory was not stored. In a normally-started
application this branch is dead code. Its presence:

- Masks lifespan startup bugs: a missing session factory silently falls back to the
  module-level singleton instead of immediately crashing.
- Creates a invisible behavior difference between requests served before lifespan completes
  (e.g., health check probes during slow startup) and steady-state requests.

---

### 1.6 Auth Sessions — Fire-and-Forget Audit Tasks

**File:** `src/services/auth/sessions.py`

```python
asyncio.create_task(asyncio.to_thread(_audit_create_sync, ...))
```

**Problems:**

- `asyncio.create_task(...)` requires a **running event loop**. In tests or CLI contexts
  calling session functions from sync code, this raises `RuntimeError: no running event loop`.
- The task is not stored anywhere. If the event loop drains before the task completes
  (e.g., a test's `asyncio.run()` scope ends), the audit write is silently lost.
- `asyncio.to_thread` for DB work re-enters the same "sync DB behind thread pool" anti-pattern
  the rest of the app should move away from.
- No backpressure: in a burst scenario, many untracked tasks are created with no concurrency
  limit.

---

### 1.7 Module-Level Redis Singletons

**File:** `src/services/cache/redis_client.py`

```python
_client: redis.Redis | None = None
_async_client: aioredis.Redis | None = None
```

Both clients are lazily initialized on first call, cached in module globals, and never
explicitly closed. Problems:

- **Not injectable.** Routes/services call `get_async_redis_client()` which returns the
  module-level singleton. Mocking in tests requires `unittest.mock.patch` at the module level
  rather than dependency injection.
- **No lifecycle management.** The async client accumulates connection pool entries that are
  never closed unless the process exits.
- **Not stored on `app.state`**, so there is no single canonical place for the lifespan hook
  to `await redis_client.aclose()` during shutdown.

---

### 1.8 RequestValidationError Handler Drops Field Detail

**File:** `src/app/errors.py`

```python
@app.exception_handler(RequestValidationError)
def request_validation_exception_handler(request, exc):
    return JSONResponse(status_code=422, content={
        "error_code": "VALIDATION_ERROR",
        "message": "Request validation failed",  # all field errors discarded
    })
```

Pydantic v2 `RequestValidationError` carries structured field-level error detail
(`exc.errors()`). The current handler discards it entirely. API consumers (including the
frontend) receive no actionable information about which field failed or why.

---

### 1.9 `asyncio.to_thread` for AI Vector TTL Sweep

**File:** `src/app/lifespan.py`

```python
removed = await asyncio.to_thread(delete_expired_chunks, retention_seconds)
```

`delete_expired_chunks` is a sync DB function wrapped in a thread. This re-enters the
synchronous DB singleton, which is already problematic (see 1.1). The background task also:

- Has a fixed 1-hour sleep interval with no jitter (all instances in a cluster would
  sweep simultaneously).
- Is not managed by a `TaskGroup`, so cancellation errors are not propagated to the lifespan
  context manager.

---

### 1.10 `orjson` Not Used for HTTP Responses

Despite `orjson` being a dependency, FastAPI is not configured to use `ORJSONResponse` as
the default response class. All responses serialize via Python's stdlib `json` module
(which is ~3–5× slower for large payloads). The `orjson` import in the redis helper is the
only usage.

---

### 1.11 pgvector `document_chunks` Excluded from Migrations

```python
_AUTOGENERATE_EXCLUDED_TABLES = {
    ...,
    "document_chunks",
    ...
}
```

Schema changes to `document_chunks` (e.g., adding an HNSW index, changing vector dimensions)
are never detected by `alembic revision --autogenerate`. These must always be hand-written,
which creates drift risk and removes the safety net for column type changes.

---

### 1.12 No Correlation ID / Request Tracing

No middleware injects a `X-Request-ID` header into responses. While logfire provides
span-level tracing, individual HTTP errors reported by clients cannot be correlated to a
specific trace without a header echoed back.

---

### 1.13 Missing Graceful Drain on Shutdown

The lifespan cleanup cancels the sweep task and disposes the DB engine immediately. In-flight
requests that are still processing a DB transaction when the engine is disposed will receive
`InterfaceError` or `OperationalError` rather than completing normally. There is no wait-for-
connections-idle step before disposal.

---

## Part 2 — Rewrite Plan

### Phase 1 — Foundation Fixes (Non-Breaking)

**Goal:** Eliminate the most dangerous issues without touching module boundaries.

#### 1A. Unify `strict_base_model.py` — Single Concrete Class

Replace the conditional class pattern with a single class whose `model_config` is built
from a runtime dict:

```python
# src/db/strict_base_model.py
import os
from pydantic import BaseModel, ConfigDict
from sqlmodel import SQLModel

def _parse_env_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}

_dev = _parse_env_bool(os.environ.get("PLATFORM_DEVELOPMENT_MODE"))

_PYDANTIC_CONFIG = ConfigDict(
    compiled=True,
    use_enum_values=True,
    str_strip_whitespace=True,
    # Extra strictness only in dev — zero runtime cost difference in prod
    # because compiled=True applies in both modes.
    strict=_dev,
    validate_assignment=_dev,
    validate_default=_dev,
    validate_return=_dev,
    validation_error_cause=_dev,
    ser_json_bytes="base64",
    regex_engine="rust-regex",
)

_SQLMODEL_CONFIG = ConfigDict(
    compiled=True,
    use_enum_values=True,
    str_strip_whitespace=True,
    strict=_dev,
    validate_assignment=_dev,
    validate_default=_dev,
)

class PydanticStrictBaseModel(BaseModel):
    model_config = _PYDANTIC_CONFIG

class SQLModelStrictBaseModel(SQLModel):
    model_config = _SQLMODEL_CONFIG

SQLModelDefaultBase = SQLModelStrictBaseModel
```

- Removes `# type: ignore[no-redef]` suppressions.
- Single class identity — `isinstance` checks and type narrowing work correctly in all envs.
- Drops the bogus `validate_call=True` config key.
- Drops `slots=True` (incompatible with SQLModel instrumentation).

#### 1B. Unify Model Registration

Remove `os.walk` from `migrations/env.py`. Call `model_registry.import_orm_models()` there
instead:

```python
# migrations/env.py  — replace the os.walk block with:
from src.db.model_registry import import_orm_models
import_orm_models()
target_metadata = SQLModel.metadata
```

Add a CI test that imports `model_registry` and asserts `SQLModel.metadata.tables` contains
every expected table. This test will fail immediately if a file is added without updating
the registry.

#### 1C. Fix `RequestValidationError` Handler

```python
@app.exception_handler(RequestValidationError)
def request_validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "detail": exc.errors(include_url=False),  # structured per-field info
        },
    )
```

#### 1D. Add Correlation ID Middleware

```python
# src/app/middleware.py
import uuid

@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = req_id
    return response
```

Optionally bind to logfire span:

```python
with logfire.span("http_request", request_id=req_id):
    response = await call_next(request)
```

#### 1E. Implement `_INSECURE_DEFAULT_SECRETS` or Delete It

Either implement the validation in `SecurityConfig`:

```python
@field_validator("auth_ed25519_private_key", "auth_ed25519_public_key", mode="after")
@classmethod
def reject_weak_secrets(cls, v: str | None) -> str | None:
    if v and v.strip().lower() in _INSECURE_DEFAULT_SECRETS:
        raise ValueError("Insecure default secret detected; regenerate the key pair.")
    return v
```

Or delete the dead constant.

#### 1F. Fix `get_db_session` — Remove Silent Fallback

```python
def get_db_session(request: Request) -> Iterator[Session]:
    session_factory = request.app.state.session_factory  # AttributeError = bug, not fallback
    session = session_factory()
    try:
        yield session
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        logger.exception("Database session error")
        session.rollback()
        raise
    finally:
        session.close()
```

If `request.app.state.session_factory` is missing, an `AttributeError` surfaces immediately
and clearly, rather than silently routing to the module-level singleton.

#### 1G. Default `ORJSONResponse`

```python
# src/app/factory.py
from fastapi.responses import ORJSONResponse

app = FastAPI(
    ...
    default_response_class=ORJSONResponse,
)
```

All `JSONResponse(content=...)` calls in route handlers and exception handlers should be
replaced with `ORJSONResponse(content=...)` for consistency.

---

### Phase 2 — Async Database Migration

**Goal:** Replace the sync SQLAlchemy engine with a fully async stack.
`sqlmodel.ext.asyncio.session.AsyncSession` wraps SQLAlchemy's `AsyncSession` and adds
`.exec()` / `.scalars()` convenience methods, so existing `session.exec(select(...))` call
sites change minimally.

#### 2A. Engine & Session Factory

```python
# src/infra/db/engine.py
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlmodel.ext.asyncio.session import AsyncSession
import orjson

_async_engine: AsyncEngine | None = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def initialize_database(settings: AppSettings) -> None:
    global _async_engine, _async_session_factory
    if _async_engine is not None:
        return

    import_orm_models()

    # psycopg3 native async driver — no thread wrapping needed
    _async_engine = create_async_engine(
        settings.database_config.sql_connection_string,  # postgresql+psycopg://...
        echo=False,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_reset_on_return="rollback",
        # orjson for JSON column serialization (2-3× stdlib json)
        json_serializer=lambda v: orjson.dumps(v).decode(),
        json_deserializer=orjson.loads,
    )

    _async_session_factory = async_sessionmaker(
        _async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
```

Note: psycopg 3.3 DSN scheme changes from `postgresql` to `postgresql+psycopg` for async.
Existing `PLATFORM_SQL_CONNECTION_STRING` values need a scheme upgrade (or an auto-fix in
the settings validator):

```python
# config/config.py — DatabaseConfig
@field_validator("sql_connection_string", mode="before")
@classmethod
def ensure_psycopg3_async_scheme(cls, v: str) -> str:
    """Rewrite legacy postgresql:// or postgresql+psycopg2:// to postgresql+psycopg://"""
    for old in ("postgresql+psycopg2://", "postgresql://", "postgres://"):
        if v.startswith(old):
            return "postgresql+psycopg://" + v[len(old):]
    return v
```

#### 2B. Session Dependency

```python
# src/infra/db/session.py
from collections.abc import AsyncIterator
from fastapi import Request
from sqlmodel.ext.asyncio.session import AsyncSession

async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    factory = request.app.state.async_session_factory
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

# Type alias for injection
DBSession = Annotated[AsyncSession, Depends(get_db_session)]
```

#### 2C. `session_scope` for Non-Request Code (CLI, Tests)

```python
@contextlib.asynccontextmanager
async def async_session_scope() -> AsyncIterator[AsyncSession]:
    factory = get_async_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

The sync `session_scope` can be kept temporarily for CLI commands (`cli.py`) that use
`typer` (sync) — wrap them with `asyncio.run(async_session_scope())` at the typer command
level.

#### 2D. Service Layer Call Sites

Existing call patterns translate directly:

```python
# Before (sync)
user = db_session.exec(select(User).where(User.id == user_id)).first()

# After (async — identical syntax thanks to AsyncSession.exec())
user = (await db_session.exec(select(User).where(User.id == user_id))).first()
```

All service functions accepting `db_session: Session` become `async def` accepting
`db_session: AsyncSession`. The `asyncio.to_thread(...)` wrappers in auth.py and sessions.py
are removed entirely.

#### 2E. Lifespan — Async Engine Lifecycle

```python
# src/app/lifespan.py
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging(settings)
    ensure_runtime_directories()
    initialize_database(settings)

    engine = get_async_database_engine()
    session_factory = get_async_session_factory()
    redis = await build_redis_pool(settings)        # Phase 3

    app.state.settings = settings
    app.state.async_engine = engine
    app.state.async_session_factory = session_factory
    app.state.redis = redis

    configure_observability(app, settings, engine.sync_engine)  # logfire needs sync engine ref

    async with asyncio.TaskGroup() as tg:           # structured concurrency
        sweep_task = tg.create_task(
            _ttl_sweep_loop(settings.ai_config.collection_retention),
            name="vector-ttl-sweep",
        )
        yield                                       # app serves requests
        sweep_task.cancel()

    await redis.aclose()
    await engine.dispose()
```

`asyncio.TaskGroup` (Python 3.11+) provides structured concurrency: if the sweep task
crashes with an unhandled exception, the `ExceptionGroup` propagates to the lifespan and
surfaces in logs rather than being silently swallowed.

#### 2F. Alembic Async Migrations

```python
# migrations/env.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

def run_migrations_online() -> None:
    asyncio.run(_run_async_migrations())

async def _run_async_migrations() -> None:
    connectable = create_async_engine(database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()

def _do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=compare_type,
    )
    with context.begin_transaction():
        context.run_migrations()
```

---

### Phase 3 — Redis Lifecycle & Dependency Injection

#### 3A. Move Redis to `app.state`

```python
# src/infra/redis.py  (new file)
from redis.asyncio import Redis
from src.infra.settings import AppSettings

async def build_redis_pool(settings: AppSettings) -> Redis:
    return Redis.from_url(
        settings.redis_config.url,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=3,
        retry_on_timeout=True,
        max_connections=50,
    )

async def get_redis(request: Request) -> Redis:
    return request.app.state.redis

RedisClient = Annotated[Redis, Depends(get_redis)]
```

Remove `_client` / `_async_client` module-level singletons from `redis_client.py`.

#### 3B. Auth Session Audit — Structured Background Tasks

Replace `asyncio.create_task(asyncio.to_thread(...))` with `BackgroundTasks` which FastAPI
manages correctly:

```python
# In route handlers:
async def login(..., background_tasks: BackgroundTasks, db: DBSession):
    ...
    background_tasks.add_task(
        write_audit_event_async,
        db_session=None,   # audit writes open their own session
        event_type="login",
        ...
    )
```

`write_audit_event_async` opens an `async_session_scope()` internally, performs the insert,
and returns. FastAPI's `BackgroundTasks` runs these after the response is sent, within the
same request lifecycle — no orphaned tasks.

---

### Phase 4 — Settings Modernisation

**Goal:** Replace multiple `BaseSettings` subclasses with one top-level `AppSettings`.

```python
# config/config.py — new structure
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

# Inner section models: plain BaseModel, NOT BaseSettings
class GeneralConfig(BaseModel):
    development_mode: bool = False
    logfire_enabled: bool = False
    timezone: str = "UTC"

class DatabaseConfig(BaseModel):
    sql_connection_string: str

class RedisConfig(BaseModel):
    url: str

# ... other section models ...

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",      # PLATFORM__GENERAL__DEVELOPMENT_MODE=true
        case_sensitive=False,
        env_ignore_empty=True,
        extra="ignore",
        populate_by_name=True,
    )
    general: GeneralConfig = GeneralConfig()
    database: DatabaseConfig
    redis: RedisConfig
    security: SecurityConfig
    hosting: HostingConfig
    ai: AIConfig
    mail: MailingConfig
    payments: PaymentsConfig
    google_oauth: GoogleOAuthConfig
    judge0: Judge0Config
    bootstrap: BootstrapConfig

@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()
```

**Migration path for env vars:** Existing `PLATFORM_DEVELOPMENT_MODE` → `PLATFORM__GENERAL__DEVELOPMENT_MODE`.
Add a validator in `AppSettings` that reads legacy flat keys and maps them during a
transition period:

```python
@model_validator(mode="before")
@classmethod
def migrate_legacy_env_keys(cls, data: dict) -> dict:
    """Accept legacy PLATFORM_* flat keys alongside new PLATFORM__*__* nested keys."""
    _LEGACY_MAP = {
        "PLATFORM_DEVELOPMENT_MODE": ("general", "development_mode"),
        "PLATFORM_SQL_CONNECTION_STRING": ("database", "sql_connection_string"),
        # ... full mapping
    }
    for legacy_key, (section, field) in _LEGACY_MAP.items():
        if legacy_key in data and section not in data:
            data.setdefault(section, {})[field] = data.pop(legacy_key)
    return data
```

This allows a zero-downtime migration of `.env` files.

---

### Phase 5 — Repository Pattern (Async)

**Goal:** Consistent data access layer across all domains. All 35+ models should have
a thin repository that hides `select()` mechanics from service code.

#### 5A. Protocol Definition

```python
# src/repositories/base.py
from typing import Generic, Protocol, TypeVar
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

ModelT = TypeVar("ModelT", bound=SQLModel)
CreateT = TypeVar("CreateT", bound=SQLModel)
UpdateT = TypeVar("UpdateT", bound=SQLModel)

class AsyncRepository(Protocol[ModelT]):
    async def get(self, id: int) -> ModelT | None: ...
    async def list(self, *, offset: int = 0, limit: int = 100) -> list[ModelT]: ...
    async def create(self, data: CreateT) -> ModelT: ...
    async def update(self, id: int, data: UpdateT) -> ModelT | None: ...
    async def delete(self, id: int) -> bool: ...
```

#### 5B. Base Implementation

```python
# src/repositories/base.py
class SQLModelRepository(Generic[ModelT]):
    def __init__(self, session: AsyncSession, model: type[ModelT]) -> None:
        self._session = session
        self._model = model

    async def get(self, id: int) -> ModelT | None:
        return await self._session.get(self._model, id)

    async def list(self, *, offset: int = 0, limit: int = 100) -> list[ModelT]:
        result = await self._session.exec(
            select(self._model).offset(offset).limit(limit)
        )
        return list(result.all())

    async def create(self, obj: ModelT) -> ModelT:
        self._session.add(obj)
        await self._session.flush()
        await self._session.refresh(obj)
        return obj

    async def delete(self, id: int) -> bool:
        obj = await self.get(id)
        if obj is None:
            return False
        await self._session.delete(obj)
        await self._session.flush()
        return True
```

#### 5C. Domain Repository + Dependency

```python
# src/repositories/user_repository.py
from src.db.users import User, UserCreate
from src.repositories.base import SQLModelRepository

class UserRepository(SQLModelRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.exec(select(User).where(User.email == email))
        return result.first()

def get_user_repository(session: DBSession) -> UserRepository:
    return UserRepository(session)

UserRepo = Annotated[UserRepository, Depends(get_user_repository)]
```

Route handlers inject `UserRepo` directly; no raw `db_session.exec(select(User)...)` calls
in routing code.

#### 5D. Migration Priority

High-traffic repositories first:

1. `UserRepository`
2. `CourseRepository`
3. `ActivityRepository`
4. `TrailRepository` + `TrailRunRepository`
5. `SessionRepository` (wraps Redis, no DB)
6. All remaining domains

---

### Phase 6 — PostgreSQL 18 + pgvector Modernisation

#### 6A. Upgrade `document_chunks` to `halfvec`

pgvector 0.4.2 supports `halfvec` (fp16) which halves storage and index size with
negligible accuracy loss for semantic search.

```python
# src/db/ai/document_chunks.py
from pgvector.sqlalchemy import HalfVector

class DocumentChunk(SQLModel, table=True):
    __tablename__ = "document_chunks"

    id: int | None = Field(default=None, primary_key=True)
    content_id: str
    chunk_index: int
    text: str
    embedding: list[float] | None = Field(
        default=None,
        sa_column=Column(HalfVector(512))   # matches PLATFORM_AI_EMBEDDING_DIMENSIONS default
    )
    expires_at: datetime | None = None
```

Migration:

```sql
ALTER TABLE document_chunks
    ALTER COLUMN embedding TYPE halfvec(512)
    USING embedding::halfvec(512);
```

#### 6B. Add HNSW Index

Replace the existing IVFFlat index (if any) with HNSW for better recall at query time:

```sql
-- Alembic migration
CREATE INDEX CONCURRENTLY document_chunks_embedding_hnsw
    ON document_chunks
    USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

Add a GIN index on the `content_id` + `chunk_index` composite for exact lookups:

```sql
CREATE INDEX  document_chunks_content_idx
    ON document_chunks (content_id, chunk_index);
```

#### 6C. Remove `document_chunks` from Migration Exclusion

Now that the model is defined in SQLModel, remove it from `_AUTOGENERATE_EXCLUDED_TABLES`.
Alembic autogenerate tracks schema changes automatically.

#### 6D. Use `MERGE` for Upserts (PostgreSQL 15+, available in PG18)

Replace the common `check-then-insert` pattern in service code:

```python
# Before (two round-trips, race condition under concurrent inserts)
existing = (await session.exec(select(Trail).where(Trail.user_id == user_id))).first()
if existing is None:
    existing = Trail(user_id=user_id, ...)
    session.add(existing)

# After (single atomic MERGE statement via SQLAlchemy 2.0)
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = (
    pg_insert(Trail)
    .values(user_id=user_id, trail_uuid=str(ULID()), ...)
    .on_conflict_do_nothing(index_elements=["user_id"])
    .returning(Trail)
)
trail = (await session.exec(stmt)).first()
```

#### 6E. PG18 Connection String — `connect_timeout`

PostgreSQL 18 introduced improved connection state tracking. Set `connect_timeout` in the
DSN or engine kwargs:

```python
create_async_engine(
    dsn,
    connect_args={"connect_timeout": 10, "application_name": "ashyq-bilim-api"},
)
```

---

### Phase 7 — AI/ML Stack (pydantic-ai-slim)

#### 7A. Replace Raw OpenAI Calls with `pydantic_ai.Agent`

```python
# src/services/ai/chat_agent.py
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from src.db.ai.schemas import ChatOutput

_model = OpenAIModel(
    settings.ai_config.chat_model,
    api_key=settings.ai_config.openai_api_key,
)

chat_agent = Agent(
    _model,
    result_type=ChatOutput,          # Pydantic model — validated structured output
    system_prompt="...",
)

async def generate_chat_response(message: str, context: list[str]) -> ChatOutput:
    result = await chat_agent.run(
        message,
        deps={"context": context},
    )
    return result.data
```

#### 7B. Typed Tool Definitions

```python
@chat_agent.tool
async def retrieve_course_content(ctx: RunContext, query: str) -> list[str]:
    """Retrieve relevant course chunks from pgvector."""
    return await semantic_search(query, top_k=ctx.deps.get("top_k", 5))
```

pydantic-ai validates tool inputs and outputs against declared types at runtime.

#### 7C. LangGraph for Multi-Step Workflows

For complex grading workflows or curriculum builders:

```python
# src/services/grading/ai_grader.py
from langgraph.graph import StateGraph, END
from pydantic import BaseModel

class GradingState(BaseModel):
    submission_text: str
    rubric: dict
    score: float | None = None
    feedback: str | None = None

grading_graph = StateGraph(GradingState)
grading_graph.add_node("score", score_submission)
grading_graph.add_node("feedback", generate_feedback)
grading_graph.add_edge("score", "feedback")
grading_graph.add_edge("feedback", END)
compiled_grader = grading_graph.compile()
```

---

### Phase 8 — Observability & Security Hardening

#### 8A. Logfire Structured Spans

Wrap expensive operations with explicit spans:

```python
with logfire.span("db.user.get_by_email", email=email):
    user = await user_repo.get_by_email(email)
```

#### 8B. slowapi Rate Limiting Consistency

Verify all auth endpoints (`/login`, `/register`, `/password-reset`, `/token/refresh`) have
`@limiter.limit(...)` decorators. Add missing ones. Use Redis as the storage backend for
distributed rate limiting across multiple API replicas:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_config.url,
)
```

#### 8C. Secure Headers Middleware

Add `starlette-exceptionhandlers` or manual middleware for:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: interest-cohort=()`

#### 8D. Graceful Shutdown with Connection Drain

```python
# src/app/lifespan.py
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    ...
    yield
    # Drain in-flight requests: give them 10 seconds to complete
    await asyncio.sleep(0)          # yield to allow final requests to reach cleanup
    await engine.dispose()
    await redis.aclose()
```

For true graceful drain, set `GRACEFUL_TIMEOUT` in the docker CMD via `dumb-init` or add
`--graceful-timeout 10` to uvicorn args.

---

## Part 3 — Execution Order & Priorities

| Phase | Risk | Effort | Priority | Breaks API? |
|-------|------|--------|----------|-------------|
| 1A — strict_base_model unification | Low | Hours | **P0** | No |
| 1C — 422 error detail | Low | Minutes | **P0** | No |
| 1D — correlation IDs | Low | Hours | P1 | No |
| 1B — model registry unification | Low | Hours | **P0** | No |
| 1E — dead code / secret validation | Low | Minutes | P2 | No |
| 1F — remove session fallback | Medium | Minutes | P1 | No |
| 1G — ORJSONResponse default | Low | Minutes | P1 | No |
| 2A-F — async DB migration | High | Days | P1 | No (internal) |
| 3A — Redis to app.state | Medium | Hours | P1 | No |
| 3B — audit BackgroundTasks | Medium | Hours | P1 | No |
| 4 — settings modernisation | Medium | Days | P2 | Env var names |
| 5 — repository pattern | Medium | Weeks | P2 | No |
| 6A-D — pgvector modernisation | High | Days | P2 | Migration |
| 7 — pydantic-ai agents | Medium | Days | P3 | No |
| 8 — observability / security | Low | Days | P2 | No |

**Hard blockers to ship before anything else:**

1. Phase 1A (strict_base_model) — currently suppresses type errors that hide real bugs.
2. Phase 1B (model registry) — model drift causes silent runtime failures.
3. Phase 1C (422 detail) — frontend has zero error feedback on bad requests.

---

## Part 4 — Non-Goals

The following are out of scope for this rewrite:

- Switching from SQLModel to raw SQLAlchemy 2.0 ORM (`Mapped[T]` + `mapped_column()`).
  SQLModel 0.0.38 supports async adequately and the model definitions are already an asset.
- Full CQRS / event sourcing. The domain complexity does not justify the overhead.
- GraphQL. REST is the correct choice given the existing frontend TanStack Query setup.
- Replacing Alembic with another migration tool.
