import importlib
import logging
import os

import logfire
from fastapi import FastAPI
from sqlmodel import Session, SQLModel, create_engine

from config.config import get_openu_config


def import_all_models() -> None:
    base_dir = "src/db"
    base_module_path = "src.db"

    # Recursively walk through the base directory
    for root, _dirs, files in os.walk(base_dir):
        # Filter out __init__.py and non-Python files
        module_files = [f for f in files if f.endswith(".py") and f != "__init__.py"]

        # Calculate the module's base path from its directory structure
        path_diff = os.path.relpath(root, base_dir)
        if path_diff == ".":
            current_module_base = base_module_path
        else:
            current_module_base = f"{base_module_path}.{path_diff.replace(os.sep, '.')}"

        # Dynamically import each module
        for file_name in module_files:
            module_name = file_name[:-3]  # Remove the '.py' extension
            full_module_path = f"{current_module_base}.{module_name}"
            importlib.import_module(full_module_path)


# Import all models before creating engine
import_all_models()

# Rebuild models to resolve forward references
from src.db.trails import rebuild_trail_models  # noqa: E402

rebuild_trail_models()

openu_config = get_openu_config()
engine = create_engine(
    openu_config.database_config.sql_connection_string,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=0,
    pool_recycle=300,  # Recycle connections after 5 minutes
    pool_timeout=30,
)

# Create all tables after importing all models
SQLModel.metadata.create_all(engine)
logfire.instrument_sqlalchemy(engine=engine)


async def connect_to_db(app: FastAPI) -> None:
    try:
        app.db_engine = engine
        logging.info("OpenU database has been started.")
        SQLModel.metadata.create_all(engine)
    except Exception as e:
        logging.exception(
            "Make sure you have a database running and accessible. " + str(e)
        )


def get_db_session():
    with Session(engine) as session:
        yield session


async def close_database(app: FastAPI):
    logging.info("OpenU has been shut down.")
    return app
