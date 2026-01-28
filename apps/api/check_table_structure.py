from sqlalchemy import create_engine, inspect, text

from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

inspector = inspect(engine)

print("userorganization table columns:")
for column in inspector.get_columns("userorganization"):
    print(
        f"  {column['name']}: {column['type']} {'NOT NULL' if not column['nullable'] else 'NULL'}"
    )

print("\nuser_roles table columns:")
for column in inspector.get_columns("user_roles"):
    print(
        f"  {column['name']}: {column['type']} {'NOT NULL' if not column['nullable'] else 'NULL'}"
    )

with engine.connect() as conn:
    uo_count = conn.execute(text("SELECT COUNT(*) FROM userorganization")).scalar()
    ur_count = conn.execute(text("SELECT COUNT(*) FROM user_roles")).scalar()
    print(f"\nuserorganization count: {uo_count}")
    print(f"user_roles count: {ur_count}")
