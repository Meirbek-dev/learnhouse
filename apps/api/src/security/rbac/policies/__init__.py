"""
Resource-specific permission policies.

This module provides policy classes for different resource types,
implementing resource-specific permission logic.
"""

from src.security.rbac.policies.base import BasePolicy
from src.security.rbac.policies.course import CoursePolicy
from src.security.rbac.policies.organization import OrganizationPolicy
from src.security.rbac.policies.user import UserPolicy

__all__ = [
    "BasePolicy",
    "CoursePolicy",
    "OrganizationPolicy",
    "UserPolicy",
]
