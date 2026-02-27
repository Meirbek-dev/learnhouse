"""Add guest system role with user:create:all for public self-registration

Without this, the POST /users endpoint (public signup) was guarded by a
`user:create` RBAC check that AnonymousUser (id=0) could never satisfy,
yielding a misleading "Permission denied: user:create" response.

Two complementary fixes land together:
  1. create_user_without_org() now skips the RBAC check for anonymous callers.
  2. PermissionChecker._get_or_load() loads the `guest` role's permissions when
     user_id == 0, so any future public endpoint can be protected through the
     normal permission system rather than ad-hoc isinstance guards.
  3. (This migration) seeds the `guest` role and `user:create:all` permission so
     the RBAC path in (2) resolves correctly.

Revision ID: c9d0e1f2a3b4
Revises: 07313a236e8b
Create Date: 2026-02-27 22:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "c9d0e1f2a3b4"
down_revision: str = "07313a236e8b"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PERMISSION_KEY = "user:create:all"
_ROLE_SLUG = "guest"


def _upsert_permission(conn) -> None:
    """Insert user:create:all into permissions if it doesn't already exist."""
    conn.execute(
        text("""
            INSERT INTO permissions
                (name, resource_type, action, scope, description, permission_key)
            VALUES (
                :name,
                CAST('user' AS resourcetype),
                CAST('create' AS action),
                CAST('all'  AS scope),
                :description,
                :permission_key
            )
            ON CONFLICT (name) DO NOTHING
        """),
        {
            "name": _PERMISSION_KEY,
            "description": "Create a new user account (public self-registration)",
            "permission_key": _PERMISSION_KEY,
        },
    )


def _upsert_guest_role(conn) -> None:
    """Insert the global `guest` system role if it doesn't already exist."""
    conn.execute(
        text("""
            INSERT INTO roles (slug, name, description, is_system, priority, org_id)
            VALUES (
                :slug,
                'Гость',
                'Unauthenticated / anonymous visitors. Grants only the minimum '
                'permissions required to self-register.',
                TRUE,
                0,
                NULL
            )
            ON CONFLICT (slug, org_id) DO NOTHING
        """),
        {"slug": _ROLE_SLUG},
    )


def _assign_permission_to_guest(conn) -> None:
    """Assign user:create:all to the guest role via role_permissions."""
    conn.execute(
        text("""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM   roles       r
            JOIN   permissions p ON p.name = :perm_key
            WHERE  r.slug     = :role_slug
            AND    r.org_id IS NULL
            ON CONFLICT DO NOTHING
        """),
        {"perm_key": _PERMISSION_KEY, "role_slug": _ROLE_SLUG},
    )


# ---------------------------------------------------------------------------
# Upgrade / Downgrade
# ---------------------------------------------------------------------------


def upgrade() -> None:
    conn = op.get_bind()
    _upsert_permission(conn)
    _upsert_guest_role(conn)
    _assign_permission_to_guest(conn)


def downgrade() -> None:
    conn = op.get_bind()

    # Remove the role_permissions row
    conn.execute(
        text("""
            DELETE FROM role_permissions
            WHERE role_id = (
                SELECT id FROM roles WHERE slug = :slug AND org_id IS NULL
            )
            AND permission_id = (
                SELECT id FROM permissions WHERE name = :perm_key
            )
        """),
        {"slug": _ROLE_SLUG, "perm_key": _PERMISSION_KEY},
    )

    # Remove the guest role (only if it was added by this migration — i.e. still
    # has no assigned users and no other permissions beyond what we gave it).
    conn.execute(
        text("""
            DELETE FROM roles
            WHERE slug    = :slug
            AND   org_id IS NULL
            AND   is_system = TRUE
            AND   priority  = 0
            AND   NOT EXISTS (
                SELECT 1 FROM role_permissions
                WHERE role_id = roles.id
            )
        """),
        {"slug": _ROLE_SLUG},
    )

    # Leave the permission row — other roles may have adopted user:create:all.
