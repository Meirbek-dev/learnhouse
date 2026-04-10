"""Email verification via signed single-use JWT token (link in email).

Grace period: users may log in for 24 hours without verification.
After the grace period, unverified users are redirected to a
"please verify your email" page on protected routes (enforced in proxy.ts).
"""

import logging
import time
import uuid
from datetime import UTC, datetime

from authlib.jose import JoseError, jwt
from fastapi import HTTPException
from sqlmodel import Session, select

from src.db.users import User, UserRead
from src.security.keys import get_private_key, get_public_key
from src.services.cache.redis_client import get_async_redis_client
from src.services.users.emails import send_email_verification_email

logger = logging.getLogger(__name__)

VERIFICATION_TOKEN_TTL = 24 * 60 * 60  # 24 hours
VERIFICATION_JTI_PREFIX = "verify_jti:"
VERIFICATION_GRACE_PERIOD_HOURS = 24


def _create_verification_token(user_uuid: str, email: str) -> tuple[str, str]:
    """Create a signed verification token. Returns (token_str, jti)."""
    jti = str(uuid.uuid4())
    now = int(time.time())
    payload = {
        "sub": user_uuid,
        "email": email,
        "jti": jti,
        "type": "email_verification",
        "iat": now,
        "exp": now + VERIFICATION_TOKEN_TTL,
    }
    token = jwt.encode({"alg": "EdDSA"}, payload, get_private_key())
    token_str = token.decode("utf-8") if isinstance(token, bytes) else token
    return token_str, jti


def _verify_verification_token(token: str) -> dict:
    """Decode and validate a verification token."""
    try:
        claims = jwt.decode(token, get_public_key())
        claims.validate()
        payload = dict(claims)
    except JoseError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid or expired verification token"
        ) from exc

    if payload.get("type") != "email_verification":
        raise HTTPException(status_code=400, detail="Invalid token type")
    return payload


async def send_verification_email(
    db_session: Session,
    user: User | UserRead,
) -> str:
    """Send a verification email to the user.

    Returns a success message. Always succeeds to prevent enumeration.
    """
    r = get_async_redis_client()
    if not r:
        logger.error("Redis unavailable for email verification")
        raise HTTPException(status_code=500, detail="Service temporarily unavailable")

    user_uuid = str(user.user_uuid)
    email = str(user.email)

    token_str, jti = _create_verification_token(user_uuid, email)

    # Store JTI as "pending" to enforce single-use
    await r.set(f"{VERIFICATION_JTI_PREFIX}{jti}", "pending", ex=VERIFICATION_TOKEN_TTL)

    user_read = user if isinstance(user, UserRead) else UserRead.model_validate(user)
    try:
        send_email_verification_email(
            user=user_read,
            email=email,
            verification_token=token_str,
        )
    except Exception:
        logger.exception("Failed to send verification email for %s", email)

    return "Verification email sent"


async def verify_email_with_token(
    db_session: Session,
    token: str,
) -> str:
    """Verify a user's email address using the token from the verification link."""
    r = get_async_redis_client()
    if not r:
        raise HTTPException(status_code=500, detail="Service temporarily unavailable")

    payload = _verify_verification_token(token)
    jti = payload.get("jti", "")
    user_uuid = payload.get("sub", "")
    token_email = payload.get("email", "")

    # Single-use check
    jti_key = f"{VERIFICATION_JTI_PREFIX}{jti}"
    if not await r.exists(jti_key):
        raise HTTPException(
            status_code=400, detail="Verification token has already been used or expired"
        )

    user = db_session.exec(select(User).where(User.user_uuid == user_uuid)).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    # Ensure the token email matches the current user email
    if str(user.email).lower() != token_email.lower():
        raise HTTPException(
            status_code=400,
            detail="Email address has changed since this verification was sent",
        )

    # Consume the JTI atomically
    await r.delete(jti_key)

    # Mark email as verified
    user.email_verified = True
    user.email_verified_at = datetime.now(UTC)
    db_session.add(user)
    db_session.commit()

    return "Email verified successfully"


def is_within_grace_period(user: User) -> bool:
    """Check if the user is within the verification grace period.

    Returns True if the user was created less than VERIFICATION_GRACE_PERIOD_HOURS
    ago, meaning they can still access protected routes without verification.
    """
    if user.email_verified:
        return True  # Already verified

    now = datetime.now(UTC)
    created = user.created_at
    if not isinstance(created, datetime):
        return True  # Can't determine, allow access

    if created.tzinfo is None:
        # Assume UTC for naive datetimes
        from datetime import timezone

        created = created.replace(tzinfo=timezone.utc)

    hours_since_creation = (now - created).total_seconds() / 3600
    return hours_since_creation < VERIFICATION_GRACE_PERIOD_HOURS
