from collections import defaultdict
from datetime import UTC, datetime

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import (
    Activity,
    ActivityRead,
    ActivityReadWithPermissions,
)
from src.db.courses.chapters import (
    Chapter,
    ChapterCreate,
    ChapterRead,
    ChapterReadWithPermissions,
    ChapterUpdate,
    ChapterUpdateOrder,
)
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import PermissionChecker
from src.services.courses._auth import require_course_permission


def _get_chapter_by_uuid(chapter_uuid: str, db_session) -> Chapter:
    statement = select(Chapter).where(Chapter.chapter_uuid == chapter_uuid)
    chapter = db_session.exec(statement).first()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chapter does not exist"
        )
    return chapter


def _get_course_for_chapter(chapter: Chapter, db_session: Session) -> Course:
    course = db_session.exec(select(Course).where(Course.id == chapter.course_id)).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist"
        )
    return course


def _next_chapter_order(course_id: int, db_session: Session) -> int:
    result = db_session.exec(
        select(Chapter).where(Chapter.course_id == course_id).order_by(Chapter.order.desc())
    ).first()
    return (result.order if result else 0) + 1


def _next_activity_order(chapter_id: int, db_session: Session) -> int:
    result = db_session.exec(
        select(Activity).where(Activity.chapter_id == chapter_id).order_by(Activity.order.desc())
    ).first()
    return (result.order if result else 0) + 1


####################################################
# CRUD
####################################################


