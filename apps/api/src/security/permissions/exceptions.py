"""
Permission exceptions - compatibility shim.

Redirects to src.security.rbac.exceptions.
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
