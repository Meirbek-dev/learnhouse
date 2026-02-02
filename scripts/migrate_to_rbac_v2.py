"""
Data Migration Script - Old RBAC → RBAC v2

This script migrates data from the old RBAC tables to the new v2 schema.

Migration flow:
1. permissions → permissions_v2 (copy with validation)
2. roles / roles_new → roles_v2 (copy with cleanup)
3. role_permissions → role_permissions_v2 (copy relationships)
4. user_roles / user_organizations → user_roles_v2 (copy with org context)

Usage:
    python migrate_to_rbac_v2.py [--dry-run] [--skip-validation]

    --dry-run: Show what would be migrated without making changes
    --skip-validation: Skip data validation checks (faster but risky)
"""

import argparse
import sys
from datetime import UTC, datetime

from sqlalchemy import create_engine, text
from sqlmodel import Session

from config.config import get_platform_config


def migrate_permissions(session: Session, dry_run: bool = False) -> dict:
    """Migrate permissions table."""
    print("\n" + "=" * 80)
    print("1. Migrating Permissions")
    print("=" * 80)

    stats = {"migrated": 0, "skipped": 0, "errors": 0}

    # Get old permissions
    result = session.execute(
        text("SELECT id, name, resource_type, action, scope, description, created_at FROM permissions")
    )
    old_permissions = result.fetchall()

    print(f"Found {len(old_permissions)} permissions to migrate")

    for perm in old_permissions:
        # Check if already migrated
        existing = session.execute(
            text("SELECT id FROM permissions_v2 WHERE name = :name"),
            {"name": perm.name}
        ).fetchone()

        if existing:
            stats["skipped"] += 1
            continue

        if not dry_run:
            try:
                session.execute(
                    text("""
                        INSERT INTO permissions_v2
                        (name, resource_type, action, scope, description, created_at)
                        VALUES
                        (:name, :resource_type, :action, :scope, :description, :created_at)
                    """),
                    {
                        "name": perm.name,
                        "resource_type": perm.resource_type,
                        "action": perm.action,
                        "scope": perm.scope,
                        "description": perm.description,
                        "created_at": perm.created_at or datetime.now(UTC),
                    }
                )
                stats["migrated"] += 1
            except Exception as e:
                print(f"   ⚠️  Error migrating permission {perm.name}: {e}")
                stats["errors"] += 1
        else:
            stats["migrated"] += 1

    if not dry_run:
        session.commit()

    print(f"   ✅ Migrated: {stats['migrated']}")
    print(f"   ⏭️  Skipped: {stats['skipped']}")
    print(f"   ❌ Errors: {stats['errors']}")

    return stats


def migrate_roles(session: Session, dry_run: bool = False) -> dict:
    """Migrate roles table."""
    print("\n" + "=" * 80)
    print("2. Migrating Roles")
    print("=" * 80)

    stats = {"migrated": 0, "skipped": 0, "errors": 0}

    # Try both old table names
    for table_name in ["roles", "roles_new"]:
        try:
            result = session.execute(
                text(f"""
                    SELECT id, slug, name, description, org_id, is_system, priority,
                           created_at, updated_at
                    FROM {table_name}
                """)
            )
            old_roles = result.fetchall()

            print(f"Found {len(old_roles)} roles in {table_name}")

            for role in old_roles:
                # Check if already migrated
                existing = session.execute(
                    text("""
                        SELECT id FROM roles_v2
                        WHERE slug = :slug
                        AND (org_id = :org_id OR (org_id IS NULL AND :org_id IS NULL))
                    """),
                    {"slug": role.slug, "org_id": role.org_id}
                ).fetchone()

                if existing:
                    stats["skipped"] += 1
                    continue

                if not dry_run:
                    try:
                        session.execute(
                            text("""
                                INSERT INTO roles_v2
                                (slug, name, description, org_id, is_system, priority,
                                 created_at, updated_at)
                                VALUES
                                (:slug, :name, :description, :org_id, :is_system, :priority,
                                 :created_at, :updated_at)
                            """),
                            {
                                "slug": role.slug,
                                "name": role.name,
                                "description": role.description,
                                "org_id": role.org_id,
                                "is_system": getattr(role, 'is_system', False),
                                "priority": getattr(role, 'priority', 0),
                                "created_at": getattr(role, 'created_at', datetime.now(UTC)),
                                "updated_at": getattr(role, 'updated_at', datetime.now(UTC)),
                            }
                        )
                        stats["migrated"] += 1
                    except Exception as e:
                        print(f"   ⚠️  Error migrating role {role.slug}: {e}")
                        stats["errors"] += 1
                else:
                    stats["migrated"] += 1

            break  # Success, don't try other table names

        except Exception as e:
            print(f"   ℹ️  Table {table_name} not found or error: {e}")
            continue

    if not dry_run:
        session.commit()

    print(f"   ✅ Migrated: {stats['migrated']}")
    print(f"   ⏭️  Skipped: {stats['skipped']}")
    print(f"   ❌ Errors: {stats['errors']}")

    return stats


