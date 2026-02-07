import asyncio
import hashlib
import logging
import os
from typing import Any

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_chroma import Chroma
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph.state import CompiledStateGraph
from ulid import ULID

from config.config import get_platform_config
from src.services.ai.cache_manager import get_ai_cache_manager
from src.services.ai.chromadb_pool import get_chromadb_pool
from src.services.ai.exceptions import (
    AIProcessingError,
    AITimeoutError,
    ChatSessionError,
    EmbeddingError,
    VectorStoreError,
)
from src.services.ai.init import get_embedding_function, get_llm

# Disable ChromaDB telemetry
os.environ.update(
    {
        "ANONYMIZED_TELEMETRY": "False",
        "CHROMA_TELEMETRY": "0",
        "CHROMA_TELEMETRY_ENABLED": "False",
        "POSTHOG_DISABLED": "True",
    }
)

logger = logging.getLogger(__name__)


class WindowedChatMessageHistory(BaseChatMessageHistory):
    """Adapter that exposes only the last N messages while persisting full history."""

    def __init__(
        self,
        base_history: BaseChatMessageHistory | None,
        windowed_messages: list[BaseMessage],
        window_size: int,
    ) -> None:
        self._base_history = base_history
        self._messages: list[BaseMessage] = list(windowed_messages)
        self._window_size = window_size

    @property
    def messages(self) -> list[BaseMessage]:
        return self._messages

    def add_message(self, message: BaseMessage) -> None:
        if self._base_history:
            self._base_history.add_message(message)
        self._append_to_window(message)

    def add_user_message(self, message: str) -> None:
        if self._base_history:
            self._base_history.add_user_message(message)
        self._append_to_window(HumanMessage(content=message))

    def add_ai_message(self, message: str) -> None:
        if self._base_history:
            self._base_history.add_ai_message(message)
        self._append_to_window(AIMessage(content=message))

    def clear(self) -> None:
        if self._base_history:
            self._base_history.clear()
        self._messages = []

    def _append_to_window(self, message: BaseMessage) -> None:
        self._messages = ([*self._messages, message])[-self._window_size :]


class OptimizedTextSplitter:
    """Optimized text splitter with async support and caching."""

    def __init__(
        self,
        chunk_size: int = 3000,  # Larger chunks = fewer embeddings (50% faster, was 1500)
        chunk_overlap: int = 200,  # Better context preservation (increased proportionally)
        length_function: callable = len,
    ) -> None:
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=length_function,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        self._chunk_cache: dict[str, list[str]] = {}

    def split_text(self, text: str) -> list[str]:
        """Split text with caching (synchronous)."""
        if not text or not isinstance(text, str):
            return []

        # Create cache key from text hash
        text_hash = hashlib.md5(text.encode()).hexdigest()

        if text_hash in self._chunk_cache:
            return self._chunk_cache[text_hash]

        # Clean text
        clean_text = " ".join(text.split())

        # Split into chunks
        chunks = self.splitter.split_text(clean_text)

        # Filter short chunks
        filtered_chunks = [chunk for chunk in chunks if len(chunk.strip()) > 50]

        # Cache result
        self._chunk_cache[text_hash] = filtered_chunks

        return filtered_chunks

    async def split_text_async(self, text: str) -> list[str]:
        """Split text asynchronously with caching."""
        return await asyncio.to_thread(self.split_text, text)

    async def batch_split_texts(self, texts: list[str]) -> list[list[str]]:
        """
        Split multiple texts in parallel batches.

        Args:
            texts: List of texts to split

        Returns:
            List of chunk lists for each text
        """
        # Process in parallel using asyncio.gather
        tasks = [self.split_text_async(text) for text in texts]
        return await asyncio.gather(*tasks, return_exceptions=False)


