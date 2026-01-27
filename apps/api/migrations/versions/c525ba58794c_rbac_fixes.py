"""RBAC fixes - enum types and role renames

Revision ID: c525ba58794c
Revises: a54a941bd13e
Create Date: 2026-01-27 23:38:12.607034

This migration:
1. Re-creates lowercase PostgreSQL enum types for RBAC system
2. Converts VARCHAR columns back to proper enum types
3. Renames system roles to localized names
4. Promotes all Organization Admins to Super Admins
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c525ba58794c"
down_revision: Union[str, None] = "a54a941bd13e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply RBAC fixes."""

    # 1. First, convert columns to VARCHAR if they're using enum types
    # (to avoid dependency issues when dropping enums)
    op.execute("ALTER TABLE permissions ALTER COLUMN resource_type TYPE VARCHAR(50)")
    op.execute("ALTER TABLE permissions ALTER COLUMN action TYPE VARCHAR(50)")
    op.execute("ALTER TABLE permissions ALTER COLUMN scope TYPE VARCHAR(50)")
    op.execute(
        "ALTER TABLE resource_permissions ALTER COLUMN resource_type TYPE VARCHAR(50)"
    )
    op.execute("ALTER TABLE permission_audit_log ALTER COLUMN action TYPE VARCHAR(50)")
    op.execute(
        "ALTER TABLE permission_audit_log ALTER COLUMN resource_type TYPE VARCHAR(50)"
    )

    # 2. Drop existing enum types if they exist
    op.execute("DROP TYPE IF EXISTS resourcetype CASCADE")
    op.execute("DROP TYPE IF EXISTS action CASCADE")
    op.execute("DROP TYPE IF EXISTS scope CASCADE")

    # 3. Create lowercase enum types
    op.execute(
        """
        CREATE TYPE resourcetype AS ENUM (
            'organization',
            'course',
            'chapter',
            'activity',
            'assignment',
            'quiz',
            'user',
            'usergroup',
            'collection',
            'role',
            'certificate',
            'discussion',
            'file',
            'analytics',
            'trail',
            'exam',
            'payment',
            'api_token'
        )
        """
    )

    op.execute(
        """
        CREATE TYPE action AS ENUM (
            'create',
            'read',
            'update',
            'delete',
            'manage',
            'moderate',
            'export',
            'invite',
            'grade',
            'submit',
            'enroll'
        )
        """
    )

    op.execute(
        """
        CREATE TYPE scope AS ENUM (
            'all',
            'own',
            'assigned',
            'org'
        )
        """
    )

    # 4. Convert permissions table columns to enum types
    # First, ensure all values are lowercase
    op.execute(
        "UPDATE permissions SET resource_type = LOWER(resource_type) WHERE resource_type != LOWER(resource_type)"
    )
    op.execute(
        "UPDATE permissions SET action = LOWER(action) WHERE action != LOWER(action)"
    )
    op.execute(
        "UPDATE permissions SET scope = LOWER(scope) WHERE scope != LOWER(scope)"
    )

    # Drop default constraints before converting (to avoid cast issues)
    op.execute("ALTER TABLE permissions ALTER COLUMN scope DROP DEFAULT")

    # Convert columns using CAST
    op.execute(
        "ALTER TABLE permissions ALTER COLUMN resource_type TYPE resourcetype USING resource_type::resourcetype"
    )
    op.execute(
        "ALTER TABLE permissions ALTER COLUMN action TYPE action USING action::action"
    )
    op.execute(
        "ALTER TABLE permissions ALTER COLUMN scope TYPE scope USING scope::scope"
    )

    # Restore default constraint with proper enum value
    op.execute("ALTER TABLE permissions ALTER COLUMN scope SET DEFAULT 'all'::scope")

    # 5. Convert resource_permissions table
    op.execute(
        "UPDATE resource_permissions SET resource_type = LOWER(resource_type) WHERE resource_type != LOWER(resource_type)"
    )
    op.execute(
        "ALTER TABLE resource_permissions ALTER COLUMN resource_type TYPE resourcetype USING resource_type::resourcetype"
    )

    # 6. Convert permission_audit_log table if action/resource_type exist
    # Note: audit log may have special values like "deny" that aren't in the action enum
    # Delete rows with invalid action values - the audit log is just a log
    op.execute(
        """
        DELETE FROM permission_audit_log 
        WHERE action IS NOT NULL 
        AND action NOT IN ('create', 'read', 'update', 'delete', 'manage', 'moderate', 'export', 'invite', 'grade', 'submit', 'enroll')
        """
    )
    op.execute(
        "UPDATE permission_audit_log SET action = LOWER(action) WHERE action IS NOT NULL AND action != LOWER(action)"
    )
    op.execute(
        "UPDATE permission_audit_log SET resource_type = LOWER(resource_type) WHERE resource_type IS NOT NULL AND resource_type != LOWER(resource_type)"
    )
    op.execute(
        "ALTER TABLE permission_audit_log ALTER COLUMN action TYPE action USING action::action"
    )
    op.execute(
        "ALTER TABLE permission_audit_log ALTER COLUMN resource_type TYPE resourcetype USING resource_type::resourcetype"
    )

    # 7. Rename roles to localized names
    op.execute(
        """
        UPDATE roles
        SET name = CASE slug
            WHEN 'super-admin' THEN 'Админ'
            WHEN 'org-admin' THEN 'Админ организации'
            WHEN 'maintainer' THEN 'Мейнтейнер'
            WHEN 'instructor' THEN 'Преподаватель'
            WHEN 'moderator' THEN 'Модератор'
            WHEN 'user' THEN 'Пользователь'
            ELSE name
        END
        WHERE slug IN ('super-admin', 'org-admin', 'maintainer', 'instructor', 'moderator', 'user')
        """
    )

    # 8. Promote all Organization Admins to Super Admins
    # First, get the role IDs
    op.execute(
        """
        WITH role_ids AS (
            SELECT
                (SELECT id FROM roles WHERE slug = 'org-admin' AND org_id IS NULL) as org_admin_id,
                (SELECT id FROM roles WHERE slug = 'super-admin' AND org_id IS NULL) as super_admin_id
        )
        UPDATE user_roles
        SET role_id = role_ids.super_admin_id
        FROM role_ids
        WHERE user_roles.role_id = role_ids.org_admin_id
        """
    )


