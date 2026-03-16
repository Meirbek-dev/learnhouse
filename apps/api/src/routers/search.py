from typing import Annotated

from fastapi import APIRouter, Depends, Request

from src.core.platform import PLATFORM_ORG_SLUG
from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.search.search import SearchResult, search_across_org

router = APIRouter()


@router.get("/org_slug/{org_slug}")
async def api_search_across_org(
    request: Request,
    org_slug: str,
    query: str,
    page: int = 1,
    limit: int = 10,
    db_session=Depends(get_db_session),
    current_user: Annotated[PublicUser, Depends(get_current_user)] = None,
) -> SearchResult:
    """
    Search across courses, collections and users within an organization
    """
    return await search_across_org(
        request=request,
        current_user=current_user,
        org_slug=org_slug,
        search_query=query,
        db_session=db_session,
        page=page,
        limit=limit,
    )


@router.get("")
async def api_search_platform_content(
    request: Request,
    query: str,
    page: int = 1,
    limit: int = 10,
    db_session=Depends(get_db_session),
    current_user: Annotated[PublicUser, Depends(get_current_user)] = None,
) -> SearchResult:
    return await search_across_org(
        request=request,
        current_user=current_user,
        org_slug=PLATFORM_ORG_SLUG,
        search_query=query,
        db_session=db_session,
        page=page,
        limit=limit,
    )
