"""add_creator_id_to_collections

Revision ID: 4f11b4c2940d
Revises: 5691309115ae
Create Date: 2026-01-31 12:21:43.920923

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4f11b4c2940d"
down_revision: str | None = "5691309115ae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add creator_id column to collection table
    op.add_column("collection", sa.Column("creator_id", sa.BigInteger(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        "fk_collection_creator_id_user",
        "collection",
        "user",
        ["creator_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key constraint
    op.drop_constraint(
        "fk_collection_creator_id_user", "collection", type_="foreignkey"
    )

    # Drop creator_id column
    op.drop_column("collection", "creator_id")
