"""
Streaming AI response support for real-time user feedback.
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from langchain.agents import AgentExecutor
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

from src.services.ai.exceptions import (
    AIProcessingError,
    AITimeoutError,
    VectorStoreError,
)

logger = logging.getLogger(__name__)


async def ask_ai_stream(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
    agent_executor: AgentExecutor | None = None,
    cancel_event: asyncio.Event | None = None,
    collection_name: str | None = None,
) -> AsyncGenerator[dict[str, Any]]:
    """
    Stream AI responses for better perceived performance.

    Yields chunks of the response as they're generated, providing
    real-time feedback to users instead of waiting for complete response.

    Args:
        question: User's question
        message_history: Chat history for context
        text_reference: Reference text for RAG
        message_for_the_prompt: System prompt
        embedding_model_name: Embedding model to use
        openai_model_name: LLM model to use
        session_id: Session identifier
        agent_executor: Pre-created agent executor (optional)

    Yields:
        Dictionary chunks with response data

    Raises:
        AIProcessingError: If processing fails
        AITimeoutError: If processing times out
        VectorStoreError: If vector store operation fails
    """
    if not question or not question.strip():
        error_msg = "Question cannot be empty"
        logger.warning(error_msg)
        raise AIProcessingError(error_msg)

    if not text_reference or not text_reference.strip():
        error_msg = "Text reference cannot be empty"
        logger.warning(error_msg)
        raise AIProcessingError(error_msg)

    try:
        # If no agent provided, create one
        if agent_executor is None:
            from src.services.ai.base import FastAIService

            ai_service = FastAIService()

            # Get or create vector store
            vector_store = await ai_service.get_or_create_vector_store(
                documents=[text_reference],
                embedding_model_name=embedding_model_name,
                collection_name=collection_name,
            )

            if not vector_store:
                msg = "Failed to create knowledge base"
                raise VectorStoreError(msg)

            # Get or create agent (cached)
            agent_executor = await ai_service.get_or_create_agent(
                llm_model_name=openai_model_name,
                system_prompt=message_for_the_prompt,
                vector_store=vector_store,
            )

            if not agent_executor:
                msg = "Failed to create AI agent"
                raise AIProcessingError(msg)

        # Create agent with history
        agent_with_history = RunnableWithMessageHistory(
            agent_executor,
            lambda session_id: message_history,
            input_messages_key="input",
            history_messages_key="chat_history",
        )

        logger.info(f"Starting streaming AI query: {question[:100]}...")

        # Stream response chunks
        chunk_count = 0
        full_response = ""
        start_time = time.perf_counter()
        first_chunk_time: float | None = None

        # Send initial status as SSE string
        yield format_sse_message(
            {"type": "status", "status": "processing", "message": "Думаю..."}
        )

        try:
            # Process with streaming and timeout using asyncio.timeout
            async with asyncio.timeout(60.0):  # Increased timeout for complex operations (agent has 45s max_execution_time)
                async for event in agent_with_history.astream_events(
                    {"input": question.strip()},
                    config={
                        "configurable": {"session_id": session_id},
                        "run_name": "ai_streaming",
                    },
                    version="v2",  # Use v2 for better streaming performance
                ):
                    # Handle different event types
                    event_type = event.get("event", "")

                    # Debug logging to understand what events we're receiving
                    if event_type in [
                        "on_chat_model_stream",
                        "on_llm_new_token",
                        "on_chain_end",
                    ]:
                        event_name = event.get("name", "")
                        logger.debug(f"Event: {event_type}, Name: {event_name}")

                    # Stream LLM tokens immediately as they arrive
                    # Try multiple event types for compatibility
                    # Check cancellation at the top of the loop to abort promptly
                    if cancel_event and cancel_event.is_set():
                        logger.info(
                            "ask_ai_stream: cancellation requested, aborting stream"
                        )
                        yield format_sse_message(
                            {
                                "type": "status",
                                "status": "aborted",
                                "message": "Request cancelled",
                            }
                        )
                        return

                    if event_type == "on_chat_model_stream":
                        chunk = event.get("data", {}).get("chunk")
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            chunk_count += 1
                            if first_chunk_time is None:
                                first_chunk_time = time.perf_counter()
                            full_response += chunk.content
                            yield format_sse_message(
                                {
                                    "type": "chunk",
                                    "content": chunk.content,
                                    "chunk_id": chunk_count,
                                }
                            )

                    # Alternative streaming event type
                    elif event_type == "on_llm_new_token":
                        token = event.get("data", {}).get("chunk")
                        if token:
                            chunk_count += 1
                            if first_chunk_time is None:
                                first_chunk_time = time.perf_counter()
                            full_response += str(token)
                            yield format_sse_message(
                                {
                                    "type": "chunk",
                                    "content": str(token),
                                    "chunk_id": chunk_count,
                                }
                            )

                    # Handle tool outputs for context
                    elif event_type == "on_tool_start":
                        # Send indicator that tool is being used
                        yield format_sse_message(
                            {
                                "type": "status",
                                "status": "retrieving_context",
                                "message": "Ищу релевантную информацию...",
                            }
                        )

                    elif event_type == "on_tool_end":
                        # Send a subtle indicator that context was retrieved
                        yield format_sse_message(
                            {
                                "type": "status",
                                "status": "context_retrieved",
                                "message": "Анализирую контекст...",
                            }
                        )

                    # Capture ONLY the final AgentExecutor output if streaming didn't work
                    elif event_type == "on_chain_end":
                        # Check if this is the final agent output (not intermediate tool calls)
                        event_name = event.get("name", "")

                        # Only process AgentExecutor's final output
                        if "AgentExecutor" not in event_name:
                            continue

                        # Inspect the chain output payload and try to extract
                        # a final text answer. Some agents/tooling return a
                        # dict, some return a string, and some return lists
                        # of Message objects.
                        output_data = event.get("data", {}).get("output", {})

                        # Log the actual output structure for debugging
                        logger.debug(f"Chain end output_data type: {type(output_data)}, value: {str(output_data)[:200]}")

                        # Extract the actual text output in a tolerant way
                        output_text = ""
                        if isinstance(output_data, dict):
                            output_text = (
                                output_data.get("output")
                                or output_data.get("text")
                                or output_data.get("answer")
                                or output_data.get("result")  # Try 'result' key as well
                                or ""
                            )
                        elif isinstance(output_data, str):
                            output_text = output_data
                        elif isinstance(output_data, list) and output_data:
                            # Handle list of messages - extract content from last message
                            last_item = output_data[-1]
                            if hasattr(last_item, 'content'):
                                output_text = last_item.content
                            elif isinstance(last_item, dict):
                                output_text = last_item.get('content', '')

                        # Only use this fallback if:
                        # 1. We haven't streamed anything yet
                        # 2. The output is actual text (not empty, not "[]", not intermediate data)
                        if (
                            output_text
                            and chunk_count == 0
                            and output_text.strip()
                            and output_text not in ["[]", "{}", "None", ""]
                        ):
                            logger.warning(
                                "No streaming chunks received, using final output from chain_end"
                            )
                            full_response = output_text
                            # Yield the full response as a single chunk
                            yield format_sse_message(
                                {"type": "chunk", "content": output_text, "chunk_id": 1}
                            )
                            chunk_count = 1

            # Send final response after loop completes so clients can
            # finalize UI state (stop spinners) and persist session id.
            # Include assembled full response and metadata.

            # If we didn't get any chunks, it means the agent stopped without generating output
            if chunk_count == 0:
                logger.error("Agent completed but produced no output - likely hit max_iterations without generating answer")
                error_msg = "AI assistant couldn't generate a response. The query may be too complex or the context too large. Please try with a shorter text or simpler question."
                yield format_sse_message(
                    {"type": "error", "error": error_msg, "error_code": "NO_OUTPUT"}
                )
                return

            try:
                yield format_sse_message(
                    {
                        "type": "final",
                        "content": full_response,
                        "chunk_count": chunk_count,
                        "aichat_uuid": session_id,
                    }
                )
            except Exception:
                # In rare cases the client may have disconnected between
                # the last chunk and the final publication; ignore failures
                # here but still log the completion for observability.
                logger.debug(
                    "Unable to yield final SSE message to client (client disconnected?)"
                )

            total_ms = (time.perf_counter() - start_time) * 1000
            ttfb_ms = (
                (first_chunk_time - start_time) * 1000
                if first_chunk_time is not None
                else total_ms
            )
            logger.info(
                "Streaming query completed: %s chunks, TTFB=%.1fms, total=%.1fms",
                chunk_count,
                ttfb_ms,
                total_ms,
            )

        except TimeoutError as e:
            error_msg = "AI processing timed out after 60 seconds"
            logger.warning(error_msg)
            yield format_sse_message(
                {"type": "error", "error": error_msg, "error_code": "TIMEOUT"}
            )
            raise AITimeoutError(60, details={"question_length": len(question)}) from e

    except (AIProcessingError, VectorStoreError, AITimeoutError):
        raise
    except Exception as e:
        error_msg = f"Unexpected error during AI streaming: {e!s}"
        logger.exception(error_msg)
        yield format_sse_message(
            {"type": "error", "error": error_msg, "error_code": "PROCESSING_ERROR"}
        )
        raise AIProcessingError(
            error_msg,
            details={"error_type": type(e).__name__, "session_id": session_id},
        ) from e


def format_sse_message(data: dict[str, Any]) -> str:
    """
    Format data as Server-Sent Events (SSE) message.

    Args:
        data: Data to send

    Returns:
        Formatted SSE message string
    """
    # Use ensure_ascii=False to preserve unicode, and replace any lone newlines in
    # the JSON string with escaped newline sequences to avoid breaking SSE payloads.
    payload = json.dumps(data, ensure_ascii=False)
    # Replace literal newlines inside the payload to avoid SSE parsing issues
    payload = payload.replace("\n", "\\n")
    return f"data: {payload}\n\n"
