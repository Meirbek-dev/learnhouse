"""Seed RBAC permissions

Revision ID: b1c2d3e4f5g6
Revises: afaf068e905d
Create Date: 2026-01-26 22:00:00.000000

This migration seeds the new RBAC system with default permissions
and assigns them to the standard roles (admin, maintainer, instructor, user).
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5g6"
down_revision: str | None = "afaf068e905d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Seed default permissions and assign them to roles."""
    conn = op.get_bind()

    # Define all permissions to create
    permissions = [
        # Course permissions
        ("course", "create", "org", "Create courses in organization"),
        ("course", "read", "all", "Read all courses"),
        ("course", "read", "own", "Read own courses"),
        ("course", "update", "all", "Update all courses"),
        ("course", "update", "own", "Update own courses"),
        ("course", "delete", "all", "Delete all courses"),
        ("course", "delete", "own", "Delete own courses"),
        ("course", "manage", "all", "Manage all courses"),
        ("course", "manage", "own", "Manage own courses"),
        # Chapter permissions
        ("chapter", "create", "org", "Create chapters"),
        ("chapter", "read", "all", "Read chapters"),
        ("chapter", "update", "all", "Update chapters"),
        ("chapter", "delete", "all", "Delete chapters"),
        # Activity permissions
        ("activity", "create", "org", "Create activities"),
        ("activity", "read", "all", "Read activities"),
        ("activity", "update", "all", "Update activities"),
        ("activity", "delete", "all", "Delete activities"),
        # User permissions
        ("user", "read", "org", "Read organization users"),
        ("user", "update", "org", "Update organization users"),
        ("user", "delete", "org", "Delete organization users"),
        ("user", "invite", "org", "Invite users to organization"),
        ("user", "manage", "org", "Manage organization users"),
        # Organization permissions
        ("organization", "read", "own", "Read organization details"),
        ("organization", "update", "own", "Update organization"),
        ("organization", "manage", "own", "Manage organization"),
        # Role permissions
        ("role", "create", "org", "Create roles"),
        ("role", "read", "org", "Read roles"),
        ("role", "update", "org", "Update roles"),
        ("role", "delete", "org", "Delete roles"),
        # Collection permissions
        ("collection", "create", "org", "Create collections"),
        ("collection", "read", "all", "Read collections"),
        ("collection", "update", "all", "Update collections"),
        ("collection", "delete", "all", "Delete collections"),
        # Usergroup permissions
        ("usergroup", "create", "org", "Create user groups"),
        ("usergroup", "read", "org", "Read user groups"),
        ("usergroup", "update", "org", "Update user groups"),
        ("usergroup", "delete", "org", "Delete user groups"),
        # Assignment permissions
        ("assignment", "create", "org", "Create assignments"),
        ("assignment", "read", "all", "Read assignments"),
        ("assignment", "update", "all", "Update assignments"),
        ("assignment", "delete", "all", "Delete assignments"),
        ("assignment", "grade", "org", "Grade assignments"),
    ]

    # Insert permissions (if they don't exist)
    for resource_type, action, scope, description in permissions:
        # Check if permission exists
        existing = conn.execute(
            text("""
                SELECT id FROM permissions
                WHERE resource_type = :resource_type
                AND action = :action
                AND scope = :scope
            """),
            {"resource_type": resource_type, "action": action, "scope": scope},
        ).fetchone()

        if not existing:
            # Create permission
            conn.execute(
                text("""
                    INSERT INTO permissions (name, resource_type, action, scope, description, created_at)
                    VALUES (:name, :resource_type, :action, :scope, :description, NOW())
                """),
                {
                    "name": f"{resource_type}:{action}:{scope}",
                    "resource_type": resource_type,
                    "action": action,
                    "scope": scope,
                    "description": description,
                },
            )

    # Get permission IDs
    def get_permission_id(resource_type: str, action: str, scope: str) -> int | None:
        result = conn.execute(
            text("""
                SELECT id FROM permissions
                WHERE resource_type = :resource_type
                AND action = :action
                AND scope = :scope
            """),
            {"resource_type": resource_type, "action": action, "scope": scope},
        ).fetchone()
        return result[0] if result else None

    # Assign permissions to admin role (role_global_admin, id=1)
    admin_permissions = [
        # Admin has all permissions
        ("course", "create", "org"),
        ("course", "read", "all"),
        ("course", "update", "all"),
        ("course", "delete", "all"),
        ("course", "manage", "all"),
        ("chapter", "create", "org"),
        ("chapter", "read", "all"),
        ("chapter", "update", "all"),
        ("chapter", "delete", "all"),
        ("activity", "create", "org"),
        ("activity", "read", "all"),
        ("activity", "update", "all"),
        ("activity", "delete", "all"),
        ("user", "read", "org"),
        ("user", "update", "org"),
        ("user", "delete", "org"),
        ("user", "invite", "org"),
        ("user", "manage", "org"),
        ("organization", "read", "own"),
        ("organization", "update", "own"),
        ("organization", "manage", "own"),
        ("role", "create", "org"),
        ("role", "read", "org"),
        ("role", "update", "org"),
        ("role", "delete", "org"),
        ("collection", "create", "org"),
        ("collection", "read", "all"),
        ("collection", "update", "all"),
        ("collection", "delete", "all"),
        ("usergroup", "create", "org"),
        ("usergroup", "read", "org"),
        ("usergroup", "update", "org"),
        ("usergroup", "delete", "org"),
        ("assignment", "create", "org"),
        ("assignment", "read", "all"),
        ("assignment", "update", "all"),
        ("assignment", "delete", "all"),
        ("assignment", "grade", "org"),
    ]

    for resource_type, action, scope in admin_permissions:
        permission_id = get_permission_id(resource_type, action, scope)
        if permission_id:
            # Check if already assigned
            existing = conn.execute(
                text("""
                    SELECT 1 FROM role_permissions
                    WHERE role_id = 1 AND permission_id = :permission_id
                """),
                {"permission_id": permission_id},
            ).fetchone()

            if not existing:
                conn.execute(
                    text("""
                        INSERT INTO role_permissions (role_id, permission_id, granted_at)
                        VALUES (1, :permission_id, NOW())
                    """),
                    {"permission_id": permission_id},
                )

    # Assign permissions to maintainer role (role_global_maintainer, id=2)
    maintainer_permissions = [
        ("course", "create", "org"),
        ("course", "read", "all"),
        ("course", "update", "all"),
        ("course", "delete", "all"),
        ("chapter", "create", "org"),
        ("chapter", "read", "all"),
        ("chapter", "update", "all"),
        ("chapter", "delete", "all"),
        ("activity", "create", "org"),
        ("activity", "read", "all"),
        ("activity", "update", "all"),
        ("activity", "delete", "all"),
        ("user", "read", "org"),
        ("user", "invite", "org"),
        ("collection", "create", "org"),
        ("collection", "read", "all"),
        ("collection", "update", "all"),
        ("collection", "delete", "all"),
        ("assignment", "create", "org"),
        ("assignment", "read", "all"),
        ("assignment", "update", "all"),
        ("assignment", "grade", "org"),
    ]

    for resource_type, action, scope in maintainer_permissions:
        permission_id = get_permission_id(resource_type, action, scope)
        if permission_id:
            existing = conn.execute(
                text("""
                    SELECT 1 FROM role_permissions
                    WHERE role_id = 2 AND permission_id = :permission_id
                """),
                {"permission_id": permission_id},
            ).fetchone()

            if not existing:
                conn.execute(
                    text("""
                        INSERT INTO role_permissions (role_id, permission_id, granted_at)
                        VALUES (2, :permission_id, NOW())
                    """),
                    {"permission_id": permission_id},
                )

    # Assign permissions to instructor role (role_global_instructor, id=3)
    instructor_permissions = [
        ("course", "create", "org"),
        ("course", "read", "all"),
        ("course", "update", "own"),
        ("course", "delete", "own"),
        ("chapter", "create", "org"),
        ("chapter", "read", "all"),
        ("chapter", "update", "all"),
        ("activity", "create", "org"),
        ("activity", "read", "all"),
        ("activity", "update", "all"),
        ("collection", "read", "all"),
        ("assignment", "read", "all"),
        ("assignment", "grade", "org"),
    ]

    for resource_type, action, scope in instructor_permissions:
        permission_id = get_permission_id(resource_type, action, scope)
        if permission_id:
            existing = conn.execute(
                text("""
                    SELECT 1 FROM role_permissions
                    WHERE role_id = 3 AND permission_id = :permission_id
                """),
                {"permission_id": permission_id},
            ).fetchone()

            if not existing:
                conn.execute(
                    text("""
                        INSERT INTO role_permissions (role_id, permission_id, granted_at)
                        VALUES (3, :permission_id, NOW())
                    """),
                    {"permission_id": permission_id},
                )

    # Assign permissions to user role (role_global_user, id=4)
    user_permissions = [
        ("course", "read", "all"),
        ("chapter", "read", "all"),
        ("activity", "read", "all"),
        ("collection", "read", "all"),
        ("assignment", "read", "all"),
    ]

    for resource_type, action, scope in user_permissions:
        permission_id = get_permission_id(resource_type, action, scope)
        if permission_id:
            existing = conn.execute(
                text("""
                    SELECT 1 FROM role_permissions
                    WHERE role_id = 4 AND permission_id = :permission_id
                """),
                {"permission_id": permission_id},
            ).fetchone()

            if not existing:
                conn.execute(
                    text("""
                        INSERT INTO role_permissions (role_id, permission_id, granted_at)
                        VALUES (4, :permission_id, NOW())
                    """),
                    {"permission_id": permission_id},
                )


def downgrade() -> None:
    """Remove seeded permissions."""
    conn = op.get_bind()

    # Delete role_permissions entries for default roles
    conn.execute(
        text("""
            DELETE FROM role_permissions
            WHERE role_id IN (1, 2, 3, 4)
        """)
    )

    # Optionally delete permissions (commented out to preserve custom permissions)
    # conn.execute(text("DELETE FROM permissions"))
