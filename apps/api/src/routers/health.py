from typing import Annotated

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from src.infra.health import get_liveness_status, get_readiness_status

router = APIRouter()


@router.get("")
def health() -> JSONResponse:
    payload = get_readiness_status()
    status_code = 200 if payload["status"] == "ready" else 503
    return JSONResponse(status_code=status_code, content=payload)


@router.get("/live")
def health_live() -> dict[str, object]:
    return get_liveness_status()


@router.get("/ready")
def health_ready() -> JSONResponse:
    payload = get_readiness_status()
    status_code = 200 if payload["status"] == "ready" else 503
    return JSONResponse(status_code=status_code, content=payload)
