import logging
import secrets
from datetime import UTC, datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi_another_jwt_auth import AuthJWT
from sqlmodel import Session

from config.config import get_platform_config
from src.core.events.database import get_db_session
from src.db.permissions.generated_enums import Action, ResourceType
from src.security.permissions.exceptions import AuthenticationRequired
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.security.security import ALGORITHM, SECRET_KEY
from src.services.dev.dev import isDevModeEnabled
from src.services.users.users import security_get_user, security_verify_password

logger = logging.getLogger(__name__)


def _normalize_secure_flag(value: bool | str | None) -> bool:
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "on"}:
            return True
        if lowered in {"false", "0", "no", "off"}:
            return False
    return bool(value)


_PLATFORM_CONFIG = get_platform_config()
_COOKIE_DOMAIN = _PLATFORM_CONFIG.hosting_config.cookie_config.domain
_COOKIE_SECURE = _normalize_secure_flag(_PLATFORM_CONFIG.hosting_config.ssl)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


#### JWT Auth ####################################################


# Generate a secure JWT secret for development mode if not provided
def _get_jwt_secret() -> str:
    """
    Get JWT secret key with secure fallback for development.

    Security improvements:
    - Auto-generates secure random key in dev mode
    - Logs warning when using generated key
    """
    if SECRET_KEY:
        return SECRET_KEY

    # Only generate in dev mode, production must have SECRET_KEY
    if isDevModeEnabled():
        generated_key = secrets.token_urlsafe(32)
        logger.warning(
            "⚠️  Using auto-generated JWT secret in development mode. "
            "Set PLATFORM_AUTH_JWT_SECRET_KEY environment variable for production."
        )
        return generated_key

    # Production without SECRET_KEY should fail explicitly
    msg = (
        "PLATFORM_AUTH_JWT_SECRET_KEY must be set in production environment. "
        "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
    )
    raise ValueError(msg)


class Settings(PydanticStrictBaseModel):
    authjwt_secret_key: str = _get_jwt_secret()
    authjwt_token_location: set[str] = {"cookies", "headers"}
    authjwt_cookie_csrf_protect: bool = False
    authjwt_access_token_expires: float | bool = (
        False if isDevModeEnabled() else timedelta(hours=8).total_seconds()
    )
    authjwt_cookie_samesite: str = "lax"
    authjwt_cookie_secure: bool = _COOKIE_SECURE
    authjwt_cookie_domain: str | None = _COOKIE_DOMAIN


@AuthJWT.load_config
def get_config() -> Settings:
    return Settings()


#### JWT Auth ####################################################


#### Classes ####################################################


class Token(PydanticStrictBaseModel):
    access_token: str
    token_type: str


class TokenData(PydanticStrictBaseModel):
    username: str | None = None


#### Classes ####################################################
async def authenticate_user(
    request: Request,
    email: str,
    password: str,
    db_session: Session,
) -> User | bool:
    user = await security_get_user(request, db_session, email)
    if not user:
        return False
    if not security_verify_password(password, user.password):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    Authorize: AuthJWT = Depends(),
    db_session=Depends(get_db_session),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        Authorize.jwt_optional()
        username = Authorize.get_jwt_subject() or None
        token_data = TokenData(username=username)
    except jwt.PyJWTError:
        raise credentials_exception
    if username:
        user = await security_get_user(
            request, db_session, email=token_data.username
        )  # treated as an email
        if user is None:
            raise credentials_exception
        return PublicUser(**user.model_dump())
    return AnonymousUser()


async def non_public_endpoint(current_user: UserRead | AnonymousUser) -> None:
    if isinstance(current_user, AnonymousUser):
        raise AuthenticationRequired(
            resource_type=ResourceType.API, action=Action.ACCESS
        )