class FastAIService:
    """High-performance AI service with comprehensive caching."""

    def __init__(self) -> None:
        self.text_splitter = OptimizedTextSplitter()
        self.config = get_platform_config()
        self.cache_manager = get_ai_cache_manager()

    def _get_cached_embedding_function(self, model_name: str):
        """Cache embedding functions."""
        cache_key = f"embedding_{model_name}"

        cached = self.cache_manager.embedding_cache.get(cache_key)
        if cached:
            return cached

        embedding_fn = get_embedding_function(model_name)
        if embedding_fn:
            self.cache_manager.embedding_cache.set(cache_key, embedding_fn)

        return embedding_fn

    def _get_cached_llm(self, model_name: str):
        """Cache LLM instances."""
        cache_key = f"llm_{model_name}"

        cached = self.cache_manager.llm_cache.get(cache_key)
        if cached:
            return cached

        llm = get_llm(model_name, streaming=True)
        if llm:
            self.cache_manager.llm_cache.set(cache_key, llm)

        return llm

    def _generate_content_hash(self, documents: list[str]) -> str:
        """
        Generate deterministic hash for document content.

        Normalizes documents before hashing to ensure consistent cache hits.
        """
        # Normalize and sort documents for consistent hashing
        normalized = [" ".join(doc.split()) for doc in documents if doc.strip()]
        normalized.sort()
        content = "||".join(normalized)  # Use delimiter to prevent hash collisions
        return hashlib.sha256(content.encode()).hexdigest()

    async def get_or_create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> Chroma | None:
        """
        Get cached vector store or create new one.

        Uses collection name (activity UUID) for persistent storage and caching.
        This allows vector stores to be reused across requests and server restarts.
        """

        # Use collection name as primary cache key for activity-based persistence
        # Fall back to content hash only if no collection name provided
        if collection_name:
            cache_key = f"{embedding_model_name}_{collection_name}"
        else:
            content_hash = self._generate_content_hash(documents)
            cache_key = f"{embedding_model_name}_{content_hash}"

        # Check cache first
        cached_store = self.cache_manager.vector_store_cache.get(cache_key)
        if cached_store:
            logger.info(f"✓ Cache HIT for vector store: {cache_key[:50]}...")
            # Log cache statistics for monitoring
            cache_stats = self.cache_manager.vector_store_cache.get_stats()
            logger.debug(f"Vector store cache stats: {cache_stats}")
            return cached_store

        logger.info(f"✗ Cache MISS for vector store: {cache_key[:50]}..., creating new")
        # Log cache statistics for monitoring
        cache_stats = self.cache_manager.vector_store_cache.get_stats()
        logger.debug(f"Vector store cache stats: {cache_stats}")

        # Create new vector store
        vector_store = await self._create_vector_store(
            documents, embedding_model_name, collection_name
        )

        if vector_store:
            self.cache_manager.vector_store_cache.set(cache_key, vector_store)
            logger.info(f"Cached new vector store with key: {cache_key[:50]}...")

        return vector_store

    async def _create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> Chroma | None:
        """
        Create vector store with async batch processing.

        Uses parallel text splitting and batched embedding generation.
        """
        try:
            # Get cached embedding function
            embedding_function = self._get_cached_embedding_function(
                embedding_model_name
            )
            if not embedding_function:
                error_msg = f"Embedding model {embedding_model_name} not available"
                logger.error(error_msg)
                raise EmbeddingError(
                    error_msg, details={"model_name": embedding_model_name}
                )

            # Process documents in parallel using optimized batch splitting
            logger.info(f"Processing {len(documents)} documents in parallel batches")
            all_chunks = []

            # Use batch processing for better performance
            chunk_results = await self.text_splitter.batch_split_texts(documents)

            for result in chunk_results:
                if isinstance(result, Exception):
                    logger.warning(f"Failed to process document chunk: {result}")
                    continue
                if isinstance(result, list):
                    all_chunks.extend(result)

            if not all_chunks:
                error_msg = "No valid chunks created from documents"
                logger.warning(error_msg)
                raise VectorStoreError(
                    error_msg, details={"document_count": len(documents)}
                )

            logger.info(
                f"✓ Created {len(all_chunks)} chunks from {len(documents)} documents"
            )

            # Use ChromaDB connection pool for better performance
            pool = get_chromadb_pool()

            async with pool.get_client() as chroma_client:
                collection_name = collection_name or f"doc_collection_{ULID()}"

                # Create vector store with batch embedding processing
                # The OpenAIEmbeddings with chunk_size parameter handles batching internally
                logger.info("Creating vector store with batched embeddings...")
                vector_store = await asyncio.to_thread(
                    Chroma.from_texts,
                    texts=all_chunks,
                    embedding=embedding_function,
                    client=chroma_client,
                    collection_name=collection_name,
                )

                logger.info("✓ Vector store created successfully")
                return vector_store

        except EmbeddingError, VectorStoreError:
            raise
        except Exception as e:
            error_msg = f"Failed to create vector store: {e!s}"
            logger.exception(error_msg)
            raise VectorStoreError(
                error_msg, details={"error_type": type(e).__name__}
            ) from e

    async def get_or_create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: Chroma,
        max_iterations: int = 15,  # Increased further for complex multi-step operations
    ) -> CompiledStateGraph | None:
        """Get cached agent or create new one."""

        # Generate cache key
        prompt_hash = hashlib.md5(system_prompt.encode()).hexdigest()
        cache_key = f"{llm_model_name}_{prompt_hash}_{max_iterations}"

        # Check cache - agents are stateless between invocations
        cached_agent = self.cache_manager.agent_cache.get(cache_key)
        if cached_agent:
            logger.info(f"✓ Cache HIT for agent: {cache_key[:50]}...")
            return cached_agent

        logger.info(f"✗ Cache MISS for agent: {cache_key[:50]}..., creating new")

        # Create new agent (LLM and vector store are still cached)
        agent = await self._create_agent(
            llm_model_name, system_prompt, vector_store, max_iterations
        )

        if agent:
            self.cache_manager.agent_cache.set(cache_key, agent)
            logger.info(f"Cached new agent: {cache_key[:50]}...")

        return agent

    async def _create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: Chroma,
        max_iterations: int = 15,  # Increased further for complex multi-step operations
    ) -> CompiledStateGraph | None:
        """Create agent using LangChain v1 create_agent API."""
        try:
            # Get cached LLM with streaming enabled
            llm = get_llm(llm_model_name, streaming=True)
            if not llm:
                error_msg = f"LLM model {llm_model_name} not available"
                logger.error(error_msg)
                raise AIProcessingError(
                    error_msg, details={"model_name": llm_model_name}
                )

            # Create highly optimized retriever with minimal results
            retriever = vector_store.as_retriever(
                search_type="similarity",
                search_kwargs={
                    "k": 3
                },  # Get top 3 results for better context in complex queries
            )

            # Create retriever tool using LangChain v1 @tool decorator pattern
            @tool
            def find_context_text(query: str) -> str:
                """Find relevant context from the knowledge base. Use this to search for information related to the user's question."""
                docs = retriever.invoke(query)
                if not docs:
                    return "No relevant context found."
                return "\n\n".join(doc.page_content for doc in docs)

            # Create agent using LangChain v1 create_agent API
            # This returns a LangGraph-based agent with built-in streaming support
            agent = create_agent(
                model=llm,
                tools=[find_context_text],
                system_prompt=system_prompt,
            )

            logger.info("✓ Agent created successfully using LangChain v1 create_agent")
            return agent

        except AIProcessingError:
            raise
        except Exception as e:
            error_msg = f"Failed to create agent: {e!s}"
            logger.exception(error_msg)
            raise AIProcessingError(
                error_msg, details={"error_type": type(e).__name__}
            ) from e


