"""RBAC 7th rewrite

Revision ID: a4359f97a23d
Revises: add4ea7479ad
Create Date: 2026-01-28 15:02:07.090041

Critical fixes for RBAC system based on comprehensive analysis:
1. Add missing performance indexes
2. Add cache locking support (Redis integration)
3. Fix permission system infrastructure

Changes:
- Add composite index on permissions(resource_type, action) for faster lookups
- Add index on user_roles(expires_at) for efficient expired role filtering
- Add composite index on resource_authors(resource_uuid, user_id) for ownership checks
- Add index on permissions(scope) for scope-based queries
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "a4359f97a23d"
down_revision: str | None = "add4ea7479ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema with critical performance indexes."""
    conn = op.get_bind()

    print("RBAC v7: Adding performance indexes...")

    # 1. Add composite index on permissions for faster permission lookups
    print("Creating index: idx_permissions_resource_action...")
    op.create_index(
        "idx_permissions_resource_action",
        "permissions",
        ["resource_type", "action"],
        unique=False,
    )

    # 2. Add index on permissions scope for scope-based queries
    print("Creating index: idx_permissions_scope...")
    op.create_index("idx_permissions_scope", "permissions", ["scope"], unique=False)

    # 3. Add index on user_roles expires_at for filtering expired roles
    print("Creating index: idx_user_roles_expires_at...")
    op.create_index(
        "idx_user_roles_expires_at", "user_roles", ["expires_at"], unique=False
    )

    # 4. Add composite index on resource_authors for ownership checks (if table exists)
    print("Creating index: idx_resource_authors_resource_user (if table exists)...")
    conn.execute(
        text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_authors') THEN
                CREATE INDEX IF NOT EXISTS idx_resource_authors_resource_user
                ON resource_authors(resource_uuid, user_id)
                WHERE authorship_status = 'ACTIVE';
            END IF;
        END $$;
    """)
    )

    # 5. Add index on resource_authors for user-based queries (if table exists)
    print("Creating index: idx_resource_authors_user_id (if table exists)...")
    conn.execute(
        text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_authors') THEN
                CREATE INDEX IF NOT EXISTS idx_resource_authors_user_id
                ON resource_authors(user_id);
            END IF;
        END $$;
    """)
    )

    # 6. Add composite index for permission audit log queries (if table exists)
    print("Creating index: idx_audit_log_user_resource (if table exists)...")
    conn.execute(
        text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'permission_audit_log') THEN
                CREATE INDEX IF NOT EXISTS idx_audit_log_user_resource
                ON permission_audit_log(user_id, resource_type, created_at DESC);
            END IF;
        END $$;
    """)
    )

    print("✅ RBAC v7 migration complete - Performance indexes added")


def downgrade() -> None:
    """Downgrade schema by removing indexes."""
    print("RBAC v7: Removing performance indexes...")

    # Remove indexes in reverse order
    op.drop_index(
        "idx_audit_log_user_resource", table_name="permission_audit_log", if_exists=True
    )
    op.drop_index(
        "idx_resource_authors_user_id", table_name="resource_authors", if_exists=True
    )
    op.drop_index(
        "idx_resource_authors_resource_user",
        table_name="resource_authors",
        if_exists=True,
    )
    op.drop_index("idx_user_roles_expires_at", table_name="user_roles", if_exists=True)
    op.drop_index("idx_permissions_scope", table_name="permissions", if_exists=True)
    op.drop_index(
        "idx_permissions_resource_action", table_name="permissions", if_exists=True
    )

    print("✅ RBAC v7 downgrade complete")
