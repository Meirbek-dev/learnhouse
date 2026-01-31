"""Fix duplicate platform users

Revision ID: l8oaz1wgmyid
Revises: 4804c9db3728
Create Date: 2026-01-31 00:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "l8oaz1wgmyid"
down_revision: str | None = "4804c9db3728"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Remove duplicate platform users."""
    conn = op.get_bind()

    # First, find duplicates
    print("[Migration] Checking for duplicate users...")

    result = conn.execute(
        text("""
            SELECT user_uuid, COUNT(*) as count
            FROM "user"
            GROUP BY user_uuid
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        """)
    )
    dups = result.fetchall()

    if not dups:
        print("[Migration] No duplicate users found")
        return

    print(f"[Migration] Found {len(dups)} duplicate user_uuid values:")

    # Tables that reference user.id
    tables_with_user_fk = [
        'user_roles',
        'usergroup_user',
        'resource_authors',
        'trail_runs',
        'trail_steps',
        'payments_users',
        'permission_audit_log',
        'resource_permissions',
        'certifications_issued',
        'assignment_attempts'
    ]

    for dup in dups:
        user_uuid = dup[0]
        count = dup[1]
        print(f"  user_uuid: {user_uuid}, count: {count}")

        # Get all records for this user_uuid
        details = conn.execute(
            text("""
                SELECT id, user_uuid, username, email, creation_date
                FROM "user"
                WHERE user_uuid = :uuid
                ORDER BY id ASC
            """),
            {"uuid": user_uuid}
        ).fetchall()

        # Keep the first one (oldest by ID), delete the rest
        id_to_keep = details[0][0]
        ids_to_delete = [d[0] for d in details[1:]]

        print(f"    Keeping ID: {id_to_keep}")
        print(f"    Deleting IDs: {ids_to_delete}")

        # Transfer references from duplicate users to the kept user
        for del_id in ids_to_delete:
            # user_roles - need special handling for unique constraint
            conn.execute(
                text("""
                    UPDATE user_roles
                    SET user_id = :keep_id
                    WHERE user_id = :del_id
                      AND NOT EXISTS (
                          SELECT 1 FROM user_roles ur2
                          WHERE ur2.user_id = :keep_id
                            AND ur2.role_id = user_roles.role_id
                            AND ur2.org_id = user_roles.org_id
                      )
                """),
                {"keep_id": id_to_keep, "del_id": del_id}
            )
            # Delete any that couldn't be transferred due to conflicts
            conn.execute(
                text("DELETE FROM user_roles WHERE user_id = :del_id"),
                {"del_id": del_id}
            )

            # Handle other tables - simple update or delete
            for table in tables_with_user_fk:
                if table == 'user_roles':
                    continue  # Already handled above

                # Check if table exists
                table_exists = conn.execute(
                    text("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables
                            WHERE table_name = :table_name
                        )
                    """),
                    {"table_name": table}
                ).scalar()

                if not table_exists:
                    continue

                # For most tables, we can just update the reference
                try:
                    conn.execute(
                        text(f"""
                            UPDATE {table}
                            SET user_id = :keep_id
                            WHERE user_id = :del_id
                        """),
                        {"keep_id": id_to_keep, "del_id": del_id}
                    )
                except Exception as e:
                    # If update fails (e.g., due to unique constraint), delete the rows
                    print(f"      Warning: Could not update {table}, deleting rows: {e}")
                    conn.execute(
                        text(f"DELETE FROM {table} WHERE user_id = :del_id"),
                        {"del_id": del_id}
                    )

        # Now delete the duplicate users
        for del_id in ids_to_delete:
            conn.execute(
                text("DELETE FROM \"user\" WHERE id = :del_id"),
                {"del_id": del_id}
            )

        print(f"    Deleted {len(ids_to_delete)} duplicate user(s) for {user_uuid}")

    print("[Migration] Finished removing duplicate users")


def downgrade() -> None:
    """Cannot restore deleted duplicate users."""
    print("[Migration] Cannot restore deleted duplicate users - no downgrade available")
    pass
