"""
Organization-specific permission policy.

This module implements permission logic specific to organizations,
including membership checks and admin verification.
"""

from fastapi import HTTPException, status
from sqlmodel import select

from src.db.organizations import Organization
from src.db.permissions.constants import ADMIN_OR_MAINTAINER_SLUGS
from src.db.permissions.enums import Action, ResourceType
from src.db.permissions.models import Role, UserRole
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.security.rbac.policies.base import BasePolicy


class OrganizationPolicy(BasePolicy):
    """
    Policy for organization-related permissions.

    Organizations have special rules:
    - Public organization info can be read by anyone
    - Only members can access internal organization resources
    - Only org admins can manage organization settings
    """

    resource_type: ResourceType = ResourceType.ORGANIZATION

    def check(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        action: Action,
        resource_id: str | None = None,
        org_id: int | None = None,
    ) -> bool:
        """
        Check if user can perform action on organization.

        Args:
            user: Current user
            action: Action to perform
            resource_id: Organization UUID
            org_id: Organization ID

        Returns:
            True if allowed

        Raises:
            HTTPException: If permission denied
        """
        user_id = user.id if hasattr(user, "id") else 0
        is_anonymous = user_id == 0

        # Organizations are readable by anyone
        if action == Action.READ:
            return True

        # Write operations require authentication
        if is_anonymous:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="You must be logged in to modify organizations",
            )

        # Get org_id from resource_id if needed
        if org_id is None and resource_id:
            org_id = self._resolve_org_id(resource_id)

        # Check if user is admin/maintainer for this org
        if org_id and self._is_org_admin(user_id, org_id):
            return True

        # Fall back to role-based check
        return super().check(user, action, resource_id, org_id)

    def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource_id: str | None = None,
        context: dict | None = None,
    ) -> bool:
        """Non-raising variant of check(). Returns True/False."""
        try:
            org_id = context.get("org_id") if context else None
            return self.check(user, action, resource_id, org_id)
        except HTTPException:
            return False

    def _resolve_org_id(self, resource_id: str) -> int | None:
        """
        Resolve organization ID from resource_id.

        Args:
            resource_id: Could be org UUID or org ID

        Returns:
            Organization ID or None
        """
        if resource_id.isdigit():
            return int(resource_id)

        # Try as org_uuid
        statement = select(Organization.id).where(Organization.org_uuid == resource_id)
        return self.db.exec(statement).first()

    def _is_org_admin(self, user_id: int, org_id: int) -> bool:
        """Check if user has admin or maintainer role in this organization."""
        statement = (
            select(UserRole)
            .join(Role, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user_id,
                UserRole.org_id == org_id,
                Role.slug.in_(ADMIN_OR_MAINTAINER_SLUGS),
            )
        )
        return self.db.exec(statement).first() is not None

    def is_member(self, user: PublicUser | AnonymousUser, org_id: int) -> bool:
        """
        Check if user is a member of the organization.

        Args:
            user: Current user
            org_id: Organization ID

        Returns:
            True if user is a member
        """
        if isinstance(user, AnonymousUser) or user.id == 0:
            return False

        statement = select(UserRole).where(
            UserRole.user_id == user.id,
            UserRole.org_id == org_id,
        )
        result = self.db.exec(statement).first()
        return result is not None

    def is_org_admin(self, user: PublicUser | AnonymousUser, org_id: int) -> bool:
        """
        Check if user is an organization admin.

        Args:
            user: Current user
            org_id: Organization ID

        Returns:
            True if user is org admin
        """
        return self.has_org_role(user, org_id, ["org-admin", "super-admin"])

    def is_super_admin(self, user: PublicUser | AnonymousUser) -> bool:
        """
        Check if user is a super admin (platform-wide).

        Args:
            user: Current user

        Returns:
            True if user is super admin
        """
        if isinstance(user, AnonymousUser) or user.id == 0:
            return False

        statement = (
            select(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                UserRole.user_id == user.id,
                Role.slug == "super-admin",
            )
        )
        result = self.db.exec(statement).first()
        return result is not None

    def has_org_role(
        self,
        user: PublicUser | AnonymousUser,
        org_id: int,
        role_slugs: list[str],
    ) -> bool:
        """
        Check if user has any of the specified roles in the organization.

        Args:
            user: Current user
            org_id: Organization ID
            role_slugs: List of role slugs to check

        Returns:
            True if user has any of the roles
        """
        if isinstance(user, AnonymousUser) or user.id == 0:
            return False

        statement = (
            select(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                UserRole.user_id == user.id,
                UserRole.org_id == org_id,
                Role.slug.in_(role_slugs),
            )
        )
        result = self.db.exec(statement).first()
        return result is not None

    def get_user_role_in_org(
        self,
        user: PublicUser | AnonymousUser,
        org_id: int,
    ) -> Role | None:
        """
        Get the user's role in an organization.

        Returns the highest priority role if user has multiple.

        Args:
            user: Current user
            org_id: Organization ID

        Returns:
            Role or None
        """
        if isinstance(user, AnonymousUser) or user.id == 0:
            return None

        statement = (
            select(Role)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user.id,
                UserRole.org_id == org_id,
            )
            .order_by(Role.priority.desc())
        )
        return self.db.exec(statement).first()

    def get_org_members_count(self, org_id: int) -> int:
        """
        Get the number of members in an organization.

        Args:
            org_id: Organization ID

        Returns:
            Member count
        """
        from sqlalchemy import func

        statement = select(func.count(UserRole.user_id.distinct())).where(
            UserRole.org_id == org_id
        )
        result = self.db.exec(statement).first()
        return result or 0
