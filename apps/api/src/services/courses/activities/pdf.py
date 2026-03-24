from datetime import datetime

from fastapi import HTTPException, Request, UploadFile, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import (
    Activity,
    ActivityRead,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import PermissionChecker
from src.services.courses.activities.uploads.pdfs import upload_pdf


def _next_activity_order(chapter_id: int, db_session: Session) -> int:
    result = db_session.exec(
        select(Activity)
        .where(Activity.chapter_id == chapter_id)
        .order_by(Activity.order.desc())
    ).first()
    return (result.order if result else 0) + 1


async def create_documentpdf_activity(
    request: Request,
    name: str,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    pdf_file: UploadFile | None = None,
):
    chapter = db_session.exec(select(Chapter).where(Chapter.id == chapter_id)).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    course = db_session.exec(select(Course).where(Course.id == chapter.course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "activity:create", resource_owner_id=course.creator_id)

    if not pdf_file:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Pdf : No pdf file provided"
        )

    if pdf_file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Pdf : Wrong pdf format"
        )

    if not pdf_file.filename:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Pdf : No pdf file provided"
        )

    pdf_format = pdf_file.filename.split(".")[-1]
    activity_uuid = f"activity_{ULID()}"

    activity = Activity(
        name=name,
        activity_type=ActivityTypeEnum.TYPE_DOCUMENT,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_DOCUMENT_PDF,
        content={"filename": f"documentpdf.{pdf_format}", "activity_uuid": activity_uuid},
        chapter_id=chapter.id,
        course_id=chapter.course_id,  # keep legacy column in sync
        activity_uuid=activity_uuid,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        order=_next_activity_order(chapter_id, db_session),
        creator_id=current_user.id,
    )

    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    await upload_pdf(pdf_file, activity.activity_uuid, course.course_uuid)

    return ActivityRead.model_validate(activity)
