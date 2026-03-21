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
Revises: None
Create Date: 2026-03-21 00:00:00.000000

"""

from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision: str = "i3j4k5l6m7n8"
down_revision: str | None = None
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


def _constraint_rows_for_column(
    conn: sa.Connection, table_name: str, column_name: str
) -> list[tuple[str, str]]:
    rows = conn.execute(
        sa.text(
            """
            SELECT DISTINCT tc.constraint_name, tc.constraint_type
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_schema = kcu.constraint_schema
             AND tc.constraint_name = kcu.constraint_name
             AND tc.table_name = kcu.table_name
            WHERE tc.table_schema = 'public'
              AND tc.table_name = :table_name
              AND kcu.column_name = :column_name
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).fetchall()
    return [(row[0], row[1]) for row in rows]


def _indexes_for_column(
    conn: sa.Connection, table_name: str, column_name: str
) -> list[str]:
    rows = conn.execute(
        sa.text(
            """
            SELECT DISTINCT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = :table_name
              AND indexdef ILIKE :column_pattern
            """
        ),
        {
            "table_name": table_name,
            "column_pattern": f'%({column_name})%',
        },
    ).fetchall()
    return [row[0] for row in rows]


def _drop_column_dependencies(
    conn: sa.Connection, table_name: str, column_name: str
) -> None:
    constraint_type_map = {
        "FOREIGN KEY": "foreignkey",
        "UNIQUE": "unique",
        "PRIMARY KEY": "primary",
    }

    for constraint_name, constraint_type in _constraint_rows_for_column(
        conn, table_name, column_name
    ):
        mapped_type = constraint_type_map.get(constraint_type)
        if mapped_type and constraint_name:
            op.drop_constraint(constraint_name, table_name, type_=mapped_type)

    for index_name in _indexes_for_column(conn, table_name, column_name):
        op.execute(sa.text(f'DROP INDEX IF EXISTS "{index_name}"'))


def _drop_column_if_present(
    conn: sa.Connection, table_name: str, column_name: str
) -> None:
    if not _column_exists(conn, table_name, column_name):
        return

    _drop_column_dependencies(conn, table_name, column_name)
    op.drop_column(table_name, column_name)


def _drop_foreign_keys_referencing_table(
    conn: sa.Connection, referred_table: str
) -> None:
    inspector = sa.inspect(conn)

    for table_name in inspector.get_table_names():
        for foreign_key in inspector.get_foreign_keys(table_name):
            if foreign_key.get("referred_table") != referred_table:
                continue

            foreign_key_name = foreign_key.get("name")
            if foreign_key_name:
                op.drop_constraint(foreign_key_name, table_name, type_="foreignkey")


def upgrade() -> None:
    conn = op.get_bind()
    metadata = sa.MetaData()

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
                platform_table = sa.Table("platform", metadata, autoload_with=conn)

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

                conn.execute(platform_table.insert().values(**values))

    # Defensive cleanup for legacy schema variants that may still retain
    # organization foreign keys or tables despite earlier cleanup migrations.
    for table_name in (
        "role",
        "roles",
        "user_roles",
        "permission_audit_log",
        "role_audit_log",
    ):
        _drop_column_if_present(conn, table_name, "org_id")

    if _table_exists(conn, "userorganization"):
        conn.execute(sa.text('DROP TABLE IF EXISTS "userorganization" CASCADE'))

    _drop_foreign_keys_referencing_table(conn, "organization")

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
