"""
Policy engine for evaluating permissions.

This module provides the core permission evaluation logic, including:
- Role-based permission checks
- Resource ownership verification
- Scope evaluation
- ABAC condition evaluation
- Redis caching for performance
"""

import logging
from datetime import UTC, datetime

from sqlmodel import Session, select

from src.db.permissions.enums import Action, ResourceType, Scope
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
from src.services.permissions.permission_cache import (
    get_cached_permission,
    get_cached_user_roles,
    set_cached_permission,
    set_cached_user_roles,
)

_logger = logging.getLogger(__name__)

# Maximum depth for role inheritance hierarchy to prevent performance issues
MAX_ROLE_HIERARCHY_DEPTH = 10


class PolicyEngine:
    """
    Central policy engine for permission evaluation.

    This class handles all permission checks, including:
    - Role-based permissions with inheritance
    - Resource-level permission overrides
    - Ownership checks
    - Scope evaluation
    """

    def __init__(self, db: Session, use_cache: bool = True) -> None:
        self.db = db
        self.use_cache = use_cache

    def evaluate(
        self,
        user_id: int,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        context: dict | None = None,
    ) -> bool:
        """
        Evaluate if a user has permission to perform an action on a resource.

        The evaluation order:
        1. Check cache for previous result
        2. Check resource-level permissions (most specific)
        3. Check role-based permissions with scope evaluation
        4. Evaluate ABAC conditions if present
        5. Cache the result

        Args:
            user_id: User ID
            action: Action to perform
            resource: Resource type
            resource_id: Optional specific resource UUID
            org_id: Optional organization context
            context: Optional additional context for ABAC

        Returns:
            True if permission is granted, False otherwise
        """
        # Anonymous users have very limited access
        if user_id == 0:
            return self._check_anonymous_access(action, resource, resource_id)

        # Check cache first (skip if context is provided - ABAC may vary)
        action_str = action.value if hasattr(action, "value") else str(action)
        resource_str = resource.value if hasattr(resource, "value") else str(resource)

        if self.use_cache and context is None:
            cached = get_cached_permission(
                user_id, action_str, resource_str, resource_id, org_id
            )
            if cached is not None:
                return cached["allowed"]

        # Check resource-level permissions first (most specific)
        if resource_id and self._check_resource_permission(
            user_id, action, resource, resource_id
        ):
            if self.use_cache:
                set_cached_permission(
                    user_id, action_str, resource_str, True, resource_id, org_id
                )
            return True

        # Get user's roles (filter expired)
        roles = self._get_user_active_roles(user_id, org_id)

        if not roles:
            if self.use_cache:
                set_cached_permission(
                    user_id, action_str, resource_str, False, resource_id, org_id
                )
            return False

        # Check ownership for "own" scope
        is_owner = False
        if resource_id:
            is_owner = self._check_ownership(user_id, resource_id)

        # Check each role's permissions (including inherited)
        for role in roles:
            if self._check_role_permission(
                role,
                action,
                resource,
                is_owner,
                org_id,
                context,
                user_id,
                resource_id,
            ):
                if self.use_cache and context is None:
                    set_cached_permission(
                        user_id, action_str, resource_str, True, resource_id, org_id
                    )
                return True

        if self.use_cache and context is None:
            set_cached_permission(
                user_id, action_str, resource_str, False, resource_id, org_id
            )
        return False

    def _check_anonymous_access(
        self,
        action: Action,
        resource: ResourceType,
        resource_id: str | None,
    ) -> bool:
        """
        Check if anonymous users can access this resource.

        Anonymous users can only read public courses and collections.
        """
        if action != Action.READ:
            return False

        if resource not in (ResourceType.COURSE, ResourceType.COLLECTION):
            return False

        # Actually check if the resource is public
        if not resource_id:
            return False

        return self._is_resource_public(resource, resource_id)

    def _is_resource_public(self, resource: ResourceType, resource_id: str) -> bool:
        """Check if a specific resource is marked as public."""
        if resource == ResourceType.COURSE:
            from src.db.courses.courses import Course

            course = self.db.exec(
                select(Course).where(Course.course_uuid == resource_id)
            ).first()
            return course.public if course else False
        elif resource == ResourceType.COLLECTION:
            from src.db.collections import Collection

            collection = self.db.exec(
                select(Collection).where(Collection.collection_uuid == resource_id)
            ).first()
            return collection.public if collection else False
        return False

    def _check_resource_permission(
        self,
        user_id: int,
        action: Action,
        resource: ResourceType,
        resource_id: str,
    ) -> bool:
        """
        Check for resource-level permission overrides.

        These are permissions granted to specific users for specific resources.
        """
        statement = (
            select(ResourcePermission)
            .join(Permission, Permission.id == ResourcePermission.permission_id)
            .where(
                ResourcePermission.user_id == user_id,
                ResourcePermission.resource_type == resource,
                ResourcePermission.resource_id == resource_id,
                Permission.action == action,
            )
        )

        # Filter out expired permissions
        statement = statement.where(
            (ResourcePermission.expires_at.is_(None))
            | (ResourcePermission.expires_at > datetime.now(UTC))  # type: ignore[union-attr]
        )

        result = self.db.exec(statement).first()
        return result is not None

    def _get_user_active_roles(
        self, user_id: int, org_id: int | None = None
    ) -> list[Role]:
        """
        Get all active (non-expired) roles for a user.

        Uses Redis cache for performance. Cache is invalidated when roles change.

        Args:
            user_id: User ID
            org_id: Optional organization filter

        Returns:
            List of active roles, sorted by priority (highest first)
        """
        # Try cache first
        if self.use_cache:
            cached = get_cached_user_roles(user_id, org_id)
            if cached is not None:
                # Fetch full role objects by IDs
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
        """
        Check if a user owns a resource.

        Ownership is determined by the ResourceAuthor table.
        A user owns a resource if they are CREATOR, MAINTAINER, or CONTRIBUTOR
        with ACTIVE status.
        """
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
        result = self.db.exec(statement).first()
        return result is not None

    def _check_user_assigned(self, user_id: int, resource_id: str) -> bool:
        """
        Check if a user is assigned to a resource through user groups.

        A user is assigned if:
        1. They belong to a user group (UserGroupUser)
        2. That user group is associated with the resource (UserGroupResource)
        """
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
        result = self.db.exec(statement).first()
        return result is not None

    def _check_role_permission(
        self,
        role: Role,
        action: Action,
        resource: ResourceType,
        is_owner: bool,
        org_id: int | None = None,
        context: dict | None = None,
        user_id: int | None = None,
        resource_id: str | None = None,
    ) -> bool:
        """
        Check if a role grants a specific permission.

        This includes checking the role's own permissions and
        all inherited permissions from parent roles.

        Uses batch query to avoid N+1 problem.
        """
        # Collect all role IDs in the hierarchy
        role_ids = self._get_role_hierarchy_ids(role.id)  # type: ignore[arg-type]

        if not role_ids:
            return False

        # Build scope context for evaluation
        scope_context = {
            "is_owner": is_owner,
            "request_org_id": org_id,
            "role_org_id": role.org_id,
            "user_id": user_id,
            "resource_id": resource_id,
        }

        # Batch query: get all permissions for all role IDs in a single query
        statement = (
            select(Permission, RolePermission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(
                RolePermission.role_id.in_(role_ids),
                Permission.resource_type == resource,
                Permission.action == action,
            )
        )

        results = self.db.exec(statement).all()

        for permission, role_permission in results:
            # Check scope with full context
            if self._scope_matches(permission.scope, scope_context):
                # Check ABAC conditions
                if self._conditions_match(role_permission.conditions, context):
                    return True

        return False

    def _get_role_hierarchy_ids(self, role_id: int) -> list[int]:
        """
        Get all role IDs in the hierarchy chain (role + all parents).

        Optimized to fetch all roles in hierarchy with a single recursive query.
        Limits traversal to MAX_ROLE_HIERARCHY_DEPTH to prevent
        performance issues from deeply nested hierarchies.
        """
        # Use recursive CTE for efficient hierarchy traversal in single query
        from sqlalchemy import text

        result = self.db.exec(
            text("""
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
            """),
            {"role_id": role_id, "max_depth": MAX_ROLE_HIERARCHY_DEPTH}
        )

        return [row[0] for row in result.fetchall()]

    def _scope_matches(self, scope: Scope, scope_context: dict) -> bool:
        """
        Check if a permission scope matches the current context.

        Args:
            scope: Permission scope
            scope_context: Dict containing:
                - is_owner: Whether the user owns the resource
                - request_org_id: Org ID from the request
                - role_org_id: Org ID from the user's role

        Returns:
            True if scope allows access
        """
        is_owner = scope_context.get("is_owner", False)
        request_org_id = scope_context.get("request_org_id")
        role_org_id = scope_context.get("role_org_id")

        match scope:
            case Scope.ALL:
                return True
            case Scope.OWN:
                return is_owner
            case Scope.ORG:
                # ORG scope: user's role org must match request org
                # Global roles (role_org_id is None) can access any org
                if role_org_id is None:
                    return True
                # If request_org_id is specified, it must match role_org_id
                if request_org_id is not None:
                    return role_org_id == request_org_id
                # If no request org, allow (backward compat)
                return True
            case Scope.ASSIGNED:
                # ASSIGNED scope: for resources explicitly assigned to user
                # through user groups
                user_id = scope_context.get("user_id")
                resource_id = scope_context.get("resource_id")

                if not user_id or not resource_id:
                    return False

                return self._check_user_assigned(user_id, resource_id)
            case _:
                return False

    def _conditions_match(self, conditions: dict | None, context: dict | None) -> bool:
        """
        Evaluate ABAC conditions with advanced operators.

        Supports condition types:
        - Simple equality: {"field": "value"}
        - Complex rules: {"type": "and|or|not", "rules": [...]}

        Rule operators:
        - ==, !=: Equality checks
        - >, >=, <, <=: Numeric comparisons
        - in, not_in: Membership checks
        - contains: String/list containment

        Args:
            conditions: Conditions from the role-permission assignment
            context: Current request context

        Returns:
            True if all conditions match (or no conditions defined)

        Example:
            conditions = {
                "type": "and",
                "rules": [
                    {"field": "time.hour", "operator": ">=", "value": 9},
                    {"field": "time.hour", "operator": "<", "value": 17},
                    {"field": "user.department", "operator": "==", "value": "engineering"}
                ]
            }
        """
        if not conditions:
            return True

        if not context:
            # If conditions exist but no context provided, deny
            return False

        # Check if this is a complex condition with rules
        if "type" in conditions and "rules" in conditions:
            return self._evaluate_complex_condition(conditions, context)

        # Simple ABAC: check if all condition keys match context values
        for key, expected in conditions.items():
            if key not in context:
                return False
            if context[key] != expected:
                return False

        return True

    def _evaluate_complex_condition(self, condition: dict, context: dict) -> bool:
        """
        Evaluate complex ABAC condition with logical operators.

        Args:
            condition: Condition with type and rules
            context: Request context

        Returns:
            True if condition matches
        """
        condition_type = condition.get("type", "and")
        rules = condition.get("rules", [])

        if not rules:
            return True

        if condition_type == "and":
            return all(self._evaluate_rule(rule, context) for rule in rules)
        elif condition_type == "or":
            return any(self._evaluate_rule(rule, context) for rule in rules)
        elif condition_type == "not":
            return not any(self._evaluate_rule(rule, context) for rule in rules)

        _logger.warning("Unknown condition type: %s", condition_type)
        return False

    def _evaluate_rule(self, rule: dict, context: dict) -> bool:
        """
        Evaluate a single ABAC rule.

        Args:
            rule: Rule with field, operator, and value
            context: Request context

        Returns:
            True if rule matches
        """
        field = rule.get("field")
        operator = rule.get("operator", "==")
        expected = rule.get("value")

        if not field:
            return False

        # Get actual value from context (supports nested fields with dot notation)
        actual = self._get_context_value(field, context)

        # Evaluate based on operator
        try:
            if operator == "==":
                return actual == expected
            elif operator == "!=":
                return actual != expected
            elif operator == ">":
                return actual > expected
            elif operator == ">=":
                return actual >= expected
            elif operator == "<":
                return actual < expected
            elif operator == "<=":
                return actual <= expected
            elif operator == "in":
                return actual in expected if isinstance(expected, (list, tuple, set)) else False
            elif operator == "not_in":
                return actual not in expected if isinstance(expected, (list, tuple, set)) else True
            elif operator == "contains":
                if isinstance(actual, str):
                    return expected in actual
                elif isinstance(actual, (list, tuple)):
                    return expected in actual
                return False
            else:
                _logger.warning("Unknown operator: %s", operator)
                return False
        except (TypeError, AttributeError) as e:
            _logger.warning("Error evaluating rule %s: %s", rule, e)
            return False

    def _get_context_value(self, field: str, context: dict) -> any:
        """
        Get value from context supporting dot notation for nested fields.

        Args:
            field: Field name (supports dot notation like "user.department")
            context: Context dictionary

        Returns:
            Field value or None if not found
        """
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

    def get_user_permissions(
        self,
        user_id: int,
        org_id: int | None = None,
    ) -> dict[str, bool]:
        """
        Get all effective permissions for a user.

        This is useful for the frontend to know what actions are allowed.

        Args:
            user_id: User ID
            org_id: Optional organization context

        Returns:
            Dictionary mapping permission names to boolean (allowed/denied)
        """
        permissions: dict[str, bool] = {}

        # Get all user's active roles
        roles = self._get_user_active_roles(user_id, org_id)

        for role in roles:
            role_ids = self._get_role_hierarchy_ids(role.id)  # type: ignore[arg-type]

            for role_id in role_ids:
                # Get all permissions for this role
                statement = (
                    select(Permission)
                    .join(RolePermission, RolePermission.permission_id == Permission.id)
                    .where(RolePermission.role_id == role_id)
                )
                role_permissions = self.db.exec(statement).all()

                for perm in role_permissions:
                    permissions[perm.name] = True

        return permissions
