from datetime import datetime, timedelta

import orjson
from fastapi import HTTPException, Request
from pydantic import EmailStr
from sqlmodel import Session, select
from ulid import ULID

from config.config import get_platform_config
from src.db.organizations import (
    Organization,
    OrganizationRead,
)
from src.db.users import AnonymousUser, PublicUser, UserRead
from src.security.security import generate_secure_code
from src.services.cache.redis_client import (
    delete_keys,
    get_json,
    get_redis_client,
    set_json,
)
from src.services.email.utils import send_email
from src.services.orgs.orgs import rbac_check


async def create_invite_code(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    # Connect to Redis (use cached client)
    r = get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )
    # Check if this org has more than 6 invite codes
    invite_codes = r.keys(f"*:org:{org.org_uuid}:code:*")

    if len(invite_codes) >= 6:
        raise HTTPException(
            status_code=400,
            detail="Organization has reached the maximum number of invite codes",
        )

    # Generate invite code
    generated_invite_code = generate_secure_code()
    invite_code_uuid = f"org_invite_code_{ULID()}"

    # time to live in days to seconds
    ttl = int(timedelta(days=365).total_seconds())

    inviteCodeObject = {
        "invite_code": generated_invite_code,
        "invite_code_uuid": invite_code_uuid,
        "invite_code_expires": ttl,
        "invite_code_type": "signup",
        "created_at": datetime.now().isoformat(),
        "created_by": current_user.user_uuid,
    }

    set_json(
        f"{invite_code_uuid}:org:{org.org_uuid}:code:{generated_invite_code}",
        inviteCodeObject,
        ttl,
    )

    return inviteCodeObject


async def create_invite_code_with_usergroup(
    request: Request,
    org_id: int,
    usergroup_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    # Connect to Redis (use cached client)
    r = get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )
    # Check if this org has more than 6 invite codes
    invite_codes = r.keys(f"*:org:{org.org_uuid}:code:*")

    if len(invite_codes) >= 6:
        raise HTTPException(
            status_code=400,
            detail="Organization has reached the maximum number of invite codes",
        )

    # Generate invite code
    generated_invite_code = generate_secure_code()
    invite_code_uuid = f"org_invite_code_{ULID()}"

    # time to live in days to seconds
    ttl = int(timedelta(days=365).total_seconds())

    inviteCodeObject = {
        "invite_code": generated_invite_code,
        "invite_code_uuid": invite_code_uuid,
        "invite_code_expires": ttl,
        "usergroup_id": usergroup_id,
        "invite_code_type": "signup",
        "created_at": datetime.now().isoformat(),
        "created_by": current_user.user_uuid,
    }

    set_json(
        f"{invite_code_uuid}:org:{org.org_uuid}:code:{generated_invite_code}",
        inviteCodeObject,
        ttl,
    )

    return inviteCodeObject


async def get_invite_codes(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    # Connect to Redis (use cached client)
    r = get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )

    # Get invite codes
    invite_codes = r.keys(f"org_invite_code_*:org:{org.org_uuid}:code:*")

    invite_codes_list = []

    for inv in invite_codes:
        key = inv.decode("utf-8") if isinstance(inv, (bytes, bytearray)) else inv
        invite_code = get_json(key)
        if invite_code:
            invite_codes_list.append(invite_code)

    return invite_codes_list


async def get_invite_code(
    request: Request,
    org_id: int,
    invite_code: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    # await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    # Connect to Redis (use cached client)
    r = get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )

    # Get invite code
    keys = r.keys(f"org_invite_code_*:org:{org.org_uuid}:code:{invite_code}")

    if not keys:
        raise HTTPException(
            status_code=404,
            detail="Invite code not found",
        )

    key = (
        keys[0].decode("utf-8") if isinstance(keys[0], (bytes, bytearray)) else keys[0]
    )
    return get_json(key)


async def delete_invite_code(
    request: Request,
    org_id: int,
    invite_code_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    await rbac_check(request, org.org_uuid, current_user, "update", db_session)

    # Connect to Redis (use cached client)
    r = get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )

    # Delete invite code
    keys = r.keys(f"{invite_code_uuid}:org:{org.org_uuid}:code:*")
    if keys:
        delete_keys(
            *[
                k.decode("utf-8") if isinstance(k, (bytes, bytearray)) else k
                for k in keys
            ]
        )

    if not keys:
        raise HTTPException(
            status_code=404,
            detail="Invite code not found",
        )

    return keys


def send_invite_email(
    org: OrganizationRead,
    invite_code_uuid: str,
    user: UserRead,
    email: EmailStr,
) -> bool:
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    # Connect to Redis (use cached client)
    r = get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )

    # Get invite code
    keys = r.keys(f"{invite_code_uuid}:org:{org.org_uuid}:code:*")

    # Send email
    if keys:
        key = (
            keys[0].decode("utf-8")
            if isinstance(keys[0], (bytes, bytearray))
            else keys[0]
        )
        invite = get_json(key)

        # send email
        send_email(
            to=email,
            subject=f"You have been invited to {org.name}",
            body=f"""
<html>
    <body>
        <p>Hello {email}</p>
        <p>You have been invited to {org.name} by @{user.username}. Your invite code is {invite["invite_code"]}.</p>
        <p>Click <a href="{org.slug}.tou.edu.kz/signup?orgslug={org.slug}&inviteCode={invite["invite_code"]}">here</a> to sign up.</p>
        <p>Thank you</p>
    </body>
</html>
""",
        )

        return True

    return False
