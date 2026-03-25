import logging
from datetime import datetime

from fastapi import HTTPException, Request, UploadFile
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import (
    Activity,
    ActivitySubTypeEnum,
    ActivityTypeEnum,
)
from src.db.courses.assignments import (
    Assignment,
    AssignmentCreate,
    AssignmentCreateWithActivity,
    AssignmentRead,
    AssignmentTask,
    AssignmentTaskCreate,
    AssignmentTaskRead,
    AssignmentTaskSubmission,
    AssignmentTaskSubmissionCreate,
    AssignmentTaskSubmissionRead,
    AssignmentTaskSubmissionUpdate,
    AssignmentTaskUpdate,
    AssignmentUpdate,
)
from src.db.courses.chapters import Chapter
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser, User
from src.security.rbac import PermissionChecker
from src.services.courses.activities.uploads.sub_file import upload_submission_file
from src.services.courses.activities.uploads.tasks_ref_files import (
    upload_reference_file,
)

logger = logging.getLogger(__name__)


def _build_assignment_read(
    assignment: Assignment,
    *,
    course_uuid: str | None = None,
    activity_uuid: str | None = None,
) -> AssignmentRead:
    return AssignmentRead.model_validate(
        assignment,
        update={
            "course_uuid": course_uuid,
            "activity_uuid": activity_uuid,
        },
    )

## > Assignments CRUD


