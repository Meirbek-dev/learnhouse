"""add_action_and_resource_type_to_audit_log

Revision ID: 4804c9db3728
Revises: 57d47f94b5c7
Create Date: 2026-01-31 20:56:07.838803

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4804c9db3728'
down_revision: Union[str, None] = '57d47f94b5c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create ENUM type if it doesn't exist
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE auditaction AS ENUM ('CHECK', 'GRANT', 'REVOKE', 'DENY');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Add action column
    op.add_column('permission_audit_log',
        sa.Column('action', sa.Enum('CHECK', 'GRANT', 'REVOKE', 'DENY', name='auditaction'), nullable=False, server_default='CHECK')
    )

    # Add resource_type column
    op.add_column('permission_audit_log',
        sa.Column('resource_type', sa.String(50), nullable=True)
    )

    # Remove the server_default after adding the column
    op.alter_column('permission_audit_log', 'action', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('permission_audit_log', 'resource_type')
    op.drop_column('permission_audit_log', 'action')
    op.execute("DROP TYPE auditaction")
