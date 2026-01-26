"""Test script to check permission enum issue."""
from config.config import get_platform_config
from sqlalchemy import create_engine, text

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with engine.connect() as conn:
    # Check column types
    result = conn.execute(text("""
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'permissions'
        AND column_name IN ('action', 'resource_type', 'scope')
    """))
    print("Column types:")
    for row in result:
        print(f"  {row}")

    # Check actual values
    result = conn.execute(text("SELECT id, action, resource_type, scope FROM permissions LIMIT 5"))
    print("\nSample permission values:")
    for row in result:
        print(f"  {row}")

    # Check if there are uppercase values
    result = conn.execute(text("SELECT COUNT(*) as cnt FROM permissions WHERE action != LOWER(action)"))
    uppercase_count = result.fetchone()[0]
    print(f"\nPermissions with uppercase action: {uppercase_count}")
