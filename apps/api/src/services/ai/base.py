import asyncio
import hashlib
import logging
import re
import warnings
from collections.abc import Sequence
from dataclasses import dataclass
from threading import Lock
from typing import TYPE_CHECKING, Any, Literal

from cachetools import LRUCache
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.tools import tool
from langchain_core.vectorstores import VectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
from ulid import ULID

from src.core.platform import PLATFORM_CHAT_KEY_PREFIX

if TYPE_CHECKING:
    import chromadb
    from langchain_chroma import Chroma

# Import Chroma once at module level so the ChromaDB/Pydantic v2 Settings
# initialisation only runs on startup, not on every first request.
try:
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=".*chroma_server_nofile.*")
        warnings.filterwarnings("ignore", category=UserWarning, module="chromadb")
        from langchain_chroma import Chroma as _ChromaCls
    _CHROMA_IMPORT_ERROR: Exception | None = None
except Exception as _e:
    _ChromaCls = None  # type: ignore[assignment,misc]
    _CHROMA_IMPORT_ERROR = _e
    logging.getLogger(__name__).warning(
        "langchain_chroma unavailable, vector store will use InMemoryVectorStore fallback: %s",
        _e,
    )

from config.config import get_settings
from src.services.ai.cache_manager import get_ai_cache_manager
from src.services.ai.exceptions import (
    AIProcessingError,
    AITimeoutError,
    ChatSessionError,
    VectorStoreError,
)
from src.services.ai.init import get_embedding_function, get_llm
from src.services.ai.message_utils import convert_history_to_messages

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ChromaDB client — module-level singleton (replaces ChromaDBPool)
# ---------------------------------------------------------------------------

_chroma_client: "chromadb.Client | None" = None
_chroma_client_lock = Lock()


def _create_chroma_client() -> "chromadb.Client":
    """Create the ChromaDB client based on config (remote HttpClient or local PersistentClient)."""
    import chromadb
    from chromadb.config import Settings

    settings = get_settings()
    chromadb_config = getattr(settings.ai_config, "chromadb_config", None)
    chroma_settings = Settings(
        anonymized_telemetry=False, allow_reset=True, is_persistent=True
    )

    is_remote = bool(
        chromadb_config
        and isinstance(getattr(chromadb_config, "db_host", None), str)
        and chromadb_config.db_host
        and getattr(chromadb_config, "separate_db_enabled", False)
    )

    if is_remote:
        port = getattr(chromadb_config, "db_port", 8001)
        logger.info(
            "Connecting to remote ChromaDB at %s:%d", chromadb_config.db_host, port
        )
        try:
            client = chromadb.HttpClient(
                host=chromadb_config.db_host, port=port, settings=chroma_settings
            )
            client.heartbeat()
            return client
        except Exception as e:
            logger.warning("Remote ChromaDB unavailable (%s); falling back to local", e)

    persist_path = (
        getattr(chromadb_config, "persist_path", "./chroma_data")
        if chromadb_config
        else "./chroma_data"
    )
    logger.info("Using local ChromaDB PersistentClient at %s", persist_path)
    return chromadb.PersistentClient(path=persist_path, settings=chroma_settings)


def _get_chroma_client() -> "chromadb.Client":
    """Return the process-wide ChromaDB client, creating it on first call."""
    global _chroma_client
    if _chroma_client is None:
        with _chroma_client_lock:
            if _chroma_client is None:
                _chroma_client = _create_chroma_client()
    return _chroma_client


# ---------------------------------------------------------------------------
# Lightweight chat history holder (replaces WindowedChatMessageHistory)
# ---------------------------------------------------------------------------


class _ChatHistory:
    """Windowed read context + delegating write-back to the full history."""

    __slots__ = ("messages", "_full")

    def __init__(
        self,
        windowed: list[BaseMessage],
        full: BaseChatMessageHistory | None,
    ) -> None:
        self.messages: list[BaseMessage] = windowed
        self._full = full

    def add_messages(self, messages: Sequence[BaseMessage]) -> None:
        if self._full is not None:
            self._full.add_messages(messages)


# ---------------------------------------------------------------------------
# FastAIService data structures
# ---------------------------------------------------------------------------

_fast_ai_service: "FastAIService | None" = None
_fast_ai_service_lock = Lock()


@dataclass(frozen=True, slots=True)
class ChatSessionInfo:
    """Typed container for chat session data."""

    message_history: "RedisChatMessageHistory | list"
    windowed_history: "_ChatHistory"
    aichat_uuid: str
    storage_type: Literal["redis", "memory"]
    total_messages: int
    window_size: int


