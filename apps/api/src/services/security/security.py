"""Security helpers shared across routers/services."""

from __future__ import annotations

from sqlmodel import Session, select

from src.db.permissions import Role, UserRole


def is_user_admin_of_org(user_id: int, org_id: int, db: Session) -> bool:
    """Return True if the user has an admin/maintainer role in the given org.

    Uses the new RBAC system with user_roles and roles tables.
    """
    try:
        exists_admin = db.exec(
            select(Role.id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user_id,
                UserRole.org_id == org_id,
                Role.slug.in_(["super-admin", "org-admin", "maintainer"]),
            )
        ).first()
        return bool(exists_admin)
    except Exception:
        return False
