"""Enforce non-null chapter_id on activity

Revision ID: k5l6m7n8o9p
Revises: j4k5l6m7n8o9
Create Date: 2026-03-24 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "k5l6m7n8o9p"
down_revision: str | None = "j4k5l6m7n8o9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Step 1: backfill via legacy course_id ────────────────────────────────
    # Activities that survived the j4k5l6m7n8o9 migration with chapter_id=NULL
    # still have course_id set. Assign them to the first chapter of that course
    # (ordered by chapter.order) so we preserve them rather than destroying data.
    conn.execute(
        sa.text(
            """
            UPDATE activity
            SET chapter_id = (
                SELECT id FROM chapter
                WHERE chapter.course_id = activity.course_id
                ORDER BY "order" ASC
                LIMIT 1
            )
            WHERE chapter_id IS NULL
              AND course_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM chapter
                  WHERE chapter.course_id = activity.course_id
              )
            """
        )
    )

    # ── Step 2: delete truly orphaned rows (no course, no chapter) ───────────
    # These are activities that have neither chapter_id nor a resolvable
    # course_id → they are unrecoverable ghost rows.
    deleted = conn.execute(
        sa.text("DELETE FROM activity WHERE chapter_id IS NULL RETURNING id")
    ).rowcount

    if deleted:
        print(
            f"[k5l6m7n8o9p] WARNING: deleted {deleted} orphaned activity row(s) "
            "with no chapter_id and no recoverable course_id."
        )

    # ── Step 3: enforce the constraint ───────────────────────────────────────
    remaining = conn.execute(
        sa.text("SELECT COUNT(*) FROM activity WHERE chapter_id IS NULL")
    ).scalar_one()

    if remaining:
        raise RuntimeError(
            f"[k5l6m7n8o9p] Still {remaining} activity rows without chapter_id "
            "after backfill — cannot enforce NOT NULL."
        )

    with op.batch_alter_table("activity") as batch_op:
        batch_op.alter_column("chapter_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("activity") as batch_op:
        batch_op.alter_column("chapter_id", existing_type=sa.Integer(), nullable=True)
