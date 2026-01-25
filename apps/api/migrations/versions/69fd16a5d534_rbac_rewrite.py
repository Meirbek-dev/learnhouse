"""RBAC rewrite

Revision ID: 69fd16a5d534
Revises: 103e657f0164
Create Date: 2026-01-23 22:37:32.359114

This migration creates the new RBAC system tables:
- permissions: Individual permission definitions
- roles_new: Role definitions with hierarchy support
- role_permissions: Junction table for role-permission assignments
- user_roles: User-role assignments per organization
- resource_permissions: Resource-level permission overrides
- permission_audit_log: Audit logging for permission checks

It also migrates existing roles and user_organizations data to the new schema.
"""

from collections.abc import Sequence
from datetime import datetime, UTC
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "69fd16a5d534"
down_revision: str | None = "103e657f0164"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema - Create new RBAC tables."""

    # 1. Create permissions table
    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False, server_default="all"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_permissions_name"),
    )
    op.create_index("ix_permissions_resource_type", "permissions", ["resource_type"])
    op.create_index("ix_permissions_action", "permissions", ["action"])

    # 2. Create roles_new table (with hierarchy support)
    op.create_table(
        "roles_new",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("org_id", sa.Integer(), nullable=True),
        sa.Column("parent_role_id", sa.Integer(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["parent_role_id"], ["roles_new.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint("slug", "org_id", name="uq_role_slug_org"),
    )
    op.create_index("ix_roles_new_org_id", "roles_new", ["org_id"])
    op.create_index("ix_roles_new_slug", "roles_new", ["slug"])

    # 3. Create role_permissions junction table
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("granted_by", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
        sa.ForeignKeyConstraint(["role_id"], ["roles_new.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["permission_id"], ["permissions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["granted_by"], ["user.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_role_permissions_role_id", "role_permissions", ["role_id"])

    # 4. Create user_roles table
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("granted_by", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("user_id", "role_id", "org_id"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles_new.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by"], ["user.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])
    op.create_index("ix_user_roles_org_id", "user_roles", ["org_id"])

    # 5. Create resource_permissions table (for resource-level overrides)
    op.create_table(
        "resource_permissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.String(100), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("granted_by", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["permission_id"], ["permissions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["granted_by"], ["user.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
            "user_id",
            "resource_type",
            "resource_id",
            "permission_id",
            name="uq_resource_permission",
        ),
    )
    op.create_index(
        "ix_resource_permissions_user_resource",
        "resource_permissions",
        ["user_id", "resource_type", "resource_id"],
    )

    # 6. Create permission_audit_log table
    op.create_table(
        "permission_audit_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(100), nullable=True),
        sa.Column("permission_name", sa.String(100), nullable=True),
        sa.Column("result", sa.Boolean(), nullable=False),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="SET NULL"),
    )
    op.create_index(
        "ix_permission_audit_user", "permission_audit_log", ["user_id", "created_at"]
    )
    op.create_index(
        "ix_permission_audit_resource",
        "permission_audit_log",
        ["resource_type", "resource_id"],
    )
    op.create_index(
        "ix_permission_audit_action", "permission_audit_log", ["action", "created_at"]
    )

    # 7. Seed default permissions
    _seed_default_permissions()

    # 8. Seed default system roles
    _seed_default_roles()

    # 9. Migrate existing user_organizations to user_roles
    _migrate_user_organizations()


def downgrade() -> None:
    """Downgrade schema - Remove new RBAC tables."""
    # Drop tables in reverse order of creation (respecting foreign keys)
    op.drop_index("ix_permission_audit_action", table_name="permission_audit_log")
    op.drop_index("ix_permission_audit_resource", table_name="permission_audit_log")
    op.drop_index("ix_permission_audit_user", table_name="permission_audit_log")
    op.drop_table("permission_audit_log")

    op.drop_index(
        "ix_resource_permissions_user_resource", table_name="resource_permissions"
    )
    op.drop_table("resource_permissions")

    op.drop_index("ix_user_roles_org_id", table_name="user_roles")
    op.drop_index("ix_user_roles_user_id", table_name="user_roles")
    op.drop_table("user_roles")

    op.drop_index("ix_role_permissions_role_id", table_name="role_permissions")
    op.drop_table("role_permissions")

    op.drop_index("ix_roles_new_slug", table_name="roles_new")
    op.drop_index("ix_roles_new_org_id", table_name="roles_new")
    op.drop_table("roles_new")

    op.drop_index("ix_permissions_action", table_name="permissions")
    op.drop_index("ix_permissions_resource_type", table_name="permissions")
    op.drop_table("permissions")


def _seed_default_permissions() -> None:
    """Seed the database with default permissions."""
    conn = op.get_bind()

    # Define default permissions
    permissions = [
        # Organization permissions
        (
            "organization:read:own",
            "organization",
            "read",
            "own",
            "Read own organization",
        ),
        (
            "organization:update:own",
            "organization",
            "update",
            "own",
            "Update own organization",
        ),
        (
            "organization:manage:own",
            "organization",
            "manage",
            "own",
            "Manage own organization settings",
        ),
        (
            "organization:delete:own",
            "organization",
            "delete",
            "own",
            "Delete own organization",
        ),
        # Course permissions
        (
            "course:create:org",
            "course",
            "create",
            "org",
            "Create courses in organization",
        ),
        ("course:read:all", "course", "read", "all", "Read all public courses"),
        ("course:read:own", "course", "read", "own", "Read own courses"),
        ("course:update:own", "course", "update", "own", "Update own courses"),
        (
            "course:update:org",
            "course",
            "update",
            "org",
            "Update courses in organization",
        ),
        ("course:delete:own", "course", "delete", "own", "Delete own courses"),
        (
            "course:delete:org",
            "course",
            "delete",
            "org",
            "Delete courses in organization",
        ),
        ("course:manage:own", "course", "manage", "own", "Manage own course settings"),
        ("course:manage:all", "course", "manage", "all", "Manage all courses"),
        # Chapter permissions
        (
            "chapter:create:own",
            "chapter",
            "create",
            "own",
            "Create chapters in own courses",
        ),
        (
            "chapter:create:org",
            "chapter",
            "create",
            "org",
            "Create chapters in organization",
        ),
        ("chapter:read:all", "chapter", "read", "all", "Read chapters"),
        ("chapter:update:own", "chapter", "update", "own", "Update own chapters"),
        (
            "chapter:update:org",
            "chapter",
            "update",
            "org",
            "Update chapters in organization",
        ),
        ("chapter:delete:own", "chapter", "delete", "own", "Delete own chapters"),
        (
            "chapter:delete:org",
            "chapter",
            "delete",
            "org",
            "Delete chapters in organization",
        ),
        # Activity permissions
        (
            "activity:create:own",
            "activity",
            "create",
            "own",
            "Create activities in own courses",
        ),
        (
            "activity:create:org",
            "activity",
            "create",
            "org",
            "Create activities in organization",
        ),
        ("activity:read:all", "activity", "read", "all", "Read activities"),
        ("activity:update:own", "activity", "update", "own", "Update own activities"),
        (
            "activity:update:org",
            "activity",
            "update",
            "org",
            "Update activities in organization",
        ),
        ("activity:delete:own", "activity", "delete", "own", "Delete own activities"),
        (
            "activity:delete:org",
            "activity",
            "delete",
            "org",
            "Delete activities in organization",
        ),
        # User permissions
        ("user:read:own", "user", "read", "own", "Read own profile"),
        ("user:read:org", "user", "read", "org", "Read users in organization"),
        ("user:read:all", "user", "read", "all", "Read all users"),
        ("user:update:own", "user", "update", "own", "Update own profile"),
        ("user:update:org", "user", "update", "org", "Update users in organization"),
        ("user:delete:org", "user", "delete", "org", "Delete users in organization"),
        ("user:invite:org", "user", "invite", "org", "Invite users to organization"),
        # Usergroup permissions
        (
            "usergroup:create:org",
            "usergroup",
            "create",
            "org",
            "Create usergroups in organization",
        ),
        (
            "usergroup:read:org",
            "usergroup",
            "read",
            "org",
            "Read usergroups in organization",
        ),
        (
            "usergroup:update:org",
            "usergroup",
            "update",
            "org",
            "Update usergroups in organization",
        ),
        (
            "usergroup:delete:org",
            "usergroup",
            "delete",
            "org",
            "Delete usergroups in organization",
        ),
        # Collection permissions
        (
            "collection:create:org",
            "collection",
            "create",
            "org",
            "Create collections in organization",
        ),
        ("collection:read:all", "collection", "read", "all", "Read public collections"),
        (
            "collection:update:own",
            "collection",
            "update",
            "own",
            "Update own collections",
        ),
        (
            "collection:update:org",
            "collection",
            "update",
            "org",
            "Update collections in organization",
        ),
        (
            "collection:delete:own",
            "collection",
            "delete",
            "own",
            "Delete own collections",
        ),
        (
            "collection:delete:org",
            "collection",
            "delete",
            "org",
            "Delete collections in organization",
        ),
        # Role permissions
        ("role:create:org", "role", "create", "org", "Create roles in organization"),
        ("role:read:org", "role", "read", "org", "Read roles in organization"),
        ("role:update:org", "role", "update", "org", "Update roles in organization"),
        ("role:delete:org", "role", "delete", "org", "Delete roles in organization"),
        # Certificate permissions
        (
            "certificate:create:own",
            "certificate",
            "create",
            "own",
            "Create certificates for own courses",
        ),
        ("certificate:read:all", "certificate", "read", "all", "Read certificates"),
        # Analytics permissions
        ("analytics:read:own", "analytics", "read", "own", "Read own analytics"),
        (
            "analytics:read:org",
            "analytics",
            "read",
            "org",
            "Read organization analytics",
        ),
        # Assignment/Quiz permissions
        (
            "assignment:grade:own",
            "assignment",
            "grade",
            "own",
            "Grade assignments in own courses",
        ),
        ("assignment:submit:all", "assignment", "submit", "all", "Submit assignments"),
        ("quiz:grade:own", "quiz", "grade", "own", "Grade quizzes in own courses"),
        ("quiz:submit:all", "quiz", "submit", "all", "Submit quizzes"),
        # Exam permissions
        ("exam:create:org", "exam", "create", "org", "Create exams in organization"),
        ("exam:read:own", "exam", "read", "own", "Read own exams"),
        ("exam:update:own", "exam", "update", "own", "Update own exams"),
        ("exam:delete:own", "exam", "delete", "own", "Delete own exams"),
        # File permissions
        ("file:create:org", "file", "create", "org", "Upload files to organization"),
        ("file:read:org", "file", "read", "org", "Read files in organization"),
        ("file:delete:own", "file", "delete", "own", "Delete own files"),
        # API Token permissions
        ("api_token:create:org", "api_token", "create", "org", "Create API tokens"),
        ("api_token:read:org", "api_token", "read", "org", "Read API tokens"),
        ("api_token:delete:org", "api_token", "delete", "org", "Delete API tokens"),
        # Discussion permissions
        (
            "discussion:moderate:org",
            "discussion",
            "moderate",
            "org",
            "Moderate discussions in organization",
        ),
    ]

    for name, resource_type, action, scope, description in permissions:
        conn.execute(
            sa.text("""
                INSERT INTO permissions (name, resource_type, action, scope, description)
                VALUES (:name, :resource_type, :action, :scope, :description)
                ON CONFLICT (name) DO NOTHING
            """),
            {
                "name": name,
                "resource_type": resource_type,
                "action": action,
                "scope": scope,
                "description": description,
            },
        )


def _seed_default_roles() -> None:
    """Seed the database with default system roles."""
    conn = op.get_bind()

    # Define default roles with their permissions
    # Format: (slug, name, description, is_system, priority, parent_slug, permission_patterns)
    roles = [
        (
            "super-admin",
            "Super Admin",
            "Platform-wide administrator with full access",
            True,
            100,
            None,
        ),
        (
            "org-admin",
            "Organization Admin",
            "Full control over organization",
            True,
            90,
            None,
        ),
        (
            "maintainer",
            "Maintainer",
            "Content management and course administration",
            True,
            70,
            None,
        ),
        ("instructor", "Instructor", "Course creation and management", True, 50, None),
        ("moderator", "Moderator", "Community moderation", True, 40, None),
        ("user", "User", "Standard authenticated user", True, 10, None),
    ]

    # Insert roles
    for slug, name, description, is_system, priority, _parent_slug in roles:
        conn.execute(
            sa.text("""
                INSERT INTO roles_new (slug, name, description, is_system, priority, org_id)
                VALUES (:slug, :name, :description, :is_system, :priority, NULL)
                ON CONFLICT (slug, org_id) DO NOTHING
            """),
            {
                "slug": slug,
                "name": name,
                "description": description,
                "is_system": is_system,
                "priority": priority,
            },
        )

    # Get role IDs
    result = conn.execute(
        sa.text("SELECT id, slug FROM roles_new WHERE org_id IS NULL")
    )
    role_ids = {row[1]: row[0] for row in result}

    # Get all permission IDs
    result = conn.execute(sa.text("SELECT id, name FROM permissions"))
    perm_ids = {row[1]: row[0] for row in result}

    # Define role-permission mappings
    role_permissions = {
        "super-admin": list(perm_ids.keys()),  # All permissions
        "org-admin": [
            p
            for p in perm_ids
            if any(
                x in p
                for x in [
                    "organization:",
                    "course:",
                    "chapter:",
                    "activity:",
                    "user:",
                    "usergroup:",
                    "collection:",
                    "role:",
                    "analytics:",
                    "file:",
                    "api_token:",
                ]
            )
        ],
        "maintainer": [
            p
            for p in perm_ids
            if any(
                x in p
                for x in [
                    "course:",
                    "chapter:",
                    "activity:",
                    "collection:",
                    "user:read",
                    "usergroup:read",
                    "analytics:read",
                ]
            )
        ],
        "instructor": [
            "course:create:org",
            "course:read:all",
            "course:update:own",
            "course:delete:own",
            "course:manage:own",
            "chapter:create:own",
            "chapter:read:all",
            "chapter:update:own",
            "chapter:delete:own",
            "activity:create:own",
            "activity:read:all",
            "activity:update:own",
            "activity:delete:own",
            "assignment:grade:own",
            "quiz:grade:own",
            "certificate:create:own",
            "analytics:read:own",
            "user:read:own",
        ],
        "moderator": [
            "course:read:all",
            "user:read:org",
            "discussion:moderate:org",
        ],
        "user": [
            "course:read:all",
            "user:read:own",
            "user:update:own",
            "assignment:submit:all",
            "quiz:submit:all",
            "analytics:read:own",
            "collection:read:all",
            "certificate:read:all",
        ],
    }

    # Insert role-permission assignments
    for role_slug, permissions in role_permissions.items():
        role_id = role_ids.get(role_slug)
        if not role_id:
            continue

        for perm_name in permissions:
            perm_id = perm_ids.get(perm_name)
            if not perm_id:
                continue

            conn.execute(
                sa.text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                    ON CONFLICT (role_id, permission_id) DO NOTHING
                """),
                {"role_id": role_id, "permission_id": perm_id},
            )


