from fastapi import HTTPException, status


async def check_element_type(element_uuid) -> str:
    """
    Check if the element is a course, a user, a house or a collection, by checking its prefix
    """
    if element_uuid.startswith(("course_", "courseupdate_")):
        return "courses"
    if element_uuid.startswith("user_"):
        return "users"
    if element_uuid.startswith("usergroup_"):
        return "usergroups"
    if element_uuid.startswith("house_"):
        return "houses"
    if element_uuid.startswith("org_"):
        return "organizations"
    if element_uuid.startswith("chapter_"):
        return "coursechapters"
    if element_uuid.startswith("collection_"):
        return "collections"
    if element_uuid.startswith("activity_"):
        return "activities"
    if element_uuid.startswith("role_"):
        return "roles"
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="User rights : Issue verifying element nature",
    )


async def check_course_permissions_with_own(
    element_rights, action: str, is_author: bool = False
) -> bool:
    """
    Check course-specific permissions including "own" permissions.

    Args:
        element_rights: The rights object for courses (PermissionsWithOwn)
        action: The action to check ("read", "update", "delete", "create")
        is_author: Whether the user is the author of the course

    Returns:
        bool: True if permission is granted, False otherwise
    """
    if not element_rights:
        return False

    # Check for general permission first
    if getattr(element_rights, f"action_{action}", False):
        return True

    # Check for "own" permission if user is the author
    if is_author:
        own_action = f"action_{action}_own"
        if getattr(element_rights, own_action, False):
            return True

    return False


async def get_singular_form_of_element(element_uuid):
    element_type = await check_element_type(element_uuid)

    if element_type == "activities":
        return "activity"
    return element_type[:-1]


async def get_id_identifier_of_element(element_uuid):
    singular_form_element = await get_singular_form_of_element(element_uuid)

    if singular_form_element == "organization":
        return "org_id"
    return str(singular_form_element) + "_id"
