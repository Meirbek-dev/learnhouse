"""
Teacher-facing grading routes.

GET   /grading/submissions           — paginated + filterable + searchable list
GET   /grading/submissions/stats     — aggregate stats for dashboard header
GET   /grading/submissions/{uuid}    — single submission detail (with answers + grading)
PATCH /grading/submissions/{uuid}    — save teacher grade + feedback
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from fastapi import HTTPException, status as http_status
from sqlalchemy import desc

from src.core.events.database import get_db_session
from src.db.grading.submissions import (
    Submission,
    SubmissionListResponse,
    SubmissionRead,
    SubmissionStats,
    SubmissionUser,
    TeacherGradeInput,
)
from src.db.users import PublicUser, User
from src.security.auth import get_current_user
from src.security.rbac import PermissionChecker, PermissionCheckerDep
from src.services.grading.teacher import (
    get_submission_stats,
    get_submissions_for_activity,
    save_grade,
)
from sqlmodel import Session, select

router = APIRouter()


@router.get("/submissions", response_model=SubmissionListResponse)
async def api_list_submissions(
    activity_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="submitted_at"),
    sort_dir: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> SubmissionListResponse:
    """
    Paginated, filterable, searchable submissions list for a teacher.

    Query params:
    - activity_id: required
    - status: DRAFT | SUBMITTED | GRADED | LATE | RETURNED  (optional)
    - search: student name or email filter (optional)
    - sort_by: submitted_at | final_score | created_at | attempt_number
    - sort_dir: asc | desc
    - page, page_size: pagination
    """
    return await get_submissions_for_activity(
        activity_id=activity_id,
        current_user=current_user,
        db_session=db_session,
        status_filter=status_filter,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )


@router.get("/submissions/stats", response_model=SubmissionStats)
async def api_get_submission_stats(
    activity_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> SubmissionStats:
    """Aggregate statistics for the teacher dashboard header."""
    return await get_submission_stats(
        activity_id=activity_id,
        current_user=current_user,
        db_session=db_session,
    )


@router.get("/submissions/{submission_uuid}", response_model=SubmissionRead)
async def api_get_submission(
    submission_uuid: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> SubmissionRead:
    """Fetch a single submission with full answers and grading breakdown."""
    submission = db_session.exec(
        select(Submission).where(Submission.submission_uuid == submission_uuid)
    ).first()

    if not submission:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    # B4 fix: verify teacher has read access to the activity
    from src.db.courses.activities import Activity
    activity = db_session.exec(
        select(Activity).where(Activity.id == submission.activity_id)
    ).first()
    if activity:
        checker = PermissionChecker(db_session)
        checker.require(
            current_user.id,
            "assignment:read",
            resource_owner_id=activity.creator_id,
        )

    result = SubmissionRead.model_validate(submission)
    user = db_session.exec(select(User).where(User.id == submission.user_id)).first()
    if user:
        result.user = SubmissionUser(
            id=user.id,
            username=user.username,
            first_name=user.first_name or None,
            last_name=user.last_name or None,
            middle_name=user.middle_name or None,
            email=str(user.email),
            avatar_image=user.avatar_image or None,
            user_uuid=user.user_uuid or None,
        )
    return result


@router.patch("/submissions/{submission_uuid}", response_model=SubmissionRead)
async def api_save_grade(
    request: Request,
    submission_uuid: str,
    grade_input: TeacherGradeInput,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
) -> SubmissionRead:
    """
    Save a teacher-entered final score and optional per-item feedback.

    Required permission: assignment:grade
    """
    checker.require(current_user.id, "assignment:grade")

    return await save_grade(
        submission_uuid=submission_uuid,
        grade_input=grade_input,
        current_user=current_user,
        db_session=db_session,
    )
