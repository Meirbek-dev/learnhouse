from enum import Enum

from pydantic import ConfigDict, field_validator
from sqlalchemy import Column, ForeignKey, Integer, TypeDecorator
from sqlalchemy.dialects.postgresql import JSON as PGJSON
from sqlmodel import Field

from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class RightsJSON(TypeDecorator):
    """Custom JSON type that handles Rights object serialization for psycopg3"""

    impl = PGJSON
    cache_ok = True

    def process_bind_param(self, value: object, dialect) -> dict | None:
        """Convert Rights object to dict before storing in database"""
        if value is None:
            return None
        if hasattr(value, "model_dump"):
            return value.model_dump()
        return value

    def process_result_value(self, value: object, dialect) -> dict | None:
        """Return the dict value as-is from database"""
        return value


# Rights
class Permission(PydanticStrictBaseModel):
    action_create: bool
    action_read: bool
    action_update: bool
    action_delete: bool

    def __getitem__(self, item) -> object:
        return getattr(self, item)

    def __json__(self) -> dict:
        return self.model_dump()

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return handler(core_schema)


class PermissionsWithOwn(PydanticStrictBaseModel):
    action_create: bool
    action_read: bool
    action_read_own: bool
    action_update: bool
    action_update_own: bool
    action_delete: bool
    action_delete_own: bool

    def __getitem__(self, item) -> object:
        return getattr(self, item)


class DashboardPermission(PydanticStrictBaseModel):
    action_access: bool

    def __getitem__(self, item) -> object:
        return getattr(self, item)


class Rights(PydanticStrictBaseModel):
    courses: PermissionsWithOwn
    users: Permission
    usergroups: Permission
    collections: Permission
    organizations: Permission
    coursechapters: Permission
    activities: Permission
    roles: Permission
    dashboard: DashboardPermission

    def __getitem__(self, item) -> object:
        return getattr(self, item)

    def __json__(self) -> dict:
        return self.model_dump()

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return handler(core_schema)

    model_config = ConfigDict(arbitrary_types_allowed=True)


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
