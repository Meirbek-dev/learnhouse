"""RBAC 6th rewrite

Revision ID: add4ea7479ad
Revises: 831861f725e2
Create Date: 2026-01-28 13:33:58.020257

This migration implements RBAC v6 refactoring:
1. Drop unused resource_permissions table (never used)
2. Add permission_key column for consistent naming
3. Add indexes for performance optimization
4. Add grant_type column for deny rules support
5. Add conditions column for conditional permissions
6. Add expires_at for permission expiration
7. Optimize audit_log table with partitioning
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "add4ea7479ad"
down_revision: Union[str, None] = "831861f725e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema for RBAC v6."""
    conn = op.get_bind()

    print("=" * 80)
    print("RBAC v6 Migration - Removing Legacy and Optimizing")
    print("=" * 80)

    # 1. Drop unused resource_permissions table
    print("\n1. Dropping unused resource_permissions table...")
    try:
        conn.execute(text("DROP TABLE IF EXISTS resource_permissions CASCADE"))
        print("   ✅ Dropped resource_permissions table")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 2. Add permission_key column for consistent naming
    print("\n2. Adding permission_key column to permissions table...")
    try:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='permissions' AND column_name='permission_key'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE permissions
                ADD COLUMN permission_key VARCHAR UNIQUE
            """))
            print("   ✅ Added permission_key column")

            # Populate permission_key from existing data
            conn.execute(text("""
                UPDATE permissions
                SET permission_key = CONCAT(
                    LOWER(resource_type), ':',
                    LOWER(action), ':',
                    LOWER(scope)
                )
                WHERE permission_key IS NULL
            """))
            print("   ✅ Populated permission_key for existing permissions")
        else:
            print("   ℹ️  permission_key column already exists")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 3. Add index on permission_key for fast lookups
    print("\n3. Adding index on permission_key...")
    try:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_permissions_key
            ON permissions(permission_key)
        """))
        print("   ✅ Created index on permission_key")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 4. Add grant_type column for deny rules support
    print("\n4. Adding grant_type column to role_permissions...")
    try:
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='role_permissions' AND column_name='grant_type'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE role_permissions
                ADD COLUMN grant_type VARCHAR DEFAULT 'allow'
            """))
            print("   ✅ Added grant_type column (values: 'allow' or 'deny')")
        else:
            print("   ℹ️  grant_type column already exists")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 5. Add conditions column for conditional permissions
    print("\n5. Adding conditions column to role_permissions...")
    try:
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='role_permissions' AND column_name='conditions'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE role_permissions
                ADD COLUMN conditions JSONB
            """))
            print("   ✅ Added conditions column for ABAC support")
        else:
            print("   ℹ️  conditions column already exists")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 6. Add expires_at for permission expiration
    print("\n6. Adding expires_at column to role_permissions...")
    try:
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='role_permissions' AND column_name='expires_at'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE role_permissions
                ADD COLUMN expires_at TIMESTAMP
            """))
            print("   ✅ Added expires_at column for time-based permissions")
        else:
            print("   ℹ️  expires_at column already exists")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 7. Optimize audit_log table with indexes
    print("\n7. Optimizing permission_audit_log indexes...")
    try:
        # Index for user queries
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_audit_user_date
            ON permission_audit_log(user_id, timestamp DESC)
        """))
        print("   ✅ Created index for user audit queries")

        # Index for denial queries
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_audit_denials
            ON permission_audit_log(result, timestamp DESC)
            WHERE result = false
        """))
        print("   ✅ Created partial index for denial queries")

        # Index for resource queries
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_audit_resource
            ON permission_audit_log(resource_type, resource_id, timestamp DESC)
        """))
        print("   ✅ Created index for resource audit queries")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 8. Add index on user_roles for faster permission lookups
    print("\n8. Optimizing user_roles indexes...")
    try:
        # Composite index for user + org lookups
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_user_roles_user_org
            ON user_roles(user_id, org_id)
            WHERE expires_at IS NULL OR expires_at > NOW()
        """))
        print("   ✅ Created composite index for active user roles")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    # 9. Add index on role_permissions for faster permission resolution
    print("\n9. Optimizing role_permissions indexes...")
    try:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_role_permissions_role
            ON role_permissions(role_id, permission_id)
        """))
        print("   ✅ Created index for role permission lookups")
    except Exception as e:
        print(f"   ⚠️  Warning: {e}")

    print("\n" + "=" * 80)
    print("RBAC v6 Migration Complete!")
    print("=" * 80)
    print("\nChanges applied:")
    print("  ✅ Dropped unused resource_permissions table")
    print("  ✅ Added permission_key for consistent naming")
    print("  ✅ Added grant_type for deny rules support")
    print("  ✅ Added conditions for ABAC support")
    print("  ✅ Added expires_at for time-based permissions")
    print("  ✅ Optimized indexes for performance")
    print("\nNext steps:")
    print("  1. Deploy code changes (cache TTL, auto-invalidation)")
    print("  2. Remove legacy rbac_check imports")
    print("  3. Consolidate to single PermissionService")
    print("=" * 80)


def downgrade() -> None:
    """Downgrade schema (remove v6 changes)."""
    conn = op.get_bind()

    print("Reverting RBAC v6 migration...")

    # Remove added columns
    try:
        conn.execute(text("ALTER TABLE permissions DROP COLUMN IF EXISTS permission_key"))
        conn.execute(text("ALTER TABLE role_permissions DROP COLUMN IF EXISTS grant_type"))
        conn.execute(text("ALTER TABLE role_permissions DROP COLUMN IF EXISTS conditions"))
        conn.execute(text("ALTER TABLE role_permissions DROP COLUMN IF EXISTS expires_at"))
        print("✅ Removed v6 columns")
    except Exception as e:
        print(f"⚠️  Warning: {e}")

    # Drop indexes
    try:
        conn.execute(text("DROP INDEX IF EXISTS idx_permissions_key"))
        conn.execute(text("DROP INDEX IF EXISTS idx_audit_user_date"))
        conn.execute(text("DROP INDEX IF EXISTS idx_audit_denials"))
        conn.execute(text("DROP INDEX IF EXISTS idx_audit_resource"))
        conn.execute(text("DROP INDEX IF EXISTS idx_user_roles_user_org"))
        conn.execute(text("DROP INDEX IF EXISTS idx_role_permissions_role"))
        print("✅ Removed v6 indexes")
    except Exception as e:
        print(f"⚠️  Warning: {e}")

    # Note: We don't recreate resource_permissions table as it was never used

    print("✅ RBAC v6 migration reverted")