async def create_chapter(
    request: Request,
    chapter_object: ChapterCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    course = db_session.exec(select(Course).where(Course.id == chapter_object.course_id)).one()

    checker = PermissionChecker(db_session)
    require_course_permission("chapter:create", current_user, course, checker)

    chapter = Chapter.model_validate(chapter_object)
    chapter.chapter_uuid = f"chapter_{ULID()}"
    chapter.creation_date = datetime.now(tz=UTC)
    chapter.update_date = datetime.now(tz=UTC)
    chapter.creator_id = current_user.id
    chapter.order = _next_chapter_order(chapter_object.course_id, db_session)

    db_session.add(chapter)
    db_session.commit()
    db_session.refresh(chapter)

    return ChapterRead.model_validate(chapter, update={"activities": []})


async def get_chapter(
    request: Request,
    chapter_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    chapter = _get_chapter_by_uuid(chapter_uuid, db_session)
    course = _get_course_for_chapter(chapter, db_session)

    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "course:read")

    activities = db_session.exec(
        select(Activity)
        .where(Activity.chapter_id == chapter.id)
        .order_by(Activity.order)
    ).all()

    return ChapterRead.model_validate(
        chapter,
        update={"activities": [ActivityRead.model_validate(a) for a in activities]},
    )


async def update_chapter(
    request: Request,
    chapter_object: ChapterUpdate,
    chapter_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    chapter = _get_chapter_by_uuid(chapter_uuid, db_session)

    course = _get_course_for_chapter(chapter, db_session)
    checker = PermissionChecker(db_session)
    require_course_permission("chapter:update", current_user, course, checker)

    update_data = chapter_object.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(chapter, field, value)

    chapter.update_date = datetime.now(tz=UTC)
    db_session.commit()
    db_session.refresh(chapter)

    activities = db_session.exec(
        select(Activity)
        .where(Activity.chapter_id == chapter.id)
        .order_by(Activity.order)
    ).all()

    return ChapterRead.model_validate(
        chapter,
        update={"activities": [ActivityRead.model_validate(a) for a in activities]},
    )


async def delete_chapter(
    request: Request,
    chapter_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    chapter = _get_chapter_by_uuid(chapter_uuid, db_session)

    course = _get_course_for_chapter(chapter, db_session)
    checker = PermissionChecker(db_session)
    require_course_permission("chapter:delete", current_user, course, checker)

    # Activities cascade via FK (chapter_id → chapter.id ON DELETE CASCADE)
    db_session.delete(chapter)
    db_session.commit()

    return {"detail": "chapter deleted"}


async def move_chapter_to_order(
    request: Request,
    chapter_uuid: str,
    position: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    """Move a chapter to a new position within its course."""
    chapter = _get_chapter_by_uuid(chapter_uuid, db_session)
    course = _get_course_for_chapter(chapter, db_session)

    checker = PermissionChecker(db_session)
    require_course_permission("chapter:update", current_user, course, checker)

    old_order = chapter.order
    new_order = max(1, position)

    siblings = db_session.exec(
        select(Chapter)
        .where(Chapter.course_id == chapter.course_id)
        .where(Chapter.id != chapter.id)
        .order_by(Chapter.order)
    ).all()

    # Re-number siblings excluding the moved chapter
    cursor = 1
    for sib in siblings:
        if cursor == new_order:
            cursor += 1
        sib.order = cursor
        cursor += 1

    chapter.order = new_order
    db_session.commit()
    db_session.refresh(chapter)

    return await get_chapter(request, chapter.chapter_uuid, current_user, db_session)


async def move_activity_to_order(
    request: Request,
    activity_uuid: str,
    position: int,
    target_chapter_uuid: str | None,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    """Move an activity to a new position, optionally into a different chapter."""
    from src.db.courses.activities import Activity

    activity = db_session.exec(
        select(Activity).where(Activity.activity_uuid == activity_uuid)
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "activity:update", resource_owner_id=activity.creator_id)

    if target_chapter_uuid:
        target_chapter = _get_chapter_by_uuid(target_chapter_uuid, db_session)
        activity.chapter_id = target_chapter.id

    new_order = max(1, position)
    activity.order = new_order

    # Re-number siblings in the target chapter
    siblings = db_session.exec(
        select(Activity)
        .where(Activity.chapter_id == activity.chapter_id)
        .where(Activity.id != activity.id)
        .order_by(Activity.order)
    ).all()

    cursor = 1
    for sib in siblings:
        if cursor == new_order:
            cursor += 1
        sib.order = cursor
        cursor += 1

    db_session.commit()
    return {"detail": "activity moved"}


async def get_course_chapters(
    request: Request,
    course_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    with_unpublished_activities: bool,
    page: int = 1,
    limit: int = 10,
) -> list[ChapterReadWithPermissions]:
    course = db_session.exec(select(Course).where(Course.id == course_id)).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist")

    checker = PermissionChecker(db_session)
    if not course.public:
        checker.require(current_user.id, "course:read")

    chapters = db_session.exec(
        select(Chapter)
        .where(Chapter.course_id == course_id)
        .order_by(Chapter.order)
    ).all()

    chapter_reads = [
        ChapterReadWithPermissions.model_validate(chapter, update={"activities": []})
        for chapter in chapters
    ]

    if not chapter_reads:
        return chapter_reads

    chapter_ids = [c.id for c in chapter_reads]

    activities = db_session.exec(
        select(Activity)
        .where(Activity.chapter_id.in_(chapter_ids))
        .order_by(Activity.order)
    ).all()

    activities_by_chapter: dict[int, list[Activity]] = defaultdict(list)
    for activity in activities:
        if activity.chapter_id is not None:
            activities_by_chapter[activity.chapter_id].append(activity)

    for chapter in chapter_reads:
        for activity in activities_by_chapter.get(chapter.id, []):
            if not with_unpublished_activities and not activity.published:
                continue
            can_update = checker.check(
                current_user.id, "activity:update", resource_owner_id=activity.creator_id
            )
            can_delete = checker.check(
                current_user.id, "activity:delete", resource_owner_id=activity.creator_id
            )
            is_owner = activity.creator_id == current_user.id

            chapter.activities.append(
                ActivityReadWithPermissions(
                    **ActivityRead.model_validate(activity).model_dump(),
                    can_update=can_update,
                    can_delete=can_delete,
                    is_owner=is_owner,
                    is_creator=is_owner,
                )
            )

    return chapter_reads


async def reorder_chapters_and_activities(
    request: Request,
    course_uuid: str,
    chapters_order: ChapterUpdateOrder,
    current_user: PublicUser,
    db_session: Session,
):
    """Bulk reorder all chapters and activities in a course (used by drag-and-drop)."""
    course = db_session.exec(select(Course).where(Course.course_uuid == course_uuid)).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist")

    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "chapter:update", resource_owner_id=course.creator_id)

    # Batch-resolve chapter UUIDs
    all_chapter_uuids = [co.chapter_uuid for co in chapters_order.chapter_order_by_uuids]
    chapters_by_uuid: dict[str, Chapter] = {}
    if all_chapter_uuids:
        result = db_session.exec(
            select(Chapter).where(Chapter.chapter_uuid.in_(all_chapter_uuids))
        ).all()
        chapters_by_uuid = {c.chapter_uuid: c for c in result}

    # Reorder chapters
    for index, chapter_order in enumerate(chapters_order.chapter_order_by_uuids):
        chapter = chapters_by_uuid.get(chapter_order.chapter_uuid)
        if not chapter:
            continue
        chapter.order = index + 1
        chapter.update_date = datetime.now(tz=UTC)

    # Batch-resolve activity UUIDs
    all_activity_uuids = [
        uuid
        for co in chapters_order.chapter_order_by_uuids
        for uuid in co.activities_order_by_uuids
    ]
    activities_by_uuid: dict[str, Activity] = {}
    if all_activity_uuids:
        result = db_session.exec(
            select(Activity).where(Activity.activity_uuid.in_(all_activity_uuids))
        ).all()
        activities_by_uuid = {a.activity_uuid: a for a in result}

    # Reorder activities and reassign chapter_id (handles cross-chapter moves)
    for chapter_order in chapters_order.chapter_order_by_uuids:
        chapter = chapters_by_uuid.get(chapter_order.chapter_uuid)
        if not chapter:
            continue
        for index, activity_uuid in enumerate(chapter_order.activities_order_by_uuids):
            activity = activities_by_uuid.get(activity_uuid)
            if not activity:
                continue
            activity.chapter_id = chapter.id
            activity.order = index + 1

    db_session.commit()

    return {"detail": "Chapters and activities reordered successfully"}