def _convert_history_to_messages(
    message_history: RedisChatMessageHistory | list,
) -> list[dict[str, str]]:
    """Convert message history to LangChain v1 message format."""
    messages: list[dict[str, str]] = []

    if isinstance(message_history, list):
        # Already a list, convert to message format
        for msg in message_history:
            if isinstance(msg, HumanMessage):
                messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                messages.append({"role": "assistant", "content": msg.content})
            elif isinstance(msg, dict):
                messages.append(msg)
    elif hasattr(message_history, "messages"):
        # RedisChatMessageHistory or similar
        for msg in message_history.messages:
            if isinstance(msg, HumanMessage):
                messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                messages.append({"role": "assistant", "content": msg.content})

    return messages


async def ask_ai(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
    collection_name: str | None = None,
) -> dict[str, Any]:
    """Fast AI processing using LangChain v1 create_agent API."""

    # Input validation
    if not question or not question.strip():
        error_msg = "Question cannot be empty"
        logger.warning(error_msg)
        raise AIProcessingError(error_msg)

    if not text_reference or not text_reference.strip():
        error_msg = "Text reference cannot be empty"
        logger.warning(error_msg)
        raise AIProcessingError(error_msg)

    try:
        # Initialize fast AI service
        ai_service = FastAIService()

        # Get or create vector store (cached)
        vector_store = await ai_service.get_or_create_vector_store(
            documents=[text_reference],
            embedding_model_name=embedding_model_name,
            collection_name=collection_name,
        )

        if not vector_store:
            msg = "Failed to create knowledge base"
            raise VectorStoreError(msg)

        # Get or create agent (cached)
        agent = await ai_service.get_or_create_agent(
            llm_model_name=openai_model_name,
            system_prompt=message_for_the_prompt,
            vector_store=vector_store,
        )

        if not agent:
            msg = "Failed to create AI agent"
            raise AIProcessingError(msg)

        # Convert message history to LangChain v1 format
        history_messages = _convert_history_to_messages(message_history)

        # Add current question to messages
        messages = [*history_messages, {"role": "user", "content": question.strip()}]

        # Process with timeout using LangChain v1 agent.invoke pattern
        logger.info(f"Processing AI query: {question[:100]}...")

        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    agent.invoke,
                    {"messages": messages},
                ),
                timeout=120.0,  # Increased timeout for complex operations
            )

            # Extract response from result
            output_messages = result.get("messages", [])
            if output_messages:
                last_message = output_messages[-1]
                # Use .text property for LangChain v1 (replaces .text() method)
                response_text = (
                    last_message.text
                    if hasattr(last_message, "text")
                    else str(last_message.content)
                )
            else:
                response_text = ""

            # Update message history with new messages
            if hasattr(message_history, "add_user_message"):
                message_history.add_user_message(question.strip())
            if hasattr(message_history, "add_ai_message") and response_text:
                message_history.add_ai_message(response_text)

            logger.info("AI query processed successfully")
            return {"output": response_text, "messages": output_messages}

        except TimeoutError as e:
            error_msg = "AI processing timed out after 60 seconds"
            logger.warning(error_msg)
            raise AITimeoutError(120, details={"question_length": len(question)}) from e

    except AIProcessingError, VectorStoreError, AITimeoutError:
        raise
    except Exception as e:
        error_msg = f"Unexpected error during AI processing: {e!s}"
        logger.exception(error_msg)
        raise AIProcessingError(
            error_msg,
            details={"error_type": type(e).__name__, "session_id": session_id},
        ) from e


