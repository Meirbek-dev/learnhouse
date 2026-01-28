"""RBAC 5th rewrite

Revision ID: 831861f725e2
Revises: 94253463a6f4
Create Date: 2026-01-28 09:24:21.276303

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "831861f725e2"
down_revision: str | None = "94253463a6f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
