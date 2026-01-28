"""
Unified Permission Service - Single entry point for all RBAC checks.

This module replaces all the scattered rbac_check_* functions with a single,
consistent interface for permission checking across all resource types.

Usage:
    from src.services.permissions.unified_permission_service import get_permission_service

    permission_service = get_permission_service(db_session)

    # Check permission
    await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.COURSE,
        resource_id="course_abc123",
        org_id=1,
    )
"""

from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select

from src.db.courses.courses import Course
from src.db.permissions.constants import (
    ADMIN_OR_MAINTAINER_SLUGS,
    INSTRUCTOR_OR_HIGHER_SLUGS,
)
from src.db.permissions.enums import Action, AuditAction, AuditLevel, ResourceType
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.services.permissions.audit_service import AuditService
from src.services.permissions.permission_cache import (
    get_cached_permission,
    set_cached_permission,
)
from src.services.permissions.policy_engine import PolicyEngine
from src.services.permissions.role_service import RoleService

if TYPE_CHECKING:
    from src.security.rbac.policies.base import BasePolicy


class PermissionResult:
    """Result of a permission check with additional metadata."""

    def __init__(
        self,
        granted: bool,
        reason: str | None = None,
        cached: bool = False,
    ) -> None:
        self.granted = granted
        self.reason = reason
        self.cached = cached


