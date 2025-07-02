from enum import Enum
from typing import Dict, Optional

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column, ForeignKey
from sqlmodel import Field
from src.db.strict_base_model import SQLModelStrictBaseModel


## Assignment ##
class GradingTypeEnum(str, Enum):
    ALPHABET = "ALPHABET"
    NUMERIC = "NUMERIC"
    PERCENTAGE = "PERCENTAGE"


class AssignmentBase(SQLModelStrictBaseModel):
    """Represents the common fields for an assignment."""

    model_config = ConfigDict(use_enum_values=True)

    title: str
    description: str
    due_date: str
    published: Optional[bool] = False
    grading_type: GradingTypeEnum

    org_id: int
    course_id: int
    chapter_id: int
    activity_id: int

    @field_validator("grading_type", mode="before")
    @classmethod
    def validate_grading_type(cls, v):
        if isinstance(v, str):
            return GradingTypeEnum(v)
        return v


class AssignmentCreate(AssignmentBase):
    """Model for creating a new assignment."""

    # Inherits all fields from AssignmentBase
    pass


class AssignmentRead(AssignmentBase):
    """Model for reading an assignment."""

    id: int
    assignment_uuid: str
    creation_date: Optional[str] = None
    update_date: Optional[str] = None


class AssignmentUpdate(SQLModelStrictBaseModel):
    """Model for updating an assignment."""

    model_config = ConfigDict(use_enum_values=True)

    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    published: Optional[bool] = None
    grading_type: Optional[GradingTypeEnum] = None
    org_id: Optional[int] = None
    course_id: Optional[int] = None
    chapter_id: Optional[int] = None
    activity_id: Optional[int] = None
    update_date: Optional[str] = None

    @field_validator("grading_type", mode="before")
    @classmethod
    def validate_grading_type(cls, v):
        if v is not None and isinstance(v, str):
            return GradingTypeEnum(v)
        return v


