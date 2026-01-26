import contextlib
import logging
from datetime import datetime
from types import SimpleNamespace
from typing import Literal

from fastapi import HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from sqlmodel import Session, select
from ulid import ULID

from src.db.organizations import Organization, OrganizationRead
from src.db.roles import (
    Role,
    RoleRead,
)
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
from src.security.rbac.service_utils import rbac_check_user as rbac_check
from src.security.rbac.checker import PermissionChecker
from src.security.security import security_hash_password, security_verify_password
from src.services.cache import redis_client
from src.services.orgs.invites import get_invite_code
from src.services.orgs.orgs import get_org_join_mechanism
from src.services.users.avatars import upload_avatar
from src.services.users.emails import send_account_creation_email
from src.services.users.usergroups import add_users_to_usergroup

# Rebuild user models to resolve forward references after all imports
rebuild_user_models()


logger = logging.getLogger(__name__)

# Cache TTL for user lookups (seconds)
USER_CACHE_TTL = 300  # 5 minutes


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
            int(
                inviteCode.get("usergroup_id")
            ),  # Convert to int since usergroup_id is expected to be int
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
    # Get user (bypass cache for mutations to ensure ORM-attached instance)
    user = await _get_user_by_field(db_session, "id", user_id, use_cache=False)

    # Validate unique constraints if fields are being updated
    user_data = user_object.model_dump(exclude_unset=True)

    # If no fields are being updated, skip RBAC and DB work (no-op update) but still invalidate cache
    if not user_data:
        try:
            keys = [f"user:id:{user.id}"]
            if getattr(user, "username", None):
                keys.append(f"user:username:{user.username.lower()}")
            redis_client.delete_keys(*keys)
        except Exception:
            pass
        # Try to return a validated `UserRead`; if validation fails (e.g., test stubs),
        # return the raw user object to keep behavior simple and test-friendly.
        try:
            return UserRead.model_validate(user)
        except Exception:
            return user

    # RBAC check (only for real updates)
    await rbac_check(
        request,
        user_uuid=user.user_uuid,
        current_user=current_user,
        action="update",
        db_session=db_session,
    )

    if user_object.username:
        await _validate_unique_username(
            db_session, user_object.username, exclude_user_id=current_user.id
        )

    if user_object.email:
        await _validate_unique_email(
            db_session, user_object.email, exclude_user_id=current_user.id
        )

    # Update user
    for key, value in user_data.items():
        setattr(user, key, value)

    user.update_date = str(datetime.now())

    # Update user in database
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Invalidate Redis cache for this user (best-effort)
    try:
        keys = [f"user:id:{user.id}"]
        if getattr(user, "username", None):
            keys.append(f"user:username:{user.username.lower()}")
        redis_client.delete_keys(*keys)
    except Exception:
        pass

    return UserRead.model_validate(user)


async def update_user_avatar(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    avatar_file: UploadFile | None = None,
):
    # Get user (bypass cache for mutations to ensure ORM-attached instance)
    user = await _get_user_by_field(db_session, "id", current_user.id, use_cache=False)

    # RBAC check
    await rbac_check(request, current_user, "update", user.user_uuid, db_session)

    # Upload avatar with security validation
    if avatar_file and avatar_file.filename:
        try:
            name_in_disk = await upload_avatar(avatar_file, user.user_uuid)
            user.avatar_image = name_in_disk
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Avatar upload failed: {e!s}",
            )

    # Update user in database
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Invalidate Redis cache for this user (best-effort)
    try:
        keys = [f"user:id:{user.id}"]
        if getattr(user, "username", None):
            keys.append(f"user:username:{user.username.lower()}")
        redis_client.delete_keys(*keys)
    except Exception:
        pass

    return UserRead.model_validate(user)


async def update_user_password(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    user_id: int,
    form: UserUpdatePassword,
):
    # Get user (bypass cache for mutations to ensure ORM-attached instance)
    user = await _get_user_by_field(db_session, "id", user_id, use_cache=False)

    # RBAC check
    await rbac_check(request, current_user, "update", user.user_uuid, db_session)

    if not security_verify_password(form.old_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password"
        )

    # Update user
    user.password = security_hash_password(form.new_password)
    user.update_date = str(datetime.now())

    # Add password_changed_at field for session invalidation tracking
    if user.profile is None:
        user.profile = {}
    user.profile["password_changed_at"] = datetime.now().isoformat()

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
                    role=_safe_role_read(role),
                    org=_safe_organization_read(org),
                )
            )

    # Get user's effective permissions from the new RBAC system
    permissions: dict[str, bool] = {}
    try:
        checker = PermissionChecker(db_session)
        permissions = checker.get_user_permissions(current_user)
    except Exception:
        # Fallback: if new RBAC system not yet migrated, return empty
        pass

    return UserSession(
        user=user_read,
        roles=roles,
        permissions=permissions,
    )


