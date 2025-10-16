import logging
from functools import lru_cache

import chromadb
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from config.config import get_openu_config

# Configure logging
logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_chromadb_client() -> chromadb.Client:
    """
    Get cached ChromaDB client instance with optimized configuration.
    """
    try:
        config = get_openu_config()
        chromadb_config = getattr(config.ai_config, "chromadb_config", None)

        if (
            chromadb_config
            and isinstance(chromadb_config.db_host, str)
            and chromadb_config.db_host
            and getattr(chromadb_config, "isSeparateDatabaseEnabled", False)
        ):
            logger.info(f"Using remote ChromaDB at {chromadb_config.db_host}")
            try:
                client = chromadb.HttpClient(
                    host=chromadb_config.db_host,
                    port=getattr(chromadb_config, "db_port", 8001),
                )
                # Test the connection
                client.heartbeat()
                return client
            except Exception as remote_error:
                logger.warning(f"Remote ChromaDB connection failed: {remote_error}")
                logger.info("Falling back to local ChromaDB client")
                return chromadb.Client()
        logger.info("Using local ChromaDB client")
        return chromadb.Client()

    except Exception as e:
        error_msg = f"Failed to create ChromaDB client: {e!s}"
        logger.exception(error_msg)
        # Fallback to local client as last resort
        logger.warning("Falling back to local ChromaDB client")
        return chromadb.Client()


@lru_cache(maxsize=10)
def get_embedding_function(model_name: str) -> OpenAIEmbeddings | None:
    """
    Get cached embedding function with optimized batch processing.

    Configured for async batch embedding generation with optimal performance.
    """
    try:
        config = get_openu_config()
        api_key = getattr(config.ai_config, "openai_api_key", None)

        if not api_key:
            logger.warning("OpenAI API key not configured")
            return None

        model_name = "text-embedding-3-small"

        logger.info(f"Creating embedding function for model: {model_name}")
        return OpenAIEmbeddings(
            model=model_name,
            api_key=api_key,
            # Performance optimizations for batch processing
            max_retries=3,
            # Optimal batch size for OpenAI API (reduces API calls)
            chunk_size=2000,  # Increased from 1000 for better batching
            # Enable concurrent requests for faster embedding generation
            show_progress_bar=False,  # Disable progress bar in production
        )

    except Exception as e:
        error_msg = f"Failed to create embedding function: {e!s}"
        logger.exception(error_msg)
        logger.error(f"Model: {model_name}, Error type: {type(e).__name__}")
        return None


@lru_cache(maxsize=10)
def get_llm(model_name: str, streaming: bool = True) -> ChatOpenAI | None:
    """
    Get cached LLM instance with OpenAI configuration.

    Args:
        model_name: Model name to use
        streaming: Enable streaming responses for better UX

    Returns:
        Configured ChatOpenAI instance or None if configuration fails
    """
    try:
        config = get_openu_config()
        api_key = getattr(config.ai_config, "openai_api_key", None)

        if not api_key:
            logger.warning("OpenAI API key not configured")
            return None

        model_name = "gpt-5-nano"

        logger.info(f"Creating LLM for model: {model_name} (streaming={streaming})")
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            # Performance optimizations
            max_retries=2,
            # Streaming for better user experience (Issue #11 fix)
            streaming=streaming,
            # Response quality parameters
            frequency_penalty=0.0,
            presence_penalty=0.0,
            top_p=1.0,
            # Timeout to prevent hanging requests
            request_timeout=60.0,
        )

    except Exception as e:
        error_msg = f"Failed to create LLM: {e!s}"
        logger.exception(error_msg)
        logger.error(f"Model: {model_name}, Error type: {type(e).__name__}")
        return None


def clear_ai_cache() -> None:
    """
    Clear all AI-related caches. Useful for configuration changes.
    """
    get_chromadb_client.cache_clear()
    get_embedding_function.cache_clear()
    get_llm.cache_clear()
    logger.info("AI caches cleared")
