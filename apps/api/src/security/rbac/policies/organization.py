"""
Organization-specific permission policy.

This module implements permission logic specific to organizations,
including membership checks and admin verification.
"""

from sqlmodel import select

from src.db.organizations import Organization
from src.db.permissions.enums import Action, ResourceType
from src.db.permissions.models import Role, UserRole
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.policies.base import BasePolicy


class OrganizationPolicy(BasePolicy):
    """
    Policy for organization-related permissions.

    Organizations have special rules:
    - Public organization info can be read by anyone
    - Only members can access internal organization resources
    - Only org admins can manage organization settings
    """

    resource_type = ResourceType.ORGANIZATION

    def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource_id: str | None = None,
        context: dict | None = None,
    ) -> bool:
        """
        Check if user can perform action on organization.

        Args:
            user: Current user
            action: Action to perform
            resource_id: Organization UUID or ID
            context: Optional context

        Returns:
            True if allowed
        """
        # Anonymous users can only read public org info
        if isinstance(user, AnonymousUser) or user.id == 0:
            return action == Action.READ

        # Read access for authenticated users
        if action == Action.READ:
            return True

        # Get org_id from resource_id or context
        org_id = self._resolve_org_id(resource_id, context)
        if org_id is None:
            return False

        # Update/Manage requires org admin role
        if action in (Action.UPDATE, Action.MANAGE):
            return self.is_org_admin(user, org_id)

        # Delete requires super admin (platform-wide)
        if action == Action.DELETE:
            return self.is_super_admin(user)

        # Invite requires at least maintainer role
        if action == Action.INVITE:
            return self.has_org_role(user, org_id, ["org-admin", "maintainer"])

        return False

    def _resolve_org_id(
        self, resource_id: str | None, context: dict | None
    ) -> int | None:
        """
        Resolve organization ID from resource_id or context.

        Args:
            resource_id: Could be org UUID or org ID
            context: May contain org_id

        Returns:
            Organization ID or None
        """
        if context and "org_id" in context:
            return int(context["org_id"])

        if resource_id:
            # Try as org_id (integer)
            if resource_id.isdigit():
                return int(resource_id)

            # Try as org_uuid
            statement = select(Organization.id).where(
                Organization.org_uuid == resource_id
            )
            return self.db.exec(statement).first()

        return None

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
