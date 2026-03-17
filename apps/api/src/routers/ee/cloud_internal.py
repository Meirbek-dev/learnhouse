import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session
from src.db.organization_config import OrganizationConfigBase

from config.config import get_settings
from src.core.events.database import get_db_session
from src.security.rbac import InternalAuthFailed
from src.services.orgs.orgs import update_org_with_config_no_auth

router = APIRouter()


# Utils
def check_internal_cloud_key(request: Request) -> None:
    expected = get_settings().internal.cloud_internal_key
    provided = request.headers.get("CloudInternalKey", "")

    if not expected or not hmac.compare_digest(provided, expected):
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
