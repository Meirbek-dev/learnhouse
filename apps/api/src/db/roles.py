from enum import Enum

from pydantic import field_validator
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field

from src.db.strict_base_model import SQLModelStrictBaseModel


# Database Models


class RoleTypeEnum(str, Enum):
    TYPE_ORGANIZATION = "TYPE_ORGANIZATION"  # Organization roles are associated with an organization, they are used to define the rights of a user in an organization
    TYPE_ORGANIZATION_API_TOKEN = "TYPE_ORGANIZATION_API_TOKEN"  # Organization API Token roles are associated with an organization, they are used to define the rights of an API Token in an organization
    TYPE_GLOBAL = "TYPE_GLOBAL"  # Global roles are not associated with an organization, they are used to define the default rights of a user


class RoleBase(SQLModelStrictBaseModel):
    name: str
    description: str | None


class Role(RoleBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")),
    )
    role_type: RoleTypeEnum = RoleTypeEnum.TYPE_GLOBAL
    role_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""

    @field_validator("role_type", mode="before")
    @classmethod
    def validate_role_type(cls, v):
        if isinstance(v, str):
            return RoleTypeEnum(v)
        return v


class RoleRead(RoleBase):
    id: int | None = Field(default=None, primary_key=True)
    org_id: int | None = Field(default=None, foreign_key="organization.id")
    role_type: RoleTypeEnum = RoleTypeEnum.TYPE_GLOBAL
    role_uuid: str
    creation_date: str
    update_date: str

    @field_validator("role_type", mode="before")
    @classmethod
    def validate_role_type(cls, v):
        if isinstance(v, str):
            return RoleTypeEnum(v)
        return v


class RoleCreate(RoleBase):
    org_id: int | None = Field(default=None, foreign_key="organization.id")


class RoleUpdate(SQLModelStrictBaseModel):
    name: str | None = None
    description: str | None = None
