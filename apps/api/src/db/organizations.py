from typing import TYPE_CHECKING

from pydantic import ConfigDict
from sqlmodel import JSON, Column, Field

from src.db.organization_config import OrganizationConfig
from src.db.roles import RoleRead
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel

if TYPE_CHECKING:
    from src.db.users import UserRead


class OrganizationBase(SQLModelStrictBaseModel):
    """Base model for Organization with common fields."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: str | None = None
    about: str | None = None
    socials: dict | None = Field(default_factory=dict, sa_column=Column(JSON))
    links: dict | None = Field(default_factory=dict, sa_column=Column(JSON))
    scripts: dict | None = Field(default_factory=dict, sa_column=Column(JSON))
    logo_image: str | None = None
    thumbnail_image: str | None = None
    previews: dict | None = Field(default_factory=dict, sa_column=Column(JSON))
    explore: bool | None = Field(default=False)
    label: str | None = None
    slug: str
    email: str


class Organization(OrganizationBase, table=True):
    """Database table model for Organization."""

    id: int | None = Field(default=None, primary_key=True)
    org_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class OrganizationWithConfig(PydanticStrictBaseModel):
    """Organization model with associated configuration."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    org: Organization
    config: OrganizationConfig


class OrganizationUpdate(SQLModelStrictBaseModel):
    """Model for updating an organization."""

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
    update_date: str | None = None


class OrganizationCreate(OrganizationBase):
    """Model for creating a new organization."""


class OrganizationRead(OrganizationBase):
    """Model for reading an organization with all related data."""

    id: int
    org_uuid: str
    config: OrganizationConfig | None = None
    creation_date: str
    update_date: str


class OrganizationUser(PydanticStrictBaseModel):
    """Model representing a user's role within an organization."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    user: "UserRead"
    role: RoleRead


def rebuild_organization_models() -> None:
    """Rebuild organization models to resolve forward references."""
    from src.db.users import UserRead

    OrganizationUser.model_rebuild()
