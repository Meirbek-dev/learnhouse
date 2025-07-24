import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager

import logfire
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi_another_jwt_auth.exceptions import AuthJWTException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

from config.config import OpenUConfig, get_openu_config
from src.core.events.events import shutdown_app, startup_app
from src.router import v1_router

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


class ResponseCacheMiddleware(BaseHTTPMiddleware):
    """
    Optimized caching middleware with memory management and configurable TTL.
    """

    def __init__(
        self,
        app,
        cache_seconds: int = 300,
        max_cache_size: int = 1000,
        cleanup_threshold: int = 0.8,
    ) -> None:
        super().__init__(app)
        self.cache_seconds = cache_seconds
        self.max_cache_size = max_cache_size
        self.cleanup_threshold = cleanup_threshold
        self.cache: dict[str, dict] = {}
        self.cache_times: dict[str, float] = {}

    def _should_cache_request(self, request: StarletteRequest) -> bool:
        """Determine if request should be cached."""
        if request.method != "GET":
            return False

        # Skip caching for dynamic or sensitive paths
        skip_cache_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/api/v1/auth",
            "/api/v1/users/me",
        ]
        path = str(request.url.path)
        return not any(path.startswith(skip_path) for skip_path in skip_cache_paths)

    def _cleanup_cache(self) -> None:
        """Clean up expired and excess cache entries."""
        current_time = time.time()

        # Remove expired entries
        expired_keys = [
            key
            for key, timestamp in self.cache_times.items()
            if current_time - timestamp > self.cache_seconds
        ]

        for key in expired_keys:
            self.cache.pop(key, None)
            self.cache_times.pop(key, None)

        # Remove oldest entries if cache is too large
        if len(self.cache) > self.max_cache_size * self.cleanup_threshold:
            sorted_keys = sorted(
                self.cache_times.keys(), key=lambda k: self.cache_times[k]
            )
            keys_to_remove = sorted_keys[: int(len(sorted_keys) * 0.3)]

            for key in keys_to_remove:
                self.cache.pop(key, None)
                self.cache_times.pop(key, None)

    async def dispatch(self, request: StarletteRequest, call_next) -> StarletteResponse:
        if not self._should_cache_request(request):
            return await call_next(request)

        cache_key = f"{request.method}:{request.url}"
        current_time = time.time()

        # Check for valid cached response
        if (
            cache_key in self.cache
            and cache_key in self.cache_times
            and current_time - self.cache_times[cache_key] < self.cache_seconds
        ):
            cached_response = self.cache[cache_key]
            return StarletteResponse(
                content=cached_response["body"],
                status_code=cached_response["status_code"],
                headers=cached_response["headers"],
            )

        # Get fresh response
        response = await call_next(request)

        # Cache successful responses
        if response.status_code == 200:
            try:
                body = b""
                async for chunk in response.body_iterator:
                    body += chunk

                self.cache[cache_key] = {
                    "body": body,
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                }
                self.cache_times[cache_key] = current_time

                # Periodic cleanup
                if len(self.cache) > self.max_cache_size:
                    self._cleanup_cache()

                return StarletteResponse(
                    content=body,
                    status_code=response.status_code,
                    headers=response.headers,
                )
            except Exception as e:
                logger.warning(f"Failed to cache response: {e}")
                return response

        return response


