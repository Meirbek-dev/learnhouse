from functools import lru_cache
from typing import Any

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from authlib.jose import JoseError, jwt
from fastapi import HTTPException

from src.security.security import ALGORITHM, get_secret_key

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"


@lru_cache(maxsize=1)
def _state_signing_key() -> str:
    return get_secret_key()


async def _get_google_metadata() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(GOOGLE_DISCOVERY_URL)
        response.raise_for_status()
        return response.json()


def _encode_state(callback: str) -> str:
    token = jwt.encode(
        {"alg": ALGORITHM, "typ": "JWT"},
        {"callback": callback, "type": "google_state"},
        _state_signing_key(),
    )
    return token.decode("utf-8") if isinstance(token, bytes) else token


def _decode_state(state: str) -> str:
    try:
        claims = jwt.decode(state, _state_signing_key())
        claims.validate()
        callback = claims.get("callback")
        token_type = claims.get("type")
    except JoseError as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc

    if token_type != "google_state" or not isinstance(callback, str) or not callback:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    return callback


# ── Google OAuth helpers ──────────────────────────────────────────────────────


def get_google_authorize_url(
    client_id: str,
    redirect_uri: str,
    callback: str,
) -> str:
    """Build the Google OAuth 2.0 authorization URL with Authlib."""
    state = _encode_state(callback)
    metadata = httpx.get(GOOGLE_DISCOVERY_URL, timeout=10.0).json()
    client = AsyncOAuth2Client(
        client_id=client_id,
        redirect_uri=redirect_uri,
        scope="openid email profile",
    )
    url, _ = client.create_authorization_url(
        metadata["authorization_endpoint"],
        state=state,
        access_type="online",
        prompt="select_account",
    )
    return url


async def exchange_google_code(
    client_id: str,
    client_secret: str,
    code: str,
    redirect_uri: str,
    state: str | None = None,
) -> dict[str, Any]:
    """Exchange a Google authorization code for user info with Authlib."""
    metadata = await _get_google_metadata()
    async with AsyncOAuth2Client(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="openid email profile",
    ) as client:
        try:
            token = await client.fetch_token(
                metadata["token_endpoint"],
                code=code,
                grant_type="authorization_code",
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=400,
                detail="Failed to exchange Google authorization code",
            ) from exc

        access_token = token.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise HTTPException(
                status_code=400,
                detail="Google token response missing access_token",
            )

        userinfo_resp = await client.get(metadata["userinfo_endpoint"])
        if userinfo_resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Failed to fetch Google user info",
            )

        userinfo = userinfo_resp.json()
        if state is not None:
            userinfo["frontend_callback"] = _decode_state(state)
        return userinfo
