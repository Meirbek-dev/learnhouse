import redis
from config.config import get_openu_config
from typing import Literal, TypeAlias
from fastapi import HTTPException
from sqlmodel import Session

FeatureSet: TypeAlias = Literal[
    "ai",
    "analytics",
    "api",
    "assignments",
    "collaboration",
    "courses",
    "discussions",
    "members",
    "payments",
    "storage",
    "usergroups",
]


def check_limits_with_usage(
    feature: FeatureSet,
    org_id: int,
    db_session: Session,
):
    return True


def increase_feature_usage(
    feature: FeatureSet,
    org_id: int,
    db_session: Session,
):
    LH_CONFIG = get_openu_config()
    redis_conn_string = LH_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    # Connect to Redis
    r = redis.Redis.from_url(redis_conn_string)

    # Get the number of feature usage
    feature_usage = r.get(f"{feature}_usage:{org_id}")

    # Get a number of feature asks
    if feature_usage is None:
        feature_usage_count = 0
    else:
        feature_usage_count = int(feature_usage)

    # Increment the feature usage
    r.set(f"{feature}_usage:{org_id}", feature_usage_count + 1)
    return True


def decrease_feature_usage(
    feature: FeatureSet,
    org_id: int,
    db_session: Session,
):
    LH_CONFIG = get_openu_config()
    redis_conn_string = LH_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    # Connect to Redis
    r = redis.Redis.from_url(redis_conn_string)

    # Get the number of feature usage
    feature_usage = r.get(f"{feature}_usage:{org_id}")

    # Get a number of feature asks
    if feature_usage is None:
        feature_usage_count = 0
    else:
        feature_usage_count = int(feature_usage)

    # Increment the feature usage
    r.set(f"{feature}_usage:{org_id}", feature_usage_count - 1)
    return True
