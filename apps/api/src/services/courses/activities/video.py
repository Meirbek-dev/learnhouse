from datetime import datetime
from typing import Literal

import orjson
from fastapi import HTTPException, Request, UploadFile, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import (
    Activity,
    ActivityRead,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.strict_base_model import PydanticStrictBaseModel
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.rbac import (
    authorization_verify_based_on_roles_and_authorship,
    authorization_verify_if_user_is_anon,
)
from src.services.courses.activities.uploads.videos import upload_video


def validate_video_file(video_file: UploadFile | None) -> str:
    """Validate video file and return format"""
    if not video_file:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video : No video file provided",
        )

    if video_file.content_type not in [
        "video/mp4",
        "video/webm",
        "video/x-matroska",
    ]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video : Wrong video format",
        )

    video_format = (
        video_file.filename.rsplit(".", 1)[-1]
        if video_file.filename and "." in video_file.filename
        else None
    )

    if not video_format:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video : No video file provided or invalid filename",
        )

    return video_format


async def create_video_activity(
    request: Request,
    name: str,
    chapter_id: int,
    current_user: PublicUser,
    db_session: Session,
    video_file: UploadFile | None = None,
    details: str = "{}",
):
    # RBAC check
    await rbac_check(request, "activity_x", current_user, "create", db_session)

    # get chapter_id
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    # convert details to dict
    details = orjson.loads(details)

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found",
        )

    statement = select(CourseChapter).where(CourseChapter.chapter_id == chapter_id)
    coursechapter = db_session.exec(statement).first()

    if not coursechapter:
        raise HTTPException(
            status_code=404,
            detail="CourseChapter not found",
        )

    # Get org_uuid
    statement = select(Organization).where(Organization.id == coursechapter.org_id)
    organization = db_session.exec(statement).first()

    # Get course_uuid
    statement = select(Course).where(Course.id == coursechapter.course_id)
    course = db_session.exec(statement).first()

    # generate activity_uuid
    activity_uuid = str(f"activity_{ULID()}")

    # Validate video file and get format
    video_format = validate_video_file(video_file)

    activity_object = Activity(
        name=name,
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_HOSTED,
        activity_uuid=activity_uuid,
        org_id=coursechapter.org_id,
        course_id=coursechapter.course_id,
        published_version=1,
        content={
            "filename": f"video.{video_format}",
            "activity_uuid": activity_uuid,
        },
        details=details,
        version=1,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # create activity
    activity = Activity.model_validate(activity_object)
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    # upload video
    if video_file:
        # get videofile format
        await upload_video(
            video_file,
            activity.activity_uuid,
            organization.org_uuid,
            course.course_uuid,
        )

    # update chapter
    chapter_activity_object = ChapterActivity(
        chapter_id=chapter.id,
        activity_id=activity.id,
        course_id=coursechapter.course_id,
        org_id=coursechapter.org_id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        order=1,
    )

    # Insert ChapterActivity link in DB
    db_session.add(chapter_activity_object)
    db_session.commit()
    db_session.refresh(chapter_activity_object)

    return ActivityRead.model_validate(activity)


class ExternalVideo(PydanticStrictBaseModel):
    name: str
    uri: str
    type: Literal["youtube", "vimeo"]
    chapter_id: int
    details: str = "{}"


class ExternalVideoInDB(PydanticStrictBaseModel):
    activity_id: int


async def create_external_video_activity(  # TODO: Broken, fix this
    request: Request,
    current_user: PublicUser | AnonymousUser,
    data: ExternalVideo,
    db_session: Session,
):
    # RBAC check
    await rbac_check(request, "activity_x", current_user, "create", db_session)

    # get chapter_id
    statement = select(Chapter).where(Chapter.id == data.chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found",
        )

    statement = select(CourseChapter).where(CourseChapter.chapter_id == data.chapter_id)
    coursechapter = db_session.exec(statement).first()

    if not coursechapter:
        raise HTTPException(
            status_code=404,
            detail="CourseChapter not found",
        )

    # generate activity_uuid
    activity_uuid = str(f"activity_{ULID()}")

    # convert details to dict
    details = orjson.loads(data.details)

    activity_object = Activity(
        name=data.name,
        activity_type=ActivityTypeEnum.TYPE_VIDEO,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_VIDEO_YOUTUBE,
        activity_uuid=activity_uuid,
        course_id=coursechapter.course_id,
        org_id=coursechapter.org_id,
        published_version=1,
        content={
            "uri": data.uri,
            "type": data.type,
            "activity_uuid": activity_uuid,
        },
        details=details,
        version=1,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # create activity
    activity = Activity.model_validate(activity_object)
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    # update chapter
    chapter_activity_object = ChapterActivity(
        chapter_id=coursechapter.chapter_id,
        activity_id=activity.id,
        course_id=coursechapter.course_id,
        org_id=coursechapter.org_id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        order=1,
    )

    # Insert ChapterActivity link in DB
    db_session.add(chapter_activity_object)
    db_session.commit()

    return ActivityRead.model_validate(activity)


async def rbac_check(
    request: Request,
    course_id: int,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> None:
    await authorization_verify_if_user_is_anon(current_user.id)

    await authorization_verify_based_on_roles_and_authorship(
        request,
        current_user.id,
        action,
        course_id,
        db_session,
    )


## 🔒 RBAC Utils ##
