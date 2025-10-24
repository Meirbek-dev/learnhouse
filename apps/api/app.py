import re

import logfire
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi_another_jwt_auth.exceptions import AuthJWTException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

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
    return {"Message": "Добро пожаловать в Ashyq Bilim ✨"}
