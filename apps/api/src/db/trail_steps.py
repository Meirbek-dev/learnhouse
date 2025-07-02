from enum import Enum
from typing import Any

from pydantic import Field as PydanticField
from sqlalchemy import JSON, Column, ForeignKey, Integer
from sqlmodel import Field

from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class TrailStepTypeEnum(str, Enum):
    STEP_TYPE_READABLE_ACTIVITY = "STEP_TYPE_READABLE_ACTIVITY"
    STEP_TYPE_ASSIGNMENT_ACTIVITY = "STEP_TYPE_ASSIGNMENT_ACTIVITY"
    STEP_TYPE_CUSTOM_ACTIVITY = "STEP_TYPE_CUSTOM_ACTIVITY"


class TrailStep(SQLModelStrictBaseModel, table=True):
    """
    TrailStep database model representing a step in a learning trail.

    This model tracks completion status, verification, grading, and metadata
    for individual steps within a learning trail.
    """

    id: int | None = Field(default=None, primary_key=True)
    complete: bool = Field()
    teacher_verified: bool = Field()
    grade: str = Field()
    data: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Foreign key relationships
    trailrun_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trailrun.id", ondelete="CASCADE"))
    )
    trail_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trail.id", ondelete="CASCADE"))
    )
    activity_id: int = Field(
        sa_column=Column(Integer, ForeignKey("activity.id", ondelete="CASCADE"))
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )

    # Timestamps
    creation_date: str = Field()
    update_date: str = Field()


class TrailStepRead(PydanticStrictBaseModel):
    id: int | None = PydanticField(default=None)
    complete: bool
    teacher_verified: bool
    grade: str
    data: dict[str, Any] = PydanticField(default_factory=dict)
    trailrun_id: int
    trail_id: int
    activity_id: int
    course_id: int
    org_id: int
    user_id: int
    creation_date: str | None = None
    update_date: str | None = None
    activity: dict[str, Any] | None = None


# note : prepare assignments support
# An assignment object will be linked to a trail step object in the future
