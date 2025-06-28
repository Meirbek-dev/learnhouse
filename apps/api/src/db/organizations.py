from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict
from sqlmodel import JSON, Column, Field, SQLModel

from src.db.organization_config import OrganizationConfig
from src.db.roles import RoleRead

if TYPE_CHECKING:
    from src.db.users import UserRead


class OrganizationBase(SQLModel):
    name: str
    description: str | None
    about: str | None
    socials: dict | None = Field(default={}, sa_column=Column(JSON))
    links: dict | None = Field(default={}, sa_column=Column(JSON))
    scripts: dict | None = Field(default={}, sa_column=Column(JSON))
    logo_image: str | None
    thumbnail_image: str | None
    previews: dict | None = Field(default={}, sa_column=Column(JSON))
    explore: bool | None = Field(default=False)
    label: str | None
    slug: str
    email: str


class Organization(OrganizationBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class OrganizationWithConfig(BaseModel):
    org: Organization
    config: OrganizationConfig
    model_config = ConfigDict(arbitrary_types_allowed=True)


class OrganizationUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    about: str | None = None
    socials: dict | None = None
    links: dict | None = None
    scripts: dict | None = None
    logo_image: str | None = None
    thumbnail_image: str | None = None
    previews: dict | None = None
    label: str | None = None
    slug: str | None = None
    email: str | None = None
    explore: bool | None = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationRead(OrganizationBase):
    id: int
    org_uuid: str
    config: OrganizationConfig | dict | None = None
    creation_date: str
    update_date: str


class OrganizationUser(BaseModel):
    user: "UserRead"
    role: RoleRead
    model_config = ConfigDict(arbitrary_types_allowed=True)


def rebuild_organization_models() -> None:
    """Rebuild organization models to resolve forward references"""
    from src.db.users import (
        UserRead,  # noqa: F401 - needed for forward reference resolution
    )

    OrganizationUser.model_rebuild()
