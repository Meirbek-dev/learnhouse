from datetime import datetime
from typing import Literal

from fastapi import HTTPException, Request, UploadFile, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.organizations import Organization, OrganizationRead
from src.db.roles import Role, RoleRead
from src.db.user_organizations import UserOrganization
from src.db.users import (
    AnonymousUser,
    InternalUser,
    PublicUser,
    User,
    UserCreate,
    UserRead,
    UserRoleWithOrg,
    UserSession,
    UserUpdate,
    UserUpdatePassword,
    rebuild_user_models,
)
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_user_is_anon,
)
from src.security.security import security_hash_password, security_verify_password
from src.services.orgs.invites import get_invite_code
from src.services.orgs.orgs import get_org_join_mechanism
from src.services.users.avatars import upload_avatar
from src.services.users.emails import send_account_creation_email
from src.services.users.usergroups import add_users_to_usergroup

# Rebuild user models to resolve forward references after all imports
rebuild_user_models()


async def create_user(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_object: UserCreate,
    org_id: int,
):
    # RBAC check
    await rbac_check(request, current_user, "create", "user_x", db_session)

    # Validate organization exists
    await _validate_organization_exists(db_session, org_id)

    # Create and validate user
    user = await _create_and_validate_user(db_session, user_object)

    # Link user and organization
    await _link_user_to_organization(db_session, user.id, org_id)

    user_read = UserRead.model_validate(user)

    # Send Account creation email
    send_account_creation_email(
        user=user_read,
        email=user_read.email,
    )

    return user_read


async def create_user_with_invite(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_object: UserCreate,
    org_id: int,
    invite_code: str,
):
    # Check if invite code exists
    inviteCode = await get_invite_code(
        request, org_id, invite_code, current_user, db_session
    )

    if not inviteCode:
        raise HTTPException(
            status_code=400,
            detail="Invite code is incorrect",
        )

    user = await create_user(request, db_session, current_user, user_object, org_id)

    # Check if invite code contains UserGroup
    if inviteCode.get("usergroup_id"):
        # Add user to UserGroup
        await add_users_to_usergroup(
            request,
            db_session,
            InternalUser(id=0),
            int(inviteCode.get("usergroup_id")),  # type: ignore  # Convert to int since usergroup_id is expected to be int
            str(user.id),
        )

    return user


async def create_user_without_org(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_object: UserCreate,
):
    # RBAC check
    await rbac_check(request, current_user, "create", "user_x", db_session)

    # Create and validate user
    user = await _create_and_validate_user(db_session, user_object)

    user_read = UserRead.model_validate(user)

    # Send Account creation email
    send_account_creation_email(
        user=user_read,
        email=user_read.email,
    )

    return user_read


async def update_user(
    request: Request,
    db_session: Session,
    user_id: int,
    current_user: PublicUser | AnonymousUser,
    user_object: UserUpdate,
):
    # Get user
    user = await _get_user_by_field(db_session, "id", user_id)

    # RBAC check
    await rbac_check(request, current_user, "update", user.user_uuid, db_session)

    # Validate unique constraints if fields are being updated
    if user_object.username:
        await _validate_unique_username(
            db_session, user_object.username, exclude_user_id=current_user.id
        )

    if user_object.email:
        await _validate_unique_email(
            db_session, user_object.email, exclude_user_id=current_user.id
        )

    # Update user
    user_data = user_object.model_dump(exclude_unset=True)
    for key, value in user_data.items():
        setattr(user, key, value)

    user.update_date = str(datetime.now())

    # Update user in database
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return UserRead.model_validate(user)


