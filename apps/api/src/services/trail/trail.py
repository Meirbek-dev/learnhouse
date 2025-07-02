from datetime import datetime

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import Activity
from src.db.courses.chapter_activities import ChapterActivity
from src.db.courses.courses import Course
from src.db.trail_runs import TrailRun, TrailRunRead
from src.db.trail_steps import TrailStep, TrailStepRead
from src.db.trails import Trail, TrailCreate, TrailRead
from src.db.users import AnonymousUser, PublicUser


async def create_user_trail(
    request: Request,
    user: PublicUser,
    trail_object: TrailCreate,
    db_session: Session,
) -> Trail:
    statement = select(Trail).where(
        Trail.org_id == trail_object.org_id, Trail.user_id == user.id
    )
    trail = db_session.exec(statement).first()

    if trail:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trail already exists",
        )

    # Use model_validate for proper Pydantic v2 conversion
    trail = Trail.model_validate(trail_object.model_dump())

    trail.creation_date = str(datetime.now())
    trail.update_date = str(datetime.now())
    trail.org_id = trail_object.org_id
    trail.trail_uuid = str(f"trail_{ULID()}")

    # create trail
    db_session.add(trail)
    db_session.commit()
    db_session.refresh(trail)

    return trail


def _build_trail_run_data(
    trail_runs: list[TrailRun], db_session: Session
) -> list[TrailRunRead]:
    """Helper function to build trail run data with course info and steps."""
    trail_runs_read = [
        TrailRunRead(
            **trail_run.model_dump(), course={}, steps=[], course_total_steps=0
        )
        for trail_run in trail_runs
    ]

    # Add course object and total activities in a course to trail runs
    for trail_run in trail_runs_read:
        statement = select(Course).where(Course.id == trail_run.course_id)
        course = db_session.exec(statement).first()
        trail_run.course = course.model_dump() if course else {}

        # Add number of activities (steps) in a course
        statement = select(ChapterActivity).where(
            ChapterActivity.course_id == trail_run.course_id
        )
        course_total_steps = db_session.exec(statement).all()
        trail_run.course_total_steps = len(course_total_steps)

    return trail_runs_read


def _populate_trail_steps(
    trail_runs: list[TrailRunRead], db_session: Session, user_id: int
) -> None:
    """Helper function to populate trail steps with activity information."""
    for trail_run in trail_runs:
        statement = select(TrailStep).where(TrailStep.trailrun_id == trail_run.id)
        trail_steps = db_session.exec(statement).all()

        trail_steps_read = [
            TrailStepRead(**trail_step.model_dump()) for trail_step in trail_steps
        ]
        trail_run.steps = trail_steps_read

        for trail_step in trail_steps_read:
            # Get activity information for each trail step
            statement = select(Activity).where(Activity.id == trail_step.activity_id)
            activity = db_session.exec(statement).first()
            if activity:
                trail_step.activity = activity.model_dump()


async def get_user_trails(
    request: Request,
    user: PublicUser,
    db_session: Session,
) -> TrailRead:
    statement = select(Trail).where(Trail.user_id == user.id)
    trail = db_session.exec(statement).first()

    if not trail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trail not found"
        )

    statement = select(TrailRun).where(TrailRun.trail_id == trail.id)
    trail_runs = db_session.exec(statement).all()

    trail_runs_read = _build_trail_run_data(trail_runs, db_session)
    _populate_trail_steps(trail_runs_read, db_session, user.id)

    return TrailRead(
        **trail.model_dump(),
        runs=trail_runs_read,
    )


async def check_trail_presence(
    org_id: int,
    user_id: int,
    request: Request,
    user: PublicUser,
    db_session: Session,
) -> Trail:
    statement = select(Trail).where(Trail.org_id == org_id, Trail.user_id == user_id)
    trail = db_session.exec(statement).first()

    if not trail:
        return await create_user_trail(
            request,
            user,
            TrailCreate(
                org_id=org_id,
                user_id=user.id,
            ),
            db_session,
        )

    return trail


async def get_user_trail_with_orgid(
    request: Request, user: PublicUser | AnonymousUser, org_id: int, db_session: Session
) -> TrailRead:
    if isinstance(user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Anonymous users cannot access this endpoint",
        )

    trail = await check_trail_presence(
        org_id=org_id,
        user_id=user.id,
        request=request,
        user=user,
        db_session=db_session,
    )

    statement = select(TrailRun).where(TrailRun.trail_id == trail.id)
    trail_runs = db_session.exec(statement).all()

    trail_runs_read = _build_trail_run_data(trail_runs, db_session)
    _populate_trail_steps(trail_runs_read, db_session, user.id)

    return TrailRead(
        **trail.model_dump(),
        runs=trail_runs_read,
    )


