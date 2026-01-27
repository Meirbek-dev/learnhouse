"""
Role management service using the new RBAC permission system.

This service provides CRUD operations for roles using the new Role model
from src.db.permissions.
"""

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from src.db.organizations import Organization
from src.db.permissions import (
    Role,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    UserRole,
)
from src.db.users import PublicUser
from src.security.rbac.service_utils import (
    check_user_permission,
    is_admin_or_maintainer,
)
from src.security.rbac.service_utils import (
    rbac_check_role as rbac_check,
)


def _generate_slug(name: str) -> str:
    """Generate a URL-safe slug from a role name."""
    import re

    from transliterate import translit
    from transliterate.exceptions import LanguageDetectionError

    # Try to transliterate non-ASCII characters
    try:
        slug = translit(name, reversed=True)
    except LanguageDetectionError:
        slug = name

    # Convert to lowercase and replace spaces/special chars with hyphens
    slug = re.sub(r"[^\w\s-]", "", slug.lower())
    return re.sub(r"[-\s]+", "-", slug).strip("-")


async def create_role(
    request: Request,
    db_session: Session,
    role_object: RoleCreate,
    current_user: PublicUser,
) -> RoleRead:
    """
    Create a new role for a specific organization.

    Args:
        request: FastAPI request object
        db_session: Database session
        role_object: Role creation data
        current_user: Current authenticated user

    Returns:
        RoleRead: Created role data

    Raises:
        HTTPException: If validation fails or user lacks permissions
    """
    # RBAC check
    await rbac_check(request, current_user, "create", "role_xxx", db_session)

    # Validate org_id is provided
    if not role_object.org_id:
        raise HTTPException(
            status_code=400,
            detail="Organization ID is required for role creation",
        )

    # Check if the organization exists
    statement = select(Organization).where(Organization.id == role_object.org_id)
    organization = db_session.exec(statement).first()

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # Check if the current user is a member of the organization via UserRole
    statement = select(UserRole).where(
        UserRole.user_id == current_user.id,
        UserRole.org_id == role_object.org_id,
    )
    user_role = db_session.exec(statement).first()

    if not user_role:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization",
        )

    # Check permission to create roles
    if not is_admin_or_maintainer(db_session, current_user.id):
        has_perm = check_user_permission(
            db_session, current_user.id, "create", f"org_{role_object.org_id}"
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create roles in this organization.",
            )

    # Validate role name
    if not role_object.name or role_object.name.strip() == "":
        raise HTTPException(
            status_code=400,
            detail="Role name is required and cannot be empty",
        )

    if len(role_object.name.strip()) > 100:
        raise HTTPException(
            status_code=400,
            detail="Role name cannot exceed 100 characters",
        )

    # Generate slug from name
    slug = _generate_slug(role_object.name)

    # Check if a role with the same slug already exists in this organization
    statement = select(Role).where(
        Role.slug == slug,
        Role.org_id == role_object.org_id,
    )
    existing_role = db_session.exec(statement).first()

    if existing_role:
        raise HTTPException(
            status_code=409,
            detail=f"A role with the name '{role_object.name}' already exists in this organization",
        )

    # Create the role
    role = Role(
        name=role_object.name,
        slug=slug,
        description=role_object.description,
        org_id=role_object.org_id,
        is_system=False,  # User-created roles are not system roles
        priority=0,  # Default priority
        parent_role_id=role_object.parent_role_id,
    )

    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    return RoleRead.model_validate(role)


async def get_roles_by_organization(
    request: Request,
    db_session: Session,
    org_id: int,
    current_user: PublicUser,
) -> list[RoleRead]:
    """
    Get all roles for a specific organization, including global roles.

    Args:
        request: FastAPI request object
        db_session: Database session
        org_id: Organization ID
        current_user: Current authenticated user

    Returns:
        list[RoleRead]: List of roles for the organization (including global roles)

    Raises:
        HTTPException: If organization not found or user lacks permissions
    """
    # Check if the organization exists
    statement = select(Organization).where(Organization.id == org_id)
    organization = db_session.exec(statement).first()

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # Check if the current user is a member of the organization
    statement = select(UserRole).where(
        UserRole.user_id == current_user.id,
        UserRole.org_id == org_id,
    )
    user_role = db_session.exec(statement).first()

    if not user_role:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization",
        )

    # Check permission to read roles
    if not is_admin_or_maintainer(db_session, current_user.id):
        has_perm = check_user_permission(
            db_session, current_user.id, "read", f"org_{org_id}"
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to read roles in this organization.",
            )

    # Get global roles (org_id is NULL, is_system is True)
    global_roles_statement = (
        select(Role)
        .where(Role.org_id.is_(None), Role.is_system == True)  # noqa: E712
        .order_by(Role.priority.desc(), Role.name)
    )
    global_roles = list(db_session.exec(global_roles_statement).all())

    # Get organization-specific roles
    org_roles_statement = (
        select(Role)
        .where(Role.org_id == org_id)
        .order_by(Role.priority.desc(), Role.name)
    )
    org_roles = list(db_session.exec(org_roles_statement).all())

    # Combine lists with global roles first
    all_roles = global_roles + org_roles

    return [RoleRead.model_validate(role) for role in all_roles]


async def read_role(
    request: Request,
    db_session: Session,
    role_id: int,
    current_user: PublicUser,
) -> RoleRead:
    """
    Get a single role by ID.

    Args:
        request: FastAPI request object
        db_session: Database session
        role_id: Role ID
        current_user: Current authenticated user

    Returns:
        RoleRead: Role data

    Raises:
        HTTPException: If role not found
    """
    statement = select(Role).where(Role.id == role_id)
    role = db_session.exec(statement).first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    # RBAC check using the role's slug
    await rbac_check(request, current_user, "read", f"role_{role.slug}", db_session)

    return RoleRead.model_validate(role)


async def update_role(
    request: Request,
    db_session: Session,
    role_id: int,
    role_object: RoleUpdate,
    current_user: PublicUser,
) -> RoleRead:
    """
    Update a role by ID.

    Args:
        request: FastAPI request object
        db_session: Database session
        role_id: Role ID
        role_object: Role update data
        current_user: Current authenticated user

    Returns:
        RoleRead: Updated role data

    Raises:
        HTTPException: If role not found or is a system role
    """
    statement = select(Role).where(Role.id == role_id)
    role = db_session.exec(statement).first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    # Prevent updating system roles
    if role.is_system:
        raise HTTPException(
            status_code=403,
            detail="System roles cannot be updated.",
        )

    # RBAC check
    await rbac_check(request, current_user, "update", f"role_{role.slug}", db_session)

    # Update only the fields that were passed in
    update_data = role_object.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if value is not None:
            setattr(role, field, value)

    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    return RoleRead.model_validate(role)


async def delete_role(
    request: Request,
    db_session: Session,
    role_id: int,
    current_user: PublicUser,
) -> str:
    """
    Delete a role by ID.

    Args:
        request: FastAPI request object
        db_session: Database session
        role_id: Role ID
        current_user: Current authenticated user

    Returns:
        str: Confirmation message

    Raises:
        HTTPException: If role not found or is a system role
    """
    statement = select(Role).where(Role.id == role_id)
    role = db_session.exec(statement).first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    # Prevent deleting system roles
    if role.is_system:
        raise HTTPException(
            status_code=403,
            detail="System roles cannot be deleted.",
        )

    # RBAC check
    await rbac_check(request, current_user, "delete", f"role_{role.slug}", db_session)

    db_session.delete(role)
    db_session.commit()

    return "Role deleted"
