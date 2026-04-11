import os

from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from src.db.model_registry import import_orm_models
from src.infra.settings import AppSettings, get_settings

_engine: Engine | None = None
_session_factory: sessionmaker | None = None


def _is_testing() -> bool:
    return os.getenv("TESTING", "false").lower() == "true"


def initialize_database(settings: AppSettings | None = None) -> None:
    global _engine, _session_factory

    if _engine is not None and _session_factory is not None:
        return

    import_orm_models()
    resolved_settings = settings or get_settings()

    if _is_testing():
        _engine = create_engine(
            "sqlite://",
            echo=False,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        _engine = create_engine(
            resolved_settings.database_config.sql_connection_string,
            echo=False,
            pool_pre_ping=True,
            pool_reset_on_return="rollback",
            pool_use_lifo=True,
        )

    _session_factory = sessionmaker(
        bind=_engine,
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )


def get_database_engine() -> Engine:
    if _engine is None:
        msg = "Database runtime has not been initialized"
        raise RuntimeError(msg)
    return _engine


def get_session_factory() -> sessionmaker:
    if _session_factory is None:
        msg = "Database session factory has not been initialized"
        raise RuntimeError(msg)
    return _session_factory


def dispose_database() -> None:
    global _engine, _session_factory

    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
