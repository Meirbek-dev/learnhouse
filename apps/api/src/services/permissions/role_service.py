"""
Role service for managing roles and role-permission assignments.

This service handles CRUD operations for roles, role hierarchy,
and permission assignments to roles.
"""

from datetime import datetime, UTC

from sqlmodel import Session, select

from src.db.permissions.constants import RoleSlug
from src.db.permissions.enums import Action, ResourceType, Scope
from src.db.permissions.models import (
    Permission,
    Role,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    RolePermission,
    RolePermissionCreate,
    RoleWithPermissions,
    UserRole,
    UserRoleCreate,
    UserRoleRead,
)
from src.services.permissions.permission_cache import (
    invalidate_role_permissions,
    invalidate_user_permissions,
)
from src.services.permissions.permission_service import PermissionService


class RoleService:
    """Service for managing roles and their permissions."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.permission_service = PermissionService(db)

    # -----------------------------------------------------------------------
    # Role CRUD
    # -----------------------------------------------------------------------

    def get_by_id(self, role_id: int) -> Role | None:
        """Get a role by ID."""
        return self.db.get(Role, role_id)

    def get_by_slug(self, slug: str, org_id: int | None = None) -> Role | None:
        """
        Get a role by slug and optional org_id.

        Args:
            slug: Role slug (e.g., 'instructor')
            org_id: Organization ID (None for global roles)

        Returns:
            Role if found, None otherwise
        """
        statement = select(Role).where(Role.slug == slug)
        if org_id is not None:
            statement = statement.where(Role.org_id == org_id)
        else:
            statement = statement.where(Role.org_id.is_(None))  # type: ignore[union-attr]
        return self.db.exec(statement).first()

    def list_all(
        self, org_id: int | None = None, include_global: bool = True
    ) -> list[RoleRead]:
        """
        List all roles, optionally filtered by organization.

        Args:
            org_id: Optional organization ID filter
            include_global: Whether to include global (system) roles

        Returns:
            List of roles
        """
        statement = select(Role)

        if org_id is not None:
            if include_global:
                statement = statement.where(
                    (Role.org_id == org_id) | (Role.org_id.is_(None))
                )  # type: ignore[union-attr]
            else:
                statement = statement.where(Role.org_id == org_id)
        elif not include_global:
            # Only global roles
            statement = statement.where(Role.org_id.is_(None))  # type: ignore[union-attr]

        statement = statement.order_by(Role.priority.desc(), Role.name)
        results = self.db.exec(statement).all()
        return [RoleRead.model_validate(r) for r in results]

    def create(self, data: RoleCreate, created_by: int | None = None) -> Role:
        """
        Create a new role.

        Args:
            data: Role creation data
            created_by: User ID who creates this role

        Returns:
            The created Role

        Raises:
            ValueError: If a role with this slug already exists in the org
        """
        existing = self.get_by_slug(data.slug, data.org_id)
        if existing:
            msg = f"Role '{data.slug}' already exists in this organization"
            raise ValueError(msg)

        role = Role(
            name=data.name,
            slug=data.slug,
            description=data.description,
            org_id=data.org_id,
            parent_role_id=data.parent_role_id,
            is_system=data.is_system,
            priority=data.priority,
        )
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def update(self, role_id: int, data: RoleUpdate) -> Role | None:
        """
        Update a role.

        Args:
            role_id: ID of the role to update
            data: Update data

        Returns:
            Updated role or None if not found

        Raises:
            ValueError: If trying to update a system role's slug
        """
        role = self.get_by_id(role_id)
        if not role:
            return None

        if role.is_system and data.name is not None:
            # System roles can update name but slug is fixed
            pass

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(role, field, value)

        role.updated_at = datetime.now(UTC)
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def delete(self, role_id: int) -> bool:
        """
        Delete a role.

        Args:
            role_id: ID of the role to delete

        Returns:
            True if deleted, False if not found

        Raises:
            ValueError: If trying to delete a system role
        """
        role = self.get_by_id(role_id)
        if not role:
            return False

        if role.is_system:
            msg = "Cannot delete system roles"
            raise ValueError(msg)

        self.db.delete(role)
        self.db.commit()
        return True

    # -----------------------------------------------------------------------
    # Role Hierarchy
    # -----------------------------------------------------------------------

    def get_role_with_parents(self, role_id: int) -> list[Role]:
        """
        Get a role and all its parent roles (inheritance chain).

        Args:
            role_id: Role ID

        Returns:
            List of roles from the given role up to the root parent
        """
        roles = []
        current_id: int | None = role_id
        visited = set()  # Prevent infinite loops

        while current_id is not None and current_id not in visited:
            visited.add(current_id)
            role = self.get_by_id(current_id)
            if role:
                roles.append(role)
                current_id = role.parent_role_id
            else:
                break

        return roles

    def get_all_inherited_permissions(self, role_id: int) -> list[Permission]:
        """
        Get all permissions for a role including inherited ones.

        Args:
            role_id: Role ID

        Returns:
            List of unique permissions from the role and all parents
        """
        roles = self.get_role_with_parents(role_id)
        permission_ids = set()
        permissions = []

        for role in roles:
            role_perms = self._get_role_permissions(role.id)  # type: ignore[arg-type]
            for perm in role_perms:
                if perm.id not in permission_ids:
                    permission_ids.add(perm.id)
                    permissions.append(perm)

        return permissions

    # -----------------------------------------------------------------------
    # Role-Permission Management
    # -----------------------------------------------------------------------

    def _get_role_permissions(self, role_id: int) -> list[Permission]:
        """Get permissions directly assigned to a role (no inheritance)."""
        statement = (
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        )
        return list(self.db.exec(statement).all())

    def get_role_with_permissions(self, role_id: int) -> RoleWithPermissions | None:
        """
        Get a role with all its permissions (including inherited).

        Args:
            role_id: Role ID

        Returns:
            Role with permissions or None if not found
        """
        role = self.get_by_id(role_id)
        if not role:
            return None

        permissions = self.get_all_inherited_permissions(role_id)

        return RoleWithPermissions(
            **role.model_dump(),
            permissions=[p.model_dump() for p in permissions],  # type: ignore[misc]
        )

    def add_permission_to_role(
        self,
        role_id: int,
        permission_id: int,
        granted_by: int | None = None,
        conditions: dict | None = None,
    ) -> RolePermission:
        """
        Add a permission to a role.

        Args:
            role_id: Role ID
            permission_id: Permission ID
            granted_by: User ID who grants this permission
            conditions: Optional ABAC conditions

        Returns:
            The created RolePermission

        Raises:
            ValueError: If permission is already assigned
        """
        # Check if already exists
        statement = select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
        existing = self.db.exec(statement).first()
        if existing:
            msg = "Permission already assigned to role"
            raise ValueError(msg)

        rp = RolePermission(
            role_id=role_id,
            permission_id=permission_id,
            granted_by=granted_by,
            conditions=conditions,
        )
        self.db.add(rp)
        self.db.commit()

        # Invalidate role's permission cache
        invalidate_role_permissions(role_id)

        return rp

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> bool:
        """
        Remove a permission from a role.

        Args:
            role_id: Role ID
            permission_id: Permission ID

        Returns:
            True if removed, False if not found
        """
        statement = select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
        rp = self.db.exec(statement).first()
        if not rp:
            return False

        self.db.delete(rp)
        self.db.commit()

        # Invalidate role's permission cache
        invalidate_role_permissions(role_id)

        return True

    def add_permissions_by_pattern(
        self,
        role_id: int,
        pattern: str,
        granted_by: int | None = None,
    ) -> list[RolePermission]:
        """
        Add multiple permissions to a role using a pattern.

        Pattern format:
        - "resource:action:scope" - specific permission
        - "resource:*:scope" - all actions on resource with scope
        - "*:*:*" - all permissions (super admin)

        Args:
            role_id: Role ID
            pattern: Permission pattern
            granted_by: User ID who grants these permissions

        Returns:
            List of created RolePermission entries
        """
        parts = pattern.split(":")
        if len(parts) != 3:
            msg = f"Invalid permission pattern: {pattern}"
            raise ValueError(msg)

        resource_pat, action_pat, scope_pat = parts
        created = []

        # Get all permissions matching the pattern
        statement = select(Permission)

        if resource_pat != "*":
            statement = statement.where(Permission.resource_type == resource_pat)
        if action_pat != "*":
            statement = statement.where(Permission.action == action_pat)
        if scope_pat != "*":
            statement = statement.where(Permission.scope == scope_pat)

        permissions = self.db.exec(statement).all()

        for perm in permissions:
            try:
                rp = self.add_permission_to_role(role_id, perm.id, granted_by)  # type: ignore[arg-type]
                created.append(rp)
            except ValueError:
                # Permission already assigned, skip
                pass

        return created

    # -----------------------------------------------------------------------
    # User-Role Management
    # -----------------------------------------------------------------------

    def assign_role_to_user(
        self,
        user_id: int,
        role_id: int,
        org_id: int,
        granted_by: int | None = None,
        expires_at: datetime | None = None,
    ) -> UserRole:
        """
        Assign a role to a user in an organization.

        Args:
            user_id: User ID
            role_id: Role ID
            org_id: Organization ID
            granted_by: User ID who grants this role
            expires_at: Optional expiry datetime

        Returns:
            The created UserRole

        Raises:
            ValueError: If role is already assigned
        """
        # Check if already exists
        statement = select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
            UserRole.org_id == org_id,
        )
        existing = self.db.exec(statement).first()
        if existing:
            msg = "Role already assigned to user in this organization"
            raise ValueError(msg)

        ur = UserRole(
            user_id=user_id,
            role_id=role_id,
            org_id=org_id,
            granted_by=granted_by,
            expires_at=expires_at,
        )
        self.db.add(ur)
        self.db.commit()

        # Invalidate user's permission cache
        invalidate_user_permissions(user_id)

        return ur

    def remove_role_from_user(self, user_id: int, role_id: int, org_id: int) -> bool:
        """
        Remove a role from a user in an organization.

        Args:
            user_id: User ID
            role_id: Role ID
            org_id: Organization ID

        Returns:
            True if removed, False if not found
        """
        statement = select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
            UserRole.org_id == org_id,
        )
        ur = self.db.exec(statement).first()
        if not ur:
            return False

        self.db.delete(ur)
        self.db.commit()

        # Invalidate user's permission cache
        invalidate_user_permissions(user_id)

        return True

    def get_user_roles(
        self, user_id: int, org_id: int | None = None
    ) -> list[UserRoleRead]:
        """
        Get all roles assigned to a user.

        Args:
            user_id: User ID
            org_id: Optional organization ID filter

        Returns:
            List of user-role assignments with role details
        """
        statement = select(UserRole).where(UserRole.user_id == user_id)
        if org_id is not None:
            statement = statement.where(UserRole.org_id == org_id)

        results = self.db.exec(statement).all()
        user_roles = []

        for ur in results:
            role = self.get_by_id(ur.role_id)
            user_roles.append(
                UserRoleRead(
                    user_id=ur.user_id,
                    role_id=ur.role_id,
                    org_id=ur.org_id,
                    granted_at=ur.granted_at,
                    granted_by=ur.granted_by,
                    expires_at=ur.expires_at,
                    role=RoleRead.model_validate(role) if role else None,
                )
            )

        return user_roles

    def get_users_with_role(
        self, role_id: int, org_id: int | None = None
    ) -> list[UserRole]:
        """
        Get all users who have a specific role.

        Args:
            role_id: Role ID
            org_id: Optional organization ID filter

        Returns:
            List of user-role assignments
        """
        statement = select(UserRole).where(UserRole.role_id == role_id)
        if org_id is not None:
            statement = statement.where(UserRole.org_id == org_id)

        return list(self.db.exec(statement).all())

    # -----------------------------------------------------------------------
    # Seed Default Roles
    # -----------------------------------------------------------------------

    def seed_default_roles(self) -> dict[str, Role]:
        """
        Seed the database with default system roles.

        Returns:
            Dictionary mapping slug to created/existing role
        """
        # First ensure permissions exist
        self.permission_service.seed_default_permissions()

        default_roles = [
            {
                "slug": RoleSlug.SUPER_ADMIN,
                "name": "Super Admin",
                "description": "Platform-wide administrator with full access",
                "is_system": True,
                "priority": 100,
                "parent_role_id": None,
                "permissions": ["*:*:*"],  # All permissions
            },
            {
                "slug": RoleSlug.ORG_ADMIN,
                "name": "Organization Admin",
                "description": "Full control over organization",
                "is_system": True,
                "priority": 90,
                "parent_role_id": None,  # Will be set after super-admin creation
                "permissions": [
                    "organization:*:own",
                    "course:*:org",
                    "chapter:*:org",
                    "activity:*:org",
                    "user:*:org",
                    "usergroup:*:org",
                    "collection:*:org",
                    "role:*:org",
                    "analytics:read:org",
                    "file:*:org",
                    "api_token:*:org",
                ],
            },
            {
                "slug": RoleSlug.MAINTAINER,
                "name": "Maintainer",
                "description": "Content management and course administration",
                "is_system": True,
                "priority": 70,
                "parent_slug": RoleSlug.ORG_ADMIN,
                "permissions": [
                    "course:create:org",
                    "course:read:all",
                    "course:update:org",
                    "course:delete:org",
                    "chapter:*:org",
                    "activity:*:org",
                    "collection:*:org",
                    "user:read:org",
                    "usergroup:read:org",
                    "analytics:read:org",
                ],
            },
            {
                "slug": RoleSlug.INSTRUCTOR,
                "name": "Instructor",
                "description": "Course creation and management",
                "is_system": True,
                "priority": 50,
                "parent_slug": RoleSlug.MAINTAINER,
                "permissions": [
                    "course:create:org",
                    "course:read:all",
                    "course:update:own",
                    "course:delete:own",
                    "course:manage:own",
                    "chapter:*:own",
                    "activity:*:own",
                    "assignment:grade:own",
                    "quiz:grade:own",
                    "certificate:create:own",
                    "analytics:read:own",
                ],
            },
            {
                "slug": RoleSlug.MODERATOR,
                "name": "Moderator",
                "description": "Community moderation",
                "is_system": True,
                "priority": 40,
                "parent_slug": RoleSlug.ORG_ADMIN,
                "permissions": [
                    "course:read:all",
                    "user:read:org",
                    "discussion:moderate:org",
                ],
            },
            {
                "slug": RoleSlug.USER,
                "name": "User",
                "description": "Standard authenticated user",
                "is_system": True,
                "priority": 10,
                "parent_role_id": None,
                "permissions": [
                    "course:read:all",
                    "user:read:own",
                    "user:update:own",
                    "assignment:submit:all",
                    "quiz:submit:all",
                    "analytics:read:own",
                ],
            },
        ]

        created_roles: dict[str, Role] = {}

        # First pass: create all roles without parent relationships
        for role_data in default_roles:
            slug = role_data["slug"]
            existing = self.get_by_slug(slug, org_id=None)

            if existing:
                created_roles[slug] = existing
            else:
                role = Role(
                    slug=slug,
                    name=role_data["name"],
                    description=role_data["description"],
                    is_system=role_data["is_system"],
                    priority=role_data["priority"],
                    org_id=None,  # Global roles
                )
                self.db.add(role)
                self.db.commit()
                self.db.refresh(role)
                created_roles[slug] = role

        # Second pass: set parent relationships and add permissions
        for role_data in default_roles:
            slug = role_data["slug"]
            role = created_roles[slug]

            # Set parent if specified
            if "parent_slug" in role_data:
                parent = created_roles.get(role_data["parent_slug"])
                if parent and role.parent_role_id != parent.id:
                    role.parent_role_id = parent.id
                    self.db.add(role)
                    self.db.commit()

            # Add permissions
            for pattern in role_data["permissions"]:
                try:
                    self.add_permissions_by_pattern(role.id, pattern)  # type: ignore[arg-type]
                except ValueError:
                    pass  # Permission already assigned

        return created_roles
