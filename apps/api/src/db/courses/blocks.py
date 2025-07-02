from typing import Optional
from enum import Enum

from pydantic import ConfigDict
from sqlalchemy import JSON, Column, ForeignKey
from sqlmodel import Field
from src.db.strict_base_model import SQLModelStrictBaseModel


class BlockTypeEnum(str, Enum):
    BLOCK_QUIZ = "BLOCK_QUIZ"
    BLOCK_VIDEO = "BLOCK_VIDEO"
    BLOCK_DOCUMENT_PDF = "BLOCK_DOCUMENT_PDF"
    BLOCK_IMAGE = "BLOCK_IMAGE"
    BLOCK_CUSTOM = "BLOCK_CUSTOM"


class BlockBase(SQLModelStrictBaseModel):
    """Base model for Block with common fields."""

    model_config = ConfigDict(use_enum_values=True)

    block_type: BlockTypeEnum = BlockTypeEnum.BLOCK_CUSTOM
    content: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Block(BlockBase, table=True):
    """Database table model for Block."""

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column("org_id", ForeignKey("organization.id", ondelete="CASCADE"))
    )
    course_id: int = Field(
        sa_column=Column("course_id", ForeignKey("course.id", ondelete="CASCADE"))
    )
    chapter_id: Optional[int] = Field(
        default=None, sa_column=Column("chapter_id", ForeignKey("chapter.id", ondelete="CASCADE"))
    )
    activity_id: int = Field(
        sa_column=Column("activity_id", ForeignKey("activity.id", ondelete="CASCADE"))
    )
    block_uuid: str
    creation_date: str
    update_date: str


class BlockCreate(BlockBase):
    """Model for creating a new block."""

    pass


class BlockRead(BlockBase):
    """Model for reading a block with all related data."""

    id: int
    org_id: int
    course_id: int
    chapter_id: Optional[int]
    activity_id: int
    block_uuid: str
    creation_date: str
    update_date: str
