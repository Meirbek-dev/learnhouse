"""
RBAC Dependencies - FastAPI Dependency Injection

Provides dependency injection for RBAC services.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from config.config import get_platform_config
from src.core.events.database import get_db_session
from src.services.rbac.audit import AuditService
from src.services.rbac.cache import CacheService
from src.services.rbac.service import RBACService


def get_rbac_service(
    db: Session = Depends(get_db_session),
) -> RBACService:
    """
    Get RBAC service instance for dependency injection.

    Usage:
        @router.post("/example")
        async def example(rbac: RBACService = Depends(get_rbac_service)):
            result = rbac.check(user_id=123, action="update", resource="course")
    """
    config = get_platform_config()
    rbac_config = config.rbac_config

    # Initialize cache service if enabled
    cache = None
    if rbac_config.cache_enabled:
        try:
            cache = CacheService()
        except Exception:
            # If Redis is down, continue without cache
            pass

    # Initialize audit service if enabled
    audit = AuditService(db) if rbac_config.audit_logging_enabled else None

    # Return RBAC service
    return RBACService(
        db=db,
        cache=cache,
        audit=audit,
        cache_ttl=rbac_config.cache_ttl_seconds,
        audit_enabled=rbac_config.audit_logging_enabled,
    )


# Type alias for cleaner dependency injection
RBACServiceDep = Annotated[RBACService, Depends(get_rbac_service)]


def require_permission(
    action: str,
    resource: str,
    org_id_param: str = "org_id",
):
    """
    Dependency that requires a specific permission.

    Usage:
        @router.post("/{org_id}/courses")
        async def create_course(
            org_id: int,
            _: None = Depends(require_permission("create", "course")),
        ):
            # User has permission to create courses
    """

    async def permission_checker(
        request: Request,
        rbac: RBACService = Depends(get_rbac_service),
    ) -> None:
        from src.security.auth import get_current_user

        # Get current user
        user = await get_current_user(request)
        if not user or not hasattr(user, "id"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        # Get org_id from path params if available
        org_id = request.path_params.get(org_id_param)

        # Check permission
        result = rbac.check(
            user_id=user.id,
            action=action,
            resource=resource,
            org_id=int(org_id) if org_id else None,
        )

        if not result.granted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {result.reason}",
            )

    return permission_checker
