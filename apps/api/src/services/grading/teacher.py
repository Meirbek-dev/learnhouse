"""
Teacher grading service.
"""

import csv
import io
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
    late_only: bool = False,
    search: str | None = None,
    sort_by: str = "submitted_at",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> SubmissionListResponse:
    """
    Return paginated, filterable, searchable submissions for an activity (teacher view).

    Uses SQL LIMIT/OFFSET — no in-memory loading.
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
        # "NEEDS_GRADING" is a virtual filter mapping to PENDING
        if status_filter == "NEEDS_GRADING":
            query = query.where(Submission.status == SubmissionStatus.PENDING)
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

    if late_only:
        query = query.where(Submission.is_late == True)  # noqa: E712

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

    count_query = select(func.count()).select_from(query.subquery())
    total: int = db_session.exec(count_query).one()

    sort_col = _SORT_MAP.get(sort_by, Submission.submitted_at)
    order_fn = desc if sort_dir == "desc" else asc
    query = query.order_by(order_fn(sort_col))

    offset = (page - 1) * page_size
    page_rows = db_session.exec(query.offset(offset).limit(page_size)).all()

    users_by_id = _batch_fetch_users({s.user_id for s in page_rows}, db_session)

    pages = max(1, -(-total // page_size))
    return SubmissionListResponse(
        items=[_enrich(s, users_by_id) for s in page_rows],
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
    """
    Return aggregate statistics for the teacher dashboard.

    Uses two SQL queries instead of five:
      1. Status counts (GROUP BY status)
      2. Scores for graded submissions (for avg/pass-rate)
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

    # Query 1: status counts (excludes DRAFTs)
    status_rows = db_session.exec(
        select(Submission.status, func.count().label("cnt"))
        .where(
            Submission.activity_id == activity_id,
            Submission.status != SubmissionStatus.DRAFT,
        )
        .group_by(Submission.status)
    ).all()

    status_counts: dict[str, int] = {row.status: row.cnt for row in status_rows}
    total = sum(status_counts.values())
    pending_count = status_counts.get(SubmissionStatus.PENDING, 0)
    graded_count = (
        status_counts.get(SubmissionStatus.GRADED, 0)
        + status_counts.get(SubmissionStatus.PUBLISHED, 0)
    )

    # Query 2: late count (PENDING with is_late=True)
    late_count: int = db_session.exec(
        select(func.count()).where(
            Submission.activity_id == activity_id,
            Submission.status == SubmissionStatus.PENDING,
            Submission.is_late == True,  # noqa: E712
        )
    ).one()

    # Query 3 (small): scores for graded/published (for avg + pass rate)
    graded_scores: list[float] = db_session.exec(
        select(Submission.final_score).where(
            Submission.activity_id == activity_id,
            Submission.status.in_([SubmissionStatus.GRADED, SubmissionStatus.PUBLISHED]),
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
        needs_grading_count=pending_count,
        late_count=late_count,
        avg_score=avg_score,
        pass_rate=pass_rate,
    )


async def get_submission_for_teacher(
    submission_uuid: str,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionRead:
    """
    Fetch a single submission with full answers and grading breakdown.

    No longer auto-transitions status — PENDING is the single awaiting-grading
    state; there is no separate UNDER_REVIEW state.
    """
    submission = db_session.exec(
        select(Submission).where(Submission.submission_uuid == submission_uuid)
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found"
        )

    result = SubmissionRead.model_validate(submission)
    users_by_id = _batch_fetch_users({submission.user_id}, db_session)
    user = users_by_id.get(submission.user_id)
    if user:
        result.user = _make_submission_user(user)
    return result


async def export_grades_csv(
    activity_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> str:
    """
    Generate and return a CSV string of all non-draft submissions.

    Uses Python's csv module for safe escaping of names/emails containing
    quotes, commas, or newlines.
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

    rows = db_session.exec(
        select(Submission)
        .join(User, User.id == Submission.user_id)
        .where(
            Submission.activity_id == activity_id,
            Submission.status != SubmissionStatus.DRAFT,
        )
        .order_by(asc(Submission.submitted_at))
    ).all()

    users_by_id = _batch_fetch_users({s.user_id for s in rows}, db_session)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["Student Name", "Email", "Attempt", "Status", "Late", "Submitted At", "Auto Score", "Final Score"]
    )

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
        writer.writerow([
            name,
            email,
            s.attempt_number,
            s.status,
            "yes" if s.is_late else "no",
            submitted,
            s.auto_score if s.auto_score is not None else "",
            s.final_score if s.final_score is not None else "",
        ])

    return output.getvalue()


async def save_grade(
    submission_uuid: str,
    grade_input: TeacherGradeInput,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionRead:
    """Apply a teacher-entered final score and optional per-item feedback."""
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

    # Model-aware merge of item feedback — preserves all GradedItem fields
    existing = GradingBreakdown.model_validate(submission.grading_json or {})
    item_map = {item.item_id: item for item in existing.items}

    for fb in grade_input.item_feedback:
        if not isinstance(fb, ItemFeedback):
            fb = ItemFeedback(**fb) if isinstance(fb, dict) else fb
        if fb.item_id in item_map:
            update: dict = {"feedback": fb.feedback}
            if fb.score is not None:
                update["score"] = fb.score
                update["needs_manual_review"] = False
            item_map[fb.item_id] = item_map[fb.item_id].model_copy(update=update)
        else:
            item_map[fb.item_id] = GradedItem(
                item_id=fb.item_id,
                score=fb.score or 0.0,
                max_score=0.0,
                feedback=fb.feedback,
            )

    still_needs_review = any(
        item.needs_manual_review and not item.feedback
        for item in item_map.values()
    )

    updated_grading = GradingBreakdown(
        items=list(item_map.values()),
        needs_manual_review=still_needs_review,
        auto_graded=existing.auto_graded,
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


# ── Helpers ───────────────────────────────────────────────────────────────────


def _batch_fetch_users(user_ids: set[int], db_session: Session) -> dict[int, User]:
    if not user_ids:
        return {}
    rows = db_session.exec(select(User).where(User.id.in_(user_ids))).all()
    return {u.id: u for u in rows}


def _make_submission_user(u: User) -> SubmissionUser:
    return SubmissionUser(
        id=u.id,
        username=u.username,
        first_name=u.first_name or None,
        last_name=u.last_name or None,
        middle_name=u.middle_name or None,
        email=str(u.email),
        avatar_image=u.avatar_image or None,
        user_uuid=u.user_uuid or None,
    )


def _enrich(s: Submission, users_by_id: dict[int, User]) -> SubmissionRead:
    base = SubmissionRead.model_validate(s)
    user = users_by_id.get(s.user_id)
    if user:
        base.user = _make_submission_user(user)
    return base
