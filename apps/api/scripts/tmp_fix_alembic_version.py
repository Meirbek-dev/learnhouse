import sqlalchemy as sa
from config.config import get_platform_config

TARGET_REV = "69fd16a5d534"

engine = sa.create_engine(get_platform_config().database_config.sql_connection_string)
with engine.begin() as conn:
    conn.execute(sa.text("UPDATE alembic_version SET version_num = :rev"), {"rev": TARGET_REV})
    rows = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchall()
    print(rows)
