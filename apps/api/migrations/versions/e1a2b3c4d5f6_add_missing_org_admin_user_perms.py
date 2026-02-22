"""Add missing org-admin user management permissions

Revision ID: e1a2b3c4d5f6
Revises: d8f9a1e3b5f9
Create Date: 2026-02-10 12:00:00.000000

Add user:create:org, user:delete:org, and user:invite:org permissions
and assign them to the org-admin system role.
"""

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "e1a2b3c4d5f6"
down_revision = "d8f9a1e3b5f9"
branch_labels = None
depends_on = None

NEW_PERMISSIONS = [
    "user:create:org",
    "user:delete:org",
    "user:invite:org",
]


def upgrade() -> None:
    conn = op.get_bind()

    # Get org-admin role id
    role_row = conn.execute(
        text("SELECT id FROM roles WHERE slug = 'org-admin' AND is_system = true")
    ).fetchone()
    if role_row is None:
        # Role doesn't exist yet; seed_default_roles() will handle it on next startup
        return
    role_id = role_row[0]

    for perm_name in NEW_PERMISSIONS:
        resource, action, scope = perm_name.split(":")

        # Upsert permission row
        perm_row = conn.execute(
            text("SELECT id FROM permissions WHERE name = :name"),
            {"name": perm_name},
        ).fetchone()
        if perm_row is None:
            conn.execute(
                text(
                    "INSERT INTO permissions (name, resource_type, action, scope) "
                    "VALUES (:name, :resource, :action, :scope)"
                ),
                {
                    "name": perm_name,
                    "resource": resource,
                    "action": action,
                    "scope": scope,
                },
            )
            perm_row = conn.execute(
                text("SELECT id FROM permissions WHERE name = :name"),
                {"name": perm_name},
            ).fetchone()

        perm_id = perm_row[0]

        # Link permission to org-admin role (if not already linked)
        existing = conn.execute(
            text(
                "SELECT 1 FROM role_permissions "
                "WHERE role_id = :role_id AND permission_id = :perm_id"
            ),
            {"role_id": role_id, "perm_id": perm_id},
        ).fetchone()
        if existing is None:
            conn.execute(
                text(
                    "INSERT INTO role_permissions (role_id, permission_id, granted_at) "
                    "VALUES (:role_id, :perm_id, CURRENT_TIMESTAMP)"
                ),
                {"role_id": role_id, "perm_id": perm_id},
            )


def downgrade() -> None:
    conn = op.get_bind()

    # Get org-admin role id
    role_row = conn.execute(
        text("SELECT id FROM roles WHERE slug = 'org-admin' AND is_system = true")
    ).fetchone()
    if role_row is None:
        return
    role_id = role_row[0]

    for perm_name in NEW_PERMISSIONS:
        perm_row = conn.execute(
            text("SELECT id FROM permissions WHERE name = :name"),
            {"name": perm_name},
        ).fetchone()
        if perm_row is None:
            continue
        perm_id = perm_row[0]

        # Remove role-permission link
        conn.execute(
            text(
                "DELETE FROM role_permissions "
                "WHERE role_id = :role_id AND permission_id = :perm_id"
            ),
            {"role_id": role_id, "perm_id": perm_id},
        )

        # Remove permission if no longer referenced by any role
        conn.execute(
            text(
                "DELETE FROM permissions WHERE id = :perm_id "
                "AND NOT EXISTS ("
                "  SELECT 1 FROM role_permissions WHERE permission_id = :perm_id"
                ")"
            ),
            {"perm_id": perm_id},
        )
