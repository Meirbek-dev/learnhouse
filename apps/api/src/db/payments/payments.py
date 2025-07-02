from datetime import datetime
from enum import Enum

from pydantic import field_validator
from sqlalchemy import JSON
from sqlmodel import BigInteger, Column, Field, ForeignKey
from src.db.strict_base_model import SQLModelStrictBaseModel


# PaymentsConfig
class PaymentProviderEnum(str, Enum):
    STRIPE = "stripe"


class PaymentsConfigBase(SQLModelStrictBaseModel):
    enabled: bool = True
    active: bool = False
    provider: PaymentProviderEnum = PaymentProviderEnum.STRIPE
    provider_specific_id: str | None = None
    provider_config: dict = Field(default_factory=dict, sa_column=Column(JSON))

    @field_validator("provider", mode="before")
    @classmethod
    def validate_provider(cls, v):
        if isinstance(v, str):
            return PaymentProviderEnum(v)
        return v


class PaymentsConfig(PaymentsConfigBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(BigInteger, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    creation_date: datetime = Field(default=datetime.now())
    update_date: datetime = Field(default=datetime.now())


class PaymentsConfigCreate(PaymentsConfigBase):
    pass


class PaymentsConfigUpdate(PaymentsConfigBase):
    enabled: bool | None = True
    provider_config: dict | None = None
    provider_specific_id: str | None = None


class PaymentsConfigRead(PaymentsConfigBase):
    id: int
    org_id: int
    creation_date: datetime
    update_date: datetime


class PaymentsConfigDelete(SQLModelStrictBaseModel):
    id: int
