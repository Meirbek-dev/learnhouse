"""
Submission orchestrator — single entry point per lifecycle action.
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

# B6: per-type submit permission map
_SUBMIT_PERMISSION: dict[AssessmentType, str] = {
    AssessmentType.QUIZ: "quiz:submit",
    AssessmentType.EXAM: "exam:submit",
    AssessmentType.ASSIGNMENT: "assignment:submit",
    AssessmentType.CODE_CHALLENGE: "assignment:submit",
}

# B8: per-type XP source map
_XP_SOURCE: dict[AssessmentType, XPSource] = {
    AssessmentType.QUIZ: XPSource.QUIZ_COMPLETION,
    AssessmentType.EXAM: XPSource.EXAM_COMPLETION,
    AssessmentType.ASSIGNMENT: XPSource.ASSIGNMENT_SUBMISSION,
    AssessmentType.CODE_CHALLENGE: XPSource.CODE_CHALLENGE_COMPLETION,
}


async def start_submission(
    request: Request,
    activity_id: int,
    assessment_type: AssessmentType,
    current_user: PublicUser,
    db_session: Session,
) -> SubmissionRead:
    """
    Create a DRAFT Submission and record the server-stamped start time.

    The started_at timestamp is set here on the server so clients cannot
    falsify it (B2 fix: moved out of mutable answers_json).
    """
    activity = _get_activity_or_404(activity_id, db_session)
    _require_permission(current_user, activity, assessment_type, db_session)

    # Return existing DRAFT if present (idempotent)
    existing_draft = db_session.exec(
        select(Submission).where(
            Submission.activity_id == activity_id,
            Submission.user_id == current_user.id,
            Submission.status == SubmissionStatus.DRAFT,
        )
    ).first()

    if existing_draft:
        return SubmissionRead.model_validate(existing_draft)

    # B7 fix: count all non-DRAFT statuses (including RETURNED) as previous attempts
    previous_count = db_session.exec(
        select(Submission).where(
            Submission.activity_id == activity_id,
            Submission.user_id == current_user.id,
            Submission.status != SubmissionStatus.DRAFT,
        )
    ).all()
    attempt_number = len(previous_count) + 1

    now = datetime.now(UTC)
    submission = Submission(
        submission_uuid=f"submission_{ULID()}",
        assessment_type=assessment_type,
        activity_id=activity_id,
        user_id=current_user.id,
        status=SubmissionStatus.DRAFT,
        attempt_number=attempt_number,
        answers_json={},
        grading_json={},
        started_at=now,  # B2 fix: dedicated column, not answers_json
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
    violation_count: int = 0,
    questions: list[dict] | None = None,
    settings: dict | None = None,
) -> SubmissionRead:
    """
    Submit an assessment attempt and auto-grade where possible.
    """
    activity = _get_activity_or_404(activity_id, db_session)
    _require_permission(current_user, activity, assessment_type, db_session)

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
        # Assignments have no timed start — auto-create the draft inline
        # B7 fix: count RETURNED as previous attempts
        previous_count = db_session.exec(
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
            attempt_number=len(previous_count) + 1,
            answers_json={},
            grading_json={},
            started_at=now_ts,
            created_at=now_ts,
            updated_at=now_ts,
        )
        db_session.add(draft)
        db_session.flush()

    # Enforce attempt limits
    max_attempts: int | None = settings.get("max_attempts")
    if max_attempts:
        completed = db_session.exec(
            select(Submission).where(
                Submission.activity_id == activity_id,
                Submission.user_id == current_user.id,
                Submission.status.in_(
                    [
                        SubmissionStatus.SUBMITTED,
                        SubmissionStatus.GRADED,
                        SubmissionStatus.LATE,
                    ]
                ),
            )
        ).all()
        if len(completed) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Maximum attempts ({max_attempts}) reached",
            )

    # B2 fix: time-limit enforcement using dedicated started_at column
    now = datetime.now(UTC)
    time_limit_seconds: int | None = settings.get("time_limit_seconds")
    if draft.started_at and time_limit_seconds:
        started_at = draft.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=UTC)
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

    # Grade the submission — dispatch correct payload per assessment type
    user_answers: list[dict] = answers_payload.get("answers", [])

    # Exam: submitted_answers is a dict[question_id -> answer_dict]
    exam_answers: dict[int, dict] | None = None
    if assessment_type == AssessmentType.EXAM:
        raw_exam = answers_payload.get("submitted_answers", {})
        if isinstance(raw_exam, dict):
            exam_answers = {int(k): v for k, v in raw_exam.items() if str(k).isdigit()}

    # Code challenge: test_results from the code runner
    test_results: list[dict] | None = None
    code_strategy: str = "BEST_SUBMISSION"
    if assessment_type == AssessmentType.CODE_CHALLENGE:
        test_results = answers_payload.get("test_results", [])
        code_strategy = answers_payload.get("code_strategy", "BEST_SUBMISSION")

    result = grade_submission(
        assessment_type=assessment_type,
        questions=questions or [],
        user_answers=user_answers,
        exam_answers=exam_answers,
        test_results=test_results,
        code_strategy=code_strategy,
        attempt_number=draft.attempt_number,
        max_score_penalty_per_attempt=settings.get("max_score_penalty_per_attempt"),
    )

    final_auto_score = 0.0 if violations_exceeded else result.auto_score

    # B3 fix: detect LATE submissions using due_date_iso from settings
    due_date_iso: str | None = settings.get("due_date_iso")
    is_late = False
    if due_date_iso:
        try:
            due_date = datetime.fromisoformat(due_date_iso)
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=UTC)
            is_late = now > due_date
        except ValueError:
            pass

    # Determine submission status
    if is_late:
        new_status = SubmissionStatus.LATE
    elif assessment_type == AssessmentType.QUIZ and not result.needs_manual_review:
        new_status = SubmissionStatus.GRADED
    else:
        new_status = SubmissionStatus.SUBMITTED

    # Persist the completed submission
    draft.answers_json = answers_payload
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

    # Award XP if passed (B8 fix: use correct XP source per assessment type)
    passed = (draft.auto_score or 0) >= 50.0
    if passed and not violations_exceeded and new_status != SubmissionStatus.LATE:
        xp_source = _XP_SOURCE.get(assessment_type, XPSource.QUIZ_COMPLETION)
        try:
            await award_xp(
                request=request,
                user_id=current_user.id,
                source=xp_source,
                source_id=draft.submission_uuid,
                idempotency_key=f"submission_{draft.submission_uuid}",
                db_session=db_session,
            )
        except Exception as e:
            logger.warning(
                "Failed to award XP for submission %s: %s", draft.submission_uuid, e
            )

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
    assessment_type: AssessmentType,
    db_session: Session,
) -> None:
    # B6 fix: use per-type permission; fall back gracefully
    permission = _SUBMIT_PERMISSION.get(assessment_type, "quiz:submit")
    checker = PermissionChecker(db_session)
    checker.require(
        current_user.id,
        permission,
        resource_owner_id=activity.creator_id,
        is_assigned=True,
    )
