from sqlalchemy import create_engine, text
from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)
conn = engine.connect()

# Check distinct resource types in permissions table
perms = conn.execute(
    text("SELECT DISTINCT resource_type FROM permissions ORDER BY resource_type")
).fetchall()
print("Distinct resource_type values in permissions table:")
for p in perms:
    print(f"  {repr(p[0])}")

# Check PostgreSQL enum type
result = conn.execute(
    text("""
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'resourcetype'
    ORDER BY e.enumsortorder
""")
).fetchall()
print("\nPostgreSQL resourcetype enum values:")
for r in result:
    print(f"  {repr(r[1])}")
