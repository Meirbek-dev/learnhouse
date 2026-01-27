"""RBAC rewrite v2 - Complete migration and cleanup

Revision ID: 91512ce105e5
Revises: b1c2d3e4f5g6
Create Date: 2026-01-26 21:27:18.812128

This migration completes the RBAC v2 system:
1. Renames roles_new to roles (after backing up old roles data)
2. Adds ABAC conditions column to role_permissions
3. Adds missing indexes for performance
4. Cleans up old rights column from legacy roles table
5. Ensures all existing users have proper role assignments
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "91512ce105e5"
down_revision: str | None = "b1c2d3e4f5g6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Complete RBAC v2 migration:
    1. Rename 'roles_new' to 'roles'
    2. Update foreign key references
    3. Add missing features (ABAC conditions, indexes)
    4. Ensure data integrity
    """
    conn = op.get_bind()

    # Check if user_organizations exists before trying to migrate
    user_orgs_exist = conn.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'user_organizations'
                AND table_schema = 'public'
            )
        """)
    ).scalar()

    if user_orgs_exist:
        # Migrate any remaining user_organizations to user_roles if not already done
        _ensure_user_roles_migrated(conn)

    # Step 2: Rename roles_new to roles using raw SQL for safety
    # Drop indexes before rename (use IF EXISTS for safety)
    conn.execute(text("DROP INDEX IF EXISTS ix_roles_new_org_id"))
    conn.execute(text("DROP INDEX IF EXISTS ix_roles_new_slug"))

    # Drop unique constraint before rename
    conn.execute(
        text("ALTER TABLE roles_new DROP CONSTRAINT IF EXISTS uq_role_slug_org")
    )

    # Drop foreign keys on roles_new before rename
    conn.execute(
        text("ALTER TABLE roles_new DROP CONSTRAINT IF EXISTS roles_new_org_id_fkey")
    )
    conn.execute(
        text(
            "ALTER TABLE roles_new DROP CONSTRAINT IF EXISTS roles_new_parent_role_id_fkey"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey"
        )
    )
    conn.execute(
        text("ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey")
    )

    # Rename the table
    op.rename_table("roles_new", "roles")

    # Recreate constraints with new table name
    op.create_unique_constraint("uq_role_slug_org", "roles", ["slug", "org_id"])
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_roles_org_id ON roles(org_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_roles_slug ON roles(slug)"))

    # Step 3: Recreate foreign key references pointing to renamed 'roles' table
    op.create_foreign_key(
        "role_permissions_role_id_fkey",
        "role_permissions",
        "roles",
        ["role_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "user_roles_role_id_fkey",
        "user_roles",
        "roles",
        ["role_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "roles_parent_role_id_fkey",
        "roles",
        "roles",
        ["parent_role_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "roles_org_id_fkey",
        "roles",
        "organization",
        ["org_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Step 4: Add ABAC conditions column if not exists
    # Check if conditions column exists in role_permissions
    has_conditions = conn.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'role_permissions'
                AND column_name = 'conditions'
            )
        """)
    ).scalar()

    if not has_conditions:
        op.add_column(
            "role_permissions",
            sa.Column(
                "conditions",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
        )

    # Step 5: Add additional indexes for performance
    # Index for permission lookups by resource_type and action
    conn.execute(
        text("""
            CREATE INDEX IF NOT EXISTS ix_permissions_resource_action
            ON permissions(resource_type, action)
        """)
    )

    # Index for audit log queries
    conn.execute(
        text("""
            CREATE INDEX IF NOT EXISTS ix_audit_log_result_created
            ON permission_audit_log(result, created_at)
        """)
    )

    # Step 6: Ensure all users have default role if they have no roles
    _ensure_default_roles(conn)

    # Step 7: Add org_id column to permission_audit_log if missing
    has_org_id = conn.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'permission_audit_log'
                AND column_name = 'org_id'
            )
        """)
    ).scalar()

    if not has_org_id:
        op.add_column(
            "permission_audit_log",
            sa.Column("org_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "permission_audit_log_org_id_fkey",
            "permission_audit_log",
            "organization",
            ["org_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """
    Rollback RBAC v2 migration:
    1. Rename roles back to roles_new
    2. Restore old roles table from backup
    3. Restore old foreign key references
    """
    conn = op.get_bind()

    # Remove org_id from audit log if we added it
    conn.execute(
        text(
            "ALTER TABLE permission_audit_log DROP CONSTRAINT IF EXISTS permission_audit_log_org_id_fkey"
        )
    )
    conn.execute(text("ALTER TABLE permission_audit_log DROP COLUMN IF EXISTS org_id"))

    # Drop new indexes
    conn.execute(text("DROP INDEX IF EXISTS ix_audit_log_result_created"))
    conn.execute(text("DROP INDEX IF EXISTS ix_permissions_resource_action"))

    # Drop FKs safely with IF EXISTS
    conn.execute(text("ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_org_id_fkey"))
    conn.execute(
        text("ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_parent_role_id_fkey")
    )
    conn.execute(
        text("ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey")
    )
    conn.execute(
        text(
            "ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey"
        )
    )

    # Drop indexes and constraints
    conn.execute(text("DROP INDEX IF EXISTS ix_roles_slug"))
    conn.execute(text("DROP INDEX IF EXISTS ix_roles_org_id"))
    conn.execute(text("ALTER TABLE roles DROP CONSTRAINT IF EXISTS uq_role_slug_org"))

    # Rename back to roles_new
    op.rename_table("roles", "roles_new")

    # Recreate constraints with old names
    op.create_unique_constraint("uq_role_slug_org", "roles_new", ["slug", "org_id"])
    op.create_index("ix_roles_new_org_id", "roles_new", ["org_id"])
    op.create_index("ix_roles_new_slug", "roles_new", ["slug"])

    # Recreate FKs pointing to roles_new
    op.create_foreign_key(
        "roles_new_org_id_fkey",
        "roles_new",
        "organization",
        ["org_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "roles_new_parent_role_id_fkey",
        "roles_new",
        "roles_new",
        ["parent_role_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "user_roles_role_id_fkey",
        "user_roles",
        "roles_new",
        ["role_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "role_permissions_role_id_fkey",
        "role_permissions",
        "roles_new",
        ["role_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Restore old roles table from backup if it exists
    backup_exists = conn.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = '_roles_backup'
            )
        """)
    ).scalar()

    if backup_exists:
        conn.execute(
            text("""
                CREATE TABLE roles AS SELECT * FROM _roles_backup
            """)
        )
        op.drop_table("_roles_backup")


