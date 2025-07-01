from typing import Optional, TYPE_CHECKING

from pydantic import BaseModel, ConfigDict
from sqlmodel import JSON, Column, Field, SQLModel

from src.db.organization_config import OrganizationConfig
from src.db.roles import RoleRead

if TYPE_CHECKING:
    from src.db.users import UserRead


class OrganizationBase(SQLModel):
    """Base model for Organization with common fields."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: Optional[str] = None
    about: Optional[str] = None
    socials: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    links: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    scripts: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    logo_image: Optional[str] = None
    thumbnail_image: Optional[str] = None
    previews: Optional[dict] = Field(default_factory=dict, sa_column=Column(JSON))
    explore: Optional[bool] = Field(default=False)
    label: Optional[str] = None
    slug: str
    email: str


class Organization(OrganizationBase, table=True):
    """Database table model for Organization."""

    id: Optional[int] = Field(default=None, primary_key=True)
    org_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class OrganizationWithConfig(BaseModel):
    """Organization model with associated configuration."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    org: Organization
    config: OrganizationConfig


class OrganizationUpdate(SQLModel):
    """Model for updating an organization."""

    name: Optional[str] = None
    description: Optional[str] = None
    about: Optional[str] = None
    socials: Optional[dict] = None
    links: Optional[dict] = None
    scripts: Optional[dict] = None
    logo_image: Optional[str] = None
    thumbnail_image: Optional[str] = None
    previews: Optional[dict] = None
    label: Optional[str] = None
    slug: Optional[str] = None
    email: Optional[str] = None
    explore: Optional[bool] = None
    update_date: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    """Model for creating a new organization."""

    pass


class OrganizationRead(OrganizationBase):
    """Model for reading an organization with all related data."""

    id: int
    org_uuid: str
    config: Optional[OrganizationConfig] = None
    creation_date: str
    update_date: str


class OrganizationUser(BaseModel):
    """Model representing a user's role within an organization."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    user: "UserRead"
    role: RoleRead


def rebuild_organization_models() -> None:
    """Rebuild organization models to resolve forward references."""
    from src.db.users import UserRead  # noqa: F401

    OrganizationUser.model_rebuild()