def _migrate_user_organizations() -> None:
    """Migrate existing user_organizations to user_roles."""
    conn = op.get_bind()

    # Map old role IDs to new role slugs
    # Based on the existing system: 1=Admin, 2=Maintainer, 3=Instructor, 4=User
    old_role_mapping = {
        1: "org-admin",
        2: "maintainer",
        3: "instructor",
        4: "user",
    }

    # Get new role IDs by slug
    result = conn.execute(
        sa.text("SELECT id, slug FROM roles_new WHERE org_id IS NULL")
    )
    new_role_ids = {row[1]: row[0] for row in result}

    # Migrate each user_organization entry
    result = conn.execute(
        sa.text("SELECT user_id, org_id, role_id, creation_date FROM userorganization")
    )

    for row in result:
        user_id, org_id, old_role_id, creation_date = row

        # Get new role slug from old role ID
        new_role_slug = old_role_mapping.get(old_role_id, "user")
        new_role_id = new_role_ids.get(new_role_slug)

        if not new_role_id:
            continue

        # Insert into user_roles
        conn.execute(
            sa.text("""
                INSERT INTO user_roles (user_id, role_id, org_id, granted_at)
                VALUES (:user_id, :role_id, :org_id, :granted_at)
                ON CONFLICT (user_id, role_id, org_id) DO NOTHING
            """),
            {
                "user_id": user_id,
                "role_id": new_role_id,
                "org_id": org_id,
                "granted_at": creation_date or datetime.now(UTC),
            },
        )
