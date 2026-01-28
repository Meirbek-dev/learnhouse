"""
Base policy class for resource-specific permission logic.

This module provides the abstract base class for all resource policies.
"""

from abc import ABC, abstractmethod

from sqlmodel import Session

from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser


class BasePolicy(ABC):
    """
    Abstract base class for resource-specific policies.

    Each resource type can have its own policy class that implements
    custom permission logic beyond the standard RBAC checks.
    """

    resource_type: ResourceType

    def __init__(self, db: Session) -> None:
        """
        Initialize the policy.

        Args:
            db: Database session
        """
        self.db = db

    @abstractmethod
    def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource_id: str | None = None,
        context: dict | None = None,
    ) -> bool:
        """
        Check if user can perform action on resource.

        This method should implement resource-specific logic.

        Args:
            user: Current user
            action: Action to perform
            resource_id: Optional resource UUID
            context: Optional additional context

        Returns:
            True if allowed, False otherwise
        """

    def check(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource_id: str | None = None,
        org_id: int | None = None,
        context: dict | None = None,
    ) -> bool:
        """
        Default policy check that raises on denial.

        This method calls `can()` and raises an HTTPException with
        status 403 when access is denied. Policies can override this
        behavior by implementing their own `check()` method.
        """
        from fastapi import HTTPException, status

        allowed = self.can(user, action, resource_id=resource_id, context=context)
        if allowed:
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: Cannot {action.value} on resource",
        )

    def is_owner(self, user: PublicUser | AnonymousUser, resource_id: str) -> bool:
        """
        Check if user owns the resource.

        Args:
            user: Current user
            resource_id: Resource UUID

        Returns:
            True if user is owner
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
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user.id,
            ResourceAuthor.authorship.in_(
                [
                    ResourceAuthorshipEnum.CREATOR,
                    ResourceAuthorshipEnum.MAINTAINER,
                    ResourceAuthorshipEnum.CONTRIBUTOR,
                ]
            ),
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
        result = self.db.exec(statement).first()
        return result is not None

    def is_creator(self, user: PublicUser | AnonymousUser, resource_id: str) -> bool:
        """
        Check if user is the creator of the resource.

        Args:
            user: Current user
            resource_id: Resource UUID

        Returns:
            True if user is creator
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
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user.id,
            ResourceAuthor.authorship == ResourceAuthorshipEnum.CREATOR,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
        result = self.db.exec(statement).first()
        return result is not None

    def get_user_org_ids(self, user: PublicUser | AnonymousUser) -> list[int]:
        """
        Get all organization IDs the user belongs to.

        Args:
            user: Current user

        Returns:
            List of organization IDs
        """
        from sqlmodel import select

        from src.db.permissions.models import UserRole

        if isinstance(user, AnonymousUser) or user.id == 0:
            return []

        statement = (
            select(UserRole.org_id).where(UserRole.user_id == user.id).distinct()
        )
        results = self.db.exec(statement).all()
        return list(results)
