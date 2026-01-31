"""
Permission Cache

Handles caching of permission check results using Redis.
Implements proper cache invalidation strategies.
"""

import json
import logging
from typing import Any

from src.services.cache.redis_client import get_redis_client

_logger = logging.getLogger(__name__)

# Cache TTL in seconds
PERMISSION_CACHE_TTL = 300  # 5 minutes
ROLE_CACHE_TTL = 600  # 10 minutes


class PermissionCache:
    """
    Redis-based cache for permission check results.

    Implements tiered caching with proper invalidation on role changes.
    """

    def __init__(self):
        """Initialize permission cache."""
        self.redis = get_redis_client()

    def _build_permission_key(
        self,
        user_id: int,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        org_id: int | None = None,
        scope: str = "all",
    ) -> str:
        """Build cache key for permission check."""
        parts = ["perm", str(user_id), resource_type, action, scope]
        if org_id:
            parts.append(f"org{org_id}")
        if resource_id:
            parts.append(resource_id)
        return ":".join(parts)

    def _build_role_key(self, user_id: int, org_id: int | None = None) -> str:
        """Build cache key for user roles."""
        if org_id:
            return f"roles:{user_id}:org{org_id}"
        return f"roles:{user_id}"

    def _build_user_perms_key(self, user_id: int, org_id: int | None = None) -> str:
        """Build cache key for all user permissions."""
        if org_id:
            return f"user_perms:{user_id}:org{org_id}"
        return f"user_perms:{user_id}"

    async def get_permission(
        self,
        user_id: int,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        org_id: int | None = None,
        scope: str = "all",
    ) -> bool | None:
        """
        Get cached permission check result.

        Returns:
            True/False if cached, None if not in cache
        """
        if not self.redis:
            return None

        try:
            key = self._build_permission_key(
                user_id, action, resource_type, resource_id, org_id, scope
            )
            value = self.redis.get(key)
            if value is None:
                return None
            return value.decode() == "1"
        except Exception as e:
            _logger.warning(f"Failed to get permission from cache: {e}")
            return None

    async def set_permission(
        self,
        user_id: int,
        action: str,
        resource_type: str,
        granted: bool,
        resource_id: str | None = None,
        org_id: int | None = None,
        scope: str = "all",
    ) -> None:
        """Cache permission check result."""
        if not self.redis:
            return

        try:
            key = self._build_permission_key(
                user_id, action, resource_type, resource_id, org_id, scope
            )
            value = "1" if granted else "0"
            self.redis.setex(key, PERMISSION_CACHE_TTL, value)
        except Exception as e:
            _logger.warning(f"Failed to set permission in cache: {e}")

    async def get_user_permissions(
        self, user_id: int, org_id: int | None = None
    ) -> dict[str, bool] | None:
        """Get all cached permissions for a user."""
        if not self.redis:
            return None

        try:
            key = self._build_user_perms_key(user_id, org_id)
            value = self.redis.get(key)
            if value is None:
                return None
            return json.loads(value.decode())
        except Exception as e:
            _logger.warning(f"Failed to get user permissions from cache: {e}")
            return None

    async def set_user_permissions(
        self,
        user_id: int,
        permissions: dict[str, bool],
        org_id: int | None = None,
    ) -> None:
        """Cache all permissions for a user."""
        if not self.redis:
            return

        try:
            key = self._build_user_perms_key(user_id, org_id)
            value = json.dumps(permissions)
            self.redis.setex(key, PERMISSION_CACHE_TTL, value)
        except Exception as e:
            _logger.warning(f"Failed to set user permissions in cache: {e}")

    async def invalidate_user(self, user_id: int, org_id: int | None = None) -> None:
        """
        Invalidate all cached permissions for a user.

        Called when user's roles change.
        """
        if not self.redis:
            return

        try:
            # Pattern to match all permission keys for this user
            if org_id:
                pattern = f"perm:{user_id}:*:org{org_id}*"
            else:
                pattern = f"perm:{user_id}:*"

            # Delete all matching keys
            cursor = 0
            while True:
                cursor, keys = self.redis.scan(cursor, match=pattern, count=100)
                if keys:
                    self.redis.delete(*keys)
                if cursor == 0:
                    break

            # Also delete user permissions cache
            user_perms_key = self._build_user_perms_key(user_id, org_id)
            self.redis.delete(user_perms_key)

            _logger.info(f"Invalidated permission cache for user {user_id}")
        except Exception as e:
            _logger.warning(f"Failed to invalidate user permissions: {e}")

    async def invalidate_resource(
        self, resource_id: str, resource_type: str
    ) -> None:
        """
        Invalidate all cached permissions for a resource.

        Called when resource permissions change.
        """
        if not self.redis:
            return

        try:
            # Pattern to match all permission keys for this resource
            pattern = f"perm:*:{resource_type}:*:{resource_id}"

            cursor = 0
            while True:
                cursor, keys = self.redis.scan(cursor, match=pattern, count=100)
                if keys:
                    self.redis.delete(*keys)
                if cursor == 0:
                    break

            _logger.info(
                f"Invalidated permission cache for {resource_type} {resource_id}"
            )
        except Exception as e:
            _logger.warning(f"Failed to invalidate resource permissions: {e}")


# Global cache instance
_cache_instance: PermissionCache | None = None


def get_permission_cache() -> PermissionCache:
    """Get global permission cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = PermissionCache()
    return _cache_instance
