from sqlalchemy import create_engine, text

from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.connection_url())

with engine.connect() as conn:
    result = conn.execute(text("SELECT version_num FROM alembic_version"))
    print("Current migration:", result.scalar())

    # Check if permissions table has data
    result = conn.execute(text("SELECT COUNT(*) FROM permissions"))
    print("Permissions count:", result.scalar())

    # Check if role_permissions table has data
    result = conn.execute(text("SELECT COUNT(*) FROM role_permissions"))
    print("Role permissions count:", result.scalar())
