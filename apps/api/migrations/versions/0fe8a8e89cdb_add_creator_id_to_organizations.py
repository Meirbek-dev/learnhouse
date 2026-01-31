"""add_creator_id_to_organizations

Revision ID: 0fe8a8e89cdb
Revises: d1e94fb72f9d
Create Date: 2026-01-31 12:57:42.195391

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0fe8a8e89cdb"
down_revision: Union[str, None] = "d1e94fb72f9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "organization", sa.Column("creator_id", sa.BigInteger(), nullable=True)
    )
    op.create_foreign_key(
        "fk_organization_creator_id_user",
        "organization",
        "user",
        ["creator_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "fk_organization_creator_id_user", "organization", type_="foreignkey"
    )
    op.drop_column("organization", "creator_id")
