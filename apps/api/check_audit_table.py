"""Check permission_audit_log table structure."""

from sqlalchemy import create_engine, text

from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with engine.connect() as conn:
    result = conn.execute(
        text("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'permission_audit_log'
        ORDER BY ordinal_position
    """)
    )

    print("Columns in permission_audit_log table:")
    for row in result:
        print(f"  {row[0]}: {row[1]} (nullable: {row[2]})")
