from typing import Literal

from sqlalchemy import JSON, BigInteger, Column, ForeignKey
from sqlmodel import Field

from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


# Features
class CourseOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10


class MemberOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    admin_limit: int = 1
    limit: int = 10


class UserGroupOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10


class StorageOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10


class AIOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10
    model: str = "gpt-5-nano"

    # Performance features
    streaming_enabled: bool = True
    response_cache_enabled: bool = True
    semantic_cache_enabled: bool = True

    # Performance limits
    max_tokens_per_request: int = 4000
    max_chat_history: int = 100
    rate_limit_per_user: int = 100  # per hour


class AssignmentOrgConfig(PydanticStrictBaseModel):
    enabled: bool = False
    limit: int = 10


class ExamOrgConfig(PydanticStrictBaseModel):
    enabled: bool = False
    limit: int = 10


class PaymentOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True


class DiscussionOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10


class AnalyticsOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10


class CollaborationOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10


class APIOrgConfig(PydanticStrictBaseModel):
    enabled: bool = True
    limit: int = 10


class OrgFeatureConfig(PydanticStrictBaseModel):
    courses: CourseOrgConfig = CourseOrgConfig()
    members: MemberOrgConfig = MemberOrgConfig()
    usergroups: UserGroupOrgConfig = UserGroupOrgConfig()
    storage: StorageOrgConfig = StorageOrgConfig()
    ai: AIOrgConfig = AIOrgConfig()
    assignments: AssignmentOrgConfig = AssignmentOrgConfig()
    exams: ExamOrgConfig = ExamOrgConfig()
    payments: PaymentOrgConfig = PaymentOrgConfig()
    discussions: DiscussionOrgConfig = DiscussionOrgConfig()
    analytics: AnalyticsOrgConfig = AnalyticsOrgConfig()
    collaboration: CollaborationOrgConfig = CollaborationOrgConfig()
    api: APIOrgConfig = APIOrgConfig()


# General
class OrgGeneralConfig(PydanticStrictBaseModel):
    enabled: bool = True
    color: str = "normal"


# Cloud
class OrgCloudConfig(PydanticStrictBaseModel):
    plan: Literal["free", "standard", "pro"] = "free"
    custom_domain: bool = False


# Main Config
class OrganizationConfigBase(PydanticStrictBaseModel):
    config_version: str = "1.3"
    general: OrgGeneralConfig
    features: OrgFeatureConfig
    cloud: OrgCloudConfig
    landing: dict = {}


class OrganizationConfig(SQLModelStrictBaseModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(BigInteger, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    config: dict = Field(default_factory=dict, sa_column=Column(JSON))
    creation_date: str | None
    update_date: str | None
