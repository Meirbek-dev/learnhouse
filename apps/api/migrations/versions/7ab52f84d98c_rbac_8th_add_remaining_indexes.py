"""rbac_8th_add_remaining_indexes

Revision ID: 7ab52f84d98c
Revises: a4359f97a23d
Create Date: 2026-01-28 20:11:59.214103

Add remaining indexes for optimal RBAC performance based on refactoring plan:
1. Composite index on resource_permissions(resource_type, resource_id) for lookup
2. Index on role_permissions(permission_id) for reverse lookups
3. Index on permissions(name) for permission name lookups
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7ab52f84d98c"
down_revision: Union[str, None] = "a4359f97a23d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with remaining RBAC indexes."""
    print("RBAC v8: Adding remaining performance indexes...")

    # 1. Add composite index on resource_permissions for resource lookups
    print("Creating index: idx_resource_permissions_type_id...")
    op.create_index(
        "idx_resource_permissions_type_id",
        "resource_permissions",
        ["resource_type", "resource_id"],
        unique=False,
        if_not_exists=True,
    )

    # 2. Add index on role_permissions permission_id for reverse lookups
    print("Creating index: idx_role_permissions_permission_id...")
    op.create_index(
        "idx_role_permissions_permission_id",
        "role_permissions",
        ["permission_id"],
        unique=False,
        if_not_exists=True,
    )

    # 3. Add index on permissions name for permission name lookups
    print("Creating index: idx_permissions_name...")
    op.create_index(
        "idx_permissions_name",
        "permissions",
        ["name"],
        unique=True,  # Permission names should be unique
        if_not_exists=True,
    )

    # 4. Add index on user_roles role_id for reverse lookups
    print("Creating index: idx_user_roles_role_id...")
    op.create_index(
        "idx_user_roles_role_id",
        "user_roles",
        ["role_id"],
        unique=False,
        if_not_exists=True,
    )

    print("✅ RBAC v8 migration complete - All performance indexes added")


def downgrade() -> None:
    """Downgrade schema by removing indexes."""
    print("RBAC v8: Removing indexes...")

    # Remove indexes in reverse order
    op.drop_index("idx_user_roles_role_id", table_name="user_roles", if_exists=True)
    op.drop_index("idx_permissions_name", table_name="permissions", if_exists=True)
    op.drop_index(
        "idx_role_permissions_permission_id",
        table_name="role_permissions",
        if_exists=True,
    )
    op.drop_index(
        "idx_resource_permissions_type_id",
        table_name="resource_permissions",
        if_exists=True,
    )

    print("✅ RBAC v8 downgrade complete")
