"""drop organization table

The organization table is a legacy artefact from the old multitenancy / single-org
architecture. All org_id foreign keys and multitenancy columns were removed in
earlier migrations (37881a918cc1 → f94740bedd61 → g1h2i3j4k5l6 → h2i3j4k5l6m7).
No application code references the organization table any more — the platform table
is the sole source of truth for platform metadata.

Before dropping the table this migration copies any surviving organization row into
the platform table when the platform table is empty, so no data is silently lost on
databases that were never re-installed from scratch.

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-03-21 00:00:00.000000

"""

from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision: str = "i3j4k5l6m7n8"
down_revision: str | None = "h2i3j4k5l6m7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Columns that exist on the organization table after all previous migrations and
# that map 1-to-1 onto the platform table.
_SHARED_COLUMNS = [
    "name",
    "description",
    "about",
    "email",
    "logo_image",
    "thumbnail_image",
    "label",
    "socials",
    "links",
    "previews",
    "landing",
    "creation_date",
    "update_date",
]


def _table_exists(conn: sa.Connection, table_name: str) -> bool:
    return sa.inspect(conn).has_table(table_name)


def _column_exists(conn: sa.Connection, table_name: str, column_name: str) -> bool:
    if not _table_exists(conn, table_name):
        return False
    return any(
        col["name"] == column_name
        for col in sa.inspect(conn).get_columns(table_name)
    )


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "organization"):
        # Nothing to do — already cleaned up on this instance.
        return

    # Migrate data: if platform has no rows yet, seed it from organization.
    if _table_exists(conn, "platform"):
        platform_count = conn.execute(
            sa.text("SELECT COUNT(*) FROM platform")
        ).scalar() or 0

        if platform_count == 0:
            org_row = conn.execute(
                sa.text("SELECT * FROM organization ORDER BY id ASC LIMIT 1")
            ).mappings().first()

            if org_row:
                # Build the INSERT using only columns that exist in both tables.
                org_columns = {
                    col["name"]
                    for col in sa.inspect(conn).get_columns("organization")
                }
                platform_columns = {
                    col["name"]
                    for col in sa.inspect(conn).get_columns("platform")
                }
                transferable = [
                    c for c in _SHARED_COLUMNS
                    if c in org_columns and c in platform_columns
                ]

                now = str(datetime.now())
                values = {col: org_row[col] for col in transferable}
                values.setdefault("creation_date", now)
                values.setdefault("update_date", now)

                cols_sql = ", ".join(f'"{c}"' for c in values)
                params_sql = ", ".join(f":{c}" for c in values)
                conn.execute(
                    sa.text(
                        f'INSERT INTO platform ({cols_sql}) VALUES ({params_sql})'
                    ),
                    values,
                )

    op.drop_table("organization")


def downgrade() -> None:
    """Recreate the organization table (empty — data is not restored)."""
    op.create_table(
        "organization",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("about", sa.Text(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("logo_image", sa.String(), nullable=True),
        sa.Column("thumbnail_image", sa.String(), nullable=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("socials", sa.JSON(), nullable=True),
        sa.Column("links", sa.JSON(), nullable=True),
        sa.Column("previews", sa.JSON(), nullable=True),
        sa.Column("landing", sa.JSON(), nullable=True),
        sa.Column("creation_date", sa.String(), nullable=True),
        sa.Column("update_date", sa.String(), nullable=True),
    )
