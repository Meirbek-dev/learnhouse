from __future__ import annotations

from sqlmodel import Session, select

from src.db.organizations import Organization


def get_platform_organization(db_session: Session) -> Organization:
    platform_org = db_session.exec(
        select(Organization).order_by(Organization.id.asc())
    ).first()
    if not platform_org:
        raise RuntimeError(
            "Platform organization not found. Run the install/bootstrap flow first."
        )
    return platform_org


def get_platform_org_id(db_session: Session) -> int:
    return get_platform_organization(db_session).id


def require_platform_org_id(db_session: Session, org_id: int | None = None) -> int:
    platform_org_id = get_platform_org_id(db_session)
    if org_id is not None and org_id != platform_org_id:
        msg = (
            f"Single-org mode only supports platform organization id {platform_org_id}."
        )
        raise RuntimeError(msg)
    return platform_org_id
