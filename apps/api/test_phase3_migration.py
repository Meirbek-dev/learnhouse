"""
Test Phase 3 RBAC Schema Flatten Migration

This script validates that the rbac_schema_flatten migration:
1. Correctly migrates all permissions from junction tables to user_permissions
2. Preserves all user access (no permission loss)
3. Improves query performance (3 joins → 1 join)
4. Maintains audit trail via granted_via_role_id

Usage:
    # Before migration
    uv run python test_phase3_migration.py export-before

    # After migration
    uv run python test_phase3_migration.py validate

    # Performance comparison
    uv run python test_phase3_migration.py benchmark
"""

import argparse
import json
import time
from datetime import datetime

from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.db.permissions.models import (
    Permission,
    Role,
    UserPermission,
)


def export_user_permissions_before_migration(
    session: Session, output_file: str = "permissions_before.json"
):
    """
    Export all user permissions BEFORE migration.

    NOTE: This function is deprecated as the migration has already been applied
    and the old tables (user_roles, role_permissions) have been dropped.
    """
    print("=" * 70)
    print("DEPRECATED: Old tables have been dropped")
    print("=" * 70)
    print("\n❌ Cannot export from old schema - migration already complete")
    print("   Tables dropped: user_roles, role_permissions")
    print("   Current schema uses: user_permissions (flattened)")
    return None


def validate_migration(session: Session, before_file: str = "permissions_before.json"):
    """
    Validate that migration preserved all permissions.

    Compares BEFORE snapshot with AFTER state using new user_permissions table.
    """
    print("=" * 70)
    print("VALIDATING MIGRATION")
    print("=" * 70)

    # Load BEFORE snapshot
    try:
        with open(before_file, "r") as f:
            before_data = json.load(f)
    except FileNotFoundError:
        print(f"\n❌ ERROR: {before_file} not found")
        print("   Run 'export-before' command before migration first")
        return False

    print(f"\nLoaded BEFORE snapshot from {before_file}")
    print(f"  Exported at: {before_data['exported_at']}")
    print(f"  Total users: {before_data['total_users']}")

    # Get AFTER state from user_permissions table
    print("\nQuerying user_permissions table (NEW)...")

    try:
        user_perms_after = session.exec(select(UserPermission)).all()
    except Exception as e:
        print(f"\n❌ ERROR: Could not query user_permissions table: {e}")
        print("   Migration may not have run yet. Run: alembic upgrade head")
        return False

    print(f"  Found {len(user_perms_after)} user-permission entries")

    # Build AFTER map
    user_permissions_after = {}

    for up in user_perms_after:
        key = f"{up.user_id}:{up.org_id}"

        if key not in user_permissions_after:
            user_permissions_after[key] = {
                "user_id": up.user_id,
                "org_id": up.org_id,
                "permissions": [],
            }

        # Get permission name
        perm = session.get(Permission, up.permission_id)
        if perm:
            user_permissions_after[key]["permissions"].append(perm.name)

    # Compare
    print("\n" + "=" * 70)
    print("COMPARISON RESULTS")
    print("=" * 70)

    all_valid = True
    missing_users = []
    permission_mismatches = []

    for user_perm_before in before_data["user_permissions"]:
        user_id = user_perm_before["user_id"]
        org_id = user_perm_before["org_id"]
        key = f"{user_id}:{org_id}"

        perms_before = set(user_perm_before["permissions"])

        if key not in user_permissions_after:
            missing_users.append(key)
            all_valid = False
            continue

        perms_after = set(user_permissions_after[key]["permissions"])

        if perms_before != perms_after:
            missing = perms_before - perms_after
            extra = perms_after - perms_before

            permission_mismatches.append(
                {
                    "user_org": key,
                    "missing_permissions": list(missing),
                    "extra_permissions": list(extra),
                }
            )
            all_valid = False

    # Report
    if all_valid:
        print("\n✅ ALL VALIDATIONS PASSED")
        print(f"   - All {len(before_data['user_permissions'])} users preserved")
        print("   - All permissions migrated correctly")
        print(f"   - Total permissions in new table: {len(user_perms_after)}")
    else:
        print("\n❌ VALIDATION FAILED")

        if missing_users:
            print(f"\n  Missing users: {len(missing_users)}")
            for user in missing_users[:5]:
                print(f"    - {user}")
            if len(missing_users) > 5:
                print(f"    ... and {len(missing_users) - 5} more")

        if permission_mismatches:
            print(f"\n  Permission mismatches: {len(permission_mismatches)}")
            for mismatch in permission_mismatches[:3]:
                print(f"    - {mismatch['user_org']}:")
                if mismatch["missing_permissions"]:
                    print(f"      Missing: {mismatch['missing_permissions']}")
                if mismatch["extra_permissions"]:
                    print(f"      Extra: {mismatch['extra_permissions']}")
            if len(permission_mismatches) > 3:
                print(f"    ... and {len(permission_mismatches) - 3} more")

    print("\n" + "=" * 70)

    return all_valid


