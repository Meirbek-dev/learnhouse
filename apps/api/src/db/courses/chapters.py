from pydantic import BaseModel, ConfigDict
from sqlmodel import Column, Field, ForeignKey, Integer, SQLModel

from src.db.courses.activities import ActivityRead


class ChapterBase(SQLModel):
    name: str
    description: str | None = ""
    thumbnail_image: str | None = ""
    org_id: int = Field(
        sa_column=Column(
            "org_id", Integer, ForeignKey("organization.id", ondelete="CASCADE")
        )
    )
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


class ChapterCreate(ChapterBase):
    # referenced order here will be ignored and just used for validation
    # used order will be the next available.
    pass


class ChapterUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    thumbnail_image: str | None = None
    org_id: int | None = None
    course_id: int | None = None


class ChapterRead(ChapterBase):
    id: int
    activities: list[ActivityRead]
    chapter_uuid: str
    creation_date: str
    update_date: str
    model_config = ConfigDict(arbitrary_types_allowed=True)


class ActivityOrder(BaseModel):
    activity_id: int


class ChapterOrder(BaseModel):
    chapter_id: int
    activities_order_by_ids: list[ActivityOrder]


class ChapterUpdateOrder(BaseModel):
    chapter_order_by_ids: list[ChapterOrder]
