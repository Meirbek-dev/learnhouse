from sqlalchemy import create_engine, text
from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with engine.connect() as conn:
    result = conn.execute(
        text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'user%'
        ORDER BY table_name
    """)
    )
    print("User-related tables:")
    for row in result:
        print(f"  - {row[0]}")
