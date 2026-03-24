"""Drop legacy Activity.course_id column

The course can always be resolved via Activity.chapter_id → Chapter.course_id.
This column was kept for backward-compatibility after the join-table migration
(j4k5l6m7n8o9) but is no longer referenced by any query.

Revision ID: l6m7n8o9p0q
Revises: b73586982a3d
Create Date: 2026-03-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "l6m7n8o9p0q"
down_revision: str | None = "b73586982a3d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # Drop the FK constraint first (name may vary; use IF EXISTS via raw SQL)
    conn.execute(
        sa.text(
            """
            DO $$
            DECLARE
                _conname TEXT;
            BEGIN
                SELECT c.conname INTO _conname
                FROM pg_constraint c
                JOIN pg_attribute a
                  ON a.attrelid = c.conrelid
                 AND a.attnum = ANY(c.conkey)
                WHERE c.conrelid = 'activity'::regclass
                  AND c.contype = 'f'
                  AND a.attname = 'course_id'
                LIMIT 1;

                IF _conname IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE activity DROP CONSTRAINT %I', _conname);
                END IF;
            END $$;
            """
        )
    )

    # Drop any index on course_id
    conn.execute(
        sa.text(
            """
            DO $$
            DECLARE
                _idxname TEXT;
            BEGIN
                FOR _idxname IN
                    SELECT indexname FROM pg_indexes
                    WHERE tablename = 'activity'
                      AND indexdef ILIKE '%course_id%'
                LOOP
                    EXECUTE format('DROP INDEX IF EXISTS %I', _idxname);
                END LOOP;
            END $$;
            """
        )
    )

    # Drop the column
    conn.execute(sa.text("ALTER TABLE activity DROP COLUMN IF EXISTS course_id"))


def downgrade() -> None:
    conn = op.get_bind()

    # Re-add the column as nullable with no FK (data is gone)
    conn.execute(
        sa.text(
            "ALTER TABLE activity ADD COLUMN IF NOT EXISTS course_id INTEGER"
        )
    )

    # Best-effort backfill from chapter.course_id
    conn.execute(
        sa.text(
            """
            UPDATE activity a
            SET course_id = c.course_id
            FROM chapter c
            WHERE a.chapter_id = c.id
            """
        )
    )
