import base64
import json
import logging
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from config.config import get_settings
from src.core.events.database import get_db_session
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, PublicUser, UserRead
from src.security.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_access_token_from_request,
    get_current_user_optional,
    oauth2_scheme_optional,
)
from src.services.auth.google_oauth import (
    consume_exchange_code,
    create_exchange_code,
    exchange_google_code,
    get_google_authorize_url,
)
from src.services.auth.utils import find_or_create_google_user

router = APIRouter()
logger = logging.getLogger(__name__)


class TokensResponse(PydanticStrictBaseModel):
    access_token: str
    refresh_token: str
    expiry: int


class LoginResponse(PydanticStrictBaseModel):
    user: UserRead
    tokens: TokensResponse


COOKIE_TTL_SECONDS = int(timedelta(hours=8).total_seconds())
REFRESH_COOKIE_TTL_SECONDS = int(timedelta(days=30).total_seconds())
ACCESS_COOKIE_KEY = "access_token_cookie"
REFRESH_COOKIE_KEY = "refresh_token_cookie"


def _set_access_cookie(response: Response, value: str) -> None:
    """
    Set access token cookie with secure configuration.

    Security features:
    - httponly=True: Prevents JavaScript access (XSS protection)
    - secure=True: HTTPS only (when SSL is enabled)
    - samesite='lax': CSRF protection while allowing normal navigation
    """
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain
    is_ssl_enabled = settings.hosting_config.ssl

    cookie_kwargs: dict[str, object] = {
        "httponly": True,  # ✅ Prevent XSS attacks
        "secure": bool(is_ssl_enabled),  # ✅ HTTPS only in production
        "samesite": "lax",  # ✅ CSRF protection
        "expires": COOKIE_TTL_SECONDS,
    }

    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain

    response.set_cookie(
        key=ACCESS_COOKIE_KEY,
        value=value,
        **cookie_kwargs,
    )


def _set_refresh_cookie(response: Response, value: str) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain
    is_ssl_enabled = settings.hosting_config.ssl

    cookie_kwargs: dict[str, object] = {
        "httponly": True,
        "secure": is_ssl_enabled,
        "samesite": "lax",
        "max_age": REFRESH_COOKIE_TTL_SECONDS,
    }

    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain

    response.set_cookie(
        key=REFRESH_COOKIE_KEY,
        value=value,
        **cookie_kwargs,
    )


def _clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain

    delete_kwargs: dict[str, object] = {}
    if cookie_domain:
        delete_kwargs["domain"] = cookie_domain

    response.delete_cookie(ACCESS_COOKIE_KEY, **delete_kwargs)
    response.delete_cookie(REFRESH_COOKIE_KEY, **delete_kwargs)


