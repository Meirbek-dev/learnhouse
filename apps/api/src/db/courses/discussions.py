from enum import Enum

from pydantic import field_validator
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field

from src.db.strict_base_model import SQLModelStrictBaseModel
from src.db.users import UserRead


class DiscussionType(str, Enum):
    POST = "post"
    REPLY = "reply"


class DiscussionStatusEnum(str, Enum):
    ACTIVE = "active"
    HIDDEN = "hidden"
    DELETED = "deleted"


class CourseDiscussion(SQLModelStrictBaseModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    discussion_uuid: str = Field(default="")
    content: str
    type: DiscussionType = Field(default=DiscussionType.POST)
    status: DiscussionStatusEnum = Field(default=DiscussionStatusEnum.ACTIVE)
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    parent_discussion_id: int | None = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("coursediscussion.id", ondelete="CASCADE")
        ),
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    likes_count: int = Field(default=0)
    dislikes_count: int = Field(default=0)
    replies_count: int = Field(default=0)
    creation_date: str = Field(default="")
    update_date: str = Field(default="")

    @field_validator("type", mode="before")
    @classmethod
    def validate_type(cls, v):
        if isinstance(v, str):
            return DiscussionType(v)
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v):
        if isinstance(v, str):
            return DiscussionStatusEnum(v)
        return v


class CourseDiscussionCreate(SQLModelStrictBaseModel):
    content: str
    type: DiscussionType = DiscussionType.POST
    parent_discussion_id: int | None = None
    org_id: int

    @field_validator("type", mode="before")
    @classmethod
    def validate_type(cls, v):
        if isinstance(v, str):
            try:
                return DiscussionType(v)
            except ValueError:
                return DiscussionType.POST
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if not v:
            msg = "Content cannot be empty"
            raise ValueError(msg)

        # Strip HTML tags to check if there's actual text content
        import re

        clean_text = re.sub(r"<[^>]+>", "", str(v)).strip()
        if not clean_text:
            msg = "Content cannot be empty"
            raise ValueError(msg)

        return v

    @field_validator("org_id")
    @classmethod
    def validate_org_id(cls, v):
        if v is None or v <= 0:
            msg = "Valid organization ID is required"
            raise ValueError(msg)
        return v


class CourseDiscussionRead(SQLModelStrictBaseModel):
    id: int
    discussion_uuid: str
    content: str
    type: DiscussionType
    status: DiscussionStatusEnum
    course_id: int
    user_id: int
    parent_discussion_id: int | None
    org_id: int
    likes_count: int
    dislikes_count: int
    replies_count: int
    creation_date: str
    update_date: str
    user: UserRead | None = None
    # ruff: noqa: UP037
    replies: list["CourseDiscussionRead"] | None = None
    is_liked: bool = False
    is_disliked: bool = False

    @field_validator("type", mode="before")
    @classmethod
    def validate_type(cls, v):
        if isinstance(v, str):
            return DiscussionType(v)
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v):
        if isinstance(v, str):
            return DiscussionStatusEnum(v)
        return v


class CourseDiscussionUpdate(SQLModelStrictBaseModel):
    content: str | None = None
    status: DiscussionStatusEnum | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v):
        if v is not None and isinstance(v, str):
            return DiscussionStatusEnum(v)
        return v


class DiscussionLike(SQLModelStrictBaseModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    discussion_id: int = Field(
        sa_column=Column(Integer, ForeignKey("coursediscussion.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    creation_date: str = Field(default="")


class DiscussionLikeCreate(SQLModelStrictBaseModel):
    discussion_id: int


class DiscussionLikeRead(SQLModelStrictBaseModel):
    id: int
    discussion_id: int
    user_id: int
    creation_date: str


class DiscussionDislike(SQLModelStrictBaseModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    discussion_id: int = Field(
        sa_column=Column(Integer, ForeignKey("coursediscussion.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    creation_date: str = Field(default="")


class DiscussionDislikeCreate(SQLModelStrictBaseModel):
    discussion_id: int


class DiscussionDislikeRead(SQLModelStrictBaseModel):
    id: int
    discussion_id: int
    user_id: int
    creation_date: str
