import time
import urllib.parse
import uuid
from typing import Any

import httpx
from fastapi import HTTPException

# ── In-memory one-time exchange code store ────────────────────────────────────
#
# After the Google OAuth callback, we create a short-lived exchange code (UUID)
# that holds the user + token data. The Next.js callback page calls
# POST /auth/google/exchange to consume it and establish a NextAuth session.
#
# .pop() makes each code single-use; _cleanup_exchange_store() evicts expired
# entries to bound memory. TTL is 5 minutes — enough for the browser redirect
# round-trip but short enough to limit exposure.

_EXCHANGE_STORE: dict[str, dict[str, Any]] = {}
_EXCHANGE_TTL = 300  # seconds


def _cleanup_exchange_store() -> None:
    now = time.time()
    expired = [k for k, v in list(_EXCHANGE_STORE.items()) if v["expires_at"] < now]
    for k in expired:
        del _EXCHANGE_STORE[k]


def create_exchange_code(
    user_data: Any,
    access_token: str,
    refresh_token: str,
    expiry: int,
) -> str:
    """Store user+token data and return a one-time exchange code."""
    _cleanup_exchange_store()
    code = str(uuid.uuid4())
    _EXCHANGE_STORE[code] = {
        "user": user_data,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expiry": expiry,
        "expires_at": time.time() + _EXCHANGE_TTL,
    }
    return code


def consume_exchange_code(code: str) -> dict[str, Any] | None:
    """Retrieve and delete exchange code data. Returns None if missing/expired."""
    _cleanup_exchange_store()
    entry = _EXCHANGE_STORE.pop(code, None)
    if not entry or time.time() > entry["expires_at"]:
        return None
    return entry


# ── Google OAuth helpers ──────────────────────────────────────────────────────


def get_google_authorize_url(
    client_id: str,
    redirect_uri: str,
    state: str | None = None,
) -> str:
    """Build the Google OAuth 2.0 authorization URL."""
    params: dict[str, str] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
    }
    if state:
        params["state"] = state
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


async def exchange_google_code(
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
) -> dict[str, Any]:
    """Exchange a Google authorization code for user info."""
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Failed to exchange Google authorization code",
            )
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=400,
                detail="Google token response missing access_token",
            )

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Failed to fetch Google user info",
            )
        return userinfo_resp.json()
