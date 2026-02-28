import asyncio

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from src.db.organizations import Organization
from src.db.payments.payments_users import PaymentsUser
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import PermissionChecker
from src.services.payments.payments_products import get_payments_product
from src.services.users.users import read_user_by_id


async def get_customers(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    # Check if organization exists
    statement = select(Organization).where(Organization.id == org_id)
    org = db_session.exec(statement).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # RBAC check
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:read", org_id)

    # Get all payment users for the organization
    statement = select(PaymentsUser).where(PaymentsUser.org_id == org_id)
    payment_users = db_session.exec(statement).all()

    if not payment_users:
        return []

    # Gather all user and product lookups in parallel
    all_users = await asyncio.gather(
        *[read_user_by_id(request, db_session, current_user, pu.user_id) for pu in payment_users]
    )
    all_products = await asyncio.gather(
        *[
            get_payments_product(request, org.id, pu.payment_product_id, current_user, db_session)
            for pu in payment_users
        ]
    )

    customers_data = [
        {
            "payment_user_id": pu.id,
            "user": user or None,
            "product": product or None,
            "status": pu.status,
            "creation_date": pu.creation_date,
            "update_date": pu.update_date,
        }
        for pu, user, product in zip(payment_users, all_users, all_products)
    ]

    return customers_data
