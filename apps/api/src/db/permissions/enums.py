"""
Enums for the RBAC permission system.

This module defines the core enums used throughout the permission system:
- Action: What operations can be performed (re-exported from generated_enums)
- ResourceType: What types of resources exist (re-exported from generated_enums)
- Scope: The scope/context of a permission (re-exported from generated_enums)
- AuditAction, AuditLevel, PermissionErrorCode: Additional enums specific to this system
"""

from enum import Enum

# Re-export generated enums to ensure consistency
from src.db.permissions.generated_enums import Action, ResourceType, Scope

__all__ = [
    "Action",
    "ResourceType",
    "Scope",
    "AuditAction",
    "AuditLevel",
    "PermissionErrorCode",
]


class AuditAction(str, Enum):
    """Types of audit log entries."""

    CHECK = "check"  # Permission was checked
    GRANT = "grant"  # Permission was granted
    REVOKE = "revoke"  # Permission was revoked
    DENY = "deny"  # Permission check was denied


class AuditLevel(str, Enum):
    """Configurable audit logging levels."""

    NONE = "none"  # No audit logging
    FAILURES_ONLY = "failures_only"  # Log only denied checks
    WRITES_ONLY = (
        "writes_only"  # Log only write operations (create/update/delete) and failures
    )
    ALL_EXCEPT_READS = "all_except_reads"  # Log all except successful reads (default)
    ALL = "all"  # Log everything including successful reads


class PermissionErrorCode(str, Enum):
    """
    Error codes for permission-related errors.

    These codes provide more specific error information than HTTP status codes alone.
    """

    PERM_001 = "PERM_001"  # 401 - Authentication required
    PERM_002 = "PERM_002"  # 403 - Permission denied
    PERM_003 = "PERM_003"  # 403 - Insufficient role level
    PERM_004 = "PERM_004"  # 404 - Permission not found
    PERM_005 = "PERM_005"  # 404 - Role not found
    PERM_006 = "PERM_006"  # 409 - Role already exists
    PERM_007 = "PERM_007"  # 409 - Permission already assigned
    PERM_008 = "PERM_008"  # 422 - Cannot modify system role
