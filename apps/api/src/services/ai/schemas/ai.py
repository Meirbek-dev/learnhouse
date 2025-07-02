from src.db.strict_base_model import PydanticStrictBaseModel


class StartActivityAIChatSession(PydanticStrictBaseModel):
    activity_uuid: str
    message: str


class ActivityAIChatSessionResponse(PydanticStrictBaseModel):
    aichat_uuid: str
    activity_uuid: str
    message: str


class SendActivityAIChatMessage(PydanticStrictBaseModel):
    aichat_uuid: str
    activity_uuid: str
    message: str
