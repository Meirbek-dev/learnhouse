"""RBAC rewrite 2

Revision ID: afaf068e905d
Revises: 69fd16a5d534
Create Date: 2026-01-26 20:00:31.244296

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "afaf068e905d"
down_revision: Union[str, None] = "69fd16a5d534"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Migrate old Rights model to new permissions system.

    1. Migrate roles.rights (JSON) to role_permissions entries
    2. Remove rights column from roles table
    """
    conn = op.get_bind()

    # Step 1: Fetch all roles with their rights
    result = conn.execute(
        text("""
        SELECT id, role_uuid, rights, org_id
        FROM role
        WHERE rights IS NOT NULL AND rights::text != '{}'::text
    """)
    )

    roles_with_rights = result.fetchall()

    # Step 2: Map old rights to new permissions
    # Resource types mapping: old -> new
    resource_mapping = {
        "courses": "course",
        "users": "user",
        "usergroups": "usergroup",
        "collections": "collection",
        "organizations": "organization",
        "coursechapters": "chapter",
        "activities": "activity",
        "roles": "role",
        "dashboard": "dashboard",
    }

    # Action mapping: old -> new
    action_mapping = {
        "action_create": "create",
        "action_read": "read",
        "action_read_own": "read",  # Will use scope 'own'
        "action_update": "update",
        "action_update_own": "update",  # Will use scope 'own'
        "action_delete": "delete",
        "action_delete_own": "delete",  # Will use scope 'own'
        "action_access": "read",  # Dashboard access -> read
    }

    for role_row in roles_with_rights:
        role_uuid = role_row[1]
        rights = role_row[2]  # JSON object

        if not rights or not isinstance(rights, dict):
            continue

        # Map role_uuid to slug (role_uuid format: "role_global_admin" -> slug: "admin")
        # For system roles, extract the last part after the last underscore
        slug = role_uuid.split("_")[-1] if role_uuid else None
        if not slug:
            continue

        # Find or create the corresponding role in roles_new table using slug
        role_new_result = conn.execute(
            text("""
            SELECT id FROM roles_new WHERE slug = :slug
        """),
            {"slug": slug},
        )

        role_new_row = role_new_result.fetchone()
        if not role_new_row:
            # Role doesn't exist in new system, skip
            continue

        role_new_id = role_new_row[0]

        # Process each resource type in rights
        for old_resource, permissions in rights.items():
            if old_resource not in resource_mapping:
                continue

            new_resource = resource_mapping[old_resource]

            if not isinstance(permissions, dict):
                continue

            # Process each permission action
            for old_action, enabled in permissions.items():
                if not enabled or old_action not in action_mapping:
                    continue

                new_action = action_mapping[old_action]

                # Determine scope
                scope = "own" if "own" in old_action.lower() else "all"

                # Find the permission in the permissions table
                permission_result = conn.execute(
                    text("""
                    SELECT id FROM permissions
                    WHERE action = :action
                    AND resource_type = :resource_type
                    AND scope = :scope
                """),
                    {
                        "action": new_action,
                        "resource_type": new_resource,
                        "scope": scope,
                    },
                )

                permission_row = permission_result.fetchone()
                if not permission_row:
                    # Permission doesn't exist, skip
                    continue

                permission_id = permission_row[0]

                # Check if role_permission already exists
                existing = conn.execute(
                    text("""
                    SELECT 1 FROM role_permissions
                    WHERE role_id = :role_id AND permission_id = :permission_id
                """),
                    {"role_id": role_new_id, "permission_id": permission_id},
                )

                if existing.fetchone():
                    # Already exists, skip
                    continue

                # Create role_permission entry
                conn.execute(
                    text("""
                    INSERT INTO role_permissions (role_id, permission_id, granted_at)
                    VALUES (:role_id, :permission_id, NOW())
                """),
                    {"role_id": role_new_id, "permission_id": permission_id},
                )

    # Step 3: Remove rights column from role table
    op.drop_column("role", "rights")


def downgrade() -> None:
    """
    Restore the old Rights model.

    This is a partial downgrade - we cannot fully restore the exact rights state,
    but we restore the column structure.
    """
    # Add back the rights column with JSONB type
    op.add_column(
        "role", sa.Column("rights", sa.dialects.postgresql.JSON(), nullable=True)
    )
