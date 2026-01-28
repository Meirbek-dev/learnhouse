"""
Manual RBAC Migration - Fix remaining edge cases

This script handles files that import rbac_check from service modules instead of
directly from src.security.rbac.
"""

import re
from pathlib import Path

# Files with specific patterns to fix
FILES_TO_FIX = {
    "src/services/orgs/orgs.py": {
        "import_to_remove": "from src.security.rbac.service_utils import rbac_check_org as rbac_check",
        "import_to_add": "from src.services.permissions import get_permission_service\nfrom src.db.permissions.enums import Action, ResourceType",
        "resource_type": "ResourceType.ORGANIZATION",
    },
    "src/services/orgs/users.py": {
        "import_to_remove": "from src.services.orgs.orgs import rbac_check",
        "import_to_add": "from src.services.permissions import get_permission_service\nfrom src.db.permissions.enums import Action, ResourceType",
        "resource_type": "ResourceType.ORGANIZATION",
    },
    "src/services/orgs/invites.py": {
        "import_to_remove": None,  # Check if it imports rbac_check
        "import_to_add": "from src.services.permissions import get_permission_service\nfrom src.db.permissions.enums import Action, ResourceType",
        "resource_type": "ResourceType.ORGANIZATION",
    },
    "src/services/payments/payments_products.py": {
        "import_to_remove": None,
        "import_to_add": "from src.services.permissions import get_permission_service\nfrom src.db.permissions.enums import Action, ResourceType",
        "resource_type": "ResourceType.ORGANIZATION",  # Most calls are org-scoped
    },
    "src/services/payments/payments_users.py": {
        "import_to_remove": None,
        "import_to_add": "from src.services.permissions import get_permission_service\nfrom src.db.permissions.enums import Action, ResourceType",
        "resource_type": "ResourceType.ORGANIZATION",
    },
    "src/services/payments/payments_config.py": {
        "import_to_remove": None,
        "import_to_add": "from src.services.permissions import get_permission_service\nfrom src.db.permissions.enums import Action, ResourceType",
        "resource_type": "ResourceType.ORGANIZATION",
    },
    "src/services/payments/payments_customers.py": {
        "import_to_remove": None,
        "import_to_add": "from src.services.permissions import get_permission_service\nfrom src.db.permissions.enums import Action, ResourceType",
        "resource_type": "ResourceType.ORGANIZATION",
    },
}


def convert_rbac_check(content: str, resource_type: str) -> str:
    """
    Convert simple rbac_check calls to permission service format.

    Handles: await rbac_check(request, resource_uuid, current_user, "action", db_session)
    """

    # Pattern to match rbac_check calls with inline params
    pattern = r'(\s+)await rbac_check\(request,\s*([^,]+),\s*current_user,\s*"(\w+)",\s*db_session\)'

    def replace_match(match) -> str:
        indent = match.group(1)
        resource_id = match.group(2).strip()
        action = match.group(3)

        # Map action to enum
        action_map = {
            "create": "Action.CREATE",
            "read": "Action.READ",
            "update": "Action.UPDATE",
            "delete": "Action.DELETE",
        }
        action_enum = action_map.get(action, "Action.READ")

        # Build replacement
        return (
            f"{indent}permission_service = get_permission_service(db_session)\n"
            f"{indent}await permission_service.check(\n"
            f"{indent}    user=current_user,\n"
            f"{indent}    action={action_enum},\n"
            f"{indent}    resource={resource_type},\n"
            f"{indent}    resource_id={resource_id},\n"
            f"{indent})"
        )

    return re.sub(pattern, replace_match, content)


def convert_multiline_rbac_check(content: str, resource_type: str) -> str:
    """
    Convert multiline rbac_check calls.

    Handles:
        await rbac_check(
            request,
            ...
        )
    """

    # Pattern for multiline rbac_check - simplified
    pattern = r'(\s+)await rbac_check\(\s*\n\s+request,\s*\n\s+([^,]+),\s*\n\s+current_user,\s*\n\s+"(\w+)",\s*\n\s+db_session,?\s*\n\s*\)'

    def replace_match(match) -> str:
        indent = match.group(1)
        resource_id = match.group(2).strip()
        action = match.group(3)

        action_map = {
            "create": "Action.CREATE",
            "read": "Action.READ",
            "update": "Action.UPDATE",
            "delete": "Action.DELETE",
        }
        action_enum = action_map.get(action, "Action.READ")

        return (
            f"{indent}permission_service = get_permission_service(db_session)\n"
            f"{indent}await permission_service.check(\n"
            f"{indent}    user=current_user,\n"
            f"{indent}    action={action_enum},\n"
            f"{indent}    resource={resource_type},\n"
            f"{indent}    resource_id={resource_id},\n"
            f"{indent})"
        )

    return re.sub(pattern, replace_match, content)


def fix_file(file_path: Path, config: dict) -> bool:
    """Fix a single file according to its config."""
    try:
        with open(file_path, encoding="utf-8") as f:
            content = f.read()

        original_content = content

        # Step 1: Remove old import if specified
        if config["import_to_remove"]:
            content = content.replace(
                config["import_to_remove"], config["import_to_add"]
            )
        # Add new import after other src.services imports or src.db imports
        elif config["import_to_add"] not in content:
            # Find a good place to insert the import
            import_section_pattern = r"(from src\.db\.[^\n]+\n)"
            matches = list(re.finditer(import_section_pattern, content))
            if matches:
                last_match = matches[-1]
                insert_pos = last_match.end()
                content = (
                    content[:insert_pos]
                    + config["import_to_add"]
                    + "\n"
                    + content[insert_pos:]
                )

        # Step 2: Convert inline rbac_check calls
        content = convert_rbac_check(content, config["resource_type"])

        # Step 3: Convert multiline rbac_check calls
        content = convert_multiline_rbac_check(content, config["resource_type"])

        if content != original_content:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"✅ Fixed: {file_path}")
            return True
        print(f"⏭️  No changes needed: {file_path}")
        return False

    except Exception as e:
        print(f"❌ Error fixing {file_path}: {e}")
        return False


def main():
    api_root = Path(__file__).parent
    fixed_count = 0

    print("🔧 Fixing remaining RBAC edge cases...\n")

    for rel_path, config in FILES_TO_FIX.items():
        file_path = api_root / rel_path
        if file_path.exists():
            if fix_file(file_path, config):
                fixed_count += 1
        else:
            print(f"⚠️  File not found: {file_path}")

    print(f"\n✅ Fixed {fixed_count} files")


if __name__ == "__main__":
    main()
