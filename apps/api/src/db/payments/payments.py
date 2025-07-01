from datetime import datetime
from enum import Enum

from sqlalchemy import JSON
from sqlmodel import BigInteger, Column, Field, ForeignKey, SQLModel


# PaymentsConfig
class PaymentProviderEnum(str, Enum):
    STRIPE = "stripe"


class PaymentsConfigBase(SQLModel):
    enabled: bool = True
    active: bool = False
    provider: PaymentProviderEnum = PaymentProviderEnum.STRIPE
    provider_specific_id: str | None = None
    provider_config: dict = Field(default_factory=dict, sa_column=Column(JSON))


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


class PaymentsConfigDelete(SQLModel):
    id: int
