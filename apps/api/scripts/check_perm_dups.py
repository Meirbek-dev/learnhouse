"""Check for duplicate permissions and unique constraints."""
import sys
sys.path.insert(0, "x:\\ashyq-bilim\\apps\\api")

from config.config import get_platform_config
from sqlmodel import create_engine, Session, text

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with Session(engine) as s:
    dups = s.exec(text(
        "SELECT name, COUNT(*) c FROM permissions GROUP BY name HAVING COUNT(*) > 1 ORDER BY c DESC LIMIT 10"
    )).fetchall()
    print("Duplicate permission names:")
    for row in dups:
        print(f"  {row[1]}x {row[0]}")
    if not dups:
        print("  None - all unique")

    idx = s.exec(text(
        "SELECT indexname FROM pg_indexes WHERE tablename='permissions' AND indexdef LIKE '%unique%' OR "
        "tablename='permissions' AND indexname LIKE '%uq%' OR "
        "tablename='permissions' AND indexname LIKE '%unique%'"
    )).fetchall()
    print("Unique-related indexes on permissions:")
    for row in idx:
        print(f"  {row[0]}")
