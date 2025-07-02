import importlib
import logging
import os
from typing import Iterator

import logfire
from fastapi import FastAPI
from sqlmodel import Session, SQLModel, create_engine

from config.config import get_openu_config

# Configure logging for better visibility
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def import_all_models() -> None:
    """
    Dynamically imports all SQLModel definitions from the 'src/db' directory.
    This ensures that SQLModel.metadata.create_all() discovers all defined tables.
    """
    base_dir = "src/db"
    base_module_path = "src.db"

    # Recursively walk through the base directory to find all Python files
    for root, _dirs, files in os.walk(base_dir):
        # Filter out __init__.py and non-Python files
        module_files = [f for f in files if f.endswith(".py") and f != "__init__.py"]

        # Calculate the module's base path from its directory structure
        # e.g., src/db/models -> src.db.models
        path_diff = os.path.relpath(root, base_dir)
        if path_diff == ".":
            current_module_base = base_module_path
        else:
            current_module_base = f"{base_module_path}.{path_diff.replace(os.sep, '.')}"

        # Dynamically import each module to register SQLModel metadata
        for file_name in module_files:
            module_name = file_name[:-3]  # Remove the '.py' extension
            full_module_path = f"{current_module_base}.{module_name}"
            try:
                importlib.import_module(full_module_path)
                logger.debug(f"Successfully imported module: {full_module_path}")
            except ImportError as e:
                logger.error(f"Failed to import module {full_module_path}: {e}")


# --- Database Initialization ---

# 1. Import all models to ensure SQLModel's metadata is populated.
# This must happen before creating the engine and tables.
import_all_models()

# 2. Rebuild models to resolve Pydantic V2 forward references.
# This step is crucial for Pydantic V2 compatibility, especially if models
# have circular dependencies or refer to models defined later.
# Ensure 'rebuild_trail_models' is correctly implemented in 'src.db.trails'
# to call .model_rebuild() on relevant models without altering the JSON schema.
try:
    from src.db.trails import rebuild_trail_models  # type: ignore # noqa: E402

    rebuild_trail_models()
except ImportError:
    logger.warning(
        "Could not import 'rebuild_trail_models'. "
        "Ensure it exists if you have Pydantic V2 forward references."
    )
except Exception as e:
    logger.exception(f"Error during rebuilding trail models: {e}")


# Get database configuration
openu_config = get_openu_config()

# Create the SQLAlchemy engine for SQLModel
engine = create_engine(
    openu_config.database_config.sql_connection_string,
    echo=False,  # Set to True to see SQL statements for debugging
    pool_pre_ping=True,  # Test connections for liveness
    pool_size=10,  # Maximum number of connections to keep in the pool
    max_overflow=0,  # No additional connections beyond pool_size
    pool_recycle=300,  # Recycle connections after 5 minutes of inactivity
    pool_timeout=30,  # Time to wait for a connection from the pool
)

# Instrument SQLAlchemy with Logfire for monitoring
logfire.instrument_sqlalchemy(engine=engine)


# --- FastAPI Lifecycle Event Handlers ---


async def connect_to_db(app: FastAPI) -> None:
    """
    FastAPI startup event handler.
    Initializes the database connection and creates all tables if they don't exist.
    """
    try:
        # Assign the engine to the FastAPI app state for easy access in routes
        app.db_engine = engine  # type: ignore

        # Create all tables defined by SQLModel metadata.
        # This is called only once at application startup.
        SQLModel.metadata.create_all(engine)
        logger.info("OpenU database tables checked/created successfully.")
        logger.info("OpenU database connection established.")
    except Exception as e:
        logger.exception(
            "Failed to connect to the database or create tables. "
            "Make sure you have a database running and accessible. Error: %s",
            e,
        )
        # Depending on your application's needs, you might want to re-raise
        # the exception or exit here if database connection is critical.
        raise


async def close_database(app: FastAPI) -> None:
    """
    FastAPI shutdown event handler.
    Performs cleanup operations, if any (e.g., closing the engine, though SQLAlchemy
    handles connection pooling gracefully).
    """
    logger.info("OpenU database connection shutting down.")
    # In most cases, explicit engine disposal isn't strictly necessary for
    # simple applications, as connections are managed by the pool.
    # However, for long-running processes or specific cleanup, you might add:
    # if hasattr(app, 'db_engine') and app.db_engine:
    #     app.db_engine.dispose()
    logger.info("OpenU database has been shut down.")


# --- Database Session Dependency ---


def get_db_session() -> Iterator[Session]:
    """
    FastAPI dependency that provides a database session.
    The session is automatically closed after the request is processed.
    """
    with Session(engine) as session:
        yield session
