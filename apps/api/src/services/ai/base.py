import asyncio
import hashlib
import logging
import os
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

from cachetools import LRUCache
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.vectorstores import VectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph.state import CompiledStateGraph
from ulid import ULID

if TYPE_CHECKING:
    from langchain_chroma import Chroma

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
from src.services.ai.message_utils import convert_history_to_messages

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


_fast_ai_service: "FastAIService | None" = None


def get_fast_ai_service() -> "FastAIService":
    """Get a process-wide FastAIService instance for cache warmness."""
    global _fast_ai_service

    if _fast_ai_service is None:
        _fast_ai_service = FastAIService()

    return _fast_ai_service


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

    def add_messages(self, messages: Sequence[BaseMessage]) -> None:
        if self._base_history:
            self._base_history.add_messages(messages)
        for message in messages:
            self._messages = ([*self._messages, message])[-self._window_size :]

    def clear(self) -> None:
        if self._base_history:
            self._base_history.clear()
        self._messages = []


class OptimizedTextSplitter:
    """Optimized text splitter with async support and bounded caching."""

    def __init__(
        self,
        chunk_size: int = 3000,
        chunk_overlap: int = 200,
    ) -> None:
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        self._chunk_cache: LRUCache[str, list[str]] = LRUCache(maxsize=512)

    def split_text(self, text: str) -> list[str]:
        """Split text with bounded LRU caching (synchronous)."""
        if not text or not isinstance(text, str):
            return []

        text_hash = hashlib.md5(text.encode()).hexdigest()

        cached = self._chunk_cache.get(text_hash)
        if cached is not None:
            return cached

        clean_text = " ".join(text.split())
        chunks = self.splitter.split_text(clean_text)
        filtered = [chunk for chunk in chunks if len(chunk.strip()) > 50]

        self._chunk_cache[text_hash] = filtered
        return filtered

    async def split_text_async(self, text: str) -> list[str]:
        return await asyncio.to_thread(self.split_text, text)

    async def batch_split_texts(self, texts: list[str]) -> list[list[str]]:
        tasks = [self.split_text_async(text) for text in texts]
        return await asyncio.gather(*tasks)


