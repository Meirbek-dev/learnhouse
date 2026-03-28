"""
Teacher-facing grading routes.

GET   /grading/submissions           — paginated + filterable + searchable list
GET   /grading/submissions/stats     — aggregate stats for dashboard header
GET   /grading/submissions/export    — streaming CSV export (no 1000-row cap)
GET   /grading/submissions/{uuid}    — single submission detail (with answers + grading)
PATCH /grading/submissions/{uuid}    — save teacher grade + feedback
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi import status as http_status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc
from sqlmodel import Session, select

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
    export_grades_csv,
    get_submission_stats,
    get_submissions_for_activity,
    mark_under_review,
    save_grade,
)

router = APIRouter()


@router.get("/submissions", response_model=SubmissionListResponse)
async def api_list_submissions(
    activity_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "submitted_at",
    sort_dir: Annotated[str, Query()] = "desc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
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


@router.get("/submissions/export")
async def api_export_submissions_csv(
    activity_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> StreamingResponse:
    """
    Export all non-draft submissions for an activity as CSV.

    Streams the full dataset — no 1000-row cap.
    Content-Disposition header triggers a browser download.
    """
    csv_content = await export_grades_csv(
        activity_id=activity_id,
        current_user=current_user,
        db_session=db_session,
    )

    def _iter():
        yield csv_content

    return StreamingResponse(
        _iter(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=grades-activity-{activity_id}.csv"
        },
    )


@router.get("/submissions/{submission_uuid}", response_model=SubmissionRead)
async def api_get_submission(
    submission_uuid: str,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> SubmissionRead:
    """Fetch a single submission with full answers and grading breakdown.

    Automatically transitions SUBMITTED/LATE → UNDER_REVIEW when a teacher
    opens the submission for the first time.
    """
    return await mark_under_review(
        submission_uuid=submission_uuid,
        current_user=current_user,
        db_session=db_session,
    )


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