async def update_user_avatar(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    avatar_file: UploadFile | None = None,
):
    # Get user
    user = await _get_user_by_field(db_session, "id", current_user.id)

    # RBAC check
    await rbac_check(request, current_user, "update", user.user_uuid, db_session)

    # Upload avatar
    if avatar_file and avatar_file.filename:
        name_in_disk = (
            f"{user.user_uuid}_avatar_{ULID()}.{avatar_file.filename.split('.')[-1]}"
        )
        await upload_avatar(avatar_file, name_in_disk, user.user_uuid)

        if name_in_disk:
            user.avatar_image = name_in_disk
        else:
            raise HTTPException(
                status_code=500,
                detail="Issue with Avatar upload",
            )

    # Update user in database
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return UserRead.model_validate(user)


async def update_user_password(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_id: int,
    form: UserUpdatePassword,
):
    # Get user
    user = await _get_user_by_field(db_session, "id", user_id)

    # RBAC check
    await rbac_check(request, current_user, "update", user.user_uuid, db_session)

    if not security_verify_password(form.old_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password"
        )

    # Update user
    user.password = security_hash_password(form.new_password)
    user.update_date = str(datetime.now())

    # Update user in database
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return UserRead.model_validate(user)


async def read_user_by_id(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_id: int,
):
    user = await _get_user_by_field(db_session, "id", user_id)
    return UserRead.model_validate(user)


async def read_user_by_uuid(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_uuid: str,
):
    user = await _get_user_by_field(db_session, "user_uuid", user_uuid)
    return UserRead.model_validate(user)


async def read_user_by_username(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    username: str,
):
    user = await _get_user_by_field(db_session, "username", username)
    return UserRead.model_validate(user)


async def get_user_session(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
) -> UserSession:
    # Get user
    user = await _get_user_by_field(db_session, "user_uuid", current_user.user_uuid)
    user_read = UserRead.model_validate(user)

    # Get roles and orgs
    statement = (
        select(UserOrganization)
        .where(UserOrganization.user_id == user.id)
        .join(Organization)
    )
    user_organizations = db_session.exec(statement).all()

    roles = []

    for user_organization in user_organizations:
        role_statement = select(Role).where(Role.id == user_organization.role_id)
        role = db_session.exec(role_statement).first()

        org_statement = select(Organization).where(
            Organization.id == user_organization.org_id
        )
        org = db_session.exec(org_statement).first()

        if role and org:
            roles.append(
                UserRoleWithOrg(
                    role=RoleRead.model_validate(role),
                    org=OrganizationRead.model_validate(org),
                )
            )

    return UserSession(
        user=user_read,
        roles=roles,
    )


async def authorize_user_action(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    resource_uuid: str,
    action: Literal["create", "read", "update", "delete"],
) -> bool:
    # Get user
    user = await _get_user_by_field(db_session, "user_uuid", current_user.user_uuid)

    # RBAC check
    authorized = await authorization_verify_based_on_roles_and_authorship(
        request, current_user.id, action, resource_uuid, db_session
    )

    if authorized:
        return True
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not authorized to perform this action",
    )


async def delete_user_by_id(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_id: int,
) -> str:
    # Get user
    user = await _get_user_by_field(db_session, "id", user_id)

    # RBAC check
    await rbac_check(request, current_user, "delete", user.user_uuid, db_session)

    # Delete user
    db_session.delete(user)
    db_session.commit()

    return "User deleted"


# Utils & Security functions


async def security_get_user(request: Request, db_session: Session, email: str) -> User:
    """Get user by email for security purposes."""
    try:
        return await _get_user_by_field(db_session, "email", email)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with Email does not exist",
        )


# Helper functions for user operations


async def _validate_organization_exists(db_session: Session, org_id: int) -> None:
    """Validate that organization exists."""
    statement = select(Organization).where(Organization.id == org_id)
    if not db_session.exec(statement).first():
        raise HTTPException(
            status_code=400,
            detail="Organization does not exist",
        )


async def _validate_unique_username(
    db_session: Session, username: str, exclude_user_id: int | None = None
) -> None:
    """Validate that username is unique."""
    statement = select(User).where(User.username == username)
    if exclude_user_id:
        statement = statement.where(User.id != exclude_user_id)

    if db_session.exec(statement).first():
        raise HTTPException(
            status_code=400,
            detail="Username already exists",
        )


