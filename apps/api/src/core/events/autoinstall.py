from sqlalchemy import create_engine, text
from sqlmodel import Session

from config.config import get_platform_config


def check_migration_health() -> None:
    """Fail startup when migrations are not applied."""
    platform_config = get_platform_config()
    engine = create_engine(
        platform_config.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,
    )
    with Session(engine) as db_session:
        try:
            version = db_session.exec(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            ).first()
        except Exception as exc:
            raise RuntimeError(
                "Database migration health check failed. Run Alembic migrations before starting the API service."
            ) from exc

        if not version:
            raise RuntimeError(
                "No Alembic version found. Run Alembic migrations before starting the API service."
            )
