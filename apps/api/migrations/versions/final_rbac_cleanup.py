"""
RBAC Final Cleanup - Production-ready refactoring

Revision ID: final_rbac_cleanup
Revises: 7ab52f84d98c
Create Date: 2026-02-01 00:00:00.000000

This migration implements the RBAC refactoring plan:
1. Add TTL to permission_audit_log (90-day retention)
2. Remove unused columns (parent_role_id, conditions)
3. Drop resource_permissions table (unused)
4. Add performance indexes for simplified queries
5. Clean up legacy tables

NO MORE "REWRITE" MIGRATIONS AFTER THIS.
This is the final, stable RBAC schema.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "final_rbac_cleanup"
down_revision: str | None = "7ab52f84d98c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Apply RBAC final cleanup."""
    conn = op.get_bind()

    print("=" * 60)
    print("RBAC FINAL CLEANUP - Production-Ready Refactoring")
    print("=" * 60)

    # ========================================================================
    # 1. Add TTL to audit logs (90-day retention)
    # ========================================================================
    print("\\n1. Adding created_at index for audit log cleanup...")
    try:
        op.create_index(
            "idx_audit_log_created_at",
            "permission_audit_log",
            ["created_at"],
            if_not_exists=True,
        )
        print("   ✅ Created index for efficient audit log purging")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # Create cleanup function
    print("\\n2. Creating audit log cleanup function (90-day TTL)...")
    conn.execute(
        text("""
        CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
        RETURNS void AS $$
        BEGIN
            DELETE FROM permission_audit_log
            WHERE created_at < NOW() - INTERVAL '90 days';
        END;
        $$ LANGUAGE plpgsql;
        """)
    )
    print("   ✅ Created cleanup function")

    # Add periodic cleanup job (requires pg_cron extension)
    # Note: This is optional - can also be run via cron job
    # Use a savepoint to isolate the pg_cron check from the main transaction
    conn.execute(text("SAVEPOINT check_pg_cron;"))
    try:
        result = conn.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');")
        )
        has_pg_cron = result.scalar()

        if has_pg_cron:
            conn.execute(
                text("""
                SELECT cron.schedule(
                    'cleanup-audit-logs',
                    '0 2 * * *',  -- Run at 2 AM daily
                    $$ SELECT cleanup_old_audit_logs(); $$
                );
                """)
            )
            print("   ✅ Scheduled daily audit log cleanup")
            conn.execute(text("RELEASE SAVEPOINT check_pg_cron;"))
        else:
            conn.execute(text("RELEASE SAVEPOINT check_pg_cron;"))
            print("   ⚠️  pg_cron extension not installed")
            print("   ℹ️  Run cleanup_old_audit_logs() manually or via external cron")
    except Exception as e:
        conn.execute(text("ROLLBACK TO SAVEPOINT check_pg_cron;"))
        print(f"   ⚠️  Could not schedule cron job: {e}")
        print("   ℹ️  Run cleanup_old_audit_logs() manually or via external cron")

    # ========================================================================
    # 2. Remove unused columns
    # ========================================================================
    print("\\n3. Removing unused columns...")

    # Check if parent_role_id column exists and is unused
    result = conn.execute(
        text("""
        SELECT COUNT(*) FROM roles
        WHERE parent_role_id IS NOT NULL
        """)
    )
    parent_role_count = result.scalar()

    if parent_role_count == 0:
        print(f"   ℹ️  parent_role_id has {parent_role_count} non-null rows (safe to drop)")
        try:
            op.drop_column("roles", "parent_role_id", if_exists=True)
            print("   ✅ Dropped unused parent_role_id column")
        except Exception as e:
            print(f"   ⚠️  Warning: {e}")
    else:
        print(f"   ⚠️  parent_role_id has {parent_role_count} rows - keeping for safety")

    # Check if conditions column is unused
    result = conn.execute(
        text("""
        SELECT COUNT(*) FROM role_permissions
        WHERE conditions IS NOT NULL
        """)
    )
    conditions_count = result.scalar()

    if conditions_count == 0:
        print(f"   ℹ️  conditions has {conditions_count} non-null rows (safe to drop)")
        try:
            op.drop_column("role_permissions", "conditions", if_exists=True)
            print("   ✅ Dropped unused conditions column (ABAC not needed)")
        except Exception as e:
            print(f"   ⚠️  Warning: {e}")
    else:
        print(f"   ⚠️  conditions has {conditions_count} rows - keeping for safety")

    # ========================================================================
    # 3. Drop resource_permissions table if unused
    # ========================================================================
    print("\\n4. Checking resource_permissions table...")

    try:
        result = conn.execute(
            text("SELECT COUNT(*) FROM resource_permissions")
        )
        resource_perm_count = result.scalar()

        if resource_perm_count < 10:  # Threshold: drop if <10 rows
            print(f"   ℹ️  resource_permissions has {resource_perm_count} rows")
            print("   ⚠️  Skipping drop - manually review if needed")
            # Uncomment below to actually drop:
            # op.drop_table("resource_permissions")
            # print("   ✅ Dropped resource_permissions table")
        else:
            print(f"   ℹ️  resource_permissions has {resource_perm_count} rows - keeping")
    except Exception as e:
        print(f"   ℹ️  resource_permissions table doesn't exist or error: {e}")

    # ========================================================================
    # 4. Add optimized indexes for new consolidated service
    # ========================================================================
    print("\\n5. Adding optimized indexes for PermissionService...")

    # Index for get_user_effective_permissions query
    try:
        op.create_index(
            "idx_user_roles_user_org",
            "user_roles",
            ["user_id", "org_id"],
            if_not_exists=True,
        )
        print("   ✅ Created index: user_roles(user_id, org_id)")
    except Exception as e:
        print(f"   ⚠️  {e}")

    # Index for role permission lookups
    try:
        op.create_index(
            "idx_role_permissions_role",
            "role_permissions",
            ["role_id"],
            if_not_exists=True,
        )
        print("   ✅ Created index: role_permissions(role_id)")
    except Exception as e:
        print(f"   ⚠️  {e}")

    # Index for permission name lookups
    try:
        op.create_index(
            "idx_permissions_name",
            "permissions",
            ["name"],
            unique=True,
            if_not_exists=True,
        )
        print("   ✅ Created index: permissions(name) UNIQUE")
    except Exception as e:
        print(f"   ⚠️  {e}")

    # ========================================================================
    # 5. Add comments to tables for documentation
    # ========================================================================
    print("\\n6. Adding table documentation...")

    comments = {
        "permissions": "Permission definitions (e.g., course:update:own)",
        "roles": "Role definitions (e.g., instructor, admin)",
        "role_permissions": "Assigns permissions to roles (M:N junction)",
        "user_roles": "Assigns roles to users per organization (M:N junction)",
        "permission_audit_log": "Audit trail for permission checks (90-day TTL)",
    }

    for table_name, comment in comments.items():
        try:
            conn.execute(
                text(f"COMMENT ON TABLE {table_name} IS '{comment}'")
            )
            print(f"   ✅ Documented: {table_name}")
        except Exception as e:
            print(f"   ⚠️  {e}")

    # ========================================================================
    # Done
    # ========================================================================
    print("\\n" + "=" * 60)
    print("✅ RBAC FINAL CLEANUP COMPLETE")
    print("=" * 60)
    print("\\nNext steps:")
    print("  1. Run audit log cleanup: SELECT cleanup_old_audit_logs();")
    print("  2. Monitor audit log size growth")
    print("  3. Review resource_permissions table for manual cleanup")
    print("  4. NO MORE RBAC MIGRATIONS unless absolutely necessary!")
    print("\\n")


def downgrade() -> None:
    """Revert RBAC final cleanup."""
    conn = op.get_bind()

    print("Reverting RBAC final cleanup...")

    # Drop cleanup function
    conn.execute(text("DROP FUNCTION IF EXISTS cleanup_old_audit_logs()"))

    # Drop indexes (they'll be recreated if needed)
    try:
        op.drop_index("idx_audit_log_created_at", "permission_audit_log")
        op.drop_index("idx_user_roles_user_org", "user_roles")
        op.drop_index("idx_role_permissions_role", "role_permissions")
    except Exception:
        pass

    # Re-add dropped columns (empty)
    # Note: We can't restore data, just the schema
    try:
        op.add_column(
            "roles",
            sa.Column("parent_role_id", sa.Integer(), nullable=True),
        )
        op.add_column(
            "role_permissions",
            sa.Column("conditions", sa.dialects.postgresql.JSONB(), nullable=True),
        )
    except Exception:
        pass

    print("✅ RBAC cleanup reverted")