# Optimized lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager with optimized startup and shutdown.
    """
    try:
        await startup_app(app)()

        # Optimize asyncio event loop for production
        openu_config = get_openu_config()
        if not openu_config.general_config.development_mode:
            # Set optimal event loop policy for production
            if sys.platform == "win32":
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            elif sys.platform == "linux":
                # Use uvloop if available for better performance on Linux
                try:
                    import uvloop

                    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
                    logger.info("Using uvloop for enhanced performance")
                except ImportError:
                    logger.info("uvloop not available, using default event loop")

        logger.info("OpenU API server started successfully")
        yield

    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down OpenU API server...")
        try:
            await shutdown_app(app)()
            logger.info("OpenU API server shut down successfully")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")


# Configuration caching
_config_cache: OpenUConfig | None = None


def get_cached_config() -> OpenUConfig:
    """Get cached configuration to avoid repeated file reads."""
    global _config_cache
    if _config_cache is None:
        _config_cache = get_openu_config()
    return _config_cache


def create_optimized_app() -> FastAPI:
    """
    Create and configure the FastAPI application with optimizations.
    """
    openu_config = get_cached_config()

    # Create FastAPI app with optimized settings
    app = FastAPI(
        title=openu_config.site_name,
        description=openu_config.site_description,
        version="0.1.0",
        docs_url="/docs" if openu_config.general_config.development_mode else None,
        redoc_url="/redoc" if openu_config.general_config.development_mode else None,
        openapi_url="/openapi.json"
        if openu_config.general_config.development_mode
        else None,
        lifespan=lifespan,
        default_response_class=ORJSONResponse,  # Faster JSON serialization
        # Optimize response handling
        swagger_ui_parameters={"syntaxHighlight.theme": "obsidian"},
        generate_unique_id_function=lambda route: f"{route.tags[0] if route.tags else 'default'}_{route.name}",
    )

    # Add middleware in optimal order (last added = first executed)
    _add_middleware(app, openu_config)

    # Add exception handlers
    _add_exception_handlers(app)

    # Mount static files
    _mount_static_files(app)

    # Add routes
    app.include_router(v1_router)

    # Add root endpoint
    _add_root_endpoint(app)

    return app


def _add_middleware(app: FastAPI, config: OpenUConfig) -> None:
    """Add middleware to the application in optimal order."""

    # Security middleware (add first for security)
    if not config.general_config.development_mode:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=[
                config.hosting_config.domain,
                "localhost",
                "127.0.0.1",
                "0.0.0.0",
            ],
        )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=config.hosting_config.allowed_regexp,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_credentials=True,
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=86400,  # Cache preflight requests for 24 hours
    )

    # Response caching (only in production)
    if not config.general_config.development_mode:
        app.add_middleware(
            ResponseCacheMiddleware,
            cache_seconds=300,  # 5 minutes
            max_cache_size=2000,
            cleanup_threshold=0.8,
        )

    # Compression middleware (add last for all responses)
    app.add_middleware(
        GZipMiddleware,
        minimum_size=1024,  # Only compress responses larger than 1KB
        compresslevel=6,  # Balanced compression ratio vs speed
    )

    # Instrument with Logfire in production
    if not config.general_config.development_mode:
        try:
            logfire.configure(
                console=False,
                service_name=config.site_name,
                service_version="0.1.0",
            )
            logfire.instrument_fastapi(app)
            logger.info("Logfire instrumentation enabled")
        except Exception as e:
            logger.warning(f"Failed to configure Logfire: {e}")


def _add_exception_handlers(app: FastAPI) -> None:
    """Add global exception handlers."""

    @app.exception_handler(AuthJWTException)
    async def authjwt_exception_handler(request: Request, exc: AuthJWTException):
        logger.warning(f"JWT Auth error: {exc.message}")
        return ORJSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "type": "auth_error"},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}")

        # Don't expose internal errors in production
        config = get_cached_config()
        if config.general_config.development_mode:
            return ORJSONResponse(
                status_code=500,
                content={"detail": str(exc), "type": "internal_error"},
            )
        return ORJSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "type": "internal_error"},
        )


def _mount_static_files(app: FastAPI) -> None:
    """Mount static files with optimized caching."""

    class OptimizedStaticFiles(StaticFiles):
        """Static files handler with aggressive caching and security headers."""

        async def get_response(self, path: str, scope):
            response = await super().get_response(path, scope)

            # Set cache headers based on file type
            if path.endswith((".js", ".css", ".woff", ".woff2", ".ttf", ".eot")):
                # Long-term caching for versioned assets
                response.headers["Cache-Control"] = (
                    "public, max-age=31536000, immutable"
                )
            elif path.endswith(
                (".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", "wp2")
            ):
                # Long-term caching for images
                response.headers["Cache-Control"] = "public, max-age=2592000"  # 30 days
            elif path.endswith((".pdf", ".zip", ".tar", ".gz")):
                # Medium-term caching for documents
                response.headers["Cache-Control"] = "public, max-age=86400"  # 1 day
            elif path.endswith((".html", ".htm")):
                # Short-term caching for HTML
                response.headers["Cache-Control"] = "public, max-age=3600"  # 1 hour
            else:
                # Default caching
                response.headers["Cache-Control"] = "public, max-age=3600"

            # Add security headers
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-XSS-Protection"] = "1; mode=block"

            return response

    # Mount static content directory
    if os.path.exists("content"):
        app.mount(
            "/content",
            OptimizedStaticFiles(directory="content"),
            name="content",
        )
    else:
        logger.warning("Content directory not found, skipping static file mounting")


def _add_root_endpoint(app: FastAPI) -> None:
    @app.get("/", include_in_schema=False)
    async def root():
        """Root endpoint with optimized response."""
        return ORJSONResponse(
            content={
                "message": "Welcome to OpenU API ✨",
            }
        )


# Create the FastAPI application
app = create_optimized_app()


def get_optimized_uvicorn_config() -> dict:
    """Get optimized uvicorn configuration based on environment."""
    config = get_cached_config()
    is_dev_mode = config.general_config.development_mode

    base_config = {
        "host": "0.0.0.0",
        "port": config.hosting_config.port,
        "reload": is_dev_mode,
        "access_log": is_dev_mode,
        # Production optimizations
        "workers": 1 if is_dev_mode else max(1, int(os.cpu_count() * 0.75)),
        "backlog": 2048,
        "timeout_keep_alive": 30,
        "timeout_graceful_shutdown": 30,
        "limit_concurrency": 1000,
        "limit_max_requests": 10000,
        # Use high-performance HTTP implementation
        "http": "httptools",
        "loop": "auto",
        # Disable unnecessary headers for security
        "server_header": False,
        "date_header": False,
    }

    # Development-specific settings
    if is_dev_mode:
        base_config.update(
            {
                "log_level": "debug",
                "reload_dirs": ["src", "config"],
                "reload_includes": ["*.py", "*.yaml", "*.yml"],
            }
        )
    else:
        base_config.update(
            {
                "log_level": "info",
                "log_config": None,  # Use custom logging configuration
            }
        )

    return base_config


if __name__ == "__main__":
    try:
        uvicorn_config = get_optimized_uvicorn_config()
        uvicorn.run("app:app", **uvicorn_config)
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        sys.exit(1)
