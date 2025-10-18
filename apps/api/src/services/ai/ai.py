import asyncio
import logging

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.courses import Course, CourseRead
from src.db.organization_config import OrganizationConfig
from src.db.organizations import Organization
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.ai.base import ask_ai, get_chat_session_history
from src.services.ai.cache_manager import get_ai_cache_manager
from src.services.ai.exceptions import (
    ActivityNotFoundError,
    AIFeatureDisabledError,
    AIProcessingError,
    AITimeoutError,
    ChatSessionError,
    VectorStoreError,
)
from src.services.ai.schemas.ai import (
    ActivityAIChatSessionResponse,
    SendActivityAIChatMessage,
    StartActivityAIChatSession,
)
from src.services.ai.streaming import ask_ai_stream, format_sse_message
from src.services.courses.activities.utils import (
    serialize_activity_text_to_ai_comprehensible_text,
    structure_activity_content_by_type,
)

logger = logging.getLogger(__name__)


async def _get_activity_data(
    activity_uuid: str, db_session: Session
) -> tuple[ActivityRead, CourseRead, OrganizationConfig]:
    """Optimized data fetching with thread-safe caching."""

    cache_manager = get_ai_cache_manager()
    cache_key = f"activity_{activity_uuid}"

    # Check cache first
    cached_data = cache_manager.db_cache.get(cache_key)
    if cached_data:
        logger.debug(f"Cache hit for activity data: {activity_uuid}")
        return cached_data

    try:
        # Fetch with optimized single query
        statement = (
            select(Activity, Course, Organization, OrganizationConfig)
            .join(Course, Activity.course_id == Course.id)
            .join(Organization, Course.org_id == Organization.id)
            .join(OrganizationConfig, Organization.id == OrganizationConfig.org_id)
            .where(Activity.activity_uuid == activity_uuid)
        )

        result = db_session.exec(statement).first()
        if not result:
            logger.warning(f"Activity not found: {activity_uuid}")
            raise ActivityNotFoundError(activity_uuid)

        activity_db, course_db, _org_db, org_config_db = result

        # Convert to Pydantic models
        activity = ActivityRead.model_validate(activity_db)
        course = CourseRead.model_validate(course_db)
        org_config = OrganizationConfig.model_validate(org_config_db)

        # Cache the results
        data_tuple = (activity, course, org_config)
        cache_manager.db_cache.set(cache_key, data_tuple)
        logger.debug(f"Cached activity data: {activity_uuid}")

        return data_tuple

    except ActivityNotFoundError:
        raise
    except Exception as e:
        error_msg = f"Failed to fetch activity data for {activity_uuid}: {e!s}"
        logger.exception(error_msg)
        raise HTTPException(status_code=500, detail=error_msg) from e


