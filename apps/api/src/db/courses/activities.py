from enum import Enum

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column, ForeignKey, Integer
from sqlmodel import Field

from src.db.strict_base_model import SQLModelStrictBaseModel


class ActivityTypeEnum(str, Enum):
    TYPE_VIDEO = "TYPE_VIDEO"
    TYPE_DOCUMENT = "TYPE_DOCUMENT"
    TYPE_DYNAMIC = "TYPE_DYNAMIC"
    TYPE_ASSIGNMENT = "TYPE_ASSIGNMENT"
    TYPE_CUSTOM = "TYPE_CUSTOM"


class ActivitySubTypeEnum(str, Enum):
    # Dynamic
    SUBTYPE_DYNAMIC_PAGE = "SUBTYPE_DYNAMIC_PAGE"
    # Video
    SUBTYPE_VIDEO_YOUTUBE = "SUBTYPE_VIDEO_YOUTUBE"
    SUBTYPE_VIDEO_HOSTED = "SUBTYPE_VIDEO_HOSTED"
    # Document
    SUBTYPE_DOCUMENT_PDF = "SUBTYPE_DOCUMENT_PDF"
    SUBTYPE_DOCUMENT_DOC = "SUBTYPE_DOCUMENT_DOC"
    # Assignment
    SUBTYPE_ASSIGNMENT_ANY = "SUBTYPE_ASSIGNMENT_ANY"
    # Custom
    SUBTYPE_CUSTOM = "SUBTYPE_CUSTOM"


class ActivityBase(SQLModelStrictBaseModel):
    name: str
    activity_type: ActivityTypeEnum
    activity_sub_type: ActivitySubTypeEnum
    content: dict = Field(default_factory=dict, sa_column=Column(JSON))
    details: dict | None = Field(default=None, sa_column=Column(JSON))
    published: bool = False

    @field_validator("activity_type", mode="before")
    @classmethod
    def validate_activity_type(cls, v):
        if isinstance(v, str):
            return ActivityTypeEnum(v)
        return v

    @field_validator("activity_sub_type", mode="before")
    @classmethod
    def validate_activity_sub_type(cls, v):
        if isinstance(v, str):
            return ActivitySubTypeEnum(v)
        return v


class Activity(ActivityBase, table=True):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE")),
    )
    activity_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class ActivityCreate(ActivityBase):
    chapter_id: int
    activity_type: ActivityTypeEnum = ActivityTypeEnum.TYPE_CUSTOM
    activity_sub_type: ActivitySubTypeEnum = ActivitySubTypeEnum.SUBTYPE_CUSTOM
    details: dict = Field(default_factory=dict, sa_column=Column(JSON))


class ActivityUpdate(ActivityBase):
    name: str | None = None
    activity_type: ActivityTypeEnum | None = None
    activity_sub_type: ActivitySubTypeEnum | None = None
    content: dict | None = None
    details: dict | None = None
    published: bool | None = None
    published_version: int | None = None
    version: int | None = None


class ActivityRead(ActivityBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    org_id: int
    course_id: int | None
    activity_uuid: str
    creation_date: str
    update_date: str
