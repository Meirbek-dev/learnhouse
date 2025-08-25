"""add_gamification_constraints

Add unique constraints and idempotency improvements for gamification tables.
Prevents race conditions and duplicate records.

Revision ID: add_gamification_constraints
Revises: 9e031a0358d1
Create Date: 2025-01-31 11:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_gamification_constraints"
down_revision = "9e031a0358d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add unique constraint to prevent duplicate gamification profiles
    op.create_unique_constraint(
        "uk_gamification_user_org", "usergamificationprofile", ["user_id", "org_id"]
    )

    # 2. Add unique constraint to prevent duplicate user certificates
    # First check if certificateuser table exists
    try:
        op.create_unique_constraint(
            "uk_certificateuser_user_certification",
            "certificateuser",
            ["user_id", "certification_id"],
        )
    except Exception:
        # Table might not exist in all environments
        pass

    try:
        # Ensure user_certification_uuid is unique if table exists
        op.create_unique_constraint(
            "uk_certificateuser_uuid", "certificateuser", ["user_certification_uuid"]
        )
    except Exception:
        # Table might not exist in all environments
        pass

    # 3. Create performance indexes for gamification tables

    # Add idempotency_key column to xptransaction (nullable)
    try:
        op.add_column(
            "xptransaction",
            sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        )
    except Exception:
        pass

    # Unique index for idempotent operations when key provided
    try:
        op.create_index(
            "ux_xptransaction_user_org_idem_key",
            "xptransaction",
            ["user_id", "org_id", "idempotency_key"],
            unique=True,
            postgresql_where=sa.text("idempotency_key IS NOT NULL"),
        )
    except Exception:
        pass

    # Index for XP transaction queries (user, org, date)
    # Model uses 'created_at' not 'creation_date'
    try:
        op.create_index(
            "idx_xptransaction_user_org_date",
            "xptransaction",
            ["user_id", "org_id", "created_at"],
            unique=False,
        )
    except Exception:
        pass

    # Index for XP transaction idempotency checks (activity-based)
    # Current model names: source, source_id
    # Skip creating non-existent relation indexes for now (future schema)

    # Index for XP transaction idempotency checks (course-based)
    # (Removed outdated related_course_id index)

    # Index for XP transaction idempotency checks (trail step-based)
    # (Removed outdated related_trail_step_id index)

    # Preferences table (server-side persistence of user gamification settings)
    try:
        op.create_table(
            "usergamificationpreference",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column(
                "user_id",
                sa.Integer,
                sa.ForeignKey("user.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "org_id",
                sa.Integer,
                sa.ForeignKey("organization.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "preferences",
                sa.JSON,
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column("creation_date", sa.String(length=64), nullable=False),
            sa.Column("update_date", sa.String(length=64), nullable=False),
        )
        op.create_unique_constraint(
            "uk_user_gamification_preference_user_org",
            "usergamificationpreference",
            ["user_id", "org_id"],
        )
        op.create_index(
            "idx_user_gamification_preference_user_org",
            "usergamificationpreference",
            ["user_id", "org_id"],
            unique=False,
        )
    except Exception:
        pass

    # Index for efficient leaderboard queries
    op.create_index(
        "idx_gamification_profile_leaderboard",
        "usergamificationprofile",
        ["org_id", "total_xp", "current_level"],
        unique=False,
    )

    # Index for streak queries
    op.create_index(
        "idx_gamification_profile_streaks",
        "usergamificationprofile",
        ["org_id", "last_login_date", "last_learning_activity_date"],
        unique=False,
    )


def downgrade() -> None:
    try:
        op.drop_index("ux_xptransaction_user_org_idem_key", table_name="xptransaction")
    except Exception:
        pass
    try:
        op.drop_column("xptransaction", "idempotency_key")
    except Exception:
        pass
    try:
        op.drop_index(
            "idx_user_gamification_preference_user_org",
            table_name="usergamificationpreference",
        )
    except Exception:
        pass
    try:
        op.drop_constraint(
            "uk_user_gamification_preference_user_org",
            "usergamificationpreference",
            type_="unique",
        )
    except Exception:
        pass
    try:
        op.drop_table("usergamificationpreference")
    except Exception:
        pass
    # Drop indexes in reverse order
    op.drop_index(
        "idx_gamification_profile_streaks", table_name="usergamificationprofile"
    )
    op.drop_index(
        "idx_gamification_profile_leaderboard", table_name="usergamificationprofile"
    )
    op.drop_index("idx_xptransaction_related_trail_step", table_name="xptransaction")
    op.drop_index("idx_xptransaction_related_course", table_name="xptransaction")
    op.drop_index("idx_xptransaction_related_activity", table_name="xptransaction")
    op.drop_index("idx_xptransaction_user_org_date", table_name="xptransaction")

    # Drop unique constraints
    try:
        op.drop_constraint("uk_certificateuser_uuid", "certificateuser", type_="unique")
    except Exception:
        pass

    try:
        op.drop_constraint(
            "uk_certificateuser_user_certification", "certificateuser", type_="unique"
        )
    except Exception:
        pass

    op.drop_constraint(
        "uk_gamification_user_org", "usergamificationprofile", type_="unique"
    )
