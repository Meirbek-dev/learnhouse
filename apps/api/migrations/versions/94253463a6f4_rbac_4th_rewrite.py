"""RBAC 4th rewrite

Revision ID: 94253463a6f4
Revises: c525ba58794c
Create Date: 2026-01-28 00:09:19.754951

This migration adds performance optimizations and helper functions:
1. Adds index on role_permissions for faster lookups
2. Adds index on resource_permissions for resource-level checks
3. Adds database function to check role hierarchy efficiently
4. Optimizes permission lookups
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "94253463a6f4"
down_revision: Union[str, None] = "c525ba58794c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with performance optimizations."""
    conn = op.get_bind()

    # 1. Add composite indexes for faster permission lookups
    print("Adding performance indexes...")

    # Index for role_permissions to speed up role-based permission checks
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_role_permissions_role_perm
        ON role_permissions (role_id, permission_id)
        WHERE deleted_at IS NULL
    """))

    # Index for resource_permissions to speed up resource-level checks
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_resource_permissions_lookup
        ON resource_permissions (user_id, resource_type, resource_id)
        WHERE expires_at IS NULL OR expires_at > NOW()
    """))

    # Index for faster user role queries with org filtering
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_user_roles_org_user
        ON user_roles (org_id, user_id)
        WHERE expires_at IS NULL OR expires_at > NOW()
    """))

    # 2. Create recursive function to get role hierarchy efficiently
    print("Creating role hierarchy helper function...")
    conn.execute(text("""
        CREATE OR REPLACE FUNCTION get_role_hierarchy(role_id_param INTEGER, max_depth INTEGER DEFAULT 10)
        RETURNS TABLE(role_id INTEGER, role_name VARCHAR, depth INTEGER) AS $$
        WITH RECURSIVE role_tree AS (
            -- Base case: the role itself
            SELECT
                id as role_id,
                name as role_name,
                parent_role_id,
                0 as depth
            FROM roles
            WHERE id = role_id_param

            UNION ALL

            -- Recursive case: parent roles
            SELECT
                r.id,
                r.name,
                r.parent_role_id,
                rt.depth + 1
            FROM roles r
            INNER JOIN role_tree rt ON r.id = rt.parent_role_id
            WHERE rt.depth < max_depth  -- Prevent infinite loops
        )
        SELECT role_id, role_name, depth
        FROM role_tree
        ORDER BY depth;
        $$ LANGUAGE SQL STABLE;
    """))

    # 3. Create function to efficiently check if user has permission
    print("Creating permission check helper function...")
    conn.execute(text("""
        CREATE OR REPLACE FUNCTION user_has_permission(
            user_id_param INTEGER,
            action_param VARCHAR,
            resource_param VARCHAR,
            scope_param VARCHAR,
            org_id_param INTEGER DEFAULT NULL
        )
        RETURNS BOOLEAN AS $$
        DECLARE
            has_perm BOOLEAN;
        BEGIN
            -- Check if user has permission through any of their active roles
            SELECT EXISTS (
                SELECT 1
                FROM user_roles ur
                INNER JOIN roles r ON ur.role_id = r.id
                INNER JOIN role_permissions rp ON r.id = rp.role_id
                INNER JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = user_id_param
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                    AND (org_id_param IS NULL OR ur.org_id = org_id_param)
                    AND p.action = action_param
                    AND p.resource = resource_param
                    AND p.scope = scope_param
                    AND (rp.deleted_at IS NULL)
            ) INTO has_perm;

            RETURN has_perm;
        END;
        $$ LANGUAGE plpgsql STABLE;
    """))

    # 4. Add missing index on permissions for lookup efficiency
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_permissions_action_resource_scope
        ON permissions (action, resource, scope)
    """))

    print("✅ RBAC v4 migration completed successfully")


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()

    # Drop functions
    conn.execute(text("DROP FUNCTION IF EXISTS get_role_hierarchy(INTEGER, INTEGER)"))
    conn.execute(text("DROP FUNCTION IF EXISTS user_has_permission(INTEGER, VARCHAR, VARCHAR, VARCHAR, INTEGER)"))

    # Drop indexes
    conn.execute(text("DROP INDEX IF EXISTS ix_role_permissions_role_perm"))
    conn.execute(text("DROP INDEX IF EXISTS ix_resource_permissions_lookup"))
    conn.execute(text("DROP INDEX IF EXISTS ix_user_roles_org_user"))
    conn.execute(text("DROP INDEX IF EXISTS ix_permissions_action_resource_scope"))
