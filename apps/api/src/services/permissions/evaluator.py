"""
Permission Evaluator - Pure permission evaluation logic.

This module provides clean, testable permission evaluation separated from
caching, audit logging, and other cross-cutting concerns.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Optional

from sqlmodel import Session, select

from src.db.courses.courses import Course
from src.db.permissions.constants import (
    ADMIN_OR_MAINTAINER_SLUGS,
    INSTRUCTOR_OR_HIGHER_SLUGS,
)
from src.db.permissions.enums import Action, ResourceType, Scope
from src.db.permissions.models import Permission, Role, RolePermission
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser


@dataclass
class PermissionContext:
    """Value object for permission check context."""

    user_id: int
    action: Action
    resource: ResourceType
    resource_id: Optional[str] = None
    org_id: Optional[int] = None
    scope: Scope = Scope.ALL
    abac_context: Optional[dict] = None

    @property
    def cache_key(self) -> str:
        """Build cache key for this context."""
        return f"perm:{self.user_id}:{self.action.value}:{self.resource.value}:{self.resource_id}:{self.org_id}:{self.scope.value}"

    def requires_resource_id(self) -> bool:
        """Check if this scope requires resource_id."""
        return self.scope in (Scope.OWN, Scope.ASSIGNED)


@dataclass
class PermissionResult:
    """Result of permission evaluation."""

    allowed: bool
    reason: Optional[str] = None
    matched_permission: Optional[str] = None
    matched_role: Optional[str] = None
    is_owner: bool = False
    is_public: bool = False


class PermissionEvaluator:
    """
    Pure permission evaluation logic.

    No side effects:
    - No caching
    - No audit logging
    - No database writes

    Just evaluates: Given context, is permission allowed?
    """

    def __init__(self, db: Session):
        self.db = db

    def evaluate(self, context: PermissionContext) -> PermissionResult:
        """
        Evaluate permission based on roles, scopes, and ownership.

        Algorithm:
        1. Validate context (e.g., resource_id required for OWN scope)
        2. Check if resource is public (READ only)
        3. Check resource ownership
        4. Check admin/maintainer bypass
        5. Get user's effective permissions
        6. Check if required permission exists (with scope fallback)
        7. Validate scope requirements
        8. Return result
        """
        # 1. Validate context
        if context.requires_resource_id() and not context.resource_id:
            return PermissionResult(
                allowed=False,
                reason=f"Scope {context.scope.value} requires resource_id",
            )

        # 2. Anonymous users (user_id=0) can only read public resources
        if context.user_id == 0:
            if context.action == Action.READ and context.resource_id:
                is_public = self._is_resource_public(
                    context.resource_id, context.resource
                )
                if is_public:
                    return PermissionResult(
                        allowed=True, is_public=True, reason="Public resource"
                    )
            return PermissionResult(allowed=False, reason="Anonymous user")

        # 3. Check resource ownership
        is_owner = False
        if context.resource_id and context.action != Action.CREATE:
            is_owner = self._check_ownership(context.user_id, context.resource_id)
            if is_owner and context.scope in (Scope.OWN, Scope.ALL):
                # Owner has implicit read/update/delete on OWN resources
                if context.action in (Action.READ, Action.UPDATE, Action.DELETE):
                    return PermissionResult(
                        allowed=True, is_owner=True, reason="Resource owner"
                    )

        # 4. Check admin/maintainer bypass
        if self._is_admin_or_maintainer(context.user_id):
            return PermissionResult(allowed=True, reason="Admin/Maintainer role bypass")

        # 5. Get user's active roles
        roles = self._get_user_active_roles(context.user_id, context.org_id)

        if not roles:
            return PermissionResult(allowed=False, reason="User has no roles")

        # 6. Get all permissions from roles
        all_permissions: set[str] = set()
        for role in roles:
            perms = self._get_role_permissions(role.id)
            all_permissions.update(perms)

        # 7. Check permission with scope fallback
        matched_perm = self._check_permission_with_fallback(
            all_permissions, context.resource, context.action, context.scope
        )

        if not matched_perm:
            required_perm = (
                f"{context.resource.value}:{context.action.value}:{context.scope.value}"
            )
            return PermissionResult(
                allowed=False,
                reason=f"Permission {required_perm} not found in user's roles",
            )

        # 8. Validate scope requirements
        scope_valid = self._validate_scope(context, is_owner)
        if not scope_valid:
            return PermissionResult(
                allowed=False, reason=f"Scope {context.scope.value} validation failed"
            )

        return PermissionResult(
            allowed=True,
            matched_permission=matched_perm,
            is_owner=is_owner,
        )

    def _check_permission_with_fallback(
        self,
        permissions: set[str],
        resource: ResourceType,
        action: Action,
        scope: Scope,
    ) -> Optional[str]:
        """
        Check permission with scope fallback.

        Fallback chain:
        1. Exact: course:update:own
        2. Broader scope: course:update:org (if checking own)
        3. All scope: course:update:all
        4. Wildcard: *:*:*
        """
        # Wildcard
        if "*:*:*" in permissions:
            return "*:*:*"

        # Exact match
        exact = f"{resource.value}:{action.value}:{scope.value}"
        if exact in permissions:
            return exact

        # Fallback to ORG if checking OWN
        if scope == Scope.OWN:
            org_perm = f"{resource.value}:{action.value}:{Scope.ORG.value}"
            if org_perm in permissions:
                return org_perm

        # Fallback to ALL if checking OWN or ORG
        if scope in (Scope.OWN, Scope.ORG):
            all_perm = f"{resource.value}:{action.value}:{Scope.ALL.value}"
            if all_perm in permissions:
                return all_perm

        return None

    def _validate_scope(self, context: PermissionContext, is_owner: bool) -> bool:
        """
        Validate scope-specific requirements.

        - OWN: User must own the resource
        - ORG: Resource must belong to user's org
        - ASSIGNED: User must be assigned to resource
        - ALL: No validation needed
        """
        if context.scope == Scope.ALL:
            return True

        if context.scope == Scope.OWN:
            if not context.resource_id:
                return False
            return is_owner

        if context.scope == Scope.ORG:
            if not context.org_id:
                return False
            # Check if resource belongs to org
            # (implementation depends on resource type)
            return True  # Simplified for now

        if context.scope == Scope.ASSIGNED:
            if not context.resource_id:
                return False
            return self._check_user_assigned(context.user_id, context.resource_id)

        return False

    def _is_resource_public(
        self, resource_id: str, resource_type: ResourceType
    ) -> bool:
        """Check if a resource is publicly accessible."""
        if resource_type == ResourceType.COURSE:
            course = self.db.exec(
                select(Course).where(Course.course_uuid == resource_id)
            ).first()
            return course.public if course else False

        if resource_type == ResourceType.ORGANIZATION:
            from src.db.organizations import Organization

            org = self.db.exec(
                select(Organization).where(Organization.org_uuid == resource_id)
            ).first()

            if not org:
                return False

            if getattr(org, "explore", False):
                return True

            # Fallback: if organization has any public course, consider it public
            public_course = self.db.exec(
                select(Course).where(Course.org_id == org.id, Course.public)
            ).first()
            return public_course is not None

        return False

    def _check_ownership(self, user_id: int, resource_id: str) -> bool:
        """Check if user owns a resource via ResourceAuthor table."""
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

    def _check_user_assigned(self, user_id: int, resource_id: str) -> bool:
        """Check if user is assigned to a resource through user groups."""
        statement = (
            select(UserGroupResource)
            .join(UserGroupUser)
            .where(
                UserGroupUser.user_id == user_id,
                UserGroupResource.resource_uuid == resource_id,
            )
        )
        return bool(self.db.exec(statement).first())

    def _is_admin_or_maintainer(self, user_id: int) -> bool:
        """Check if user has admin or maintainer role."""
        if user_id == 0:
            return False

        roles = self._get_user_active_roles(user_id)
        return any(
            role.slug in ADMIN_OR_MAINTAINER_SLUGS for role in roles if role.slug
        )

    def _get_user_active_roles(
        self, user_id: int, org_id: Optional[int] = None
    ) -> list[Role]:
        """Get all active (non-expired) roles for a user."""
        from src.db.permissions.models import UserRole

        statement = (
            select(Role)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )

        # Filter by org if specified
        if org_id is not None:
            statement = statement.where(
                (UserRole.org_id == org_id) | (UserRole.org_id.is_(None))
            )

        # Filter out expired roles
        now = datetime.now(UTC)
        statement = statement.where(
            (UserRole.expires_at.is_(None)) | (UserRole.expires_at > now)
        )

        return list(self.db.exec(statement).all())

    def _get_role_permissions(self, role_id: int) -> set[str]:
        """
        Get all permission names for a role.

        Returns:
            Set of permission names like "course:create:org"
        """
        statement = (
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        )

        permissions = self.db.exec(statement).all()
        return {
            f"{p.resource_type.value}:{p.action.value}:{p.scope.value}"
            for p in permissions
        }
