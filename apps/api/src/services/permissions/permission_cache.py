"""
Permission caching service using Redis.

Provides efficient caching for:
- User roles (per user, per org)
- Permission lookups
- Role permissions

Cache invalidation is handled by key patterns:
- rbac:user:{user_id}:* - All user permissions
- rbac:role:{role_id}:* - All role permissions
- rbac:org:{org_id}:* - All org-level permissions

Includes cache locking to prevent race conditions.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Generator, TypedDict

from src.services.cache.redis_client import (
    delete_keys,
    get_json,
    get_redis_client,
    set_json,
)

_logger = logging.getLogger(__name__)

# Cache TTL in seconds
PERMISSION_CACHE_TTL = 300  # 5 minutes
ROLE_CACHE_TTL = 600  # 10 minutes
USER_ROLES_CACHE_TTL = 300  # 5 minutes
CACHE_LOCK_TTL = 10  # 10 seconds for locks


class CachedPermission(TypedDict):
    """Structure for cached permission data."""

    allowed: bool
    scope: str | None
    conditions: dict | None


class CachedUserRoles(TypedDict):
    """Structure for cached user roles."""

    role_ids: list[int]
    role_names: list[str]


# --- Key Builders ---


def _user_roles_key(user_id: int, org_id: int | None = None) -> str:
    """Build cache key for user roles."""
    if org_id:
        return f"rbac:user:{user_id}:org:{org_id}:roles"
    return f"rbac:user:{user_id}:roles"


def _permission_key(
    user_id: int,
    action: str,
    resource: str,
    resource_id: str | None = None,
    org_id: int | None = None,
) -> str:
    """Build cache key for permission check result."""
    base = f"rbac:perm:{user_id}:{action}:{resource}"
    if resource_id:
        base = f"{base}:{resource_id}"
    if org_id:
        base = f"{base}:org:{org_id}"
    return base


def _role_permissions_key(role_id: int) -> str:
    """Build cache key for role permissions."""
    return f"rbac:role:{role_id}:permissions"


# --- Cache Locking ---


@contextmanager
def cache_lock(lock_key: str, timeout: int = CACHE_LOCK_TTL) -> Generator[bool, None, None]:
    """
    Context manager for distributed cache locking using Redis.
    
    Prevents race conditions when multiple processes try to compute
    the same cache value simultaneously.
    
    Args:
        lock_key: Unique key for this lock
        timeout: Lock timeout in seconds (default 10s)
        
    Yields:
        True if lock was acquired, False otherwise
        
    Example:
        with cache_lock("my_key:lock") as acquired:
            if acquired:
                # Do expensive computation
                result = compute_value()
                set_cache("my_key", result)
    """
    r = get_redis_client()
    lock_acquired = False
    
    if not r:
        # No Redis available, just proceed without locking
        yield False
        return
    
    try:
        # Try to acquire lock (SET NX - set if not exists)
        lock_acquired = r.set(lock_key, "1", ex=timeout, nx=True)
        yield bool(lock_acquired)
    finally:
        # Release lock if we acquired it
        if lock_acquired:
            try:
                r.delete(lock_key)
            except Exception:
                _logger.exception("Failed to release cache lock: %s", lock_key)


def _user_permissions_key(user_id: int, org_id: int | None = None) -> str:
    """Build cache key for user's effective permissions."""
    if org_id:
        return f"rbac:user:{user_id}:org:{org_id}:all_permissions"
    return f"rbac:user:{user_id}:all_permissions"


# --- Cache Operations ---


def get_cached_user_roles(
    user_id: int, org_id: int | None = None
) -> CachedUserRoles | None:
    """Get cached user roles."""
    key = _user_roles_key(user_id, org_id)
    data = get_json(key)
    if data:
        return CachedUserRoles(
            role_ids=data.get("role_ids", []),
            role_names=data.get("role_names", []),
        )
    return None


def set_cached_user_roles(
    user_id: int,
    role_ids: list[int],
    role_names: list[str],
    org_id: int | None = None,
) -> None:
    """Cache user roles."""
    key = _user_roles_key(user_id, org_id)
    set_json(
        key,
        {"role_ids": role_ids, "role_names": role_names},
        PERMISSION_CACHE_TTL,
    )


