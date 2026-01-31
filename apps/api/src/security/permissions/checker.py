"""
Simplified Permission Checker

Clean, focused permission checking without the complexity of UnifiedPermissionService.
Separated concerns into dedicated modules for clarity and testability.
"""

import logging
from typing import TYPE_CHECKING

from sqlmodel import Session, select

from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.permissions.constants import ADMIN_OR_MAINTAINER_SLUGS, RoleSlug
from src.db.permissions.enums import AuditLevel
from src.db.permissions.generated_enums import Action, ResourceType, Scope
from src.db.permissions.models import Permission, RolePermission, UserRole
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.security.permissions.audit import AuditLogger
from src.security.permissions.cache import get_permission_cache
from src.security.permissions.ownership import OwnershipChecker

if TYPE_CHECKING:
    from fastapi import Request

_logger = logging.getLogger(__name__)


class PermissionChecker:
    """
    Simplified permission checker.

    Responsibilities:
    - Check if user has permission
    - Handle role hierarchy
    - Evaluate scopes (ALL, OWN, ORG, ASSIGNED)

    NOT responsible for:
    - Caching (handled by cache module)
    - Audit logging (handled by audit module)
    - Resource ownership verification (handled by ownership module)

    This separation makes the code more maintainable and testable.
    """

    def __init__(
        self,
        db: Session,
        use_cache: bool = True,
        audit_level: AuditLevel = AuditLevel.ALL_EXCEPT_READS,
    ):
        """
        Initialize permission checker.

        Args:
            db: Database session
            use_cache: Whether to use Redis caching
            audit_level: Level of audit logging
        """
        self.db = db
        self.use_cache = use_cache
        self.cache = get_permission_cache() if use_cache else None
        self.ownership = OwnershipChecker(db)
        self.audit = AuditLogger(db, level=audit_level)

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
        """Check if the user is anonymous."""
        if user is None or isinstance(user, AnonymousUser):
            return True
        return not hasattr(user, "id") or user.id == 0

    def _is_internal_user(
        self, user: PublicUser | AnonymousUser | InternalUser | None
    ) -> bool:
        """Check if the user is an internal system user."""
        return isinstance(user, InternalUser)

    async def _get_user_roles(
        self, user_id: int, org_id: int | None = None
    ) -> list[UserRole]:
        """
        Get all roles for a user in an organization.

        Includes role hierarchy (parent roles).
        """
        if user_id == 0:
            return []

        # Get direct roles
        statement = select(UserRole).where(UserRole.user_id == user_id)
        if org_id:
            statement = statement.where(UserRole.org_id == org_id)

        user_roles = list(self.db.exec(statement).all())

        # TODO: Implement role hierarchy traversal
        # For now, just return direct roles
        return user_roles

    async def _get_role_permissions(
        self, role_id: int
    ) -> set[str]:
        """
        Get all permission names for a role.

        Returns:
            Set of permission names like "course:create:org"
        """
        statement = (
            select(Permission)
            .join(RolePermission)
            .where(RolePermission.role_id == role_id)
        )

        permissions = self.db.exec(statement).all()
        return {
            f"{p.resource_type.value}:{p.action.value}:{p.scope.value}"
            for p in permissions
        }

    async def _get_effective_permissions(
        self, user_id: int, org_id: int | None = None
    ) -> set[str]:
        """
        Get all effective permissions for a user.

        Combines permissions from all user's roles.

        Returns:
            Set of permission names
        """
        if user_id == 0:
            # Anonymous users only have read:all permissions
            return {f"{rt.value}:read:all" for rt in ResourceType}

        user_roles = await self._get_user_roles(user_id, org_id)

        all_permissions: set[str] = set()
        for user_role in user_roles:
            if user_role.role:
                # Check for wildcard permission
                role_perms = await self._get_role_permissions(user_role.role.id)

                # If role has wildcard, grant everything
                if "*:*:*" in role_perms:
                    return {"*:*:*"}

                all_permissions.update(role_perms)

        return all_permissions

    def _check_scope(
        self,
        user_id: int,
        scope: Scope,
        resource_id: str | None,
        org_id: int | None,
    ) -> bool:
        """
        Check if scope requirements are met.

        Args:
            user_id: User ID
            scope: Required scope
            resource_id: Resource being accessed
            org_id: Organization context

        Returns:
            True if scope requirements are met
        """
        if scope == Scope.ALL:
            return True

        if scope == Scope.OWN:
            if not resource_id:
                return False
            return self.ownership.is_contributor(user_id, resource_id)

        if scope == Scope.ORG:
            # User must be in the organization
            # For now, just check if org_id is provided
            return org_id is not None

        if scope == Scope.ASSIGNED:
            # TODO: Implement assignment checking
            # For now, return False
            return False

        return False

    def _apply_scope_fallback(
        self,
        permissions: set[str],
        resource_type: ResourceType,
        action: Action,
        scope: Scope,
    ) -> bool:
        """
        Apply scope fallback logic.

        Fallback chain:
        1. Check exact permission: resource:action:scope
        2. If scope=OWN, also check: resource:action:ORG
        3. If scope=OWN or ORG, also check: resource:action:ALL
        4. Check wildcard: *:*:*

        Args:
            permissions: Set of user's permissions
            resource_type: Resource type
            action: Action
            scope: Required scope

        Returns:
            True if permission found (with fallback)
        """
        # Check wildcard
        if "*:*:*" in permissions:
            return True

        # Check exact match
        exact_perm = f"{resource_type.value}:{action.value}:{scope.value}"
        if exact_perm in permissions:
            return True

        # Fallback to broader scopes
        if scope == Scope.OWN:
            org_perm = f"{resource_type.value}:{action.value}:{Scope.ORG.value}"
            if org_perm in permissions:
                return True

        if scope in [Scope.OWN, Scope.ORG]:
            all_perm = f"{resource_type.value}:{action.value}:{Scope.ALL.value}"
            if all_perm in permissions:
                return True

        return False

    async def check(
        self,
        user: PublicUser | AnonymousUser | InternalUser | None,
        action: Action,
        resource_type: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        scope: Scope = Scope.ALL,
        request: "Request | None" = None,
    ) -> bool:
        """
        Check if user has permission.

        Algorithm:
        1. Handle special cases (internal user, anonymous)
        2. Check cache if enabled
        3. Get user's effective permissions
        4. Apply scope fallback logic
        5. Verify scope requirements
        6. Cache result
        7. Log audit trail

        Args:
            user: User to check
            action: Action being attempted
            resource_type: Type of resource
            resource_id: Optional specific resource UUID
            org_id: Optional organization ID
            scope: Permission scope
            request: Optional FastAPI request for context

        Returns:
            True if permission granted
        """
        user_id = self._get_user_id(user)

        # Special case: Internal system users have all permissions
        if self._is_internal_user(user):
            return True

        # Special case: Anonymous users can only read public content
        if self._is_anonymous(user):
            granted = action == Action.READ and scope == Scope.ALL
            await self.audit.log_check(
                user_id=0,
                action=action,
                resource_type=resource_type,
                granted=granted,
                resource_id=resource_id,
                org_id=org_id,
                scope=scope.value,
                reason="Anonymous user" if not granted else None,
            )
            return granted

        # Check cache
        if self.cache:
            cached = await self.cache.get_permission(
                user_id,
                action.value,
                resource_type.value,
                resource_id,
                org_id,
                scope.value,
            )
            if cached is not None:
                return cached

        # Get effective permissions
        effective_perms = await self._get_effective_permissions(user_id, org_id)

        # Apply scope fallback logic
        has_permission = self._apply_scope_fallback(
            effective_perms,
            resource_type,
            action,
            scope,
        )

        # If permission exists, verify scope requirements
        if has_permission and scope != Scope.ALL:
            scope_ok = self._check_scope(user_id, scope, resource_id, org_id)
            if not scope_ok:
                has_permission = False

        # Cache result
        if self.cache:
            await self.cache.set_permission(
                user_id,
                action.value,
                resource_type.value,
                has_permission,
                resource_id,
                org_id,
                scope.value,
            )

        # Audit log
        await self.audit.log_check(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            granted=has_permission,
            resource_id=resource_id,
            org_id=org_id,
            scope=scope.value,
            reason=None if has_permission else "Permission denied",
            ip_address=request.client.host if request else None,
        )

        return has_permission

    async def require(
        self,
        user: PublicUser | AnonymousUser | InternalUser | None,
        action: Action,
        resource_type: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        scope: Scope = Scope.ALL,
        request: "Request | None" = None,
    ) -> None:
        """
        Check permission and raise exception if denied.

        This is a convenience method that raises PermissionDenied
        instead of returning False.

        Args:
            Same as check()

        Raises:
            AuthenticationRequired: If user is anonymous
            PermissionDenied: If permission denied
        """
        from src.security.permissions.exceptions import (
            AuthenticationRequired,
            PermissionDenied,
        )

        if self._is_anonymous(user):
            raise AuthenticationRequired(
                resource_type=resource_type,
                action=action,
            )

        has_permission = await self.check(
            user,
            action,
            resource_type,
            resource_id,
            org_id,
            scope,
            request,
        )

        if not has_permission:
            raise PermissionDenied(
                action,
                resource_type,
                resource_id,
                org_id=org_id,
            )

    async def has_role(
        self, user_id: int, role_slug: str, org_id: int | None = None
    ) -> bool:
        """
        Check if user has a specific role.

        Args:
            user_id: User ID
            role_slug: Role slug to check
            org_id: Optional organization ID

        Returns:
            True if user has the role
        """
        user_roles = await self._get_user_roles(user_id, org_id)
        return any(ur.role and ur.role.slug == role_slug for ur in user_roles)

    async def is_admin(
        self, user_id: int, org_id: int | None = None
    ) -> bool:
        """
        Check if user is an admin (super-admin or org-admin).

        Args:
            user_id: User ID
            org_id: Optional organization ID

        Returns:
            True if user is admin
        """
        user_roles = await self._get_user_roles(user_id, org_id)
        return any(
            ur.role and ur.role.slug in ADMIN_OR_MAINTAINER_SLUGS
            for ur in user_roles
        )


# Convenience function for FastAPI dependency injection
def get_permission_checker(db: Session) -> PermissionChecker:
    """
    Get a PermissionChecker instance.

    This is the main dependency for permission checking in routes.

    Args:
        db: Database session

    Returns:
        PermissionChecker instance
    """
    return PermissionChecker(db)
