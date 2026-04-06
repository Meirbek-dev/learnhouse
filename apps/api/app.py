from contextlib import asynccontextmanager

import logfire
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session
from starlette.types import Receive, Scope, Send

from config.config import get_settings
from src.core.events.database import get_database_engine
from src.core.events.events import shutdown_app, startup_app
from src.router import v1_router
from src.security.auth import create_access_token, decode_access_token
from src.security.auth_cookies import (
    ACCESS_COOKIE_KEY,
    REFRESH_COOKIE_KEY,
    set_access_cookie,
    set_refresh_cookie,
)
from src.services.auth.sessions import (
    get_user_for_session,
    resolve_refresh_session,
    revoke_token_family,
    rotate_session,
)

# ── Cached static files ────────────────────────────────────────────────────────
# Starlette's default StaticFiles sets no meaningful Cache-Control header.
# Content files are content-addressed (UUID paths), so aggressive caching is safe.
_STATIC_CACHE_HEADER = "public, max-age=31536000, immutable"


class CachedStaticFiles(StaticFiles):
    """StaticFiles that appends a long-lived cache header to every response."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        async def send_with_cache(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                headers[b"cache-control"] = _STATIC_CACHE_HEADER.encode()
                message = {**message, "headers": list(headers.items())}
            await send(message)

        await super().__call__(scope, receive, send_with_cache)


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await startup_app(app)()
        try:
            yield
        finally:
            await shutdown_app(app)()

    app = FastAPI(
        title="Ashyq Bilim",
        description="Образовательная платформа Ashyq Bilim",
        docs_url="/docs" if settings.general_config.development_mode else None,
        redoc_url="/redoc" if settings.general_config.development_mode else None,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=settings.hosting_config.allowed_regexp,
        allow_methods=["*"],
        allow_credentials=True,
        allow_headers=["*"],
    )

    if settings.general_config.logfire_enabled:
        logfire.configure(
            console=False,
            service_name="Ashyq Bilim",
        )
        logfire.instrument_fastapi(app)
        from src.core.events.database import engine

        logfire.instrument_sqlalchemy(engine=engine)

    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.middleware("http")
    async def auth_cookie_refresh_middleware(request: Request, call_next):
        refreshed_access_token: str | None = None
        refreshed_refresh_token: str | None = None

        if request.headers.get("authorization") is None:
            access_cookie = request.cookies.get(ACCESS_COOKIE_KEY)
            refresh_cookie = request.cookies.get(REFRESH_COOKIE_KEY)
            access_cookie_invalid = False

            if access_cookie:
                try:
                    decode_access_token(access_cookie)
                except HTTPException:
                    access_cookie_invalid = True
            else:
                access_cookie_invalid = True

            if refresh_cookie and access_cookie_invalid:
                with Session(get_database_engine()) as db_session:
                    auth_session = resolve_refresh_session(db_session, refresh_cookie)
                    if auth_session is not None:
                        user = get_user_for_session(db_session, auth_session)
                        if user is not None:
                            rotated_session, refreshed_refresh_token = rotate_session(
                                db_session,
                                auth_session=auth_session,
                                ip_address=request.client.host
                                if request.client
                                else None,
                                user_agent=request.headers.get("user-agent"),
                            )
                            refreshed_access_token = create_access_token(
                                {"sub": user.email, "sid": rotated_session.session_id}
                            )
                            request.state.resolved_access_token = refreshed_access_token
                        else:
                            revoke_token_family(db_session, auth_session.token_family_id)

        response = await call_next(request)

        if refreshed_access_token and refreshed_refresh_token:
            set_access_cookie(response, refreshed_access_token)
            set_refresh_cookie(response, refreshed_refresh_token)

        return response

    app.mount("/content", CachedStaticFiles(directory="content"), name="content")
    app.include_router(v1_router)
    return app


app = create_app()


@app.exception_handler(HTTPException)
def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail

    if isinstance(detail, dict):
        error_code = detail.get("error_code")
        message = detail.get("message")
        if isinstance(error_code, str) and isinstance(message, str):
            return JSONResponse(status_code=exc.status_code, content=detail)

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error_code": "HTTP_ERROR",
                "message": str(message if message is not None else detail),
            },
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": "HTTP_ERROR", "message": str(detail)},
    )


@app.exception_handler(RequestValidationError)
def request_validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "message": "Request validation failed",
        },
    )


if __name__ == "__main__":
    settings = get_settings()
    is_dev_mode = settings.general_config.development_mode

    uvicorn_kwargs = {
        "host": "0.0.0.0",
        "port": settings.hosting_config.port,
        "reload": is_dev_mode,
        "access_log": is_dev_mode,
    }
    uvicorn.run("app:app", **uvicorn_kwargs)


# General Routes
@app.get("/")
async def root():
    return {"Message": "Добро пожаловать в Ashyq Bilim ✨"}
