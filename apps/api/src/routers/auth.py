import logging
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from config.config import get_settings
from src.core.events.database import get_db_session
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, PublicUser, UserRead, UserSession
from src.security.auth import (
    authenticate_user,
    create_access_token,
    decode_access_token,
    get_access_token_expiry_timestamp,
    get_access_token_from_request,
    get_current_user_optional,
    oauth2_scheme_optional,
)
from src.security.auth_cookies import (
    ACCESS_COOKIE_KEY,
    REFRESH_COOKIE_KEY,
    clear_auth_cookies,
    set_access_cookie,
    set_refresh_cookie,
)
from src.services.auth.google_oauth import exchange_google_code, get_google_authorize_url
from src.services.auth.sessions import (
    get_session_by_id,
    get_user_for_session,
    resolve_refresh_session,
    revoke_session,
    revoke_token_family,
    rotate_session,
    create_auth_session,
)
from src.services.auth.utils import find_or_create_google_user
from src.services.users.users import get_user_session

router = APIRouter()
logger = logging.getLogger(__name__)


class TokensResponse(PydanticStrictBaseModel):
    expiry: int


class LogoutResponse(PydanticStrictBaseModel):
    msg: str


async def _build_user_session(
    request: Request,
    db_session: Session,
    user: PublicUser,
) -> UserSession:
    return await get_user_session(request, db_session, user)


@router.get("/refresh", response_model=TokensResponse)
def refresh(
    request: Request,
    response: Response,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> TokensResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_KEY)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_session = resolve_refresh_session(db_session, refresh_token)
    if auth_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_for_session(db_session, auth_session)
    if user is None:
        revoke_token_family(db_session, auth_session.token_family_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    rotated_session, new_refresh_token = rotate_session(
        db_session,
        auth_session=auth_session,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    new_access_token = create_access_token(
        {"sub": user.email, "sid": rotated_session.session_id}
    )
    expiry_timestamp = get_access_token_expiry_timestamp()

    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        "Token refresh succeeded",
        extra={
            "email": user.email,
            "ip_address": client_ip,
            "session_id": rotated_session.session_id,
        },
    )

    set_access_cookie(response, new_access_token)
    set_refresh_cookie(response, new_refresh_token)

    return {"expiry": expiry_timestamp}


@router.post("/login", response_model=UserSession)
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

    auth_session, refresh_token = create_auth_session(
        db_session,
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    access_token = create_access_token({"sub": user.email, "sid": auth_session.session_id})
    set_refresh_cookie(response, refresh_token)
    set_access_cookie(response, access_token)
    user_read = PublicUser.model_validate(user)

    logger.info(
        "Successful login",
        extra={
            "user_id": user.id,
            "email": user.email,
            "ip_address": client_ip,
            "user_agent": user_agent,
            "session_id": auth_session.session_id,
        },
    )

    return await _build_user_session(request, db_session, user_read)


@router.delete("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    token: Annotated[str | None, Depends(oauth2_scheme_optional)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> LogoutResponse:
    """
    Because the JWT are stored in an httponly cookie now, we cannot
    log the user out by simply deleting the cookies in the frontend.
    We need the backend to send us a response to delete the cookies.
    """
    resolved_token = get_access_token_from_request(request, token)
    refresh_token = request.cookies.get(REFRESH_COOKIE_KEY)
    token_data = decode_access_token(resolved_token) if resolved_token else None
    client_ip = request.client.host if request.client else "unknown"

    if token_data and token_data.session_id:
        auth_session = get_session_by_id(db_session, token_data.session_id)
        if auth_session is not None:
            revoke_session(db_session, auth_session)
    elif refresh_token:
        auth_session = resolve_refresh_session(db_session, refresh_token)
        if auth_session is not None:
            revoke_session(db_session, auth_session)
            token_data = token_data or PydanticStrictBaseModel.model_validate({})

    current_user = token_data.username if token_data else "unknown"

    logger.info(
        "User logout",
        extra={
            "email": current_user,
            "ip_address": client_ip,
        },
    )

    clear_auth_cookies(response)
    return LogoutResponse(msg="Successfully logout")


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

    url = get_google_authorize_url(
        client_id=google_cfg.client_id,
        redirect_uri=_get_backend_callback_url(),
        callback=callback,
    )
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
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
    user, creates a persistent auth session, sets cookies, and redirects the
    browser back to the frontend already authenticated.
    """
    frontend_callback = "/"
    if state:
        frontend_callback = state

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
        user = await find_or_create_google_user(
            request, google_user, current_user, db_session
        )
    except HTTPException:
        logger.warning(
            "Google OAuth user lookup/creation failed",
            extra={"ip_address": client_ip},
        )
        return RedirectResponse(f"{frontend_callback}?error=user_error")

    auth_session, refresh_token = create_auth_session(
        db_session,
        user_id=user.id,
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
    )
    access_token = create_access_token({"sub": user.email, "sid": auth_session.session_id})

    redirect_response = RedirectResponse(frontend_callback)
    set_access_cookie(redirect_response, access_token)
    set_refresh_cookie(redirect_response, refresh_token)

    logger.info(
        "Google OAuth login successful",
        extra={
            "user_id": user.id,
            "email": user.email,
            "ip_address": client_ip,
            "session_id": auth_session.session_id,
        },
    )

    return redirect_response
