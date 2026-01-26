from datetime import datetime
from typing import Literal

from fastapi import HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select, text
from ulid import ULID

from src.db.organizations import Organization
from src.db.roles import Role, RoleCreate, RoleRead, RoleTypeEnum, RoleUpdate
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.service_utils import (
    rbac_check_role as rbac_check,
    is_admin_or_maintainer,
    check_user_permission,
)


async def create_role(
    request: Request,
    db_session: Session,
    role_object: RoleCreate,
    current_user: PublicUser,
):
    role = Role.model_validate(role_object)

    # RBAC check
    await rbac_check(request, current_user, "create", "role_xxx", db_session)

    # ============================================================================
    # VERIFICATION 1: Ensure the role is created as TYPE_ORGANIZATION and has an org_id
    # ============================================================================
    if not role.org_id:
        raise HTTPException(
            status_code=400,
            detail="Organization ID is required for role creation",
        )

    # Force the role type to be TYPE_ORGANIZATION for user-created roles
    role.role_type = RoleTypeEnum.TYPE_ORGANIZATION

    # ============================================================================
    # VERIFICATION 2: Check if the organization exists
    # ============================================================================
    statement = select(Organization).where(Organization.id == role.org_id)
    organization = db_session.exec(statement).first()

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # ============================================================================
    # VERIFICATION 3: Check if the current user is a member of the organization
    # ============================================================================
    statement = select(UserOrganization).where(
        UserOrganization.user_id == current_user.id,
        UserOrganization.org_id == role.org_id,
    )
    user_org = db_session.exec(statement).first()

    if not user_org:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization",
        )

    # ============================================================================
    # VERIFICATION 4: Check if the user has permission to create roles in this organization
    # ============================================================================
    # Check if user has admin/maintainer role or explicit permission via new RBAC system
    if not is_admin_or_maintainer(db_session, current_user.id):
        # As a fallback, also check permission via permission checker (org-level create on roles)
        has_perm = check_user_permission(
            db_session, current_user.id, "create", f"org_{role.org_id}"
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create roles in this organization. Admin or Maintainer role required.",
            )

    # ============================================================================
    # VERIFICATION 5: Check if a role with the same name already exists in this organization
    # ============================================================================
    statement = select(Role).where(
        Role.name == role.name,
        Role.org_id == role.org_id,
        Role.role_type == RoleTypeEnum.TYPE_ORGANIZATION,
    )
    existing_role = db_session.exec(statement).first()

    if existing_role:
        raise HTTPException(
            status_code=409,
            detail=f"A role with the name '{role.name}' already exists in this organization",
        )

    # ============================================================================
    # VERIFICATION 6: Validate role name and description
    # ============================================================================
    if not role.name or role.name.strip() == "":
        raise HTTPException(
            status_code=400,
            detail="Role name is required and cannot be empty",
        )

    if len(role.name.strip()) > 100:  # Assuming a reasonable limit
        raise HTTPException(
            status_code=400,
            detail="Role name cannot exceed 100 characters",
        )

    # Complete the role object
    role.role_uuid = f"role_{ULID()}"
    role.creation_date = str(datetime.now())
    role.update_date = str(datetime.now())

    # ============================================================================
    # VERIFICATION 9: Handle ID sequence issue (existing logic)
    # ============================================================================
    try:
        db_session.add(role)
        db_session.commit()
        db_session.refresh(role)
    except IntegrityError as e:
        if "duplicate key value violates unique constraint" in str(
            e
        ) and "role_pkey" in str(e):
            # Handle the sequence issue by finding the next available ID
            db_session.rollback()

            # Get the maximum ID from the role table using raw SQL
            result = db_session.execute(
                text("SELECT COALESCE(MAX(id), 0) as max_id FROM role")
            )
            max_id_result = result.scalar()
            max_id = max_id_result if max_id_result is not None else 0

            # Set the next available ID
            role.id = max_id + 1

            # Try to insert again
            db_session.add(role)
            db_session.commit()
            db_session.refresh(role)

            # Update the sequence to the correct value for future inserts
            try:
                # Use raw SQL to update the sequence
                db_session.execute(
                    text(f"SELECT setval('role_id_seq', {max_id + 1}, true)")
                )
                db_session.commit()
            except Exception:
                # If sequence doesn't exist or can't be updated, that's okay
                # The manual ID assignment above will handle it
                pass
        else:
            # Re-raise the original exception if it's not the sequence issue
            raise

    # Create RoleRead object with all required fields
    role_data = role.model_dump()
    # Ensure org_id is properly handled
    if role_data.get("org_id") is None:
        role_data["org_id"] = 0
    return RoleRead(**role_data)


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
    # ============================================================================
    # VERIFICATION 1: Check if the organization exists
    # ============================================================================
    statement = select(Organization).where(Organization.id == org_id)
    organization = db_session.exec(statement).first()

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # ============================================================================
    # VERIFICATION 2: Check if the current user is a member of the organization
    # ============================================================================
    statement = select(UserOrganization).where(
        UserOrganization.user_id == current_user.id, UserOrganization.org_id == org_id
    )
    user_org = db_session.exec(statement).first()

    if not user_org:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization",
        )

    # ============================================================================
    # VERIFICATION 3: Check if the user has permission to read roles in this organization
    # ============================================================================
    # Use new RBAC system to check permissions
    if not is_admin_or_maintainer(db_session, current_user.id):
        has_perm = check_user_permission(
            db_session, current_user.id, "read", f"org_{org_id}"
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to read roles in this organization. Admin or Maintainer role required.",
            )

    # ============================================================================
    # GET ROLES: Fetch all roles for the organization AND global roles
    # ============================================================================
    # Get global roles first
    global_roles_statement = (
        select(Role).where(Role.role_type == RoleTypeEnum.TYPE_GLOBAL).order_by(Role.id)
    )

    global_roles = list(db_session.exec(global_roles_statement).all())

    # Get organization-specific roles
    org_roles_statement = (
        select(Role)
        .where(Role.org_id == org_id, Role.role_type == RoleTypeEnum.TYPE_ORGANIZATION)
        .order_by(Role.id)
    )

    org_roles = list(db_session.exec(org_roles_statement).all())

    # Combine lists with global roles first, then organization roles
    all_roles = global_roles + org_roles

    # Convert to RoleRead objects
    role_reads = []
    for role in all_roles:
        role_data = role.model_dump()
        # Ensure org_id is properly handled
        if role_data.get("org_id") is None:
            role_data["org_id"] = 0
        role_reads.append(RoleRead(**role_data))

    return role_reads


