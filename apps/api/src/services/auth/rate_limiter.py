"""Redis sliding-window rate limiter for auth endpoints.

Uses a sorted set per key: members are random tokens, scores are timestamps.
"""

import secrets
import time

from src.services.cache.redis_client import get_redis_client


class RateLimitExceeded(Exception):
    """Raised when the rate limit for an action is exceeded."""

    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded. Retry after {retry_after}s")


def check_rate_limit(
    *,
    key: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    """Check a sliding-window rate limit.

    Raises RateLimitExceeded if the limit is breached.
    key: unique identifier (e.g. "login:ip:1.2.3.4" or "login:email:foo@bar.com")
    """
    r = get_redis_client()
    if not r:
        return  # Redis unavailable – fail open (do not block auth)

    now = time.time()
    window_start = now - window_seconds
    redis_key = f"rl:{key}"

    pipe = r.pipeline()
    # Remove entries outside the window
    pipe.zremrangebyscore(redis_key, 0, window_start)
    # Count entries within the window
    pipe.zcard(redis_key)
    # Add current request
    pipe.zadd(redis_key, {secrets.token_hex(8): now})
    # Expire the set after the window
    pipe.expire(redis_key, window_seconds + 1)
    results = pipe.execute()

    current_count = results[1]
    if current_count >= max_requests:
        raise RateLimitExceeded(retry_after=window_seconds)


def check_account_locked(email: str) -> bool:
    """Return True if the account is currently locked due to too many failures."""
    r = get_redis_client()
    if not r:
        return False
    return bool(r.exists(f"account_locked:{email.lower()}"))


def record_login_failure(
    email: str, *, lock_after: int = 5, lock_duration: int = 900
) -> None:
    """Record a failed login attempt and lock the account if threshold is reached."""
    r = get_redis_client()
    if not r:
        return

    counter_key = f"login_failures:{email.lower()}"
    count = r.incr(counter_key)
    r.expire(counter_key, lock_duration)

    if count >= lock_after:
        r.set(f"account_locked:{email.lower()}", "1", ex=lock_duration)


def clear_login_failures(email: str) -> None:
    """Clear the failure counter on successful login."""
    r = get_redis_client()
    if not r:
        return
    r.delete(f"login_failures:{email.lower()}")
