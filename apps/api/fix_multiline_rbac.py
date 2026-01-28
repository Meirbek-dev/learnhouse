"""
Fix multiline rbac_check calls with keyword arguments.

Handles patterns like:
    await rbac_check(
        request,
        usergroup_uuid="usergroup_X",
        current_user=current_user,
        action="create",
        db_session=db_session,
    )
"""

import re
from pathlib import Path

API_ROOT = Path(__file__).parent


def fix_multiline_usergroup_checks(content: str) -> str:
    """Fix multiline rbac_check calls in usergroups.py."""

    # Pattern for usergroup rbac_check calls with keyword args
    pattern = r'(\s+)await rbac_check\(\s*\n\s+request,\s*\n\s+usergroup_uuid=([^,]+),\s*\n\s+current_user=([^,]+),\s*\n\s+action="(\w+)",\s*\n\s+db_session=([^,\)]+),?\s*\n\s*\)'

    def replace_match(match) -> str:
        indent = match.group(1)
        usergroup_uuid = match.group(2).strip()
        current_user = match.group(3).strip()
        action = match.group(4)

        action_map = {
            "create": "Action.CREATE",
            "read": "Action.READ",
            "update": "Action.UPDATE",
            "delete": "Action.DELETE",
        }
        action_enum = action_map.get(action, "Action.READ")

        # Handle special case for usergroup_X (creation)
        if usergroup_uuid == '"usergroup_X"':
            usergroup_uuid = "None"

        return (
            f"{indent}permission_service = get_permission_service(db_session)\n"
            f"{indent}await permission_service.check(\n"
            f"{indent}    user={current_user},\n"
            f"{indent}    action={action_enum},\n"
            f"{indent}    resource=ResourceType.USERGROUP,\n"
            f"{indent}    resource_id={usergroup_uuid},\n"
            f"{indent})"
        )

    return re.sub(pattern, replace_match, content)


def fix_multiline_user_checks(content: str) -> str:
    """Fix multiline rbac_check calls in users.py."""

    # Pattern for user rbac_check calls with keyword args (different pattern)
    pattern = r'(\s+)await rbac_check\(\s*\n\s+request,\s*\n\s+current_user,\s*\n\s+"(\w+)",\s*\n\s+user\.user_uuid,\s*\n\s+db_session,?\s*\n\s*\)'

    def replace_match(match) -> str:
        indent = match.group(1)
        action = match.group(2)

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
            f"{indent}    resource=ResourceType.USER,\n"
            f"{indent}    resource_id=user.user_uuid,\n"
            f"{indent})"
        )

    return re.sub(pattern, replace_match, content)


def fix_courses_discussions(content: str) -> str:
    """Fix courses_rbac_check calls in discussions.py."""

    # Pattern 1: Simple inline call
    pattern1 = r'(\s+)await courses_rbac_check\(\s*\n\s+request,\s*([^,]+),\s*current_user,\s*"(\w+)",\s*db_session,?\s*\n\s*\)'

    def replace_match1(match) -> str:
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
            f"{indent}    resource=ResourceType.COURSE,\n"
            f"{indent}    resource_id={resource_id},\n"
            f"{indent})"
        )

    content = re.sub(pattern1, replace_match1, content)

    # Pattern 2: Inline single-line
    pattern2 = r'(\s+)await courses_rbac_check\(request,\s*([^,]+),\s*current_user,\s*"(\w+)",\s*db_session\)'
    return re.sub(pattern2, replace_match1, content)


def fix_quiz_block(content: str) -> str:
    """Fix courses_rbac_check calls in quizBlock.py - these have different signature."""

    # These use `permission` param instead of action, need special handling
    # Pattern: await courses_rbac_check(request, course_uuid, user, permission, db_session)
    pattern = r'(\s+)await courses_rbac_check\(\s*\n\s+request=([^,]+),\s*\n\s+course_uuid=([^,]+),\s*\n\s+user=([^,]+),\s*\n\s+permission="([^"]+)",\s*\n\s+db_session=([^,\)]+),?\s*\n\s*\)'

    def replace_match(match) -> str:
        indent = match.group(1)
        course_uuid = match.group(3).strip()
        user = match.group(4).strip()
        permission = match.group(5)

        # Map permission strings to actions
        permission_map = {
            "read": "Action.READ",
            "mark_activities_done": "Action.UPDATE",  # Marking done is an update action
        }
        action_enum = permission_map.get(permission, "Action.READ")

        return (
            f"{indent}permission_service = get_permission_service(db_session)\n"
            f"{indent}await permission_service.check(\n"
            f"{indent}    user={user},\n"
            f"{indent}    action={action_enum},\n"
            f"{indent}    resource=ResourceType.COURSE,\n"
            f"{indent}    resource_id={course_uuid},\n"
            f"{indent})"
        )

    return re.sub(pattern, replace_match, content)


def main():
    files_to_fix = {
        "src/services/users/usergroups.py": fix_multiline_usergroup_checks,
        "src/services/users/users.py": fix_multiline_user_checks,
        "src/services/courses/discussions.py": fix_courses_discussions,
        "src/services/blocks/block_types/quizBlock/quizBlock.py": fix_quiz_block,
    }

    fixed_count = 0

    print("🔧 Fixing remaining multiline RBAC calls...\n")

    for rel_path, fix_func in files_to_fix.items():
        file_path = API_ROOT / rel_path

        if not file_path.exists():
            print(f"⚠️  File not found: {file_path}")
            continue

        try:
            with open(file_path, encoding="utf-8") as f:
                content = f.read()

            original_content = content
            new_content = fix_func(content)

            if new_content != original_content:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"✅ Fixed: {rel_path}")
                fixed_count += 1
            else:
                print(f"⏭️  No changes: {rel_path}")

        except Exception as e:
            print(f"❌ Error fixing {rel_path}: {e}")

    print(f"\n✅ Fixed {fixed_count} files")


if __name__ == "__main__":
    main()