async def authorize_user_action(
    request: Request,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    resource_uuid: str,
    action: Literal["create", "read", "update", "delete"],
) -> bool:
    # Get user
    await _get_user_by_field(db_session, "user_uuid", current_user.user_uuid)

    # RBAC check using new service_utils
    from src.security.rbac.service_utils import check_user_permission

    authorized = check_user_permission(
        db_session, current_user.id, action, resource_uuid
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
    # Get user (bypass cache for mutations to ensure ORM-attached instance)
    user = await _get_user_by_field(db_session, "id", user_id, use_cache=False)

    # RBAC check
    await rbac_check(
        request,
        user_uuid=user.user_uuid,
        current_user=current_user,
        action="delete",
        db_session=db_session,
    )

    # Delete user
    db_session.delete(user)
    db_session.commit()

    # Invalidate Redis cache for this user (best-effort)
    try:
        keys = [f"user:id:{user.id}"]
        if getattr(user, "username", None):
            keys.append(f"user:username:{user.username.lower()}")
        redis_client.delete_keys(*keys)
    except Exception:
        pass

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
            detail="Имя пользователя уже существует",
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


def _safe_role_read(role: Role) -> RoleRead:
    """Convert Role to RoleRead."""
    try:
        return RoleRead.model_validate(role)
    except ValidationError as exc:  # pragma: no cover - defensive path
        logger.warning(
            "Role validation failed for role_id=%s. Using fallback. Error: %s",
            getattr(role, "id", None),
            exc,
        )
        return RoleRead.model_construct(
            name=role.name,
            description=role.description,
            org_id=role.org_id,
            role_type=role.role_type,
            role_uuid=role.role_uuid,
            creation_date=role.creation_date,
            update_date=role.update_date,
            id=role.id,
        )


def _safe_organization_read(org: Organization) -> OrganizationRead:
    """Convert Organization to OrganizationRead, tolerating legacy fields."""
    try:
        return OrganizationRead.model_validate(org)
    except ValidationError as exc:  # pragma: no cover - defensive path
        logger.warning(
            "Organization validation failed for org_id=%s. Using best-effort fallback. Error: %s",
            getattr(org, "id", None),
            exc,
        )

        return OrganizationRead.model_construct(**org.model_dump())


async def _link_user_to_organization(
    db_session: Session, user_id: int | None, org_id: int
) -> None:
    """Link user to organization with default role."""
    user_organization = UserOrganization(
        user_id=user_id if user_id else 0,
        org_id=org_id,
        role_id=4,  # Default role ID
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(user_organization)
    db_session.commit()
    db_session.refresh(user_organization)


async def _get_user_by_field(
    db_session: Session, field: str, value: str | int, use_cache: bool = True
) -> User:
    """Generic function to get user by any field.

    Optimizations:
    - Use Redis cache when configured to avoid repeated DB hits for frequent reads.
    - Cache keys: `user:id:{id}` and `user:username:{username_lower}`
    - Invalidation is done on updates (see `update_user` and `update_user_avatar`).

    IMPORTANT: callers that intend to mutate or delete the returned user should pass
    `use_cache=False` to ensure an ORM-attached instance is returned from the DB session
    rather than a cached (detached) Pydantic/namespace object. Returning a detached
    object and then calling `db_session.add()`/`db_session.delete()` may trigger an
    INSERT/DELETE on a non-attached object leading to integrity errors.
    """

    # Try cache lookup first (best-effort, helper handles missing Redis)
    def _try_cache_get(key: str) -> User | None:
        try:
            cached = redis_client.get_json(key)
            if not cached:
                return None
            try:
                return User.model_validate(cached)
            except Exception:
                # Cached payload may be partial (e.g., only id/username); return a simple object
                if isinstance(cached, dict):
                    return SimpleNamespace(**cached)
                return None
        except Exception:
            return None

    def _try_cache_set(user_obj: User) -> None:
        try:
            data = user_obj.model_dump()
            id_key = f"user:id:{getattr(user_obj, 'id', '')}"
            redis_client.set_json(id_key, data, USER_CACHE_TTL)
            if user_obj.username:
                redis_client.set_json(
                    f"user:username:{user_obj.username.lower()}", data, USER_CACHE_TTL
                )
        except Exception:
            pass

    # Try cache lookup first (only when allowed)
    if use_cache and field == "id" and isinstance(value, int):
        key = f"user:id:{value}"
        cached = _try_cache_get(key)
        if cached:
            return cached
    if use_cache and field == "username" and isinstance(value, str):
        key = f"user:username:{value.lower()}"
        cached = _try_cache_get(key)
        if cached:
            return cached

    # Build DB query
    if field == "id":
        statement = select(User).where(User.id == value)
    elif field == "user_uuid":
        statement = select(User).where(User.user_uuid == value)
    elif field == "username":
        statement = select(User).where(User.username == value)
    elif field == "email":
        statement = select(User).where(User.email == value)
    else:
        msg = f"Invalid field: {field}"
        raise ValueError(msg)

    user = db_session.exec(statement).first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail="User does not exist",
        )

    # Populate cache asynchronously (best-effort)
    with contextlib.suppress(Exception):
        _try_cache_set(user)

    return user


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
