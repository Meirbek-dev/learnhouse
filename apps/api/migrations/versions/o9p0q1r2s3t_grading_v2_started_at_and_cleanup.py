"""Grading v2: add started_at + grading_version columns; truncate stale data

- Adds submission.started_at (TIMESTAMPTZ) — server-only start timestamp
  previously embedded in answers_json, preventing client falsification.
- Adds submission.grading_version (INTEGER, default 1) — schema version for
  safe future JSON evolution.
- Truncates the entire submission table for a clean slate (per product decision
  to discard pre-v2 submission data).

Revision ID: o9p0q1r2s3t
Revises: n8o9p0q1r2s
Create Date: 2026-03-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "o9p0q1r2s3t"
down_revision: str | None = "n8o9p0q1r2s"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Truncate all existing submissions (clean slate for v2)
    conn.execute(sa.text("TRUNCATE TABLE submission RESTART IDENTITY CASCADE"))

    # 2. Add started_at column (server-only, replaces answers_json->>'started_at')
    conn.execute(
        sa.text(
            "ALTER TABLE submission ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ"
        )
    )

    # 3. Add grading_version column (default 1, NOT NULL)
    conn.execute(
        sa.text(
            "ALTER TABLE submission ADD COLUMN IF NOT EXISTS grading_version INTEGER NOT NULL DEFAULT 1"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE submission DROP COLUMN IF EXISTS grading_version"))
    conn.execute(sa.text("ALTER TABLE submission DROP COLUMN IF EXISTS started_at"))
