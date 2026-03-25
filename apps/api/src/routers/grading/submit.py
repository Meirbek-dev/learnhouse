"""
Student-facing grading routes.

POST /grading/start/{activity_id}   — server-stamp the start time (replaces client timestamps)
POST /grading/submit/{activity_id}  — submit answers and receive grading result
GET  /grading/submissions/me        — student's own submissions for an activity
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from src.core.events.database import get_db_session
from src.db.courses.blocks import Block
from src.db.courses.quiz import QuizSettings
from src.db.grading.submissions import AssessmentType, SubmissionRead
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.grading.submit import start_submission, submit_assessment
from sqlmodel import Session, select

router = APIRouter()


@router.post("/start/{activity_id}", response_model=SubmissionRead)
async def api_start_submission(
    request: Request,
    activity_id: int,
    assessment_type: AssessmentType,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> SubmissionRead:
    """
    Create a DRAFT Submission and record the server-stamped start time.

    Must be called before submitting a quiz or exam so the server controls
    the start timestamp. Clients can no longer falsify the elapsed time.
    """
    return await start_submission(
        request=request,
        activity_id=activity_id,
        assessment_type=assessment_type,
        current_user=current_user,
        db_session=db_session,
    )


@router.post("/submit/{activity_id}", response_model=SubmissionRead)
async def api_submit_assessment(
    request: Request,
    activity_id: int,
    assessment_type: AssessmentType,
    answers_payload: dict,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    violation_count: int = Query(default=0, ge=0),
) -> SubmissionRead:
    """
    Submit an assessment attempt and receive auto-grading results.

    For quizzes: fetches questions and settings from the Block table.
    For exams:   the exam service continues to handle exam-specific flow.
    For assignments: creates a SUBMITTED record awaiting manual grading.
    """
    questions: list[dict] = []
    settings: dict = {}

    if assessment_type == AssessmentType.QUIZ:
        block = db_session.exec(
            select(Block)
            .where(Block.activity_id == activity_id)
            .order_by(Block.id.desc())
        ).first()
        if block:
            questions = block.content.get("questions", [])
            settings_data = block.content.get("settings", {})
            quiz_settings = QuizSettings(**settings_data) if settings_data else QuizSettings()
            settings = {
                "max_attempts": quiz_settings.max_attempts,
                "time_limit_seconds": quiz_settings.time_limit_seconds,
                "max_score_penalty_per_attempt": quiz_settings.max_score_penalty_per_attempt,
                "track_violations": quiz_settings.track_violations,
                "block_on_violations": quiz_settings.block_on_violations,
                "max_violations": quiz_settings.max_violations,
            }

    return await submit_assessment(
        request=request,
        activity_id=activity_id,
        assessment_type=assessment_type,
        answers_payload=answers_payload,
        current_user=current_user,
        db_session=db_session,
        violation_count=violation_count,
        questions=questions,
        settings=settings,
    )


@router.get("/submissions/me", response_model=list[SubmissionRead])
async def api_get_my_submissions(
    activity_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> list[SubmissionRead]:
    """Get the current user's submissions for an activity."""
    from src.db.grading.submissions import Submission

    submissions = db_session.exec(
        select(Submission).where(
            Submission.activity_id == activity_id,
            Submission.user_id == current_user.id,
        )
    ).all()
    return [SubmissionRead.model_validate(s) for s in submissions]
