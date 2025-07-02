from enum import Enum

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field
from src.db.strict_base_model import SQLModelStrictBaseModel


class ResourceAuthorshipEnum(str, Enum):
    CREATOR = "CREATOR"
    CONTRIBUTOR = "CONTRIBUTOR"
    MAINTAINER = "MAINTAINER"
    REPORTER = "REPORTER"


class ResourceAuthorshipStatusEnum(str, Enum):
    ACTIVE = "ACTIVE"
    PENDING = "PENDING"
    INACTIVE = "INACTIVE"


class ResourceAuthor(SQLModelStrictBaseModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    resource_uuid: str
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    authorship: ResourceAuthorshipEnum
    authorship_status: ResourceAuthorshipStatusEnum
    creation_date: str = ""
    update_date: str = ""
