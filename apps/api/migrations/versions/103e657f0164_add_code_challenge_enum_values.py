"""add_code_challenge_enum_values

Revision ID: 103e657f0164
Revises: 5ac1e82ca152
Create Date: 2026-01-06 12:30:52.103818

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '103e657f0164'
down_revision: Union[str, None] = '5ac1e82ca152'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add TYPE_CODE_CHALLENGE to activitytypeenum
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'TYPE_CODE_CHALLENGE'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activitytypeenum')
            ) THEN
                ALTER TYPE activitytypeenum ADD VALUE 'TYPE_CODE_CHALLENGE';
            END IF;
        END $$;
    """)

    # Add SUBTYPE_CODE_GENERAL to activitysubtypeenum
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'SUBTYPE_CODE_GENERAL'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activitysubtypeenum')
            ) THEN
                ALTER TYPE activitysubtypeenum ADD VALUE 'SUBTYPE_CODE_GENERAL';
            END IF;
        END $$;
    """)

    # Add SUBTYPE_CODE_COMPETITIVE to activitysubtypeenum
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'SUBTYPE_CODE_COMPETITIVE'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'activitysubtypeenum')
            ) THEN
                ALTER TYPE activitysubtypeenum ADD VALUE 'SUBTYPE_CODE_COMPETITIVE';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Note: PostgreSQL does not support removing enum values
    # This would require creating a new enum type and migrating data
    pass
