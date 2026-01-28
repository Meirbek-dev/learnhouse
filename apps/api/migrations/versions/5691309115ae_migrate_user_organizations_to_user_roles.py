"""migrate_user_organizations_to_user_roles

This migration consolidates the legacy userorganization table into the canonical
user_roles table, ensuring no data loss and proper handling of conflicts.

Strategy:
1. Backup userorganization data to a temporary table
2. For each record in userorganization:
   - If not in user_roles, insert it with current timestamp
   - If in user_roles with different role_id, keep user_roles version (newer system)
3. Validate that all user-org relationships are preserved
4. Drop userorganization table

Revision ID: 5691309115ae
Revises: 7ab52f84d98c
Create Date: 2026-01-28 20:25:54.022094

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "5691309115ae"
down_revision: str | None = "7ab52f84d98c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Migrate userorganization to user_roles table."""
    conn = op.get_bind()

    # Step 1: Create backup table
    conn.execute(
        text("""
        CREATE TABLE IF NOT EXISTS userorganization_backup AS
        SELECT * FROM userorganization
    """)
    )

    # Step 2: Count records before migration
    result = conn.execute(text("SELECT COUNT(*) FROM userorganization"))
    original_count = result.scalar()
    print(f"[Migration] Found {original_count} records in userorganization")

    # Step 3: Insert missing records from userorganization into user_roles
    # Only insert if the (user_id, org_id, role_id) combination doesn't exist
    conn.execute(
        text("""
        INSERT INTO user_roles (user_id, role_id, org_id, granted_at, granted_by, expires_at)
        SELECT
            uo.user_id,
            uo.role_id,
            uo.org_id,
            COALESCE(uo.creation_date::timestamp, NOW()),
            NULL,  -- granted_by is not available in old table
            NULL   -- expires_at is not available in old table
        FROM userorganization uo
        WHERE NOT EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = uo.user_id
              AND ur.org_id = uo.org_id
              AND ur.role_id = uo.role_id
        )
        ON CONFLICT (user_id, role_id, org_id) DO NOTHING
    """)
    )

    inserted = conn.execute(
        text("""
        SELECT COUNT(*) FROM user_roles ur
        WHERE EXISTS (
            SELECT 1 FROM userorganization uo
            WHERE uo.user_id = ur.user_id
              AND uo.org_id = ur.org_id
              AND uo.role_id = ur.role_id
        )
    """)
    ).scalar()
    print(f"[Migration] {inserted} userorganization records are now in user_roles")

    # Step 4: Handle conflicts - record where same user-org pair has different roles
    conflicts = conn.execute(
        text("""
        SELECT uo.user_id, uo.org_id, uo.role_id as old_role, ur.role_id as new_role
        FROM userorganization uo
        JOIN user_roles ur ON ur.user_id = uo.user_id AND ur.org_id = uo.org_id
        WHERE ur.role_id != uo.role_id
    """)
    ).fetchall()

    if conflicts:
        print(
            f"[Migration] Found {len(conflicts)} conflicts (same user-org, different role):"
        )
        for conflict in conflicts:
            print(
                f"  User {conflict[0]}, Org {conflict[1]}: old role {conflict[2]} -> keeping new role {conflict[3]}"
            )

    # Step 5: Validate no user-org relationships were lost
    # Every user-org pair in userorganization should have at least one role in user_roles
    missing = conn.execute(
        text("""
        SELECT uo.user_id, uo.org_id
        FROM userorganization uo
        WHERE NOT EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = uo.user_id AND ur.org_id = uo.org_id
        )
    """)
    ).fetchall()

    if missing:
        msg = f"[Migration] VALIDATION FAILED: {len(missing)} user-org relationships missing in user_roles!"
        raise Exception(msg)

    # Step 6: Drop the old table
    op.drop_table("userorganization")
    print(
        "[Migration] Successfully migrated userorganization to user_roles and dropped old table"
    )


def downgrade() -> None:
    """Restore userorganization table from backup."""
    conn = op.get_bind()

    # Recreate userorganization table
    op.create_table(
        "userorganization",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=True),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.Column("update_date", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Restore from backup if it exists
    backup_exists = conn.execute(
        text("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'userorganization_backup'
        )
    """)
    ).scalar()

    if backup_exists:
        conn.execute(
            text("""
            INSERT INTO userorganization
            SELECT * FROM userorganization_backup
        """)
        )
        print("[Migration] Restored userorganization from backup")
    else:
        print("[Migration] WARNING: No backup found, userorganization table is empty")
