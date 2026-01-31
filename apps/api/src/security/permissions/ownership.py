"""
Resource Ownership Checker

Handles verification of resource ownership and contributor status.
Separated from main permission checker for clarity and testability.
"""

from sqlmodel import Session, select

from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)


class OwnershipChecker:
    """
    Checks resource ownership and authorship relationships.

    This class is responsible for determining if a user owns or
    contributes to a resource via the ResourceAuthor table.
    """

    def __init__(self, db: Session):
        """
        Initialize ownership checker.

        Args:
            db: Database session
        """
        self.db = db

    def is_owner(self, user_id: int, resource_id: str) -> bool:
        """
        Check if user is the owner/creator of a resource.

        Args:
            user_id: User ID to check
            resource_id: Resource UUID

        Returns:
            True if user is owner/creator
        """
        if user_id == 0:
            return False

        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship == ResourceAuthorshipEnum.CREATOR,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )

        return self.db.exec(statement).first() is not None

    def is_maintainer(self, user_id: int, resource_id: str) -> bool:
        """
        Check if user is a maintainer of a resource.

        Args:
            user_id: User ID to check
            resource_id: Resource UUID

        Returns:
            True if user is maintainer
        """
        if user_id == 0:
            return False

        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship == ResourceAuthorshipEnum.MAINTAINER,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )

        return self.db.exec(statement).first() is not None

    def is_contributor(self, user_id: int, resource_id: str) -> bool:
        """
        Check if user is any kind of contributor (creator, maintainer, contributor).

        Args:
            user_id: User ID to check
            resource_id: Resource UUID

        Returns:
            True if user is any type of contributor
        """
        if user_id == 0:
            return False

        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship.in_([
                ResourceAuthorshipEnum.CREATOR,
                ResourceAuthorshipEnum.MAINTAINER,
                ResourceAuthorshipEnum.CONTRIBUTOR,
            ]),
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )

        return self.db.exec(statement).first() is not None

    def get_authorship_level(
        self, user_id: int, resource_id: str
    ) -> ResourceAuthorshipEnum | None:
        """
        Get the authorship level of a user for a resource.

        Args:
            user_id: User ID to check
            resource_id: Resource UUID

        Returns:
            ResourceAuthorshipEnum if user is a contributor, None otherwise
        """
        if user_id == 0:
            return None

        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == resource_id,
            ResourceAuthor.user_id == user_id,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )

        author = self.db.exec(statement).first()
        return author.authorship if author else None
