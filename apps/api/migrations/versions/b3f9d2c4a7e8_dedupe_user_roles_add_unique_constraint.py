"""Dedupe user_roles and add unique constraint

Revision ID: b3f9d2c4a7e8
Revises: l8oaz1wgmyid
Create Date: 2026-01-31 00:00:00.000000

"""

from typing import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "b3f9d2c4a7e8"
down_revision = "l8oaz1wgmyid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Consolidate multiple user_roles per (user_id, org_id), keep earliest granted_at, then add unique constraint."""
    conn = op.get_bind()

    print("[Migration] Checking for duplicate user_roles (user_id, org_id)...")

    dup_rows = conn.execute(
        text("""
            SELECT user_id, org_id, COUNT(*) as cnt
            FROM user_roles
            GROUP BY user_id, org_id
            HAVING COUNT(*) > 1
        """)
    ).fetchall()

    if not dup_rows:
        print("[Migration] No duplicate user_roles found")
    else:
        print(f"[Migration] Found {len(dup_rows)} duplicated (user_id, org_id) groups")

        # Delete duplicates keeping the earliest granted_at for each (user_id, org_id)
        # This uses a CTE with row_number to remove rows where rn > 1
        conn.execute(
            text("""
                WITH ranked AS (
                    SELECT user_id, org_id, role_id, granted_at,
                           ROW_NUMBER() OVER (PARTITION BY user_id, org_id ORDER BY granted_at ASC NULLS FIRST) AS rn
                    FROM user_roles
                )
                DELETE FROM user_roles
                WHERE (user_id, org_id, role_id) IN (
                    SELECT user_id, org_id, role_id FROM ranked WHERE rn > 1
                )
            """)
        )

        print("[Migration] Removed duplicate user_roles rows")

    # Add unique constraint to prevent future duplicates
    try:
        conn.execute(
            text("ALTER TABLE user_roles ADD CONSTRAINT uq_user_roles_user_org UNIQUE (user_id, org_id)")
        )
        print("[Migration] Added unique constraint uq_user_roles_user_org")
    except Exception as e:
        print(f"[Migration] Warning: could not add unique constraint: {e}")


def downgrade() -> None:
    """Remove unique constraint (cannot restore deleted duplicate rows)."""
    conn = op.get_bind()
    try:
        conn.execute(text("ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS uq_user_roles_user_org"))
        print("[Migration] Dropped unique constraint uq_user_roles_user_org")
    except Exception as e:
        print(f"[Migration] Warning: could not drop unique constraint: {e}")
