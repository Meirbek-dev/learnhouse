import uvicorn
import logfire
from fastapi import FastAPI, Request
from config.config import OpenUConfig, get_openu_config
from src.core.events.events import shutdown_app, startup_app
from src.router import v1_router
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi_jwt_auth.exceptions import AuthJWTException
from fastapi.middleware.gzip import GZipMiddleware
import multiprocessing


# from src.services.mocks.initial import create_initial_data

# Get OpenU Config
openu_config: OpenUConfig = get_openu_config()

# Global Config
app = FastAPI(
    title=openu_config.site_name,
    description=openu_config.site_description,
    docs_url="/docs" if openu_config.general_config.development_mode else None,
    redoc_url="/redoc" if openu_config.general_config.development_mode else None,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=openu_config.hosting_config.allowed_regexp,
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)

logfire.configure(
    console=False,
    service_name=openu_config.site_name,
)
logfire.instrument_fastapi(app)

# Gzip Middleware (will add brotli later)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Events
app.add_event_handler("startup", startup_app(app))
app.add_event_handler("shutdown", shutdown_app(app))


# JWT Exception Handler
@app.exception_handler(AuthJWTException)
def authjwt_exception_handler(request: Request, exc: AuthJWTException):
    return JSONResponse(
        status_code=exc.status_code,  # type: ignore
        content={"detail": exc.message},  # type: ignore
    )


# Static Files
app.mount("/content", StaticFiles(directory="content"), name="content")

# Global Routes
app.include_router(v1_router)


if __name__ == "__main__":
    is_dev_mode = openu_config.general_config.development_mode

    uvicorn_kwargs = {
        "host": "0.0.0.0",
        "port": openu_config.hosting_config.port,
        "reload": is_dev_mode,
        "access_log": False,  # Disable access logs for slight performance gain/less noise
    }

    if not is_dev_mode:
        uvicorn_kwargs["loop"] = "asyncio"  # Explicitly asyncio, or 'auto'

        # Set number of workers for production-like environments
        # Uvicorn's 'workers' parameter is effective when reload=False
        uvicorn_kwargs["workers"] = multiprocessing.cpu_count()
    else:
        # In development mode (reload=True), Uvicorn typically uses 1 worker.
        # You might still want uvloop if it's stable with your reloader.
        # For now, we'll keep it simpler and only enable uvloop for non-dev mode.
        uvicorn_kwargs["loop"] = "asyncio"  # Or 'auto'

    uvicorn.run("app:app", **uvicorn_kwargs)


# General Routes
@app.get("/")
async def root():
    return {"Message": "Welcome to OpenU ✨"}
