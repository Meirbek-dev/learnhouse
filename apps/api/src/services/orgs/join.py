from datetime import datetime

from fastapi import HTTPException, Request
from pydantic import Field
from sqlmodel import Session, select

from src.db.organizations import Organization
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.user_organizations import UserOrganization
from src.db.users import AnonymousUser, PublicUser, User
from src.services.orgs.invites import get_invite_code
from src.services.orgs.orgs import get_org_join_mechanism


class JoinOrg(PydanticStrictBaseModel):
    org_id: int = Field(gt=0)
    user_id: int = Field(gt=0)
    invite_code: str | None = Field(default=None)


async def join_org(
    request: Request,
    args: JoinOrg,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Fetch organization
    statement = select(Organization).where(Organization.id == args.org_id)
    result = db_session.exec(statement)
    org = result.first()

    if not org or org.id is None:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    join_method = await get_org_join_mechanism(
        request, args.org_id, current_user, db_session
    )

    # Fetch user
    statement = select(User).where(User.id == args.user_id)
    result = db_session.exec(statement)
    user = result.first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Check if user is already in the organization
    statement = select(UserOrganization).where(
        UserOrganization.user_id == args.user_id, UserOrganization.org_id == args.org_id
    )
    result = db_session.exec(statement)
    userorg = result.first()

    if userorg:
        raise HTTPException(
            status_code=400, detail="User is already part of that organization"
        )

    if join_method == "inviteOnly":
        if not args.invite_code:
            raise HTTPException(
                status_code=400,
                detail="Invite code is required for invite-only organizations",
            )

        # Check invite code
        inviteCode = await get_invite_code(
            request, org.id, args.invite_code, current_user, db_session
        )
        if not inviteCode:
            raise HTTPException(
                status_code=400,
                detail="Invite code is incorrect",
            )

        # Link user and organization
        user_organization = UserOrganization(
            user_id=user.id,
            org_id=org.id,
            role_id=4,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(user_organization)
        db_session.commit()

        return "Добро пожаловать!"

    if join_method == "open":
        # Link user and organization
        user_organization = UserOrganization(
            user_id=user.id,
            org_id=org.id,
            role_id=4,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(user_organization)
        db_session.commit()

        return "Добро пожаловать!"

    raise HTTPException(
        status_code=400,
        detail=f"Invalid join method: {join_method}",
    )
