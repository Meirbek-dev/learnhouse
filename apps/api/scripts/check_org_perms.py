"""Quick check: admin org permissions after resync migration."""

import sys
sys.path.insert(0, ".")

from config.config import get_platform_config
from sqlmodel import create_engine, Session, text

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with Session(engine) as s:
    # Admin org permissions
    rows = s.exec(text("""
        SELECT p.name FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.slug = 'admin' AND r.org_id IS NULL
          AND p.name LIKE 'organization:%'
        ORDER BY p.name
    """)).fetchall()
    print("Admin org permissions:")
    for row in rows:
        print(f"  {row[0]}")

    # Total counts
    total_perms = s.exec(text("SELECT COUNT(*) FROM permissions")).one()[0]
    total_rp = s.exec(text("SELECT COUNT(*) FROM role_permissions")).one()[0]
    print(f"\nTotal permissions: {total_perms}")
    print(f"Total role_permissions: {total_rp}")

    # Check specific key permission
    has_org_read_org = s.exec(text(
        "SELECT COUNT(*) FROM role_permissions rp "
        "JOIN roles r ON r.id = rp.role_id "
        "JOIN permissions p ON p.id = rp.permission_id "
        "WHERE r.slug = 'admin' AND r.org_id IS NULL AND p.name = 'organization:read:org'"
    )).one()[0]
    print(f"\nadmin has organization:read:org: {'YES' if has_org_read_org else 'NO'}")