async def create_assignment(
    request: Request,
    assignment_object: AssignmentCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentRead:
    # Check if platform exists
    statement = select(Course).where(Course.id == assignment_object.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:create",
        resource_owner_id=course.creator_id,
    )

    # Create Assignment
    assignment_data = assignment_object.model_dump(exclude_unset=True)
    assignment = Assignment(**assignment_data)

    assignment.assignment_uuid = f"assignment_{ULID()}"
    assignment.creation_date = datetime.now().isoformat()
    assignment.update_date = datetime.now().isoformat()

    # Insert Assignment in DB
    db_session.add(assignment)
    db_session.commit()
    db_session.refresh(assignment)

    # return assignment read
    return _build_assignment_read(assignment)


async def read_assignment(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentRead:
    # Check if assignment exists
    statement = select(Assignment).where(Assignment.assignment_uuid == assignment_uuid)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # return assignment read
    activity = db_session.exec(select(Activity).where(Activity.id == assignment.activity_id)).first()
    return _build_assignment_read(
        assignment,
        course_uuid=course.course_uuid,
        activity_uuid=activity.activity_uuid if activity else None,
    )


async def read_assignment_from_activity_uuid(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentRead:
    # Check if activity exists
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)
    activity = db_session.exec(statement).first()

    if not activity:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == activity.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.activity_id == activity.id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # return assignment read
    return _build_assignment_read(
        assignment,
        course_uuid=course.course_uuid,
        activity_uuid=activity.activity_uuid,
    )


async def update_assignment(
    request: Request,
    assignment_uuid: str,
    assignment_object: AssignmentUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentRead:
    # Check if assignment exists
    statement = select(Assignment).where(Assignment.assignment_uuid == assignment_uuid)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:update",
        resource_owner_id=course.creator_id,
    )

    # Update only the fields that were passed in using model_dump with exclude_unset
    update_data = assignment_object.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assignment, field, value)

    assignment.update_date = datetime.now().isoformat()

    # Insert Assignment in DB
    db_session.add(assignment)
    db_session.commit()
    db_session.refresh(assignment)

    # return assignment read
    activity = db_session.exec(select(Activity).where(Activity.id == assignment.activity_id)).first()
    return _build_assignment_read(
        assignment,
        course_uuid=course.course_uuid,
        activity_uuid=activity.activity_uuid if activity else None,
    )


async def delete_assignment(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict[str, str]:
    # Check if assignment exists
    statement = select(Assignment).where(Assignment.assignment_uuid == assignment_uuid)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:delete",
        resource_owner_id=course.creator_id,
    )

    # Delete Assignment
    db_session.delete(assignment)
    db_session.commit()

    return {"message": "Assignment deleted"}


async def delete_assignment_from_activity_uuid(
    request: Request,
    activity_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict[str, str]:
    # Check if activity exists
    statement = select(Activity).where(Activity.activity_uuid == activity_uuid)

    activity = db_session.exec(statement).first()

    if not activity:
        raise HTTPException(
            status_code=404,
            detail="Activity not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == activity.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.activity_id == activity.id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:delete",
        resource_owner_id=course.creator_id,
    )

    # Delete Assignment
    db_session.delete(assignment)

    db_session.commit()

    return {"message": "Assignment deleted"}


## > Assignments Tasks CRUD


async def create_assignment_task(
    request: Request,
    assignment_uuid: str,
    assignment_task_object: AssignmentTaskCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentTaskRead:
    # Check if assignment exists
    statement = select(Assignment).where(Assignment.assignment_uuid == assignment_uuid)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:create",
        resource_owner_id=course.creator_id,
    )

    # Create Assignment Task
    task_data = assignment_task_object.model_dump(exclude_unset=True)
    assignment_task = AssignmentTask(**task_data)

    assignment_task.assignment_task_uuid = f"assignmenttask_{ULID()}"
    assignment_task.creation_date = datetime.now().isoformat()
    assignment_task.update_date = datetime.now().isoformat()
    assignment_task.chapter_id = assignment.chapter_id
    assignment_task.activity_id = assignment.activity_id
    assignment_task.assignment_id = assignment.id
    assignment_task.course_id = assignment.course_id

    # Insert Assignment Task in DB
    db_session.add(assignment_task)
    db_session.commit()
    db_session.refresh(assignment_task)

    # return assignment task read
    return AssignmentTaskRead.model_validate(assignment_task)


async def read_assignment_tasks(
    request: Request,
    assignment_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[AssignmentTaskRead]:
    # Find assignment
    statement = select(Assignment).where(Assignment.assignment_uuid == assignment_uuid)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # Find assignments tasks for an assignment
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_id == assignment.id
    )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # return assignment tasks read
    return [
        AssignmentTaskRead.model_validate(assignment_task)
        for assignment_task in db_session.exec(statement).all()
    ]


async def read_assignment_task(
    request: Request,
    assignment_task_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentTaskRead:
    # Find assignment
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignmenttask = db_session.exec(statement).first()

    if not assignmenttask:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignmenttask.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # return assignment task read
    return AssignmentTaskRead.model_validate(assignmenttask)


async def put_assignment_task_reference_file(
    request: Request,
    db_session: Session,
    assignment_task_uuid: str,
    current_user: PublicUser | AnonymousUser,
    reference_file: UploadFile | None = None,
) -> AssignmentTaskRead:
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check for activity
    statement = select(Activity).where(Activity.id == assignment.activity_id)
    activity = db_session.exec(statement).first()

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:update",
        resource_owner_id=course.creator_id,
    )

    # Upload reference file
    if reference_file and reference_file.filename and activity:
        name_in_disk = (
            f"{assignment_task_uuid}{ULID()}.{reference_file.filename.split('.')[-1]}"
        )
        await upload_reference_file(
            reference_file,
            name_in_disk,
            activity.activity_uuid,
            course.course_uuid,
            assignment.assignment_uuid,
            assignment_task_uuid,
        )
        # Update reference file
        assignment_task.reference_file = name_in_disk

    assignment_task.update_date = datetime.now().isoformat()

    # Insert Assignment Task in DB
    db_session.add(assignment_task)
    db_session.commit()
    db_session.refresh(assignment_task)

    # return assignment task read
    return AssignmentTaskRead.model_validate(assignment_task)


async def put_assignment_task_submission_file(
    request: Request,
    db_session: Session,
    assignment_task_uuid: str,
    current_user: PublicUser | AnonymousUser,
    sub_file: UploadFile | None = None,
) -> dict[str, str]:
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check for activity
    statement = select(Activity).where(Activity.id == assignment.activity_id)
    activity = db_session.exec(statement).first()

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check - only need read permission to submit files
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # Check if user is enrolled in the course
    can_view = checker.check(current_user.id, "course:read")
    if not can_view:
        raise HTTPException(
            status_code=403,
            detail="You must be enrolled in this course to submit files",
        )

    # Upload submission file
    if sub_file and sub_file.filename and activity:
        name_in_disk = f"{assignment_task_uuid}_sub_{current_user.email}_{ULID()}.{sub_file.filename.split('.')[-1]}"
        await upload_submission_file(
            sub_file,
            name_in_disk,
            activity.activity_uuid,
            course.course_uuid,
            assignment.assignment_uuid,
            assignment_task_uuid,
        )

        return {"file_uuid": name_in_disk}

    return {"file_uuid": ""}


async def update_assignment_task(
    request: Request,
    assignment_task_uuid: str,
    assignment_task_object: AssignmentTaskUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentTaskRead:
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:update",
        resource_owner_id=course.creator_id,
    )

    # Update only the fields that were passed in using model_dump with exclude_unset
    update_data = assignment_task_object.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assignment_task, field, value)

    assignment_task.update_date = datetime.now().isoformat()

    # Insert Assignment Task in DB
    db_session.add(assignment_task)
    db_session.commit()
    db_session.refresh(assignment_task)

    # return assignment task read
    return AssignmentTaskRead.model_validate(assignment_task)


async def delete_assignment_task(
    request: Request,
    assignment_task_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict[str, str]:
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:delete",
        resource_owner_id=course.creator_id,
    )

    # Delete Assignment Task
    db_session.delete(assignment_task)
    db_session.commit()

    return {"message": "Assignment Task deleted"}


## > Assignments Tasks Submissions CRUD


async def handle_assignment_task_submission(
    request: Request,
    assignment_task_uuid: str,
    assignment_task_submission_object: AssignmentTaskSubmissionUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentTaskSubmissionRead:
    assignment_task_submission_uuid = (
        assignment_task_submission_object.assignment_task_submission_uuid
    )
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # SECURITY: Check if user has instructor/admin permissions for grading
    checker = PermissionChecker(db_session)
    is_instructor = checker.check(
        current_user.id,
        "course:update",
        resource_owner_id=course.creator_id,
    )

    # For regular users, ensure they can only submit their own work
    if not is_instructor:
        # Check if user is enrolled in the course
        can_view = checker.check(current_user.id, "course:read")
        if not can_view:
            raise HTTPException(
                status_code=403,
                detail="You must be enrolled in this course to submit assignments",
            )

        # SECURITY: Regular users cannot update grades - only check if actual values are being set
        if (
            assignment_task_submission_object.grade is not None
            and assignment_task_submission_object.grade != 0
        ) or (
            assignment_task_submission_object.task_submission_grade_feedback is not None
            and assignment_task_submission_object.task_submission_grade_feedback != ""
        ):
            raise HTTPException(
                status_code=403, detail="You do not have permission to update grades"
            )

        # Only need read permission for submissions
        checker.require(
            current_user.id,
            "assignment:read",
            is_assigned=True,
        )
    else:
        # SECURITY: Instructors/admins need update permission to grade
        checker.require(
            current_user.id,
            "assignment:update",
            resource_owner_id=course.creator_id,
        )

    # Try to find existing submission by user_id and assignment_task_id first (for save progress functionality)
    statement = select(AssignmentTaskSubmission).where(
        AssignmentTaskSubmission.assignment_task_id == assignment_task.id,
        AssignmentTaskSubmission.user_id == current_user.id,
    )
    assignment_task_submission = db_session.exec(statement).first()

    # If no submission found by user+task, try to find by UUID if provided (for specific submission updates)
    if not assignment_task_submission and assignment_task_submission_uuid:
        statement = select(AssignmentTaskSubmission).where(
            AssignmentTaskSubmission.assignment_task_submission_uuid
            == assignment_task_submission_uuid
        )
        assignment_task_submission = db_session.exec(statement).first()

    # If submission exists, update it
    if assignment_task_submission:
        # SECURITY: For regular users, ensure they can only update their own submissions
        if not is_instructor and assignment_task_submission.user_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="You can only update your own submissions"
            )

        # Update only the fields that were passed in using model_dump with exclude_unset
        update_data = assignment_task_submission_object.model_dump(exclude_unset=True)

        # Exclude immutable fields that shouldn't be updated
        immutable_fields = {"assignment_task_submission_uuid"}

        for field, value in update_data.items():
            if field not in immutable_fields and value is not None:
                setattr(assignment_task_submission, field, value)

        assignment_task_submission.update_date = datetime.now().isoformat()

        # Insert Assignment Task Submission in DB
        db_session.add(assignment_task_submission)
        db_session.commit()
        db_session.refresh(assignment_task_submission)

    else:
        # Create new Task submission
        current_time = datetime.now().isoformat()

        model_data = assignment_task_submission_object.model_dump(exclude_unset=True)

        assignment_task_submission = AssignmentTaskSubmission(
            assignment_task_submission_uuid=assignment_task_submission_uuid
            or f"assignmenttasksubmission_{ULID()}",
            task_submission=model_data.get("task_submission", ""),
            grade=0,  # Always start with 0 for new submissions
            task_submission_grade_feedback="",  # Start with empty feedback
            assignment_task_id=int(assignment_task.id),
            assignment_type=assignment_task.assignment_type,
            activity_id=assignment.activity_id,
            course_id=assignment.course_id,
            chapter_id=assignment.chapter_id,
            user_id=current_user.id,
            creation_date=current_time,
            update_date=current_time,
        )

        # Insert Assignment Task Submission in DB
        db_session.add(assignment_task_submission)
        db_session.commit()
        db_session.refresh(assignment_task_submission)

    # return assignment task submission read
    return AssignmentTaskSubmissionRead.model_validate(assignment_task_submission)


async def read_user_assignment_task_submissions(
    request: Request,
    assignment_task_uuid: str,
    user_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentTaskSubmissionRead | None:
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # Check if assignment task submission exists
    statement = select(AssignmentTaskSubmission).where(
        AssignmentTaskSubmission.assignment_task_id == assignment_task.id,
        AssignmentTaskSubmission.user_id == user_id,
    )
    assignment_task_submission = db_session.exec(statement).first()

    if not assignment_task_submission:
        return None

    # return assignment task submission read
    return AssignmentTaskSubmissionRead.model_validate(assignment_task_submission)


async def read_user_assignment_task_submissions_me(
    request: Request,
    assignment_task_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # Check if assignment task submission exists
    statement = select(AssignmentTaskSubmission).where(
        AssignmentTaskSubmission.assignment_task_id == assignment_task.id,
        AssignmentTaskSubmission.user_id == current_user.id,
    )
    assignment_task_submission = db_session.exec(statement).first()

    if not assignment_task_submission:
        # Return None instead of raising an error for cases where no submission exists yet
        return None

    # return assignment task submission read
    return AssignmentTaskSubmissionRead.model_validate(assignment_task_submission)


async def read_assignment_task_submissions(
    request: Request,
    assignment_task_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[AssignmentTaskSubmissionRead]:
    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.assignment_task_uuid == assignment_task_uuid
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        resource_owner_id=course.creator_id,
    )

    # return assignment task submissions list
    statement = select(AssignmentTaskSubmission).where(
        AssignmentTaskSubmission.assignment_task_id == assignment_task.id
    )
    submissions = db_session.exec(statement).all()

    return [AssignmentTaskSubmissionRead.model_validate(item) for item in submissions]


async def update_assignment_task_submission(
    request: Request,
    assignment_task_submission_uuid: str,
    assignment_task_submission_object: AssignmentTaskSubmissionCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> AssignmentTaskSubmissionRead:
    # Check if assignment task submission exists
    statement = select(AssignmentTaskSubmission).where(
        AssignmentTaskSubmission.assignment_task_submission_uuid
        == assignment_task_submission_uuid
    )
    assignment_task_submission = db_session.exec(statement).first()

    if not assignment_task_submission:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task Submission not found",
        )

    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.id == assignment_task_submission.assignment_task_id
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # Update only the fields that were passed in using model_dump with exclude_unset
    update_data = assignment_task_submission_object.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Validate grade range strictly (0-100)
        if field == "grade" and value is not None:
            try:
                val = int(value)
            except Exception:
                raise HTTPException(
                    status_code=400, detail="Grade must be an integer between 0 and 100"
                )
            if val < 0 or val > 100:
                raise HTTPException(
                    status_code=400, detail=f"Grade {val} is out of range (0-100)"
                )
            setattr(assignment_task_submission, field, val)
            continue

        # Validate grade range strictly (0-100)
        if field == "grade" and value is not None:
            try:
                val = int(value)
            except Exception:
                raise HTTPException(
                    status_code=400, detail="Grade must be an integer between 0 and 100"
                )
            if val < 0 or val > 100:
                raise HTTPException(
                    status_code=400, detail=f"Grade {val} is out of range (0-100)"
                )
            setattr(assignment_task_submission, field, val)
            continue

        setattr(assignment_task_submission, field, value)

    assignment_task_submission.update_date = datetime.now().isoformat()

    # Insert Assignment Task Submission in DB
    db_session.add(assignment_task_submission)
    db_session.commit()
    db_session.refresh(assignment_task_submission)

    # return assignment task submission read
    return AssignmentTaskSubmissionRead.model_validate(assignment_task_submission)


async def delete_assignment_task_submission(
    request: Request,
    assignment_task_submission_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict[str, str]:
    # Check if assignment task submission exists
    statement = select(AssignmentTaskSubmission).where(
        AssignmentTaskSubmission.assignment_task_submission_uuid
        == assignment_task_submission_uuid
    )
    assignment_task_submission = db_session.exec(statement).first()

    if not assignment_task_submission:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task Submission not found",
        )

    # Check if assignment task exists
    statement = select(AssignmentTask).where(
        AssignmentTask.id == assignment_task_submission.assignment_task_id
    )
    assignment_task = db_session.exec(statement).first()

    if not assignment_task:
        raise HTTPException(
            status_code=404,
            detail="Assignment Task not found",
        )

    # Check if assignment exists
    statement = select(Assignment).where(Assignment.id == assignment_task.assignment_id)
    assignment = db_session.exec(statement).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found",
        )

    # Check if course exists
    statement = select(Course).where(Course.id == assignment.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:delete",
        resource_owner_id=course.creator_id,
    )

    # Delete Assignment Task Submission
    db_session.delete(assignment_task_submission)
    db_session.commit()

    return {"message": "Assignment Task Submission deleted"}


async def create_assignment_with_activity(
    request: Request,
    assignment_object: AssignmentCreateWithActivity,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    chapter_id: int,
    activity_name: str,
) -> AssignmentRead:
    """
    Create assignment with activity in a single transaction for better performance.
    """
    # Check if course exists
    statement = select(Course).where(Course.id == assignment_object.course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:create",
        resource_owner_id=course.creator_id,
    )

    # Resolve chapter for order calculation
    chapter = db_session.exec(select(Chapter).where(Chapter.id == chapter_id)).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Determine order within chapter
    last_in_chapter = db_session.exec(
        select(Activity)
        .where(Activity.chapter_id == chapter_id)
        .order_by(Activity.order.desc())
    ).first()
    next_order = (last_in_chapter.order if last_in_chapter else 0) + 1

    # Create Activity first
    activity = Activity(
        name=activity_name,
        activity_type=ActivityTypeEnum.TYPE_ASSIGNMENT,
        activity_sub_type=ActivitySubTypeEnum.SUBTYPE_ASSIGNMENT_ANY,
        published=assignment_object.published,
        chapter_id=chapter_id,
        course_id=assignment_object.course_id,  # keep legacy column in sync
        order=next_order,
        activity_uuid=f"activity_{ULID()}",
        creation_date=datetime.now().isoformat(),
        update_date=datetime.now().isoformat(),
    )

    # Insert Activity in DB
    db_session.add(activity)
    db_session.flush()  # Flush to get the ID without committing

    assignment_data = assignment_object.model_dump(exclude_unset=True)
    assignment = Assignment(**assignment_data)

    assignment.assignment_uuid = f"assignment_{ULID()}"
    assignment.creation_date = datetime.now().isoformat()
    assignment.update_date = datetime.now().isoformat()
    assignment.activity_id = activity.id
    assignment.chapter_id = chapter_id

    # Insert Assignment in DB
    db_session.add(assignment)
    db_session.commit()
    db_session.refresh(assignment)

    # return assignment read
    return AssignmentRead.model_validate(assignment)


async def get_assignments_from_course(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[AssignmentRead]:
    # Find course
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found",
        )

    # Get Activities
    statement = select(Activity).where(Activity.course_id == course.id)
    activities = db_session.exec(statement).all()

    # Get Assignments in a single batch query
    activity_ids = [a.id for a in activities]
    assignments = []
    if activity_ids:
        assignments = db_session.exec(
            select(Assignment).where(Assignment.activity_id.in_(activity_ids))
        ).all()

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        is_assigned=True,
        resource_owner_id=course.creator_id,
    )

    # return assignments read
    return [AssignmentRead.model_validate(assignment) for assignment in assignments]


async def get_assignments_from_courses(
    request: Request,
    course_uuids: list[str],
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict[str, list[AssignmentRead]]:
    """
    Get assignments for multiple courses in a single request. Returns a mapping
    of course_uuid -> list[AssignmentRead]. An entry is present for each input
    course_uuid (empty list if no assignments or course not found).
    """
    # Fetch courses that exist
    statement = select(Course).where(Course.course_uuid.in_(course_uuids))
    courses = db_session.exec(statement).all()

    # Build helper maps
    course_id_to_uuid = {c.id: c.course_uuid for c in courses}

    # Check RBAC for each found course
    checker = PermissionChecker(db_session)
    for c in courses:
        checker.require(
            current_user.id,
            "assignment:read",
            is_assigned=True,
            resource_owner_id=c.creator_id,
        )

    course_ids = list(course_id_to_uuid.keys())

    # Load activities for those courses
    activities = []
    if course_ids:
        statement = select(Activity).where(Activity.course_id.in_(course_ids))
        activities = db_session.exec(statement).all()

    activity_id_to_course_uuid = {
        a.id: course_id_to_uuid.get(a.course_id) for a in activities
    }
    activity_ids = list(activity_id_to_course_uuid.keys())

    # Load assignments for those activities
    assignments = []
    if activity_ids:
        statement = select(Assignment).where(Assignment.activity_id.in_(activity_ids))
        assignments = db_session.exec(statement).all()

    # Build result mapping (preserve input course order/keys)
    result: dict[str, list[AssignmentRead]] = {uuid: [] for uuid in course_uuids}
    for assignment in assignments:
        course_uuid = activity_id_to_course_uuid.get(assignment.activity_id)
        if course_uuid:
            result.setdefault(course_uuid, []).append(
                AssignmentRead.model_validate(assignment)
            )

    return result


async def get_editable_assignments_from_courses(
    request: Request,
    course_uuids: list[str],
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> dict[str, list[AssignmentRead]]:
    """
    Get assignments the current user can edit for multiple courses.

    Only includes assignments from courses where the user has
    assignment:update permission. Returns a mapping of
    course_uuid -> list[AssignmentRead]; every input uuid is present
    (empty list when the user lacks edit access or there are no assignments).
    """
    result: dict[str, list[AssignmentRead]] = {uuid: [] for uuid in course_uuids}

    if isinstance(current_user, AnonymousUser) or not course_uuids:
        return result

    statement = select(Course).where(Course.course_uuid.in_(course_uuids))
    courses = db_session.exec(statement).all()

    checker = PermissionChecker(db_session)

    # Filter to courses where the user has assignment:update permission
    editable_course_ids: set[int] = set()
    course_id_to_uuid: dict[int, str] = {}
    for c in courses:
        if checker.check(
            current_user.id,
            "assignment:update",
            resource_owner_id=c.creator_id,
        ):
            editable_course_ids.add(c.id)
            course_id_to_uuid[c.id] = c.course_uuid

    if not editable_course_ids:
        return result

    # Load activities for editable courses
    activities_statement = select(Activity).where(
        Activity.course_id.in_(list(editable_course_ids))
    )
    activities = db_session.exec(activities_statement).all()

    activity_id_to_course_uuid = {
        a.id: course_id_to_uuid.get(a.course_id) for a in activities
    }
    activity_ids = list(activity_id_to_course_uuid.keys())

    if not activity_ids:
        return result

    # Load assignments for those activities
    assignments_statement = select(Assignment).where(
        Assignment.activity_id.in_(activity_ids)
    )
    assignments = db_session.exec(assignments_statement).all()

    for assignment in assignments:
        course_uuid = activity_id_to_course_uuid.get(assignment.activity_id)
        if course_uuid:
            result.setdefault(course_uuid, []).append(
                AssignmentRead.model_validate(assignment)
            )

    return result
