import logfire
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import re
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi_another_jwt_auth.exceptions import AuthJWTException

from config.config import PlatformConfig, get_platform_config
from src.core.events.events import shutdown_app, startup_app
from src.router import v1_router

# Get Platform Config
platform_config: PlatformConfig = get_platform_config()

# Global Config
app = FastAPI(
    title=platform_config.site_name,
    description=platform_config.site_description,
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


# Fix-up middleware: ensure the CORS headers are set correctly for allowed origins.
# Some proxies or misconfigurations can lead to an empty
# 'Access-Control-Allow-Credentials' header which browsers reject when
# credentials are sent. This middleware is conservative: it only echoes the
# incoming Origin back as Access-Control-Allow-Origin when the origin is
# explicitly allowed (via allowed_origins or allowed_regexp) or when running
# in development mode.
class _EnsureCorsHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.allowed_origins = list(
            platform_config.hosting_config.allowed_origins or []
        )
        self.allowed_regexp = platform_config.hosting_config.allowed_regexp
        self.allow_credentials = True

    def _is_origin_allowed(self, origin: str) -> bool:
        if not origin:
            return False
        # Exact match against configured allowed origins
        if origin in self.allowed_origins:
            return True

        # Regex match if configured
        if self.allowed_regexp:
            try:
                return re.match(self.allowed_regexp, origin) is not None
            except re.error:
                # Invalid regex in config — fall back to permissive behavior
                return bool(platform_config.general_config.development_mode)

        # In development mode be permissive for convenience
        return bool(platform_config.general_config.development_mode)

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")

        allowed = self._is_origin_allowed(origin) if origin else False

        # Preflight handling
        if request.method == "OPTIONS":
            if not origin:
                return Response(status_code=204)
            if not allowed:
                return Response(status_code=403)

            headers = {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true" if self.allow_credentials else "false",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": request.headers.get(
                    "access-control-request-headers", "*"
                ),
                "Vary": "Origin",
            }
            return Response(status_code=204, headers=headers)

        response = await call_next(request)

        # Ensure the credentials header is a proper string when origin is allowed
        if allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = (
                "true" if self.allow_credentials else "false"
            )
            # Ensure Vary header includes Origin so caches don't mix responses
            vary = response.headers.get("Vary")
            if vary:
                if "Origin" not in [h.strip() for h in vary.split(",")]:
                    response.headers["Vary"] = f"{vary}, Origin"
            else:
                response.headers["Vary"] = "Origin"

        return response


# Add the ensuring middleware after the CORS middleware so it can correct
# any headers if necessary.
app.add_middleware(_EnsureCorsHeadersMiddleware)

# Only enable logfire if explicitly configured
if platform_config.general_config.logfire_enabled:
    logfire.configure(
        console=False,
        service_name=platform_config.site_name,
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
def authjwt_exception_handler(request: Request, exc: AuthJWTException):
    return ORJSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


# Static Files
app.mount("/content", StaticFiles(directory="content"), name="content")

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
    return {"Message": "Добро пожаловать в CS МООК ✨"}
