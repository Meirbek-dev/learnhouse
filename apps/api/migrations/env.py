import importlib
import os
from pathlib import Path
from logging.config import fileConfig

from alembic import context
import sqlalchemy as sa
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel
from sqlmodel.sql.sqltypes import AutoString

from config.config import get_settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

database_url = (
    get_settings().database_config.sql_connection_string
    or config.get_main_option("sqlalchemy.url")
)
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata

# Tables that share the database but are not managed by SQLModel metadata.
_AUTOGENERATE_EXCLUDED_TABLES = {
    "ar_internal_metadata",
    "chapteractivity",
    "clients",
    "coursechapter",
    "document_chunks",
    "languages",
    "schema_migrations",
    "submissions",
}

# IMPORTING ALL SCHEMAS
project_root = Path(__file__).resolve().parents[1]
base_dir = project_root / "src" / "db"
base_module_path = "src.db"

# Recursively walk through the base directory
for root, _dirs, files in os.walk(base_dir):
    # Filter out __init__.py and non-Python files
    module_files = [f for f in files if f.endswith(".py") and f != "__init__.py"]
    # Calculate the module's base path from its directory structure
    path_diff = os.path.relpath(root, str(base_dir))
    if path_diff == ".":
        # Root of the base_dir, no additional path to add
        current_module_base = base_module_path
    else:
        # Convert directory path to a module path
        current_module_base = f"{base_module_path}.{path_diff.replace(os.sep, '.')}"

    # Dynamically import each module
    for file_name in module_files:
        module_name = file_name[:-3]  # Remove the '.py' extension
        full_module_path = f"{current_module_base}.{module_name}"
        importlib.import_module(full_module_path)

# IMPORTING ALL SCHEMAS

target_metadata = SQLModel.metadata


def include_object(object_, name: str | None, type_: str, reflected: bool, compare_to):
    if not name:
        return True

    table_name = name
    if type_ != "table":
        parent_table = getattr(object_, "table", None)
        if parent_table is not None and getattr(parent_table, "name", None):
            table_name = parent_table.name

    if reflected and compare_to is None and table_name in _AUTOGENERATE_EXCLUDED_TABLES:
        return False

    return True


def compare_type(
    _context,
    _inspected_column,
    _metadata_column,
    inspected_type,
    metadata_type,
):
    stringish_types = (sa.String, sa.Text, AutoString)
    if isinstance(inspected_type, stringish_types) and isinstance(
        metadata_type, stringish_types
    ):
        return False

    return None

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=compare_type,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connect_args = {}
    if database_url and database_url.startswith("postgresql+"):
        connect_args["connect_timeout"] = 5

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=compare_type,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
