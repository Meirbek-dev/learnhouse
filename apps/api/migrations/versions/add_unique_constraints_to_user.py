"""Add unique constraints to user table

Revision ID: add_unique_constraints_to_user
Revises: l8oaz1wgmyid
Create Date: 2026-01-31 12:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_unique_constraints_to_user"
down_revision: str | None = "l8oaz1wgmyid"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_unique_constraint("uq_user_user_uuid", "user", ["user_uuid"])
    op.create_unique_constraint("uq_user_email", "user", ["email"])
    op.create_unique_constraint("uq_user_username", "user", ["username"])

def downgrade() -> None:
    op.drop_constraint("uq_user_user_uuid", "user", type_="unique")
    op.drop_constraint("uq_user_email", "user", type_="unique")
    op.drop_constraint("uq_user_username", "user", type_="unique")
