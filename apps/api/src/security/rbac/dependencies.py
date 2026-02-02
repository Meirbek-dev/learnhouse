"""
FastAPI dependencies for the permission system.

RBAC v2: This is the only RBAC system.
"""

from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.services.rbac.service import RBACService
from src.services.rbac.dependencies import get_rbac_service, RBACServiceDep


async def _lazy_get_current_user(
    request: Request, Authorize=Depends(), db_session=Depends(get_db_session)
):
    """Lazy wrapper to import get_current_user at runtime to avoid circular imports."""
    from src.security.auth import get_current_user as _get_current_user

    return await _get_current_user(request, Authorize, db_session)


def get_permission_service(
    db_session: Annotated[Session, Depends(get_db_session)],
) -> RBACService:
    """
    Get an RBACService instance (backwards compatible alias).
    Prefer using get_rbac_service directly.
    """
    return get_rbac_service(db_session)


# Type aliases for dependency injection
PermissionServiceDep = Annotated[RBACService, Depends(get_permission_service)]
CurrentUserDep = Annotated[PublicUser | AnonymousUser, Depends(_lazy_get_current_user)]
