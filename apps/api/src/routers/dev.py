from fastapi import APIRouter

from config.config import get_openu_config

router = APIRouter()


@router.get("/config")
async def config():
    config = get_openu_config()
    return config.model_dump()
