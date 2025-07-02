from typing import List, Optional
from enum import Enum
from pydantic import Field as PydanticField, ConfigDict
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field

from src.db.users import UserRead
from src.db.trails import TrailRead
from src.db.courses.chapters import ChapterRead
from src.db.resource_authors import ResourceAuthorshipEnum, ResourceAuthorshipStatusEnum
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class ThumbnailType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    BOTH = "both"


class AuthorWithRole(SQLModelStrictBaseModel):
    user: UserRead
    authorship: ResourceAuthorshipEnum
    authorship_status: ResourceAuthorshipStatusEnum
    creation_date: str
    update_date: str


class CourseBase(SQLModelStrictBaseModel):
    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    thumbnail_type: Optional[ThumbnailType] = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = Field(default="")
    thumbnail_video: Optional[str] = Field(default="")
    public: bool
    open_to_contributors: bool


class Course(CourseBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class CourseCreate(CourseBase):
    org_id: int = Field(default=None, foreign_key="organization.id")
    thumbnail_type: Optional[ThumbnailType] = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = Field(default="")
    thumbnail_video: Optional[str] = Field(default="")


class CourseUpdate(CourseBase):
    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    thumbnail_type: Optional[ThumbnailType] = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = Field(default="")
    thumbnail_video: Optional[str] = Field(default="")
    public: Optional[bool] = None
    open_to_contributors: Optional[bool] = None


class CourseRead(PydanticStrictBaseModel):
    id: int
    org_id: int = PydanticField(default=None)
    authors: List[AuthorWithRole] = PydanticField(default_factory=list)
    course_uuid: str
    creation_date: str
    update_date: str
    thumbnail_type: Optional[ThumbnailType] = PydanticField(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = PydanticField(default="")
    thumbnail_video: Optional[str] = PydanticField(default="")

    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    public: bool
    open_to_contributors: bool

    model_config = ConfigDict(from_attributes=True)


class FullCourseRead(PydanticStrictBaseModel):
    id: int
    org_id: int
    course_uuid: Optional[str] = None
    creation_date: Optional[str] = None
    update_date: Optional[str] = None
    thumbnail_type: Optional[ThumbnailType] = PydanticField(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = PydanticField(default="")
    thumbnail_video: Optional[str] = PydanticField(default="")
    chapters: List[ChapterRead]
    authors: List[AuthorWithRole]

    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    public: bool
    open_to_contributors: bool

    model_config = ConfigDict(from_attributes=True)


class FullCourseReadWithTrail(PydanticStrictBaseModel):
    id: int
    course_uuid: Optional[str] = None
    creation_date: Optional[str] = None
    update_date: Optional[str] = None
    org_id: int = PydanticField(default=None)
    authors: List[AuthorWithRole]
    chapters: List[ChapterRead]
    trail: Optional[TrailRead]

    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    learnings: Optional[str] = None
    tags: Optional[str] = None
    thumbnail_type: Optional[ThumbnailType] = PydanticField(default=ThumbnailType.IMAGE)
    thumbnail_image: Optional[str] = PydanticField(default="")
    thumbnail_video: Optional[str] = PydanticField(default="")
    public: bool
    open_to_contributors: bool

    model_config = ConfigDict(from_attributes=True)