async def ai_start_activity_chat_session(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    cancel_event: asyncio.Event | None = None,
) -> ActivityAIChatSessionResponse:
    """Optimized AI chat session start with proper error handling."""

    try:
        # Get cached activity data
        activity, course, org_config = await _get_activity_data(
            chat_session_object.activity_uuid, db_session
        )

        # Check if AI feature is enabled
        ai_enabled = (
            org_config.config.get("features", {}).get("ai", {}).get("enabled", False)
        )
        if not ai_enabled:
            msg = "activity_ask"
            raise AIFeatureDisabledError(msg, course.org_id)

        # Process content in parallel
        content_task = asyncio.to_thread(
            structure_activity_content_by_type, activity.content
        )
        chat_session_task = asyncio.to_thread(get_chat_session_history)

        structured, chat_session = await asyncio.gather(
            content_task, chat_session_task, return_exceptions=False
        )

        # Generate AI-friendly text
        isEmpty = not structured
        ai_friendly_text = serialize_activity_text_to_ai_comprehensible_text(
            structured, course, activity, isActivityEmpty=isEmpty
        )

        # Get AI configuration
        embeddings = "text-embedding-3-small"
        ai_model = org_config.config["features"]["ai"]["model"]

        # Optimized system message
        system_message = (
            f"You are a helpful Education Assistant for '{course.name}' course, "
            f"helping with the '{activity.name}' lecture. "
            "Use available tools to get context and provide accurate, helpful responses. "
            "If context is insufficient, use your knowledge to assist the student."
        )

        # Use fast AI processing
        logger.info(f"Starting AI chat session for activity {activity.activity_uuid}")

        response = await ask_ai(
            chat_session_object.message,
            chat_session["message_history"],  # Use full history for agent context
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
        )

        ai_message = response.get("output", "")
        if not ai_message:
            logger.warning("AI response is empty")
            msg = "AI returned an empty response"
            raise AIProcessingError(msg)

        logger.info(
            f"AI chat session started successfully: {chat_session['aichat_uuid']}"
        )

        return ActivityAIChatSessionResponse(
            aichat_uuid=chat_session["aichat_uuid"],
            activity_uuid=activity.activity_uuid,
            message=ai_message,
        )

    except ActivityNotFoundError as e:
        logger.warning(f"Activity not found: {e.message}")
        raise HTTPException(status_code=404, detail=e.message) from e

    except AIFeatureDisabledError as e:
        logger.warning(f"AI feature disabled: {e.message}")
        raise HTTPException(status_code=403, detail=e.message) from e

    except AITimeoutError as e:
        logger.warning(f"AI timeout: {e.message}")
        raise HTTPException(status_code=504, detail=e.message) from e

    except (AIProcessingError, VectorStoreError, ChatSessionError) as e:
        logger.error(f"AI processing error: {e.message}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"AI processing failed: {e.message}"
        ) from e

    except HTTPException:
        raise

    except Exception as e:
        error_msg = f"Unexpected error in AI chat session: {e!s}"
        logger.exception(error_msg)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later.",
        ) from e


async def ai_send_activity_chat_message(
    request: Request,
    chat_session_object: SendActivityAIChatMessage,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    cancel_event: asyncio.Event | None = None,
) -> ActivityAIChatSessionResponse:
    """Optimized AI chat message sending with proper error handling."""

    try:
        # Get cached activity data
        activity, course, org_config = await _get_activity_data(
            chat_session_object.activity_uuid, db_session
        )

        # Check if AI feature is enabled
        ai_enabled = (
            org_config.config.get("features", {}).get("ai", {}).get("enabled", False)
        )
        if not ai_enabled:
            msg = "activity_ask"
            raise AIFeatureDisabledError(msg, course.org_id)

        # Process content and get chat session in parallel
        content_task = asyncio.to_thread(
            structure_activity_content_by_type, activity.content
        )
        chat_session_task = asyncio.to_thread(
            get_chat_session_history, chat_session_object.aichat_uuid
        )

        structured, chat_session = await asyncio.gather(
            content_task, chat_session_task, return_exceptions=False
        )

        # Generate AI-friendly text
        isEmpty = not structured
        ai_friendly_text = serialize_activity_text_to_ai_comprehensible_text(
            structured, course, activity, isActivityEmpty=isEmpty
        )

        # Get AI configuration
        embeddings = "text-embedding-3-small"
        ai_model = org_config.config["features"]["ai"]["model"]

        # Optimized system message
        system_message = (
            f"You are a helpful Education Assistant for '{course.name}' course, "
            f"helping with the '{activity.name}' lecture. "
            "Use available tools to get context and provide accurate, helpful responses. "
            "If context is insufficient, use your knowledge to assist the student."
        )

        # Use fast AI processing
        logger.info(
            f"Sending AI chat message for session {chat_session_object.aichat_uuid}"
        )

        response = await ask_ai(
            chat_session_object.message,
            chat_session["message_history"],
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
        )

        ai_message = response.get("output", "")
        if not ai_message:
            logger.warning("AI response is empty")
            msg = "AI returned an empty response"
            raise AIProcessingError(msg)

        logger.info(
            f"AI chat message sent successfully: {chat_session_object.aichat_uuid}"
        )

        return ActivityAIChatSessionResponse(
            aichat_uuid=chat_session["aichat_uuid"],
            activity_uuid=activity.activity_uuid,
            message=ai_message,
        )

    except ActivityNotFoundError as e:
        logger.warning(f"Activity not found: {e.message}")
        raise HTTPException(status_code=404, detail=e.message) from e

    except AIFeatureDisabledError as e:
        logger.warning(f"AI feature disabled: {e.message}")
        raise HTTPException(status_code=403, detail=e.message) from e

    except AITimeoutError as e:
        logger.warning(f"AI timeout: {e.message}")
        raise HTTPException(status_code=504, detail=e.message) from e

    except (AIProcessingError, VectorStoreError, ChatSessionError) as e:
        logger.error(f"AI processing error: {e.message}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"AI processing failed: {e.message}"
        ) from e

    except HTTPException:
        raise

    except Exception as e:
        error_msg = f"Unexpected error sending AI chat message: {e!s}"
        logger.exception(error_msg)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later.",
        ) from e


