"""Grading v3: simplify status model and add is_late column

Changes:
- Adds submission.is_late (BOOLEAN NOT NULL DEFAULT FALSE)
- Migrates LATE submissions: sets is_late=TRUE, then status='PENDING'
- Migrates SUBMITTED and UNDER_REVIEW submissions: status='PENDING'
- The old SUBMITTED, UNDER_REVIEW, LATE status values are retired.
  New valid statuses: DRAFT, PENDING, GRADED, PUBLISHED, RETURNED

Revision ID: p0q1r2s3t4u
Revises: o9p0q1r2s3t
Create Date: 2026-03-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "p0q1r2s3t4u"
down_revision: str | None = "o9p0q1r2s3t"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add is_late column (default FALSE, not nullable)
    conn.execute(
        sa.text(
            "ALTER TABLE submission ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE"
        )
    )

    # 2. Mark late submissions before changing status
    conn.execute(
        sa.text("UPDATE submission SET is_late = TRUE WHERE status = 'LATE'")
    )

    # 3. Collapse SUBMITTED, UNDER_REVIEW, LATE → PENDING
    conn.execute(
        sa.text(
            "UPDATE submission SET status = 'PENDING' "
            "WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'LATE')"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    # Restore LATE from is_late flag (best-effort; UNDER_REVIEW is not recoverable)
    conn.execute(
        sa.text(
            "UPDATE submission SET status = 'LATE' "
            "WHERE status = 'PENDING' AND is_late = TRUE"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE submission SET status = 'SUBMITTED' "
            "WHERE status = 'PENDING' AND is_late = FALSE"
        )
    )

    conn.execute(
        sa.text("ALTER TABLE submission DROP COLUMN IF EXISTS is_late")
    )
