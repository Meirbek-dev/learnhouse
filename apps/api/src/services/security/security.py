"""Security helpers shared across routers/services."""

from __future__ import annotations

from sqlmodel import Session, select

from src.db.permissions import Role, UserRole
from src.db.permissions.constants import ADMIN_OR_MAINTAINER_SLUGS


def is_user_admin_of_org(user_id: int, org_id: int, db: Session) -> bool:
    """Return True if the user has an admin/maintainer role in the given org."""
    try:
        exists_admin = db.exec(
            select(Role.id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user_id,
                UserRole.org_id == org_id,
                Role.slug.in_(ADMIN_OR_MAINTAINER_SLUGS),
            )
        ).first()
        return bool(exists_admin)
    except Exception:
        return False