class Assignment(AssignmentBase, table=True):
    """Represents an assignment with relevant details and foreign keys."""

    id: Optional[int] = Field(default=None, primary_key=True)
    creation_date: Optional[str] = None
    update_date: Optional[str] = None
    assignment_uuid: str

    org_id: int = Field(
        sa_column=Column("org_id", ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_id: int = Field(
        sa_column=Column("course_id", ForeignKey("course.id", ondelete="CASCADE"))
    )
    chapter_id: int = Field(
        sa_column=Column("chapter_id", ForeignKey("chapter.id", ondelete="CASCADE"))
    )
    activity_id: int = Field(
        sa_column=Column("activity_id", ForeignKey("activity.id", ondelete="CASCADE"))
    )


## Assignment ##

## AssignmentTask ##


class AssignmentTaskTypeEnum(str, Enum):
    FILE_SUBMISSION = "FILE_SUBMISSION"
    QUIZ = "QUIZ"
    FORM = "FORM"  # soon to be implemented
    OTHER = "OTHER"


class AssignmentTaskBase(SQLModelStrictBaseModel):
    """Represents the common fields for an assignment task."""

    model_config = ConfigDict(use_enum_values=True)

    title: str
    description: str
    hint: str
    reference_file: Optional[str] = None
    assignment_type: AssignmentTaskTypeEnum
    contents: Dict = Field(default_factory=dict, sa_column=Column(JSON))
    max_grade_value: int = 0  # Value is always between 0-100

    @field_validator("assignment_type", mode="before")
    @classmethod
    def validate_assignment_type(cls, v):
        if isinstance(v, str):
            return AssignmentTaskTypeEnum(v)
        return v


class AssignmentTaskCreate(AssignmentTaskBase):
    """Model for creating a new assignment task."""

    # Inherits all fields from AssignmentTaskBase
    pass


class AssignmentTaskRead(AssignmentTaskBase):
    """Model for reading an assignment task."""

    id: int
    assignment_task_uuid: str


class AssignmentTaskUpdate(SQLModelStrictBaseModel):
    """Model for updating an assignment task."""

    model_config = ConfigDict(use_enum_values=True)

    title: Optional[str] = None
    description: Optional[str] = None
    hint: Optional[str] = None
    reference_file: Optional[str] = None
    assignment_type: Optional[AssignmentTaskTypeEnum] = None
    contents: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
    max_grade_value: Optional[int] = None

    @field_validator("assignment_type", mode="before")
    @classmethod
    def validate_assignment_type(cls, v):
        if v is not None and isinstance(v, str):
            return AssignmentTaskTypeEnum(v)
        return v


class AssignmentTask(AssignmentTaskBase, table=True):
    """Represents a task within an assignment with various attributes and foreign keys."""

    id: Optional[int] = Field(default=None, primary_key=True)

    assignment_task_uuid: str
    creation_date: str
    update_date: str

    assignment_id: int = Field(
        sa_column=Column(
            "assignment_id", ForeignKey("assignment.id", ondelete="CASCADE")
        )
    )
    org_id: int = Field(
        sa_column=Column("org_id", ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_id: int = Field(
        sa_column=Column("course_id", ForeignKey("course.id", ondelete="CASCADE"))
    )
    chapter_id: int = Field(
        sa_column=Column("chapter_id", ForeignKey("chapter.id", ondelete="CASCADE"))
    )
    activity_id: int = Field(
        sa_column=Column("activity_id", ForeignKey("activity.id", ondelete="CASCADE"))
    )


## AssignmentTask ##


## AssignmentTaskSubmission ##


class AssignmentTaskSubmissionBase(SQLModelStrictBaseModel):
    """Represents the common fields for an assignment task submission."""

    model_config = ConfigDict(use_enum_values=True)

    assignment_task_submission_uuid: str
    task_submission: Dict = Field(default_factory=dict, sa_column=Column(JSON))
    grade: int = 0  # Value is always between 0-100
    task_submission_grade_feedback: str
    assignment_type: AssignmentTaskTypeEnum

    user_id: int
    activity_id: int
    course_id: int
    chapter_id: int
    assignment_task_id: int

    @field_validator("assignment_type", mode="before")
    @classmethod
    def validate_assignment_type(cls, v):
        if isinstance(v, str):
            return AssignmentTaskTypeEnum(v)
        return v


class AssignmentTaskSubmissionCreate(AssignmentTaskSubmissionBase):
    """Model for creating a new assignment task submission."""

    # Inherits all fields from AssignmentTaskSubmissionBase
    pass


class AssignmentTaskSubmissionRead(AssignmentTaskSubmissionBase):
    """Model for reading an assignment task submission."""

    id: int
    creation_date: str
    update_date: str


class AssignmentTaskSubmissionUpdate(SQLModelStrictBaseModel):
    """Model for updating an assignment task submission."""

    model_config = ConfigDict(use_enum_values=True)

    assignment_task_id: Optional[int] = None
    assignment_task_submission_uuid: Optional[str] = None
    task_submission: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
    grade: Optional[int] = None
    task_submission_grade_feedback: Optional[str] = None
    assignment_type: Optional[AssignmentTaskTypeEnum] = None

    @field_validator("assignment_type", mode="before")
    @classmethod
    def validate_assignment_type(cls, v):
        if v is not None and isinstance(v, str):
            return AssignmentTaskTypeEnum(v)
        return v


class AssignmentTaskSubmission(AssignmentTaskSubmissionBase, table=True):
    """Represents a submission for a specific assignment task with grade and feedback."""

    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_task_submission_uuid: str
    task_submission: Dict = Field(default_factory=dict, sa_column=Column(JSON))
    grade: int = 0  # Value is always between 0-100
    task_submission_grade_feedback: str
    assignment_type: AssignmentTaskTypeEnum

    user_id: int = Field(
        sa_column=Column("user_id", ForeignKey("user.id", ondelete="CASCADE"))
    )
    activity_id: int = Field(
        sa_column=Column("activity_id", ForeignKey("activity.id", ondelete="CASCADE"))
    )
    course_id: int = Field(
        sa_column=Column("course_id", ForeignKey("course.id", ondelete="CASCADE"))
    )
    chapter_id: int = Field(
        sa_column=Column("chapter_id", ForeignKey("chapter.id", ondelete="CASCADE"))
    )
    assignment_task_id: int = Field(
        sa_column=Column(
            "assignment_task_id", ForeignKey("assignmenttask.id", ondelete="CASCADE")
        )
    )

    creation_date: str
    update_date: str


## AssignmentTaskSubmission ##

## AssignmentUserSubmission ##


class AssignmentUserSubmissionStatus(str, Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    GRADED = "GRADED"
    LATE = "LATE"
    NOT_SUBMITTED = "NOT_SUBMITTED"


class AssignmentUserSubmissionBase(SQLModelStrictBaseModel):
    """Represents the submission status of an assignment for a user."""

    model_config = ConfigDict(use_enum_values=True)

    submission_status: AssignmentUserSubmissionStatus = (
        AssignmentUserSubmissionStatus.SUBMITTED
    )
    grade: int
    user_id: int = Field(
        sa_column=Column("user_id", ForeignKey("user.id", ondelete="CASCADE"))
    )
    assignment_id: int = Field(
        sa_column=Column(
            "assignment_id", ForeignKey("assignment.id", ondelete="CASCADE")
        )
    )


class AssignmentUserSubmissionCreate(SQLModelStrictBaseModel):
    """Model for creating a new assignment user submission."""

    model_config = ConfigDict(use_enum_values=True)

    assignment_id: int
    # Note: Other fields will be inherited or set with defaults


class AssignmentUserSubmissionRead(AssignmentUserSubmissionBase):
    """Model for reading an assignment user submission."""

    id: int
    creation_date: str
    update_date: str


class AssignmentUserSubmissionUpdate(SQLModelStrictBaseModel):
    """Model for updating an assignment user submission."""

    model_config = ConfigDict(use_enum_values=True)

    submission_status: Optional[AssignmentUserSubmissionStatus] = None
    grade: Optional[str] = None  # TODO: Should be string or int?
    user_id: Optional[int] = None
    assignment_id: Optional[int] = None


class AssignmentUserSubmission(AssignmentUserSubmissionBase, table=True):
    """Represents the submission status of an assignment for a user."""

    id: Optional[int] = Field(default=None, primary_key=True)
    creation_date: str
    update_date: str
    assignmentusersubmission_uuid: str

    submission_status: AssignmentUserSubmissionStatus = (
        AssignmentUserSubmissionStatus.SUBMITTED
    )
    grade: int
    user_id: int = Field(
        sa_column=Column("user_id", ForeignKey("user.id", ondelete="CASCADE"))
    )
    assignment_id: int = Field(
        sa_column=Column(
            "assignment_id", ForeignKey("assignment.id", ondelete="CASCADE")
        )
    )
