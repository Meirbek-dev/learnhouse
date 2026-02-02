"""
Enums for the RBAC permission system.

Re-exports generated enums from permissions.yaml for consistency.
"""

from enum import Enum

# Re-export generated enums to ensure consistency
from src.db.permissions.generated_enums import Action, ResourceType, Scope

__all__ = [
    "Action",
    "AuditAction",
    "ResourceType",
    "Scope",
]


class AuditAction(str, Enum):
    """Types of audit log entries."""

    CHECK = "check"  # Permission was checked
    GRANT = "grant"  # Permission was granted
    REVOKE = "revoke"  # Permission was revoked
    DENY = "deny"  # Permission check was denied
