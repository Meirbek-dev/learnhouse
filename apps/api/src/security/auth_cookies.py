from datetime import timedelta

from fastapi import Response

from config.config import get_settings

ACCESS_COOKIE_KEY = "access_token_cookie"
REFRESH_COOKIE_KEY = "refresh_token_cookie"
ACCESS_COOKIE_TTL_SECONDS = int(timedelta(hours=8).total_seconds())
REFRESH_COOKIE_TTL_SECONDS = int(timedelta(days=30).total_seconds())


def set_access_cookie(response: Response, value: str) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain
    is_ssl_enabled = settings.hosting_config.ssl

    cookie_kwargs: dict[str, object] = {
        "httponly": True,
        "secure": bool(is_ssl_enabled),
        "samesite": "lax",
        "max_age": ACCESS_COOKIE_TTL_SECONDS,
        "path": "/",
    }

    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain

    response.set_cookie(key=ACCESS_COOKIE_KEY, value=value, **cookie_kwargs)


def set_refresh_cookie(response: Response, value: str) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain
    is_ssl_enabled = settings.hosting_config.ssl

    cookie_kwargs: dict[str, object] = {
        "httponly": True,
        "secure": bool(is_ssl_enabled),
        "samesite": "lax",
        "max_age": REFRESH_COOKIE_TTL_SECONDS,
        "path": "/",
    }

    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain

    response.set_cookie(key=REFRESH_COOKIE_KEY, value=value, **cookie_kwargs)


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain

    delete_kwargs: dict[str, object] = {"path": "/"}
    if cookie_domain:
        delete_kwargs["domain"] = cookie_domain

    response.delete_cookie(ACCESS_COOKIE_KEY, **delete_kwargs)
    response.delete_cookie(REFRESH_COOKIE_KEY, **delete_kwargs)
