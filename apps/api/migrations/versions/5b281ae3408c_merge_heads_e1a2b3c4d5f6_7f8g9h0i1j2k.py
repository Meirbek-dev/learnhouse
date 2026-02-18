"""merge heads: e1a2b3c4d5f6 & 7f8g9h0i1j2k

Revision ID: 5b281ae3408c
Revises: e1a2b3c4d5f6, 7f8g9h0i1j2k
Create Date: 2026-02-19 04:17:48.208591

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b281ae3408c'
down_revision: Union[str, None] = ('e1a2b3c4d5f6', '7f8g9h0i1j2k')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
