"""
RBAC Cache Service - Redis-based Caching

Cache hierarchy:
1. User roles (TTL: 10min) - rarely changes
2. Permission checks (TTL: 5min) - frequently accessed
3. Negative caches (TTL: 1min) - prevent repeated denials

Invalidation triggers:
- Role assigned/revoked → invalidate user_roles:{user_id}:{org_id}
- Permission added to role → invalidate role_perms:{role_id}
- Bulk changes → invalidate org:{org_id}:*
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from src.services.cache.redis_client import (
    delete_keys,
    get_json,
    get_redis_client,
    set_json,
)

logger = logging.getLogger(__name__)

# Cache TTL in seconds
PERMISSION_CACHE_TTL = 300  # 5 minutes
ROLE_CACHE_TTL = 600  # 10 minutes
USER_ROLES_CACHE_TTL = 300  # 5 minutes
CACHE_LOCK_TTL = 10  # 10 seconds for locks


class CacheService:
    """Redis-based caching for RBAC."""

    def __init__(self, redis=None, prefix: str = "rbac") -> None:
        self.redis = redis or get_redis_client()
        self.prefix = prefix

    # ========================================================================
    # Permission Cache
    # ========================================================================

    def get_permission(
        self,
        user_id: int,
        permission: str,
        org_id: int | None,
        resource_id: str | None,
    ) -> bool | None:
        """
        Get cached permission check result.

        Returns:
            True: Permission granted (cached)
            False: Permission denied (cached)
            None: Not in cache (need to check DB)
        """
        if not self.redis:
            return None

        key = self._permission_key(user_id, permission, org_id, resource_id)

        try:
            value = self.redis.get(key)

            if value is None:
                return None

            return value == b"1"
        except Exception as e:
            logger.exception(f"Cache get error: {e}")
            return None

    def set_permission(
        self,
        user_id: int,
        permission: str,
        org_id: int | None,
        resource_id: str | None,
        granted: bool,
        ttl: int = PERMISSION_CACHE_TTL,
    ) -> None:
        """Cache permission check result."""
        if not self.redis:
            return

        key = self._permission_key(user_id, permission, org_id, resource_id)
        value = "1" if granted else "0"

        try:
            self.redis.setex(key, ttl, value)
        except Exception as e:
            logger.exception(f"Cache set error: {e}")

    # ========================================================================
    # Cache Invalidation
    # ========================================================================

    def invalidate_user(self, user_id: int, org_id: int | None = None) -> None:
        """
        Invalidate all cached data for user.

        Called when:
        - Role assigned/revoked
        - User permissions changed
        """
        if not self.redis:
            return

        if org_id:
            pattern = f"{self.prefix}:user:{user_id}:org:{org_id}:*"
        else:
            pattern = f"{self.prefix}:user:{user_id}:*"

        self._delete_pattern(pattern)

    def invalidate_role(self, role_id: int) -> None:
        """
        Invalidate cached data for role.

        Called when:
        - Permission added/removed from role
        - Role deleted

        Note: This requires invalidating all users with this role.
        For simplicity, we invalidate by role pattern.
        """
        if not self.redis:
            return

        pattern = f"{self.prefix}:role:{role_id}:*"
        self._delete_pattern(pattern)

        # Also invalidate all permission caches
        # (since we don't track user→role mapping in cache)
        pattern = f"{self.prefix}:perm:*"
        self._delete_pattern(pattern)

    def invalidate_org(self, org_id: int) -> None:
        """
        Invalidate all cached data for organization.

        Called when:
        - Bulk role changes
        - Organization-wide permission updates
        """
        if not self.redis:
            return

        pattern = f"{self.prefix}:*:org:{org_id}:*"
        self._delete_pattern(pattern)

    # ========================================================================
    # Helpers
    # ========================================================================

    def _permission_key(
        self,
        user_id: int,
        permission: str,
        org_id: int | None,
        resource_id: str | None,
    ) -> str:
        """Build cache key for permission check."""
        parts = [self.prefix, "perm", str(user_id), permission]

        if org_id:
            parts.extend(["org", str(org_id)])

        if resource_id:
            # Hash resource_id to keep key length reasonable
            resource_hash = hashlib.md5(resource_id.encode()).hexdigest()[:8]
            parts.extend(["res", resource_hash])

        return ":".join(parts)

    def _delete_pattern(self, pattern: str) -> None:
        """Delete all keys matching pattern."""
        if not self.redis:
            return

        try:
            cursor = 0
            while True:
                cursor, keys = self.redis.scan(cursor, match=pattern, count=100)
                if keys:
                    self.redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            logger.exception(f"Cache delete pattern error: {e}")
