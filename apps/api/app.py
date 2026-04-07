from contextlib import asynccontextmanager

import logfire
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

from config.config import get_settings
from src.core.events.events import shutdown_app, startup_app
from src.router import v1_router


_STATIC_CACHE_HEADER = "public, max-age=31536000, immutable"


class CachedStaticFiles(StaticFiles):
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
        logfire.configure(console=False, service_name="Ashyq Bilim")
        logfire.instrument_fastapi(app)
        from src.core.events.database import engine

        logfire.instrument_sqlalchemy(engine=engine)

    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.middleware("http")
    async def enforce_cookie_request_origin(request: Request, call_next):
        unsafe_methods = {"POST", "PUT", "PATCH", "DELETE"}
        has_cookie_auth = bool(
            request.cookies.get("access_token_cookie")
            or request.cookies.get("refresh_token_cookie")
        )
        has_authorization = bool(request.headers.get("authorization"))

        if (
            request.method.upper() in unsafe_methods
            and has_cookie_auth
            and not has_authorization
        ):
            origin = request.headers.get("origin")
            if origin:
                allowed = {item.rstrip("/") for item in settings.hosting_config.allowed_origins}
                scheme = "https" if settings.hosting_config.ssl else "http"
                port = settings.hosting_config.port
                default_port = 443 if settings.hosting_config.ssl else 80
                if port == default_port:
                    allowed.add(f"{scheme}://{settings.hosting_config.domain}")
                else:
                    allowed.add(f"{scheme}://{settings.hosting_config.domain}:{port}")

                if origin.rstrip("/") not in allowed:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error_code": "CSRF_ORIGIN_MISMATCH",
                            "message": "Untrusted request origin",
                        },
                    )

        return await call_next(request)

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
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=settings.hosting_config.port,
        reload=is_dev_mode,
        access_log=is_dev_mode,
    )


@app.get("/")
async def root():
    return {"Message": "Добро пожаловать в Ashyq Bilim"}
