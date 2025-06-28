from enum import Enum
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, ConfigDict
from sqlalchemy import JSON, Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

if TYPE_CHECKING:
    from src.db.courses.activities import Activity


class TrailStepTypeEnum(str, Enum):
    STEP_TYPE_READABLE_ACTIVITY = "STEP_TYPE_READABLE_ACTIVITY"
    STEP_TYPE_ASSIGNMENT_ACTIVITY = "STEP_TYPE_ASSIGNMENT_ACTIVITY"
    STEP_TYPE_CUSTOM_ACTIVITY = "STEP_TYPE_CUSTOM_ACTIVITY"


class TrailStep(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    complete: bool
    teacher_verified: bool
    grade: str
    data: dict = Field(default={}, sa_column=Column(JSON))
    # foreign keys
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
    # timestamps
    creation_date: str
    update_date: str


class TrailStepRead(BaseModel):
    id: int | None = None
    complete: bool
    teacher_verified: bool
    grade: str
    data: dict = {}
    trailrun_id: int
    trail_id: int
    activity_id: int
    course_id: int
    org_id: int
    user_id: int
    creation_date: str
    update_date: str
    # Related activity object (not persisted to database)
    activity: Optional["Activity"] = None
    model_config = ConfigDict(arbitrary_types_allowed=True)


# note : prepare assignments support
# an assignment object will be linked to a trail step object in the future


def rebuild_trail_step_models() -> None:
    """Rebuild trail step models to resolve forward references"""
    from src.db.courses.activities import Activity  # noqa: F401

    TrailStepRead.model_rebuild()
