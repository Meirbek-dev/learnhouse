from collections.abc import Callable

from fastapi import FastAPI

from config.config import PlatformConfig, get_platform_config
from src.core.events.autoinstall import check_migration_health
from src.core.events.content import check_content_directory
from src.core.events.database import close_database, connect_to_db
from src.core.events.logs import create_logs_dir


def startup_app(app: FastAPI) -> Callable:
    async def start_app() -> None:
        # Get Ashyq Bilim Config
        platform_config: PlatformConfig = get_platform_config()
        app.platform_config = platform_config

        # Connect to database
        await connect_to_db(app)

        # Create logs directory
        await create_logs_dir()

        # Create content directory
        await check_content_directory()

        # Fail-fast when migrations are not applied
        check_migration_health()

    return start_app


def shutdown_app(app: FastAPI) -> Callable:
    async def close_app() -> None:
        await close_database(app)

    return close_app