def migrate_role_permissions(session: Session, dry_run: bool = False) -> dict:
    """Migrate role_permissions table."""
    print("\n" + "=" * 80)
    print("3. Migrating Role-Permission Assignments")
    print("=" * 80)

    stats = {"migrated": 0, "skipped": 0, "errors": 0}

    try:
        result = session.execute(
            text("""
                SELECT role_id, permission_id, granted_at, granted_by_user_id
                FROM role_permissions
            """)
        )
        old_assignments = result.fetchall()

        print(f"Found {len(old_assignments)} role-permission assignments")

        for assignment in old_assignments:
            # Map old role_id to new role_id
            new_role = session.execute(
                text("SELECT id FROM roles_v2 LIMIT 1 OFFSET :offset"),
                {"offset": assignment.role_id - 1}
            ).fetchone()

            # Map old permission_id to new permission_id
            new_perm = session.execute(
                text("SELECT id FROM permissions_v2 LIMIT 1 OFFSET :offset"),
                {"offset": assignment.permission_id - 1}
            ).fetchone()

            if not new_role or not new_perm:
                stats["skipped"] += 1
                continue

            # Check if already migrated
            existing = session.execute(
                text("""
                    SELECT 1 FROM role_permissions_v2
                    WHERE role_id = :role_id AND permission_id = :perm_id
                """),
                {"role_id": new_role.id, "perm_id": new_perm.id}
            ).fetchone()

            if existing:
                stats["skipped"] += 1
                continue

            if not dry_run:
                try:
                    session.execute(
                        text("""
                            INSERT INTO role_permissions_v2
                            (role_id, permission_id, granted_at, granted_by_user_id)
                            VALUES
                            (:role_id, :perm_id, :granted_at, :granted_by)
                        """),
                        {
                            "role_id": new_role.id,
                            "perm_id": new_perm.id,
                            "granted_at": getattr(assignment, 'granted_at', datetime.now(UTC)),
                            "granted_by": getattr(assignment, 'granted_by_user_id', None),
                        }
                    )
                    stats["migrated"] += 1
                except Exception as e:
                    print(f"   ⚠️  Error migrating assignment: {e}")
                    stats["errors"] += 1
            else:
                stats["migrated"] += 1

        if not dry_run:
            session.commit()

    except Exception as e:
        print(f"   ⚠️  Error accessing role_permissions: {e}")

    print(f"   ✅ Migrated: {stats['migrated']}")
    print(f"   ⏭️  Skipped: {stats['skipped']}")
    print(f"   ❌ Errors: {stats['errors']}")

    return stats


