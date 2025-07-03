from typing import TYPE_CHECKING

from pydantic import ConfigDict, EmailStr
from sqlalchemy import JSON, Column
from sqlmodel import Field

from src.db.roles import RoleRead
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel

if TYPE_CHECKING:
    from src.db.organizations import OrganizationRead


class UserBase(SQLModelStrictBaseModel):
    username: str
    first_name: str
    last_name: str
    email: EmailStr
    avatar_image: str | None = ""
    bio: str | None = ""
    details: dict | None = Field(default_factory=dict, sa_column=Column(JSON))
    profile: dict | None = Field(default_factory=dict, sa_column=Column(JSON))


class UserCreate(UserBase):
    first_name: str = ""
    last_name: str = ""
    password: str


class UserUpdate(SQLModelStrictBaseModel):
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    avatar_image: str | None = None
    bio: str | None = None
    details: dict | None = None
    profile: dict | None = None


class UserUpdatePassword(SQLModelStrictBaseModel):
    old_password: str
    new_password: str


class UserRead(UserBase):
    id: int
    user_uuid: str


class PublicUser(UserRead):
    pass


class UserRoleWithOrg(PydanticStrictBaseModel):
    role: RoleRead
    org: "OrganizationRead"  # noqa: UP037
    model_config = ConfigDict(arbitrary_types_allowed=True)


class UserSession(PydanticStrictBaseModel):
    user: UserRead
    roles: list[UserRoleWithOrg]
    model_config = ConfigDict(arbitrary_types_allowed=True)


class AnonymousUser(SQLModelStrictBaseModel):
    id: int = 0
    user_uuid: str = "user_anonymous"
    username: str = "anonymous"
    email: str | None = "anonymous@example.com"


class InternalUser(SQLModelStrictBaseModel):
    id: int = 0
    user_uuid: str = "user_internal"
    username: str = "internal"


class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    password: str = ""
    user_uuid: str = ""
    email_verified: bool = False
    creation_date: str = ""
    update_date: str = ""


def rebuild_user_models() -> None:
    """Rebuild user models to resolve forward references"""
    from src.db.organizations import OrganizationRead

    UserRoleWithOrg.model_rebuild()
    UserSession.model_rebuild()