async def ai_start_activity_chat_session_stream(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    cancel_event: asyncio.Event | None = None,
):
    """Streaming version of AI chat session start."""

    try:
        # Get cached activity data
        activity, course, org_config = await _get_activity_data(
            chat_session_object.activity_uuid, db_session
        )

        # Check if AI feature is enabled
        ai_enabled = (
            org_config.config.get("features", {}).get("ai", {}).get("enabled", False)
        )
        if not ai_enabled:
            msg = "activity_ask"
            raise AIFeatureDisabledError(msg, course.org_id)

        # Check if streaming is enabled
        streaming_enabled = (
            org_config.config.get("features", {})
            .get("ai", {})
            .get("streaming_enabled", True)
        )
        if not streaming_enabled:
            logger.info("Streaming disabled, falling back to regular response")
            # Fall back to non-streaming version
            response = await ai_start_activity_chat_session(
                request, chat_session_object, current_user, db_session
            )
            yield format_sse_message(
                {
                    "type": "final",
                    "aichat_uuid": response.aichat_uuid,
                    "activity_uuid": response.activity_uuid,
                    "message": response.message,
                }
            )
            return

        # Process content in parallel
        content_task = asyncio.to_thread(
            structure_activity_content_by_type, activity.content
        )
        chat_session_task = asyncio.to_thread(get_chat_session_history)

        structured, chat_session = await asyncio.gather(
            content_task, chat_session_task, return_exceptions=False
        )

        # Generate AI-friendly text
        isEmpty = not structured
        ai_friendly_text = serialize_activity_text_to_ai_comprehensible_text(
            structured, course, activity, isActivityEmpty=isEmpty
        )

        # Get AI configuration
        embeddings = "text-embedding-3-small"
        ai_model = org_config.config["features"]["ai"]["model"]

        # Optimized system message
        system_message = (
            f"You are a helpful Education Assistant for '{course.name}' course, "
            f"helping with the '{activity.name}' lecture. "
            "Use available tools to get context and provide accurate, helpful responses. "
            "If context is insufficient, use your knowledge to assist the student."
        )

        # Send status update
        yield format_sse_message(
            {
                "type": "status",
                "status": "processing",
                "aichat_uuid": chat_session["aichat_uuid"],
            }
        )

        # Stream AI responses immediately
        logger.info(f"Streaming AI chat session for activity {activity.activity_uuid}")

        async for chunk in ask_ai_stream(
            chat_session_object.message,
            chat_session[
                "message_history"
            ],  # pass the history object expected by RunnableWithMessageHistory
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
        ):
            # ask_ai_stream now yields SSE-formatted strings
            yield chunk

        logger.info(
            f"Streaming AI chat session completed: {chat_session['aichat_uuid']}"
        )

    except ActivityNotFoundError as e:
        logger.warning(f"Activity not found: {e.message}")
        yield format_sse_message(
            {
                "type": "error",
                "error": e.message,
                "status": 404,
            }
        )

    except AIFeatureDisabledError as e:
        logger.warning(f"AI feature disabled: {e.message}")
        yield format_sse_message(
            {
                "type": "error",
                "error": e.message,
                "status": 403,
            }
        )

    except AITimeoutError as e:
        logger.warning(f"AI timeout: {e.message}")
        yield format_sse_message(
            {
                "type": "error",
                "error": e.message,
                "status": 504,
            }
        )

    except (AIProcessingError, VectorStoreError, ChatSessionError) as e:
        logger.error(f"AI processing error: {e.message}", exc_info=True)
        yield format_sse_message(
            {
                "type": "error",
                "error": f"AI processing failed: {e.message}",
                "status": 500,
            }
        )

    except Exception as e:
        error_msg = f"Unexpected error in streaming AI chat session: {e!s}"
        logger.exception(error_msg)
        yield format_sse_message(
            {
                "type": "error",
                "error": "An unexpected error occurred. Please try again later.",
                "status": 500,
            }
        )


