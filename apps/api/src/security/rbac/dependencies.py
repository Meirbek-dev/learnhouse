"""
FastAPI dependencies for the RBAC system.
"""

from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.services.rbac.dependencies import get_rbac_service
from src.services.rbac.service import RBACService


async def _lazy_get_current_user(
    request: Request, Authorize=Depends(), db_session=Depends(get_db_session)
):
    """Lazy wrapper to import get_current_user at runtime to avoid circular imports."""
    from src.security.auth import get_current_user as _get_current_user

    return await _get_current_user(request, Authorize, db_session)


# Type aliases for dependency injection
RBACServiceDep = Annotated[RBACService, Depends(get_rbac_service)]
CurrentUserDep = Annotated[PublicUser | AnonymousUser, Depends(_lazy_get_current_user)]

# Backwards-compatible aliases
get_permission_service = get_rbac_service
PermissionServiceDep = RBACServiceDep
