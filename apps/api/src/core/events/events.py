import asyncio
import logging
from collections.abc import Callable

from fastapi import FastAPI

from config.config import get_settings
from src.core.events.autoinstall import check_migration_health
from src.core.events.content import check_content_directory
from src.core.events.database import close_database, connect_to_db
from src.core.events.logs import create_logs_dir

logger = logging.getLogger(__name__)


async def _ttl_sweep_loop(retention_seconds: int) -> None:
    """Hourly background task that removes expired document chunks."""
    while True:
        await asyncio.sleep(3600)
        try:
            from src.services.ai.retrieval import delete_expired_chunks

            removed = await asyncio.to_thread(delete_expired_chunks, retention_seconds)
            if removed:
                logger.info("Vector TTL sweep removed %d expired chunk(s)", removed)
        except Exception:
            logger.exception("Vector TTL sweep failed")


def startup_app(app: FastAPI) -> Callable:
    async def start_app() -> None:
        # Get Ashyq Bilim Config
        app.platform_config = get_settings()

        # Connect to database
        await connect_to_db(app)

        # Create logs directory
        await create_logs_dir()

        # Create content directory
        await check_content_directory()

        # Fail-fast when migrations are not applied
        check_migration_health()

        # Start background TTL sweep for vector document chunks
        retention = get_settings().ai_config.collection_retention
        app.state.ttl_sweep_task = asyncio.create_task(
            _ttl_sweep_loop(retention),
            name="vector_ttl_sweep",
        )

    return start_app


def shutdown_app(app: FastAPI) -> Callable:
    async def close_app() -> None:
        task: asyncio.Task | None = getattr(app.state, "ttl_sweep_task", None)
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        await close_database(app)

    return close_app
