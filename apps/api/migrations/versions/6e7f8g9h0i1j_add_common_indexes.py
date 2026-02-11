"""add_common_indexes

Revision ID: 6e7f8g9h0i1j
Revises: 5d6e7f8g9h0i
Create Date: 2026-02-11 00:40:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6e7f8g9h0i1j"
down_revision: Union[str, None] = "5d6e7f8g9h0i"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Indexes to improve common filters
    try:
        op.create_index("idx_activity_type", "activity", ["activity_type"])
    except Exception:
        pass
    try:
        op.create_index("idx_activity_published", "activity", ["published"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("idx_activity_type", table_name="activity")
    except Exception:
        pass
    try:
        op.drop_index("idx_activity_published", table_name="activity")
    except Exception:
        pass
