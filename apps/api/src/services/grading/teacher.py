"""
Teacher grading service.

Replaces the broken grade_assignment_submission() which:
- Had no grade input (just averaged task submissions)
- Could not accept a manual score
- Had no feedback field
"""

import logging
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlmodel import Session, select

from src.db.courses.activities import Activity
from src.db.grading.schemas import TeacherGradeInput
from src.db.grading.submissions import (
    GradedItem,
    GradingBreakdown,
    Submission,
    SubmissionRead,
    SubmissionStatus,
    SubmissionUser,
)
from src.db.users import PublicUser, User
from src.security.rbac import PermissionChecker

logger = logging.getLogger(__name__)


async def get_submissions_for_activity(
    activity_id: int,
    current_user: PublicUser,
    db_session: Session,
    *,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    """
    Return paginated submissions for an activity (teacher view).

    Replaces the kanban query that fetched all submissions at once with
    no pagination, filtering, or sorting.
    """
    activity = db_session.exec(
        select(Activity).where(Activity.id == activity_id)
    ).first()

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )

    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:read",
        resource_owner_id=activity.creator_id,
    )

    query = select(Submission).where(Submission.activity_id == activity_id)

    if status_filter:
        try:
            query = query.where(Submission.status == SubmissionStatus(status_filter))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{status_filter}'",
            )

    all_rows = db_session.exec(query).all()
    total = len(all_rows)

    offset = (page - 1) * page_size
    page_rows = all_rows[offset : offset + page_size]

    # Batch-fetch user records so we can embed display info in each row
    user_ids = {s.user_id for s in page_rows}
    users_by_id: dict[int, User] = {}
    if user_ids:
        user_rows = db_session.exec(
            select(User).where(User.id.in_(user_ids))
        ).all()
        users_by_id = {u.id: u for u in user_rows}

    def _enrich(s: Submission) -> SubmissionRead:
        base = SubmissionRead.model_validate(s)
        u = users_by_id.get(s.user_id)
        if u:
            base.user = SubmissionUser(
                id=u.id,
                username=u.username,
                first_name=u.first_name or None,
                last_name=u.last_name or None,
                middle_name=u.middle_name or None,
                email=str(u.email),
                avatar_image=u.avatar_image or None,
                user_uuid=u.user_uuid or None,
            )
        return base

    return {
        "items": [_enrich(s) for s in page_rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


async def save_grade(
    submission_uuid: str,
    grade_input: TeacherGradeInput,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionRead:
    """
    Apply a teacher-entered final score and optional feedback to a submission.

    Replaces the broken PUT /assignments/{uuid}/submissions/{user_id}/grade
    endpoint which had no body (and therefore no way to input a score).
    """
    submission = db_session.exec(
        select(Submission).where(Submission.submission_uuid == submission_uuid)
    ).first()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    activity = db_session.exec(
        select(Activity).where(Activity.id == submission.activity_id)
    ).first()

    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )

    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        "assignment:grade",
        resource_owner_id=activity.creator_id,
    )

    # Merge per-item feedback into grading_json
    existing_grading = submission.grading_json or {}
    existing_items: list[dict] = existing_grading.get("items", [])

    if grade_input.item_feedback:
        item_map = {item["item_id"]: item for item in existing_items}
        for fb in grade_input.item_feedback:
            if fb.item_id in item_map:
                item_map[fb.item_id]["feedback"] = fb.feedback
                if fb.score is not None:
                    item_map[fb.item_id]["score"] = fb.score
            else:
                item_map[fb.item_id] = GradedItem(
                    item_id=fb.item_id,
                    score=fb.score or 0.0,
                    max_score=0.0,
                    feedback=fb.feedback,
                ).model_dump()
        existing_items = list(item_map.values())

    updated_grading = GradingBreakdown(
        items=[GradedItem(**item) for item in existing_items],
        needs_manual_review=False,
        auto_graded=False,
        feedback=grade_input.feedback,
    )

    now = datetime.now(UTC)
    submission.final_score = grade_input.final_score
    submission.status = SubmissionStatus(grade_input.status)
    submission.grading_json = updated_grading.model_dump()
    submission.graded_at = now
    submission.updated_at = now

    db_session.add(submission)
    db_session.commit()
    db_session.refresh(submission)

    return SubmissionRead.model_validate(submission)
