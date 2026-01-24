"""RBAC rewrite

Revision ID: 69fd16a5d534
Revises: 103e657f0164
Create Date: 2026-01-23 22:37:32.359114

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69fd16a5d534'
down_revision: Union[str, None] = '103e657f0164'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
