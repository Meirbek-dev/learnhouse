"""
Permission helper utilities used by services.

"""

from fastapi import HTTPException, status
from sqlmodel import Session, select

from src.db.permissions.constants import (
    ADMIN_OR_MAINTAINER_SLUGS,
    INSTRUCTOR_OR_HIGHER_SLUGS,
)
from src.db.permissions.enums import Action
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.services.permissions.role_service import RoleService


def verify_not_anonymous(user_id: int) -> None:
    """Raise HTTPException 401 if the user is anonymous (id == 0)."""
    if user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to perform this action",
        )


def is_resource_author(db_session: Session, user_id: int, resource_uuid: str) -> bool:
    """Return True if the user is an active creator/maintainer/contributor for the resource."""
    if user_id == 0:
        return False

    statement = select(ResourceAuthor).where(
        ResourceAuthor.resource_uuid == resource_uuid,
        ResourceAuthor.user_id == user_id,
    )
    resource_author = db_session.exec(statement).first()

    if not resource_author:
        return False

    return (
        resource_author.authorship
        in (
            ResourceAuthorshipEnum.CREATOR,
            ResourceAuthorshipEnum.MAINTAINER,
            ResourceAuthorshipEnum.CONTRIBUTOR,
        )
        and resource_author.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE
    )


def is_admin_or_maintainer(db_session: Session, user_id: int) -> bool:
    """Check whether a user has an admin or maintainer role (by slug)."""
    if user_id == 0:
        return False
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    return any(
        ur.role and ur.role.slug in ADMIN_OR_MAINTAINER_SLUGS for ur in user_roles
    )


def has_instructor_role(db_session: Session, user_id: int) -> bool:
    """Check whether a user has an instructor role or higher (by slug)."""
    if user_id == 0:
        return False
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    return any(
        ur.role and ur.role.slug in INSTRUCTOR_OR_HIGHER_SLUGS for ur in user_roles
    )


def is_anonymous(user: PublicUser | AnonymousUser | InternalUser | None) -> bool:
    if user is None:
        return True
    if isinstance(user, AnonymousUser):
        return True
    if isinstance(user, InternalUser):
        return False
    return not hasattr(user, "id") or user.id == 0


def get_user_id(user: PublicUser | AnonymousUser | InternalUser | None) -> int:
    if user is None or isinstance(user, AnonymousUser):
        return 0
    return user.id if hasattr(user, "id") else 0


def map_action(action: str) -> Action:
    action_map = {
        "create": Action.CREATE,
        "read": Action.READ,
        "update": Action.UPDATE,
        "delete": Action.DELETE,
    }
    return action_map.get(action, Action.READ)
