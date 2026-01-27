"""
Central permission checker with caching and audit logging.

This module provides the PermissionChecker class which is the main entry point
for all permission checks in the system.
"""

from fastapi import HTTPException, status
from sqlmodel import Session

from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.context import PermissionContext
from src.security.rbac.service_utils import get_user_id, is_anonymous
from src.services.permissions.audit_service import AuditService
from src.services.permissions.policy_engine import PolicyEngine


class PermissionChecker:
    """
    Central permission checking with caching and audit.

    This class provides the main interface for checking permissions:
    - check(): Returns True/False
    - require(): Raises HTTPException if denied
    - can(): Alias for check()
    """

    def __init__(self, db: Session) -> None:
        """
        Initialize the permission checker.

        Args:
            db: Database session
        """
        self.db = db
        self.policy_engine = PolicyEngine(db)
        self.audit_service = AuditService(db)

    def check(
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

        This method:
        1. Evaluates role-based permissions
        2. Checks resource-level permissions
        3. Evaluates ABAC conditions
        4. Logs the check to audit

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
        user_id = get_user_id(user)

        # Build context dict for ABAC
        abac_context = context.extra if context else None

        # Evaluate permission
        result = self.policy_engine.evaluate(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
            context=abac_context,
        )

        # Log to audit (only significant checks, not every read)
        if action != Action.READ or not result:
            self.audit_service.log_check(
                user_id=user_id if user_id != 0 else None,
                action=action,
                resource=resource,
                result=result,
                resource_id=resource_id,
                org_id=org_id,
                ip_address=context.ip_address if context else None,
                user_agent=context.user_agent if context else None,
            )

        return result

    def require(
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

        Args:
            user: Current user
            action: Action to perform
            resource: Resource type
            resource_id: Optional specific resource UUID
            org_id: Optional organization context
            context: Optional permission context
            error_message: Optional custom error message

        Raises:
            HTTPException: 401 if user is anonymous and auth required
            HTTPException: 403 if permission is denied
        """
        # Check if authentication is required
        if is_anonymous(user) and action != Action.READ:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check permission
        if not self.check(user, action, resource, resource_id, org_id, context):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_message
                or f"Permission denied: {action.value} on {resource.value}",
            )

    def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
    ) -> bool:
        """
        Alias for check() - Check if user can perform action.

        Args:
            user: Current user
            action: Action to perform
            resource: Resource type
            resource_id: Optional specific resource UUID
            org_id: Optional organization context

        Returns:
            True if permission is granted
        """
        return self.check(user, action, resource, resource_id, org_id)

    def require_authenticated(self, user: PublicUser | AnonymousUser) -> PublicUser:
        """
        Require that the user is authenticated.

        Args:
            user: Current user

        Returns:
            The user as PublicUser

        Raises:
            HTTPException: 401 if user is anonymous
        """
        if isinstance(user, AnonymousUser) or (hasattr(user, "id") and user.id == 0):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user  # type: ignore[return-value]

    def require_org_membership(
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
            HTTPException: 403 if user is not a member
        """
        # First require authentication
        self.require_authenticated(user)

        # Check if user has any role in the organization
        if not self.check(user, Action.READ, ResourceType.ORGANIZATION, org_id=org_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this organization",
            )

    def get_user_permissions(
        self,
        user: PublicUser | AnonymousUser,
        org_id: int | None = None,
    ) -> dict[str, bool]:
        """
        Get all effective permissions for a user.

        This is useful for the frontend to know what actions are allowed.

        Args:
            user: Current user
            org_id: Optional organization context

        Returns:
            Dictionary mapping permission names to boolean
        """
        user_id = get_user_id(user)

        if is_anonymous(user):
            # Anonymous users have very limited permissions
            return {
                "course:read:all": True,
                "collection:read:all": True,
            }

        return self.policy_engine.get_user_permissions(user_id, org_id)


# Utility functions for common permission checks


def check_course_permission(
    checker: PermissionChecker,
    user: PublicUser | AnonymousUser,
    action: Action,
    course_uuid: str | None = None,
    org_id: int | None = None,
) -> bool:
    """
    Check permission for course-related actions.

    Args:
        checker: Permission checker instance
        user: Current user
        action: Action to perform
        course_uuid: Optional course UUID
        org_id: Optional organization context

    Returns:
        True if permission is granted
    """
    return checker.check(user, action, ResourceType.COURSE, course_uuid, org_id)


def require_course_permission(
    checker: PermissionChecker,
    user: PublicUser | AnonymousUser,
    action: Action,
    course_uuid: str | None = None,
    org_id: int | None = None,
) -> None:
    """
    Require permission for course-related actions.

    Args:
        checker: Permission checker instance
        user: Current user
        action: Action to perform
        course_uuid: Optional course UUID
        org_id: Optional organization context

    Raises:
        HTTPException: If permission is denied
    """
    checker.require(user, action, ResourceType.COURSE, course_uuid, org_id)
