"""
Typed Pydantic schemas for submission answer payloads.

Validates answers_json before storage to prevent schema drift between
the quiz editor and the grader.

Teacher grading input (TeacherGradeInput, ItemFeedback) lives in
submissions.py alongside the models it operates on.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from src.db.strict_base_model import PydanticStrictBaseModel


# ── Quiz ──────────────────────────────────────────────────────────────────────

class QuizAnswer(PydanticStrictBaseModel):
    """A student's answer to one quiz question."""

    question_id: str
    selected_option_ids: list[str] = Field(default_factory=list)
    text_answer: str | None = None       # For custom_answer type questions


class QuizAnswers(PydanticStrictBaseModel):
    """Complete quiz submission payload."""

    answers: list[QuizAnswer]
    started_at: datetime    # Server-stamped when student clicks "Start"
    submitted_at: datetime  # Server-stamped on receipt — NOT client-provided


# ── Assignment ────────────────────────────────────────────────────────────────

class AssignmentTaskAnswer(PydanticStrictBaseModel):
    """A student's response to one assignment task."""

    task_uuid: str
    content_type: Literal["file", "text", "form"]
    file_key: str | None = None     # Storage key for uploaded file
    text_content: str | None = None # For text answers
    form_data: dict[str, Any] | None = None  # For form-type tasks


class AssignmentAnswers(PydanticStrictBaseModel):
    """Complete assignment submission payload."""

    tasks: list[AssignmentTaskAnswer]