def migrate_user_roles(session: Session, dry_run: bool = False) -> dict:
    """Migrate user_roles table."""
    print("\n" + "=" * 80)
    print("4. Migrating User-Role Assignments")
    print("=" * 80)

    stats = {"migrated": 0, "skipped": 0, "errors": 0}

    try:
        result = session.execute(
            text("""
                SELECT user_id, role_id, org_id, assigned_at,
                       assigned_by_user_id, expires_at
                FROM user_roles
            """)
        )
        old_user_roles = result.fetchall()

        print(f"Found {len(old_user_roles)} user-role assignments")

        for ur in old_user_roles:
            # Check if already migrated
            existing = session.execute(
                text("""
                    SELECT 1 FROM user_roles_v2
                    WHERE user_id = :user_id AND role_id = :role_id AND org_id = :org_id
                """),
                {"user_id": ur.user_id, "role_id": ur.role_id, "org_id": ur.org_id}
            ).fetchone()

            if existing:
                stats["skipped"] += 1
                continue

            if not dry_run:
                try:
                    session.execute(
                        text("""
                            INSERT INTO user_roles_v2
                            (user_id, role_id, org_id, assigned_at,
                             assigned_by_user_id, expires_at)
                            VALUES
                            (:user_id, :role_id, :org_id, :assigned_at,
                             :assigned_by, :expires_at)
                        """),
                        {
                            "user_id": ur.user_id,
                            "role_id": ur.role_id,
                            "org_id": ur.org_id,
                            "assigned_at": getattr(ur, 'assigned_at', datetime.now(UTC)),
                            "assigned_by": getattr(ur, 'assigned_by_user_id', None),
                            "expires_at": getattr(ur, 'expires_at', None),
                        }
                    )
                    stats["migrated"] += 1
                except Exception as e:
                    print(f"   ⚠️  Error migrating user role: {e}")
                    stats["errors"] += 1
            else:
                stats["migrated"] += 1

        if not dry_run:
            session.commit()

    except Exception as e:
        print(f"   ⚠️  Error accessing user_roles: {e}")

    print(f"   ✅ Migrated: {stats['migrated']}")
    print(f"   ⏭️  Skipped: {stats['skipped']}")
    print(f"   ❌ Errors: {stats['errors']}")

    return stats


def validate_migration(session: Session) -> bool:
    """Validate migration results."""
    print("\n" + "=" * 80)
    print("5. Validating Migration")
    print("=" * 80)

    all_valid = True

    # Check permissions count
    old_count = session.execute(text("SELECT COUNT(*) FROM permissions")).scalar()
    new_count = session.execute(text("SELECT COUNT(*) FROM permissions_v2")).scalar()
    print(f"   Permissions: {old_count} → {new_count}")
    if new_count < old_count:
        print("   ⚠️  Warning: New table has fewer permissions!")
        all_valid = False

    # Check roles count
    try:
        old_count = session.execute(text("SELECT COUNT(*) FROM roles")).scalar()
    except Exception:
        try:
            old_count = session.execute(text("SELECT COUNT(*) FROM roles_new")).scalar()
        except Exception:
            old_count = 0
    new_count = session.execute(text("SELECT COUNT(*) FROM roles_v2")).scalar()
    print(f"   Roles: {old_count} → {new_count}")

    # Check user-role assignments
    try:
        old_count = session.execute(text("SELECT COUNT(*) FROM user_roles")).scalar()
    except Exception:
        old_count = 0
    new_count = session.execute(text("SELECT COUNT(*) FROM user_roles_v2")).scalar()
    print(f"   User-Role Assignments: {old_count} → {new_count}")

    if all_valid:
        print("\n   ✅ Migration validation passed!")
    else:
        print("\n   ⚠️  Migration validation found issues!")

    return all_valid


def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(description="Migrate old RBAC to RBAC v2")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without making changes")
    parser.add_argument("--skip-validation", action="store_true", help="Skip validation checks")
    args = parser.parse_args()

    print("=" * 80)
    print("RBAC v2 Data Migration")
    print("=" * 80)

    if args.dry_run:
        print("\n⚠️  DRY RUN MODE - No changes will be made\n")

    # Get database connection
    config = get_platform_config()
    engine = create_engine(config.database_config.sql_connection_string)

    with Session(engine) as session:
        # Run migrations
        total_stats = {
            "permissions": migrate_permissions(session, args.dry_run),
            "roles": migrate_roles(session, args.dry_run),
            "role_permissions": migrate_role_permissions(session, args.dry_run),
            "user_roles": migrate_user_roles(session, args.dry_run),
        }

        # Validate if not dry run and not skipped
        if not args.dry_run and not args.skip_validation:
            validate_migration(session)

        # Summary
        print("\n" + "=" * 80)
        print("Migration Summary")
        print("=" * 80)

        total_migrated = sum(s["migrated"] for s in total_stats.values())
        total_skipped = sum(s["skipped"] for s in total_stats.values())
        total_errors = sum(s["errors"] for s in total_stats.values())

        print(f"   Total Migrated: {total_migrated}")
        print(f"   Total Skipped: {total_skipped}")
        print(f"   Total Errors: {total_errors}")

        if total_errors > 0:
            print("\n   ⚠️  Migration completed with errors!")
            sys.exit(1)
        else:
            print("\n   ✅ Migration completed successfully!")
            sys.exit(0)


if __name__ == "__main__":
    main()