def downgrade() -> None:
    """Revert RBAC fixes."""

    # 1. Revert role name changes
    op.execute(
        """
        UPDATE roles_new
        SET name = CASE slug
            WHEN 'super-admin' THEN 'Super Admin'
            WHEN 'org-admin' THEN 'Organization Admin'
            WHEN 'maintainer' THEN 'Maintainer'
            WHEN 'instructor' THEN 'Instructor'
            WHEN 'moderator' THEN 'Moderator'
            WHEN 'user' THEN 'User'
            ELSE name
        END
        WHERE slug IN ('super-admin', 'org-admin', 'maintainer', 'instructor', 'moderator', 'user')
        """
    )

    # 2. Convert columns back to VARCHAR
    op.execute(
        "ALTER TABLE permission_audit_log ALTER COLUMN resource_type TYPE VARCHAR(50)"
    )
    op.execute("ALTER TABLE permission_audit_log ALTER COLUMN action TYPE VARCHAR(50)")

    op.execute(
        "ALTER TABLE resource_permissions ALTER COLUMN resource_type TYPE VARCHAR(50)"
    )

    op.execute("ALTER TABLE permissions ALTER COLUMN scope TYPE VARCHAR(50)")
    op.execute("ALTER TABLE permissions ALTER COLUMN action TYPE VARCHAR(50)")
    op.execute("ALTER TABLE permissions ALTER COLUMN resource_type TYPE VARCHAR(50)")

    # 3. Drop enum types
    op.execute("DROP TYPE IF EXISTS scope")
    op.execute("DROP TYPE IF EXISTS action")
    op.execute("DROP TYPE IF EXISTS resourcetype")

    # Note: We cannot automatically revert super-admin back to org-admin
    # as we don't track which users were originally org-admins
