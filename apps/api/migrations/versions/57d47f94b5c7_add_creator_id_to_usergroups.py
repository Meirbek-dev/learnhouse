"""add_creator_id_to_usergroups

Revision ID: 57d47f94b5c7
Revises: 0fe8a8e89cdb
Create Date: 2026-01-31 12:59:07.348888

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "57d47f94b5c7"
down_revision: Union[str, None] = "0fe8a8e89cdb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("usergroup", sa.Column("creator_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        "fk_usergroup_creator_id_user",
        "usergroup",
        "user",
        ["creator_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_usergroup_creator_id_user", "usergroup", type_="foreignkey")
    op.drop_column("usergroup", "creator_id")
