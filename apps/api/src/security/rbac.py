"""
RBAC — Permission Checker, Dependencies & Exceptions

This is the ONE file for all authorization logic.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session, or_, select

from src.core.events.database import get_db_session

logger = logging.getLogger(__name__)

# ============================================================================
# Scope hierarchy: own < assigned < org < all
# ============================================================================

_SCOPE_BROADER: dict[str, list[str]] = {
    "own": ["assigned", "org", "all"],
    "assigned": ["org", "all"],
    "org": ["all"],
}

# ============================================================================
# Exceptions
# ============================================================================


class PermissionDenied(HTTPException):
    """403 — user lacks required permission."""

    def __init__(
        self,
        permission: str | None = None,
        *,
        action: Any = None,
        resource_type: Any = None,
        resource_id: str | None = None,
        reason: str | None = None,
        org_id: int | None = None,
    ) -> None:
        # Accept both new style (permission=) and old style (action=, resource_type=)
        if permission:
            message = f"Permission denied: {permission}"
        elif action and resource_type:
            a = action.value if hasattr(action, "value") else str(action)
            r = (
                resource_type.value
                if hasattr(resource_type, "value")
                else str(resource_type)
            )
            message = f"Permission denied: {r}:{a}"
        else:
            message = "Permission denied"

        detail = {
            "error_code": "PERMISSION_DENIED",
            "message": message,
            "permission": permission,
            "reason": reason,
        }
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class AuthenticationRequired(HTTPException):
    """401 — must be logged in."""

    def __init__(self, reason: str | None = None, **kwargs: Any) -> None:
        detail = {
            "error_code": "AUTHENTICATION_REQUIRED",
            "message": reason or "Authentication required",
        }
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


# ============================================================================
# Permission Checker
# ============================================================================


class PermissionChecker:
    """
    Loads user's granted permission strings once per (user, org) pair,
    then checks in-memory with wildcard + scope-fallback matching.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self._cache: dict[tuple[int, int | None], set[str]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check(self, user_id: int, permission: str, org_id: int | None) -> bool:
        """Return True if user has the permission (including wildcards/scope broadening)."""
        granted = self._get_or_load(user_id, org_id)
        return self._matches(permission, granted)

    def require(self, user_id: int, permission: str, org_id: int | None) -> None:
        """check() + raise PermissionDenied when False."""
        if not self.check(user_id, permission, org_id):
            raise PermissionDenied(permission=permission)

    def check_many(
        self, user_id: int, permissions: list[str], org_id: int | None
    ) -> dict[str, bool]:
        """Batch check. Single load, N in-memory lookups."""
        granted = self._get_or_load(user_id, org_id)
        return {p: self._matches(p, granted) for p in permissions}

    def get_effective_permissions(self, user_id: int, org_id: int | None) -> set[str]:
        """Return the raw set of granted permission strings (for the frontend)."""
        return self._get_or_load(user_id, org_id)

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
        """Single JOIN query → set of permission name strings."""
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
    def _matches(required: str, granted: set[str]) -> bool:
        """
        Check if `required` permission is satisfied by any entry in `granted`.

        Handles:
        - Exact match
        - Wildcard patterns: resource:*:scope, *:action:scope, *:*:*, etc.
        - Scope broadening: own < assigned < org < all
        """
        if required in granted or "*:*:*" in granted:
            return True

        parts = required.split(":")
        if len(parts) != 3:
            return False

        resource, action, scope = parts

        # Wildcard patterns
        wildcard_patterns = [
            f"{resource}:*:{scope}",
            f"*:{action}:{scope}",
            f"{resource}:*:*",
            f"*:*:{scope}",
        ]
        if any(p in granted for p in wildcard_patterns):
            return True

        # Scope broadening: if user has course:update:all, they pass course:update:org
        for broader in _SCOPE_BROADER.get(scope, []):
            candidates = [
                f"{resource}:{action}:{broader}",
                f"{resource}:*:{broader}",
                f"*:{action}:{broader}",
                f"*:*:{broader}",
            ]
            if any(c in granted for c in candidates):
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


def require_permission(permission: str, *, org_id_param: str = "org_id"):
    """
    Declarative route-level dependency.

    Usage:
        @router.post("/courses", dependencies=[require_permission("course:create:org")])
    """

    async def _dependency(
        request: Request,
        checker: PermissionCheckerDep,
    ) -> None:
        from src.security.auth import get_current_user as _get_current_user

        # Resolve current user
        from fastapi_another_jwt_auth import AuthJWT

        authorize = AuthJWT(request)
        db = checker.db
        current_user = await _get_current_user(request, authorize, db)

        if not current_user or not hasattr(current_user, "id") or current_user.id == 0:
            raise AuthenticationRequired()

        # Resolve org_id from path params, query params, or body
        org_id_raw = request.path_params.get(org_id_param) or request.query_params.get(
            org_id_param
        )
        org_id = int(org_id_raw) if org_id_raw else None

        checker.require(current_user.id, permission, org_id)

    return Depends(_dependency)
