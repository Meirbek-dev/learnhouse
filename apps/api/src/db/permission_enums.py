"""
Permission Enums — single source of truth for RBAC definitions.
"""

from enum import StrEnum


class Action(StrEnum):
    """Actions that can be performed on resources."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    MANAGE = "manage"
    MODERATE = "moderate"
    EXPORT = "export"
    INVITE = "invite"
    GRADE = "grade"
    SUBMIT = "submit"
    ENROLL = "enroll"


class ResourceType(StrEnum):
    """Types of resources in the system."""

    ORGANIZATION = "organization"
    COURSE = "course"
    CHAPTER = "chapter"
    ACTIVITY = "activity"
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    USER = "user"
    USERGROUP = "usergroup"
    COLLECTION = "collection"
    ROLE = "role"
    CERTIFICATE = "certificate"
    DISCUSSION = "discussion"
    FILE = "file"
    ANALYTICS = "analytics"
    TRAIL = "trail"
    EXAM = "exam"
    PAYMENT = "payment"
    API_TOKEN = "api_token"


class Scope(StrEnum):
    """Scope of a permission."""

    ALL = "all"
    OWN = "own"
    ASSIGNED = "assigned"
    ORG = "org"


class RoleSlug(StrEnum):
    """Standard role slugs."""

    SUPER_ADMIN = "super-admin"
    ORG_ADMIN = "org-admin"
    MAINTAINER = "maintainer"
    INSTRUCTOR = "instructor"
    MODERATOR = "moderator"
    USER = "user"


# ============================================================================
# System role definitions — what each built-in role can do
# ============================================================================

SYSTEM_ROLES: dict[str, dict] = {
    RoleSlug.SUPER_ADMIN: {
        "name": "Super Admin",
        "description": "Platform super administrator with full system access",
        "priority": 100,
        "permissions": ["*:*:*"],
    },
    RoleSlug.ORG_ADMIN: {
        "name": "Organization Admin",
        "description": "Organization administrator with full org control",
        "priority": 90,
        "permissions": [
            "organization:manage:org",
            "organization:update:org",
            "organization:read:org",
            "organization:delete:org",
            "course:*:org",
            "chapter:*:org",
            "activity:*:org",
            "assignment:*:org",
            "quiz:*:org",
            "exam:*:org",
            "user:read:org",
            "user:create:org",
            "user:update:org",
            "user:delete:org",
            "user:invite:org",
            "usergroup:*:org",
            "collection:*:org",
            "role:read:org",
            "role:create:org",
            "role:update:org",
            "role:delete:org",
            "certificate:*:org",
            "discussion:moderate:org",
            "file:*:org",
            "analytics:read:org",
            "analytics:export:org",
            "payment:manage:org",
        ],
    },
    RoleSlug.MAINTAINER: {
        "name": "Maintainer",
        "description": "Course maintainer with broad content permissions",
        "priority": 70,
        "permissions": [
            "course:create:org",
            "course:read:all",
            "course:update:org",
            "course:delete:own",
            "course:manage:own",
            "chapter:*:org",
            "activity:*:org",
            "assignment:*:org",
            "quiz:*:org",
            "exam:*:org",
            "collection:create:org",
            "collection:read:all",
            "collection:update:own",
            "collection:delete:own",
            "discussion:moderate:org",
            "analytics:read:own",
            "certificate:create:own",
        ],
    },
    RoleSlug.INSTRUCTOR: {
        "name": "Instructor",
        "description": "Course instructor with content creation abilities",
        "priority": 50,
        "permissions": [
            "course:create:org",
            "course:read:all",
            "course:update:own",
            "course:delete:own",
            "chapter:create:own",
            "chapter:read:all",
            "chapter:update:own",
            "chapter:delete:own",
            "activity:create:own",
            "activity:read:all",
            "activity:update:own",
            "activity:delete:own",
            "assignment:*:own",
            "quiz:*:own",
            "exam:*:own",
            "collection:create:org",
            "collection:read:all",
            "collection:update:own",
            "discussion:moderate:own",
            "analytics:read:own",
            "user:read:assigned",
        ],
    },
    RoleSlug.MODERATOR: {
        "name": "Moderator",
        "description": "Content moderator for discussions and user content",
        "priority": 40,
        "permissions": [
            "course:read:all",
            "discussion:moderate:org",
            "discussion:read:all",
            "discussion:update:org",
            "discussion:delete:org",
            "user:read:org",
        ],
    },
    RoleSlug.USER: {
        "name": "User",
        "description": "Regular user with basic access",
        "priority": 10,
        "permissions": [
            "course:read:all",
            "course:enroll:all",
            "chapter:read:all",
            "activity:read:all",
            "assignment:submit:assigned",
            "assignment:read:assigned",
            "quiz:submit:assigned",
            "quiz:read:assigned",
            "exam:submit:assigned",
            "exam:read:assigned",
            "collection:read:all",
            "discussion:create:org",
            "discussion:read:all",
            "discussion:update:own",
            "discussion:delete:own",
            "user:read:own",
            "user:update:own",
            "certificate:read:own",
        ],
    },
}


# ============================================================================
# Role group helpers
# ============================================================================

ADMIN_ROLE_SLUGS = frozenset({RoleSlug.SUPER_ADMIN, RoleSlug.ORG_ADMIN})
