"""
Consolidated Permission Service - Single entry point for all RBAC operations.

This service works exclusively with the new flattened RBAC schema:
- user_permissions: Direct user → permission mappings (denormalized)
- roles: Role metadata (name, slug, description)
- permissions: Permission definitions (resource, action, scope)

The old junction tables (user_roles, role_permissions) have been removed.
When a role is assigned, its permissions are expanded into user_permissions.

Design Philosophy:
- Single Source of Truth: user_permissions table
- Simple API: check(), assign_role(), get_permissions()
- Performance: 1 join instead of 3 (66% reduction)
- Security: Audit logging for compliance
"""

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select

from src.db.courses.courses import Course
from src.db.permissions.constants import (
    ADMIN_OR_MAINTAINER_SLUGS,
    INSTRUCTOR_OR_HIGHER_SLUGS,
)
from src.db.permissions.enums import Action, AuditAction, ResourceType, Scope
from src.db.permissions.models import (
    Permission,
    PermissionCreate,
    PermissionRead,
    Role,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    UserPermission,
    UserPermissionCreate,
)
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.services.cache.redis_client import get_redis_client
from src.services.permissions.audit_service import AuditService
from src.services.permissions.permission_cache import (
    get_cached_permission,
    invalidate_user_permissions,
    set_cached_permission,
)

if TYPE_CHECKING:
    pass

_logger = logging.getLogger(__name__)


# Simplified audit levels
class AuditLevel:
    """Audit logging levels for permission checks."""

    DISABLED = "disabled"
    SECURITY_EVENTS = "security_events"
    ALL = "all"


