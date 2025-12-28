"""add_is_preview_to_exam_attempts

Revision ID: 5fc3d9a8b1e2
Revises: cf0a7109b89b
Create Date: 2025-12-28 12:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5fc3d9a8b1e2"
down_revision: str | None = "cf0a7109b89b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add is_preview column to examattempt table"""
    op.add_column(
        "examattempt",
        sa.Column("is_preview", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    """Remove is_preview column from examattempt table"""
    op.drop_column("examattempt", "is_preview")
