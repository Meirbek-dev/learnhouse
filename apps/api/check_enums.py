"""Check PostgreSQL enum types."""

from sqlalchemy import create_engine, text

from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with engine.connect() as conn:
    result = conn.execute(
        text("""
        SELECT e.enumtypid::regtype AS enum_type, e.enumlabel AS enum_value
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname IN ('resourcetype', 'action', 'scope')
        ORDER BY t.typname, e.enumsortorder
    """)
    )

    print("PostgreSQL ENUM values:")
    current_type = None
    for row in result:
        if row[0] != current_type:
            current_type = row[0]
            print(f"\n{row[0]}:")
        print(f"  - {row[1]}")
