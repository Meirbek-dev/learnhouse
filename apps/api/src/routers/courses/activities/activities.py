from typing import Annotated

from fastapi import APIRouter, Depends, Form, Request, UploadFile

from src.core.events.database import get_db_session
from src.db.courses.activities import (
    ActivityCreate,
    ActivityRead,
    ActivityReadWithPermissions,
    ActivityUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.courses.activities.activities import (
    create_activity,
    delete_activity,
    get_activities,
    get_activity,
    get_activityby_id,
    update_activity,
)
from src.services.courses.activities.pdf import create_documentpdf_activity
from src.services.courses.activities.video import (
    ExternalVideo,
    create_external_video_activity,
    create_video_activity,
)

router = APIRouter()


@router.post("")
async def api_create_activity(
    request: Request,
    activity_object: ActivityCreate,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ActivityRead:
    return await create_activity(request, activity_object, current_user, db_session)


@router.get("/{activity_uuid}")
async def api_get_activity(
    request: Request,
    activity_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ActivityReadWithPermissions:
    return await get_activity(
        request, activity_uuid, current_user=current_user, db_session=db_session
    )


@router.get("/id/{activity_id}")
async def api_get_activityby_id(
    request: Request,
    activity_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ActivityRead:
    return await get_activityby_id(
        request, int(activity_id), current_user=current_user, db_session=db_session
    )


@router.get("/chapter/{chapter_id}")
async def api_get_chapter_activities(
    request: Request,
    chapter_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> list[ActivityRead]:
    return await get_activities(request, chapter_id, current_user, db_session)


@router.patch("/{activity_uuid}")
async def api_update_activity(
    request: Request,
    activity_object: ActivityUpdate,
    activity_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ActivityRead:
    return await update_activity(
        request, activity_object, activity_uuid, current_user, db_session
    )


@router.patch("/{activity_uuid}/publish")
async def api_publish_activity(
    request: Request,
    activity_uuid: str,
    published: bool,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ActivityRead:
    return await update_activity(
        request,
        ActivityUpdate(published=published),
        activity_uuid,
        current_user,
        db_session,
    )


@router.delete("/{activity_uuid}")
async def api_delete_activity(
    request: Request,
    activity_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
):
    return await delete_activity(request, activity_uuid, current_user, db_session)


# Video activity


@router.post("/video")
async def api_create_video_activity(
    request: Request,
    name: Annotated[str, Form()],
    chapter_id: Annotated[str, Form()],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
    details: Annotated[str, Form()] = "{}",
    video_file: UploadFile | None = None,
    video_uploaded_path: Annotated[str | None, Form()] = None,
    subtitle_files: list[UploadFile] | None = None,
) -> ActivityRead:
    if subtitle_files is None:
        subtitle_files = []
    return await create_video_activity(
        request,
        name,
        int(chapter_id),
        current_user,
        db_session,
        video_file,
        details=details,
        subtitle_files=subtitle_files,
        video_uploaded_path=video_uploaded_path,
    )


@router.post("/external_video")
async def api_create_external_video_activity(
    request: Request,
    external_video: ExternalVideo,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
) -> ActivityRead:
    return await create_external_video_activity(
        request, current_user, external_video, db_session
    )


@router.post("/documentpdf")
async def api_create_documentpdf_activity(
    request: Request,
    name: Annotated[str, Form()],
    chapter_id: Annotated[str, Form()],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session=Depends(get_db_session),
    pdf_file: UploadFile | None = None,
) -> ActivityRead:
    return await create_documentpdf_activity(
        request,
        name,
        int(chapter_id),
        current_user,
        db_session,
        pdf_file,
    )
