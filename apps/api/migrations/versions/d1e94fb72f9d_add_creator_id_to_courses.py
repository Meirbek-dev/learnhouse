"""add_creator_id_to_courses

Revision ID: d1e94fb72f9d
Revises: 13fcbfcc0e83
Create Date: 2026-01-31 12:48:17.413147

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e94fb72f9d'
down_revision: Union[str, None] = '13fcbfcc0e83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add creator_id column to course table
    op.add_column(
        'course',
        sa.Column('creator_id', sa.BigInteger(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_course_creator_id_user',
        'course',
        'user',
        ['creator_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key constraint
    op.drop_constraint('fk_course_creator_id_user', 'course', type_='foreignkey')

    # Drop creator_id column
    op.drop_column('course', 'creator_id')
