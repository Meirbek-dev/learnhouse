"""Test script to check permission enum issue."""

from sqlalchemy import create_engine, text

from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with engine.connect() as conn:
    # Check column types
    result = conn.execute(
        text("""
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'permissions'
        AND column_name IN ('action', 'resource_type', 'scope')
    """)
    )
    print("Column types:")
    for row in result:
        print(f"  {row}")

    # Check actual values
    result = conn.execute(
        text("SELECT id, action, resource_type, scope FROM permissions LIMIT 5")
    )
    print("\nSample permission values:")
    for row in result:
        print(f"  {row}")

    # Check if there are uppercase values (cast enum to text for comparison)
    result = conn.execute(
        text(
            "SELECT COUNT(*) as cnt FROM permissions WHERE action::text != LOWER(action::text)"
        )
    )
    uppercase_count = result.fetchone()[0]
    print(f"\nPermissions with uppercase action: {uppercase_count}")

    # Verify all enum values are lowercase
    result = conn.execute(
        text("""
        SELECT COUNT(*) as cnt FROM permissions
        WHERE resource_type::text != LOWER(resource_type::text)
        OR action::text != LOWER(action::text)
        OR scope::text != LOWER(scope::text)
        """)
    )
    total_uppercase = result.fetchone()[0]
    print(f"Total permissions with any uppercase enum values: {total_uppercase}")

    if total_uppercase == 0:
        print("✅ All enum values are lowercase!")
