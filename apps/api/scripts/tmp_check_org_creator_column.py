import sqlalchemy as sa
from config.config import get_platform_config

engine = sa.create_engine(get_platform_config().database_config.sql_connection_string)
with engine.connect() as conn:
    row = conn.execute(
        sa.text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'organization'
              AND column_name = 'creator_id'
            """
        )
    ).fetchall()
    print(row)
