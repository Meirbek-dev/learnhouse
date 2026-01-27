"""RBAC 3rd rewrite

Revision ID: a54a941bd13e
Revises: 91512ce105e5
Create Date: 2026-01-27 18:06:10.963754

This migration:
1. Adds composite index for user_roles (user_id, org_id) for performance
2. Ensures RBAC schema integrity
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'a54a941bd13e'
down_revision: Union[str, None] = '91512ce105e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # Add composite index for user_roles if not exists
    # This improves performance for common lookups by user_id + org_id
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_user_roles_user_org
        ON user_roles (user_id, org_id)
    """))

    # Ensure role_permissions has index on role_id (may already exist)
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_role_permissions_role_id
        ON role_permissions (role_id)
    """))

    # Ensure resource_permissions has composite index for lookups
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_resource_permissions_user_resource
        ON resource_permissions (user_id, resource_type, resource_id)
    """))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()

    # Remove added indexes
    conn.execute(text("DROP INDEX IF EXISTS ix_user_roles_user_org"))
    conn.execute(text("DROP INDEX IF EXISTS ix_role_permissions_role_id"))
    conn.execute(text("DROP INDEX IF EXISTS ix_resource_permissions_user_resource"))
