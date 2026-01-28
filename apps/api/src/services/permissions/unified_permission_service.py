"""
Unified Permission Service - Single entry point for all RBAC checks.

This module provides a complete RBAC system with:
- Role-based permission checks with hierarchy
- Resource ownership verification
- Scope evaluation (ALL, OWN, ORG, ASSIGNED)
- ABAC condition evaluation
- Redis caching for performance
- Tiered audit logging

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

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
import sqlalchemy as sa

from src.db.courses.courses import Course
from src.db.permissions.constants import (
    ADMIN_OR_MAINTAINER_SLUGS,
    INSTRUCTOR_OR_HIGHER_SLUGS,
)
from src.db.permissions.enums import (
    Action,
    AuditAction,
    AuditLevel,
    ResourceType,
    Scope,
)
from src.db.permissions.models import (
    Permission,
    ResourcePermission,
    Role,
    RolePermission,
    UserRole,
)
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.services.cache.redis_client import get_redis_client
from src.services.permissions.audit_service import AuditService
from src.services.permissions.permission_cache import (
    cache_lock,
    get_cached_permission,
    get_cached_user_roles,
    set_cached_permission,
    set_cached_user_roles,
)
from src.services.permissions.role_service import RoleService

if TYPE_CHECKING:
    from src.security.rbac.policies.base import BasePolicy

_logger = logging.getLogger(__name__)

# Maximum depth for role inheritance hierarchy to prevent performance issues
MAX_ROLE_HIERARCHY_DEPTH = 10


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

    This service consolidates all permission checking logic, including
    role-based permissions, ownership, scopes, and ABAC conditions.
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
        self.audit_service = AuditService(db, redis=get_redis_client())
        self.role_service = RoleService(db)
        self._policies: dict[ResourceType, "BasePolicy"] = {}

    def register_policy(
        self, resource_type: ResourceType, policy: "BasePolicy"
    ) -> None:
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

        if resource_type == ResourceType.ORGANIZATION:
            # Organizations have an 'explore' flag that marks them as publicly discoverable
            # Additionally, an organization is effectively public if it owns any public courses
            from src.db.organizations import Organization
            from src.db.courses.courses import Course

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
        if self.audit_level == AuditLevel.WRITES_ONLY and action != Action.READ:
            return True
        return bool(self.audit_level == AuditLevel.FAILURES_ONLY and not granted)

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
        action_str = action.value if hasattr(action, "value") else str(action)
        resource_str = resource.value if hasattr(resource, "value") else str(resource)
        cache_key = f"{user_id}:{action_str}:{resource_str}:{resource_id}:{org_id}"

        if self.use_cache:
            cached = get_cached_permission(
                user_id, action_str, resource_str, resource_id, org_id
            )
            if cached is not None:
                # Cached is a dict-like object with 'allowed', 'scope', 'conditions'
                cached_allowed = (
                    cached["allowed"] if isinstance(cached, dict) else bool(cached)
                )
                # Coerce None to False for safety
                if cached_allowed is None:
                    cached_allowed = False
                if self._should_audit(action, cached_allowed):
                    self.audit_service.log(
                        user_id=user_id if user_id != 0 else None,
                        audit_action=AuditAction.CHECK,
                        result=bool(cached_allowed),
                        resource_type=resource,
                        resource_id=resource_id,
                        context={
                            "cached": True,
                            "org_id": org_id,
                            "action": action.value,
                        },
                    )
                if not cached_allowed and raise_on_deny:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission denied: Cannot {action.value} {resource.value}",
                    )
                return bool(cached_allowed)

        # Use cache lock to prevent race conditions
        granted = False
        with cache_lock(f"rbac:lock:{cache_key}") as lock_acquired:
            # If we acquired the lock, check cache again and compute if needed
            if lock_acquired and self.use_cache:
                # Double-check cache (may have been set while waiting for lock)
                cached = get_cached_permission(
                    user_id, action_str, resource_str, resource_id, org_id
                )
                if cached is not None:
                    cached_allowed = (
                        cached["allowed"] if isinstance(cached, dict) else bool(cached)
                    )
                    return bool(cached_allowed) if cached_allowed is not None else False

            # Perform the actual permission check
            # Check if resource-specific policy exists
            policy = self._policies.get(resource)
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
                # Build ABAC context from request
                abac_context = self._build_abac_context(
                    user=user,
                    user_id=user_id,
                    org_id=org_id,
                    resource_id=resource_id,
                    request=request,
                )

                granted = await self._default_check(
                    user=user,
                    user_id=user_id,
                    is_anonymous=is_anonymous,
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    org_id=org_id,
                    abac_context=abac_context,
                )

        # Cache result
        if self.use_cache:
            set_cached_permission(
                user_id,
                action_str,
                resource_str,
                granted,
                resource_id=resource_id,
                org_id=org_id,
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
        abac_context: dict | None = None,
    ) -> bool:
        """
        Default permission check logic when no policy is registered.

        This implements the complete RBAC flow:
        1. Check if resource is public (for READ actions)
        2. Check resource-level permissions (most specific)
        3. Check resource ownership
        4. Check admin/maintainer role
        5. Check role-based permissions with scope/conditions
        """
        # Anonymous users can only read public resources
        if is_anonymous:
            if action == Action.READ and resource_id:
                if self._is_resource_public(resource_id, resource):
                    return True
            return False

        # Check resource-level permissions first (most specific)
        if resource_id and self._check_resource_permission(
            user_id, action, resource, resource_id
        ):
            return True

        # Check resource ownership (for specific resources)
        is_owner = False
        if resource_id and action != Action.CREATE:
            is_owner = self._is_resource_owner(user_id, resource_id)
            if is_owner:
                return True

        # Check admin/maintainer role (full access)
        if self._is_admin_or_maintainer(user_id):
            return True

        # Get user's active roles (filter expired)
        roles = self._get_user_active_roles(user_id, org_id)

        if not roles:
            return False

        # Build scope context for evaluation
        scope_context = {
            "is_owner": is_owner,
            "request_org_id": org_id,
            "user_id": user_id,
            "resource_id": resource_id,
        }

        # Check each role's permissions (including inherited)
        for role in roles:
            scope_context["role_org_id"] = role.org_id
            if self._check_role_permission(
                role,
                action,
                resource,
                scope_context,
                context=abac_context,  # Pass ABAC context
            ):
                return True

        return False

    def _build_abac_context(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        user_id: int,
        org_id: int | None,
        resource_id: str | None,
        request: Request | None,
    ) -> dict:
        """Build ABAC context from request and user data."""
        context = {
            "user_id": user_id,
            "org_id": org_id,
            "resource_id": resource_id,
            "timestamp": datetime.now(UTC),
        }

        # Add request context if available
        if request:
            context["ip_address"] = (
                getattr(request.client, "host", None)
                if hasattr(request, "client")
                else None
            )
            context["user_agent"] = request.headers.get("user-agent")
            context["method"] = request.method if hasattr(request, "method") else None

        # Add user attributes if available
        if hasattr(user, "email"):
            context["user_email"] = user.email
        if hasattr(user, "username"):
            context["user_username"] = user.username

        return context

    # ==================== Core RBAC Helper Methods ====================

    def _check_resource_permission(
        self,
        user_id: int,
        action: Action,
        resource: ResourceType,
        resource_id: str,
    ) -> bool:
        """Check for resource-level permission overrides."""
        # Ensure we pass the enum *value* (lowercase string) to SQL to match DB enum
        # Normalize resource type to lowercase string for Postgres ENUM compatibility
        if hasattr(resource, "value"):
            resource_val = resource.value.lower()
        else:
            resource_val = str(resource).lower()

        # Prepare action string for comparison
        action_str = (
            action.value.lower() if hasattr(action, "value") else str(action).lower()
        )

        statement = (
            select(ResourcePermission)
            .join(Permission, Permission.id == ResourcePermission.permission_id)
            .where(
                ResourcePermission.user_id == user_id,
                # Accept either Enum-based equality (used in SQLite tests) or string-based equality (used with Postgres enums)
                (
                    (ResourcePermission.resource_type == resource)
                    | (
                        sa.cast(ResourcePermission.resource_type, sa.String)
                        == resource_val
                    )
                ),
                ResourcePermission.resource_id == resource_id,
                (
                    (Permission.action == action)
                    | (sa.cast(Permission.action, sa.String) == action_str)
                ),
            )
        )

        # Filter out expired permissions
        statement = statement.where(
            (ResourcePermission.expires_at.is_(None))
            | (ResourcePermission.expires_at > datetime.now(UTC))  # type: ignore[union-attr]
        )

        return self.db.exec(statement).first() is not None

    def _get_user_active_roles(
        self, user_id: int, org_id: int | None = None
    ) -> list[Role]:
        """Get all active (non-expired) roles for a user with caching."""
        # Try cache first
        if self.use_cache:
            cached = get_cached_user_roles(user_id, org_id)
            if cached is not None:
                role_ids = cached.get("role_ids", [])
                if role_ids:
                    return list(
                        self.db.exec(
                            select(Role)
                            .where(Role.id.in_(role_ids))
                            .order_by(Role.priority.desc())
                        ).all()
                    )
                return []

        # Query database
        statement = (
            select(Role)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
            .where(
                (UserRole.expires_at.is_(None))
                | (UserRole.expires_at > datetime.now(UTC))
            )  # type: ignore[union-attr]
        )

        if org_id is not None:
            statement = statement.where(UserRole.org_id == org_id)

        statement = statement.order_by(Role.priority.desc())
        roles = list(self.db.exec(statement).all())

        # Cache the result
        if self.use_cache and roles:
            role_ids = [r.id for r in roles if r.id]
            role_names = [r.name for r in roles]
            set_cached_user_roles(user_id, role_ids, role_names, org_id)

        return roles

    def _check_ownership(self, user_id: int, resource_id: str) -> bool:
        """Check if user owns a resource via ResourceAuthor table."""
        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship.in_(
                [
                    ResourceAuthorshipEnum.CREATOR,
                    ResourceAuthorshipEnum.MAINTAINER,
                    ResourceAuthorshipEnum.CONTRIBUTOR,
                ]
            ),
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
        return self.db.exec(statement).first() is not None

    def _check_user_assigned(self, user_id: int, resource_id: str) -> bool:
        """Check if user is assigned to a resource through user groups."""
        statement = (
            select(UserGroupResource)
            .join(
                UserGroupUser,
                UserGroupUser.usergroup_id == UserGroupResource.usergroup_id,
            )
            .where(
                UserGroupUser.user_id == user_id,
                UserGroupResource.resource_uuid == resource_id,
            )
        )
        return self.db.exec(statement).first() is not None

    def _check_role_permission(
        self,
        role: Role,
        action: Action,
        resource: ResourceType,
        scope_context: dict,
        context: dict | None = None,
    ) -> bool:
        """Check if a role grants a specific permission with scope/condition evaluation."""
        # Collect all role IDs in the hierarchy
        role_ids = self._get_role_hierarchy_ids(role.id)  # type: ignore[arg-type]

        if not role_ids:
            return False

        # Batch query: get all permissions for all role IDs
        statement = (
            select(Permission, RolePermission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(
                RolePermission.role_id.in_(role_ids),
                sa.cast(Permission.resource_type, sa.String)
                == (
                    resource.value.lower()
                    if hasattr(resource, "value")
                    else str(resource).lower()
                ),
                sa.cast(Permission.action, sa.String)
                == (
                    action.value.lower()
                    if hasattr(action, "value")
                    else str(action).lower()
                ),
            )
        )

        results = self.db.exec(statement).all()

        for permission, role_permission in results:
            if self._scope_matches(permission.scope, scope_context):
                if self._conditions_match(role_permission.conditions, context):
                    return True

        return False

    def _get_role_hierarchy_ids(self, role_id: int) -> list[int]:
        """Get all role IDs in the hierarchy chain using recursive CTE."""
        from sqlalchemy import text

        stmt = text("""
                WITH RECURSIVE role_hierarchy AS (
                    SELECT id, parent_role_id, 0 as depth
                    FROM roles
                    WHERE id = :role_id

                    UNION ALL

                    SELECT r.id, r.parent_role_id, rh.depth + 1
                    FROM roles r
                    INNER JOIN role_hierarchy rh ON r.id = rh.parent_role_id
                    WHERE rh.depth < :max_depth
                )
                SELECT id FROM role_hierarchy ORDER BY depth
            """).bindparams(role_id=role_id, max_depth=MAX_ROLE_HIERARCHY_DEPTH)

        rows = self.db.exec(stmt).all()
        return [r[0] for r in rows]

    def _scope_matches(self, scope: Scope, scope_context: dict) -> bool:
        """Check if a permission scope matches the current context."""
        is_owner = scope_context.get("is_owner", False)
        request_org_id = scope_context.get("request_org_id")
        role_org_id = scope_context.get("role_org_id")

        match scope:
            case Scope.ALL:
                return True
            case Scope.OWN:
                return is_owner
            case Scope.ORG:
                if role_org_id is None:
                    return True  # Global role can access any org
                if request_org_id is not None:
                    return role_org_id == request_org_id
                return True  # Backward compat
            case Scope.ASSIGNED:
                user_id = scope_context.get("user_id")
                resource_id = scope_context.get("resource_id")
                if not user_id or not resource_id:
                    return False
                return self._check_user_assigned(user_id, resource_id)
            case _:
                return False

    def _conditions_match(self, conditions: dict | None, context: dict | None) -> bool:
        """Evaluate ABAC conditions."""
        if not conditions:
            return True
        if not context:
            return False

        if "type" in conditions and "rules" in conditions:
            return self._evaluate_complex_condition(conditions, context)

        # Simple equality check
        for key, expected in conditions.items():
            if key not in context or context[key] != expected:
                return False

        return True

    def _evaluate_complex_condition(self, condition: dict, context: dict) -> bool:
        """Evaluate complex ABAC condition with AND/OR/NOT logic."""
        condition_type = condition.get("type", "and")
        rules = condition.get("rules", [])

        if not rules:
            return True

        if condition_type == "and":
            return all(self._evaluate_rule(rule, context) for rule in rules)
        if condition_type == "or":
            return any(self._evaluate_rule(rule, context) for rule in rules)
        if condition_type == "not":
            return not any(self._evaluate_rule(rule, context) for rule in rules)

        _logger.warning("Unknown condition type: %s", condition_type)
        return False

    def _evaluate_rule(self, rule: dict, context: dict) -> bool:
        """Evaluate a single ABAC rule with operators like ==, >, in, contains."""
        field = rule.get("field")
        operator = rule.get("operator", "==")
        expected = rule.get("value")

        if not field:
            return False

        actual = self._get_context_value(field, context)

        try:
            if operator == "==":
                return actual == expected
            if operator == "!=":
                return actual != expected
            if operator == ">":
                return actual > expected
            if operator == ">=":
                return actual >= expected
            if operator == "<":
                return actual < expected
            if operator == "<=":
                return actual <= expected
            if operator == "in":
                return (
                    actual in expected
                    if isinstance(expected, (list, tuple, set))
                    else False
                )
            if operator == "not_in":
                return (
                    actual not in expected
                    if isinstance(expected, (list, tuple, set))
                    else True
                )
            if operator == "contains":
                return (
                    expected in actual
                    if isinstance(actual, (str, list, tuple))
                    else False
                )
            _logger.warning("Unknown operator: %s", operator)
            return False
        except (TypeError, AttributeError) as e:
            _logger.warning("Error evaluating rule %s: %s", rule, e)
            return False

    def _get_context_value(self, field: str, context: dict) -> any:
        """Get value from context with dot notation support (e.g., 'user.department')."""
        parts = field.split(".")
        value = context

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
                if value is None:
                    return None
            else:
                return None

        return value

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

    def get_user_permissions(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        org_id: int | None = None,
    ) -> dict[str, bool]:
        """
        Get all effective permissions for a user as a dictionary.

        Returns a dictionary mapping permission strings to boolean values.
        Format: 'resource:action:scope' -> bool

        Args:
            user: User to get permissions for
            org_id: Optional organization context

        Returns:
            Dictionary like {'course:create:org': True, 'course:update:own': True}
        """
        user_id = self._get_user_id(user)
        is_anonymous = self._is_anonymous(user)

        permissions: dict[str, bool] = {}

        # Anonymous users have no permissions
        if is_anonymous:
            return permissions

        # Get user's active roles
        roles = self._get_user_active_roles(user_id, org_id)

        # Collect all permissions from all roles
        for role in roles:
            role_ids = self._get_role_hierarchy_ids(role.id)  # type: ignore[arg-type]
            if not role_ids:
                continue

            # Get all permissions for this role hierarchy
            statement = (
                select(Permission, RolePermission)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .where(RolePermission.role_id.in_(role_ids))
            )

            results = self.db.exec(statement).all()

            for permission, _ in results:
                # Build permission key: resource:action:scope
                perm_key = f"{permission.resource_type.value}:{permission.action.value}:{permission.scope.value}"
                permissions[perm_key] = True

        return permissions


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
    return UnifiedPermissionService(db, use_cache=use_cache, audit_level=audit_level)
