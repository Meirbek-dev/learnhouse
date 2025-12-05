"""add_user_middle_name

Revision ID: g2b0e16576c4
Revises: f1a9aefaf3ac
Create Date: 2025-12-05 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g2b0e16576c4"
down_revision: str | None = "f1a9aefaf3ac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add middle_name column to user table
    op.add_column("user", sa.Column("middle_name", sa.String(), nullable=True))

    # Set default empty string for existing users
    op.execute("UPDATE \"user\" SET middle_name = '' WHERE middle_name IS NULL")


def downgrade() -> None:
    op.drop_column("user", "middle_name")
