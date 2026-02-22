"""Remove redundant lower-priority user_roles for promoted users

Revision ID: e3f4a5b6c7d8
Revises: 30d136b8fc44
Create Date: 2026-02-22 18:00:00.000000

When a user is assigned a higher-priority role (e.g. super-admin), the old
lower-priority role assigned during initial seeding is not automatically removed.
This migration strips out any "user" role (priority 10) assignment for users who
also hold a higher-priority role in the same org.

Concretely, the only affected row in the current dataset is:
  user_id=1, role_id=6 (user), org_id=1, id=20
which became redundant when user 1 was promoted to super-admin (role_id=1).
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "30d136b8fc44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Delete user_roles rows for the 'user' role where the same user already
    holds a higher-priority role in the same org."""
    conn = op.get_bind()

    # Find the id of the 'user' system role (lowest priority, slug='user').
    user_role_row = conn.execute(
        text("SELECT id FROM roles WHERE slug = 'user' AND org_id IS NULL LIMIT 1")
    ).fetchone()

    if not user_role_row:
        print("[Migration] 'user' role not found – nothing to do.")
        return

    user_role_id = user_role_row[0]

    # Delete assignments to the 'user' role for any user who already has a
    # different (higher-priority) role in the same org.
    result = conn.execute(
        text("""
            DELETE FROM user_roles ur
            WHERE ur.role_id = :user_role_id
              AND EXISTS (
                  SELECT 1
                  FROM user_roles ur2
                  JOIN roles r ON r.id = ur2.role_id
                  WHERE ur2.user_id = ur.user_id
                    AND (ur2.org_id = ur.org_id OR (ur2.org_id IS NULL AND ur.org_id IS NULL))
                    AND ur2.role_id != :user_role_id
                    AND r.priority > (
                        SELECT priority FROM roles WHERE id = :user_role_id
                    )
              )
        """),
        {"user_role_id": user_role_id},
    )

    deleted = result.rowcount
    if deleted:
        print(f"[Migration] Removed {deleted} redundant 'user' role assignment(s).")
    else:
        print("[Migration] No redundant 'user' role assignments found.")


def downgrade() -> None:
    """Non-reversible – deleted rows cannot be restored automatically."""
    print("[Migration] Downgrade: redundant rows are not restored.")