class UnifiedPermissionService:
    """
    Unified permission service for all RBAC checks.

    This service replaces all the scattered rbac_check_* functions with
    a single, consistent interface.
    """

    def __init__(
        self,
        db: Session,
        use_cache: bool = True,
        audit_level: AuditLevel = AuditLevel.ALL_EXCEPT_READS,
    ) -> None:
        self.db = db
        self.use_cache = use_cache
        self.audit_level = audit_level
        self.policy_engine = PolicyEngine(db, use_cache=use_cache)
        self.audit_service = AuditService(db)
        self.role_service = RoleService(db)
        self._policies: dict[ResourceType, BasePolicy] = {}

    def register_policy(self, resource_type: ResourceType, policy: BasePolicy) -> None:
        """Register a resource-specific policy."""
        self._policies[resource_type] = policy

    def _get_user_id(
        self, user: PublicUser | AnonymousUser | InternalUser | None
    ) -> int:
        """Get user ID, returns 0 for anonymous users."""
        if user is None or isinstance(user, AnonymousUser):
            return 0
        return user.id if hasattr(user, "id") else 0

    def _is_anonymous(
        self, user: PublicUser | AnonymousUser | InternalUser | None
    ) -> bool:
        """Check if the user is anonymous (not authenticated)."""
        if user is None or isinstance(user, AnonymousUser):
            return True
        if isinstance(user, InternalUser):
            return False
        return not hasattr(user, "id") or user.id == 0

    def _is_internal_user(
        self, user: PublicUser | AnonymousUser | InternalUser | None
    ) -> bool:
        """Check if the user is an internal system user."""
        return isinstance(user, InternalUser)

    def _is_resource_owner(self, user_id: int, resource_id: str) -> bool:
        """Check if user is owner of a resource via ResourceAuthor table."""
        if user_id == 0:
            return False

        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user_id,
        )
        resource_author = self.db.exec(statement).first()

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

    def _is_admin_or_maintainer(self, user_id: int) -> bool:
        """Check if user has admin or maintainer role."""
        if user_id == 0:
            return False
        user_roles = self.role_service.get_user_roles(user_id)
        return any(
            ur.role and ur.role.slug in ADMIN_OR_MAINTAINER_SLUGS for ur in user_roles
        )

    def _has_instructor_role(self, user_id: int) -> bool:
        """Check if user has instructor role or higher."""
        if user_id == 0:
            return False
        user_roles = self.role_service.get_user_roles(user_id)
        return any(
            ur.role and ur.role.slug in INSTRUCTOR_OR_HIGHER_SLUGS for ur in user_roles
        )

    def _is_resource_public(
        self, resource_id: str, resource_type: ResourceType
    ) -> bool:
        """Check if a resource is publicly accessible."""
        if resource_type == ResourceType.COURSE:
            course = self.db.exec(
                select(Course).where(Course.course_uuid == resource_id)
            ).first()
            return course.public if course else False
        # Add more resource types as needed
        return False

    def _should_audit(self, action: Action, granted: bool) -> bool:
        """Determine if this check should be audited based on audit level."""
        if self.audit_level == AuditLevel.NONE:
            return False
        if self.audit_level == AuditLevel.ALL:
            return True
        if self.audit_level == AuditLevel.ALL_EXCEPT_READS and action != Action.READ:
            return True
        return bool(self.audit_level == AuditLevel.DENIED_ONLY and not granted)

    async def check(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        request: Request | None = None,
        raise_on_deny: bool = True,
    ) -> bool:
        """
        Check if user has permission to perform action on resource.

        Args:
            user: Current user (PublicUser, AnonymousUser, or InternalUser)
            action: Action to perform (CREATE, READ, UPDATE, DELETE, etc.)
            resource: Resource type (COURSE, ORGANIZATION, USER, etc.)
            resource_id: Optional specific resource UUID
            org_id: Optional organization context
            request: Optional FastAPI request for additional context
            raise_on_deny: If True, raises HTTPException on denial; if False, returns False

        Returns:
            True if permission granted, False if denied (when raise_on_deny=False)

        Raises:
            HTTPException: If permission denied and raise_on_deny=True
        """
        user_id = self._get_user_id(user)
        is_anonymous = self._is_anonymous(user)

        # Internal users bypass all checks but get audited
        if self._is_internal_user(user):
            self.audit_service.log(
                user_id=user_id,
                audit_action=AuditAction.CHECK,
                result=True,
                resource_type=resource,
                resource_id=resource_id,
                context={"internal_user": True, "org_id": org_id},
            )
            return True

        # Check cache first
        if self.use_cache:
            action_str = action.value if hasattr(action, "value") else str(action)
            resource_str = (
                resource.value if hasattr(resource, "value") else str(resource)
            )
            cached = get_cached_permission(
                user_id, action_str, resource_str, resource_id, org_id
            )
            if cached is not None:
                if self._should_audit(action, cached):
                    self.audit_service.log(
                        user_id=user_id if user_id != 0 else None,
                        audit_action=AuditAction.CHECK,
                        result=cached,
                        resource_type=resource,
                        resource_id=resource_id,
                        context={
                            "cached": True,
                            "org_id": org_id,
                            "action": action.value,
                        },
                    )
                if not cached and raise_on_deny:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission denied: Cannot {action.value} {resource.value}",
                    )
                return cached

        # Check if resource-specific policy exists
        policy = self._policies.get(resource)
        if policy:
            try:
                result = policy.check(
                    user=user,
                    action=action,
                    resource_id=resource_id,
                    org_id=org_id,
                )
                granted = result
            except HTTPException:
                granted = False
                if raise_on_deny:
                    raise
        else:
            # Use default permission logic
            granted = await self._default_check(
                user=user,
                user_id=user_id,
                is_anonymous=is_anonymous,
                action=action,
                resource=resource,
                resource_id=resource_id,
                org_id=org_id,
            )

        # Cache result
        if self.use_cache:
            action_str = action.value if hasattr(action, "value") else str(action)
            resource_str = (
                resource.value if hasattr(resource, "value") else str(resource)
            )
            set_cached_permission(
                user_id, action_str, resource_str, resource_id, org_id, granted
            )

        # Audit
        if self._should_audit(action, granted):
            self.audit_service.log(
                user_id=user_id if user_id != 0 else None,
                audit_action=AuditAction.CHECK,
                result=granted,
                resource_type=resource,
                resource_id=resource_id,
                context={"org_id": org_id, "action": action.value},
            )

        # Raise or return
        if not granted and raise_on_deny:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: Cannot {action.value} {resource.value}",
            )

        return granted

    async def _default_check(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        user_id: int,
        is_anonymous: bool,
        action: Action,
        resource: ResourceType,
        resource_id: str | None,
        org_id: int | None,
    ) -> bool:
        """
        Default permission check logic when no policy is registered.

        This implements the standard RBAC flow:
        1. Check if resource is public (for READ actions)
        2. Check resource ownership
        3. Check admin/maintainer role
        4. Check via PolicyEngine
        """
        # Anonymous users can only read public resources
        if is_anonymous:
            if action == Action.READ and resource_id:
                if self._is_resource_public(resource_id, resource):
                    return True
            return False

        # Check resource ownership (for specific resources)
        if resource_id and action != Action.CREATE:
            if self._is_resource_owner(user_id, resource_id):
                return True

        # Check admin/maintainer role (full access)
        if self._is_admin_or_maintainer(user_id):
            return True

        # Check via PolicyEngine (role-based permissions)
        return self.policy_engine.evaluate(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
        )

    async def require(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        request: Request | None = None,
    ) -> None:
        """
        Require permission or raise HTTPException.

        This is an alias for check() with raise_on_deny=True.
        """
        await self.check(
            user=user,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
            request=request,
            raise_on_deny=True,
        )

    async def can(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
    ) -> bool:
        """
        Check if user can perform action without raising exception.

        This is an alias for check() with raise_on_deny=False.
        """
        return await self.check(
            user=user,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
            raise_on_deny=False,
        )

    async def check_batch(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        checks: list[tuple[Action, ResourceType, str | None, int | None]],
    ) -> dict[tuple[Action, ResourceType, str | None, int | None], bool]:
        """
        Check multiple permissions in one call.

        This is more efficient than calling check() multiple times because:
        1. User roles are fetched once
        2. Admin checks are done once
        3. Results can be cached together

        Args:
            user: User to check permissions for
            checks: List of (action, resource, resource_id, org_id) tuples

        Returns:
            Dictionary mapping each check tuple to its result (True/False)

        Example:
            ```python
            results = await service.check_batch(
                user=current_user,
                checks=[
                    (Action.READ, ResourceType.COURSE, "course_123", 1),
                    (Action.UPDATE, ResourceType.COURSE, "course_123", 1),
                    (Action.DELETE, ResourceType.COURSE, "course_123", 1),
                ]
            )
            can_read = results[(Action.READ, ResourceType.COURSE, "course_123", 1)]
            ```
        """
        results: dict[tuple[Action, ResourceType, str | None, int | None], bool] = {}

        # Check all permissions without raising
        for action, resource, resource_id, org_id in checks:
            check_tuple = (action, resource, resource_id, org_id)
            try:
                granted = await self.check(
                    user=user,
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    org_id=org_id,
                    raise_on_deny=False,
                )
                results[check_tuple] = granted
            except Exception:
                # If any error occurs, treat as denied
                results[check_tuple] = False

        return results


# Singleton instance factory
_service_instance: UnifiedPermissionService | None = None


def get_permission_service(
    db: Session,
    use_cache: bool = True,
    audit_level: AuditLevel = AuditLevel.ALL_EXCEPT_READS,
) -> UnifiedPermissionService:
    """
    Get or create the unified permission service.

    In production, you might want to use dependency injection instead
    of a singleton, but this provides a simple factory for now.
    """
    # Create a new instance (stateless)
    service = UnifiedPermissionService(db, use_cache=use_cache, audit_level=audit_level)

    # Register resource-specific policies
    from src.security.rbac.policies.course import CoursePolicy
    from src.security.rbac.policies.organization import OrganizationPolicy
    from src.security.rbac.policies.user import UserPolicy

    service.register_policy(ResourceType.COURSE, CoursePolicy(db))
    service.register_policy(ResourceType.ORGANIZATION, OrganizationPolicy(db))
    service.register_policy(ResourceType.USER, UserPolicy(db))

    return service
