from enum import Enum

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from src.db.courses.chapters import ChapterRead
from src.db.resource_authors import ResourceAuthorshipEnum, ResourceAuthorshipStatusEnum
from src.db.trails import TrailRead
from src.db.users import UserRead


class ThumbnailType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    BOTH = "both"


class AuthorWithRole(SQLModel):
    user: UserRead
    authorship: ResourceAuthorshipEnum
    authorship_status: ResourceAuthorshipStatusEnum
    creation_date: str
    update_date: str


class CourseBase(SQLModel):
    name: str
    description: str | None
    about: str | None
    learnings: str | None
    tags: str | None
    thumbnail_type: ThumbnailType | None = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = Field(default="")
    thumbnail_video: str | None = Field(default="")
    public: bool
    open_to_contributors: bool


class Course(CourseBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class CourseCreate(CourseBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    thumbnail_type: ThumbnailType | None = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = Field(default="")
    thumbnail_video: str | None = Field(default="")


class CourseUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    about: str | None = None
    learnings: str | None = None
    tags: str | None = None
    thumbnail_type: ThumbnailType | None = None
    thumbnail_image: str | None = None
    thumbnail_video: str | None = None
    public: bool | None = None
    open_to_contributors: bool | None = None


class CourseRead(CourseBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    authors: list[AuthorWithRole] = []
    course_uuid: str
    creation_date: str
    update_date: str
    thumbnail_type: ThumbnailType | None = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = Field(default="")
    thumbnail_video: str | None = Field(default="")


class FullCourseRead(CourseBase):
    id: int
    org_id: int
    course_uuid: str | None
    creation_date: str | None
    update_date: str | None
    thumbnail_type: ThumbnailType | None = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = Field(default="")
    thumbnail_video: str | None = Field(default="")
    # Chapters, Activities
    chapters: list[ChapterRead]
    authors: list[AuthorWithRole]


class FullCourseReadWithTrail(CourseBase):
    id: int
    course_uuid: str | None
    creation_date: str | None
    update_date: str | None
    org_id: int = Field(default=None, foreign_key="organization.id")
    authors: list[AuthorWithRole]
    # Chapters, Activities
    chapters: list[ChapterRead]
    # Trail
    trail: TrailRead | None
