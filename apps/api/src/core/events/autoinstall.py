from sqlalchemy import create_engine
from sqlmodel import Session, SQLModel, select

from cli import install
from config.config import get_openu_config
from src.db.organizations import Organization


def auto_install() -> None:
    # Get the database session
    openu_config = get_openu_config()
    engine = create_engine(
        openu_config.database_config.sql_connection_string,
        echo=False,
        pool_pre_ping=True,
    )
    SQLModel.metadata.create_all(engine)

    db_session = Session(engine)

    orgs = db_session.exec(select(Organization)).all()

    if len(orgs) == 0:
        print("No organizations found. Starting auto-installation 🏗️")
        install(short=True)

    if orgs:
        for _org in orgs:
            default_org = db_session.exec(
                select(Organization).where(Organization.slug == "openu")
            ).first()

            if not default_org:
                print("No default organization found. Starting auto-installation 🏗️")
                install(short=True)

    else:
        print("Organizations found. Skipping auto-installation 🚀")
