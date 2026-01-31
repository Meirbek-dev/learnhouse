"""add_creator_id_to_activities

Revision ID: 13fcbfcc0e83
Revises: 4f11b4c2940d
Create Date: 2026-01-31 12:24:44.409079

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13fcbfcc0e83'
down_revision: Union[str, None] = '4f11b4c2940d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add creator_id column to activity table
    op.add_column(
        'activity',
        sa.Column('creator_id', sa.BigInteger(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_activity_creator_id_user',
        'activity',
        'user',
        ['creator_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key constraint
    op.drop_constraint('fk_activity_creator_id_user', 'activity', type_='foreignkey')

    # Drop creator_id column
    op.drop_column('activity', 'creator_id')