async def ai_send_activity_chat_message_stream(
    request: Request,
    chat_session_object: SendActivityAIChatMessage,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    cancel_event: asyncio.Event | None = None,
):
    """Streaming version of AI chat message sending."""

    try:
        # Get cached activity data
        activity, course, org_config = await _get_activity_data(
            chat_session_object.activity_uuid, db_session
        )

        # Check if AI feature is enabled
        ai_enabled = (
            org_config.config.get("features", {}).get("ai", {}).get("enabled", False)
        )
        if not ai_enabled:
            msg = "activity_ask"
            raise AIFeatureDisabledError(msg, course.org_id)

        # Check if streaming is enabled
        streaming_enabled = (
            org_config.config.get("features", {})
            .get("ai", {})
            .get("streaming_enabled", True)
        )
        if not streaming_enabled:
            logger.info("Streaming disabled, falling back to regular response")
            # Fall back to non-streaming version
            response = await ai_send_activity_chat_message(
                request, chat_session_object, current_user, db_session
            )
            yield format_sse_message(
                {
                    "type": "final",
                    "aichat_uuid": response.aichat_uuid,
                    "activity_uuid": response.activity_uuid,
                    "message": response.message,
                }
            )
            return

        # Process content and get chat session in parallel
        content_task = asyncio.to_thread(
            structure_activity_content_by_type, activity.content
        )
        chat_session_task = asyncio.to_thread(
            get_chat_session_history, chat_session_object.aichat_uuid
        )

        structured, chat_session = await asyncio.gather(
            content_task, chat_session_task, return_exceptions=False
        )

        # Generate AI-friendly text
        isEmpty = not structured
        ai_friendly_text = serialize_activity_text_to_ai_comprehensible_text(
            structured, course, activity, isActivityEmpty=isEmpty
        )

        # Get AI configuration
        embeddings = "text-embedding-3-small"
        ai_model = org_config.config["features"]["ai"]["model"]

        # Optimized system message
        system_message = (
            f"You are a helpful Education Assistant for '{course.name}' course, "
            f"helping with the '{activity.name}' lecture. "
            "Use available tools to get context and provide accurate, helpful responses. "
            "If context is insufficient, use your knowledge to assist the student."
        )

        # Send status update
        yield format_sse_message(
            {
                "type": "status",
                "status": "processing",
                "aichat_uuid": chat_session_object.aichat_uuid,
            }
        )

        # Stream AI responses immediately
        logger.info(f"Streaming AI message: {chat_session_object.aichat_uuid}")

        async for chunk in ask_ai_stream(
            chat_session_object.message,
            chat_session[
                "message_history"
            ],  # pass the history object expected by RunnableWithMessageHistory
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
        ):
            yield chunk

        logger.info(
            f"Streaming AI chat message completed: {chat_session_object.aichat_uuid}"
        )

    except ActivityNotFoundError as e:
        logger.warning(f"Activity not found: {e.message}")
        yield format_sse_message(
            {
                "type": "error",
                "error": e.message,
                "status": 404,
            }
        )

    except AIFeatureDisabledError as e:
        logger.warning(f"AI feature disabled: {e.message}")
        yield format_sse_message(
            {
                "type": "error",
                "error": e.message,
                "status": 403,
            }
        )

    except AITimeoutError as e:
        logger.warning(f"AI timeout: {e.message}")
        yield format_sse_message(
            {
                "type": "error",
                "error": e.message,
                "status": 504,
            }
        )

    except (AIProcessingError, VectorStoreError, ChatSessionError) as e:
        logger.error(f"AI processing error: {e.message}", exc_info=True)
        yield format_sse_message(
            {
                "type": "error",
                "error": f"AI processing failed: {e.message}",
                "status": 500,
            }
        )

    except Exception as e:
        error_msg = f"Unexpected error in streaming AI chat message: {e!s}"
        logger.exception(error_msg)
        yield format_sse_message(
            {
                "type": "error",
                "error": "An unexpected error occurred. Please try again later.",
                "status": 500,
            }
        )