def get_fast_ai_service() -> "FastAIService":
    """Get a process-wide FastAIService instance for cache warmness."""
    global _fast_ai_service

    if _fast_ai_service is None:
        with _fast_ai_service_lock:
            if _fast_ai_service is None:
                _fast_ai_service = FastAIService()

    return _fast_ai_service


class OptimizedTextSplitter:
    """Optimized text splitter with async support and bounded caching."""

    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> None:
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        self._chunk_cache: LRUCache[str, list[str]] = LRUCache(maxsize=512)
        self._chunk_cache_lock = Lock()

    def split_text(self, text: str) -> list[str]:
        """Split text with bounded LRU caching (synchronous)."""
        if not text or not isinstance(text, str):
            return []

        text_hash = hashlib.sha1(text.encode(), usedforsecurity=False).hexdigest()

        with self._chunk_cache_lock:
            cached = self._chunk_cache.get(text_hash)
        if cached is not None:
            return cached

        clean_text = re.sub(r"\n{3,}", "\n\n", text.strip())
        chunks = self.splitter.split_text(clean_text)
        filtered = [chunk for chunk in chunks if chunk.strip()]

        with self._chunk_cache_lock:
            self._chunk_cache[text_hash] = filtered
        return filtered

    async def split_text_async(self, text: str) -> list[str]:
        return await asyncio.to_thread(self.split_text, text)

    async def batch_split_texts(self, texts: list[str]) -> list[list[str]]:
        tasks = [self.split_text_async(text) for text in texts]
        return await asyncio.gather(*tasks)


