from typing import Literal
from src.db.strict_base_model import PydanticStrictBaseModel

BlockType = Literal["quizBlock", "videoBlock", "pdfBlock", "imageBlock"]


class Block(PydanticStrictBaseModel):
    block_id: str
    activity_id: str
    course_id: str
    org_id: str
    block_type: BlockType
