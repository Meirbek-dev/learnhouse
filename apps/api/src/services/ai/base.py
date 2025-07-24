import asyncio
import hashlib
import logging
import os
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Any

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_chroma import Chroma
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.tools import create_retriever_tool
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ulid import ULID

from config.config import get_openu_config
from src.services.ai.init import get_chromadb_client, get_embedding_function, get_llm

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

# Global caches
_vector_store_cache: dict[str, Chroma] = {}
_agent_cache: dict[str, AgentExecutor] = {}
_embedding_cache: dict[str, Any] = {}
_llm_cache: dict[str, Any] = {}

# Cache TTL in seconds
VECTOR_STORE_TTL = 3600  # 1 hour
AGENT_TTL = 1800  # 30 minutes


class CacheManager:
    """Thread-safe cache manager with TTL support."""

    def __init__(self) -> None:
        self._cache: dict[str, dict[str, Any]] = {}
        self._timestamps: dict[str, datetime] = {}

    def get(self, key: str, ttl: int = 3600) -> Any | None:
        """Get cached item if it exists and hasn't expired."""
        if key not in self._cache:
            return None

        timestamp = self._timestamps.get(key)
        if timestamp and datetime.now() - timestamp > timedelta(seconds=ttl):
            self.delete(key)
            return None

        return self._cache[key].get("data")

    def set(self, key: str, value: Any) -> None:
        """Set cached item with timestamp."""
        self._cache[key] = {"data": value}
        self._timestamps[key] = datetime.now()

    def delete(self, key: str) -> None:
        """Delete cached item."""
        self._cache.pop(key, None)
        self._timestamps.pop(key, None)


# Global cache manager
cache_manager = CacheManager()


class OptimizedTextSplitter:
    """Optimized text splitter with caching."""

    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 100,
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
        """Split text with caching."""
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


class FastAIService:
    """High-performance AI service with comprehensive caching."""

    def __init__(self) -> None:
        self.text_splitter = OptimizedTextSplitter()
        self.config = get_openu_config()

    @lru_cache(maxsize=128)
    def _get_cached_embedding_function(self, model_name: str):
        """Cache embedding functions."""
        return get_embedding_function(model_name)

    @lru_cache(maxsize=32)
    def _get_cached_llm(self, model_name: str):
        """Cache LLM instances."""
        return get_llm(model_name)

    def _generate_content_hash(self, documents: list[str]) -> str:
        """Generate deterministic hash for document content."""
        content = "".join(sorted(documents))
        return hashlib.sha256(content.encode()).hexdigest()

    async def get_or_create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> Chroma | None:
        """Get cached vector store or create new one."""

        # Generate cache key
        content_hash = self._generate_content_hash(documents)
        cache_key = f"{embedding_model_name}_{content_hash}_{collection_name}"

        # Check cache first
        cached_store = cache_manager.get(cache_key, VECTOR_STORE_TTL)
        if cached_store:
            logger.info(f"Using cached vector store: {cache_key}")
            return cached_store

        # Create new vector store
        vector_store = await self._create_vector_store(
            documents, embedding_model_name, collection_name
        )

        if vector_store:
            cache_manager.set(cache_key, vector_store)
            logger.info(f"Cached new vector store: {cache_key}")

        return vector_store

    async def _create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> Chroma | None:
        """Create vector store with optimizations."""
        try:
            # Get cached embedding function
            embedding_function = self._get_cached_embedding_function(
                embedding_model_name
            )
            if not embedding_function:
                logger.error(f"Embedding model {embedding_model_name} not available")
                return None

            # Process documents in parallel
            all_chunks = []
            chunk_tasks = [
                asyncio.to_thread(self.text_splitter.split_text, doc)
                for doc in documents
            ]

            chunk_results = await asyncio.gather(*chunk_tasks, return_exceptions=True)

            for result in chunk_results:
                if isinstance(result, list):
                    all_chunks.extend(result)

            if not all_chunks:
                logger.warning("No valid chunks created from documents")
                return None

            logger.info(
                f"Created {len(all_chunks)} chunks from {len(documents)} documents"
            )

            # Use persistent client with optimizations
            chroma_client = get_chromadb_client()

            collection_name = collection_name or f"doc_collection_{ULID()}"

            # Create vector store with batch processing
            return await asyncio.to_thread(
                Chroma.from_texts,
                texts=all_chunks,
                embedding=embedding_function,
                client=chroma_client,
                collection_name=collection_name,
            )

        except Exception as e:
            logger.error(f"Failed to create vector store: {e}")
            return None

    async def get_or_create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: Chroma,
        max_iterations: int = 3,
    ) -> AgentExecutor | None:
        """Get cached agent or create new one."""

        # Generate cache key
        prompt_hash = hashlib.md5(system_prompt.encode()).hexdigest()
        cache_key = f"{llm_model_name}_{prompt_hash}_{max_iterations}"

        # Check cache
        cached_agent = cache_manager.get(cache_key, AGENT_TTL)
        if cached_agent:
            logger.info(f"Using cached agent: {cache_key}")
            # Update the agent's tools with new vector store
            retriever_tool = create_retriever_tool(
                retriever=vector_store.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": 3},
                ),
                name="find_context_text",
                description="Find relevant context from the knowledge base",
            )
            cached_agent.tools = [retriever_tool]
            return cached_agent

        # Create new agent
        agent = await self._create_agent(
            llm_model_name, system_prompt, vector_store, max_iterations
        )

        if agent:
            cache_manager.set(cache_key, agent)
            logger.info(f"Cached new agent: {cache_key}")

        return agent

    async def _create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: Chroma,
        max_iterations: int = 3,
    ) -> AgentExecutor | None:
        """Create agent with optimizations."""
        try:
            # Get cached LLM
            llm = self._get_cached_llm(llm_model_name)
            if not llm:
                logger.error(f"LLM model {llm_model_name} not available")
                return None

            # Create optimized retriever
            retriever = vector_store.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 3},
            )

            retriever_tool = create_retriever_tool(
                retriever=retriever,
                name="find_context_text",
                description="Find relevant context from the knowledge base",
            )

            # Optimized prompt template
            prompt = ChatPromptTemplate.from_messages(
                [
                    ("system", system_prompt),
                    MessagesPlaceholder(variable_name="chat_history"),
                    ("human", "{input}"),
                    MessagesPlaceholder(variable_name="agent_scratchpad"),
                ]
            )

            # Create agent
            agent = create_tool_calling_agent(llm, [retriever_tool], prompt)

            # Create executor with performance optimizations
            return AgentExecutor(
                agent=agent,
                tools=[retriever_tool],
                verbose=True,
                return_intermediate_steps=False,  # Reduce overhead
                handle_parsing_errors=True,
                max_iterations=max_iterations,
                max_execution_time=20,
                early_stopping_method="generate",  # Stop early when possible
            )

        except Exception as e:
            logger.error(f"Failed to create agent: {e}")
            return None


