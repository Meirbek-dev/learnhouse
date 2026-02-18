import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.organization_config import OrganizationConfigBase
from src.security.rbac import InternalAuthFailed
from src.services.orgs.orgs import update_org_with_config_no_auth

router = APIRouter()


# Utils
def check_internal_cloud_key(request: Request) -> None:
    if request.headers.get("CloudInternalKey") != os.environ.get("CLOUD_INTERNAL_KEY"):
        raise InternalAuthFailed(reason="Invalid internal cloud key")


@router.put("/update_org_config")
async def update_org_Config(
    request: Request,
    org_id: int,
    config_object: OrganizationConfigBase,
    db_session: Annotated[Session, Depends(get_db_session)],
):
    check_internal_cloud_key(request)
    return await update_org_with_config_no_auth(
        request, config_object, org_id, db_session
    )
