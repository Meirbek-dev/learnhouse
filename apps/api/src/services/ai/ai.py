import asyncio
import logging
import time

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select
from src.security.permissions.exceptions import PermissionDenied

from src.core.events.database import get_db_session
from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.courses import Course, CourseRead
from src.db.organization_config import OrganizationConfig
from src.db.organizations import Organization
from src.db.permissions.generated_enums import Action, ResourceType
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
    """Optimized data fetching with thread-safe caching and parallel queries."""

    cache_manager = get_ai_cache_manager()
    cache_key = f"activity_{activity_uuid}"

    # Check cache first
    cached_data = cache_manager.db_cache.get(cache_key)
    if cached_data:
        logger.info(f"✓ Cache HIT for activity data: {activity_uuid}")
        return cached_data

    try:
        # Query activity first (required for subsequent queries)
        def get_activity():
            activity_query = select(Activity).where(
                Activity.activity_uuid == activity_uuid
            )
            result = db_session.exec(activity_query)
            return result.first()

        activity = await asyncio.to_thread(get_activity)

        if not activity:
            error_msg = f"Activity {activity_uuid} not found"
            logger.warning(error_msg)
            raise ActivityNotFoundError(activity_uuid)

        # Fetch course
        course = await asyncio.to_thread(db_session.get, Course, activity.course_id)

        if not course:
            error_msg = f"Course {activity.course_id} not found"
            logger.warning(error_msg)
            raise ActivityNotFoundError(
                activity_uuid, details={"course_not_found": True}
            )

        # Fetch org_config
        def get_org_config():
            org_config_query = select(OrganizationConfig).where(
                OrganizationConfig.org_id == course.org_id
            )
            result = db_session.exec(org_config_query)
            return result.first()

        org_config = await asyncio.to_thread(get_org_config)

        if not org_config:
            error_msg = f"Organization config not found for org {course.org_id}"
            logger.warning(error_msg)
            raise ActivityNotFoundError(
                activity_uuid, details={"org_config_not_found": True}
            )

        # Cache for 5 minutes
        result = (activity, course, org_config)
        cache_manager.db_cache.set(cache_key, result)
        logger.info(f"✓ Cached activity data for {activity_uuid}")

        return result

    except ActivityNotFoundError:
        raise
    except Exception as e:
        error_msg = f"Failed to fetch activity data: {e!s}"
        logger.exception(error_msg)
        raise ActivityNotFoundError(
            activity_uuid, details={"error": str(e), "type": type(e).__name__}
        ) from e


async def ai_start_activity_chat_session(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
    cancel_event: asyncio.Event | None = None,
) -> ActivityAIChatSessionResponse:
    """Optimized AI chat session start with proper error handling."""

    try:
        trace_start = time.perf_counter()
        # Get cached activity data
        data_fetch_start = time.perf_counter()
        activity, course, org_config = await _get_activity_data(
            chat_session_object.activity_uuid, db_session
        )
        logger.debug(
            f"Data fetch took {(time.perf_counter() - data_fetch_start) * 1000:.1f}ms"
        )

        # Check if AI feature is enabled
        ai_enabled = (
            org_config.config.get("features", {}).get("ai", {}).get("enabled", False)
        )
        if not ai_enabled:
            msg = "activity_ask"
            raise AIFeatureDisabledError(msg, course.org_id)

        # Process content in parallel
        content_process_start = time.perf_counter()
        content_task = asyncio.to_thread(
            structure_activity_content_by_type, activity.content
        )
        chat_session_task = asyncio.to_thread(get_chat_session_history)

        structured, chat_session = await asyncio.gather(
            content_task, chat_session_task, return_exceptions=False
        )
        logger.debug(
            f"Content processing took {(time.perf_counter() - content_process_start) * 1000:.1f}ms"
        )

        # Generate AI-friendly text
        isEmpty = not structured
        ai_friendly_text = serialize_activity_text_to_ai_comprehensible_text(
            structured, course, activity, isActivityEmpty=isEmpty
        )

        # Get AI configuration
        embeddings = "text-embedding-3-small"
        ai_model = org_config.config["features"]["ai"]["model"]

        # Optimized system message with explicit tool usage guidance
        system_message = (
            f"You are a helpful Education Assistant for '{course.name}' course, "
            f"helping with the '{activity.name}' lecture. "
            "Use the find_context_text tool ONCE to get relevant context, then provide your response immediately. "
            "Be efficient: retrieve context first, then answer directly without additional tool calls. "
            "If context is insufficient, use your knowledge to assist the student."
        )

        # Use fast AI processing
        logger.info(f"Starting AI chat session for activity {activity.activity_uuid}")
        ai_process_start = time.perf_counter()

        response = await ask_ai(
            chat_session_object.message,
            chat_session["windowed_history"],
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
            collection_name=f"activity_{activity.activity_uuid}",
        )

        ai_process_time = (time.perf_counter() - ai_process_start) * 1000
        logger.info(f"AI processing took {ai_process_time:.1f}ms")

        ai_message = response.get("output", "")
        if not ai_message:
            logger.warning("AI response is empty")
            msg = "AI returned an empty response"
            raise AIProcessingError(msg)

        total_time = (time.perf_counter() - trace_start) * 1000
        logger.info(
            "AI chat session %s completed in %.1fms (AI: %.1fms, overhead: %.1fms)",
            chat_session["aichat_uuid"],
            total_time,
            ai_process_time,
            total_time - ai_process_time,
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
        raise PermissionDenied(
            Action.USE, ResourceType.AI_FEATURE, reason=e.message
        ) from e

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
        trace_start = time.perf_counter()
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

        # Optimized system message with explicit tool usage guidance
        system_message = (
            f"You are a helpful Education Assistant for '{course.name}' course, "
            f"helping with the '{activity.name}' lecture. "
            "Use the find_context_text tool ONCE to get relevant context, then provide your response immediately. "
            "Be efficient: retrieve context first, then answer directly without additional tool calls. "
            "If context is insufficient, use your knowledge to assist the student."
        )

        # Use fast AI processing
        logger.info(
            f"Sending AI chat message for session {chat_session_object.aichat_uuid}"
        )

        response = await ask_ai(
            chat_session_object.message,
            chat_session["windowed_history"],
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
            collection_name=f"activity_{activity.activity_uuid}",
        )

        ai_message = response.get("output", "")
        if not ai_message:
            logger.warning("AI response is empty")
            msg = "AI returned an empty response"
            raise AIProcessingError(msg)

        logger.info(
            "AI chat message %s completed in %.1fms",
            chat_session_object.aichat_uuid,
            (time.perf_counter() - trace_start) * 1000,
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
        raise PermissionDenied(
            Action.USE, ResourceType.AI_FEATURE, reason=e.message
        ) from e

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
            chat_session["windowed_history"],
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
            collection_name=f"activity_{activity.activity_uuid}",
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
            chat_session["windowed_history"],
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
            cancel_event=cancel_event,
            collection_name=f"activity_{activity.activity_uuid}",
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
