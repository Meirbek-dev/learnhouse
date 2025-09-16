from __future__ import annotations

import asyncio
from typing import Callable

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from src.core.events.database import engine, get_db_session
from src.db.organizations import Organization
from src.db.users import PublicUser, User
from src.db.user_organizations import UserOrganization
from src.routers.gamification import router as gamification_router
from src.security.auth import get_current_user
from src.tests.utils.init_data_for_tests import create_initial_data_for_tests


def _build_app_with_bound_session(user_provider: Callable[[], PublicUser], conn) -> tuple[FastAPI, TestClient, Session]:
    # Create schema on the same connection for in-memory SQLite
    SQLModel.metadata.create_all(conn)
    bound_session = Session(bind=conn)

    # Seed initial data using the same session/connection
    asyncio.run(create_initial_data_for_tests(bound_session))

    app = FastAPI()
    app.include_router(gamification_router, prefix="/api/v1/gamification")
    # Override auth dependency to use provided user
    app.dependency_overrides[get_current_user] = user_provider

    # Ensure all DB access uses the same in-memory connection
    def _yield_session():
        with Session(bind=conn) as s:
            yield s

    app.dependency_overrides[get_db_session] = _yield_session
    client = TestClient(app)
    return app, client, bound_session


def _get_org_and_users(session: Session):
    org = session.exec(select(Organization).where(Organization.slug == "openu")).first()
    assert org is not None
    admin_user = session.exec(select(User).where(User.username == "studento")).first()
    regular_user = session.exec(select(User).where(User.username == "testo")).first()
    assert admin_user and regular_user

    # Sanity-check roles from UserOrganization mapping
    admin_link = session.exec(
        select(UserOrganization).where(
            (UserOrganization.user_id == admin_user.id) & (UserOrganization.org_id == org.id)
        )
    ).first()
    regular_link = session.exec(
        select(UserOrganization).where(
            (UserOrganization.user_id == regular_user.id) & (UserOrganization.org_id == org.id)
        )
    ).first()
    assert admin_link and admin_link.role_id == 1
    assert regular_link and regular_link.role_id == 3
    return org, admin_user, regular_user


def test_admin_award_requires_idempotency():
    # Maintain a single in-memory connection for the whole test
    with engine.connect() as conn:
        # Build app bound to this connection
        # Fetch admin user after seeding
        def as_admin_factory(u: User) -> Callable[[], PublicUser]:
            return lambda: PublicUser(**u.model_dump())

        # Create app and seed
        _, client, session = _build_app_with_bound_session(lambda: PublicUser(id=0, user_uuid="u", username="", email=""), conn)
        org, admin_user, _ = _get_org_and_users(session)

        # Replace auth provider with real admin now that we have it
        app = client.app
        app.dependency_overrides[get_current_user] = as_admin_factory(admin_user)

        # Missing X-Idempotency-Key should yield 400 for ADMIN_AWARD
        r = client.post(
            f"/api/v1/gamification/award-xp/{org.id}",
            params={"source": "ADMIN_AWARD", "source_id": "t1", "custom_amount": 100},
        )
        assert r.status_code == 400, r.text
        assert "Idempotency" in r.json().get("detail", "")


def test_admin_award_forbidden_for_non_admin():
    with engine.connect() as conn:
        _, client, session = _build_app_with_bound_session(lambda: PublicUser(id=0, user_uuid="u", username="", email=""), conn)
        org, _admin_user, regular_user = _get_org_and_users(session)

        def as_regular() -> PublicUser:
            return PublicUser(**regular_user.model_dump())

        client.app.dependency_overrides[get_current_user] = as_regular

        r = client.post(
            f"/api/v1/gamification/award-xp/{org.id}",
            params={"source": "ADMIN_AWARD", "source_id": "t2", "custom_amount": 50},
            headers={"X-Idempotency-Key": "nonadmin-1"},
        )
        assert r.status_code == 403, r.text


def test_admin_award_success_and_audit_and_idempotency():
    with engine.connect() as conn:
        _, client, session = _build_app_with_bound_session(lambda: PublicUser(id=0, user_uuid="u", username="", email=""), conn)
        org, admin_user, _ = _get_org_and_users(session)

        def as_admin() -> PublicUser:
            return PublicUser(**admin_user.model_dump())

        client.app.dependency_overrides[get_current_user] = as_admin

        idem = "admin-idem-1"
        custom_amount = 120

        r1 = client.post(
            f"/api/v1/gamification/award-xp/{org.id}",
            params={
                "source": "ADMIN_AWARD",
                "source_id": "job-123",
                "custom_amount": custom_amount,
            },
            headers={"X-Idempotency-Key": idem},
        )
        assert r1.status_code == 200, r1.text
        data1 = r1.json()["data"]
        tx1 = data1["transaction"]
        assert tx1["created_by_admin"] is True
        assert tx1["admin_user_id"] == admin_user.id
        assert data1["used_default_xp"] is False
        assert data1["used_custom_amount"] == custom_amount
        assert data1["is_new_transaction"] is True

        r2 = client.post(
            f"/api/v1/gamification/award-xp/{org.id}",
            params={
                "source": "ADMIN_AWARD",
                "source_id": "job-123",
                "custom_amount": custom_amount,
            },
            headers={"X-Idempotency-Key": idem},
        )
        assert r2.status_code == 200, r2.text
        data2 = r2.json()["data"]
        assert data2["is_new_transaction"] is False
        assert data2["transaction"]["id"] == tx1["id"]


def test_daily_cap_enforced_for_admin_award():
    with engine.connect() as conn:
        _, client, session = _build_app_with_bound_session(lambda: PublicUser(id=0, user_uuid="u", username="", email=""), conn)
        org, admin_user, _ = _get_org_and_users(session)

        def as_admin() -> PublicUser:
            return PublicUser(**admin_user.model_dump())

        client.app.dependency_overrides[get_current_user] = as_admin

        r1 = client.post(
            f"/api/v1/gamification/award-xp/{org.id}",
            params={
                "source": "ADMIN_AWARD",
                "source_id": "cap-1",
                "custom_amount": 10_000,
            },
            headers={"X-Idempotency-Key": "cap-key-1"},
        )
        assert r1.status_code == 200, r1.text

        r2 = client.post(
            f"/api/v1/gamification/award-xp/{org.id}",
            params={
                "source": "ADMIN_AWARD",
                "source_id": "cap-2",
                "custom_amount": 1,
            },
            headers={"X-Idempotency-Key": "cap-key-2"},
        )
        assert r2.status_code == 429, r2.text


def test_non_admin_source_ignores_custom_amount():
    with engine.connect() as conn:
        _, client, session = _build_app_with_bound_session(lambda: PublicUser(id=0, user_uuid="u", username="", email=""), conn)
        org, admin_user, _ = _get_org_and_users(session)

        def as_user() -> PublicUser:
            return PublicUser(**admin_user.model_dump())

        client.app.dependency_overrides[get_current_user] = as_user

        r = client.post(
            f"/api/v1/gamification/award-xp/{org.id}",
            params={
                "source": "ACTIVITY_COMPLETION",
                "source_id": "act-1",
                "custom_amount": 9999,
            },
            headers={"X-Idempotency-Key": "act-1"},
        )
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert data["used_default_xp"] is True
        assert data["used_custom_amount"] is None
