from datetime import datetime

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.chapters import (
    Chapter,
    ChapterCreate,
    ChapterRead,
    ChapterUpdate,
    ChapterUpdateOrder,
)
from src.db.courses.course_chapters import CourseChapter
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.security.courses_security import courses_rbac_check_for_chapters

####################################################
# CRUD
####################################################


async def create_chapter(
    request: Request,
    chapter_object: ChapterCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    chapter = Chapter.model_validate(chapter_object)

    # Get Course
    statement = select(Course).where(Course.id == chapter_object.course_id)
    course = db_session.exec(statement).one()

    # RBAC check
    await courses_rbac_check_for_chapters(
        request, course.course_uuid, current_user, "create", db_session
    )

    # Complete chapter object
    chapter.course_id = chapter_object.course_id
    chapter.chapter_uuid = f"chapter_{ULID()}"
    chapter.creation_date = str(datetime.now())
    chapter.update_date = str(datetime.now())
    chapter.org_id = course.org_id

    # Find the last chapter in the course and add it to the list
    statement = (
        select(CourseChapter)
        .where(CourseChapter.course_id == chapter.course_id)
        .order_by(CourseChapter.order)
    )
    course_chapters = db_session.exec(statement).all()

    # Get last chapter order
    last_order = course_chapters[-1].order if course_chapters else 0
    to_be_used_order = last_order + 1

    # Add chapter to database
    db_session.add(chapter)
    db_session.commit()
    db_session.refresh(chapter)

    chapter_read = ChapterRead.model_validate(chapter, update={"activities": []})

    # Check if CourseChapter link exists
    statement = (
        select(CourseChapter)
        .where(CourseChapter.chapter_id == chapter.id)
        .where(CourseChapter.course_id == chapter.course_id)
        .where(CourseChapter.order == to_be_used_order)
    )
    course_chapter = db_session.exec(statement).first()

    if not course_chapter:
        # Add CourseChapter link
        course_chapter = CourseChapter(
            course_id=chapter.course_id,
            chapter_id=chapter.id,
            org_id=chapter.org_id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
            order=to_be_used_order,
        )

        # Insert CourseChapter link in DB
        db_session.add(course_chapter)
        db_session.commit()

    return chapter_read


async def get_chapter(
    request: Request,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chapter does not exist"
        )

    # Get Course
    statement = select(Course).where(Course.id == chapter.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist"
        )

    # RBAC check
    await courses_rbac_check_for_chapters(
        request, course.course_uuid, current_user, "read", db_session
    )

    # Get activities for this chapter
    statement = (
        select(Activity)
        .join(ChapterActivity, Activity.id == ChapterActivity.activity_id)
        .where(ChapterActivity.chapter_id == chapter_id)
        .distinct(Activity.id)
    )

    activities = db_session.exec(statement).all()

    return ChapterRead.model_validate(
        chapter,
        update={
            "activities": [
                ActivityRead.model_validate(activity) for activity in activities
            ]
        },
    )


async def update_chapter(
    request: Request,
    chapter_object: ChapterUpdate,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> ChapterRead:
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chapter does not exist"
        )

    # RBAC check
    await courses_rbac_check_for_chapters(
        request, chapter.chapter_uuid, current_user, "update", db_session
    )

    # Update only the fields that were passed in
    update_data = chapter_object.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(chapter, field, value)

    chapter.update_date = str(datetime.now())

    db_session.commit()
    db_session.refresh(chapter)

    return await get_chapter(request, chapter.id, current_user, db_session)


async def delete_chapter(
    request: Request,
    chapter_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Chapter).where(Chapter.id == chapter_id)
    chapter = db_session.exec(statement).first()

    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chapter does not exist"
        )

    # RBAC check
    await courses_rbac_check_for_chapters(
        request, chapter.chapter_uuid, current_user, "delete", db_session
    )

    # Remove all linked chapter activities
    statement = select(ChapterActivity).where(ChapterActivity.chapter_id == chapter.id)
    chapter_activities = db_session.exec(statement).all()

    for chapter_activity in chapter_activities:
        db_session.delete(chapter_activity)

    # Delete the chapter
    db_session.delete(chapter)
    db_session.commit()

    return {"detail": "chapter deleted"}


