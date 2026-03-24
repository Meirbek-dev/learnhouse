from typing import Annotated

from fastapi import APIRouter, Depends, Request

from src.core.events.database import get_db_session
from src.db.courses.chapters import (
    ChapterCreate,
    ChapterDelete,
    ChapterRead,
    ChapterUpdate,
    ChapterUpdateOrder,
)
from src.security.auth import get_current_user
from src.services.courses.chapters import (
    create_chapter,
    delete_chapter,
    get_chapter,
    reorder_chapters_and_activities,
    update_chapter,
)
from src.services.users.users import PublicUser

router = APIRouter()


@router.post("")
async def api_create_coursechapter(
    request: Request,
    coursechapter_object: ChapterCreate,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ChapterRead:
    """
    Create new Course Chapter
    """
    return await create_chapter(request, coursechapter_object, current_user, db_session)


@router.get("/{chapter_uuid}")
async def api_get_coursechapter(
    request: Request,
    chapter_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ChapterRead:
    """
    Get single CourseChapter by chapter_uuid
    """
    return await get_chapter(request, chapter_uuid, current_user, db_session)


@router.put("/course/{course_uuid}/order")
async def api_update_chapter_meta(
    request: Request,
    course_uuid: str,
    order: ChapterUpdateOrder,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> dict:
    """
    Reorder chapters and activities within a course
    """
    return await reorder_chapters_and_activities(
        request, course_uuid, order, current_user, db_session
    )


@router.put("/{chapter_uuid}")
async def api_update_coursechapter(
    request: Request,
    coursechapter_object: ChapterUpdate,
    chapter_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ChapterRead:
    """
    Update CourseChapter by chapter_uuid
    """
    return await update_chapter(
        request, coursechapter_object, chapter_uuid, current_user, db_session
    )


@router.delete("/{chapter_uuid}")
async def api_delete_coursechapter(
    request: Request,
    chapter_uuid: str,
    delete_body: ChapterDelete,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> dict:
    """
    Delete CourseChapter by chapter_uuid
    """
    return await delete_chapter(
        request,
        chapter_uuid,
        current_user,
        db_session,
        delete_body.last_known_update_date,
    )