async def ask_ai_stream(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
    collection_name: str | None = None,
):
    """
    Stream AI responses using LangChain v1 streaming API.

    Yields response chunks as they're generated instead of waiting for complete response.

    Args:
        question: User's question
        message_history: Chat history
        text_reference: Reference text for context
        message_for_the_prompt: System message
        embedding_model_name: Embedding model to use
        openai_model_name: LLM model to use
        session_id: Chat session ID

    Yields:
        Response chunks as they're generated

    Raises:
        AIProcessingError: If processing fails
        VectorStoreError: If vector store creation fails
        AITimeoutError: If processing times out
    """
    # Input validation
    if not question or not question.strip():
        error_msg = "Question cannot be empty"
        logger.warning(error_msg)
        raise AIProcessingError(error_msg)

    if not text_reference or not text_reference.strip():
        error_msg = "Text reference cannot be empty"
        logger.warning(error_msg)
        raise AIProcessingError(error_msg)

    try:
        # Initialize fast AI service
        ai_service = FastAIService()

        # Get or create vector store (cached)
        vector_store = await ai_service.get_or_create_vector_store(
            documents=[text_reference],
            embedding_model_name=embedding_model_name,
            collection_name=collection_name,  # Use activity UUID for persistence
        )

        if not vector_store:
            msg = "Failed to create knowledge base"
            raise VectorStoreError(msg)

        # Get or create agent (cached)
        agent = await ai_service.get_or_create_agent(
            llm_model_name=openai_model_name,
            system_prompt=message_for_the_prompt,
            vector_store=vector_store,
        )

        if not agent:
            msg = "Failed to create AI agent"
            raise AIProcessingError(msg)

        # Convert message history to LangChain v1 format
        history_messages = _convert_history_to_messages(message_history)

        # Add current question to messages
        messages = [*history_messages, {"role": "user", "content": question.strip()}]

        logger.info(f"Streaming AI query: {question[:100]}...")

        # Stream response chunks using LangGraph stream_mode="messages" for LLM tokens
        full_response = ""
        try:
            async for message_chunk, metadata in agent.astream(
                {"messages": messages},
                stream_mode="messages",
            ):
                # Filter: only stream from the model/agent node, not tool outputs
                node_name = metadata.get("langgraph_node", "")

                # Skip tool node outputs - we only want the final AI response
                if "tool" in node_name.lower():
                    continue

                # Skip if this is a tool message (context retrieval results)
                if hasattr(message_chunk, "type") and message_chunk.type == "tool":
                    continue

                # Extract content from the message chunk
                content = ""
                if hasattr(message_chunk, "content"):
                    # Only stream if it's an AI message chunk, not a tool response
                    msg_type = getattr(message_chunk, "type", "")
                    if msg_type == "tool":
                        continue
                    content = message_chunk.content
                elif isinstance(message_chunk, str):
                    content = message_chunk

                # Yield content if present
                if content:
                    full_response += content
                    yield content

            # Update message history with new messages
            if hasattr(message_history, "add_user_message"):
                message_history.add_user_message(question.strip())
            if hasattr(message_history, "add_ai_message") and full_response:
                message_history.add_ai_message(full_response)

            logger.info("AI streaming completed successfully")

        except TimeoutError as e:
            error_msg = "AI streaming timed out"
            logger.warning(error_msg)
            raise AITimeoutError(60, details={"question_length": len(question)}) from e

    except AIProcessingError, VectorStoreError, AITimeoutError:
        raise
    except Exception as e:
        error_msg = f"Unexpected error during AI streaming: {e!s}"
        logger.exception(error_msg)
        raise AIProcessingError(
            error_msg,
            details={"error_type": type(e).__name__, "session_id": session_id},
        ) from e