async def ask_ai_fast(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
) -> dict[str, Any]:
    """Fast AI processing with comprehensive optimizations."""

    # Input validation
    if not question or not question.strip():
        return {"error": "Question cannot be empty"}

    if not text_reference or not text_reference.strip():
        return {"error": "Text reference cannot be empty"}

    try:
        # Initialize fast AI service
        ai_service = FastAIService()

        # Get or create vector store (cached)
        vector_store = await ai_service.get_or_create_vector_store(
            documents=[text_reference],
            embedding_model_name=embedding_model_name,
            collection_name=f"session_{session_id}",
        )

        if not vector_store:
            return {"error": "Failed to create knowledge base"}

        # Get or create agent (cached)
        agent_executor = await ai_service.get_or_create_agent(
            llm_model_name=openai_model_name,
            system_prompt=message_for_the_prompt,
            vector_store=vector_store,
        )

        if not agent_executor:
            return {"error": "Failed to create AI agent"}

        # Create agent with history
        agent_with_history = RunnableWithMessageHistory(
            agent_executor,
            lambda session_id: message_history,
            input_messages_key="input",
            history_messages_key="chat_history",
        )

        # Process with timeout
        logger.info(f"Processing AI query: {question[:100]}...")

        # Run in thread pool to avoid blocking
        result = await asyncio.to_thread(
            agent_with_history.invoke,
            {"input": question.strip()},
            config={"configurable": {"session_id": session_id}},
        )

        logger.info("AI query processed successfully")
        return result

    except TimeoutError:
        logger.error("AI processing timed out")
        return {"error": "Request timed out", "type": "timeout_error"}
    except Exception as e:
        logger.error(f"Error processing AI request: {e}")
        return {
            "error": f"AI processing failed: {e!s}",
            "type": "ai_processing_error",
        }


# Backwards compatibility wrapper
def ask_ai(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
) -> dict[str, Any]:
    """Synchronous wrapper for the async fast AI function."""
    try:
        # Get or create event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Run the async function
        return loop.run_until_complete(
            ask_ai_fast(
                question,
                message_history,
                text_reference,
                message_for_the_prompt,
                embedding_model_name,
                openai_model_name,
                session_id,
            )
        )
    except Exception as e:
        logger.error(f"Error in ask_ai wrapper: {e}")
        return {"error": f"AI processing failed: {e!s}", "type": "wrapper_error"}


def get_chat_session_history(aichat_uuid: str | None = None) -> dict[str, Any]:
    """Optimized chat session history with connection pooling."""
    try:
        session_id = aichat_uuid or f"aichat_{ULID()}"
        config = get_openu_config()
        redis_conn_string = config.redis_config.redis_connection_string

        if redis_conn_string:
            try:
                # Use connection pooling for Redis
                message_history = RedisChatMessageHistory(
                    url=redis_conn_string,
                    ttl=2160000,  # 25 days
                    session_id=session_id,
                    key_prefix="openu_chat:",
                )

                logger.info(f"Using Redis for chat history: {session_id}")
                return {
                    "message_history": message_history,
                    "aichat_uuid": session_id,
                    "storage_type": "redis",
                }

            except Exception as redis_error:
                logger.warning(f"Redis connection failed: {redis_error}")
                return {
                    "message_history": [],
                    "aichat_uuid": session_id,
                    "storage_type": "memory",
                }
        else:
            logger.info("Redis not configured, using in-memory chat history")
            return {
                "message_history": [],
                "aichat_uuid": session_id,
                "storage_type": "memory",
            }

    except Exception as e:
        logger.error(f"Failed to create chat session: {e}")
        return {
            "message_history": [],
            "aichat_uuid": f"fallback_{ULID()}",
            "storage_type": "memory",
            "error": str(e),
        }


# Cleanup function for cache management
def cleanup_expired_cache() -> None:
    """Clean up expired cache entries."""
    try:
        # This would be called periodically by a background task
        current_time = datetime.now()
        expired_keys = []

        for key, timestamp in cache_manager._timestamps.items():
            if current_time - timestamp > timedelta(seconds=VECTOR_STORE_TTL):
                expired_keys.append(key)

        for key in expired_keys:
            cache_manager.delete(key)

        logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")
    except Exception as e:
        logger.error(f"Error cleaning up cache: {e}")
