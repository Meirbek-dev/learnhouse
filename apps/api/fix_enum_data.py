"""Fix enum data in database tables to match uppercase enum definitions."""

from sqlalchemy import create_engine, text

from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

# First, check what data exists
print("Checking current enum values in tables...")
with engine.connect() as conn:
    # Check permissions table
    result = conn.execute(
        text("""
        SELECT DISTINCT resource_type, action, scope
        FROM permissions
        LIMIT 20
    """)
    )

    print("\nSample data from permissions table:")

with engine.begin() as conn:
    # Update resource_type in permissions table
    print("\nUpdating permissions.resource_type...")
    result = conn.execute(
        text("""
        UPDATE permissions
        SET resource_type = UPPER(resource_type::text)::resourcetype
        WHERE resource_type::text != UPPER(resource_type::text)
    """)
    )
    print(f"  Updated {result.rowcount} rows")

    # Update action in permissions table
    print("\nUpdating permissions.action...")
    result = conn.execute(
        text("""
        UPDATE permissions
        SET action = UPPER(action::text)::action
        WHERE action::text != UPPER(action::text)
    """)
    )
    print(f"  Updated {result.rowcount} rows")

    # Update scope in permissions table
    print("\nUpdating permissions.scope...")
    result = conn.execute(
        text("""
        UPDATE permissions
        SET scope = UPPER(scope::text)::scope
        WHERE scope::text != UPPER(scope::text)
    """)
    )
    print(f"  Updated {result.rowcount} rows")

print("\n✅ Database enum values updated to UPPERCASE")

# Verify the update
print("\nVerifying updated data...")
with engine.connect() as conn:
    result = conn.execute(
        text("""
        SELECT DISTINCT resource_type, action, scope
        FROM permissions
        LIMIT 20
    """)
    )

    print("\nSample data after update:")
    for row in result:
        print(f"  resource_type: {row[0]}, action: {row[1]}, scope: {row[2]}")
