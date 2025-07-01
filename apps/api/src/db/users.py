from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from src.db.roles import RoleRead

if TYPE_CHECKING:
    from src.db.organizations import OrganizationRead


class UserBase(SQLModel):
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


class UserUpdate(SQLModel):
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    avatar_image: str | None = None
    bio: str | None = None
    details: dict | None = None
    profile: dict | None = None


class UserUpdatePassword(SQLModel):
    old_password: str
    new_password: str


class UserRead(UserBase):
    id: int
    user_uuid: str


class PublicUser(UserRead):
    pass


class UserRoleWithOrg(BaseModel):
    role: RoleRead
    org: "OrganizationRead"
    model_config = ConfigDict(arbitrary_types_allowed=True)


class UserSession(BaseModel):
    user: UserRead
    roles: list[UserRoleWithOrg]
    model_config = ConfigDict(arbitrary_types_allowed=True)


class AnonymousUser(SQLModel):
    id: int = 0
    user_uuid: str = "user_anonymous"
    username: str = "anonymous"
    email: str | None = "anonymous@example.com"


class InternalUser(SQLModel):
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
    from src.db.organizations import OrganizationRead  # noqa: F401

    UserRoleWithOrg.model_rebuild()
    UserSession.model_rebuild()
