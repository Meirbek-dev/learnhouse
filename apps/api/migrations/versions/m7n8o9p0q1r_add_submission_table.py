"""Add unified submission table

Adds a single polymorphic `submission` table that replaces:
- The 4-table assignment chain (Assignment → AssignmentTask →
  AssignmentTaskSubmission → AssignmentUserSubmission)
- The isolated QuizAttempt table

Key design decisions:
- answers_json / grading_json store typed payloads validated by Pydantic
- submission_uuid is a ULID for globally unique, time-sortable IDs
- activity_id + user_id are FK → activity.id / user.id with CASCADE DELETE
- Composite index (user_id, activity_id) for efficient "my submissions" queries
- Unique index on submission_uuid for UUID-based lookups
- assessment_type / status stored as VARCHAR (validated by StrEnum in Python)

Migration is written to be IDEMPOTENT: the table and indexes are only
created if they don't already exist.  This handles the case where SQLModel's
create_all() or a prior interrupted run already applied the DDL.

Revision ID: m7n8o9p0q1r
Revises: l6m7n8o9p0q
Create Date: 2026-03-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "m7n8o9p0q1r"
down_revision: str | None = "l6m7n8o9p0q"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Table (CREATE IF NOT EXISTS) ──────────────────────────────────────────
    # Use raw SQL so we get the idempotent IF NOT EXISTS guard.  The columns
    # exactly mirror the SQLModel definition in src/db/grading/submissions.py.
    conn.execute(
        sa.text(
            """
            CREATE TABLE IF NOT EXISTS submission (
                id               SERIAL          NOT NULL,
                submission_uuid  VARCHAR         NOT NULL,
                assessment_type  VARCHAR         NOT NULL,
                activity_id      INTEGER         NOT NULL
                                     REFERENCES activity (id) ON DELETE CASCADE,
                user_id          INTEGER         NOT NULL
                                     REFERENCES "user" (id) ON DELETE CASCADE,
                auto_score       FLOAT,
                final_score      FLOAT,
                status           VARCHAR         NOT NULL DEFAULT 'DRAFT',
                attempt_number   INTEGER         NOT NULL DEFAULT 1,
                answers_json     JSON            NOT NULL DEFAULT '{}',
                grading_json     JSON            NOT NULL DEFAULT '{}',
                submitted_at     TIMESTAMPTZ,
                graded_at        TIMESTAMPTZ,
                created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
                updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
                PRIMARY KEY (id)
            )
            """
        )
    )

    # ── Indexes (CREATE IF NOT EXISTS) ────────────────────────────────────────
    conn.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ix_submission_uuid
                ON submission (submission_uuid)
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_submission_user_activity
                ON submission (user_id, activity_id)
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE INDEX IF NOT EXISTS ix_submission_activity_status
                ON submission (activity_id, status)
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_submission_activity_status"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_submission_user_activity"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_submission_uuid"))
    conn.execute(sa.text("DROP TABLE IF EXISTS submission"))
