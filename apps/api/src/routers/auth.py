from datetime import timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import ConfigDict, EmailStr
from sqlmodel import Session

from config.config import get_openu_config
from src.core.events.database import get_db_session
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, UserRead
from src.security.auth import AuthJWT, authenticate_user, get_current_user
from src.services.auth.utils import signWithGoogle

router = APIRouter()

COOKIE_TTL_SECONDS = int(timedelta(hours=8).total_seconds())


def _set_access_cookie(response: Response, value: str) -> None:
    cookie_domain = get_openu_config().hosting_config.cookie_config.domain
    cookie_kwargs: dict[str, object] = {
        "httponly": False,
        "expires": COOKIE_TTL_SECONDS,
    }
    if cookie_domain:
        cookie_kwargs["domain"] = cookie_domain

    response.set_cookie(
        key="access_token_cookie",
        value=value,
        **cookie_kwargs,
    )


@router.get("/refresh")
def refresh(response: Response, Authorize: Annotated[AuthJWT, Depends()]):
    """
    The jwt_refresh_token_required() function insures a valid refresh
    token is present in the request before running any code below that function.
    we can use the get_jwt_subject() function to get the subject of the refresh
    token, and use the create_access_token() function again to make a new access token
    """
    Authorize.jwt_refresh_token_required()

    current_user = Authorize.get_jwt_subject()
    new_access_token = Authorize.create_access_token(subject=current_user)

    _set_access_cookie(response, new_access_token)
    return {"access_token": new_access_token}


@router.post("/login")
async def login(
    request: Request,
    response: Response,
    Authorize: Annotated[AuthJWT, Depends()],
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    user = await authenticate_user(
        request, form_data.username, form_data.password, db_session
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = Authorize.create_access_token(subject=form_data.username)
    refresh_token = Authorize.create_refresh_token(subject=form_data.username)
    Authorize.set_refresh_cookies(refresh_token)

    # set cookies using fastapi
    _set_access_cookie(response, access_token)

    user = UserRead.model_validate(user)

    return {
        "user": user,
        "tokens": {"access_token": access_token, "refresh_token": refresh_token},
    }


class ThirdPartyLogin(PydanticStrictBaseModel):
    email: EmailStr
    provider: Literal["google"]
    access_token: str
    model_config = ConfigDict(arbitrary_types_allowed=True)


@router.post("/oauth")
async def third_party_login(
    request: Request,
    response: Response,
    body: ThirdPartyLogin,
    org_id: int | None = None,
    current_user: Annotated[AnonymousUser, Depends(get_current_user)] = None,
    db_session=Depends(get_db_session),
    Authorize: Annotated[AuthJWT, Depends()] = None,
):
    # Google
    if body.provider == "google":
        user = await signWithGoogle(
            request, body.access_token, body.email, org_id, current_user, db_session
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = Authorize.create_access_token(subject=user.email)
    refresh_token = Authorize.create_refresh_token(subject=user.email)
    Authorize.set_refresh_cookies(refresh_token)

    # set cookies using fastapi
    _set_access_cookie(response, access_token)

    user = UserRead.model_validate(user)

    return {
        "user": user,
        "tokens": {"access_token": access_token, "refresh_token": refresh_token},
    }


@router.delete("/logout")
def logout(Authorize: Annotated[AuthJWT, Depends()]) -> dict[str, str]:
    """
    Because the JWT are stored in an httponly cookie now, we cannot
    log the user out by simply deleting the cookies in the frontend.
    We need the backend to send us a response to delete the cookies.
    """
    Authorize.jwt_required()

    Authorize.unset_jwt_cookies()
    return {"msg": "Successfully logout"}
