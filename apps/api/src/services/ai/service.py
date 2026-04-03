import asyncio
import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from fastapi import Request
from sqlmodel import Session, select

from config.config import get_settings
from src.db.courses.activities import Activity, ActivityRead
from src.db.courses.courses import Course, CourseRead
from src.services.ai.agent import get_agent, get_model
from src.services.ai.cache_manager import get_ai_cache_manager
from src.services.ai.exceptions import AIProcessingError, AITimeoutError, ActivityNotFoundError, RetrievalError
from src.services.ai.models import AgentAnswer, AgentDependencies, DeltaEvent, FinalEvent, StatusEvent
from src.services.ai.retrieval import retrieve_chunks
from src.services.ai.schemas.ai import ActivityAIChatSessionResponse
from src.services.ai.session_store import append_messages, build_chat_messages, load_chat_session
from src.services.courses.activities.utils import (
    serialize_activity_text_to_ai_comprehensible_text,
    structure_activity_content_by_type,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class _ChatContext:
    activity: ActivityRead
    course: CourseRead
    documents: list[str]
    session_id: str
    session_history: list
    user_id: int | None
    request_id: str | None


async def _get_activity_data(
    activity_uuid: str,
    db_session: Session,
) -> tuple[ActivityRead, CourseRead]:
    cache_manager = get_ai_cache_manager()
    cache_key = f"activity_{activity_uuid}"
    cached_pair = cache_manager.db_cache.get(cache_key)
    if cached_pair:
        logger.info("Activity data cache HIT: %s", activity_uuid)
        return cached_pair

    try:
        activity = db_session.exec(
            select(Activity).where(Activity.activity_uuid == activity_uuid)
        ).first()
        if not activity:
            raise ActivityNotFoundError(activity_uuid)

        course = db_session.get(Course, activity.course_id)
        if not course:
            raise ActivityNotFoundError(activity_uuid, details={"course_not_found": True})

        cache_manager.db_cache.set(cache_key, (activity, course))
        return activity, course
    except (ActivityNotFoundError, RetrievalError):
        raise
    except Exception as exc:
        raise ActivityNotFoundError(
            activity_uuid,
            details={"error": str(exc), "type": type(exc).__name__},
        ) from exc


async def _get_documents(
    activity_uuid: str,
    activity: ActivityRead,
    course: CourseRead,
) -> list[str]:
    cache_manager = get_ai_cache_manager()
    context_text_key = f"context_text_{activity_uuid}"
    cached_documents = cache_manager.db_cache.get(context_text_key)
    if cached_documents:
        logger.debug("Context text cache HIT: %s", activity_uuid)
        return cached_documents

    structured = await asyncio.to_thread(
        structure_activity_content_by_type,
        activity.content,
    )
    ai_text = serialize_activity_text_to_ai_comprehensible_text(
        structured,
        course,
        activity,
        isActivityEmpty=not structured,
    )
    documents = structured or [ai_text]
    cache_manager.db_cache.set(context_text_key, documents)
    logger.debug("Context text cache MISS: %s — cached", activity_uuid)
    return documents


async def build_chat_context(
    *,
    activity_uuid: str,
    aichat_uuid: str | None,
    db_session: Session,
    user_id: int | None,
    request: Request | None,
) -> _ChatContext:
    activity, course = await _get_activity_data(activity_uuid, db_session)
    documents = await _get_documents(activity_uuid, activity, course)
    session_window = await asyncio.to_thread(load_chat_session, aichat_uuid, user_id)
    request_id = request.headers.get("x-request-id") if request else None

    return _ChatContext(
        activity=activity,
        course=course,
        documents=documents,
        session_id=session_window.session_id,
        session_history=session_window.to_model_messages(),
        user_id=user_id,
        request_id=request_id,
    )


def _build_agent_deps(ctx: _ChatContext, retrieved_chunks: list) -> AgentDependencies:
    return AgentDependencies(
        activity_uuid=ctx.activity.activity_uuid,
        activity_name=ctx.activity.name,
        course_name=ctx.course.name,
        session_id=ctx.session_id,
        user_id=ctx.user_id,
        request_id=ctx.request_id,
        retrieved_chunks=retrieved_chunks,
    )


async def generate_chat_answer(
    *,
    ctx: _ChatContext,
    question: str,
    cancel_event: asyncio.Event | None = None,
) -> AgentAnswer:
    if not question or not question.strip():
        raise AIProcessingError("Question cannot be empty")

    settings = get_settings().ai_config
    timeout_seconds = settings.request_timeout

    if cancel_event and cancel_event.is_set():
        raise AIProcessingError("AI processing cancelled before execution")

    try:
        async with asyncio.timeout(timeout_seconds):
            retrieved_chunks = await retrieve_chunks(
                query=question.strip(),
                documents=ctx.documents,
                embedding_model_name=settings.embedding_model,
                collection_name=f"activity_{ctx.activity.activity_uuid}",
            )

            deps = _build_agent_deps(ctx, retrieved_chunks)
            result = await get_agent().run(
                question.strip(),
                deps=deps,
                model=get_model(),
                message_history=ctx.session_history,
            )
    except TimeoutError as exc:
        raise AITimeoutError(timeout_seconds, details={"activity_uuid": ctx.activity.activity_uuid}) from exc
    except ActivityNotFoundError:
        raise
    except (AITimeoutError, RetrievalError):
        raise
    except Exception as exc:
        raise AIProcessingError(
            f"Unexpected error during AI processing: {exc!s}",
            details={"error_type": type(exc).__name__, "session_id": ctx.session_id},
        ) from exc

    output = result.output.strip()
    if not output:
        raise AIProcessingError("AI returned an empty response")

    append_messages(
        ctx.session_id,
        build_chat_messages(
            question=question.strip(),
            answer=output,
            activity_uuid=ctx.activity.activity_uuid,
            user_id=ctx.user_id,
            request_id=ctx.request_id,
        ),
    )

    model_response = result.all_messages()[-1] if result.all_messages() else None
    finish_reason = getattr(model_response, "finish_reason", None)
    model_name = getattr(model_response, "model_name", None)
    return AgentAnswer(
        message=output,
        chunk_count=len(retrieved_chunks),
        finish_reason=None if finish_reason is None else str(finish_reason),
        model_name=model_name,
    )


async def stream_chat_answer(
    *,
    ctx: _ChatContext,
    question: str,
    cancel_event: asyncio.Event | None = None,
) -> AsyncGenerator[StatusEvent | DeltaEvent | FinalEvent, None]:
    if not question or not question.strip():
        raise AIProcessingError("Question cannot be empty")

    settings = get_settings().ai_config
    timeout_seconds = settings.request_timeout

    yield StatusEvent(
        status="processing",
        aichat_uuid=ctx.session_id,
        activity_uuid=ctx.activity.activity_uuid,
    )
    yield StatusEvent(
        status="retrieving",
        aichat_uuid=ctx.session_id,
        activity_uuid=ctx.activity.activity_uuid,
    )

    try:
        async with asyncio.timeout(timeout_seconds):
            retrieved_chunks = await retrieve_chunks(
                query=question.strip(),
                documents=ctx.documents,
                embedding_model_name=settings.embedding_model,
                collection_name=f"activity_{ctx.activity.activity_uuid}",
            )
            deps = _build_agent_deps(ctx, retrieved_chunks)

            yield StatusEvent(
                status="generating",
                aichat_uuid=ctx.session_id,
                activity_uuid=ctx.activity.activity_uuid,
            )

            full_response = ""
            chunk_id = 0
            async with get_agent().run_stream(
                question.strip(),
                deps=deps,
                model=get_model(),
                message_history=ctx.session_history,
            ) as result:
                async for delta in result.stream_text(delta=True, debounce_by=None):
                    if cancel_event and cancel_event.is_set():
                        yield StatusEvent(
                            status="aborted",
                            aichat_uuid=ctx.session_id,
                            activity_uuid=ctx.activity.activity_uuid,
                            message="Request cancelled",
                        )
                        return

                    if not delta:
                        continue
                    chunk_id += 1
                    full_response += delta
                    yield DeltaEvent(content=delta, chunk_id=chunk_id)

                output = (await result.get_output()).strip()
                if output and output != full_response:
                    full_response = output

    except TimeoutError as exc:
        raise AITimeoutError(timeout_seconds, details={"activity_uuid": ctx.activity.activity_uuid}) from exc
    except AITimeoutError:
        raise
    except Exception as exc:
        raise AIProcessingError(
            f"Unexpected error during AI streaming: {exc!s}",
            details={"error_type": type(exc).__name__, "session_id": ctx.session_id},
        ) from exc

    if not full_response:
        raise AIProcessingError("AI returned an empty response")

    append_messages(
        ctx.session_id,
        build_chat_messages(
            question=question.strip(),
            answer=full_response,
            activity_uuid=ctx.activity.activity_uuid,
            user_id=ctx.user_id,
            request_id=ctx.request_id,
        ),
    )

    yield FinalEvent(
        content=full_response,
        aichat_uuid=ctx.session_id,
        activity_uuid=ctx.activity.activity_uuid,
        chunk_count=chunk_id,
    )


async def run_activity_chat(
    *,
    activity_uuid: str,
    aichat_uuid: str | None,
    message: str,
    db_session: Session,
    user_id: int | None,
    request: Request | None,
    cancel_event: asyncio.Event | None = None,
) -> ActivityAIChatSessionResponse:
    trace_start = time.perf_counter()
    ctx = await build_chat_context(
        activity_uuid=activity_uuid,
        aichat_uuid=aichat_uuid,
        db_session=db_session,
        user_id=user_id,
        request=request,
    )
    answer = await generate_chat_answer(ctx=ctx, question=message, cancel_event=cancel_event)
    logger.info(
        "AI chat %s completed in %.1fms",
        ctx.session_id,
        (time.perf_counter() - trace_start) * 1000,
    )
    return ActivityAIChatSessionResponse(
        aichat_uuid=ctx.session_id,
        activity_uuid=ctx.activity.activity_uuid,
        message=answer.message,
    )


async def run_activity_chat_stream(
    *,
    activity_uuid: str,
    aichat_uuid: str | None,
    message: str,
    db_session: Session,
    user_id: int | None,
    request: Request | None,
    cancel_event: asyncio.Event | None = None,
) -> AsyncGenerator[StatusEvent | DeltaEvent | FinalEvent, None]:
    ctx = await build_chat_context(
        activity_uuid=activity_uuid,
        aichat_uuid=aichat_uuid,
        db_session=db_session,
        user_id=user_id,
        request=request,
    )
    async for event in stream_chat_answer(
        ctx=ctx,
        question=message,
        cancel_event=cancel_event,
    ):
        yield event
