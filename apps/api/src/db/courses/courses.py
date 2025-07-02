from enum import Enum

from pydantic import ConfigDict, field_validator
from pydantic import Field as PydanticField
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field

from src.db.courses.chapters import ChapterRead
from src.db.resource_authors import ResourceAuthorshipEnum, ResourceAuthorshipStatusEnum
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel
from src.db.trails import TrailRead
from src.db.users import UserRead


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

    @field_validator("authorship", mode="before")
    @classmethod
    def validate_authorship(cls, v):
        if isinstance(v, str):
            return ResourceAuthorshipEnum(v)
        return v

    @field_validator("authorship_status", mode="before")
    @classmethod
    def validate_authorship_status(cls, v):
        if isinstance(v, str):
            return ResourceAuthorshipStatusEnum(v)
        return v


class CourseBase(SQLModelStrictBaseModel):
    name: str
    description: str | None = None
    about: str | None = None
    learnings: str | None = None
    tags: str | None = None
    thumbnail_type: ThumbnailType | None = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = Field(default="")
    thumbnail_video: str | None = Field(default="")
    public: bool
    open_to_contributors: bool = False

    @field_validator("thumbnail_type", mode="before")
    @classmethod
    def validate_thumbnail_type(cls, v):
        if isinstance(v, str):
            return ThumbnailType(v)
        return v


class Course(CourseBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class CourseCreate(CourseBase):
    thumbnail_type: ThumbnailType | None = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = Field(default="")
    thumbnail_video: str | None = Field(default="")

    @field_validator("thumbnail_type", mode="before")
    @classmethod
    def validate_thumbnail_type(cls, v):
        if isinstance(v, str):
            return ThumbnailType(v)
        return v


class CourseUpdate(CourseBase):
    name: str
    description: str | None = None
    about: str | None = None
    learnings: str | None = None
    tags: str | None = None
    thumbnail_type: ThumbnailType | None = Field(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = Field(default="")
    thumbnail_video: str | None = Field(default="")
    public: bool | None = None
    open_to_contributors: bool | None = None

    @field_validator("thumbnail_type", mode="before")
    @classmethod
    def validate_thumbnail_type(cls, v):
        if isinstance(v, str):
            return ThumbnailType(v)
        return v


class CourseRead(PydanticStrictBaseModel):
    id: int
    org_id: int = PydanticField(default=None)
    authors: list[AuthorWithRole] = PydanticField(default_factory=list)
    course_uuid: str
    creation_date: str
    update_date: str
    thumbnail_type: ThumbnailType | None = PydanticField(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = PydanticField(default="")
    thumbnail_video: str | None = PydanticField(default="")

    name: str
    description: str | None = None
    about: str | None = None
    learnings: str | None = None
    tags: str | None = None
    public: bool
    open_to_contributors: bool

    model_config = ConfigDict(from_attributes=True)

    @field_validator("thumbnail_type", mode="before")
    @classmethod
    def validate_thumbnail_type(cls, v):
        if isinstance(v, str):
            return ThumbnailType(v)
        return v


class FullCourseRead(PydanticStrictBaseModel):
    id: int
    org_id: int
    course_uuid: str | None = None
    creation_date: str | None = None
    update_date: str | None = None
    thumbnail_type: ThumbnailType | None = PydanticField(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = PydanticField(default="")
    thumbnail_video: str | None = PydanticField(default="")
    chapters: list[ChapterRead]
    authors: list[AuthorWithRole]

    name: str
    description: str | None = None
    about: str | None = None
    learnings: str | None = None
    tags: str | None = None
    public: bool
    open_to_contributors: bool

    model_config = ConfigDict(from_attributes=True)

    @field_validator("thumbnail_type", mode="before")
    @classmethod
    def validate_thumbnail_type(cls, v):
        if isinstance(v, str):
            return ThumbnailType(v)
        return v


class FullCourseReadWithTrail(PydanticStrictBaseModel):
    id: int
    course_uuid: str | None = None
    creation_date: str | None = None
    update_date: str | None = None
    org_id: int = PydanticField(default=None)
    authors: list[AuthorWithRole]
    chapters: list[ChapterRead]
    trail: TrailRead | None

    name: str
    description: str | None = None
    about: str | None = None
    learnings: str | None = None
    tags: str | None = None
    thumbnail_type: ThumbnailType | None = PydanticField(default=ThumbnailType.IMAGE)
    thumbnail_image: str | None = PydanticField(default="")
    thumbnail_video: str | None = PydanticField(default="")
    public: bool
    open_to_contributors: bool

    model_config = ConfigDict(from_attributes=True)

    @field_validator("thumbnail_type", mode="before")
    @classmethod
    def validate_thumbnail_type(cls, v):
        if isinstance(v, str):
            return ThumbnailType(v)
        return v
