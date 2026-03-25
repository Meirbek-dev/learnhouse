"""
Unified Submission model for all assessment types.

Replaces the fragmented 4-table assignment chain (Assignment → AssignmentTask →
AssignmentTaskSubmission → AssignmentUserSubmission) and the isolated QuizAttempt
model with a single, consistent row per student per assessment.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, String
from sqlmodel import Field

from src.db.strict_base_model import SQLModelStrictBaseModel


class SubmissionStatus(StrEnum):
    DRAFT = "DRAFT"          # student is working, not yet submitted
    SUBMITTED = "SUBMITTED"  # submitted, awaiting grading
    GRADED = "GRADED"        # teacher (or auto-grader) set final_score
    LATE = "LATE"            # submitted after the due_date
    RETURNED = "RETURNED"    # teacher sent it back for revision


class AssessmentType(StrEnum):
    QUIZ = "QUIZ"
    ASSIGNMENT = "ASSIGNMENT"
    EXAM = "EXAM"
    CODE_CHALLENGE = "CODE_CHALLENGE"


class GradedItem(SQLModelStrictBaseModel):
    """Per-question or per-task grading detail."""

    item_id: str
    item_text: str = ""
    score: float = 0.0
    max_score: float = 0.0
    correct: bool | None = None          # None for non-auto-gradeable items
    feedback: str = ""
    needs_manual_review: bool = False
    user_answer: Any = None
    correct_answer: Any = None


class GradingBreakdown(SQLModelStrictBaseModel):
    """Complete grading result for a submission."""

    items: list[GradedItem] = Field(default_factory=list)
    needs_manual_review: bool = False   # true if any open-text items present
    auto_graded: bool = False
    feedback: str = ""                  # Overall teacher feedback comment


class SubmissionBase(SQLModelStrictBaseModel):
    model_config = ConfigDict(use_enum_values=True)

    # What was submitted
    assessment_type: AssessmentType
    activity_id: int

    # Who submitted
    user_id: int

    # Scores — always 0–100 percentage
    auto_score: float | None = None    # set by auto-grader
    final_score: float | None = None   # teacher override (or auto_score copy)

    # Workflow
    status: SubmissionStatus = SubmissionStatus.DRAFT
    attempt_number: int = 1

    @field_validator("assessment_type", mode="before")
    @classmethod
    def validate_assessment_type(cls, v: object) -> object:
        if isinstance(v, str):
            return AssessmentType(v)
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: object) -> object:
        if isinstance(v, str):
            return SubmissionStatus(v)
        return v


class SubmissionCreate(SubmissionBase):
    """Input model for creating a new submission."""


class SubmissionUser(SQLModelStrictBaseModel):
    """Public user info embedded in teacher-view submissions."""

    id: int
    username: str
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    email: str
    avatar_image: str | None = None
    user_uuid: str | None = None


class SubmissionRead(SubmissionBase):
    """Output model for reading a submission."""

    id: int
    submission_uuid: str
    answers_json: dict = Field(default_factory=dict)
    grading_json: dict = Field(default_factory=dict)
    submitted_at: datetime | None = None
    graded_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    # Populated by the teacher list endpoint; None for student-facing endpoints
    user: SubmissionUser | None = None


class SubmissionUpdate(SQLModelStrictBaseModel):
    """Partial update model for a submission (teacher grading)."""

    model_config = ConfigDict(use_enum_values=True)

    final_score: float | None = None
    status: SubmissionStatus | None = None
    grading_json: dict | None = None
    graded_at: datetime | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: object) -> object:
        if v is not None and isinstance(v, str):
            return SubmissionStatus(v)
        return v


class Submission(SubmissionBase, table=True):
    """
    Single unified row per student per assessment attempt.

    Replaces:
    - AssignmentTaskSubmission (one per task)  → answers stored in answers_json
    - AssignmentUserSubmission (status tracker) → merged into status/final_score
    - QuizAttempt                               → one row per attempt
    """

    __tablename__ = "submission"
    __table_args__ = (
        Index("ix_submission_user_activity", "user_id", "activity_id"),
        Index("ix_submission_uuid", "submission_uuid", unique=True),
    )

    id: int | None = Field(default=None, primary_key=True)
    submission_uuid: str = Field(index=True)

    # Explicitly store enum fields as VARCHAR so SQLModel/SQLAlchemy never
    # auto-creates PostgreSQL ENUM types (submissionstatus, assessmenttype).
    # Python-level validation is handled by the field_validators on SubmissionBase.
    assessment_type: AssessmentType = Field(
        sa_column=Column("assessment_type", String, nullable=False),
    )
    status: SubmissionStatus = Field(
        default=SubmissionStatus.DRAFT,
        sa_column=Column("status", String, nullable=False, server_default="DRAFT"),
    )

    activity_id: int = Field(
        sa_column=Column("activity_id", ForeignKey("activity.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column("user_id", ForeignKey("user.id", ondelete="CASCADE"))
    )

    # Typed payload — validated by Pydantic schemas before saving
    answers_json: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )
    grading_json: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Timestamps
    submitted_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    graded_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True)),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True)),
    )
