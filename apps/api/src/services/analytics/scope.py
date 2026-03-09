from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import and_, or_, select
from sqlmodel import Session

from src.db.courses.courses import Course
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipStatusEnum
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import AuthenticationRequired, PermissionDenied, PermissionChecker
from src.services.analytics.filters import AnalyticsFilters


@dataclass(slots=True)
class TeacherAnalyticsScope:
    org_id: int
    teacher_user_id: int
    course_ids: list[int]
    cohort_ids: list[int]
    has_org_scope: bool


def _coerce_course_id(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if hasattr(value, "_mapping"):
        mapping = value._mapping
        if mapping:
            return _coerce_course_id(next(iter(mapping.values())))
    if isinstance(value, (tuple, list)):
        if not value:
            return None
        return _coerce_course_id(value[0])
    return int(value)


def _has_analytics_scope(checker: PermissionChecker, user_id: int, org_id: int, action: str, scope: str) -> bool:
    permissions = checker.get_expanded_permissions(user_id, org_id)
    return f"analytics:{action}:{scope}" in permissions or f"analytics:*:{scope}" in permissions or "*:*:*" in permissions


def ensure_analytics_access(checker: PermissionChecker, user_id: int, org_id: int, action: str) -> None:
    if any(
        _has_analytics_scope(checker, user_id, org_id, action, scope)
        for scope in ("assigned", "org", "all")
    ):
        return
    raise PermissionDenied(permission=f"analytics:{action}")


def resolve_teacher_scope(
    db_session: Session,
    checker: PermissionChecker,
    current_user: PublicUser | AnonymousUser,
    org_id: int,
    filters: AnalyticsFilters,
    *,
    action: str,
) -> TeacherAnalyticsScope:
    if isinstance(current_user, AnonymousUser):
        raise AuthenticationRequired()

    ensure_analytics_access(checker, current_user.id, org_id, action)
    has_org_scope = any(
        _has_analytics_scope(checker, current_user.id, org_id, action, scope)
        for scope in ("org", "all")
    )

    teacher_user_id = filters.teacher_user_id or current_user.id
    target_user_id = teacher_user_id if has_org_scope else current_user.id

    if has_org_scope and filters.teacher_user_id:
        course_ids = db_session.exec(
            select(Course.id)
            .outerjoin(ResourceAuthor, ResourceAuthor.resource_uuid == Course.course_uuid)
            .where(Course.org_id == org_id)
            .where(
                or_(
                    Course.creator_id == target_user_id,
                    and_(
                        ResourceAuthor.user_id == target_user_id,
                        ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
                    ),
                )
            )
        ).all()
    elif has_org_scope:
        course_ids = db_session.exec(select(Course.id).where(Course.org_id == org_id)).all()
    else:
        course_ids = db_session.exec(
            select(Course.id)
            .outerjoin(ResourceAuthor, ResourceAuthor.resource_uuid == Course.course_uuid)
            .where(Course.org_id == org_id)
            .where(
                or_(
                    Course.creator_id == current_user.id,
                    and_(
                        ResourceAuthor.user_id == current_user.id,
                        ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
                    ),
                )
            )
        ).all()

    normalized_course_ids = sorted(
        {
            normalized_course_id
            for course_id in course_ids
            if (normalized_course_id := _coerce_course_id(course_id)) is not None
        }
    )
    if filters.course_ids:
        requested = set(filters.course_ids)
        allowed = set(normalized_course_ids)
        unauthorized = sorted(requested - allowed)
        if unauthorized:
            raise PermissionDenied(
                permission=f"analytics:{action}",
                reason=f"Requested courses are outside analytics scope: {unauthorized}",
            )
        normalized_course_ids = sorted(requested)

    return TeacherAnalyticsScope(
        org_id=org_id,
        teacher_user_id=target_user_id,
        course_ids=normalized_course_ids,
        cohort_ids=filters.cohort_ids,
        has_org_scope=has_org_scope,
    )


def ensure_course_in_scope(scope: TeacherAnalyticsScope, course_id: int) -> None:
    if course_id not in scope.course_ids:
        raise PermissionDenied(
            permission="analytics:read",
            reason=f"Course {course_id} is outside the resolved analytics scope",
        )
