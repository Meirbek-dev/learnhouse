"""
RBAC Service - Core Permission Checking

This is the ONLY service for RBAC operations.

Design principles:
- Simple API: check(), require(), assign_role(), revoke_role()
- Fast: < 10ms per permission check (with cache < 1ms)
- Secure: Always logs denials, prevents bypasses
- Testable: Pure functions, dependency injection
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, status
from sqlmodel import Session, or_, select

if TYPE_CHECKING:
    from src.services.rbac.audit import AuditService
    from src.services.rbac.cache import CacheService

logger = logging.getLogger(__name__)


# ============================================================================
# Types & Enums
# ============================================================================


class CheckResult(Enum):
    """Result of permission check."""

    GRANTED = "granted"
    DENIED = "denied"
    ERROR = "error"


@dataclass
class PermissionCheck:
    """Result of permission check with context."""

    granted: bool
    reason: str
    checked_at: datetime
    cached: bool = False

    def raise_if_denied(self, detail: str | None = None) -> None:
        """Raise HTTP 403 if permission denied."""
        if not self.granted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail or self.reason,
            )


# ============================================================================
# RBAC Service
# ============================================================================


class RBACService:
    """
    Production-ready RBAC service.

    Usage:
        rbac = RBACService(db, cache, audit)

        # Check permission (returns PermissionCheck)
        result = rbac.check(
            user_id=123,
            action="update",
            resource="course",
            resource_id="course_uuid",
            org_id=1,
        )

        if result.granted:
            ...

        # Require permission (raises 403 on deny)
        rbac.require(user_id=123, action="update", resource="course", org_id=1)
    """

    def __init__(
        self,
        db: Session,
        cache: CacheService | None = None,
        audit: AuditService | None = None,
        *,
        cache_ttl: int = 300,  # 5 minutes
        audit_enabled: bool = True,
    ) -> None:
        self.db = db
        self.cache = cache
        self.audit = audit
        self.cache_ttl = cache_ttl
        self.audit_enabled = audit_enabled

    # ========================================================================
    # Permission Checks
    # ========================================================================

    def check_sync(
        self,
        user_id: int,
        action: str,
        resource: str,
        *,
        resource_id: str | None = None,
        org_id: int | None = None,
        request: Request | None = None,
        use_cache: bool = True,
    ) -> PermissionCheck:
        """Synchronous permission check for non-async contexts."""
        if hasattr(action, "value"):
            action = action.value
        if hasattr(resource, "value"):
            resource = resource.value

        action_str = str(action).lower() if action else ""
        resource_str = str(resource).lower() if resource else ""

        return self._check_sync(
            user_id=user_id,
            action=action_str,
            resource=resource_str,
            resource_id=resource_id,
            org_id=org_id,
            request=request,
            use_cache=use_cache,
        )

    def _check_sync(
        self,
        user_id: int,
        action: str,
        resource: str,
        *,
        resource_id: str | None = None,
        org_id: int | None = None,
        request: Request | None = None,
        use_cache: bool = True,
    ) -> PermissionCheck:
        """Internal sync permission check implementation."""
        # 1. Build permission name (e.g., "course:update:org")
        perm_name = self._build_permission_name(action, resource)

        # 2. Check cache first
        if use_cache and self.cache:
            cached_result = self.cache.get_permission(
                user_id, perm_name, org_id, resource_id
            )
            if cached_result is not None:
                return PermissionCheck(
                    granted=cached_result,
                    reason="cached" if cached_result else "cached_denial",
                    checked_at=datetime.now(UTC),
                    cached=True,
                )

        # 3. Query database
        granted, reason = self._check_db(user_id, perm_name, org_id, resource_id)

        # 4. Cache result
        if use_cache and self.cache:
            self.cache.set_permission(
                user_id,
                perm_name,
                org_id,
                resource_id,
                granted=granted,
                ttl=self.cache_ttl,
            )

        # 5. Audit if denied
        if self.audit_enabled and self.audit and (not granted):
            self.audit.log_permission_check(
                user_id=user_id,
                permission=perm_name,
                resource_id=resource_id,
                org_id=org_id,
                result=CheckResult.GRANTED if granted else CheckResult.DENIED,
                reason=reason,
                request=request,
            )

        return PermissionCheck(
            granted=granted,
            reason=reason,
            checked_at=datetime.now(UTC),
            cached=False,
        )

    def require(
        self,
        user_id: int,
        action: str,
        resource: str,
        *,
        resource_id: str | None = None,
        org_id: int | None = None,
        request: Request | None = None,
        detail: str | None = None,
    ) -> PermissionCheck:
        """
        Check permission and raise 403 if denied.

        Returns:
            PermissionCheck (only if granted)

        Raises:
            HTTPException 403 if permission denied
        """
        result = self.check_sync(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
            request=request,
        )
        result.raise_if_denied(detail)
        return result

    def _check_db(
        self,
        user_id: int,
        permission_name: str,
        org_id: int | None,
        resource_id: str | None,
    ) -> tuple[bool, str]:
        """
        Check permission in database.

        Returns:
            (granted: bool, reason: str)
        """
        from src.db.permissions.models_v2 import (
            Permission,
            Role,
            RolePermission,
            UserRole,
        )

        # Build query
        query = (
            select(Permission)
            .join(
                RolePermission,
                RolePermission.permission_id == Permission.id,
            )
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
            .where(Permission.name == permission_name)
        )

        # Add org context if provided
        if org_id is not None:
            query = query.where(
                or_(
                    UserRole.org_id == org_id,
                    Role.org_id.is_(None),  # Global roles
                )
            )

        # Execute query
        try:
            result = self.db.exec(query).first()
        except Exception as e:
            logger.exception(f"Permission check query failed: {e}")
            return False, f"db_error:{e!s}"

        # Check result
        if result is None:
            return False, f"no_role_with_permission:{permission_name}"

        # Check expiration
        user_role_query = (
            select(UserRole)
            .join(RolePermission, RolePermission.role_id == UserRole.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(UserRole.user_id == user_id)
            .where(Permission.name == permission_name)
        )

        if org_id is not None:
            user_role_query = user_role_query.where(UserRole.org_id == org_id)

        user_role = self.db.exec(user_role_query).first()

        # Check expiration (handle None and datetime types)
        if user_role:
            expires_at = getattr(user_role, "expires_at", None)
            if expires_at is not None and isinstance(expires_at, datetime):
                if expires_at < datetime.now(UTC):
                    return False, "role_expired"

        return True, "role_permission_granted"

    # ========================================================================
    # Batch Operations (for performance)
    # ========================================================================

    def check_many(
        self,
        user_id: int,
        checks: list[
            tuple[str, str, str | None]
        ],  # [(action, resource, resource_id), ...]
        *,
        org_id: int | None = None,
    ) -> dict[str, bool]:
        """
        Batch check multiple permissions.

        Args:
            user_id: User ID
            checks: List of (action, resource, resource_id) tuples
            org_id: Organization context

        Returns:
            Dict mapping permission_name -> granted (bool)
        """
        results = {}

        for action, resource, resource_id in checks:
            perm_name = self._build_permission_name(action, resource)
            result = self.check_sync(
                user_id=user_id,
                action=action,
                resource=resource,
                resource_id=resource_id,
                org_id=org_id,
            )
            results[perm_name] = result.granted

        return results

    # ========================================================================
    # Role Management
    # ========================================================================

    def assign_role(
        self,
        user_id: int,
        role_slug: str,
        org_id: int,
        *,
        assigned_by: int | None = None,
        expires_at: datetime | None = None,
    ) -> None:
        """
        Assign role to user.

        Raises:
            HTTPException 404: Role not found
            HTTPException 409: Role already assigned
        """
        from src.db.permissions.models_v2 import Role, UserRole

        # Get role
        role = self.db.exec(
            select(Role)
            .where(Role.slug == role_slug)
            .where(or_(Role.org_id == org_id, Role.org_id.is_(None)))
        ).first()

        if not role:
            raise HTTPException(status_code=404, detail=f"Role not found: {role_slug}")

        # Check if already assigned
        existing = self.db.exec(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .where(UserRole.role_id == role.id)
            .where(UserRole.org_id == org_id)
        ).first()

        if existing:
            raise HTTPException(
                status_code=409, detail=f"Role already assigned: {role_slug}"
            )

        # Assign role
        user_role = UserRole(
            user_id=user_id,
            role_id=role.id,
            org_id=org_id,
            assigned_by_user_id=assigned_by,
            expires_at=expires_at,
        )
        self.db.add(user_role)
        self.db.commit()

        # Invalidate cache
        if self.cache:
            self.cache.invalidate_user(user_id, org_id)

        # Audit
        if self.audit_enabled and self.audit:
            self.audit.log_role_assignment(
                user_id=user_id,
                role_slug=role_slug,
                org_id=org_id,
                assigned_by=assigned_by,
            )

    def revoke_role(
        self,
        user_id: int,
        role_slug: str,
        org_id: int,
        *,
        revoked_by: int | None = None,
    ) -> None:
        """Revoke role from user."""
        from src.db.permissions.models_v2 import Role, UserRole

        # Get role
        role = self.db.exec(
            select(Role)
            .where(Role.slug == role_slug)
            .where(or_(Role.org_id == org_id, Role.org_id.is_(None)))
        ).first()

        if not role:
            raise HTTPException(status_code=404, detail=f"Role not found: {role_slug}")

        # Find assignment
        user_role = self.db.exec(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .where(UserRole.role_id == role.id)
            .where(UserRole.org_id == org_id)
        ).first()

        if not user_role:
            raise HTTPException(
                status_code=404, detail=f"Role not assigned: {role_slug}"
            )

        # Revoke role
        self.db.delete(user_role)
        self.db.commit()

        # Invalidate cache
        if self.cache:
            self.cache.invalidate_user(user_id, org_id)

        # Audit
        if self.audit_enabled and self.audit:
            self.audit.log_role_revocation(
                user_id=user_id,
                role_slug=role_slug,
                org_id=org_id,
                revoked_by=revoked_by,
            )

    # ========================================================================
    # Utility Methods
    # ========================================================================

    def get_user_roles(self, user_id: int, org_id: int | None = None) -> list[dict]:
        """Get all roles for user in organization."""
        from src.db.permissions.models_v2 import Role, UserRole

        query = (
            select(Role, UserRole)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )

        if org_id is not None:
            query = query.where(UserRole.org_id == org_id)

        results = self.db.exec(query).all()

        return [
            {
                "id": role.id,
                "slug": role.slug,
                "name": role.name,
                "description": role.description,
                "org_id": user_role.org_id,
                "expires_at": user_role.expires_at.isoformat()
                if user_role.expires_at
                else None,
            }
            for role, user_role in results
        ]

    def get_user_permissions(
        self, user_id: int, org_id: int | None = None
    ) -> list[dict]:
        """Get all permissions for user (flattened from roles)."""
        from src.db.permissions.models_v2 import (
            Permission,
            Role,
            RolePermission,
            UserRole,
        )

        query = (
            select(Permission)
            .join(
                RolePermission,
                RolePermission.permission_id == Permission.id,
            )
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
            .distinct()
        )

        if org_id is not None:
            query = query.where(UserRole.org_id == org_id)

        results = self.db.exec(query).all()

        return [
            {
                "id": perm.id,
                "name": perm.name,
                "resource_type": perm.resource_type,
                "action": perm.action,
                "scope": perm.scope,
                "description": perm.description,
            }
            for perm in results
        ]

    def _build_permission_name(
        self, action: str, resource: str, scope: str = "org"
    ) -> str:
        """Build permission name from components."""
        return f"{resource}:{action}:{scope}"

    # ========================================================================
    # Admin Methods (for role/permission management UI)
    # ========================================================================

    def create_role(
        self,
        slug: str,
        name: str,
        org_id: int | None = None,
        description: str | None = None,
        permissions: list[str] | None = None,
        created_by: int | None = None,
    ) -> dict:
        """Create new role with optional permissions."""
        from src.db.permissions.models_v2 import (
            Permission,
            Role,
            RolePermission,
        )

        # Check if role already exists
        existing = self.db.exec(
            select(Role)
            .where(Role.slug == slug)
            .where(
                or_(
                    Role.org_id == org_id,
                    Role.org_id.is_(None) if org_id is None else False,
                )
            )
        ).first()

        if existing:
            raise HTTPException(status_code=409, detail=f"Role already exists: {slug}")

        # Create role
        role = Role(
            slug=slug,
            name=name,
            description=description,
            org_id=org_id,
            is_system=False,
        )
        self.db.add(role)
        self.db.flush()  # Get role ID

        # Add permissions if provided
        if permissions:
            for perm_name in permissions:
                perm = self.db.exec(
                    select(Permission).where(Permission.name == perm_name)
                ).first()

                if perm:
                    role_perm = RolePermission(
                        role_id=role.id,
                        permission_id=perm.id,
                        granted_by_user_id=created_by,
                    )
                    self.db.add(role_perm)

        self.db.commit()
        self.db.refresh(role)

        # Audit
        if self.audit_enabled and self.audit:
            self.audit.log_role_creation(
                role_slug=slug,
                org_id=org_id,
                created_by=created_by,
            )

        return {
            "id": role.id,
            "slug": role.slug,
            "name": role.name,
            "description": role.description,
            "org_id": role.org_id,
        }

    def add_permission_to_role(
        self,
        role_slug: str,
        permission_name: str,
        org_id: int | None = None,
        granted_by: int | None = None,
    ) -> None:
        """Add permission to role."""
        from src.db.permissions.models_v2 import (
            Permission,
            Role,
            RolePermission,
        )

        # Get role
        role = self.db.exec(
            select(Role)
            .where(Role.slug == role_slug)
            .where(or_(Role.org_id == org_id, Role.org_id.is_(None)))
        ).first()

        if not role:
            raise HTTPException(status_code=404, detail=f"Role not found: {role_slug}")

        # Get permission
        perm = self.db.exec(
            select(Permission).where(Permission.name == permission_name)
        ).first()

        if not perm:
            raise HTTPException(
                status_code=404, detail=f"Permission not found: {permission_name}"
            )

        # Check if already assigned
        existing = self.db.exec(
            select(RolePermission)
            .where(RolePermission.role_id == role.id)
            .where(RolePermission.permission_id == perm.id)
        ).first()

        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Permission already assigned to role: {permission_name}",
            )

        # Add permission
        role_perm = RolePermission(
            role_id=role.id,
            permission_id=perm.id,
            granted_by_user_id=granted_by,
        )
        self.db.add(role_perm)
        self.db.commit()

        # Invalidate cache for all users with this role
        if self.cache:
            self.cache.invalidate_role(role.id)
