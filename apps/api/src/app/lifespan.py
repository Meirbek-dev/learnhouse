import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from src.app.observability import configure_observability
from src.infra.db.engine import (
    dispose_database,
    get_database_engine,
    get_session_factory,
    initialize_database,
)
from src.infra.logging import configure_logging
from src.infra.settings import AppSettings

logger = logging.getLogger(__name__)


def ensure_runtime_directories() -> None:
    Path("content").mkdir(parents=True, exist_ok=True)
    Path("logs").mkdir(parents=True, exist_ok=True)


async def _ttl_sweep_loop(retention_seconds: int) -> None:
    while True:
        await asyncio.sleep(3600)
        try:
            from src.services.ai.retrieval import delete_expired_chunks

            removed = await asyncio.to_thread(delete_expired_chunks, retention_seconds)
            if removed == -1:
                logger.warning(
                    "Vector TTL sweep skipped: document_chunks table not found"
                )
            elif removed:
                logger.info("Vector TTL sweep removed %d expired chunk(s)", removed)
        except Exception:
            logger.exception("Vector TTL sweep failed")


def create_lifespan(settings: AppSettings) -> Callable[[FastAPI], AsyncIterator[None]]:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging(settings)
        ensure_runtime_directories()
        initialize_database(settings)

        engine = get_database_engine()
        session_factory = get_session_factory()
        app.state.settings = settings
        app.state.engine = engine
        app.state.session_factory = session_factory

        configure_observability(app, settings, engine)

        ttl_sweep_task = asyncio.create_task(
            _ttl_sweep_loop(settings.ai_config.collection_retention),
            name="vector_ttl_sweep",
        )
        app.state.ttl_sweep_task = ttl_sweep_task

        try:
            yield
        finally:
            if not ttl_sweep_task.done():
                ttl_sweep_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await ttl_sweep_task
            dispose_database()

    return lifespan
