import logging
import time
from typing import Annotated
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlmodel import Session, select

from config.config import get_settings
from src.core.events.database import get_db_session
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, PublicUser, User, UserSession
from src.security.auth import (
    ACCESS_TOKEN_EXPIRE,
    TokenData,
    blocklist_jti,
    create_access_token,
    decode_access_token,
    decode_token_unverified,
    get_access_token_expiry_ms,
    get_access_token_from_request,
    get_current_user,
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
from src.security.keys import get_jwks
from src.services.auth.audit import enqueue_audit_event
from src.services.auth.google_oauth import (
    exchange_google_code,
    get_google_authorize_url,
)
from src.services.auth.rate_limiter import (
    RateLimitExceeded,
    check_account_locked,
    check_rate_limit,
    clear_login_failures,
    record_login_failure,
)
from src.services.auth.sessions import (
    SessionData,
    create_auth_session,
    get_user_active_sessions,
    get_session_owner_id,
    inspect_refresh_session,
    revoke_all_user_sessions,
    revoke_session,
    revoke_token_family,
    rotate_session,
)
from src.services.auth.utils import find_or_create_google_user
from src.services.users.password_reset import (
    change_password_with_reset_code,
    send_reset_password_code,
)
from src.services.users.users import (
    get_user_session,
    security_get_user,
    security_verify_password,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────


class LoginRequest(PydanticStrictBaseModel):
    email: str
    password: str


class TokensResponse(PydanticStrictBaseModel):
    expires_at: int  # unix ms


class LogoutResponse(PydanticStrictBaseModel):
    msg: str


class ForgotPasswordRequest(PydanticStrictBaseModel):
    email: str


class ResetPasswordRequest(PydanticStrictBaseModel):
    token: str
    new_password: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _client_ip(request: Request) -> str:
    """Resolve the real client IP, honouring X-Forwarded-For for trusted proxies.

    PLATFORM_TRUSTED_PROXY_COUNT controls how many proxy hops to skip from the
    right of the XFF list.  Set to 1 when behind a single nginx/load-balancer.
    Set to 0 (default) to use request.client.host directly (no proxies).
    """
    settings = get_settings()
    proxy_count = getattr(settings.hosting_config, "trusted_proxy_count", 0)

    if proxy_count > 0:
        xff = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
        if xff:
            ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
            # Walk back <proxy_count> hops; the first remaining entry is the client
            if len(ips) > proxy_count:
                return ips[-(proxy_count + 1)]
            if ips:
                return ips[0]

    return request.client.host if request.client else "unknown"


def _user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "unknown")


def _get_user_role_slugs(db_session: Session, user_id: int) -> list[str]:
    """Load role slugs for a user to embed in the JWT."""
    from src.security.rbac import PermissionChecker

    checker = PermissionChecker(db_session)
    return [r["slug"] for r in checker.get_user_roles(user_id)]


def _make_access_token(session: SessionData, roles: list[str]) -> str:
    """Create a signed access token embedding the user's current role slugs."""
    return create_access_token(
        user_uuid=session.user_uuid,
        session_id=session.session_id,
        roles=roles,
    )


def _current_origin() -> str:
    settings = get_settings()
    hosting = settings.hosting_config
    protocol = "https" if hosting.ssl else "http"
    port = hosting.port
    default_port = 443 if hosting.ssl else 80
    if port == default_port:
        return f"{protocol}://{hosting.domain}"
    return f"{protocol}://{hosting.domain}:{port}"


def _sanitize_callback_target(callback: str) -> str:
    """Validate and normalise an OAuth callback URL.

    If the URL is absolute, its origin must be in PLATFORM_ALLOWED_ORIGINS.
    The returned value is always a path-only string (scheme and host stripped)
    so the backend redirect never bounces users to an untrusted external domain.
    """
    if not isinstance(callback, str) or not callback.strip():
        raise HTTPException(status_code=400, detail="Invalid callback target")

    raw = callback.strip()
    parsed = urlsplit(raw)
    if not parsed.scheme and not parsed.netloc:
        if not raw.startswith("/"):
            raise HTTPException(status_code=400, detail="Invalid callback target")
        query = urlencode(parse_qsl(parsed.query, keep_blank_values=True))
        return urlunsplit(("", "", parsed.path or "/", query, "")) or "/"

    origin = urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")
    settings = get_settings()
    allowed_origins = {item.rstrip("/") for item in settings.hosting_config.allowed_origins}
    allowed_origins.add(_current_origin())
    if origin not in allowed_origins:
        raise HTTPException(status_code=400, detail="Untrusted callback origin")

    query = urlencode(parse_qsl(parsed.query, keep_blank_values=True))
    return urlunsplit(("", "", parsed.path or "/", query, "")) or "/"


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/login", response_model=UserSession)
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    background_tasks: BackgroundTasks,
    db_session: Annotated[Session, Depends(get_db_session)],
):
    # CSRF protection is provided by SameSite=strict cookies (set in auth_cookies.py).
    # An Origin header check would be redundant and fragile for non-browser clients.
    ip = _client_ip(request)
    ua = _user_agent(request)

    try:
        await check_rate_limit(key=f"login:ip:{ip}", max_requests=5, window_seconds=60)
        await check_rate_limit(
            key=f"login:email:{body.email.lower()}", max_requests=10, window_seconds=60
        )
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts",
            headers={"Retry-After": str(exc.retry_after)},
        )

    if await check_account_locked(body.email):
        enqueue_audit_event(
            background_tasks,
            event_type="login_blocked",
            ip_address=ip,
            user_agent=ua,
            metadata={"email": body.email},
            severity="warning",
        )
        raise HTTPException(
            status_code=423, detail="Account temporarily locked. Try again later."
        )

    user = await security_get_user(request, db_session, body.email)
    if not user or not security_verify_password(body.password, user.password):
        await record_login_failure(body.email)
        enqueue_audit_event(
            background_tasks,
            event_type="login_failure",
            ip_address=ip,
            user_agent=ua,
            metadata={"email": body.email},
            severity="warning",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await clear_login_failures(body.email)

    # Load roles before creating the session so they can be embedded in the JWT
    role_slugs = _get_user_role_slugs(db_session, user.id)

    session_data, refresh_token = await create_auth_session(
        db_session,
        user=user,
        ip_address=ip,
        user_agent=ua,
    )
    access_token = _make_access_token(session_data, role_slugs)
    set_access_cookie(response, access_token)
    set_refresh_cookie(response, refresh_token)

    enqueue_audit_event(
        background_tasks,
        event_type="login_success",
        user_id=str(user.user_uuid),
        session_id=session_data.session_id,
        ip_address=ip,
        user_agent=ua,
    )
    logger.info("Login success user=%s ip=%s", user.email, ip)

    user_pub = PublicUser.model_validate(user)
    return await get_user_session(request, db_session, user_pub)


@router.post("/refresh", response_model=TokensResponse)
async def refresh(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db_session: Annotated[Session, Depends(get_db_session)],
) -> TokensResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_KEY)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_id_part = refresh_token.split(".", 1)[0]
    try:
        await check_rate_limit(
            key=f"refresh:{session_id_part}", max_requests=30, window_seconds=60
        )
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail="Too many refresh requests",
            headers={"Retry-After": str(exc.retry_after)},
        )

    inspection = await inspect_refresh_session(db_session, refresh_token)
    if inspection.status != "active" or inspection.session is None:
        if inspection.status == "reused":
            if inspection.token_family_id and inspection.user_id is not None:
                await revoke_token_family(
                    db_session, inspection.token_family_id, inspection.user_id
                )
            enqueue_audit_event(
                background_tasks,
                event_type="refresh_reuse_detected",
                session_id=inspection.session_id,
                ip_address=_client_ip(request),
                user_agent=_user_agent(request),
                metadata={"status": inspection.status},
                severity="warning",
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    old_session = inspection.session

    user = db_session.exec(select(User).where(User.id == old_session.user_id)).first()
    if user is None:
        await revoke_token_family(
            db_session, old_session.token_family_id, old_session.user_id
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Blocklist old access token JTI before issuing a new one.
    # We use unverified decode here because the old AT may be expired; see the
    # docstring on decode_token_unverified() for the security rationale.
    old_access_token = request.cookies.get(ACCESS_COOKIE_KEY)
    if old_access_token:
        old_payload = decode_token_unverified(old_access_token)
        old_jti = old_payload.get("jti")
        old_exp = old_payload.get("exp")
        if old_jti and old_exp:
            remaining = max(0, int(old_exp) - int(time.time()))
            await blocklist_jti(old_jti, remaining)

    # Reload roles to keep embedded claims fresh on every rotation
    role_slugs = _get_user_role_slugs(db_session, user.id)

    new_session, new_refresh_token = await rotate_session(
        db_session,
        old_session=old_session,
        user=user,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )
    new_access_token = _make_access_token(new_session, role_slugs)
    set_access_cookie(response, new_access_token)
    set_refresh_cookie(response, new_refresh_token)

    enqueue_audit_event(
        background_tasks,
        event_type="token_refresh",
        user_id=str(user.user_uuid),
        session_id=new_session.session_id,
        ip_address=_client_ip(request),
    )

    return TokensResponse(expires_at=get_access_token_expiry_ms())


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    token: Annotated[str | None, Depends(oauth2_scheme_optional)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user_optional)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> LogoutResponse:
    # Only blocklist / revoke when the token was fully verified.
    # If the access token is expired the JTI is already safe (expired tokens
    # are rejected during verification), so clearing the cookies is sufficient.
    resolved_token = get_access_token_from_request(request, token)

    if resolved_token and isinstance(current_user, PublicUser):
        # Token has already been verified by get_current_user_optional —
        # decode again (cheap, cached public key) to extract JTI and session_id.
        try:
            token_data: TokenData = decode_access_token(resolved_token)
            jti = token_data.jti
            exp_remaining = int(ACCESS_TOKEN_EXPIRE.total_seconds())

            if jti:
                await blocklist_jti(jti, exp_remaining)

            if token_data.session_id:
                user_id_hint = await get_session_owner_id(db_session, token_data.session_id)
                if user_id_hint:
                    await revoke_session(db_session, token_data.session_id, user_id_hint)
        except Exception:
            # Never block logout due to token parsing errors
            pass

        enqueue_audit_event(
            background_tasks,
            event_type="logout",
            user_id=str(current_user.user_uuid),
            ip_address=_client_ip(request),
        )

    clear_auth_cookies(response)
    return LogoutResponse(msg="Successfully logged out")


@router.post("/logout-all", response_model=LogoutResponse)
async def logout_all(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> LogoutResponse:
    # Blocklist the current access token using the verified decode path
    resolved_token = get_access_token_from_request(request, None)
    if resolved_token:
        try:
            token_data = decode_access_token(resolved_token)
            if token_data.jti:
                await blocklist_jti(
                    token_data.jti, int(ACCESS_TOKEN_EXPIRE.total_seconds())
                )
        except Exception:
            pass

    user = db_session.exec(
        select(User).where(User.user_uuid == current_user.user_uuid)
    ).first()
    if user:
        revoked = await revoke_all_user_sessions(db_session, user.id)
        enqueue_audit_event(
            background_tasks,
            event_type="logout_all",
            user_id=str(current_user.user_uuid),
            ip_address=_client_ip(request),
            metadata={"sessions_revoked": revoked},
        )

    clear_auth_cookies(response)
    return LogoutResponse(msg="All sessions terminated")


@router.get("/.well-known/jwks.json", include_in_schema=False)
def jwks() -> JSONResponse:
    return JSONResponse(
        content=get_jwks(), headers={"Cache-Control": "public, max-age=3600"}
    )


@router.get("/sessions")
async def list_sessions(
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    user = db_session.exec(
        select(User).where(User.user_uuid == current_user.user_uuid)
    ).first()
    if not user:
        return []
    return await get_user_active_sessions(user.id)


# ── Password reset ────────────────────────────────────────────────────────────


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
):
    ip = _client_ip(request)
    try:
        await check_rate_limit(key=f"forgot:ip:{ip}", max_requests=3, window_seconds=3600)
        await check_rate_limit(
            key=f"forgot:email:{body.email.lower()}", max_requests=1, window_seconds=300
        )
    except RateLimitExceeded:
        # Always return 200 — no info leak
        return {"msg": "If that email exists, a reset link has been sent"}

    msg = await send_reset_password_code(db_session, body.email)
    return {"msg": msg}


@router.post("/reset-password")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
):
    msg = await change_password_with_reset_code(
        db_session, body.token, body.new_password
    )
    return {"msg": msg}


# ── Google OAuth ──────────────────────────────────────────────────────────────


def _backend_callback_url() -> str:
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
    callback = _sanitize_callback_target(callback)
    settings = get_settings()
    cfg = settings.google_oauth
    if not cfg.client_id or not cfg.client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")
    url = get_google_authorize_url(
        client_id=cfg.client_id,
        redirect_uri=_backend_callback_url(),
        callback=callback,
    )
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    background_tasks: BackgroundTasks,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    current_user: Annotated[
        PublicUser | AnonymousUser, Depends(get_current_user_optional)
    ] = None,
    db_session: Session = Depends(get_db_session),
) -> RedirectResponse:
    frontend_callback = "/"

    if error or not code:
        logger.warning("Google OAuth error: %s", error)
        return RedirectResponse(f"{frontend_callback}?error=oauth_failed")

    settings = get_settings()
    cfg = settings.google_oauth
    if not cfg.client_id or not cfg.client_secret:
        return RedirectResponse(f"{frontend_callback}?error=not_configured")

    try:
        google_user = await exchange_google_code(
            client_id=cfg.client_id,
            client_secret=cfg.client_secret,
            code=code,
            redirect_uri=_backend_callback_url(),
            state=state,
        )
    except HTTPException:
        return RedirectResponse(f"{frontend_callback}?error=oauth_failed")

    frontend_callback = _sanitize_callback_target(
        str(google_user.get("frontend_callback", "/"))
    )
    ip = _client_ip(request)

    try:
        user = await find_or_create_google_user(
            request, google_user, current_user, db_session
        )
    except HTTPException:
        return RedirectResponse(f"{frontend_callback}?error=user_error")

    role_slugs = _get_user_role_slugs(db_session, user.id)
    session_data, refresh_token = await create_auth_session(
        db_session,
        user=user,
        ip_address=ip,
        user_agent=_user_agent(request),
    )
    access_token = _make_access_token(session_data, role_slugs)

    redirect_response = RedirectResponse(frontend_callback)
    set_access_cookie(redirect_response, access_token)
    set_refresh_cookie(redirect_response, refresh_token)

    enqueue_audit_event(
        background_tasks,
        event_type="oauth_linked",
        user_id=str(user.user_uuid),
        session_id=session_data.session_id,
        ip_address=ip,
    )
    return redirect_response
