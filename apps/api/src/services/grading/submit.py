"""
Submission orchestrator — replaces the scattered submit_quiz / create_assignment_submission
logic with a single entry point per lifecycle action.
"""

import logging
from datetime import UTC, datetime

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.courses.activities import Activity
from src.db.gamification import XPSource
from src.db.grading.submissions import (
    AssessmentType,
    Submission,
    SubmissionRead,
    SubmissionStatus,
)
from src.db.users import PublicUser
from src.security.rbac import PermissionChecker
from src.services.gamification.service import award_xp
from src.services.grading.grader import grade_submission

logger = logging.getLogger(__name__)


async def start_submission(
    request: Request,
    activity_id: int,
    assessment_type: AssessmentType,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionRead:
    """
    Create a DRAFT Submission and record the server-stamped start time.

    Called when a student clicks "Start" on a quiz or exam — the start
    timestamp is set here on the server, so clients cannot falsify it.
    """
    activity = _get_activity_or_404(activity_id, db_session)
    _require_permission(current_user, activity, "quiz:submit", db_session)

    # Find or create a DRAFT submission for this attempt
    existing_draft = db_session.exec(
        select(Submission).where(
            Submission.activity_id == activity_id,
            Submission.user_id == current_user.id,
            Submission.status == SubmissionStatus.DRAFT,
        )
    ).first()

    if existing_draft:
        return SubmissionRead.model_validate(existing_draft)

    # Count previous attempts (non-draft) to set attempt_number
    previous = db_session.exec(
        select(Submission).where(
            Submission.activity_id == activity_id,
            Submission.user_id == current_user.id,
            Submission.status != SubmissionStatus.DRAFT,
        )
    ).all()
    attempt_number = len(previous) + 1

    now = datetime.now(UTC)
    submission = Submission(
        submission_uuid=f"submission_{ULID()}",
        assessment_type=assessment_type,
        activity_id=activity_id,
        user_id=current_user.id,
        status=SubmissionStatus.DRAFT,
        attempt_number=attempt_number,
        answers_json={"started_at": now.isoformat()},
        grading_json={},
        created_at=now,
        updated_at=now,
    )
    db_session.add(submission)
    db_session.commit()
    db_session.refresh(submission)
    return SubmissionRead.model_validate(submission)


async def submit_assessment(
    request: Request,
    activity_id: int,
    assessment_type: AssessmentType,
    answers_payload: dict,
    current_user: PublicUser,
    db_session: Session,
    *,
    # Quiz-specific extras
    violation_count: int = 0,
    # Grading context (fetched by the route handler)
    questions: list[dict] | None = None,
    settings: dict | None = None,
) -> SubmissionRead:
    """
    Submit an assessment attempt and auto-grade where possible.

    The route handler fetches the activity-specific content (questions, settings)
    and passes them here. This keeps the service layer assessment-agnostic.
    """
    activity = _get_activity_or_404(activity_id, db_session)
    _require_permission(current_user, activity, "quiz:submit", db_session)

    settings = settings or {}

    # Retrieve the DRAFT submission created by start_submission()
    draft = db_session.exec(
        select(Submission).where(
            Submission.activity_id == activity_id,
            Submission.user_id == current_user.id,
            Submission.status == SubmissionStatus.DRAFT,
        )
    ).first()

    if not draft:
        if assessment_type != AssessmentType.ASSIGNMENT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active draft submission found. Call /grading/start first.",
            )
        # Assignments have no timed start — auto-create the draft inline so
        # students can submit without a separate /grading/start call.
        previous = db_session.exec(
            select(Submission).where(
                Submission.activity_id == activity_id,
                Submission.user_id == current_user.id,
                Submission.status != SubmissionStatus.DRAFT,
            )
        ).all()
        now_ts = datetime.now(UTC)
        draft = Submission(
            submission_uuid=f"submission_{ULID()}",
            assessment_type=assessment_type,
            activity_id=activity_id,
            user_id=current_user.id,
            status=SubmissionStatus.DRAFT,
            attempt_number=len(previous) + 1,
            answers_json={},
            grading_json={},
            created_at=now_ts,
            updated_at=now_ts,
        )
        db_session.add(draft)
        db_session.flush()

    # Enforce attempt limits
    max_attempts: int | None = settings.get("max_attempts")
    if max_attempts:
        previous_count = db_session.exec(
            select(Submission).where(
                Submission.activity_id == activity_id,
                Submission.user_id == current_user.id,
                Submission.status.in_([SubmissionStatus.SUBMITTED, SubmissionStatus.GRADED]),
            )
        ).all()
        if len(previous_count) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Maximum attempts ({max_attempts}) reached",
            )

    # Server-side time-limit enforcement using the stored started_at
    now = datetime.now(UTC)
    started_at_raw: str | None = draft.answers_json.get("started_at")
    time_limit_seconds: int | None = settings.get("time_limit_seconds")
    if started_at_raw and time_limit_seconds:
        started_at = datetime.fromisoformat(started_at_raw)
        elapsed = (now - started_at).total_seconds()
        if elapsed > time_limit_seconds:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Time limit ({time_limit_seconds}s) exceeded",
            )

    # Violation enforcement
    violations_exceeded = False
    max_violations: int = settings.get("max_violations", 3)
    if settings.get("track_violations") and settings.get("block_on_violations"):
        if violation_count > max_violations:
            violations_exceeded = True

    # Grade the submission
    user_answers: list[dict] = answers_payload.get("answers", [])
    result = grade_submission(
        assessment_type=assessment_type,
        questions=questions or [],
        user_answers=user_answers,
        attempt_number=draft.attempt_number,
        max_score_penalty_per_attempt=settings.get("max_score_penalty_per_attempt"),
    )

    final_auto_score = 0.0 if violations_exceeded else result.auto_score

    # Determine due-date status
    new_status = SubmissionStatus.SUBMITTED
    if assessment_type == AssessmentType.QUIZ and not result.needs_manual_review:
        new_status = SubmissionStatus.GRADED

    # Persist the completed submission
    draft.answers_json = {**draft.answers_json, **answers_payload}
    draft.grading_json = result.breakdown.model_dump()
    draft.auto_score = final_auto_score
    draft.final_score = final_auto_score if not result.needs_manual_review else None
    draft.status = new_status
    draft.submitted_at = now
    draft.graded_at = now if new_status == SubmissionStatus.GRADED else None
    draft.updated_at = now

    db_session.add(draft)
    db_session.commit()
    db_session.refresh(draft)

    # Award XP if passed
    passed = (draft.auto_score or 0) >= 50.0
    if passed and not violations_exceeded:
        try:
            await award_xp(
                request=request,
                user_id=current_user.id,
                source=XPSource.QUIZ_COMPLETION,
                source_id=draft.submission_uuid,
                idempotency_key=f"submission_{draft.submission_uuid}",
                db_session=db_session,
            )
        except Exception as e:
            logger.warning("Failed to award XP for submission %s: %s", draft.submission_uuid, e)

    return SubmissionRead.model_validate(draft)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_activity_or_404(activity_id: int, db_session: Session) -> Activity:
    activity = db_session.exec(
        select(Activity).where(Activity.id == activity_id)
    ).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )
    return activity


def _require_permission(
    current_user: PublicUser,
    activity: Activity,
    permission: str,
    db_session: Session,
) -> None:
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        permission,
        resource_owner_id=activity.creator_id,
        is_assigned=True,
    )
