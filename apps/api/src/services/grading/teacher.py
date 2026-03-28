"""
Teacher grading service.
"""

import logging
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func, or_
from sqlmodel import Session, select

from src.db.courses.activities import Activity
from src.db.grading.submissions import (
    GradedItem,
    GradingBreakdown,
    ItemFeedback,
    Submission,
    SubmissionListResponse,
    SubmissionRead,
    SubmissionStats,
    SubmissionStatus,
    SubmissionUser,
    TeacherGradeInput,
)
from src.db.users import PublicUser, User
from src.security.rbac import PermissionChecker

logger = logging.getLogger(__name__)

_SORT_MAP = {
    "submitted_at": Submission.submitted_at,
    "final_score": Submission.final_score,
    "created_at": Submission.created_at,
    "attempt_number": Submission.attempt_number,
}


async def get_submissions_for_activity(
    activity_id: int,
    current_user: PublicUser,
    db_session: Session,
    *,
    status_filter: str | None = None,
    search: str | None = None,
    sort_by: str = "submitted_at",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> SubmissionListResponse:
    """
    Return paginated, filterable, searchable submissions for an activity (teacher view).

    B1 fix: uses SQL LIMIT/OFFSET — no longer loads all rows into Python memory.
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

    # Base query — join User for search support
    query = (
        select(Submission)
        .join(User, User.id == Submission.user_id)
        .where(Submission.activity_id == activity_id)
    )

    if status_filter:
        # "NEEDS_GRADING" is a virtual filter that maps to SUBMITTED + LATE + UNDER_REVIEW
        if status_filter == "NEEDS_GRADING":
            query = query.where(
                Submission.status.in_(
                    [
                        SubmissionStatus.SUBMITTED,
                        SubmissionStatus.LATE,
                        SubmissionStatus.UNDER_REVIEW,
                    ]
                )
            )
        else:
            try:
                query = query.where(
                    Submission.status == SubmissionStatus(status_filter)
                )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status '{status_filter}'",
                )

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.username.ilike(term),
                User.email.ilike(term),
            )
        )

    # Count total (B1 fix: SQL count instead of len(all_rows))
    count_query = select(func.count()).select_from(query.subquery())
    total: int = db_session.exec(count_query).one()

    # Sort
    sort_col = _SORT_MAP.get(sort_by, Submission.submitted_at)
    order_fn = desc if sort_dir == "desc" else asc
    query = query.order_by(order_fn(sort_col))

    # Paginate via SQL (B1 fix)
    offset = (page - 1) * page_size
    page_rows = db_session.exec(query.offset(offset).limit(page_size)).all()

    # Batch-fetch user records
    user_ids = {s.user_id for s in page_rows}
    users_by_id: dict[int, User] = {}
    if user_ids:
        user_rows = db_session.exec(select(User).where(User.id.in_(user_ids))).all()
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

    pages = max(1, -(-total // page_size))
    return SubmissionListResponse(
        items=[_enrich(s) for s in page_rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


async def get_submission_stats(
    activity_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionStats:
    """Return aggregate statistics for the teacher dashboard header.

    Uses SQL-level aggregation — no full-table Python scan.
    """
    activity = db_session.exec(
        select(Activity).where(Activity.id == activity_id)
    ).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found"
        )

    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "assignment:read", resource_owner_id=activity.creator_id
    )

    # Total count (excludes DRAFTs)
    total: int = db_session.exec(
        select(func.count()).where(
            Submission.activity_id == activity_id,
            Submission.status != SubmissionStatus.DRAFT,
        )
    ).one()

    # Graded count (GRADED + PUBLISHED)
    graded_count: int = db_session.exec(
        select(func.count()).where(
            Submission.activity_id == activity_id,
            Submission.status.in_(
                [SubmissionStatus.GRADED, SubmissionStatus.PUBLISHED]
            ),
        )
    ).one()

    # Needs grading (SUBMITTED + LATE + UNDER_REVIEW)
    needs_grading_count: int = db_session.exec(
        select(func.count()).where(
            Submission.activity_id == activity_id,
            Submission.status.in_(
                [
                    SubmissionStatus.SUBMITTED,
                    SubmissionStatus.LATE,
                    SubmissionStatus.UNDER_REVIEW,
                ]
            ),
        )
    ).one()

    # Late count
    late_count: int = db_session.exec(
        select(func.count()).where(
            Submission.activity_id == activity_id,
            Submission.status == SubmissionStatus.LATE,
        )
    ).one()

    # Avg score and pass rate from GRADED/PUBLISHED submissions only
    graded_scores: list[float] = db_session.exec(
        select(Submission.final_score).where(
            Submission.activity_id == activity_id,
            Submission.status.in_(
                [SubmissionStatus.GRADED, SubmissionStatus.PUBLISHED]
            ),
            Submission.final_score.is_not(None),
        )
    ).all()

    avg_score = (
        round(sum(graded_scores) / len(graded_scores), 2) if graded_scores else None
    )
    passing = [s for s in graded_scores if s >= 50.0]
    pass_rate = (
        round(len(passing) / len(graded_scores) * 100, 1) if graded_scores else None
    )

    return SubmissionStats(
        total=total,
        graded_count=graded_count,
        needs_grading_count=needs_grading_count,
        late_count=late_count,
        avg_score=avg_score,
        pass_rate=pass_rate,
    )


async def mark_under_review(
    submission_uuid: str,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionRead:
    """Transition a SUBMITTED or LATE submission to UNDER_REVIEW when teacher opens it.

    Idempotent — does nothing if already in UNDER_REVIEW or further along.
    """
    submission = db_session.exec(
        select(Submission).where(Submission.submission_uuid == submission_uuid)
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found"
        )

    if submission.status in (SubmissionStatus.SUBMITTED, SubmissionStatus.LATE):
        submission.status = SubmissionStatus.UNDER_REVIEW
        submission.updated_at = datetime.now(UTC)
        db_session.add(submission)
        db_session.commit()
        db_session.refresh(submission)

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


async def export_grades_csv(
    activity_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> str:
    """Generate and return a CSV string of all non-draft submissions for an activity.

    Streams all rows from the DB via batched SQL (no 1000-row client-side cap).
    """
    activity = db_session.exec(
        select(Activity).where(Activity.id == activity_id)
    ).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found"
        )

    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "assignment:read", resource_owner_id=activity.creator_id
    )

    # Fetch all non-draft submissions with user data via join
    rows = db_session.exec(
        select(Submission)
        .join(User, User.id == Submission.user_id)
        .where(
            Submission.activity_id == activity_id,
            Submission.status != SubmissionStatus.DRAFT,
        )
        .order_by(asc(Submission.submitted_at))
    ).all()

    # Build user lookup
    user_ids = {s.user_id for s in rows}
    users_by_id: dict[int, User] = {}
    if user_ids:
        user_rows = db_session.exec(select(User).where(User.id.in_(user_ids))).all()
        users_by_id = {u.id: u for u in user_rows}

    lines: list[str] = [
        "Student Name,Email,Attempt,Status,Submitted At,Auto Score,Final Score"
    ]
    for s in rows:
        u = users_by_id.get(s.user_id)
        if u:
            parts = [p for p in [u.first_name, u.middle_name, u.last_name] if p]
            name = " ".join(parts) if parts else u.username
            email = str(u.email)
        else:
            name = f"User #{s.user_id}"
            email = ""

        submitted = s.submitted_at.isoformat() if s.submitted_at else ""
        lines.append(
            f'"{name}","{email}",{s.attempt_number},{s.status},{submitted},'
            f"{s.auto_score if s.auto_score is not None else ''},"
            f"{s.final_score if s.final_score is not None else ''}"
        )

    return "\n".join(lines)


async def save_grade(
    submission_uuid: str,
    grade_input: TeacherGradeInput,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionRead:
    """Apply a teacher-entered final score and optional feedback to a submission."""
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
            if not isinstance(fb, ItemFeedback):
                fb = ItemFeedback(**fb) if isinstance(fb, dict) else fb
            if fb.item_id in item_map:
                item_map[fb.item_id]["feedback"] = fb.feedback
                if fb.score is not None:
                    item_map[fb.item_id]["score"] = fb.score
                    item_map[fb.item_id]["needs_manual_review"] = False
            else:
                item_map[fb.item_id] = GradedItem(
                    item_id=fb.item_id,
                    score=fb.score or 0.0,
                    max_score=0.0,
                    feedback=fb.feedback,
                ).model_dump()
        existing_items = list(item_map.values())

    # DX4 fix: preserve needs_manual_review if items still lack scores
    still_needs_review = any(
        item.get("needs_manual_review") and not item.get("feedback")
        for item in existing_items
    )

    updated_grading = GradingBreakdown(
        items=[GradedItem(**item) for item in existing_items],
        needs_manual_review=still_needs_review,
        auto_graded=existing_grading.get("auto_graded", False),
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
