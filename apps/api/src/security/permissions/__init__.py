"""
Permission security - compatibility shim.

Redirects to src.security.rbac.
"""

from src.security.rbac.exceptions import (
    AuthenticationRequired,
    InsufficientRole,
    PermissionDenied,
    ResourceNotFound,
)

__all__ = [
    "AuthenticationRequired",
    "InsufficientRole",
    "PermissionDenied",
    "ResourceNotFound",
]
