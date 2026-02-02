from datetime import datetime

from fastapi import HTTPException, Request
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import (
    Activity,
    ActivityCreate,
    ActivityRead,
    ActivityReadWithPermissions,
    ActivityUpdate,
)
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser
from src.services.payments.payments_access import check_activity_paid_access
from src.services.permissions import get_permission_service
from src.services.rbac.enrichment import (
    enrich_activity_with_permissions,
)

####################################################
# CRUD
####################################################


async def create_activity(
    request: Request,
    activity_object: ActivityCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # CHeck if org exists
    statement = select(Chapter).where(Chapter.id == activity_object.chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found",
        )

    # RBAC check
    statement = select(Course).where(Course.id == chapter.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.ACTIVITY,
        resource_id=course.course_uuid,
    )

    # Create Activity
    activity = Activity(**activity_object.model_dump())

    activity.activity_uuid = f"activity_{ULID()}"
    activity.creation_date = str(datetime.now())
    activity.update_date = str(datetime.now())
    activity.org_id = chapter.org_id
    activity.course_id = chapter.course_id
    activity.creator_id = current_user.id  # Track creator

    # Insert Activity in DB
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    # Find the last activity in the Chapter and add it to the list
    statement = (
        select(ChapterActivity)
        .where(ChapterActivity.chapter_id == activity_object.chapter_id)
        .order_by(ChapterActivity.order)
    )
    chapter_activities = db_session.exec(statement).all()

    last_order = chapter_activities[-1].order if chapter_activities else 0
    to_be_used_order = last_order + 1

    # Add activity to chapter
    activity_chapter = ChapterActivity(
        chapter_id=activity_object.chapter_id,
        activity_id=activity.id if activity.id else 0,
        course_id=chapter.course_id,
        org_id=chapter.org_id,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
        order=to_be_used_order,
    )

    # Insert ChapterActivity link in DB
    db_session.add(activity_chapter)
    db_session.commit()
    db_session.refresh(activity_chapter)

    return ActivityRead.model_validate(activity)


async def get_activity(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser,
    db_session: Session,
):
    # Optimize by joining Activity with Course in a single query
    statement = (
        select(Activity, Course)
        .join(Course)
        .where(Activity.activity_uuid == activity_uuid)
    )
    result = db_session.exec(statement).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    activity, course = result

    # RBAC check
    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ACTIVITY,
        resource_id=course.course_uuid,
    )

    # Paid access check
    has_paid_access = await check_activity_paid_access(
        request=request,
        activity_id=activity.id if activity.id else 0,
        user=current_user,
        db_session=db_session,
    )

    activity_read = ActivityRead.model_validate(activity)
    activity_read.content = (
        activity_read.content if has_paid_access else {"paid_access": False}
    )

    # Enrich with permission metadata
    activity_dict = activity_read.model_dump()
    enriched_dict = await enrich_activity_with_permissions(
        activity=activity_dict,
        current_user=current_user,
        permission_service=permission_service,
    )

    return ActivityReadWithPermissions(**enriched_dict)



async def get_activityby_id(
    request: Request,
    activity_id: int,
    current_user: PublicUser,
    db_session: Session,
):
    # Optimize by joining Activity with Course in a single query
    statement = select(Activity, Course).join(Course).where(Activity.id == activity_id)
    result = db_session.exec(statement).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    activity, course = result

    # RBAC check
    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ACTIVITY,
        resource_id=course.course_uuid,
    )

    return ActivityRead.model_validate(activity)


async def update_activity(
    request: Request,
    activity_object: ActivityUpdate,
    activity_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)
    activity = db_session.exec(statement).first()

    if not activity:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    # RBAC check
    statement = select(Course).where(Course.id == activity.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ACTIVITY,
        resource_id=course.course_uuid,
    )

    # Update only the fields that were passed in
    update_data = activity_object.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(activity, field, value)

    activity.update_date = str(datetime.now())

    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    return ActivityRead.model_validate(activity)


async def delete_activity(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)
    activity = db_session.exec(statement).first()

    if not activity:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    # RBAC check
    statement = select(Course).where(Course.id == activity.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.ACTIVITY,
        resource_id=course.course_uuid,
    )

    # Delete activity from chapter
    statement = select(ChapterActivity).where(
        ChapterActivity.activity_id == activity.id
    )
    activity_chapter = db_session.exec(statement).first()

    if not activity_chapter:
        raise HTTPException(
            status_code=404,
            detail="Activity not found in chapter",
        )

    db_session.delete(activity_chapter)
    db_session.delete(activity)
    db_session.commit()

    return {"detail": "Activity deleted"}


####################################################
# Misc
####################################################


async def get_activities(
    request: Request,
    coursechapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[ActivityRead]:
    # Get activities that are published and belong to the chapter
    statement = (
        select(Activity)
        .join(ChapterActivity)
        .where(ChapterActivity.chapter_id == coursechapter_id, Activity.published)
    )
    activities = db_session.exec(statement).all()

    if not activities:
        raise HTTPException(
            status_code=404,
            detail="No published activities found",
        )

    # RBAC check
    statement = select(Chapter).where(Chapter.id == coursechapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found",
        )

    statement = select(Course).where(Course.id == chapter.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    permission_service = get_permission_service(db_session)
    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ACTIVITY,
        resource_id=course.course_uuid,
    )

    return [ActivityRead.model_validate(activity) for activity in activities]