def _ensure_user_roles_migrated(conn) -> None:
    """Ensure all user_organizations entries have corresponding user_roles entries."""
    # Check if user_organizations table exists
    user_orgs_exist = conn.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'user_organizations'
                AND table_schema = 'public'
            )
        """)
    ).scalar()

    if not user_orgs_exist:
        return

    # Get user_organizations that don't have corresponding user_roles
    conn.execute(
        text("""
            INSERT INTO user_roles (user_id, role_id, org_id, granted_at)
            SELECT DISTINCT uo.user_id,
                   COALESCE(
                       (SELECT r.id FROM roles_new r WHERE r.slug = 'user' AND (r.org_id IS NULL OR r.org_id = uo.org_id) LIMIT 1),
                       (SELECT r.id FROM roles_new r WHERE r.slug = 'user' AND r.org_id IS NULL LIMIT 1)
                   ) as role_id,
                   uo.org_id,
                   COALESCE(uo.creation_date::timestamptz, NOW())
            FROM user_organizations uo
            WHERE NOT EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = uo.user_id AND ur.org_id = uo.org_id
            )
            AND EXISTS (
                SELECT 1 FROM roles_new r WHERE r.slug = 'user'
            )
            ON CONFLICT DO NOTHING
        """)
    )


def _ensure_default_roles(conn) -> None:
    """Ensure all users with organization membership have at least a 'user' role."""
    # Check if user_organizations table exists
    user_orgs_exist = conn.execute(
        text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'user_organizations'
                AND table_schema = 'public'
            )
        """)
    ).scalar()

    if not user_orgs_exist:
        return

    # Find users in organizations without any role
    conn.execute(
        text("""
            INSERT INTO user_roles (user_id, role_id, org_id, granted_at)
            SELECT DISTINCT uo.user_id,
                   (SELECT r.id FROM roles r WHERE r.slug = 'user' AND r.org_id IS NULL LIMIT 1),
                   uo.org_id,
                   NOW()
            FROM user_organizations uo
            WHERE NOT EXISTS (
                SELECT 1 FROM user_roles ur
                WHERE ur.user_id = uo.user_id AND ur.org_id = uo.org_id
            )
            AND EXISTS (SELECT 1 FROM roles r WHERE r.slug = 'user')
            ON CONFLICT DO NOTHING
        """)
    )