def _get_or_create_trail_run(
    trail: Trail, course: Course, user: PublicUser, db_session: Session
) -> TrailRun:
    """Helper function to get or create a trail run."""
    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id,
        TrailRun.course_id == course.id,
        TrailRun.user_id == user.id,
    )
    trailrun = db_session.exec(statement).first()

    if not trailrun:
        trailrun = TrailRun(
            trail_id=trail.id or 0,
            course_id=course.id or 0,
            org_id=course.org_id,
            user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(trailrun)
        db_session.commit()
        db_session.refresh(trailrun)

    return trailrun


def _create_trail_step_if_not_exists(
    trailrun: TrailRun,
    activity: Activity,
    course: Course,
    trail: Trail,
    user: PublicUser,
    db_session: Session,
) -> TrailStep:
    """Helper function to create a trail step if it doesn't exist."""
    statement = select(TrailStep).where(
        TrailStep.trailrun_id == trailrun.id,
        TrailStep.activity_id == activity.id,
        TrailStep.user_id == user.id,
    )
    trailstep = db_session.exec(statement).first()

    if not trailstep:
        trailstep = TrailStep(
            trailrun_id=trailrun.id or 0,
            activity_id=activity.id or 0,
            course_id=course.id or 0,
            trail_id=trail.id or 0,
            org_id=course.org_id,
            complete=True,
            teacher_verified=False,
            grade="",
            user_id=user.id,
            creation_date=str(datetime.now()),
            update_date=str(datetime.now()),
        )
        db_session.add(trailstep)
        db_session.commit()
        db_session.refresh(trailstep)

    return trailstep


def _build_final_trail_response(
    trail: Trail, user: PublicUser, db_session: Session
) -> TrailRead:
    """Helper function to build the final trail response."""
    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id, TrailRun.user_id == user.id
    )
    trail_runs = db_session.exec(statement).all()

    trail_runs_read = _build_trail_run_data(trail_runs, db_session)
    _populate_trail_steps(trail_runs_read, db_session, user.id)

    return TrailRead(
        **trail.model_dump(),
        runs=trail_runs_read,
    )


async def add_activity_to_trail(
    request: Request,
    user: PublicUser,
    activity_uuid: str,
    db_session: Session,
) -> TrailRead:
    # Look for the activity
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)
    activity = db_session.exec(statement).first()

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found"
        )

    statement = select(Course).where(Course.id == activity.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    trail = await check_trail_presence(
        org_id=course.org_id,
        user_id=user.id,
        request=request,
        user=user,
        db_session=db_session,
    )

    trailrun = _get_or_create_trail_run(trail, course, user, db_session)
    _create_trail_step_if_not_exists(
        trailrun, activity, course, trail, user, db_session
    )

    return _build_final_trail_response(trail, user, db_session)


async def remove_activity_from_trail(
    request: Request,
    user: PublicUser,
    activity_uuid: str,
    db_session: Session,
) -> TrailRead:
    # Look for the activity
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)
    activity = db_session.exec(statement).first()

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found"
        )

    statement = select(Course).where(Course.id == activity.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    statement = select(Trail).where(
        Trail.org_id == course.org_id, Trail.user_id == user.id
    )
    trail = db_session.exec(statement).first()

    if not trail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trail not found"
        )

    # Delete the trail step for this activity
    statement = select(TrailStep).where(
        TrailStep.activity_id == activity.id,
        TrailStep.user_id == user.id,
        TrailStep.trail_id == trail.id,
    )
    trail_step = db_session.exec(statement).first()

    if trail_step:
        db_session.delete(trail_step)
        db_session.commit()

    return _build_final_trail_response(trail, user, db_session)


async def add_course_to_trail(
    request: Request,
    user: PublicUser,
    course_uuid: str,
    db_session: Session,
) -> TrailRead:
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    # check if run already exists
    statement = select(TrailRun).where(
        TrailRun.course_id == course.id, TrailRun.user_id == user.id
    )
    trailrun = db_session.exec(statement).first()

    if trailrun:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="TrailRun already exists"
        )

    statement = select(Trail).where(
        Trail.org_id == course.org_id, Trail.user_id == user.id
    )
    trail = db_session.exec(statement).first()

    if not trail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trail not found"
        )

    _get_or_create_trail_run(trail, course, user, db_session)

    return _build_final_trail_response(trail, user, db_session)


async def remove_course_from_trail(
    request: Request,
    user: PublicUser,
    course_uuid: str,
    db_session: Session,
) -> TrailRead:
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Course not found"
        )

    statement = select(Trail).where(
        Trail.org_id == course.org_id, Trail.user_id == user.id
    )
    trail = db_session.exec(statement).first()

    if not trail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trail not found"
        )

    statement = select(TrailRun).where(
        TrailRun.trail_id == trail.id,
        TrailRun.course_id == course.id,
        TrailRun.user_id == user.id,
    )
    trail_run = db_session.exec(statement).first()

    if trail_run:
        db_session.delete(trail_run)
        db_session.commit()

    # Delete all trail steps for this course
    statement = select(TrailStep).where(
        TrailStep.course_id == course.id,
        TrailStep.user_id == user.id,
        TrailStep.trail_id == trail.id,
    )
    trail_steps = db_session.exec(statement).all()

    for trail_step in trail_steps:
        db_session.delete(trail_step)

    if trail_steps:
        db_session.commit()

    return _build_final_trail_response(trail, user, db_session)
