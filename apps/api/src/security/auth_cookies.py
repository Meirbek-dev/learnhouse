from datetime import timedelta

from fastapi import Response

from config.config import get_settings

ACCESS_COOKIE_KEY = "access_token_cookie"
REFRESH_COOKIE_KEY = "refresh_token_cookie"
ACCESS_COOKIE_TTL_SECONDS = int(timedelta(hours=8).total_seconds())
REFRESH_COOKIE_TTL_SECONDS = int(timedelta(days=7).total_seconds())


def set_access_cookie(response: Response, value: str) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain
    is_ssl = settings.hosting_config.ssl

    kwargs: dict[str, object] = {
        "httponly": True,
        "secure": bool(is_ssl),
        "samesite": "strict",
        "max_age": ACCESS_COOKIE_TTL_SECONDS,
        "path": "/api",
    }
    if cookie_domain:
        kwargs["domain"] = cookie_domain

    response.set_cookie(key=ACCESS_COOKIE_KEY, value=value, **kwargs)


def set_refresh_cookie(response: Response, value: str) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain
    is_ssl = settings.hosting_config.ssl

    kwargs: dict[str, object] = {
        "httponly": True,
        "secure": bool(is_ssl),
        "samesite": "strict",
        "max_age": REFRESH_COOKIE_TTL_SECONDS,
        "path": "/api/auth/refresh",
    }
    if cookie_domain:
        kwargs["domain"] = cookie_domain

    response.set_cookie(key=REFRESH_COOKIE_KEY, value=value, **kwargs)


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    cookie_domain = settings.hosting_config.cookie_config.domain

    access_kwargs: dict[str, object] = {"path": "/api"}
    refresh_kwargs: dict[str, object] = {"path": "/api/auth/refresh"}
    if cookie_domain:
        access_kwargs["domain"] = cookie_domain
        refresh_kwargs["domain"] = cookie_domain

    response.delete_cookie(ACCESS_COOKIE_KEY, **access_kwargs)
    response.delete_cookie(REFRESH_COOKIE_KEY, **refresh_kwargs)
