"""Grading v4: enforce one open DRAFT per user/activity

Adds a partial unique index on submission (user_id, activity_id) where
status = 'DRAFT'.  This makes the race condition that creates duplicate
drafts (two concurrent start_submission calls) a hard DB error rather
than silent data corruption.

Before adding the index, any existing duplicate DRAFTs are collapsed:
only the newest DRAFT (highest id) per (user_id, activity_id) pair is
kept; the older duplicates are deleted.

Revision ID: q1r2s3t4u5v
Revises: p0q1r2s3t4u
Create Date: 2026-03-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "q1r2s3t4u5v"
down_revision: str | None = "p0q1r2s3t4u"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Delete duplicate DRAFTs, keeping only the newest per (user, activity)
    conn.execute(
        sa.text(
            """
            DELETE FROM submission
            WHERE status = 'DRAFT'
              AND id NOT IN (
                  SELECT MAX(id)
                  FROM submission
                  WHERE status = 'DRAFT'
                  GROUP BY user_id, activity_id
              )
            """
        )
    )

    # 2. Create the partial unique index
    conn.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX ix_submission_one_draft_per_user_activity
            ON submission (user_id, activity_id)
            WHERE status = 'DRAFT'
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DROP INDEX IF EXISTS ix_submission_one_draft_per_user_activity"
        )
    )
