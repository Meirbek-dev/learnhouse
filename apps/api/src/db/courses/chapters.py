from datetime import datetime

from pydantic import ConfigDict, field_validator
from sqlmodel import Column, Field, ForeignKey, Integer

from src.db.courses.activities import ActivityRead, ActivityReadWithPermissions
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class ChapterBase(SQLModelStrictBaseModel):
    name: str
    description: str | None = ""
    thumbnail_image: str | None = ""
    course_id: int = Field(
        sa_column=Column(
            "course_id", Integer, ForeignKey("course.id", ondelete="CASCADE")
        )
    )


class Chapter(ChapterBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    chapter_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""
    order: int = Field(default=0)
    creator_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(SQLModelStrictBaseModel):
    name: str | None = None
    description: str | None = None
    thumbnail_image: str | None = None
    course_id: int | None = None


class ChapterRead(ChapterBase):
    id: int
    activities: list[ActivityRead]
    chapter_uuid: str
    creation_date: str
    update_date: str
    order: int = 0
    model_config = ConfigDict(arbitrary_types_allowed=True)


class ChapterReadWithPermissions(ChapterBase):
    """ChapterRead that includes per-activity permission metadata."""

    id: int
    activities: list[ActivityReadWithPermissions]
    chapter_uuid: str
    creation_date: str
    update_date: str
    order: int = 0
    model_config = ConfigDict(arbitrary_types_allowed=True)


class ChapterOrderPayload(PydanticStrictBaseModel):
    """Single-item order update: move this chapter to position N."""
    position: int


class ActivityOrderPayload(PydanticStrictBaseModel):
    """Move an activity to position N, optionally into a different chapter."""
    position: int
    chapter_uuid: str | None = None


# Kept for backward compat with any external callers; new code uses PATCH /{uuid}/order
class ChapterOrderByUuid(PydanticStrictBaseModel):
    chapter_uuid: str
    activities_order_by_uuids: list[str]


class ChapterUpdateOrder(PydanticStrictBaseModel):
    chapter_order_by_uuids: list[ChapterOrderByUuid]
