"""
Permission context for tracking request-scoped permission data.

This module provides the PermissionContext class for tracking the current
user, organization, and resource during permission checks.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime

from src.db.permissions.enums import Action, ResourceType


@dataclass
class PermissionContext:
    """
    Context for permission checks.

    This class holds all the information needed to evaluate a permission,
    including the user, organization, resource, and any additional context.
    """

    # User information
    user_id: int
    user_uuid: str | None = None

    # Organization context
    org_id: int | None = None

    # Resource information
    resource_type: ResourceType | None = None
    resource_id: str | None = None

    # Request metadata
    ip_address: str | None = None
    user_agent: str | None = None

    # Additional context for ABAC
    extra: dict = field(default_factory=dict)

    # Timestamp
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))

    @property
    def is_anonymous(self) -> bool:
        """Check if this is an anonymous user context."""
        return self.user_id == 0

    def with_resource(
        self,
        resource_type: ResourceType,
        resource_id: str | None = None,
    ) -> "PermissionContext":
        """
        Create a new context with resource information.

        Args:
            resource_type: Type of resource
            resource_id: Optional resource UUID

        Returns:
            New PermissionContext with resource info
        """
        return PermissionContext(
            user_id=self.user_id,
            user_uuid=self.user_uuid,
            org_id=self.org_id,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=self.ip_address,
            user_agent=self.user_agent,
            extra=self.extra.copy(),
            timestamp=self.timestamp,
        )

    def with_org(self, org_id: int) -> "PermissionContext":
        """
        Create a new context with organization information.

        Args:
            org_id: Organization ID

        Returns:
            New PermissionContext with org info
        """
        return PermissionContext(
            user_id=self.user_id,
            user_uuid=self.user_uuid,
            org_id=org_id,
            resource_type=self.resource_type,
            resource_id=self.resource_id,
            ip_address=self.ip_address,
            user_agent=self.user_agent,
            extra=self.extra.copy(),
            timestamp=self.timestamp,
        )

    def with_extra(self, **kwargs) -> "PermissionContext":
        """
        Create a new context with additional ABAC context.

        Args:
            **kwargs: Additional context key-value pairs

        Returns:
            New PermissionContext with extra context
        """
        new_extra = self.extra.copy()
        new_extra.update(kwargs)
        return PermissionContext(
            user_id=self.user_id,
            user_uuid=self.user_uuid,
            org_id=self.org_id,
            resource_type=self.resource_type,
            resource_id=self.resource_id,
            ip_address=self.ip_address,
            user_agent=self.user_agent,
            extra=new_extra,
            timestamp=self.timestamp,
        )

    @classmethod
    def from_request(
        cls,
        user_id: int,
        request=None,
        user_uuid: str | None = None,
        org_id: int | None = None,
    ) -> "PermissionContext":
        """
        Create a context from a FastAPI request.

        Args:
            user_id: User ID
            request: FastAPI Request object (optional)
            user_uuid: User UUID (optional)
            org_id: Organization ID (optional)

        Returns:
            New PermissionContext populated from request
        """
        ip_address = None
        user_agent = None

        if request:
            # Get client IP (handle proxy headers)
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                ip_address = forwarded.split(",")[0].strip()
            else:
                ip_address = request.client.host if request.client else None

            user_agent = request.headers.get("User-Agent")

        return cls(
            user_id=user_id,
            user_uuid=user_uuid,
            org_id=org_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    def to_dict(self) -> dict:
        """Convert context to dictionary for logging/serialization."""
        return {
            "user_id": self.user_id,
            "user_uuid": self.user_uuid,
            "org_id": self.org_id,
            "resource_type": self.resource_type.value if self.resource_type else None,
            "resource_id": self.resource_id,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat(),
            "extra": self.extra,
        }
