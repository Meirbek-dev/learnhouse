from fastapi import HTTPException

from config.config import get_platform_config
from src.security.rbac import FeatureDisabled


def isDevModeEnabled():
    config = get_platform_config()
    return config.general_config.development_mode


def isDevModeEnabledOrRaise() -> bool:
    config = get_platform_config()
    if config.general_config.development_mode:
        return True
    raise FeatureDisabled(reason="Development mode is disabled")
