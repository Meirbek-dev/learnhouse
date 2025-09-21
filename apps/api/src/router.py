"""Top-level API v1 router aggregator.

This module composes all feature routers under the /api/v1 prefix.
Routers are grouped by domain, with optional cloud_internal routes gated
by CLOUD_INTERNAL_KEY.
"""

import os

from fastapi import APIRouter, Depends

from src.routers import (
    auth,
    dev,
    gamification,
    health,
    orgs,
    roles,
    search,
    trail,
    usergroups,
    users,
)
from src.routers.ai import ai
from src.routers.courses import (
    assignments,
    certifications,
    chapters,
    collections,
    courses,
    discussions,
)
from src.routers.courses.activities import activities, blocks
from src.routers.ee import cloud_internal, payments
from src.routers.install import install
from src.routers.utils import router as utils_router
from src.services.dev.dev import isDevModeEnabledOrRaise
from src.services.install.install import isInstallModeEnabled

v1_router = APIRouter(prefix="/api/v1")

# Core domain routes
v1_router.include_router(users.router, prefix="/users", tags=["users"])
v1_router.include_router(usergroups.router, prefix="/usergroups", tags=["usergroups"])
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
v1_router.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
v1_router.include_router(roles.router, prefix="/roles", tags=["roles"])
v1_router.include_router(search.router, prefix="/search", tags=["search"])
v1_router.include_router(health.router, prefix="/health", tags=["health"])
v1_router.include_router(utils_router, prefix="/utils", tags=["utils"])

# Learning domain
v1_router.include_router(blocks.router, prefix="/blocks", tags=["blocks"])
v1_router.include_router(courses.router, prefix="/courses", tags=["courses"])
v1_router.include_router(discussions.router, prefix="/courses", tags=["discussions"])
v1_router.include_router(chapters.router, prefix="/chapters", tags=["chapters"])
v1_router.include_router(activities.router, prefix="/activities", tags=["activities"])
v1_router.include_router(
    assignments.router, prefix="/assignments", tags=["assignments"]
)
v1_router.include_router(
    certifications.router, prefix="/certifications", tags=["certifications"]
)
v1_router.include_router(
    collections.router, prefix="/collections", tags=["collections"]
)
v1_router.include_router(trail.router, prefix="/trail", tags=["trail"])

# Gamification
v1_router.include_router(
    gamification.router,
    prefix="/gamification",
    tags=["gamification"],
)

v1_router.include_router(ai.router, prefix="/ai", tags=["ai"])

# Payments/EE
v1_router.include_router(payments.router, prefix="/payments", tags=["payments"])

# Optional cloud-internal routes
if os.environ.get("CLOUD_INTERNAL_KEY"):
    v1_router.include_router(
        cloud_internal.router,
        prefix="/cloud_internal",
        tags=["cloud_internal"],
        dependencies=[Depends(cloud_internal.check_internal_cloud_key)],
    )

# Dev and Install routes
v1_router.include_router(
    dev.router,
    prefix="/dev",
    tags=["dev"],
    dependencies=[Depends(isDevModeEnabledOrRaise)],
)
v1_router.include_router(
    install.router,
    prefix="/install",
    tags=["install"],
    dependencies=[Depends(isInstallModeEnabled)],
)

__all__ = ["v1_router"]
