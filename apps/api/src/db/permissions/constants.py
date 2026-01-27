"""
RBAC constants for role slugs and permission groups.

This module provides a single source of truth for role identifiers,
eliminating hardcoded strings throughout the codebase.
"""

from enum import StrEnum


class RoleSlug(StrEnum):
    """Standard role slugs used across the platform."""

    SUPER_ADMIN = "super-admin"
    ORG_ADMIN = "org-admin"
    MAINTAINER = "maintainer"
    INSTRUCTOR = "instructor"
    MODERATOR = "moderator"
    USER = "user"


# Role groups for common permission checks
ADMIN_ROLE_SLUGS = frozenset({
    RoleSlug.SUPER_ADMIN,
    RoleSlug.ORG_ADMIN,
})

ADMIN_OR_MAINTAINER_SLUGS = frozenset({
    RoleSlug.SUPER_ADMIN,
    RoleSlug.ORG_ADMIN,
    RoleSlug.MAINTAINER,
})

INSTRUCTOR_OR_HIGHER_SLUGS = frozenset({
    RoleSlug.SUPER_ADMIN,
    RoleSlug.ORG_ADMIN,
    RoleSlug.MAINTAINER,
    RoleSlug.INSTRUCTOR,
})

CONTENT_CREATOR_SLUGS = frozenset({
    RoleSlug.SUPER_ADMIN,
    RoleSlug.ORG_ADMIN,
    RoleSlug.MAINTAINER,
    RoleSlug.INSTRUCTOR,
})


def is_admin_role(role_slug: str) -> bool:
    """Check if the role slug is an admin role."""
    return role_slug.lower() in ADMIN_ROLE_SLUGS


def is_admin_or_maintainer_role(role_slug: str) -> bool:
    """Check if the role slug is admin or maintainer."""
    return role_slug.lower() in ADMIN_OR_MAINTAINER_SLUGS


def is_instructor_or_higher_role(role_slug: str) -> bool:
    """Check if the role slug is instructor or higher privilege."""
    return role_slug.lower() in INSTRUCTOR_OR_HIGHER_SLUGS


def is_content_creator_role(role_slug: str) -> bool:
    """Check if the role slug can create content."""
    return role_slug.lower() in CONTENT_CREATOR_SLUGS