async def read_role(
    request: Request, db_session: Session, role_id: int, current_user: PublicUser
):
    statement = select(Role).where(Role.id == role_id)
    result = db_session.exec(statement)

    role = result.first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    # RBAC check
    await rbac_check(request, current_user, "read", role.role_uuid, db_session)

    return RoleRead.model_validate(role)


async def update_role(
    request: Request,
    db_session: Session,
    role_id: int,
    role_object: RoleUpdate,
    current_user: PublicUser,
):
    statement = select(Role).where(Role.id == role_id)
    result = db_session.exec(statement)

    role = result.first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    # ============================================================================
    # VERIFICATION: Prevent updating TYPE_GLOBAL roles
    # ============================================================================
    if role.role_type == RoleTypeEnum.TYPE_GLOBAL:
        raise HTTPException(
            status_code=403,
            detail="Global roles cannot be updated. These are system-defined roles that must remain unchanged.",
        )

    # RBAC check
    await rbac_check(request, current_user, "update", role.role_uuid, db_session)

    # Complete the role object
    role.update_date = str(datetime.now())

    # Update only the fields that were passed in
    update_data = role_object.model_dump(exclude_unset=True)

    # Update the role with the new data
    for field, value in update_data.items():
        if value is not None:
            setattr(role, field, value)

    db_session.add(role)
    db_session.commit()
    db_session.refresh(role)

    return RoleRead.model_validate(role)


async def delete_role(
    request: Request, db_session: Session, role_id: int, current_user: PublicUser
) -> str:
    # First, get the role to check if it exists and get its UUID
    statement = select(Role).where(Role.id == role_id)
    result = db_session.exec(statement)

    role = result.first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    # ============================================================================
    # VERIFICATION: Prevent deleting TYPE_GLOBAL roles
    # ============================================================================
    if role.role_type == RoleTypeEnum.TYPE_GLOBAL:
        raise HTTPException(
            status_code=403,
            detail="Global roles cannot be deleted. These are system-defined roles that must remain unchanged.",
        )

    # RBAC check using the role's UUID
    await rbac_check(request, current_user, "delete", role.role_uuid, db_session)

    db_session.delete(role)
    db_session.commit()

    return "Role deleted"
