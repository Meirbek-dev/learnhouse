import re

import logfire
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi_another_jwt_auth.exceptions import AuthJWTException
from starlette.types import Receive, Scope, Send

from config.config import PlatformConfig, get_platform_config
from src.core.events.events import shutdown_app, startup_app
from src.router import v1_router

# Get Platform Config
platform_config: PlatformConfig = get_platform_config()


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


# Global Config
app = FastAPI(
    title="Ashyq Bilim",
    description="Образовательная платформа Ashyq Bilim",
    docs_url="/docs" if platform_config.general_config.development_mode else None,
    redoc_url="/redoc" if platform_config.general_config.development_mode else None,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=platform_config.hosting_config.allowed_regexp,
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)

# Only enable logfire if explicitly configured
if platform_config.general_config.logfire_enabled:
    logfire.configure(
        console=False,
        service_name="Ashyq Bilim",
    )
    logfire.instrument_fastapi(app)
    # Instrument database after logfire is configured
    from src.core.events.database import engine

    logfire.instrument_sqlalchemy(engine=engine)

# Gzip Middleware (will add brotli later)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Events
app.add_event_handler("startup", startup_app(app))
app.add_event_handler("shutdown", shutdown_app(app))


# JWT Exception Handler
@app.exception_handler(AuthJWTException)
def authjwt_exception_handler(request: Request, exc: AuthJWTException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": "AUTH_ERROR", "message": str(exc.message)},
    )


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


# Static Files (served with long-lived cache headers; paths are UUID-based and immutable)
app.mount("/content", CachedStaticFiles(directory="content"), name="content")

# Global Routes
app.include_router(v1_router)


if __name__ == "__main__":
    is_dev_mode = platform_config.general_config.development_mode

    uvicorn_kwargs = {
        "host": "0.0.0.0",
        "port": platform_config.hosting_config.port,
        "reload": is_dev_mode,
        "access_log": is_dev_mode,
    }
    uvicorn.run("app:app", **uvicorn_kwargs)


# General Routes
@app.get("/")
async def root():
    return {"Message": "Добро пожаловать в Ashyq Bilim ✨"}
