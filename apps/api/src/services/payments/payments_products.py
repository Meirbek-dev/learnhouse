from datetime import datetime

from fastapi import HTTPException, Request
from sqlmodel import Session, select
from src.services.permissions import get_permission_service

from src.db.courses.courses import Course
from src.db.organizations import Organization
from src.db.payments.payments import PaymentsConfig
from src.db.payments.payments_courses import PaymentsCourse
from src.db.payments.payments_products import (
    PaymentsProduct,
    PaymentsProductCreate,
    PaymentsProductRead,
    PaymentsProductUpdate,
)
from src.db.payments.payments_users import PaymentStatusEnum, PaymentsUser
from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser
from src.services.payments.payments_stripe import (
    archive_stripe_product,
    create_stripe_product,
    update_stripe_product,
)


async def create_payments_product(
    request: Request,
    org_id: int,
    payments_product: PaymentsProductCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> PaymentsProductRead:
    # Check if organization exists
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Check if payments config exists, has a valid id, and is active
    statement = select(PaymentsConfig).where(PaymentsConfig.org_id == org_id)
    config = db_session.exec(statement).first()
    if not config or config.id is None:
        raise HTTPException(status_code=404, detail="Valid payments config not found")

    if not config.active:
        raise HTTPException(status_code=400, detail="Payments config is not active")

    # Create new payments product
    new_product = PaymentsProduct(
        **payments_product.model_dump(), org_id=org_id, payments_config_id=config.id
    )
    new_product.creation_date = datetime.now()
    new_product.update_date = datetime.now()

    # Create product in Stripe
    stripe_product = await create_stripe_product(
        request, org_id, new_product, current_user, db_session
    )
    new_product.provider_product_id = stripe_product.id

    # Save to DB
    db_session.add(new_product)
    db_session.commit()
    db_session.refresh(new_product)

    return PaymentsProductRead.model_validate(new_product)


async def get_payments_product(
    request: Request,
    org_id: int,
    product_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> PaymentsProductRead:
    # Check if organization exists
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Get payments product
    statement = select(PaymentsProduct).where(
        PaymentsProduct.id == product_id, PaymentsProduct.org_id == org_id
    )
    product = db_session.exec(statement).first()
    if not product:
        raise HTTPException(status_code=404, detail="Payments product not found")

    return PaymentsProductRead.model_validate(product)


async def update_payments_product(
    request: Request,
    org_id: int,
    product_id: int,
    payments_product: PaymentsProductUpdate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> PaymentsProductRead:
    # Check if organization exists
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Get existing payments product
    statement = select(PaymentsProduct).where(
        PaymentsProduct.id == product_id, PaymentsProduct.org_id == org_id
    )
    product = db_session.exec(statement).first()
    if not product:
        raise HTTPException(status_code=404, detail="Payments product not found")

    # Update product
    update_data = payments_product.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    product.update_date = datetime.now()

    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)

    # Update product in Stripe
    await update_stripe_product(
        request, org_id, product.provider_product_id, product, current_user, db_session
    )

    return PaymentsProductRead.model_validate(product)


async def delete_payments_product(
    request: Request,
    org_id: int,
    product_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> None:
    # Check if organization exists
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Get existing payments product
    statement = select(PaymentsProduct).where(
        PaymentsProduct.id == product_id, PaymentsProduct.org_id == org_id
    )
    product = db_session.exec(statement).first()
    if not product:
        raise HTTPException(status_code=404, detail="Payments product not found")

    # Check if there are any payment users linked to this product
    statement = select(PaymentsUser).where(
        PaymentsUser.payment_product_id == product_id,
        PaymentsUser.status.in_(
            [PaymentStatusEnum.ACTIVE, PaymentStatusEnum.COMPLETED]
        ),
    )
    payment_users = db_session.exec(statement).all()
    if payment_users:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete product because users have paid access to it.",
        )

    # Archive product in Stripe
    await archive_stripe_product(
        request, org_id, product.provider_product_id, current_user, db_session
    )

    # Delete product
    db_session.delete(product)
    db_session.commit()


async def list_payments_products(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[PaymentsProductRead]:
    # Check if organization exists
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Get payments products ordered by id
    statement = (
        select(PaymentsProduct)
        .where(PaymentsProduct.org_id == org_id)
        .order_by(PaymentsProduct.id.desc())
    )
    products = db_session.exec(statement).all()

    return [PaymentsProductRead.model_validate(product) for product in products]


async def get_products_by_course(
    request: Request,
    org_id: int,
    course_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
) -> list[PaymentsProductRead]:
    # Check if course exists and user has permission
    statement = select(Course).where(Course.id == course_id)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ORGANIZATION,
        resource_id=course.course_uuid,
    )

    # Get all products linked to this course with explicit join
    statement = (
        select(PaymentsProduct)
        .select_from(PaymentsProduct)
        .join(PaymentsCourse, PaymentsProduct.id == PaymentsCourse.payment_product_id)
        .where(PaymentsCourse.course_id == course_id, PaymentsCourse.org_id == org_id)
    )
    products = db_session.exec(statement).all()

    return [PaymentsProductRead.model_validate(product) for product in products]
