"""Add VARCHAR(500) length constraint to chapter.name and activity.name

Revision ID: r2s3t4u5v6w
Revises: q1r2s3t4u5v
Create Date: 2026-03-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "r2s3t4u5v6w"
down_revision: str | None = "q1r2s3t4u5v"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # Truncate any existing values that exceed the new limit before applying
    # the constraint (defensive guard for existing data).
    conn.execute(
        sa.text(
            "UPDATE chapter SET name = LEFT(name, 500) WHERE LENGTH(name) > 500"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE activity SET name = LEFT(name, 500) WHERE LENGTH(name) > 500"
        )
    )

    op.alter_column(
        "chapter",
        "name",
        existing_type=sa.Text(),
        type_=sa.String(500),
        nullable=False,
    )
    op.alter_column(
        "activity",
        "name",
        existing_type=sa.Text(),
        type_=sa.String(500),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "activity",
        "name",
        existing_type=sa.String(500),
        type_=sa.Text(),
        nullable=False,
    )
    op.alter_column(
        "chapter",
        "name",
        existing_type=sa.String(500),
        type_=sa.Text(),
        nullable=False,
    )
