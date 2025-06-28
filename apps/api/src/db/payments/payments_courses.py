from datetime import datetime

from sqlmodel import BigInteger, Column, Field, ForeignKey, SQLModel


class PaymentsCourseBase(SQLModel):
    course_id: int = Field(
        sa_column=Column(BigInteger, ForeignKey("course.id", ondelete="CASCADE"))
    )


class PaymentsCourse(PaymentsCourseBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    payment_product_id: int = Field(
        sa_column=Column(
            BigInteger, ForeignKey("paymentsproduct.id", ondelete="CASCADE")
        )
    )
    org_id: int = Field(
        sa_column=Column(BigInteger, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    creation_date: datetime = Field(default=datetime.now())
    update_date: datetime = Field(default=datetime.now())
