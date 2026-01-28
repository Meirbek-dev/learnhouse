"""
Central permission checker with caching and audit logging.

DEPRECATED: Use UnifiedPermissionService from src.services.permissions instead.

This module is maintained for backward compatibility only.
"""

from fastapi import HTTPException, status
from sqlmodel import Session

from src.db.permissions.enums import Action, AuditLevel, ResourceType
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.context import PermissionContext
from src.security.rbac.exceptions import (
    AuthenticationRequiredError,
    PermissionDeniedError,
)
from src.security.rbac.service_utils import get_user_id, is_anonymous
from src.services.permissions import get_permission_service
from src.services.permissions.audit_service import AuditService

# Default audit level - can be overridden per-checker or globally
DEFAULT_AUDIT_LEVEL = AuditLevel.ALL_EXCEPT_READS


class PermissionChecker:
    """
    Central permission checking with caching and audit.

    DEPRECATED: Use UnifiedPermissionService instead.

    This class wraps UnifiedPermissionService for backward compatibility.
    """

    def __init__(
        self, db: Session, audit_level: AuditLevel = DEFAULT_AUDIT_LEVEL
    ) -> None:
        """
        Initialize the permission checker.

        Args:
            db: Database session
            audit_level: Level of audit logging (default: ALL_EXCEPT_READS)
        """
        self.db = db
        self.audit_level = audit_level
        self.unified_service = get_permission_service(db, audit_level=audit_level)
        self.audit_service = AuditService(db)

    async def check(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        context: PermissionContext | None = None,
    ) -> bool:
        """
        Check if user has permission to perform action on resource.

        DEPRECATED: Use UnifiedPermissionService.check() instead.

        Args:
            user: Current user (PublicUser or AnonymousUser)
            action: Action to perform
            resource: Resource type
            resource_id: Optional specific resource UUID
            org_id: Optional organization context
            context: Optional permission context for additional info

        Returns:
            True if permission is granted, False otherwise
        """
        # Delegate to unified service
        return await self.unified_service.check(
            user=user,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
            raise_on_deny=False,
        )

    async def require(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        context: PermissionContext | None = None,
        error_message: str | None = None,
    ) -> None:
        """
        Check permission and raise HTTPException if denied.

        DEPRECATED: Use UnifiedPermissionService.require() instead.

        Args:
            user: Current user
            action: Action to perform
            resource: Resource type
            resource_id: Optional specific resource UUID
            org_id: Optional organization context
            context: Optional permission context
            error_message: Optional custom error message

        Raises:
            HTTPException: If permission is denied
        """
        # Delegate to unified service
        await self.unified_service.require(
            user=user,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
        )

    async def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
    ) -> bool:
        """
        Alias for check() - Check if user can perform action.

        DEPRECATED: Use UnifiedPermissionService.can() instead.

        Args:
            user: Current user
            action: Action to perform
            resource: Resource type
            resource_id: Optional specific resource UUID
            org_id: Optional organization context

        Returns:
            True if permission is granted
        """
        return await self.check(user, action, resource, resource_id, org_id)

    def require_authenticated(self, user: PublicUser | AnonymousUser) -> PublicUser:
        """
        Require that the user is authenticated.

        Args:
            user: Current user

        Returns:
            The user as PublicUser

        Raises:
            AuthenticationRequiredError: If user is anonymous
        """
        if isinstance(user, AnonymousUser) or (hasattr(user, "id") and user.id == 0):
            raise AuthenticationRequiredError
        return user  # type: ignore[return-value]

    async def require_org_membership(
        self,
        user: PublicUser | AnonymousUser,
        org_id: int,
    ) -> None:
        """
        Require that the user is a member of the organization.

        Args:
            user: Current user
            org_id: Organization ID

        Raises:
            PermissionDeniedError: If user is not a member
        """
        # First require authentication
        self.require_authenticated(user)

        # Check if user has any role in the organization
        if not await self.check(user, Action.READ, ResourceType.ORGANIZATION, org_id=org_id):
            msg = "You are not a member of this organization"
            raise PermissionDeniedError(msg)

    def get_user_permissions(
        self,
        user: PublicUser | AnonymousUser,
        org_id: int | None = None,
    ) -> dict[str, bool]:
        """
        Get all effective permissions for a user.

        DEPRECATED: This returns empty dict now. Use UnifiedPermissionService instead.

        Args:
            user: Current user
            org_id: Optional organization context

        Returns:
            Dictionary mapping permission names to boolean
        """
        # Return empty dict - this method is deprecated
        return {}
