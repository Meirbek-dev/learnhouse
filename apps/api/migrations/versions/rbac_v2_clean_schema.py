"""RBAC v2 Clean Schema - Production Ready

Revision ID: rbac_v2_clean_schema
Revises: rbac_schema_flatten
Create Date: 2026-02-02 12:00:00.000000

This migration creates a clean, production-ready RBAC schema based on
the comprehensive refactoring plan.

Key improvements:
1. Minimal, correct schema (no over-engineering)
2. Proper indexes for performance
3. Clear separation of concerns
4. No denormalization without proven benefit
5. Production-grade audit logging

Tables created:
- permissions: System-defined permissions
- roles: Role definitions (org-specific or global)
- role_permissions: Many-to-many role-permission assignments
- user_roles: User role assignments per organization
- permission_audit_log: Security event logging
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "rbac_v2_clean_schema"
down_revision: str | None = "rbac_schema_flatten"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create clean RBAC v2 schema."""
    conn = op.get_bind()

    print("=" * 80)
    print("RBAC v2: Creating Clean Production-Ready Schema")
    print("=" * 80)

    # ========================================================================
    # 1. PERMISSIONS TABLE
    # ========================================================================
    print("\n1. Creating permissions table...")

    op.create_table(
        "permissions_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("is_dangerous", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_permissions_v2"),
        sa.UniqueConstraint("name", name="uq_permissions_v2_name"),
    )

    # Performance indexes
    op.create_index(
        "idx_permissions_v2_resource_action",
        "permissions_v2",
        ["resource_type", "action"],
    )
    op.create_index("idx_permissions_v2_scope", "permissions_v2", ["scope"])
    op.create_index("idx_permissions_v2_category", "permissions_v2", ["category"])

    print("   ✅ Created permissions_v2 table with indexes")

    # ========================================================================
    # 2. ROLES TABLE
    # ========================================================================
    print("\n2. Creating roles table...")

    op.create_table(
        "roles_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("org_id", sa.Integer(), nullable=True),
        sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("priority", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_roles_v2"),
        sa.ForeignKeyConstraint(
            ["org_id"],
            ["organization.id"],
            name="fk_roles_v2_org",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("slug", "org_id", name="uq_roles_v2_slug_org"),
    )

    # Indexes
    op.create_index("idx_roles_v2_org_id", "roles_v2", ["org_id"])
    op.create_index("idx_roles_v2_slug", "roles_v2", ["slug"])
    op.create_index("idx_roles_v2_system", "roles_v2", ["is_system"])

    print("   ✅ Created roles_v2 table with indexes")

    # ========================================================================
    # 3. ROLE_PERMISSIONS TABLE (Junction)
    # ========================================================================
    print("\n3. Creating role_permissions table...")

    op.create_table(
        "role_permissions_v2",
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("permission_id", sa.Integer(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("granted_by_user_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("role_id", "permission_id", name="pk_role_permissions_v2"),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["roles_v2.id"],
            name="fk_role_permissions_v2_role",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"],
            ["permissions_v2.id"],
            name="fk_role_permissions_v2_permission",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["granted_by_user_id"],
            ["user.id"],
            name="fk_role_permissions_v2_granted_by",
            ondelete="SET NULL",
        ),
    )

    # Indexes
    op.create_index("idx_role_permissions_v2_role", "role_permissions_v2", ["role_id"])
    op.create_index(
        "idx_role_permissions_v2_permission", "role_permissions_v2", ["permission_id"]
    )

    print("   ✅ Created role_permissions_v2 table with indexes")

    # ========================================================================
    # 4. USER_ROLES TABLE
    # ========================================================================
    print("\n4. Creating user_roles table...")

    op.create_table(
        "user_roles_v2",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("assigned_by_user_id", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("user_id", "role_id", "org_id", name="pk_user_roles_v2"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            name="fk_user_roles_v2_user",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["roles_v2.id"],
            name="fk_user_roles_v2_role",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["org_id"],
            ["organization.id"],
            name="fk_user_roles_v2_org",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_by_user_id"],
            ["user.id"],
            name="fk_user_roles_v2_assigned_by",
            ondelete="SET NULL",
        ),
    )

    # Indexes for fast lookups
    op.create_index("idx_user_roles_v2_user_org", "user_roles_v2", ["user_id", "org_id"])
    op.create_index("idx_user_roles_v2_role", "user_roles_v2", ["role_id"])

    # Partial index for expired roles (efficient filtering)
    conn.execute(
        text("""
            CREATE INDEX idx_user_roles_v2_expires
            ON user_roles_v2 (expires_at)
            WHERE expires_at IS NOT NULL
        """)
    )

    print("   ✅ Created user_roles_v2 table with indexes")

    # ========================================================================
    # 5. PERMISSION_AUDIT_LOG TABLE
    # ========================================================================
    print("\n5. Creating permission_audit_log table...")

    op.create_table(
        "permission_audit_log_v2",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("permission_name", sa.String(100), nullable=True),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("org_id", sa.Integer(), nullable=True),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("request_id", postgresql.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_permission_audit_log_v2"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            name="fk_permission_audit_log_v2_user",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["org_id"],
            ["organization.id"],
            name="fk_permission_audit_log_v2_org",
            ondelete="SET NULL",
        ),
    )

    # Indexes for security analysis
    op.create_index(
        "idx_audit_v2_user_created",
        "permission_audit_log_v2",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_audit_v2_resource",
        "permission_audit_log_v2",
        ["resource_type", "resource_id"],
    )
    op.create_index(
        "idx_audit_v2_org",
        "permission_audit_log_v2",
        ["org_id", sa.text("created_at DESC")],
    )

    # Partial index for denied permissions (security monitoring)
    conn.execute(
        text("""
            CREATE INDEX idx_audit_v2_result_denied
            ON permission_audit_log_v2 (result, created_at DESC)
            WHERE result = 'denied'
        """)
    )

    print("   ✅ Created permission_audit_log_v2 table with indexes")

    # ========================================================================
    # 6. SUMMARY
    # ========================================================================
    print("\n" + "=" * 80)
    print("✅ RBAC v2 Clean Schema Migration Complete!")
    print("=" * 80)
    print("\nTables created:")
    print("  - permissions_v2: System-defined permissions")
    print("  - roles_v2: Role definitions")
    print("  - role_permissions_v2: Role-permission assignments")
    print("  - user_roles_v2: User role assignments")
    print("  - permission_audit_log_v2: Security audit logging")
    print("\nNext steps:")
    print("  1. Run seeding migration to populate permissions")
    print("  2. Migrate data from old tables")
    print("  3. Deploy new RBACService")
    print("  4. Enable feature flag for gradual rollout")
    print("=" * 80)


def downgrade() -> None:
    """Remove RBAC v2 schema."""
    print("Removing RBAC v2 schema...")

    # Drop tables in reverse order (handle foreign keys)
    op.drop_table("permission_audit_log_v2")
    op.drop_table("user_roles_v2")
    op.drop_table("role_permissions_v2")
    op.drop_table("roles_v2")
    op.drop_table("permissions_v2")

    print("✅ RBAC v2 schema removed")
