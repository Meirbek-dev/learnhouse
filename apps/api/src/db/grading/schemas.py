"""
Typed Pydantic schemas for submission payloads.

These validate the answers_json and grading_json fields before they are stored
as JSON, preventing schema drift between the quiz editor and the grader.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import Field, field_validator

from src.db.strict_base_model import PydanticStrictBaseModel


# ── Quiz ────────────────────────────────────────────────────────────────────

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


# ── Assignment ───────────────────────────────────────────────────────────────

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


# ── Teacher grading input ────────────────────────────────────────────────────

class ItemFeedback(PydanticStrictBaseModel):
    """Optional per-item feedback from the teacher."""

    item_id: str
    score: float | None = None
    feedback: str = ""

    @field_validator("score", mode="before")
    @classmethod
    def validate_score(cls, v: object) -> object:
        if v is not None:
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"Score {val} is out of range (0–100)")
        return v


class TeacherGradeInput(PydanticStrictBaseModel):
    """
    Body for PATCH /grading/submissions/{submission_uuid}.

    Replaces the old parameterless POST .../grade which could not accept a score.
    """

    final_score: float = Field(
        ...,
        ge=0,
        le=100,
        description="Final score 0–100",
    )
    item_feedback: list[ItemFeedback] = Field(
        default_factory=list,
        description="Optional per-question/per-task comments",
    )
    status: Literal["GRADED", "RETURNED"] = "GRADED"
    feedback: str = ""
