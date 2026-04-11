import contextlib
import logging
from collections.abc import Iterator

from fastapi import HTTPException, Request
from sqlmodel import Session

from src.infra.db.engine import get_session_factory

logger = logging.getLogger(__name__)


def open_db_session() -> Session:
    session_factory = get_session_factory()
    return session_factory()


@contextlib.contextmanager
def session_scope() -> Iterator[Session]:
    session = open_db_session()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_session(request: Request) -> Iterator[Session]:
    session_factory = getattr(request.app.state, "session_factory", None)
    session = session_factory() if session_factory is not None else open_db_session()

    try:
        yield session
    except HTTPException:
        session.rollback()
        raise
    except Exception:
        logger.exception("Database session error")
        session.rollback()
        raise
    finally:
        session.close()