class FastAIService:
    """High-performance AI service with caching."""

    def __init__(self) -> None:
        self.text_splitter = OptimizedTextSplitter()
        self.config = get_settings()
        self.cache_manager = get_ai_cache_manager()

    def _generate_content_hash(self, documents: list[str]) -> str:
        normalized = sorted(" ".join(doc.split()) for doc in documents if doc.strip())
        content = "||".join(normalized)
        return hashlib.sha256(content.encode()).hexdigest()

    async def get_or_create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> tuple[VectorStore, str] | tuple[None, str]:
        """Get cached vector store or create new one."""
        content_hash = self._generate_content_hash(documents)
        cache_key = f"{embedding_model_name}_{collection_name or 'anon'}_{content_hash}"

        cached_store = self.cache_manager.vector_store_cache.get(cache_key)
        if cached_store:
            logger.info("Vector store cache HIT: %s", cache_key[:60])
            return cached_store, content_hash

        logger.info("Vector store cache MISS: %s — creating", cache_key[:60])

        vector_store = await self._create_vector_store(
            documents, embedding_model_name, collection_name, content_hash
        )

        if vector_store:
            self.cache_manager.vector_store_cache.set(cache_key, vector_store)
            if collection_name:
                activity_uuid = collection_name.removeprefix("activity_")
                self.cache_manager.register_vector_cache_key(activity_uuid, cache_key)

        return vector_store, content_hash

    async def _chunk_documents(self, documents: list[str]) -> list[str]:
        """Chunk documents in parallel and validate output."""
        logger.info("Chunking %d documents", len(documents))
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
            "Produced %d chunks from %d documents", len(all_chunks), len(documents)
        )
        return all_chunks

    async def _create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
        content_hash: str = "",
    ) -> VectorStore | None:
        """Create vector store with async batch processing."""
        from langchain_core.vectorstores import InMemoryVectorStore

        try:
            chroma_cls: "type[Chroma] | None" = _ChromaCls
            if chroma_cls is None and _CHROMA_IMPORT_ERROR is not None:
                logger.debug("Chroma unavailable: %s", _CHROMA_IMPORT_ERROR)

            embedding_function = get_embedding_function(embedding_model_name)
            if not embedding_function:
                raise VectorStoreError(
                    f"Embedding model {embedding_model_name} not available",
                    details={"model_name": embedding_model_name},
                )

            if chroma_cls is not None:
                chroma_client = await asyncio.to_thread(_get_chroma_client)
                cname = collection_name or f"doc_collection_{ULID()}"

                # Reuse existing collection if content hasn't changed
                if collection_name and content_hash:
                    try:
                        existing = await asyncio.to_thread(
                            chroma_client.get_collection, cname
                        )
                        existing_hash = (existing.metadata or {}).get("content_hash")
                        if existing_hash == content_hash:
                            logger.info("Reusing existing Chroma collection: %s", cname)
                            return chroma_cls(
                                client=chroma_client,
                                collection_name=cname,
                                embedding_function=embedding_function,
                            )
                        await asyncio.to_thread(chroma_client.delete_collection, cname)
                        logger.info("Deleted stale Chroma collection: %s", cname)
                    except Exception:
                        pass  # Collection doesn't exist yet

                all_chunks = await self._chunk_documents(documents)
                vector_store = await chroma_cls.afrom_texts(
                    texts=all_chunks,
                    embedding=embedding_function,
                    client=chroma_client,
                    collection_name=cname,
                    collection_metadata={"content_hash": content_hash},
                )
                logger.info("Chroma vector store created: %s", cname)
                return vector_store

            # Fallback to InMemoryVectorStore
            all_chunks = await self._chunk_documents(documents)
            vector_store = await InMemoryVectorStore.afrom_texts(
                texts=all_chunks,
                embedding=embedding_function,
            )
            logger.info("InMemoryVectorStore fallback created")
            return vector_store

        except VectorStoreError:
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
        content_hash: str = "",
        max_iterations: int = 15,
        max_tokens: int = 4000,
    ) -> CompiledStateGraph | None:
        """Get cached compiled agent or create a new one."""
        prompt_hash = hashlib.sha1(
            system_prompt.encode(), usedforsecurity=False
        ).hexdigest()[:16]
        safe_content_hash = (content_hash or "no-content")[:32]
        cache_key = f"agent_{llm_model_name}_{collection_name or 'anon'}_{prompt_hash}_{safe_content_hash}_{max_tokens}"

        cached_agent = self.cache_manager.agent_cache.get(cache_key)
        if cached_agent is not None:
            logger.info("Agent cache HIT: %s", cache_key[:60])
            return cached_agent

        logger.info("Agent cache MISS: %s — creating", cache_key[:60])
        agent = await self._create_agent(
            llm_model_name, system_prompt, vector_store, max_iterations, max_tokens
        )
        if agent:
            self.cache_manager.agent_cache.set(cache_key, agent)
            if collection_name:
                activity_uuid = collection_name.removeprefix("activity_")
                self.cache_manager.register_agent_cache_key(activity_uuid, cache_key)
        return agent

    async def _create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: VectorStore,
        max_iterations: int = 15,
        max_tokens: int = 4000,
    ) -> CompiledStateGraph | None:
        """Compile a ReAct agent using langgraph.prebuilt.create_react_agent."""
        try:
            llm = get_llm(llm_model_name, streaming=True, max_tokens=max_tokens)
            if not llm:
                raise AIProcessingError(
                    f"LLM model {llm_model_name} not available",
                    details={"model_name": llm_model_name},
                )

            retriever = vector_store.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 5},
            )

            @tool
            async def find_context_text(query: str) -> str:
                """Find relevant context from the knowledge base. Use this to search for information related to the user's question."""
                docs = await retriever.ainvoke(query)
                if not docs:
                    return "No relevant context found."
                return "\n\n".join(doc.page_content for doc in docs)

            agent = create_react_agent(
                model=llm,
                tools=[find_context_text],
                prompt=system_prompt,
            )

            logger.info("Agent created successfully (model=%s)", llm_model_name)
            return agent

        except AIProcessingError:
            raise
        except Exception as e:
            raise AIProcessingError(
                f"Failed to create agent: {e!s}",
                details={"error_type": type(e).__name__},
            ) from e


async def prepare_agent(
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    collection_name: str | None = None,
    max_tokens: int = 4000,
    documents: list[str] | None = None,
) -> CompiledStateGraph:
    """Shared setup: create (or retrieve cached) vector store and agent."""
    ai_service = get_fast_ai_service()

    docs = documents if documents else [text_reference]

    vector_store, content_hash = await ai_service.get_or_create_vector_store(
        documents=docs,
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
        content_hash=content_hash,
        max_tokens=max_tokens,
    )

    if not agent:
        raise AIProcessingError("Failed to create AI agent")

    return agent