class FastAIService:
    """High-performance AI service with comprehensive caching."""

    def __init__(self) -> None:
        self.text_splitter = OptimizedTextSplitter()
        self.config = get_platform_config()
        self.cache_manager = get_ai_cache_manager()

    def _generate_content_hash(self, documents: list[str]) -> str:
        """Generate deterministic hash for document content."""
        normalized = sorted(" ".join(doc.split()) for doc in documents if doc.strip())
        content = "||".join(normalized)
        return hashlib.sha256(content.encode()).hexdigest()

    async def get_or_create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> VectorStore | None:
        """Get cached vector store or create new one."""
        if collection_name:
            cache_key = f"{embedding_model_name}_{collection_name}"
        else:
            content_hash = self._generate_content_hash(documents)
            cache_key = f"{embedding_model_name}_{content_hash}"

        cached_store = self.cache_manager.vector_store_cache.get(cache_key)
        if cached_store:
            logger.info("✓ Vector store cache HIT: %s", cache_key[:50])
            return cached_store

        logger.info("✗ Vector store cache MISS: %s — creating", cache_key[:50])

        vector_store = await self._create_vector_store(
            documents, embedding_model_name, collection_name
        )

        if vector_store:
            self.cache_manager.vector_store_cache.set(cache_key, vector_store)

        return vector_store

    async def _create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> VectorStore | None:
        """Create vector store with async batch processing."""
        from langchain_core.vectorstores import InMemoryVectorStore

        try:
            chroma_cls = None
            chroma_import_error: Exception | None = None
            try:
                from langchain_chroma import Chroma

                chroma_cls = Chroma
            except Exception as import_error:
                chroma_import_error = import_error
                logger.warning(
                    "Chroma import failed, falling back to InMemoryVectorStore: %s",
                    import_error,
                )

            # lru_cache handles caching — call directly
            embedding_function = get_embedding_function(embedding_model_name)
            if not embedding_function:
                raise EmbeddingError(
                    f"Embedding model {embedding_model_name} not available",
                    details={"model_name": embedding_model_name},
                )

            logger.info("Processing %d documents", len(documents))
            chunk_results = await asyncio.gather(
                *(self.text_splitter.split_text_async(doc) for doc in documents),
                return_exceptions=True,
            )

            all_chunks: list[str] = []
            for result in chunk_results:
                if isinstance(result, Exception):
                    logger.warning("Failed to chunk document: %s", result)
                    continue
                if isinstance(result, list):
                    all_chunks.extend(result)

            if not all_chunks:
                raise VectorStoreError(
                    "No valid chunks created from documents",
                    details={"document_count": len(documents)},
                )

            logger.info(
                "✓ Created %d chunks from %d documents", len(all_chunks), len(documents)
            )

            if chroma_cls is not None:
                pool = get_chromadb_pool()
                async with pool.get_client() as chroma_client:
                    cname = collection_name or f"doc_collection_{ULID()}"
                    vector_store = await asyncio.to_thread(
                        chroma_cls.from_texts,
                        texts=all_chunks,
                        embedding=embedding_function,
                        client=chroma_client,
                        collection_name=cname,
                    )
                    logger.info("✓ Chroma vector store created")
                    return vector_store

            vector_store = await asyncio.to_thread(
                InMemoryVectorStore.from_texts,
                texts=all_chunks,
                embedding=embedding_function,
            )
            logger.info("✓ InMemoryVectorStore fallback created")
            if chroma_import_error:
                logger.debug("Chroma import error: %r", chroma_import_error)
            return vector_store

        except EmbeddingError, VectorStoreError:
            raise
        except Exception as e:
            raise VectorStoreError(
                f"Failed to create vector store: {e!s}",
                details={"error_type": type(e).__name__},
            ) from e

    async def get_or_create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: VectorStore,
        collection_name: str | None = None,
        max_iterations: int = 15,
    ) -> CompiledStateGraph | None:
        """Get cached agent or create new one.

        ``collection_name`` is used as part of the cache key so that agents
        tied to different vector stores are never confused with each other.
        """
        prompt_hash = hashlib.md5(system_prompt.encode()).hexdigest()
        # Include collection_name so agents bound to different retrievers don't collide.
        cache_key = (
            f"{llm_model_name}_{prompt_hash}_{max_iterations}_{collection_name or ''}"
        )

        cached_agent = self.cache_manager.agent_cache.get(cache_key)
        if cached_agent:
            logger.info("✓ Agent cache HIT: %s", cache_key[:50])
            return cached_agent

        logger.info("✗ Agent cache MISS: %s — creating", cache_key[:50])

        agent = await self._create_agent(
            llm_model_name, system_prompt, vector_store, max_iterations
        )

        if agent:
            self.cache_manager.agent_cache.set(cache_key, agent)

        return agent

    async def _create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: VectorStore,
        max_iterations: int = 15,
    ) -> CompiledStateGraph | None:
        """Create agent using LangChain v1 create_agent API."""
        try:
            # lru_cache handles caching — call directly
            llm = get_llm(llm_model_name, streaming=True)
            if not llm:
                raise AIProcessingError(
                    f"LLM model {llm_model_name} not available",
                    details={"model_name": llm_model_name},
                )

            retriever = vector_store.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 3},
            )

            @tool
            def find_context_text(query: str) -> str:
                """Find relevant context from the knowledge base. Use this to search for information related to the user's question."""
                docs = retriever.invoke(query)
                if not docs:
                    return "No relevant context found."
                return "\n\n".join(doc.page_content for doc in docs)

            agent = create_agent(
                model=llm,
                tools=[find_context_text],
                system_prompt=system_prompt,
            )

            logger.info("✓ Agent created successfully")
            return agent

        except AIProcessingError:
            raise
        except Exception as e:
            raise AIProcessingError(
                f"Failed to create agent: {e!s}",
                details={"error_type": type(e).__name__},
            ) from e


