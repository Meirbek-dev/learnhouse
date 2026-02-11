"""convert_json_to_jsonb_gin_indexes

Revision ID: 3b4c5d6e7f8g
Revises: 2a3b4c5d6e7f
Create Date: 2026-02-11 00:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "3b4c5d6e7f8g"
down_revision: Union[str, None] = "2a3b4c5d6e7f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column, index_name)
TARGETS = [
    ("activity", "details", "idx_activity_details_gin"),
    ("block", "content", "idx_block_content_gin"),
    ('"user"', "details", "idx_user_details_gin"),
    ('"user"', "profile", "idx_user_profile_gin"),
    ("organization", "socials", "idx_organization_socials_gin"),
    ("organization", "links", "idx_organization_links_gin"),
    ("certifications", "config", "idx_certifications_config_gin"),
]


def upgrade() -> None:
    # Convert JSON columns to JSONB and create GIN indexes. Casts use USING col::jsonb
    for table, column, index_name in TARGETS:
        try:
            op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE jsonb USING {column}::jsonb"))
        except Exception:
            # If conversion fails (invalid JSON), let the operator handle it manually
            raise RuntimeError(f"Failed to convert {table}.{column} to jsonb - ensure all rows contain valid JSON")
        try:
            op.create_index(index_name, table, [sa.text(column)], postgresql_using="gin")
        except Exception:
            pass


def downgrade() -> None:
    # Downgrade: revert jsonb back to json and drop GIN indexes
    for table, column, index_name in TARGETS:
        try:
            op.drop_index(index_name, table_name=table)
        except Exception:
            pass
        try:
            op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE json USING {column}::json"))
        except Exception:
            pass
