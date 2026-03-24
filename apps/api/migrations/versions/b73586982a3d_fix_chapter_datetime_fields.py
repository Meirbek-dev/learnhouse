"""Fix chapter creation_date/update_date columns from VARCHAR to TIMESTAMPTZ

Revision ID: b73586982a3d
Revises: k5l6m7n8o9p
Create Date: 2026-03-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b73586982a3d"
down_revision: str | None = "k5l6m7n8o9p"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # Cast existing string timestamps to TIMESTAMPTZ.
    # The stored values are Python str(datetime.now()) which produces
    # "YYYY-MM-DD HH:MM:SS.ffffff" — parseable by PostgreSQL.
    # Rows with NULL or empty strings default to NOW().
    conn.execute(
        sa.text(
            """
            ALTER TABLE chapter
                ALTER COLUMN creation_date TYPE TIMESTAMPTZ
                    USING CASE
                        WHEN creation_date IS NULL OR creation_date = ''
                        THEN NOW()
                        ELSE creation_date::TIMESTAMPTZ
                    END,
                ALTER COLUMN update_date TYPE TIMESTAMPTZ
                    USING CASE
                        WHEN update_date IS NULL OR update_date = ''
                        THEN NOW()
                        ELSE update_date::TIMESTAMPTZ
                    END
            """
        )
    )

    # Set NOT NULL defaults so new rows always have valid timestamps
    conn.execute(
        sa.text(
            """
            ALTER TABLE chapter
                ALTER COLUMN creation_date SET DEFAULT NOW(),
                ALTER COLUMN update_date SET DEFAULT NOW()
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            """
            ALTER TABLE chapter
                ALTER COLUMN creation_date TYPE VARCHAR
                    USING creation_date::TEXT,
                ALTER COLUMN update_date TYPE VARCHAR
                    USING update_date::TEXT
            """
        )
    )

    conn.execute(
        sa.text(
            """
            ALTER TABLE chapter
                ALTER COLUMN creation_date DROP DEFAULT,
                ALTER COLUMN update_date DROP DEFAULT
            """
        )
    )
