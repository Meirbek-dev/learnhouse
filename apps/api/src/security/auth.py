import logging
import uuid
from datetime import UTC, datetime, timedelta

from authlib.jose import JoseError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.security.keys import get_private_key, get_public_key
from src.security.rbac import AuthenticationRequired
from src.security.auth_cookies import ACCESS_COOKIE_KEY
from src.services.auth.sessions import get_session_by_id
from src.services.cache.redis_client import get_async_redis_client

logger = logging.getLogger(__name__)

AUTH_TOKEN_ISSUER = "ashyq-bilim-auth"
AUTH_TOKEN_AUDIENCE = "ashyq-bilim-api"
ACCESS_TOKEN_EXPIRE = timedelta(minutes=30)
REFRESH_TOKEN_EXPIRE = timedelta(days=7)  # sliding; hard cap 30 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login", auto_error=False
)

JTI_BLOCKLIST_PREFIX = "jti:"


# ── Token models ─────────────────────────────────────────────────────────────


class TokenData(PydanticStrictBaseModel):
    user_uuid: str
    session_id: str | None = None
    jti: str | None = None
    roles: list[str] = []


# ── Internal helpers ─────────────────────────────────────────────────────────


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _generate_jti() -> str:
    return str(uuid.uuid4())


# ── Token creation ────────────────────────────────────────────────────────────


def create_access_token(
    *,
    user_uuid: str,
    session_id: str,
    roles: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(UTC)
    expire = now + (expires_delta or ACCESS_TOKEN_EXPIRE)
    payload = {
        "sub": user_uuid,
        "jti": _generate_jti(),
        "sid": session_id,
        "iss": AUTH_TOKEN_ISSUER,
        "aud": AUTH_TOKEN_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "roles": roles or [],
        "type": "access",
    }
    token = jwt.encode({"alg": "EdDSA", "kid": "v1"}, payload, get_private_key())
    return token.decode("utf-8") if isinstance(token, bytes) else token


def get_access_token_expiry_ms(expires_delta: timedelta | None = None) -> int:
    expire = datetime.now(UTC) + (expires_delta or ACCESS_TOKEN_EXPIRE)
    return int(expire.timestamp() * 1000)


# ── Token decoding ────────────────────────────────────────────────────────────


def _decode_token_claims(token: str) -> dict:
    """Decode and validate a JWT, returning its claims dict."""
    try:
        claims = jwt.decode(
            token,
            get_public_key(),
            claims_options={
                "iss": {"essential": True, "value": AUTH_TOKEN_ISSUER},
                "aud": {"essential": True, "value": AUTH_TOKEN_AUDIENCE},
            },
        )
        claims.validate()
        return dict(claims)
    except JoseError as exc:
        raise _credentials_exception() from exc


def decode_access_token(token: str) -> TokenData:
    payload = _decode_token_claims(token)
    if payload.get("type") != "access":
        raise _credentials_exception()
    user_uuid = payload.get("sub")
    if not isinstance(user_uuid, str) or not user_uuid:
        raise _credentials_exception()
    roles = payload.get("roles", [])
    if not isinstance(roles, list):
        roles = []
    return TokenData(
        user_uuid=user_uuid,
        session_id=payload.get("sid"),
        jti=payload.get("jti"),
        roles=[r for r in roles if isinstance(r, str)],
    )


def decode_token_unverified(token: str) -> dict:
    """Decode JWT payload WITHOUT signature verification.

    SAFE USE ONLY: This is intentionally used during token rotation (refresh
    endpoint) to extract the JTI of the OLD access token so it can be
    blocklisted AFTER the new session has been successfully created.

    The security invariant is maintained because:
    1. The refresh token has already been fully verified against Redis.
    2. We are only ADDING an entry to the JTI blocklist (deny-only operation).
    3. Even if an attacker injects a fake JTI here, the worst case is a
       spurious blocklist entry — no tokens are unblocked.

    DO NOT use this function to make authorization decisions.
    """
    import base64
    import json

    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        padding = (-len(parts[1])) % 4
        decoded = base64.urlsafe_b64decode(parts[1] + "=" * padding)
        return json.loads(decoded)
    except Exception:
        return {}


# ── JTI blocklist (async) ─────────────────────────────────────────────────────


async def blocklist_jti(jti: str, remaining_seconds: int) -> None:
    """Add a JTI to the Redis revocation blocklist (async)."""
    r = get_async_redis_client()
    if r and remaining_seconds > 0:
        await r.set(f"{JTI_BLOCKLIST_PREFIX}{jti}", "1", ex=remaining_seconds)


async def is_jti_blocklisted(jti: str) -> bool:
    r = get_async_redis_client()
    if not r:
        return False
    return bool(await r.exists(f"{JTI_BLOCKLIST_PREFIX}{jti}"))


# ── User lookup ───────────────────────────────────────────────────────────────


def _get_user_by_uuid(db_session: Session, user_uuid: str) -> User | None:
    return db_session.exec(select(User).where(User.user_uuid == user_uuid)).first()


# ── FastAPI dependencies ──────────────────────────────────────────────────────


def get_access_token_from_request(
    request: Request,
    header_token: str | None = None,
) -> str | None:
    if isinstance(header_token, str) and header_token.strip():
        return header_token
    cookie_token = request.cookies.get(ACCESS_COOKIE_KEY)
    if isinstance(cookie_token, str) and cookie_token.strip():
        return cookie_token
    return None


async def get_current_user_from_token(
    request: Request,
    token: str,
    db_session: Session,
) -> PublicUser:
    token_data = decode_access_token(token)

    # JTI blocklist check (covers explicitly revoked / logged-out tokens)
    if token_data.jti and await is_jti_blocklisted(token_data.jti):
        raise _credentials_exception()

    if not token_data.session_id:
        raise _credentials_exception()

    session = await get_session_by_id(token_data.session_id)
    if session is None or session.user_uuid != token_data.user_uuid:
        raise _credentials_exception()

    user = _get_user_by_uuid(db_session, token_data.user_uuid)
    if user is None:
        raise _credentials_exception()
    return PublicUser(**user.model_dump())


async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme_optional),
    db_session: Session = Depends(get_db_session),
) -> PublicUser:
    resolved_token = get_access_token_from_request(request, token)
    if resolved_token is None:
        raise _credentials_exception()
    return await get_current_user_from_token(request, resolved_token, db_session)


async def get_current_user_bearer(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db_session: Session = Depends(get_db_session),
) -> PublicUser:
    return await get_current_user_from_token(request, token, db_session)


async def get_current_user_optional(
    request: Request,
    token: str | None = Depends(oauth2_scheme_optional),
    db_session: Session = Depends(get_db_session),
) -> PublicUser | AnonymousUser:
    resolved_token = get_access_token_from_request(request, token)
    if resolved_token is None:
        return AnonymousUser()
    try:
        return await get_current_user_from_token(request, resolved_token, db_session)
    except HTTPException:
        return AnonymousUser()


async def authenticate_user(
    request: Request,
    email: str,
    password: str,
    db_session: Session,
) -> User | None:
    from src.services.users.users import (
        security_get_user,
        security_verify_password as verify,
    )

    user = await security_get_user(request, db_session, email)
    if not user:
        return None
    if not verify(password, user.password):
        return None
    return user


async def non_public_endpoint(current_user: UserRead | AnonymousUser) -> None:
    if isinstance(current_user, AnonymousUser):
        raise AuthenticationRequired
