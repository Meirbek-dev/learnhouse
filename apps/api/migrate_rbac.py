"""
RBAC Migration Script - Migrate from old rbac_check_* functions to UnifiedPermissionService

This script systematically migrates all service files from the old RBAC system to the new
UnifiedPermissionService pattern.

Usage:
    python migrate_rbac.py [--dry-run] [--file <specific_file>]
"""

import argparse
import re
from pathlib import Path
from typing import List, Tuple

# Root directory for services
SERVICES_ROOT = Path(__file__).parent / "src" / "services"


# Mapping of old imports to new imports
IMPORT_REPLACEMENTS = {
    r"from src\.security\.rbac import courses_rbac_check": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac import courses_rbac_check_for_collections": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac import courses_rbac_check_for_chapters": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac import courses_rbac_check_for_certifications": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac import courses_rbac_check_for_activities": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac import courses_rbac_check_for_assignments": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac\.service_utils import rbac_check_org as rbac_check": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac\.service_utils import rbac_check_user as rbac_check": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac\.service_utils import rbac_check_usergroup as rbac_check": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
    r"from src\.security\.rbac\.service_utils import rbac_check_role as rbac_check": (
        "from src.services.permissions import get_permission_service\n"
        "from src.db.permissions.enums import Action, ResourceType"
    ),
}


# Resource type mapping for different check functions
RESOURCE_TYPE_MAP = {
    "courses_rbac_check": "ResourceType.COURSE",
    "courses_rbac_check_for_collections": "ResourceType.COLLECTION",
    "courses_rbac_check_for_chapters": "ResourceType.CHAPTER",
    "courses_rbac_check_for_certifications": "ResourceType.CERTIFICATE",
    "courses_rbac_check_for_activities": "ResourceType.ACTIVITY",
    "courses_rbac_check_for_assignments": "ResourceType.ASSIGNMENT",
    "rbac_check_org": "ResourceType.ORGANIZATION",
    "rbac_check_user": "ResourceType.USER",
    "rbac_check_role": "ResourceType.ROLE",
    "rbac_check_usergroup": "ResourceType.USERGROUP",
    "rbac_check": "ResourceType.ORGANIZATION",  # Default for generic rbac_check
}


# Action mapping
ACTION_MAP = {
    '"create"': "Action.CREATE",
    '"read"': "Action.READ",
    '"update"': "Action.UPDATE",
    '"delete"': "Action.DELETE",
}


def migrate_imports(content: str) -> str:
    """Replace old RBAC imports with new permission service imports."""
    for old_import, new_import in IMPORT_REPLACEMENTS.items():
        content = re.sub(old_import, new_import, content)
    return content


def get_resource_type_for_function(func_name: str) -> str:
    """Get the resource type for a given RBAC function name."""
    return RESOURCE_TYPE_MAP.get(func_name, "ResourceType.ORGANIZATION")


def convert_rbac_check_call(match: re.Match) -> str:
    """
    Convert an old-style RBAC check call to new UnifiedPermissionService format.

    Handles patterns like:
        await courses_rbac_check(request, course_uuid, current_user, "read", db_session)
        await rbac_check(request, org_uuid, current_user, "update", db_session)
    """
    indent = match.group(1)
    func_name = match.group(2)
    resource_id = match.group(3).strip()
    current_user = match.group(4).strip()
    action = match.group(5).strip()

    # Get resource type for this function
    resource_type = get_resource_type_for_function(func_name)

    # Convert action string to enum
    action_enum = ACTION_MAP.get(action, "Action.READ")

    # Handle special cases for resource_id
    if resource_id in ('"course_x"', "'course_x'", '"collection_x"'):
        resource_id = "None"

    # Build new check call
    return (
        f"{indent}permission_service = get_permission_service(db_session)\n"
        f"{indent}await permission_service.check(\n"
        f"{indent}    user={current_user},\n"
        f"{indent}    action={action_enum},\n"
        f"{indent}    resource={resource_type},\n"
        f"{indent}    resource_id={resource_id},\n"
        f"{indent})"
    )


def migrate_rbac_calls(content: str) -> str:
    """Migrate all RBAC check calls to new format."""

    # Pattern for old-style RBAC check calls (simplified version)
    # Matches: await <func_name>(request, <resource_id>, <current_user>, <action>, db_session)
    pattern = r"([ \t]*)await (courses_rbac_check|courses_rbac_check_for_\w+|rbac_check|rbac_check_org|rbac_check_user|rbac_check_role|rbac_check_usergroup)\(\s*request,\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*db_session\s*\)"

    return re.sub(pattern, convert_rbac_check_call, content)


def migrate_file(file_path: Path, dry_run: bool = False) -> tuple[bool, list[str]]:
    """
    Migrate a single file from old RBAC to new UnifiedPermissionService.

    Returns:
        (was_modified, changes_made)
    """
    try:
        with open(file_path, encoding="utf-8") as f:
            original_content = f.read()

        # Skip if file doesn't use old RBAC system
        if not any(
            pattern in original_content
            for pattern in [
                "from src.security.rbac import",
                "from src.security.rbac.service_utils import rbac_check",
            ]
        ):
            return False, []

        changes = []
        content = original_content

        # Step 1: Migrate imports
        new_content = migrate_imports(content)
        if new_content != content:
            changes.append("Updated imports")
            content = new_content

        # Step 2: Migrate RBAC check calls
        new_content = migrate_rbac_calls(content)
        if new_content != content:
            changes.append("Migrated RBAC check calls")
            content = new_content

        # If nothing changed, return early
        if content == original_content:
            return False, []

        # Write changes if not dry run
        if not dry_run:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"✅ Migrated: {file_path.relative_to(SERVICES_ROOT.parent.parent)}")
        else:
            print(
                f"🔍 Would migrate: {file_path.relative_to(SERVICES_ROOT.parent.parent)}"
            )

        for change in changes:
            print(f"   - {change}")

        return True, changes

    except Exception as e:
        print(f"❌ Error migrating {file_path}: {e}")
        return False, []


def main():
    parser = argparse.ArgumentParser(
        description="Migrate RBAC system to UnifiedPermissionService"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without modifying files",
    )
    parser.add_argument(
        "--file", type=str, help="Migrate a specific file (relative to src/services/)"
    )
    args = parser.parse_args()

    if args.file:
        # Migrate specific file
        file_path = SERVICES_ROOT / args.file
        if not file_path.exists():
            print(f"❌ File not found: {file_path}")
            return

        migrate_file(file_path, dry_run=args.dry_run)
    else:
        # Migrate all Python files in services
        python_files = list(SERVICES_ROOT.rglob("*.py"))
        total = len(python_files)
        migrated = 0

        print(f"🔄 Scanning {total} files in {SERVICES_ROOT}...")
        print()

        for file_path in python_files:
            was_modified, _ = migrate_file(file_path, dry_run=args.dry_run)
            if was_modified:
                migrated += 1

        print()
        print(f"{'📋 Summary (Dry Run)' if args.dry_run else '✅ Migration Complete!'}")
        print(f"   Total files scanned: {total}")
        print(
            f"   Files {'that would be ' if args.dry_run else ''}migrated: {migrated}"
        )
        print(f"   Files unchanged: {total - migrated}")


if __name__ == "__main__":
    main()
