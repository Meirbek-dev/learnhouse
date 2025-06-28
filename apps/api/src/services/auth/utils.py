import random

import httpx
from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.db.users import User, UserCreate, UserRead
from src.security.auth import get_current_user
from src.services.users.users import create_user, create_user_without_org


async def get_google_user_info(access_token: str):
    url = "https://www.googleapis.com/oauth2/v3/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="Failed to fetch user info from Google",
        )

    return response.json()


async def signWithGoogle(
    request: Request,
    access_token: str,
    email: str,
    org_id: int | None = None,
    current_user=Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
):
    # Google
    google_user = await get_google_user_info(access_token)

    user = db_session.exec(
        select(User).where(User.email == google_user["email"])
    ).first()

    if not user:
        # Safely extract user data with fallbacks for missing fields
        given_name = google_user.get("given_name", "")
        family_name = google_user.get("family_name", "")
        email = google_user.get("email", "")
        picture = google_user.get("picture", "")

        # Create a safe username from ASCII chars only, fallback to email prefix
        safe_given = "".join(c for c in given_name if c.isalnum())
        safe_family = "".join(c for c in family_name if c.isalnum())

        if safe_given or safe_family:
            username = safe_given + safe_family + str(random.randint(10, 999))
        else:
            # Fallback to email prefix if names contain no ASCII chars
            email_prefix = email.split("@")[0]
            safe_prefix = "".join(c for c in email_prefix if c.isalnum())[:10]
            username = safe_prefix + str(random.randint(10, 999))

        # Ensure username is unique
        existing_username = db_session.exec(
            select(User).where(User.username == username)
        ).first()

        if existing_username:
            username = username + str(random.randint(1000, 9999))

        user_object = UserCreate(
            email=email,
            username=username,
            password="",
            first_name=given_name,
            last_name=family_name,
            avatar_image=picture,
        )

        if org_id is not None:
            return await create_user(
                request, db_session, current_user, user_object, org_id
            )

        return await create_user_without_org(
            request, db_session, current_user, user_object
        )

    return UserRead.model_validate(user)
