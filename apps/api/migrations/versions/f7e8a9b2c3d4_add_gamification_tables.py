"""add_gamification_tables

Revision ID: f7e8a9b2c3d4
Revises: cb2029aadc2d
Create Date: 2025-01-31 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f7e8a9b2c3d4"
down_revision = "cb2029aadc2d"
branch_labels = None
depends_on = None


def upgrade():
    # Create UserGamificationProfile table
    op.create_table(
        "usergamificationprofile",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("total_xp", sa.Integer(), nullable=True, default=0),
        sa.Column("current_level", sa.Integer(), nullable=True, default=1),
        sa.Column("xp_to_next_level", sa.Integer(), nullable=True, default=100),
        sa.Column("current_login_streak", sa.Integer(), nullable=True, default=0),
        sa.Column("longest_login_streak", sa.Integer(), nullable=True, default=0),
        sa.Column("current_learning_streak", sa.Integer(), nullable=True, default=0),
        sa.Column("longest_learning_streak", sa.Integer(), nullable=True, default=0),
        sa.Column("last_login_date", sa.String(), nullable=True),
        sa.Column("last_learning_activity_date", sa.String(), nullable=True),
        sa.Column("profile_data", sa.JSON(), nullable=True),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.Column("update_date", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_usergamificationprofile_user_id"),
        "usergamificationprofile",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_usergamificationprofile_org_id"),
        "usergamificationprofile",
        ["org_id"],
        unique=False,
    )

    # Create XPTransaction table
    op.create_table(
        "xptransaction",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("xp_amount", sa.Integer(), nullable=False),
        sa.Column("xp_source", sa.String(), nullable=False),
        sa.Column("xp_context", sa.JSON(), nullable=True),
        sa.Column("related_activity_id", sa.Integer(), nullable=True),
        sa.Column("related_course_id", sa.Integer(), nullable=True),
        sa.Column("related_trail_step_id", sa.Integer(), nullable=True),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_xptransaction_user_id"), "xptransaction", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_xptransaction_org_id"), "xptransaction", ["org_id"], unique=False
    )
    op.create_index(
        op.f("ix_xptransaction_xp_source"), "xptransaction", ["xp_source"], unique=False
    )

    # Create StreakRecord table
    op.create_table(
        "streakrecord",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("streak_type", sa.String(), nullable=False),
        sa.Column("current_count", sa.Integer(), nullable=True, default=0),
        sa.Column("longest_count", sa.Integer(), nullable=True, default=0),
        sa.Column("streak_start_date", sa.String(), nullable=True),
        sa.Column("last_activity_date", sa.String(), nullable=True),
        sa.Column("streak_end_date", sa.String(), nullable=True),
        sa.Column("streak_data", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, default=True),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.Column("update_date", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organization.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_streakrecord_user_id"), "streakrecord", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_streakrecord_org_id"), "streakrecord", ["org_id"], unique=False
    )
    op.create_index(
        op.f("ix_streakrecord_streak_type"),
        "streakrecord",
        ["streak_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_streakrecord_is_active"), "streakrecord", ["is_active"], unique=False
    )


def downgrade():
    # Drop tables in reverse order
    op.drop_index(op.f("ix_streakrecord_is_active"), table_name="streakrecord")
    op.drop_index(op.f("ix_streakrecord_streak_type"), table_name="streakrecord")
    op.drop_index(op.f("ix_streakrecord_org_id"), table_name="streakrecord")
    op.drop_index(op.f("ix_streakrecord_user_id"), table_name="streakrecord")
    op.drop_table("streakrecord")

    op.drop_index(op.f("ix_xptransaction_xp_source"), table_name="xptransaction")
    op.drop_index(op.f("ix_xptransaction_org_id"), table_name="xptransaction")
    op.drop_index(op.f("ix_xptransaction_user_id"), table_name="xptransaction")
    op.drop_table("xptransaction")

    op.drop_index(
        op.f("ix_usergamificationprofile_org_id"), table_name="usergamificationprofile"
    )
    op.drop_index(
        op.f("ix_usergamificationprofile_user_id"), table_name="usergamificationprofile"
    )
    op.drop_table("usergamificationprofile")
