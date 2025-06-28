from enum import Enum

from pydantic import BaseModel, ConfigDict
from sqlalchemy import JSON, Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from src.db.trail_steps import TrailStepRead


class TrailRunEnum(str, Enum):
    RUN_TYPE_COURSE = "RUN_TYPE_COURSE"


class StatusEnum(str, Enum):
    STATUS_IN_PROGRESS = "STATUS_IN_PROGRESS"
    STATUS_COMPLETED = "STATUS_COMPLETED"
    STATUS_PAUSED = "STATUS_PAUSED"
    STATUS_CANCELLED = "STATUS_CANCELLED"


class TrailRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    data: dict = Field(default={}, sa_column=Column(JSON))
    status: StatusEnum = StatusEnum.STATUS_IN_PROGRESS
    # foreign keys
    trail_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trail.id", ondelete="CASCADE"))
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


class TrailRunCreate(SQLModel):
    data: dict = Field(default={})
    status: StatusEnum = StatusEnum.STATUS_IN_PROGRESS
    # foreign keys
    trail_id: int
    course_id: int
    org_id: int
    user_id: int


# trick because Lists are not supported in SQLModel (runs: list[TrailStep] )
class TrailRunRead(BaseModel):
    id: int | None = Field(default=None, primary_key=True)
    data: dict = Field(default={}, sa_column=Column(JSON))
    status: StatusEnum = StatusEnum.STATUS_IN_PROGRESS
    # foreign keys
    trail_id: int = Field(default=None, foreign_key="trail.id")
    course_id: int = Field(default=None, foreign_key="course.id")
    org_id: int = Field(default=None, foreign_key="organization.id")
    user_id: int = Field(default=None, foreign_key="user.id")
    # course object
    course: dict | None = None
    # timestamps
    creation_date: str | None = None
    update_date: str | None = None

    # number of activities in course
    course_total_steps: int
    steps: list[TrailStepRead]
    model_config = ConfigDict(arbitrary_types_allowed=True)


def rebuild_trail_run_models() -> None:
    """Rebuild trail run models to resolve forward references"""
    from src.db.trail_steps import rebuild_trail_step_models

    rebuild_trail_step_models()
    TrailRunRead.model_rebuild()
