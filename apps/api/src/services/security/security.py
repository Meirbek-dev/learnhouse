"""Security helpers shared across routers/services."""

from __future__ import annotations

from sqlmodel import Session, select

from src.db.roles import Role
from src.db.user_organizations import UserOrganization


def is_user_admin_of_org(user_id: int, org_id: int, db: Session) -> bool:
    """Return True if the user has an admin/maintainer role in the given org.

    In this codebase role IDs 1 and 2 are treated as Admin/Maintainer respectively.
    """
    try:
        exists_admin = db.exec(
            select(Role.id)
            .join(UserOrganization, UserOrganization.role_id == Role.id)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.org_id == org_id,
                Role.role_uuid.in_(["role_global_admin", "role_global_maintainer"]),
            )
        ).first()
        return bool(exists_admin)
    except Exception:
        return False