async def get_course_chapters(
    request: Request,
    course_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    with_unpublished_activities: bool,
    page: int = 1,
    limit: int = 10,
) -> list[ChapterRead]:
    statement = select(Course).where(Course.id == course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist"
        )

    # RBAC check
    await courses_rbac_check_for_chapters(
        request, course.course_uuid, current_user, "read", db_session
    )

    statement = (
        select(Chapter)
        .join(CourseChapter, Chapter.id == CourseChapter.chapter_id)
        .where(CourseChapter.course_id == course_id)
        .where(Chapter.course_id == course_id)
        .order_by(CourseChapter.order)
        .group_by(Chapter.id, CourseChapter.order)
    )
    chapters = db_session.exec(statement).all()

    chapter_reads = [
        ChapterRead.model_validate(chapter, update={"activities": []})
        for chapter in chapters
    ]

    # Get activities for each chapter
    for chapter in chapter_reads:
        statement = (
            select(ChapterActivity)
            .where(ChapterActivity.chapter_id == chapter.id)
            .order_by(ChapterActivity.order)
            .distinct(ChapterActivity.id, ChapterActivity.order)
        )
        chapter_activities = db_session.exec(statement).all()

        for chapter_activity in chapter_activities:
            statement = select(Activity).where(
                Activity.id == chapter_activity.activity_id
            )
            activity = db_session.exec(statement).first()
            if activity and (with_unpublished_activities or activity.published):
                chapter.activities.append(ActivityRead.model_validate(activity))

    return chapter_reads


async def reorder_chapters_and_activities(
    request: Request,
    course_uuid: str,
    chapters_order: ChapterUpdateOrder,
    current_user: PublicUser,
    db_session: Session,
):
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course does not exist"
        )

    # RBAC check
    await courses_rbac_check_for_chapters(
        request, course.course_uuid, current_user, "update", db_session
    )

    ###########
    # Chapters
    ###########

    # Get all existing course chapters
    statement = select(CourseChapter).where(
        CourseChapter.course_id == course.id, CourseChapter.org_id == course.org_id
    )
    existing_course_chapters = db_session.exec(statement).all()

    # Create a map of existing chapters for faster lookup
    existing_chapter_map = {cc.chapter_id: cc for cc in existing_course_chapters}

    # Update or create course chapters based on new order
    for index, chapter_order in enumerate(chapters_order.chapter_order_by_ids):
        new_order = index + 1

        if chapter_order.chapter_id in existing_chapter_map:
            # Update existing chapter order
            existing_cc = existing_chapter_map[chapter_order.chapter_id]
            existing_cc.order = new_order
            existing_cc.update_date = str(datetime.now())
        else:
            # Create new course chapter
            new_chapter = CourseChapter(
                course_id=course.id,
                chapter_id=chapter_order.chapter_id,
                org_id=course.org_id,
                order=new_order,
                creation_date=str(datetime.now()),
                update_date=str(datetime.now()),
            )
            db_session.add(new_chapter)

    # Remove chapters that are no longer in the order
    chapter_ids_to_keep = {co.chapter_id for co in chapters_order.chapter_order_by_ids}
    chapters_to_remove = [
        cc
        for cc in existing_course_chapters
        if cc.chapter_id not in chapter_ids_to_keep
    ]
    for cc in chapters_to_remove:
        db_session.delete(cc)

    db_session.commit()

    ###########
    # Activities
    ###########

    # Get all existing chapter activities
    statement = select(ChapterActivity).where(
        ChapterActivity.course_id == course.id, ChapterActivity.org_id == course.org_id
    )
    existing_chapter_activities = db_session.exec(statement).all()

    # Create a map for faster lookup
    existing_activity_map = {
        (ca.chapter_id, ca.activity_id): ca for ca in existing_chapter_activities
    }

    # Track which activities we want to keep
    activities_to_keep = set()

    # Update or create chapter activities based on new order
    for chapter_order in chapters_order.chapter_order_by_ids:
        for index, activity_order in enumerate(chapter_order.activities_order_by_ids):
            activity_key = (chapter_order.chapter_id, activity_order.activity_id)
            activities_to_keep.add(activity_key)
            new_order = index + 1

            if activity_key in existing_activity_map:
                # Update existing activity order
                existing_ca = existing_activity_map[activity_key]
                existing_ca.order = new_order
                existing_ca.update_date = str(datetime.now())
            else:
                # Create new chapter activity
                new_activity = ChapterActivity(
                    chapter_id=chapter_order.chapter_id,
                    activity_id=activity_order.activity_id,
                    course_id=course.id,
                    org_id=course.org_id,
                    order=new_order,
                    creation_date=str(datetime.now()),
                    update_date=str(datetime.now()),
                )
                db_session.add(new_activity)

    # Remove activities that are no longer in any chapter
    activities_to_remove = [
        ca
        for ca in existing_chapter_activities
        if (ca.chapter_id, ca.activity_id) not in activities_to_keep
    ]
    for ca in activities_to_remove:
        db_session.delete(ca)

    db_session.commit()

    return {"detail": "Chapters and activities reordered successfully"}