async def _validate_unique_email(
    db_session: Session, email: str, exclude_user_id: int | None = None
) -> None:
    """Validate that email is unique."""
    statement = select(User).where(User.email == email)
    if exclude_user_id:
        statement = statement.where(User.id != exclude_user_id)

    if db_session.exec(statement).first():
        raise HTTPException(
            status_code=400,
            detail="Email already exists",
        )


async def _create_and_validate_user(
    db_session: Session, user_object: UserCreate
) -> User:
    """Create user with validation and proper initialization."""
    # Validate unique constraints
    await _validate_unique_username(db_session, user_object.username)
    await _validate_unique_email(db_session, user_object.email)

    # Create user with completed fields
    user = User.model_validate(user_object)
    user.user_uuid = f"user_{ULID()}"
    user.password = security_hash_password(user_object.password)
    user.email_verified = False
    user.creation_date = str(datetime.now())
    user.update_date = str(datetime.now())

    # Add user to database
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return user


async def _link_user_to_organization(
    db_session: Session, user_id: int | None, org_id: int
) -> None:
    """Link user to organization with default role."""
    user_organization = UserOrganization(
        user_id=user_id if user_id else 0,
        org_id=org_id,
        role_id=3,  # Default role ID
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(user_organization)
    db_session.commit()
    db_session.refresh(user_organization)


async def _get_user_by_field(db_session: Session, field: str, value: str | int) -> User:
    """Generic function to get user by any field."""
    if field == "id":
        statement = select(User).where(User.id == value)
    elif field == "user_uuid":
        statement = select(User).where(User.user_uuid == value)
    elif field == "username":
        statement = select(User).where(User.username == value)
    elif field == "email":
        statement = select(User).where(User.email == value)
    else:
        raise ValueError(f"Invalid field: {field}")

    user = db_session.exec(statement).first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail="User does not exist",
        )

    return user


## 🔒 RBAC Utils ##


async def rbac_check(
    request: Request,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    user_uuid: str,
    db_session: Session,
) -> bool | None:
    if action in {"create", "read"}:
        if current_user.id == 0:  # if user is anonymous
            return True
        await authorization_verify_based_on_roles_and_authorship(
            request, current_user.id, "create", "user_x", db_session
        )

    else:
        await authorization_verify_if_user_is_anon(current_user.id)

        # if user is the same as the one being read
        if current_user.user_uuid == user_uuid:
            return True

        await authorization_verify_based_on_roles_and_authorship(
            request, current_user.id, action, user_uuid, db_session
        )
    return None


## 🔒 RBAC Utils ##


async def create_user_with_org_validation(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_object: UserCreate,
    org_id: int,
) -> UserRead:
    """
    Create user with organization join mechanism validation.
    Checks if organization requires invites before creating user.
    """
    # Check organization join mechanism
    join_mechanism = await get_org_join_mechanism(
        request, org_id, current_user, db_session
    )

    if join_mechanism == "inviteOnly":
        raise HTTPException(
            status_code=403,
            detail="You need an invite to join this organization",
        )

    return await create_user(request, db_session, current_user, user_object, org_id)


async def create_user_with_invite_validation(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_object: UserCreate,
    invite_code: str,
    org_id: int,
) -> UserRead:
    """
    Create user with invite code and organization validation.
    Ensures organization requires invites before processing invite code.
    """
    # Check organization join mechanism
    join_mechanism = await get_org_join_mechanism(
        request, org_id, current_user, db_session
    )

    if join_mechanism == "inviteOnly":
        return await create_user_with_invite(
            request, db_session, current_user, user_object, org_id, invite_code
        )

    raise HTTPException(
        status_code=403,
        detail="This organization does not require an invite code",
    )
