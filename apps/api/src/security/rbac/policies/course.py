"""
Course-specific permission policy.

This module implements permission logic specific to courses,
including public course access and ownership checks.
"""

from sqlmodel import select

from src.db.courses.courses import Course
from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.policies.base import BasePolicy


class CoursePolicy(BasePolicy):
    """
    Policy for course-related permissions.

    Courses have special rules:
    - Public courses can be read by anyone
    - Course creation requires instructor role or higher
    - Course updates require ownership or admin role
    - Chapter/activity creation requires course ownership
    """

    resource_type = ResourceType.COURSE

    def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource_id: str | None = None,
        context: dict | None = None,
    ) -> bool:
        """
        Check if user can perform action on course.

        Args:
            user: Current user
            action: Action to perform
            resource_id: Course UUID
            context: Optional context (org_id, etc.)

        Returns:
            True if allowed
        """
        # Anonymous users can only read public courses
        if isinstance(user, AnonymousUser) or user.id == 0:
            if action == Action.READ and resource_id:
                return self._is_public_course(resource_id)
            return False

        # Read access
        if action == Action.READ:
            if resource_id:
                # Can read if public or owner
                if self._is_public_course(resource_id):
                    return True
                if self.is_owner(user, resource_id):
                    return True
                # Check if enrolled (to be implemented)
            return True  # List access allowed for authenticated users

        # Create access - handled by role permissions
        if action == Action.CREATE:
            return True  # Role-based check handles this

        # Update/Delete/Manage - require ownership
        if action in (Action.UPDATE, Action.DELETE, Action.MANAGE):
            if resource_id:
                return self.is_owner(user, resource_id)
            return False

        return False

    def _is_public_course(self, course_uuid: str) -> bool:
        """Check if a course is public."""
        statement = select(Course).where(
            Course.course_uuid == course_uuid,
            Course.public == True,  # noqa: E712
        )
        result = self.db.exec(statement).first()
        return result is not None

    def can_create_content(
        self,
        user: PublicUser | AnonymousUser,
        course_uuid: str,
    ) -> bool:
        """
        Check if user can create content (chapters, activities) in a course.

        This requires course ownership (CREATOR, MAINTAINER, CONTRIBUTOR).

        Args:
            user: Current user
            course_uuid: Course UUID

        Returns:
            True if user can create content
        """
        if isinstance(user, AnonymousUser) or user.id == 0:
            return False

        return self.is_owner(user, course_uuid)

    def can_manage_contributors(
        self,
        user: PublicUser | AnonymousUser,
        course_uuid: str,
    ) -> bool:
        """
        Check if user can manage course contributors.

        Only CREATOR and MAINTAINER can manage contributors.

        Args:
            user: Current user
            course_uuid: Course UUID

        Returns:
            True if user can manage contributors
        """
        from sqlmodel import select

        from src.db.resource_authors import (
            ResourceAuthor,
            ResourceAuthorshipEnum,
            ResourceAuthorshipStatusEnum,
        )

        if isinstance(user, AnonymousUser) or user.id == 0:
            return False

        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == course_uuid,
            ResourceAuthor.user_id == user.id,
            ResourceAuthor.authorship.in_(
                [
                    ResourceAuthorshipEnum.CREATOR,
                    ResourceAuthorshipEnum.MAINTAINER,
                ]
            ),
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
        result = self.db.exec(statement).first()
        return result is not None

    def can_change_visibility(
        self,
        user: PublicUser | AnonymousUser,
        course_uuid: str,
    ) -> bool:
        """
        Check if user can change course visibility (public flag).

        Only CREATOR and MAINTAINER can change visibility.

        Args:
            user: Current user
            course_uuid: Course UUID

        Returns:
            True if user can change visibility
        """
        return self.can_manage_contributors(user, course_uuid)

    def get_course_org_id(self, course_uuid: str) -> int | None:
        """
        Get the organization ID for a course.

        Args:
            course_uuid: Course UUID

        Returns:
            Organization ID or None
        """
        statement = select(Course.org_id).where(Course.course_uuid == course_uuid)
        return self.db.exec(statement).first()
