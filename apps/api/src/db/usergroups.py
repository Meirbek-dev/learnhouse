from sqlalchemy import Column, ForeignKey, Integer, BigInteger
from sqlmodel import Field

from src.db.strict_base_model import SQLModelStrictBaseModel


class UserGroupBase(SQLModelStrictBaseModel):
    name: str
    description: str


class UserGroup(UserGroupBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    usergroup_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""
    creator_id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, ForeignKey("user.id", ondelete="SET NULL")),
    )


class UserGroupCreate(UserGroupBase):
    org_id: int = Field(default=None, foreign_key="organization.id")


class UserGroupUpdate(SQLModelStrictBaseModel):
    name: str | None = None
    description: str | None = None


class UserGroupRead(UserGroupBase):
    id: int
    org_id: int = Field(default=None, foreign_key="organization.id")
    usergroup_uuid: str
    creation_date: str
    update_date: str


class UserGroupReadWithPermissions(UserGroupRead):
    """UserGroup response with permission metadata."""

    # Permission flags
    can_update: bool | None = False
    can_delete: bool | None = False
    can_manage: bool | None = False
    is_owner: bool | None = False
    is_member: bool | None = False

    # Available actions array
    available_actions: list[str] | None = Field(default_factory=list)
