import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.ai.ai import (
    ai_send_activity_chat_message,
    ai_send_activity_chat_message_stream,
    ai_start_activity_chat_session,
    ai_start_activity_chat_session_stream,
)
from src.services.ai.schemas.ai import (
    ActivityAIChatSessionResponse,
    SendActivityAIChatMessage,
    StartActivityAIChatSession,
)

logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


@router.post("/start/activity_chat_session")
@limiter.limit("10/minute")  # 10 requests per minute per IP
async def api_ai_start_activity_chat_session(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> ActivityAIChatSessionResponse:
    """
    Start a new AI Chat session with a Course Activity.

    Rate limit: 10 requests per minute per IP address.

    Raises:
        HTTPException 429: Rate limit exceeded
        HTTPException 404: Activity not found
        HTTPException 403: AI feature disabled
        HTTPException 504: AI processing timeout
        HTTPException 500: AI processing error
    """
    logger.info(f"AI chat session start request from user {current_user.id}")

    try:
        return await ai_start_activity_chat_session(
            request, chat_session_object, current_user, db_session
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in AI start endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/send/activity_chat_message")
@limiter.limit(
    "20/minute"
)  # 20 requests per minute per IP (higher limit for chat messages)
async def api_ai_send_activity_chat_message(
    request: Request,
    chat_session_object: SendActivityAIChatMessage,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> ActivityAIChatSessionResponse:
    """
    Send a message to an AI Chat session with a Course Activity.

    Rate limit: 20 requests per minute per IP address.

    Raises:
        HTTPException 429: Rate limit exceeded
        HTTPException 404: Activity not found
        HTTPException 403: AI feature disabled
        HTTPException 504: AI processing timeout
        HTTPException 500: AI processing error
    """
    logger.info(f"AI chat message request from user {current_user.id}")

    try:
        return await ai_send_activity_chat_message(
            request, chat_session_object, current_user, db_session
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in AI send endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/start/activity_chat_session_stream")
@limiter.limit("10/minute")
async def api_ai_start_activity_chat_session_stream(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> StreamingResponse:
    """
    Start a new AI Chat session with streaming responses (SSE).

    This endpoint provides real-time streaming of AI responses for better
    perceived performance. Clients receive response chunks as they're generated.

    Rate limit: 10 requests per minute per IP address.

    Returns:
        Server-Sent Events (SSE) stream with AI response chunks

    Event types:
        - status: Processing status updates
        - chunk: Individual response chunks
        - final: Complete response
        - error: Error information

    Raises:
        HTTPException 429: Rate limit exceeded
        HTTPException 404: Activity not found
        HTTPException 403: AI feature disabled or streaming not enabled
        HTTPException 504: AI processing timeout
        HTTPException 500: AI processing error
    """
    logger.info(f"AI streaming chat session start request from user {current_user.id}")

    try:
        async def event_generator():
            try:
                async for chunk in ai_start_activity_chat_session_stream(
                    request, chat_session_object, current_user, db_session
                ):
                    yield chunk
            except Exception as e:
                logger.exception(f"Error in streaming generator: {e}")
                # Yield error in SSE format
                import json
                yield f"data: {json.dumps({'type': 'error', 'error': str(e), 'error_code': 'STREAM_ERROR'})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in AI streaming endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/send/activity_chat_message_stream")
@limiter.limit("20/minute")
async def api_ai_send_activity_chat_message_stream(
    request: Request,
    chat_session_object: SendActivityAIChatMessage,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> StreamingResponse:
    """
    Send a message to AI Chat session with streaming responses (SSE).

    Rate limit: 20 requests per minute per IP address.

    Returns:
        Server-Sent Events (SSE) stream with AI response chunks

    Raises:
        HTTPException 429: Rate limit exceeded
        HTTPException 404: Activity not found
        HTTPException 403: AI feature disabled or streaming not enabled
        HTTPException 504: AI processing timeout
        HTTPException 500: AI processing error
    """
    logger.info(f"AI streaming chat message request from user {current_user.id}")

    try:
        async def event_generator():
            try:
                async for chunk in ai_send_activity_chat_message_stream(
                    request, chat_session_object, current_user, db_session
                ):
                    yield chunk
            except Exception as e:
                logger.exception(f"Error in streaming generator: {e}")
                # Yield error in SSE format
                import json
                yield f"data: {json.dumps({'type': 'error', 'error': str(e), 'error_code': 'STREAM_ERROR'})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in AI streaming endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
