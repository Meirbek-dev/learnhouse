"""
RBAC — Permission Checker, Dependencies & Exceptions

This is the ONE file for all authorization logic.

Permission format: "resource:action" (2-part, no scope).
Scope is resolved from context (org membership, ownership, assignment).
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlmodel import Session, or_, select

from src.core.events.database import get_db_session

logger = logging.getLogger(__name__)

# ============================================================================
# Exceptions
# ============================================================================


class PermissionDenied(HTTPException):
    """403 — user lacks required RBAC permission."""

    def __init__(
        self,
        permission: str | None = None,
        *,
        reason: str | None = None,
    ) -> None:
        message = (
            f"Permission denied: {permission}" if permission else "Permission denied"
        )
        detail = {
            "error_code": "PERMISSION_DENIED",
            "message": message,
            "permission": permission,
            "reason": reason,
        }
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class AuthenticationRequired(HTTPException):
    """401 — must be logged in."""

    def __init__(self, reason: str | None = None) -> None:
        detail = {
            "error_code": "AUTHENTICATION_REQUIRED",
            "message": reason or "Authentication required",
        }
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class FeatureDisabled(HTTPException):
    """403 — feature is disabled (not an RBAC denial)."""

    def __init__(self, reason: str | None = None) -> None:
        detail = {
            "error_code": "FEATURE_DISABLED",
            "message": reason or "Feature is disabled",
        }
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ResourceAccessDenied(HTTPException):
    """403 — access denied for a non-RBAC reason (e.g., attempt limit, wrong user)."""

    def __init__(self, reason: str | None = None) -> None:
        detail = {
            "error_code": "ACCESS_DENIED",
            "message": reason or "Access denied",
        }
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class InternalAuthFailed(HTTPException):
    """401 — internal/service authentication failed."""

    def __init__(self, reason: str | None = None) -> None:
        detail = {
            "error_code": "AUTHENTICATION_FAILED",
            "message": reason or "Authentication failed",
        }
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


# ============================================================================
# Permission Checker
# ============================================================================


class PermissionChecker:
    """
    Loads user's granted permission strings once per (user, org) pair,
    then resolves scope from context.

    Permission format in DB: "resource:action:scope" (3-part).
    Callers pass "resource:action" (2-part) + context (org_id, resource_owner_id).
    The checker determines which scope applies.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self._cache: dict[tuple[int, int | None], set[str]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check(
        self,
        user_id: int,
        permission: str,
        org_id: int | None,
        *,
        resource_owner_id: int | None = None,
    ) -> bool:
        """Return True if user has the permission.

        Args:
            user_id: The user to check.
            permission: "resource:action" (2-part). Scope is resolved from context.
            org_id: Organization context. Required for org-scoped checks.
            resource_owner_id: The creator/owner of the resource. Enables "own" scope.
        """
        granted = self._get_or_load(user_id, org_id)
        return self._resolve(permission, granted, user_id, resource_owner_id)

    def require(
        self,
        user_id: int,
        permission: str,
        org_id: int | None,
        *,
        resource_owner_id: int | None = None,
    ) -> None:
        """check() + raise PermissionDenied when False."""
        if not self.check(
            user_id, permission, org_id, resource_owner_id=resource_owner_id
        ):
            raise PermissionDenied(permission=permission)

    def check_many(
        self, user_id: int, permissions: list[str], org_id: int | None
    ) -> dict[str, bool]:
        """Batch check. Returns dict of permission -> granted.

        Checks if user has the permission at ANY scope. Used by frontend
        for UI state ("can this user do X at all?").
        """
        granted = self._get_or_load(user_id, org_id)
        results = {}
        for p in permissions:
            parts = p.split(":")
            if len(parts) != 2:
                results[p] = False
                continue
            resource, action = parts
            results[p] = any(
                self._has_perm(granted, resource, action, scope)
                for scope in ("all", "org", "assigned", "own")
            )
        return results

    def get_effective_permissions(self, user_id: int, org_id: int | None) -> set[str]:
        """Return the raw set of granted permission strings (3-part)."""
        return self._get_or_load(user_id, org_id)

    def get_expanded_permissions(self, user_id: int, org_id: int | None) -> set[str]:
        """Return permissions with wildcards expanded to explicit strings.

        The frontend does exact Set.has() lookups, so wildcards like ``*:*:*``
        or ``course:*:org`` must be expanded into every concrete
        ``resource:action:scope`` combination they cover.
        """
        from src.db.permission_enums import Action, ResourceType, Scope

        raw = self._get_or_load(user_id, org_id)
        expanded: set[str] = set()

        all_resources = [r.value for r in ResourceType]
        all_actions = [a.value for a in Action]
        all_scopes = [s.value for s in Scope]

        for perm_str in raw:
            parts = perm_str.split(":")
            if len(parts) != 3:
                expanded.add(perm_str)
                continue

            res, act, scp = parts

            resources = all_resources if res == "*" else [res]
            actions = all_actions if act == "*" else [act]
            scopes = all_scopes if scp == "*" else [scp]

            for r in resources:
                for a in actions:
                    for s in scopes:
                        expanded.add(f"{r}:{a}:{s}")

        return expanded

    def get_user_roles(self, user_id: int, org_id: int | None) -> list[dict]:
        """Return role dicts for user in org."""
        from src.db.permissions import Role, UserRole

        query = (
            select(Role, UserRole)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
        if org_id is not None:
            query = query.where(or_(UserRole.org_id == org_id, Role.org_id.is_(None)))
        results = self.db.exec(query).all()
        return [
            {
                "id": role.id,
                "slug": role.slug,
                "name": role.name,
                "description": role.description,
                "is_system": role.is_system,
                "priority": role.priority,
                "org_id": user_role.org_id,
                "created_at": role.created_at,
                "updated_at": role.updated_at,
            }
            for role, user_role in results
        ]

    # ------------------------------------------------------------------
    # Role management
    # ------------------------------------------------------------------

    def assign_role(
        self,
        user_id: int,
        role_slug: str,
        org_id: int,
        *,
        assigned_by: int | None = None,
    ) -> None:
        from src.db.permissions import Role, UserRole

        role = self.db.exec(
            select(Role)
            .where(Role.slug == role_slug)
            .where(or_(Role.org_id == org_id, Role.org_id.is_(None)))
        ).first()
        if not role:
            raise HTTPException(404, detail=f"Role not found: {role_slug}")

        # Escalation prevention: assigner cannot grant a role with higher
        # priority than their own highest role in this org.
        if assigned_by is not None:
            assigner_roles = self.get_user_roles(assigned_by, org_id)
            assigner_max_priority = max(
                (r["priority"] for r in assigner_roles), default=0
            )
            if role.priority > assigner_max_priority:
                raise PermissionDenied(
                    permission="role:create",
                    reason="Cannot assign a role with higher priority than your own",
                )

        existing = self.db.exec(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .where(UserRole.role_id == role.id)
            .where(UserRole.org_id == org_id)
        ).first()
        if existing:
            return  # idempotent

        self.db.add(
            UserRole(
                user_id=user_id,
                role_id=role.id,
                org_id=org_id,
                assigned_by=assigned_by,
            )
        )
        self.db.commit()
        self._cache.pop((user_id, org_id), None)

    def revoke_role(
        self,
        user_id: int,
        role_slug: str,
        org_id: int,
    ) -> None:
        from src.db.permissions import Role, UserRole

        role = self.db.exec(
            select(Role)
            .where(Role.slug == role_slug)
            .where(or_(Role.org_id == org_id, Role.org_id.is_(None)))
        ).first()
        if not role:
            raise HTTPException(404, detail=f"Role not found: {role_slug}")

        user_role = self.db.exec(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .where(UserRole.role_id == role.id)
            .where(UserRole.org_id == org_id)
        ).first()
        if not user_role:
            raise HTTPException(404, detail=f"Role not assigned: {role_slug}")

        self.db.delete(user_role)
        self.db.commit()
        self._cache.pop((user_id, org_id), None)

    # ------------------------------------------------------------------
    # Seeding
    # ------------------------------------------------------------------

    def seed_default_roles(self) -> list[str]:
        """Create system roles & permissions from SYSTEM_ROLES. Idempotent."""
        from src.db.permissions import Permission, Role, RolePermission
        from src.db.permission_enums import SYSTEM_ROLES

        created: list[str] = []

        for slug, role_def in SYSTEM_ROLES.items():
            # Upsert role
            role = self.db.exec(
                select(Role).where(Role.slug == slug).where(Role.org_id.is_(None))
            ).first()
            if not role:
                role = Role(
                    slug=slug,
                    name=role_def["name"],
                    description=role_def["description"],
                    is_system=True,
                    priority=role_def["priority"],
                    org_id=None,
                )
                self.db.add(role)
                self.db.flush()
                created.append(slug)

            # Upsert permissions for this role
            for perm_str in role_def["permissions"]:
                parts = perm_str.split(":")
                if len(parts) != 3:
                    continue
                resource, action, scope = parts

                perm = self.db.exec(
                    select(Permission).where(Permission.name == perm_str)
                ).first()
                if not perm:
                    perm = Permission(
                        name=perm_str,
                        resource_type=resource,
                        action=action,
                        scope=scope,
                    )
                    self.db.add(perm)
                    self.db.flush()

                existing_rp = self.db.exec(
                    select(RolePermission)
                    .where(RolePermission.role_id == role.id)
                    .where(RolePermission.permission_id == perm.id)
                ).first()
                if not existing_rp:
                    self.db.add(RolePermission(role_id=role.id, permission_id=perm.id))

        self.db.commit()
        return created

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_or_load(self, user_id: int, org_id: int | None) -> set[str]:
        key = (user_id, org_id)
        if key not in self._cache:
            self._cache[key] = self._load_permissions(user_id, org_id)
        return self._cache[key]

    def _load_permissions(self, user_id: int, org_id: int | None) -> set[str]:
        """Single JOIN query -> set of permission name strings (3-part)."""
        from src.db.permissions import Permission, Role, RolePermission, UserRole

        query = (
            select(Permission.name)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
            .distinct()
        )
        if org_id is not None:
            query = query.where(or_(UserRole.org_id == org_id, Role.org_id.is_(None)))

        return set(self.db.exec(query).all())

    @staticmethod
    def _has_perm(granted: set[str], resource: str, action: str, scope: str) -> bool:
        """Check if granted set contains a permission matching resource:action:scope.

        Handles wildcard patterns: resource:*:scope, *:action:scope, *:*:*, etc.
        """
        candidates = [
            f"{resource}:{action}:{scope}",
            f"{resource}:*:{scope}",
            f"*:{action}:{scope}",
            f"*:*:{scope}",
            f"{resource}:*:*",
            "*:*:*",
        ]
        return any(c in granted for c in candidates)

    @staticmethod
    def _resolve(
        permission: str,
        granted: set[str],
        user_id: int,
        resource_owner_id: int | None,
    ) -> bool:
        """Resolve whether a 2-part permission is satisfied by the granted set.

        Checks scopes from broadest to narrowest:
        1. all      — always passes
        2. org      — passes (org membership implied by loaded permissions)
        3. assigned — passes (service layer filters to assigned resources)
        4. own      — passes if resource_owner_id == user_id
        """
        parts = permission.split(":")
        if len(parts) != 2:
            return False

        resource, action = parts

        # 1. "all" scope
        if PermissionChecker._has_perm(granted, resource, action, "all"):
            return True

        # 2. "org" scope
        if PermissionChecker._has_perm(granted, resource, action, "org"):
            return True

        # 3. "assigned" scope — the service layer is responsible for
        #    filtering to only assigned resources.
        if PermissionChecker._has_perm(granted, resource, action, "assigned"):
            return True

        # 4. "own" scope — user owns the resource
        if resource_owner_id is not None and resource_owner_id == user_id:
            if PermissionChecker._has_perm(granted, resource, action, "own"):
                return True

        return False


# ============================================================================
# FastAPI Dependencies
# ============================================================================


def get_permission_checker(
    db: Session = Depends(get_db_session),
) -> PermissionChecker:
    """FastAPI dependency returning a PermissionChecker for this request."""
    return PermissionChecker(db)


PermissionCheckerDep = Annotated[PermissionChecker, Depends(get_permission_checker)]
