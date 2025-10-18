"""
Streaming AI response support for real-time user feedback.
"""

import asyncio
import json
import logging
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

            # Get or create vector store (cached)
            vector_store = await ai_service.get_or_create_vector_store(
                documents=[text_reference],
                embedding_model_name=embedding_model_name,
                collection_name=f"session_{session_id}",
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

        # Send initial status as SSE string
        yield format_sse_message(
            {"type": "status", "status": "processing", "message": "AI is thinking..."}
        )

        try:
            # Process with streaming and timeout using asyncio.timeout
            async with asyncio.timeout(45.0):  # Reduced from 60s for faster timeout
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
                            full_response += str(token)
                            yield format_sse_message(
                                {
                                    "type": "chunk",
                                    "content": str(token),
                                    "chunk_id": chunk_count,
                                }
                            )

                    # Handle tool outputs for context
                    elif event_type == "on_tool_end":
                        # Send a subtle indicator that context was retrieved
                        yield format_sse_message(
                            {
                                "type": "status",
                                "status": "context_retrieved",
                                "message": "Retrieved context",
                            }
                        )

                    # Capture ONLY the final AgentExecutor output if streaming didn't work
                    elif event_type == "on_chain_end":
                        # Inspect the chain output payload and try to extract
                        # a final text answer. Some agents/tooling return a
                        # dict, some return a string, and some return lists
                        # of Message objects.
                        output_data = event.get("data", {}).get("output", {})

                        # Extract the actual text output in a tolerant way
                        output_text = ""
                        if isinstance(output_data, dict):
                            output_text = (
                                output_data.get("output")
                                or output_data.get("text")
                                or output_data.get("answer")
                                or ""
                            )
                        elif isinstance(output_data, str):
                            output_text = output_data

                        # Only use this fallback if:
                        # 1. We haven't streamed anything yet
                        # 2. The output is actual text (not empty, not "[]", not intermediate data)
                        if (
                            output_text
                            and chunk_count == 0
                            and output_text not in ["[]", "{}", "None"]
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

            # Send final response after loop completes

            logger.info(f"Streaming query completed: {chunk_count} chunks sent")

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
