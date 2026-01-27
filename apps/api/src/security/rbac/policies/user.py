"""
User-specific permission policy.

This module implements permission logic specific to user management,
including self-management and admin user management.
"""

from sqlmodel import select

from src.db.permissions.enums import Action, ResourceType
from src.db.permissions.models import Role, UserRole
from src.db.users import AnonymousUser, PublicUser, User
from src.security.rbac.policies.base import BasePolicy


class UserPolicy(BasePolicy):
    """
    Policy for user-related permissions.

    Users have special rules:
    - Users can always read and update their own profile
    - Only org admins can manage other users in their org
    - Only super admins can delete users
    """

    resource_type = ResourceType.USER

    def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource_id: str | None = None,
        context: dict | None = None,
    ) -> bool:
        """
        Check if user can perform action on user resource.

        Args:
            user: Current user (the one making the request)
            action: Action to perform
            resource_id: Target user UUID or ID
            context: Optional context (org_id, etc.)

        Returns:
            True if allowed
        """
        # Anonymous users can only read public profiles
        if isinstance(user, AnonymousUser) or user.id == 0:
            return action == Action.READ

        # Get target user ID
        target_user_id = self._resolve_user_id(resource_id)

        # Self-actions are always allowed for read/update
        if target_user_id and target_user_id == user.id:
            if action in (Action.READ, Action.UPDATE):
                return True

        # Read other users - allowed for authenticated users
        if action == Action.READ:
            return True

        # Update other users - requires org admin in same org
        if action == Action.UPDATE:
            if target_user_id:
                return self._can_manage_user(user, target_user_id, context)
            return False

        # Delete users - requires super admin
        if action == Action.DELETE:
            return self.is_super_admin(user)

        # Invite users - requires maintainer or higher
        if action == Action.INVITE:
            org_id = context.get("org_id") if context else None
            if org_id:
                return self._has_invite_permission(user, int(org_id))
            return False

        return False

    def _resolve_user_id(self, resource_id: str | None) -> int | None:
        """
        Resolve user ID from resource_id.

        Args:
            resource_id: Could be user UUID or user ID

        Returns:
            User ID or None
        """
        if not resource_id:
            return None

        # Try as user_id (integer)
        if resource_id.isdigit():
            return int(resource_id)

        # Try as user_uuid
        statement = select(User.id).where(User.user_uuid == resource_id)
        return self.db.exec(statement).first()

    def _can_manage_user(
        self,
        user: PublicUser,
        target_user_id: int,
        context: dict | None,
    ) -> bool:
        """
        Check if user can manage (update/moderate) another user.

        Requires org admin role in at least one shared organization.

        Args:
            user: Current user
            target_user_id: Target user ID
            context: Optional context with org_id

        Returns:
            True if can manage
        """
        # Super admin can manage anyone
        if self.is_super_admin(user):
            return True

        # Get shared organizations
        shared_orgs = self._get_shared_orgs(user.id, target_user_id)

        if not shared_orgs:
            return False

        # Check if current user is admin in any shared org
        return any(self._is_org_admin_for_user(user, org_id) for org_id in shared_orgs)

    def _get_shared_orgs(self, user_id_1: int, user_id_2: int) -> list[int]:
        """
        Get organization IDs where both users are members.

        Args:
            user_id_1: First user ID
            user_id_2: Second user ID

        Returns:
            List of shared organization IDs
        """
        # Get orgs for user 1
        statement1 = select(UserRole.org_id).where(UserRole.user_id == user_id_1)
        orgs1 = set(self.db.exec(statement1).all())

        # Get orgs for user 2
        statement2 = select(UserRole.org_id).where(UserRole.user_id == user_id_2)
        orgs2 = set(self.db.exec(statement2).all())

        return list(orgs1 & orgs2)

    def _is_org_admin_for_user(self, user: PublicUser, org_id: int) -> bool:
        """
        Check if user is org admin for a specific organization.

        Args:
            user: Current user
            org_id: Organization ID

        Returns:
            True if org admin
        """
        statement = (
            select(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                UserRole.user_id == user.id,
                UserRole.org_id == org_id,
                Role.slug.in_(["org-admin", "super-admin"]),
            )
        )
        result = self.db.exec(statement).first()
        return result is not None

    def _has_invite_permission(self, user: PublicUser, org_id: int) -> bool:
        """
        Check if user can invite others to an organization.

        Args:
            user: Current user
            org_id: Organization ID

        Returns:
            True if can invite
        """
        statement = (
            select(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                UserRole.user_id == user.id,
                UserRole.org_id == org_id,
                Role.slug.in_(["org-admin", "maintainer", "super-admin"]),
            )
        )
        result = self.db.exec(statement).first()
        return result is not None

    def is_super_admin(self, user: PublicUser | AnonymousUser) -> bool:
        """
        Check if user is a super admin.

        Args:
            user: Current user

        Returns:
            True if super admin
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

    def can_change_password(
        self,
        user: PublicUser | AnonymousUser,
        target_user_id: int,
    ) -> bool:
        """
        Check if user can change another user's password.

        Only the user themselves or super admin can change passwords.

        Args:
            user: Current user
            target_user_id: Target user ID

        Returns:
            True if can change password
        """
        if isinstance(user, AnonymousUser) or user.id == 0:
            return False

        # Self
        if user.id == target_user_id:
            return True

        # Super admin
        return self.is_super_admin(user)

    def can_view_email(
        self,
        user: PublicUser | AnonymousUser,
        target_user_id: int,
    ) -> bool:
        """
        Check if user can view another user's email.

        Users can see their own email.
        Org admins can see emails of users in their org.

        Args:
            user: Current user
            target_user_id: Target user ID

        Returns:
            True if can view email
        """
        if isinstance(user, AnonymousUser) or user.id == 0:
            return False

        # Self
        if user.id == target_user_id:
            return True

        # Check if admin in shared org
        return self._can_manage_user(user, target_user_id, None)
