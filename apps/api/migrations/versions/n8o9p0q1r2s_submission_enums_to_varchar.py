"""Convert submission enum columns to VARCHAR

When SQLModel's create_all() ran before the migration, it created the
`status` and `assessment_type` columns as PostgreSQL ENUM types
(submissionstatus, assessmenttype).  SQLAlchemy then fails to bind
plain strings against those columns without an explicit cast.

This migration converts both columns to VARCHAR, which is what our
explicit sa_column=Column(String) declarations now produce, and drops
the now-orphaned ENUM types.

The conversion is safe because:
- The table may have no rows (brand new), or
- The stored string values ('DRAFT', 'SUBMITTED', etc.) are valid
  VARCHAR after the cast.

Revision ID: n8o9p0q1r2s
Revises: m7n8o9p0q1r
Create Date: 2026-03-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "n8o9p0q1r2s"
down_revision: str | None = "m7n8o9p0q1r"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # Convert submission.status and submission.assessment_type from PostgreSQL
    # ENUM types to plain VARCHAR.  USING status::text extracts the label string.
    #
    # NOTE: We do NOT drop the ENUM types (submissionstatus, assessmenttype)
    # because other tables in the schema (e.g. code_submission) may still
    # reference them.  The submission table simply no longer needs them.
    conn.execute(
        sa.text(
            """
            ALTER TABLE submission
                ALTER COLUMN status
                    TYPE VARCHAR USING status::text,
                ALTER COLUMN assessment_type
                    TYPE VARCHAR USING assessment_type::text
            """
        )
    )


def downgrade() -> None:
    # Cast columns back to ENUM.  The types already exist in the database
    # (shared with code_submission), so we just re-cast the columns.
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            ALTER TABLE submission
                ALTER COLUMN status
                    TYPE submissionstatus USING status::submissionstatus,
                ALTER COLUMN assessment_type
                    TYPE assessmenttype USING assessment_type::assessmenttype
            """
        )
    )
