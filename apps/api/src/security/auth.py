import logging
from datetime import UTC, datetime, timedelta

from authlib.jose import JoseError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.auth_sessions import AuthSession
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.security.rbac import AuthenticationRequired
from src.security.auth_cookies import ACCESS_COOKIE_KEY
from src.security.security import ALGORITHM, get_secret_key
from src.services.users.users import security_get_user, security_verify_password

logger = logging.getLogger(__name__)

ACCESS_TOKEN_EXPIRE = timedelta(hours=8)
REFRESH_TOKEN_EXPIRE = timedelta(days=30)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login", auto_error=False
)


class Token(PydanticStrictBaseModel):
    access_token: str
    token_type: str


class TokenData(PydanticStrictBaseModel):
    username: str | None = None
    session_id: str | None = None


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_token(token: str, expected_type: str) -> TokenData:
    try:
        claims = jwt.decode(token, get_secret_key())
        claims.validate()
        payload = dict(claims)
    except JoseError as exc:
        raise _credentials_exception() from exc

    token_type = payload.get("type")
    username = payload.get("sub")
    session_id = payload.get("sid")

    if token_type != expected_type or not isinstance(username, str) or not username:
        raise _credentials_exception()

    if session_id is not None and not isinstance(session_id, str):
        raise _credentials_exception()

    return TokenData(username=username, session_id=session_id)


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
    issued_at = datetime.now(UTC)
    expire = issued_at + (expires_delta or ACCESS_TOKEN_EXPIRE)
    to_encode.update(
        {
            "exp": int(expire.timestamp()),
            "iat": int(issued_at.timestamp()),
            "iss": "ashyq-bilim-api",
            "aud": "ashyq-bilim-web",
            "type": "access",
        }
    )
    token = jwt.encode({"alg": ALGORITHM, "typ": "JWT"}, to_encode, get_secret_key())
    return token.decode("utf-8") if isinstance(token, bytes) else token


def get_access_token_expiry_timestamp(expires_delta: timedelta | None = None) -> int:
    expire = datetime.now(UTC) + (expires_delta or ACCESS_TOKEN_EXPIRE)
    return int(expire.timestamp() * 1000)


def decode_access_token(token: str) -> TokenData:
    return _decode_token(token, expected_type="access")


def decode_refresh_token(token: str) -> TokenData:
    return _decode_token(token, expected_type="refresh")


def get_access_token_from_request(
    request: Request,
    header_token: str | None = None,
) -> str | None:
    request_state_token = getattr(request.state, "resolved_access_token", None)
    if isinstance(request_state_token, str) and request_state_token.strip():
        return request_state_token

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
    if token_data.session_id:
        auth_session = db_session.exec(
            select(AuthSession).where(AuthSession.session_id == token_data.session_id)
        ).first()
        if auth_session is None or auth_session.revoked_at is not None:
            raise _credentials_exception()
        if auth_session.expires_at <= datetime.now(UTC):
            raise _credentials_exception()

    user = await security_get_user(request, db_session, email=token_data.username)
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
    return await get_current_user_from_token(request, resolved_token, db_session)


async def non_public_endpoint(current_user: UserRead | AnonymousUser) -> None:
    if isinstance(current_user, AnonymousUser):
        raise AuthenticationRequired
