"""RBAC 5th rewrite

Revision ID: 831861f725e2
Revises: 94253463a6f4
Create Date: 2026-01-28 09:24:21.276303

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '831861f725e2'
down_revision: Union[str, None] = '94253463a6f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
