from datetime import UTC, datetime, timezone
from enum import Enum, StrEnum

from pydantic import ConfigDict, field_validator
from pydantic import Field as PydanticField
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, func
from sqlmodel import Field

from src.db.courses.chapters import ChapterRead, ChapterReadWithPermissions
from src.db.resource_authors import ResourceAuthorshipEnum, ResourceAuthorshipStatusEnum
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel
from src.db.trails import TrailRead
from src.db.users import UserRead


class ThumbnailType(StrEnum):
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
    creator_id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, ForeignKey("user.id", ondelete="SET NULL")),
    )
    course_uuid: str = ""
    creation_date: datetime = Field(
        default_factory=lambda: datetime.now(tz=UTC),
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    update_date: datetime = Field(
        default_factory=lambda: datetime.now(tz=UTC),
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
        ),
    )


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
    creation_date: datetime
    update_date: datetime
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
    chapters: list[ChapterReadWithPermissions]
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

    @field_validator("creation_date", "update_date", mode="before")
    @classmethod
    def validate_dates(cls, v):
        # Accept datetime values and coerce to ISO strings centrally
        from datetime import datetime

        if isinstance(v, datetime):
            return v.isoformat()
        return v


class FullCourseReadWithTrail(PydanticStrictBaseModel):
    id: int
    course_uuid: str | None = None
    creation_date: str | None = None
    update_date: str | None = None
    org_id: int = PydanticField(default=None)
    authors: list[AuthorWithRole]
    chapters: list[ChapterRead]
    trail: TrailRead | None = None

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

    @field_validator("creation_date", "update_date", mode="before")
    @classmethod
    def validate_dates(cls, v):
        # Accept datetime values and coerce to ISO strings centrally
        from datetime import datetime

        if isinstance(v, datetime):
            return v.isoformat()
        return v
