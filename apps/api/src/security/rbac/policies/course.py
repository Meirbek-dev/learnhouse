"""
Course-specific permission policy.

This module implements permission logic specific to courses,
including public course access and ownership checks.
"""

from fastapi import HTTPException, status
from sqlmodel import select

from src.db.courses.courses import Course
from src.db.permissions.enums import Action, ResourceType
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.users import AnonymousUser, InternalUser, PublicUser
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

    resource_type: ResourceType = ResourceType.COURSE

    def check(
        self,
        user: PublicUser | AnonymousUser | InternalUser,
        action: Action,
        resource_id: str | None = None,
        org_id: int | None = None,
    ) -> bool:
        """
        Check course-specific permissions.

        Args:
            user: User requesting access
            action: Action to perform
            resource_id: Course UUID
            org_id: Optional organization context

        Returns:
            True if permission granted

        Raises:
            HTTPException: If permission denied
        """
        user_id = user.id if hasattr(user, "id") else 0
        is_anonymous = user_id == 0

        # Handle READ operations
        if action == Action.READ:
            # Anonymous users can only read public courses
            if is_anonymous:
                if resource_id and self._is_public_course(resource_id):
                    return True
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You must be logged in to access this course",
                )

            # Authenticated users can read public courses
            if resource_id and self._is_public_course(resource_id):
                return True

            # Check if user is course owner/contributor
            if resource_id and self._is_course_contributor(user_id, resource_id):
                return True

            # Check UserGroup access (courses with no UserGroup restrictions are open)
            if resource_id:
                has_usergroup_restriction = self._has_usergroup_restriction(resource_id)
                if not has_usergroup_restriction:
                    # No restrictions = any authenticated user can access
                    return True

                # Check if user is in an authorized UserGroup
                if self._is_in_authorized_usergroup(user_id, resource_id):
                    return True

            # Fall back to role-based check
            return super().check(user, action, resource_id, org_id)

        # CREATE operations (course creation)
        if action == Action.CREATE:
            if is_anonymous:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="You must be logged in to create courses",
                )
            # Fall back to role-based check (instructor or higher)
            return super().check(user, action, resource_id, org_id)

        # UPDATE/DELETE operations require ownership or admin
        if action in (Action.UPDATE, Action.DELETE):
            if is_anonymous:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="You must be logged in to modify courses",
                )

            if resource_id:
                # Course owners can update/delete
                if self._is_course_contributor(user_id, resource_id):
                    return True

            # Fall back to role-based check (admin/maintainer)
            return super().check(user, action, resource_id, org_id)

        # Default: fall back to parent
        return super().check(user, action, resource_id, org_id)

    def _is_public_course(self, course_uuid: str) -> bool:
        """Check if course is public."""
        course = self.db.exec(
            select(Course).where(Course.course_uuid == course_uuid)
        ).first()
        return course.public if course else False

    def _is_course_contributor(self, user_id: int, course_uuid: str) -> bool:
        """Check if user is a contributor (owner, maintainer, or contributor) to the course."""
        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == course_uuid,
            ResourceAuthor.user_id == user_id,
        )
        resource_author = self.db.exec(statement).first()

        if not resource_author:
            return False

        return (
            resource_author.authorship
            in (
                ResourceAuthorshipEnum.CREATOR,
                ResourceAuthorshipEnum.MAINTAINER,
                ResourceAuthorshipEnum.CONTRIBUTOR,
            )
            and resource_author.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE
        )

    def _has_usergroup_restriction(self, course_uuid: str) -> bool:
        """Check if course has UserGroup access restrictions."""
        ugr_stmt = select(UserGroupResource).where(
            UserGroupResource.resource_uuid == course_uuid
        )
        return self.db.exec(ugr_stmt).first() is not None

    def _is_in_authorized_usergroup(self, user_id: int, course_uuid: str) -> bool:
        """Check if user is member of a UserGroup that grants access to this course."""
        member_stmt = (
            select(UserGroupUser)
            .join(
                UserGroupResource,
                UserGroupUser.usergroup_id == UserGroupResource.usergroup_id,
            )
            .where(
                UserGroupResource.resource_uuid == course_uuid,
                UserGroupUser.user_id == user_id,
            )
        )
        return self.db.exec(member_stmt).first() is not None

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
                # Course not public and user not owner - check if accessible via UserGroup
                return self._can_access_via_usergroup(user.id, resource_id)
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

    def _can_access_via_usergroup(self, user_id: int, course_uuid: str) -> bool:
        """Check if user can access course via UserGroup membership or if course has no restrictions."""
        from sqlmodel import and_, or_
        from src.db.usergroups.usergroups import UserGroupResource, UserGroupUser

        # Check if course has UserGroup restrictions
        ugr_stmt = select(UserGroupResource).where(
            UserGroupResource.resource_uuid == course_uuid
        )
        ugr_result = self.db.exec(ugr_stmt).first()

        # If course has no UserGroup restrictions, anyone authenticated can access
        if not ugr_result:
            return True

        # Check if user is member of a UserGroup that grants access to this course
        member_stmt = (
            select(UserGroupUser)
            .join(
                UserGroupResource,
                UserGroupUser.usergroup_id == UserGroupResource.usergroup_id,
            )
            .where(
                UserGroupResource.resource_uuid == course_uuid,
                UserGroupUser.user_id == user_id,
            )
        )
        member_result = self.db.exec(member_stmt).first()
        return member_result is not None

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
