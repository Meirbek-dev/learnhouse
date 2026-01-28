import logging
from functools import lru_cache

import chromadb
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from config.config import get_platform_config

# Configure logging
logger = logging.getLogger(__name__)


@lru_cache(maxsize=10)
def get_embedding_function(model_name: str) -> OpenAIEmbeddings | None:
    """
    Get cached embedding function with optimized batch processing.

    Configured for async batch embedding generation with optimal performance.
    """
    try:
        config = get_platform_config()
        api_key = getattr(config.ai_config, "openai_api_key", None)

        if not api_key:
            logger.warning("OpenAI API key not configured")
            return None

        model_name = "text-embedding-3-small"

        # Get batch size from config or use optimal size for speed
        batch_size = getattr(
            getattr(config.ai_config, "vector_store", None),
            "embedding_batch_size",
            2048,  # Optimal batch size for speed vs memory
        )

        logger.info(
            f"Creating embedding function for model: {model_name} with batch size: {batch_size}"
        )
        return OpenAIEmbeddings(
            model=model_name,
            api_key=api_key,
            # Performance optimizations
            chunk_size=batch_size,
            max_retries=1,  # Reduced from 5 for faster failure
            request_timeout=20,  # Reduced from 30s
            retry_min_seconds=1,  # Faster retries
            retry_max_seconds=5,  # Faster max retry
            dimensions=256,  # Reduced from 512 for 2x faster similarity search
        )

    except Exception as e:
        error_msg = f"Failed to create embedding function: {e!s}"
        logger.exception(error_msg)
        logger.exception(f"Model: {model_name}, Error type: {type(e).__name__}")
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
        config = get_platform_config()
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
            # Aggressive timeout to prevent hanging
            request_timeout=30.0,  # Reduced from 60s
            # Token limits - increased to allow complete responses
            max_tokens=4000,  # Increased from 1500 to prevent premature cutoff
        )

    except Exception as e:
        error_msg = f"Failed to create LLM: {e!s}"
        logger.exception(error_msg)
        logger.exception(f"Model: {model_name}, Error type: {type(e).__name__}")
        return None


def clear_ai_cache() -> None:
    """
    Clear all AI-related caches. Useful for configuration changes.
    """
    get_embedding_function.cache_clear()
    get_llm.cache_clear()
    logger.info("AI caches cleared")