@router.get("/refresh")
def refresh(
    request: Request,
    response: Response,
) -> dict[str, str | int]:
    """
    Token refresh with rotation.

    Security features:
    - Issues new refresh token on each use (token rotation)
    - Invalidates old refresh token
    - Logs refresh events for monitoring
    - Returns both new access and refresh tokens

    This prevents stolen refresh tokens from being used indefinitely.
    """
    refresh_token = request.cookies.get(REFRESH_COOKIE_KEY)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = decode_refresh_token(refresh_token)
    current_user = token_data.username

    # Create NEW tokens (both access and refresh)
    new_access_token = create_access_token({"sub": current_user})
    new_refresh_token = create_refresh_token({"sub": current_user})

    # Set the new refresh token in cookies (this invalidates the old one)
    _set_refresh_cookie(response, new_refresh_token)

    # Calculate token expiry timestamp (8 hours from now in milliseconds)
    expiry_timestamp = int(
        (datetime.now().timestamp() + timedelta(hours=8).total_seconds()) * 1000
    )

    # Log token refresh with rotation
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        "Token refresh with rotation",
        extra={
            "email": current_user,
            "ip_address": client_ip,
            "rotation": True,
        },
    )

    _set_access_cookie(response, new_access_token)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,  # Return new refresh token
        "expiry": expiry_timestamp,
    }


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    response: Response,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    # Extract client info for security logging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    user = await authenticate_user(
        request, form_data.username, form_data.password, db_session
    )

    if not user:
        # Log failed authentication attempt
        logger.warning(
            "Failed login attempt",
            extra={
                "email": form_data.username,
                "ip_address": client_ip,
                "user_agent": user_agent,
                "reason": "invalid_credentials",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token({"sub": form_data.username})
    refresh_token = create_refresh_token({"sub": form_data.username})
    _set_refresh_cookie(response, refresh_token)

    # set cookies using fastapi
    _set_access_cookie(response, access_token)

    user_read = UserRead.model_validate(user)

    # Calculate token expiry timestamp (8 hours from now in milliseconds)
    expiry_timestamp = int(
        (datetime.now().timestamp() + timedelta(hours=8).total_seconds()) * 1000
    )

    # Log successful authentication
    logger.info(
        "Successful login",
        extra={
            "user_id": user.id,
            "email": user.email,
            "ip_address": client_ip,
            "user_agent": user_agent,
        },
    )

    return {
        "user": user_read,
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expiry": expiry_timestamp,
        },
    }


@router.delete("/logout")
def logout(
    request: Request,
    response: Response,
    token: Annotated[str | None, Depends(oauth2_scheme_optional)],
) -> dict[str, str]:
    """
    Because the JWT are stored in an httponly cookie now, we cannot
    log the user out by simply deleting the cookies in the frontend.
    We need the backend to send us a response to delete the cookies.
    """
    resolved_token = get_access_token_from_request(request, token)
    if not resolved_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user info before logout for logging
    token_data = decode_access_token(resolved_token)
    current_user = token_data.username
    client_ip = request.client.host if request.client else "unknown"

    # Log logout event
    logger.info(
        "User logout",
        extra={
            "email": current_user,
            "ip_address": client_ip,
        },
    )

    _clear_auth_cookies(response)
    return {"msg": "Successfully logout"}


# ── Backend-driven Google OAuth (Authorization Code flow) ─────────────────────
#
# Flow:
#   1. Frontend  →  GET /auth/google/authorize?callback=<frontend-url>
#      Backend builds a Google OAuth URL (includes the callback in state) and
#      redirects the browser to Google's consent screen.
#
#   2. Google    →  GET /auth/google/callback?code=...&state=...
#      Backend exchanges the code for a Google access token, fetches user info,
#      finds or creates the local user, issues our JWT pair, stores them under a
#      short-lived exchange code, and redirects the browser back to the frontend.
#
#   3. Frontend  →  POST /auth/google/exchange  { "code": "<exchange-code>" }
#      NextAuth's credentials provider calls this to trade the exchange code for
#      the user + token payload, which NextAuth then stores in its session JWT.
#
# The Google client ID and secret live exclusively in the backend
# (PLATFORM_GOOGLE_CLIENT_ID / PLATFORM_GOOGLE_CLIENT_SECRET).  The Next.js
# layer no longer needs GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.


def _get_backend_callback_url() -> str:
    """Return the redirect_uri that must be registered in Google Cloud Console.

    Prefers the explicit PLATFORM_GOOGLE_REDIRECT_URI env var, which must match
    the URI registered in Google Cloud Console exactly.  Falls back to
    constructing the URL from PLATFORM_DOMAIN / PLATFORM_PORT / PLATFORM_SSL
    for simpler deployments.
    """
    settings = get_settings()
    if settings.google_oauth.redirect_uri:
        return settings.google_oauth.redirect_uri

    hosting = settings.hosting_config
    protocol = "https" if hosting.ssl else "http"
    port = hosting.port
    domain = hosting.domain
    if (protocol == "http" and port == 80) or (protocol == "https" and port == 443):
        base = f"{protocol}://{domain}"
    else:
        base = f"{protocol}://{domain}:{port}"
    return f"{base}/api/v1/auth/google/callback"


@router.get("/google/authorize")
async def google_authorize(callback: str) -> RedirectResponse:
    """
    Redirect the browser to Google's OAuth consent screen.

    `callback` is the frontend URL that the backend will redirect to after a
    successful OAuth exchange (e.g. https://app.example.com/auth/google).
    It is carried through the OAuth `state` parameter.
    """
    settings = get_settings()
    google_cfg = settings.google_oauth

    if not google_cfg.client_id or not google_cfg.client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured on this server",
        )

    state = base64.urlsafe_b64encode(json.dumps({"callback": callback}).encode()).decode()
    url = get_google_authorize_url(
        client_id=google_cfg.client_id,
        redirect_uri=_get_backend_callback_url(),
        state=state,
    )
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    response: Response,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    current_user: Annotated[
        PublicUser | AnonymousUser, Depends(get_current_user_optional)
    ] = None,
    db_session: Session = Depends(get_db_session),
) -> RedirectResponse:
    """
    Handle Google's redirect after the user consents.

    Exchanges the authorization code for user info, finds/creates the local
    user, issues our JWT pair, and redirects the browser back to the frontend
    with a short-lived exchange code.
    """
    # Decode state to get the frontend callback URL
    frontend_callback = "/"
    if state:
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state + "=="))
            frontend_callback = state_data.get("callback", "/")
        except Exception:
            pass

    if error or not code:
        logger.warning("Google OAuth error or missing code", extra={"error": error})
        return RedirectResponse(f"{frontend_callback}?error=oauth_failed")

    settings = get_settings()
    google_cfg = settings.google_oauth

    if not google_cfg.client_id or not google_cfg.client_secret:
        return RedirectResponse(f"{frontend_callback}?error=not_configured")

    try:
        google_user = await exchange_google_code(
            client_id=google_cfg.client_id,
            client_secret=google_cfg.client_secret,
            code=code,
            redirect_uri=_get_backend_callback_url(),
        )
    except HTTPException:
        return RedirectResponse(f"{frontend_callback}?error=oauth_failed")

    client_ip = request.client.host if request.client else "unknown"

    try:
        user = await find_or_create_google_user(request, google_user, current_user, db_session)
    except HTTPException:
        logger.warning(
            "Google OAuth user lookup/creation failed",
            extra={"ip_address": client_ip},
        )
        return RedirectResponse(f"{frontend_callback}?error=user_error")

    access_token = create_access_token({"sub": user.email})
    refresh_token = create_refresh_token({"sub": user.email})

    expiry_timestamp = int(
        (datetime.now().timestamp() + timedelta(hours=8).total_seconds()) * 1000
    )

    exchange_code = create_exchange_code(
        user_data=user.model_dump(),
        access_token=access_token,
        refresh_token=refresh_token,
        expiry=expiry_timestamp,
    )

    logger.info(
        "Google OAuth login successful",
        extra={"user_id": user.id, "email": user.email, "ip_address": client_ip},
    )

    return RedirectResponse(f"{frontend_callback}?code={exchange_code}")


class GoogleExchangeRequest(PydanticStrictBaseModel):
    code: str


@router.post("/google/exchange", response_model=LoginResponse)
async def google_exchange(
    body: GoogleExchangeRequest,
    response: Response,
) -> dict:
    """
    Exchange a short-lived OAuth exchange code for a full login response.

    Called by the Next.js callback page (via a NextAuth credentials provider).
    Each code is single-use and expires after 5 minutes.
    """
    entry = consume_exchange_code(body.code)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired exchange code",
        )

    _set_access_cookie(response, entry["access_token"])
    _set_refresh_cookie(response, entry["refresh_token"])

    return {
        "user": entry["user"],
        "tokens": {
            "access_token": entry["access_token"],
            "refresh_token": entry["refresh_token"],
            "expiry": entry["expiry"],
        },
    }