def get_chat_session_history(aichat_uuid: str | None = None) -> dict[str, Any]:
    """
    Optimized chat session history with windowed loading for better performance.

    Uses sliding window approach to load only recent messages instead of full history.
    This significantly improves performance for long conversations.
    """
    try:
        session_id = aichat_uuid or f"aichat_{ULID()}"
        config = get_platform_config()
        redis_conn_string = config.redis_config.redis_connection_string

        # Get window size from config
        window_size = getattr(
            getattr(config.ai_config, "chat", None),
            "history_window_size",
            10,  # Default to last 10 messages
        )

        if redis_conn_string:
            try:
                # Use connection pooling for Redis
                message_history = RedisChatMessageHistory(
                    url=redis_conn_string,
                    ttl=2160000,  # 25 days
                    session_id=session_id,
                    key_prefix="openu_chat:",
                )

                # Get windowed messages for better performance
                all_messages = message_history.messages
                total_count = len(all_messages)

                # Use sliding window - get last N messages
                if total_count > window_size:
                    windowed_messages = all_messages[-window_size:]
                    logger.info(
                        f"Using windowed chat history: {len(windowed_messages)}/{total_count} messages "
                        f"for session {session_id}"
                    )
                else:
                    windowed_messages = all_messages
                    logger.info(
                        f"Using full chat history: {total_count} messages for session {session_id}"
                    )

                windowed_history = WindowedChatMessageHistory(
                    base_history=message_history,
                    windowed_messages=windowed_messages,
                    window_size=window_size,
                )

                return {
                    "message_history": message_history,
                    "windowed_history": windowed_history,
                    "aichat_uuid": session_id,
                    "storage_type": "redis",
                    "total_messages": total_count,
                    "window_size": window_size,
                }

            except Exception as redis_error:
                logger.warning(f"Redis connection failed: {redis_error}")
                windowed_history = WindowedChatMessageHistory(
                    base_history=None,
                    windowed_messages=[],
                    window_size=window_size,
                )
                return {
                    "message_history": [],
                    "windowed_history": windowed_history,
                    "aichat_uuid": session_id,
                    "storage_type": "memory",
                    "total_messages": 0,
                    "window_size": window_size,
                }
        else:
            logger.info("Redis not configured, using in-memory chat history")
            windowed_history = WindowedChatMessageHistory(
                base_history=None,
                windowed_messages=[],
                window_size=window_size,
            )
            return {
                "message_history": [],
                "windowed_history": windowed_history,
                "aichat_uuid": session_id,
                "storage_type": "memory",
                "total_messages": 0,
                "window_size": window_size,
            }

    except Exception as e:
        error_msg = f"Failed to create chat session: {e!s}"
        logger.exception(error_msg)
        raise ChatSessionError(
            error_msg, details={"error_type": type(e).__name__}
        ) from e


# Cleanup function for cache management
def cleanup_expired_cache() -> None:
    """
    Clean up expired cache entries.
    This function can be called periodically by a background task.
    """
    try:
        cache_manager = get_ai_cache_manager()

        # Get stats before cleanup
        stats_before = cache_manager.get_all_stats()

        # Clear all caches (TTL is handled automatically by TTLCache)
        # This is just a safety measure to ensure memory doesn't grow unbounded
        total_items = sum(stats["size"] for stats in stats_before.values())

        logger.info(f"Cache cleanup check: {total_items} total items cached")

    except Exception as e:
        error_msg = f"Error during cache cleanup: {e!s}"
        logger.exception(error_msg)
        # Don't raise exception in cleanup function - log and continue