async def ask_ai(
    question: str,
    message_history: "_ChatHistory | RedisChatMessageHistory | list",
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
    cancel_event: asyncio.Event | None = None,
    collection_name: str | None = None,
    max_tokens: int = 4000,
    documents: list[str] | None = None,
) -> dict[str, Any]:
    """Fast AI processing using langgraph.prebuilt.create_react_agent."""

    if not question or not question.strip():
        raise AIProcessingError("Question cannot be empty")

    if not text_reference or not text_reference.strip():
        raise AIProcessingError("Text reference cannot be empty")

    try:
        agent = await prepare_agent(
            text_reference=text_reference,
            message_for_the_prompt=message_for_the_prompt,
            embedding_model_name=embedding_model_name,
            openai_model_name=openai_model_name,
            collection_name=collection_name,
            max_tokens=max_tokens,
            documents=documents,
        )

        history_messages = convert_history_to_messages(message_history)
        messages = [*history_messages, {"role": "user", "content": question.strip()}]

        logger.info("Processing AI query: %s...", question[:100])

        try:
            if cancel_event and cancel_event.is_set():
                raise AIProcessingError("AI processing cancelled before invocation")

            async with asyncio.timeout(60.0):
                result = await agent.ainvoke(
                    {"messages": messages},
                    config={"recursion_limit": 30},
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
            raise AITimeoutError(60, details={"question_length": len(question)}) from e

    except AIProcessingError, VectorStoreError, AITimeoutError:
        raise
    except Exception as e:
        raise AIProcessingError(
            f"Unexpected error during AI processing: {e!s}",
            details={"error_type": type(e).__name__, "session_id": session_id},
        ) from e


def get_chat_session_history(
    aichat_uuid: str | None = None, user_id: int | None = None
) -> ChatSessionInfo:
    """Chat session history with windowed loading for performance."""
    try:
        if aichat_uuid and user_id is not None:
            if aichat_uuid.startswith("user_") and not aichat_uuid.startswith(
                f"user_{user_id}_"
            ):
                raise ChatSessionError(
                    "Session does not belong to this user",
                    details={"session": aichat_uuid},
                )
            session_id = aichat_uuid
        elif aichat_uuid:
            session_id = aichat_uuid
        else:
            session_id = (
                f"user_{user_id}_{ULID()}"
                if user_id is not None
                else f"aichat_{ULID()}"
            )
        config = get_settings()
        redis_conn_string = config.redis_config.redis_connection_string

        window_size = config.ai_config.history_window_size
        message_ttl = config.ai_config.message_retention

        if redis_conn_string:
            try:
                message_history = RedisChatMessageHistory(
                    url=redis_conn_string,
                    ttl=message_ttl,
                    session_id=session_id,
                    key_prefix=PLATFORM_CHAT_KEY_PREFIX,
                )

                windowed_messages: list[BaseMessage] = []
                total_count = 0
                try:
                    import json

                    from langchain_core.messages import messages_from_dict

                    redis_key = message_history.key
                    redis_client = message_history.redis_client
                    total_count = redis_client.llen(redis_key)
                    raw_tail = redis_client.lrange(redis_key, -window_size, -1)
                    for item in raw_tail:
                        try:
                            jsn = json.loads(item)
                            windowed_messages.extend(messages_from_dict([jsn]))
                        except Exception:
                            pass
                    logger.info(
                        "Chat history (fast-path) %s: %d/%d messages loaded",
                        session_id,
                        len(windowed_messages),
                        total_count,
                    )
                except Exception as _fast_path_err:
                    logger.debug(
                        "Fast-path history fetch failed (%s), falling back",
                        _fast_path_err,
                    )
                    all_messages = message_history.messages
                    total_count = len(all_messages)
                    windowed_messages = (
                        all_messages[-window_size:]
                        if total_count > window_size
                        else all_messages
                    )
                    logger.info(
                        "Chat history (fallback) %s: %d/%d messages",
                        session_id,
                        len(windowed_messages),
                        total_count,
                    )

                return ChatSessionInfo(
                    message_history=message_history,
                    windowed_history=_ChatHistory(
                        windowed=windowed_messages, full=message_history
                    ),
                    aichat_uuid=session_id,
                    storage_type="redis",
                    total_messages=total_count,
                    window_size=window_size,
                )

            except Exception as redis_error:
                logger.warning("Redis connection failed: %s", redis_error)

        logger.info("Using in-memory chat history for session %s", session_id)
        return ChatSessionInfo(
            message_history=[],
            windowed_history=_ChatHistory(windowed=[], full=None),
            aichat_uuid=session_id,
            storage_type="memory",
            total_messages=0,
            window_size=window_size,
        )

    except Exception as e:
        raise ChatSessionError(
            f"Failed to create chat session: {e!s}",
            details={"error_type": type(e).__name__},
        ) from e


def cleanup_expired_cache() -> None:
    """Log current cache stats (TTL expiry is automatic)."""
    try:
        cache_manager = get_ai_cache_manager()
        stats = cache_manager.get_all_stats()
        total_items = sum(
            v.get("size", 0) for v in stats.values() if isinstance(v, dict)
        )
        logger.info("Cache check: %d total items cached", total_items)
    except Exception as e:
        logger.exception("Error during cache cleanup: %s", e)