async def ask_ai(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
    cancel_event: asyncio.Event | None = None,
    collection_name: str | None = None,
) -> dict[str, Any]:
    """Fast AI processing using LangChain v1 create_agent API."""

    if not question or not question.strip():
        raise AIProcessingError("Question cannot be empty")

    if not text_reference or not text_reference.strip():
        raise AIProcessingError("Text reference cannot be empty")

    try:
        ai_service = get_fast_ai_service()

        vector_store = await ai_service.get_or_create_vector_store(
            documents=[text_reference],
            embedding_model_name=embedding_model_name,
            collection_name=collection_name,
        )

        if not vector_store:
            raise VectorStoreError("Failed to create knowledge base")

        agent = await ai_service.get_or_create_agent(
            llm_model_name=openai_model_name,
            system_prompt=message_for_the_prompt,
            vector_store=vector_store,
            collection_name=collection_name,
        )

        if not agent:
            raise AIProcessingError("Failed to create AI agent")

        history_messages = convert_history_to_messages(message_history)
        messages = [*history_messages, {"role": "user", "content": question.strip()}]

        logger.info("Processing AI query: %s...", question[:100])

        try:
            if cancel_event and cancel_event.is_set():
                raise AIProcessingError("AI processing cancelled before invocation")

            result = await asyncio.wait_for(
                agent.ainvoke({"messages": messages}),
                timeout=120.0,
            )

            output_messages = result.get("messages", [])
            if output_messages:
                last_message = output_messages[-1]
                text_attr = getattr(last_message, "text", None)
                if text_attr is not None:
                    response_text = (
                        text_attr() if callable(text_attr) else str(text_attr)
                    )
                else:
                    content = getattr(last_message, "content", "")
                    response_text = (
                        "".join(str(part) for part in content)
                        if isinstance(content, list)
                        else str(content)
                    )
            else:
                response_text = ""

            if hasattr(message_history, "add_messages"):
                msgs: list[BaseMessage] = [HumanMessage(content=question.strip())]
                if response_text:
                    msgs.append(AIMessage(content=response_text))
                message_history.add_messages(msgs)

            logger.info("AI query processed successfully")
            return {"output": response_text, "messages": output_messages}

        except TimeoutError as e:
            raise AITimeoutError(120, details={"question_length": len(question)}) from e

    except AIProcessingError, VectorStoreError, AITimeoutError:
        raise
    except Exception as e:
        raise AIProcessingError(
            f"Unexpected error during AI processing: {e!s}",
            details={"error_type": type(e).__name__, "session_id": session_id},
        ) from e


def get_chat_session_history(aichat_uuid: str | None = None) -> dict[str, Any]:
    """
    Chat session history with windowed loading for performance.

    Uses a sliding window to load only recent messages instead of full history.
    """
    try:
        session_id = aichat_uuid or f"aichat_{ULID()}"
        config = get_platform_config()
        redis_conn_string = config.redis_config.redis_connection_string

        window_size = getattr(
            getattr(config.ai_config, "chat", None),
            "history_window_size",
            10,
        )

        if redis_conn_string:
            try:
                message_history = RedisChatMessageHistory(
                    url=redis_conn_string,
                    ttl=2160000,  # 25 days
                    session_id=session_id,
                    key_prefix="openu_chat:",
                )

                all_messages = message_history.messages
                total_count = len(all_messages)
                windowed_messages = (
                    all_messages[-window_size:]
                    if total_count > window_size
                    else all_messages
                )

                logger.info(
                    "Chat history for %s: using %d/%d messages",
                    session_id,
                    len(windowed_messages),
                    total_count,
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
                logger.warning("Redis connection failed: %s", redis_error)

        logger.info("Using in-memory chat history for session %s", session_id)
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
        raise ChatSessionError(
            f"Failed to create chat session: {e!s}",
            details={"error_type": type(e).__name__},
        ) from e


def cleanup_expired_cache() -> None:
    """Clean up expired cache entries (TTL is handled by TTLCache automatically)."""
    try:
        cache_manager = get_ai_cache_manager()
        stats = cache_manager.get_all_stats()
        total_items = sum(s["size"] for s in stats.values())
        logger.info("Cache check: %d total items cached", total_items)
    except Exception as e:
        logger.exception("Error during cache cleanup: %s", e)
