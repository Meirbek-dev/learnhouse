"""
Enums for the RBAC permission system.

This module defines the core enums used throughout the permission system:
- Action: What operations can be performed
- ResourceType: What types of resources exist
- Scope: The scope/context of a permission
"""

from enum import Enum


class Action(str, Enum):
    """Actions that can be performed on resources."""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    MANAGE = "manage"  # Full control including settings
    MODERATE = "moderate"  # Approve/reject content
    EXPORT = "export"  # Export data
    INVITE = "invite"  # Invite users
    GRADE = "grade"  # Grade assignments/quizzes
    SUBMIT = "submit"  # Submit work
    ENROLL = "enroll"  # Enroll in courses


class ResourceType(str, Enum):
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


class Scope(str, Enum):
    """Scope of a permission - determines what resources it applies to."""

    ALL = "all"  # All resources of type
    OWN = "own"  # Only owned resources
    ASSIGNED = "assigned"  # Assigned to user
    ORG = "org"  # Within organization


class AuditAction(str, Enum):
    """Types of audit log entries."""

    CHECK = "check"  # Permission was checked
    GRANT = "grant"  # Permission was granted
    REVOKE = "revoke"  # Permission was revoked
    DENY = "deny"  # Permission check was denied
