"""Restructure course schema: add order/chapter_id to Activity and Chapter, drop join tables

Replaces the CourseChapter and ChapterActivity join tables with direct foreign-key
relationships and inline order columns:

  Chapter.order  — replaces CourseChapter.order
  Activity.chapter_id — replaces ChapterActivity.chapter_id
  Activity.order  — replaces ChapterActivity.order

Data is migrated before the old tables are dropped so no information is lost.

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-03-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "j4k5l6m7n8o9"
down_revision: str | None = "i3j4k5l6m7n8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(conn: sa.Connection, table_name: str) -> bool:
    return sa.inspect(conn).has_table(table_name)


def _column_exists(conn: sa.Connection, table_name: str, column_name: str) -> bool:
    if not _table_exists(conn, table_name):
        return False
    cols = {c["name"] for c in sa.inspect(conn).get_columns(table_name)}
    return column_name in cols


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Add order column to chapter ──────────────────────────────────────
    if not _column_exists(conn, "chapter", "order"):
        op.add_column(
            "chapter",
            sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        )

    # Backfill chapter.order from coursechapter.order if the join table exists
    if _table_exists(conn, "coursechapter"):
        conn.execute(
            sa.text(
                """
                UPDATE chapter
                SET "order" = (
                    SELECT cc."order"
                    FROM coursechapter cc
                    WHERE cc.chapter_id = chapter.id
                    LIMIT 1
                )
                WHERE EXISTS (
                    SELECT 1 FROM coursechapter cc WHERE cc.chapter_id = chapter.id
                )
                """
            )
        )

    # ── 2. Add chapter_id and order columns to activity ──────────────────────
    if not _column_exists(conn, "activity", "chapter_id"):
        op.add_column(
            "activity",
            sa.Column(
                "chapter_id",
                sa.Integer(),
                sa.ForeignKey("chapter.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )

    if not _column_exists(conn, "activity", "order"):
        op.add_column(
            "activity",
            sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        )

    # Backfill activity.chapter_id and activity.order from chapteractivity
    if _table_exists(conn, "chapteractivity"):
        conn.execute(
            sa.text(
                """
                UPDATE activity
                SET chapter_id = (
                    SELECT ca.chapter_id
                    FROM chapteractivity ca
                    WHERE ca.activity_id = activity.id
                    ORDER BY ca.id
                    LIMIT 1
                ),
                "order" = COALESCE((
                    SELECT ca."order"
                    FROM chapteractivity ca
                    WHERE ca.activity_id = activity.id
                    ORDER BY ca.id
                    LIMIT 1
                ), 0)
                WHERE chapter_id IS NULL
                """
            )
        )

    # ── 3. Drop the now-redundant join tables ────────────────────────────────
    if _table_exists(conn, "chapteractivity"):
        op.drop_table("chapteractivity")

    if _table_exists(conn, "coursechapter"):
        op.drop_table("coursechapter")


def downgrade() -> None:
    conn = op.get_bind()

    # Recreate join tables
    op.create_table(
        "coursechapter",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("course.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chapter_id",
            sa.Integer(),
            sa.ForeignKey("chapter.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("creation_date", sa.String(), nullable=False, server_default=""),
        sa.Column("update_date", sa.String(), nullable=False, server_default=""),
    )
    op.create_table(
        "chapteractivity",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column(
            "chapter_id",
            sa.Integer(),
            sa.ForeignKey("chapter.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "activity_id",
            sa.Integer(),
            sa.ForeignKey("activity.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("course.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("creation_date", sa.String(), nullable=False, server_default=""),
        sa.Column("update_date", sa.String(), nullable=False, server_default=""),
    )

    # Backfill join tables from new columns
    conn.execute(
        sa.text(
            """
            INSERT INTO coursechapter (course_id, chapter_id, "order", creation_date, update_date)
            SELECT course_id, id, "order", creation_date, update_date FROM chapter
            """
        )
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO chapteractivity (chapter_id, activity_id, course_id, "order", creation_date, update_date)
            SELECT a.chapter_id, a.id, a.course_id, a."order",
                   strftime('%Y-%m-%d %H:%M:%S', 'now'),
                   strftime('%Y-%m-%d %H:%M:%S', 'now')
            FROM activity a
            WHERE a.chapter_id IS NOT NULL AND a.course_id IS NOT NULL
            """
        )
    )

    if _column_exists(conn, "activity", "chapter_id"):
        op.drop_column("activity", "chapter_id")
    if _column_exists(conn, "activity", "order"):
        op.drop_column("activity", "order")
    if _column_exists(conn, "chapter", "order"):
        op.drop_column("chapter", "order")