class PermissionService:
    """
    Consolidated permission service for all RBAC operations.

    This is the ONLY service you need for RBAC. It handles:
    - Permission checks: service.check(user, Action.UPDATE, ResourceType.COURSE, "course_123")
    - Role management: service.create_role(), service.assign_role()
    - Queries: service.get_user_permissions()
    """

    def __init__(
        self,
        db: Session,
        use_cache: bool = True,
        audit_level: str = AuditLevel.SECURITY_EVENTS,
    ) -> None:
        self.db = db
        self.use_cache = use_cache
        self.audit_level = audit_level
        self.audit_service = AuditService(db, redis=get_redis_client())

    # ============================================================================
    # PERMISSION CHECKS - Primary API
    # ============================================================================

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
        Check if a user has permission to perform an action.

        This is the primary permission check method. It queries user_permissions
        and evaluates ownership, scope, and resource-specific rules.

        Args:
            user: User to check (PublicUser, AnonymousUser, or InternalUser)
            action: Action to perform (CREATE, READ, UPDATE, DELETE, etc.)
            resource: Resource type (COURSE, USER, ORG, etc.)
            resource_id: Optional resource ID for resource-specific checks
            org_id: Optional organization context
            request: Optional request for additional context
            raise_on_deny: If True, raises HTTPException on denial

        Returns:
            bool: True if permitted, False if denied

        Raises:
            HTTPException: If raise_on_deny=True and permission denied
        """
        user_id = self._get_user_id(user)
        is_anonymous = self._is_anonymous(user)

        # Anonymous users can only read public resources
        if is_anonymous:
            if action == Action.READ and resource_id:
                is_public = self._is_resource_public(resource_id, resource)
                if is_public:
                    return True

            if raise_on_deny:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )
            return False

        # Check cache first
        if self.use_cache and resource_id:
            cached = get_cached_permission(
                user_id, action.value, resource.value, resource_id, org_id
            )
            if cached and cached.get("granted") is not None:
                return cached["granted"]

        # Internal service users have all permissions
        if self._is_internal_user(user):
            return True

        # Check ownership first (fast path)
        if resource_id and action in [Action.UPDATE, Action.DELETE]:
            if self._is_resource_owner(user_id, resource_id):
                self._cache_and_audit(
                    user_id, action, resource, resource_id, org_id, True, "owner"
                )
                return True

        # Query user_permissions table
        granted = self._check_user_permission(user_id, action, resource, org_id)

        # Cache result
        if self.use_cache and resource_id:
            # allowed must be the 4th positional param; include metadata in conditions
            set_cached_permission(
                user_id,
                action.value,
                resource.value,
                granted,
                resource_id=resource_id,
                org_id=org_id,
                conditions={"reason": "direct_permission" if granted else "no_permission"},
            )

        # Audit
        if self.audit_level != AuditLevel.DISABLED:
            should_audit = (
                self.audit_level == AuditLevel.ALL
                or (not granted and self.audit_level == AuditLevel.SECURITY_EVENTS)
            )
            if should_audit:
                self.audit_service.log(
                    user_id=user_id,
                    action=AuditAction.PERMISSION_CHECK,
                    resource_type=resource,
                    resource_id=resource_id,
                    result="granted" if granted else "denied",
                    org_id=org_id,
                )

        if not granted and raise_on_deny:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {resource.value}:{action.value}",
            )

        return granted

    def _check_user_permission(
        self,
        user_id: int,
        action: Action,
        resource: ResourceType,
        org_id: int | None = None,
    ) -> bool:
        """
        Check if user has permission in user_permissions table.

        This is the core permission lookup using the new flattened schema.
        """
        query = (
            select(UserPermission)
            .join(Permission, UserPermission.permission_id == Permission.id)
            .where(
                UserPermission.user_id == user_id,
                Permission.resource_type == resource,
                Permission.action == action,
            )
        )

        if org_id is not None:
            query = query.where(UserPermission.org_id == org_id)

        # Check for expired permissions
        query = query.where(
            (UserPermission.expires_at.is_(None))
            | (UserPermission.expires_at > datetime.now(UTC))
        )

        permission = self.db.exec(query).first()
        return permission is not None

    # ============================================================================
    # ROLE MANAGEMENT
    # ============================================================================

    def create_role(
        self,
        name: str,
        slug: str,
        description: str | None = None,
        org_id: int | None = None,
        is_system: bool = False,
    ) -> Role:
        """Create a new role."""
        # Check if role with same slug exists
        existing = self.db.exec(
            select(Role).where(Role.slug == slug, Role.org_id == org_id)
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with slug '{slug}' already exists",
            )

        role = Role(
            name=name,
            slug=slug,
            description=description,
            org_id=org_id,
            is_system=is_system,
            created_at=datetime.now(UTC),
        )

        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def assign_role(
        self,
        user_id: int,
        role_id: int,
        org_id: int,
        permission_ids: list[int] | None = None,
        granted_by: int | None = None,
        expires_at: datetime | None = None,
    ) -> dict:
        """
        Assign a role to a user by expanding permissions into user_permissions.

        Args:
            user_id: User to assign role to
            role_id: Role to assign
            org_id: Organization context
            permission_ids: List of permission IDs to grant (if None, grants all permissions)
            granted_by: User who granted this role
            expires_at: Optional expiration date

        Returns:
            Dict with assignment details and count of permissions added
        """
        # Validate role exists
        role = self.db.get(Role, role_id)
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role {role_id} not found",
            )

        # Get permissions to grant
        if permission_ids is None:
            # Grant all permissions (default behavior)
            all_permissions = self.db.exec(select(Permission)).all()
            permission_ids = [p.id for p in all_permissions]

        # Expand permissions into user_permissions
        permissions_added = 0
        for perm_id in permission_ids:
            # Check if already exists
            existing = self.db.exec(
                select(UserPermission).where(
                    UserPermission.user_id == user_id,
                    UserPermission.permission_id == perm_id,
                    UserPermission.org_id == org_id,
                )
            ).first()

            if not existing:
                # Get permission details for scope
                perm = self.db.get(Permission, perm_id)
                if perm:
                    user_perm = UserPermission(
                        user_id=user_id,
                        permission_id=perm_id,
                        org_id=org_id,
                        scope=perm.scope,
                        granted_via_role_id=role_id,
                        granted_at=datetime.now(UTC),
                        expires_at=expires_at,
                    )
                    self.db.add(user_perm)
                    permissions_added += 1

        self.db.commit()

        # Invalidate cache
        invalidate_user_permissions(user_id, org_id)

        _logger.info(
            f"Assigned role {role.name} ({role_id}) to user {user_id}: "
            f"{permissions_added} permissions granted"
        )

        return {
            "user_id": user_id,
            "role_id": role_id,
            "role_name": role.name,
            "org_id": org_id,
            "permissions_added": permissions_added,
            "granted_at": datetime.now(UTC).isoformat(),
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

    def remove_role(self, user_id: int, role_id: int, org_id: int) -> bool:
        """
        Remove a role from a user by deleting associated permissions.

        Returns:
            bool: True if permissions were removed, False if none found
        """
        # Delete all permissions granted via this role
        result = self.db.exec(
            select(UserPermission).where(
                UserPermission.user_id == user_id,
                UserPermission.granted_via_role_id == role_id,
                UserPermission.org_id == org_id,
            )
        )

        permissions_removed = 0
        for user_perm in result:
            self.db.delete(user_perm)
            permissions_removed += 1

        self.db.commit()

        if permissions_removed > 0:
            invalidate_user_permissions(user_id, org_id)
            _logger.info(
                f"Removed role {role_id} from user {user_id}: "
                f"{permissions_removed} permissions deleted"
            )

        return permissions_removed > 0

    def assign_permission_directly(
        self,
        user_id: int,
        permission_id: int,
        org_id: int,
        scope: Scope | None = None,
        granted_by: int | None = None,
        expires_at: datetime | None = None,
    ) -> UserPermission:
        """
        Assign a permission directly to a user (not via role).

        This creates a direct permission grant that isn't tied to any role.
        """
        perm = self.db.get(Permission, permission_id)
        if not perm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Permission {permission_id} not found",
            )

        # Check if already assigned
        existing = self.db.exec(
            select(UserPermission).where(
                UserPermission.user_id == user_id,
                UserPermission.permission_id == permission_id,
                UserPermission.org_id == org_id,
            )
        ).first()

        if existing:
            return existing

        user_perm = UserPermission(
            user_id=user_id,
            permission_id=permission_id,
            org_id=org_id,
            scope=scope or perm.scope,
            granted_via_role_id=None,  # Direct assignment
            granted_at=datetime.now(UTC),
            expires_at=expires_at,
        )
        self.db.add(user_perm)
        self.db.commit()
        self.db.refresh(user_perm)

        invalidate_user_permissions(user_id, org_id)
        return user_perm

    def get_user_roles(self, user_id: int, org_id: int | None = None) -> list[dict]:
        """
        Get all roles assigned to a user (from user_permissions).

        Returns:
            List of dicts with role info: {role_id, role_name, role_slug, org_id}
        """
        query = (
            select(UserPermission.granted_via_role_id, UserPermission.org_id)
            .where(
                UserPermission.user_id == user_id,
                UserPermission.granted_via_role_id.isnot(None),
            )
            .distinct()
        )

        if org_id is not None:
            query = query.where(UserPermission.org_id == org_id)

        results = self.db.exec(query).all()

        # Load role details safely (select only required columns)
        roles = []
        for role_id, perm_org_id in results:
            if role_id:
                row = self.db.exec(
                    select(Role.id, Role.name, Role.slug, Role.org_id).where(Role.id == role_id)
                ).first()
                if row:
                    # row is a RowMapping or tuple depending on SQLModel; support both
                    try:
                        r_id, r_name, r_slug, _r_org = row
                    except Exception:
                        r_id = row[0]
                        r_name = row[1]
                        r_slug = row[2]
                        r_org = row[3]

                    roles.append({
                        "role_id": r_id,
                        "role_name": r_name,
                        "role_slug": r_slug,
                        "org_id": perm_org_id,
                    })

        return roles

    # ============================================================================
    # PERMISSION MANAGEMENT
    # ============================================================================

    def create_permission(
        self,
        resource: ResourceType,
        action: Action,
        scope: Scope = Scope.ALL,
        description: str | None = None,
    ) -> Permission:
        """Create a new permission definition."""
        # Build permission name
        name = f"{resource.value}:{action.value}:{scope.value}"

        # Check if exists
        existing = self.db.exec(select(Permission).where(Permission.name == name)).first()
        if existing:
            return existing

        perm = Permission(
            name=name,
            resource_type=resource,
            action=action,
            scope=scope,
            description=description,
            created_at=datetime.now(UTC),
        )

        self.db.add(perm)
        self.db.commit()
        self.db.refresh(perm)
        return perm

    def list_permissions(
        self,
        resource_type: ResourceType | None = None,
    ) -> list[PermissionRead]:
        """List all permission definitions, optionally filtered by resource type."""
        query = select(Permission)

        if resource_type:
            query = query.where(Permission.resource_type == resource_type)

        permissions = self.db.exec(query).all()
        return [PermissionRead.model_validate(p) for p in permissions]

    def get_user_permissions(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        org_id: int | None = None,
    ) -> dict[str, bool]:
        """
        Get all effective permissions for a user.

        Returns:
            Dict mapping permission names to True: {"course:create:org": True, ...}
        """
        user_id = self._get_user_id(user)

        if self._is_anonymous(user):
            return {}

        if self._is_internal_user(user):
            # Internal users have all permissions
            all_perms = self.db.exec(select(Permission)).all()
            return {p.name: True for p in all_perms}

        # Query user_permissions
        query = (
            select(Permission)
            .join(UserPermission, UserPermission.permission_id == Permission.id)
            .where(UserPermission.user_id == user_id)
        )

        if org_id is not None:
            query = query.where(UserPermission.org_id == org_id)

        # Exclude expired permissions
        query = query.where(
            (UserPermission.expires_at.is_(None))
            | (UserPermission.expires_at > datetime.now(UTC))
        )

        permissions = self.db.exec(query).all()

        # Build permission dict
        perm_dict = {}
        for perm in permissions:
            perm_dict[perm.name] = True

            # Expand wildcards (e.g., "course:*:org" means all actions on courses)
            if perm.action == Action.MANAGE:
                # MANAGE grants all CRUD actions
                for action in [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE]:
                    wildcard_name = f"{perm.resource_type.value}:{action.value}:{perm.scope.value}"
                    perm_dict[wildcard_name] = True

        return perm_dict

    # ============================================================================
    # HELPER/UTILITY METHODS
    # ============================================================================

    def is_admin_or_maintainer(self, user_id: int) -> bool:
        """Check if user has admin or maintainer role."""
        roles = self.get_user_roles(user_id)
        return any(r["role_slug"] in ADMIN_OR_MAINTAINER_SLUGS for r in roles)

    def is_instructor_or_higher(self, user_id: int) -> bool:
        """Check if user has instructor or higher role."""
        roles = self.get_user_roles(user_id)
        return any(r["role_slug"] in INSTRUCTOR_OR_HIGHER_SLUGS for r in roles)

    # ============================================================================
    # PRIVATE METHODS
    # ============================================================================

    def _get_user_id(
        self, user: PublicUser | AnonymousUser | InternalUser | None
    ) -> int:
        """Extract user ID from user object."""
        return getattr(user, "id", 0)

    def _is_anonymous(
        self, user: PublicUser | AnonymousUser | InternalUser | None
    ) -> bool:
        """Check if user is anonymous."""
        if user is None:
            return True
        return isinstance(user, AnonymousUser) or getattr(user, "id", 0) == 0

    def _is_internal_user(
        self, user: PublicUser | AnonymousUser | InternalUser | None
    ) -> bool:
        """Check if user is an internal service user."""
        return isinstance(user, InternalUser)

    def _is_resource_owner(self, user_id: int, resource_id: str) -> bool:
        """Check if user owns the resource."""
        # Check resource_authors table
        author = self.db.exec(
            select(ResourceAuthor).where(
                ResourceAuthor.resource_uuid == resource_id,
                ResourceAuthor.author_id == user_id,
                ResourceAuthor.authorship_type == ResourceAuthorshipEnum.OWNER,
                ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
            )
        ).first()

        return author is not None

    def _is_resource_public(
        self, resource_id: str, resource_type: ResourceType
    ) -> bool:
        """Check if resource is publicly accessible."""
        if resource_type == ResourceType.COURSE:
            course = self.db.exec(
                select(Course).where(Course.course_uuid == resource_id)
            ).first()
            return course is not None and getattr(course, "is_public", False)

        # Default: not public
        return False

    def _cache_and_audit(
        self,
        user_id: int,
        action: Action,
        resource: ResourceType,
        resource_id: str | None,
        org_id: int | None,
        granted: bool,
        reason: str,
    ) -> None:
        """Cache result and audit if needed."""
        if self.use_cache and resource_id:
            set_cached_permission(
                user_id,
                action.value,
                resource.value,
                granted,
                resource_id=resource_id,
                org_id=org_id,
                conditions={"reason": reason},
            )

        if self.audit_level != AuditLevel.DISABLED:
            self.audit_service.log(
                user_id=user_id,
                action=AuditAction.PERMISSION_CHECK,
                resource_type=resource,
                resource_id=resource_id,
                result="granted" if granted else "denied",
                org_id=org_id,
            )

    # ============================================================================
    # ROLE SEEDING (for initial setup)
    # ============================================================================

    def seed_default_roles(self) -> list[Role]:
        """
        Seed default system roles.

        Creates: super-admin, org-admin, maintainer, instructor, moderator, user
        """
        default_roles = [
            {
                "name": "Super Admin",
                "slug": "super-admin",
                "description": "Full system access",
                "is_system": True,
            },
            {
                "name": "Organization Admin",
                "slug": "org-admin",
                "description": "Full organization access",
                "is_system": True,
            },
            {
                "name": "Maintainer",
                "slug": "maintainer",
                "description": "Content and user management",
                "is_system": True,
            },
            {
                "name": "Instructor",
                "slug": "instructor",
                "description": "Course creation and management",
                "is_system": True,
            },
            {
                "name": "Moderator",
                "slug": "moderator",
                "description": "Content moderation",
                "is_system": True,
            },
            {
                "name": "User",
                "slug": "user",
                "description": "Basic user access",
                "is_system": True,
            },
        ]

        created_roles = []
        for role_data in default_roles:
            # Check if exists
            existing = self.db.exec(
                select(Role).where(Role.slug == role_data["slug"], Role.org_id.is_(None))
            ).first()

            if not existing:
                role = Role(**role_data, created_at=datetime.now(UTC))
                self.db.add(role)
                created_roles.append(role)

        if created_roles:
            self.db.commit()
            for role in created_roles:
                self.db.refresh(role)

        return created_roles


# Global singleton
_service_instance: PermissionService | None = None


def get_permission_service(db: Session) -> PermissionService:
    """Get or create PermissionService instance."""
    global _service_instance
    if _service_instance is None or _service_instance.db != db:
        _service_instance = PermissionService(db)
    return _service_instance