def benchmark_performance(session: Session, iterations: int = 100):
    """
    Benchmark query performance: NEW (1 join) architecture.

    NOTE: Old query benchmark removed as user_roles table has been dropped.
    """
    print("=" * 70)
    print("PERFORMANCE BENCHMARK (NEW ARCHITECTURE)")
    print("=" * 70)

    # Rollback any pending transactions to get a clean state
    try:
        session.rollback()
    except Exception:
        pass

    # Get a sample user permission
    try:
        user_perm = session.exec(select(UserPermission)).first()
    except Exception as e:
        print(f"\n❌ Error querying user_permissions: {e}")
        user_perm = None

    if not user_perm:
        print("\n❌ No user_permissions found - database may be empty")
        return

    user_id = user_perm.user_id
    org_id = user_perm.org_id

    print(f"\nBenchmarking with user_id={user_id}, org_id={org_id}")
    print(f"Running {iterations} iterations...")

    # OLD QUERY: Deprecated (tables dropped)
    print("\n❌ OLD QUERY: Deprecated (user_roles table dropped)")
    old_time = None
    old_avg = None

    # Benchmark NEW query
    print("\n✅ NEW QUERY (1 join: user_permissions → permissions)")
    start = time.time()

    for _ in range(iterations):
        session.exec(
            select(Permission)
            .join(UserPermission, UserPermission.permission_id == Permission.id)
            .where(
                UserPermission.user_id == user_id,
                UserPermission.org_id == org_id,
            )
        ).all()

    new_time = time.time() - start
    new_avg = (new_time / iterations) * 1000  # ms

    print(f"   Total time: {new_time:.3f}s")
    print(f"   Average: {new_avg:.2f}ms per query")

    # Comparison
    if old_time:
        speedup = old_avg / new_avg
        reduction = ((old_avg - new_avg) / old_avg) * 100

        print("\n" + "=" * 70)
        print("PERFORMANCE IMPROVEMENT")
        print("=" * 70)
        print(f"  OLD: {old_avg:.2f}ms")
        print(f"  NEW: {new_avg:.2f}ms")
        print(f"  Speedup: {speedup:.2f}x faster")
        print(f"  Reduction: {reduction:.1f}% faster")
        print(
            "\n✅ Phase 3 performance goals: 60% faster (target met: {})".format(
                "✅" if reduction >= 60 else "❌"
            )
        )
    else:
        print("\n⚠️  Cannot compare - old tables not available")

    print("\n" + "=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Test Phase 3 RBAC Schema Flatten Migration"
    )
    parser.add_argument(
        "command",
        choices=["export-before", "validate", "benchmark"],
        help="Command to run",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=100,
        help="Number of iterations for benchmark (default: 100)",
    )

    args = parser.parse_args()

    try:
        if args.command == "export-before":
            # Get fresh session
            session = next(get_db_session())
            try:
                export_user_permissions_before_migration(session)
            finally:
                session.close()

        elif args.command == "validate":
            # Get fresh session
            session = next(get_db_session())
            try:
                success = validate_migration(session)
                exit(0 if success else 1)
            finally:
                session.close()

        elif args.command == "benchmark":
            # Get fresh session
            session = next(get_db_session())
            try:
                benchmark_performance(session, iterations=args.iterations)
            finally:
                session.close()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)


if __name__ == "__main__":
    main()