def get_cached_permission(
    user_id: int,
    action: str,
    resource: str,
    resource_id: str | None = None,
    org_id: int | None = None,
) -> CachedPermission | None:
    """Get cached permission check result."""
    key = _permission_key(user_id, action, resource, resource_id, org_id)
    data = get_json(key)
    if data:
        return CachedPermission(
            allowed=data.get("allowed", False),
            scope=data.get("scope"),
            conditions=data.get("conditions"),
        )
    return None


def set_cached_permission(
    user_id: int,
    action: str,
    resource: str,
    allowed: bool,
    resource_id: str | None = None,
    org_id: int | None = None,
    scope: str | None = None,
    conditions: dict | None = None,
) -> None:
    """Cache permission check result."""
    key = _permission_key(user_id, action, resource, resource_id, org_id)
    set_json(
        key,
        {"allowed": allowed, "scope": scope, "conditions": conditions},
        PERMISSION_CACHE_TTL,
    )


def get_cached_role_permissions(role_id: int) -> list[str] | None:
    """Get cached role permissions."""
    key = _role_permissions_key(role_id)
    data = get_json(key)
    if data:
        return data.get("permissions", [])
    return None


def set_cached_role_permissions(role_id: int, permissions: list[str]) -> None:
    """Cache role permissions."""
    key = _role_permissions_key(role_id)
    set_json(key, {"permissions": permissions}, ROLE_CACHE_TTL)


def get_cached_user_permissions(
    user_id: int, org_id: int | None = None
) -> dict[str, bool] | None:
    """Get cached user effective permissions."""
    key = _user_permissions_key(user_id, org_id)
    return get_json(key)


def set_cached_user_permissions(
    user_id: int,
    permissions: dict[str, bool],
    org_id: int | None = None,
) -> None:
    """Cache user effective permissions."""
    key = _user_permissions_key(user_id, org_id)
    set_json(key, permissions, PERMISSION_CACHE_TTL)


# --- Cache Invalidation ---


def invalidate_user_permissions(user_id: int) -> None:
    """Invalidate all cached permissions for a user."""
    r = get_redis_client()
    if not r:
        return
    try:
        # Find and delete all keys matching pattern
        pattern = f"rbac:user:{user_id}:*"
        keys = list(r.scan_iter(match=pattern, count=100))
        if keys:
            r.delete(*keys)

        # Also delete permission checks for this user
        perm_pattern = f"rbac:perm:{user_id}:*"
        perm_keys = list(r.scan_iter(match=perm_pattern, count=100))
        if perm_keys:
            r.delete(*perm_keys)
    except Exception:
        _logger.exception("Failed to invalidate user permissions: user_id=%s", user_id)


def invalidate_role_permissions(role_id: int) -> None:
    """Invalidate all cached permissions for a role."""
    r = get_redis_client()
    if not r:
        return
    try:
        pattern = f"rbac:role:{role_id}:*"
        keys = list(r.scan_iter(match=pattern, count=100))
        if keys:
            r.delete(*keys)
    except Exception:
        _logger.exception("Failed to invalidate role permissions: role_id=%s", role_id)


def invalidate_org_permissions(org_id: int) -> None:
    """Invalidate all cached permissions for an organization."""
    r = get_redis_client()
    if not r:
        return
    try:
        pattern = f"rbac:*:org:{org_id}:*"
        keys = list(r.scan_iter(match=pattern, count=100))
        if keys:
            r.delete(*keys)
    except Exception:
        _logger.exception("Failed to invalidate org permissions: org_id=%s", org_id)


def invalidate_all_permissions() -> None:
    """Invalidate all RBAC cache entries."""
    r = get_redis_client()
    if not r:
        return
    try:
        pattern = "rbac:*"
        keys = list(r.scan_iter(match=pattern, count=1000))
        if keys:
            r.delete(*keys)
    except Exception:
        _logger.exception("Failed to invalidate all permissions")
