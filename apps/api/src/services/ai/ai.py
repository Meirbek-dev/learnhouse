import asyncio

from fastapi import Depends, HTTPException, Request
from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.courses import Course, CourseRead
from src.db.organization_config import OrganizationConfig
from src.db.organizations import Organization
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.ai.base import ask_ai_fast, get_chat_session_history
from src.services.ai.schemas.ai import (
    ActivityAIChatSessionResponse,
    SendActivityAIChatMessage,
    StartActivityAIChatSession,
)
from src.services.courses.activities.utils import (
    serialize_activity_text_to_ai_comprehensible_text,
    structure_activity_content_by_type,
)

# Cache for database queries
_activity_cache: dict[str, ActivityRead] = {}
_course_cache: dict[str, CourseRead] = {}
_org_config_cache: dict[int, OrganizationConfig] = {}


async def _get_activity_data(
    activity_uuid: str, db_session: Session
) -> tuple[ActivityRead, CourseRead, OrganizationConfig]:
    """Optimized data fetching with caching."""

    # Check cache first
    if activity_uuid in _activity_cache:
        activity = _activity_cache[activity_uuid]
        course = _course_cache.get(str(activity.course_id))
        if course:
            org_config = _org_config_cache.get(course.org_id)
            if org_config:
                return activity, course, org_config

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
        raise HTTPException(status_code=404, detail="Activity not found")

    activity_db, course_db, org_db, org_config_db = result

    # Convert to Pydantic models
    activity = ActivityRead.model_validate(activity_db)
    course = CourseRead.model_validate(course_db)
    org_config = OrganizationConfig.model_validate(org_config_db)

    # Cache the results
    _activity_cache[activity_uuid] = activity
    _course_cache[str(activity.course_id)] = course
    _org_config_cache[course.org_id] = org_config

    return activity, course, org_config


async def ai_start_activity_chat_session(
    request: Request,
    chat_session_object: StartActivityAIChatSession,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> ActivityAIChatSessionResponse:
    """Optimized AI chat session start."""

    try:
        # Get cached activity data
        activity, course, org_config = await _get_activity_data(
            chat_session_object.activity_uuid, db_session
        )

        # Process content in parallel
        content_task = asyncio.to_thread(
            structure_activity_content_by_type, activity.content
        )
        chat_session_task = asyncio.to_thread(get_chat_session_history)

        structured, chat_session = await asyncio.gather(content_task, chat_session_task)

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
        response = await ask_ai_fast(
            chat_session_object.message,
            chat_session["message_history"],
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
        )

        if "error" in response:
            raise HTTPException(
                status_code=500,
                detail=f"AI processing failed: {response['error']}",
            )

        ai_message = response.get("output", "")
        if not ai_message:
            raise HTTPException(
                status_code=500,
                detail="AI response is empty",
            )

        return ActivityAIChatSessionResponse(
            aichat_uuid=chat_session["aichat_uuid"],
            activity_uuid=activity.activity_uuid,
            message=ai_message,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {e!s}",
        )


async def ai_send_activity_chat_message(
    request: Request,
    chat_session_object: SendActivityAIChatMessage,
    current_user: PublicUser = Depends(get_current_user),
    db_session: Session = Depends(get_db_session),
) -> ActivityAIChatSessionResponse:
    """Optimized AI chat message sending."""

    try:
        # Get cached activity data
        activity, course, org_config = await _get_activity_data(
            chat_session_object.activity_uuid, db_session
        )

        # Process content and get chat session in parallel
        content_task = asyncio.to_thread(
            structure_activity_content_by_type, activity.content
        )
        chat_session_task = asyncio.to_thread(
            get_chat_session_history, chat_session_object.aichat_uuid
        )

        structured, chat_session = await asyncio.gather(content_task, chat_session_task)

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
        response = await ask_ai_fast(
            chat_session_object.message,
            chat_session["message_history"],
            ai_friendly_text,
            system_message,
            embeddings,
            ai_model,
            session_id=chat_session["aichat_uuid"],
        )

        if "error" in response:
            raise HTTPException(
                status_code=500,
                detail=f"AI processing failed: {response['error']}",
            )

        ai_message = response.get("output", "")
        if not ai_message:
            raise HTTPException(
                status_code=500,
                detail="AI response is empty",
            )

        return ActivityAIChatSessionResponse(
            aichat_uuid=chat_session["aichat_uuid"],
            activity_uuid=activity.activity_uuid,
            message=ai_message,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {e!s}",
        )
