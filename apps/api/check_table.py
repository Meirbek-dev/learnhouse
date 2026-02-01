"""Check if user_permissions table exists."""
from src.core.events.database import get_db_session
from sqlalchemy import text

session = next(get_db_session())
result = session.execute(
    text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_permissions');")
)
exists = result.scalar()
print(f"user_permissions table exists: {exists}")

if exists:
    # Check how many rows
    count_result = session.execute(text("SELECT COUNT(*) FROM user_permissions"))
    count = count_result.scalar()
    print(f"Rows in user_permissions: {count}")
