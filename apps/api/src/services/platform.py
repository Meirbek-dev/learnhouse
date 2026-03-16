from __future__ import annotations

from sqlmodel import Session, select

from src.core.platform import PLATFORM_ORG_SLUG
from src.db.organizations import Organization


def get_platform_organization(db_session: Session) -> Organization:
    platform_org = db_session.exec(
        select(Organization).where(Organization.slug == PLATFORM_ORG_SLUG)
    ).first()
    if not platform_org:
        raise RuntimeError(
            f"Platform organization '{PLATFORM_ORG_SLUG}' not found. Run the install/bootstrap flow first."
        )
    return platform_org


def get_platform_org_id(db_session: Session) -> int:
    return get_platform_organization(db_session).id


def require_platform_org_id(db_session: Session, org_id: int | None = None) -> int:
    platform_org_id = get_platform_org_id(db_session)
    if org_id is not None and org_id != platform_org_id:
        raise RuntimeError(
            f"Single-org mode only supports platform organization id {platform_org_id}."
        )
    return platform_org_id
