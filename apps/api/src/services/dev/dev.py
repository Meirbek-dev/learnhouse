from fastapi import HTTPException

from config.config import get_platform_config
from src.db.permissions.generated_enums import Action, ResourceType
from src.security.permissions.exceptions import PermissionDenied


def isDevModeEnabled():
    config = get_platform_config()
    return config.general_config.development_mode


def isDevModeEnabledOrRaise() -> bool:
    config = get_platform_config()
    if config.general_config.development_mode:
        return True
    raise PermissionDenied(
        Action.MANAGE, ResourceType.ORGANIZATION, reason="Development mode is disabled"
    )
