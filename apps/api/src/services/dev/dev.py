from fastapi import HTTPException

from config.config import get_platform_config


def isDevModeEnabled():
    config = get_platform_config()
    return config.general_config.development_mode


def isDevModeEnabledOrRaise() -> bool:
    config = get_platform_config()
    if config.general_config.development_mode:
        return True
    raise HTTPException(status_code=403, detail="Development mode is disabled")
