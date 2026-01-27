from sqlalchemy import create_engine, text
from config.config import get_platform_config

cfg = get_platform_config()
engine = create_engine(cfg.database_config.sql_connection_string)

with engine.connect() as conn:
    result = conn.execute(
        text("SELECT slug, name FROM roles WHERE org_id IS NULL ORDER BY slug")
    )
    print("\nRole names:")
    for row in result:
        print(f"  {row[0]}: {row[1]}")

    # Check org-admin to super-admin promotion
    result2 = conn.execute(
        text("""
        SELECT COUNT(*)
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE r.slug = 'org-admin' AND r.org_id IS NULL
    """)
    )
    org_admin_count = result2.scalar()

    result3 = conn.execute(
        text("""
        SELECT COUNT(*)
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE r.slug = 'super-admin' AND r.org_id IS NULL
    """)
    )
    super_admin_count = result3.scalar()

    print(f"\nOrganization Admin users: {org_admin_count}")
    print(f"Super Admin users: {super_admin_count}")
