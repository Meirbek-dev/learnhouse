from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel, select

from cli import install
from config.config import get_platform_config
from src.db.organizations import Organization


def auto_install() -> None:
    # Get the database session
    platform_config = get_platform_config()
    engine = create_engine(
        platform_config.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,
    )
    SQLModel.metadata.create_all(engine)

    db_session = Session(engine)

    # Check if default organization exists
    default_org = db_session.exec(
        select(Organization).where(Organization.slug == "openu")
    ).first()

    if not default_org:
        print("No default organization found. Starting auto-installation 🏗️")
        install(short=True)
    else:
        print("Default organization found. Skipping auto-installation 🚀")
