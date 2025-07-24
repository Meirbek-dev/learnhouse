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
                    port=getattr(chromadb_config, "db_port", 8000),
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
        logger.error(f"Failed to create ChromaDB client: {e}")
        # Fallback to local client
        return chromadb.Client()


@lru_cache(maxsize=10)
# The line `api_key=api_key` is passing the value of the `api_key` variable to the
# `api_key` parameter of a function or method. In this specific context, it is used to
# provide the API key required for authentication to access OpenAI services. The `api_key`
# variable is retrieved from the configuration settings using `getattr(config.ai_config,
# "openai_api_key", None)`, and then it is passed as an argument when creating instances
# of OpenAI services like `OpenAIEmbeddings` and `ChatOpenAI`. This ensures that the
# OpenAI services can authenticate and communicate with the OpenAI API using the provided
# API key.
def get_embedding_function(model_name: str) -> OpenAIEmbeddings | None:
    """
    Get cached embedding function.
    """
    try:
        config = get_openu_config()
        api_key = getattr(config.ai_config, "openai_api_key", None)

        if not api_key:
            logger.warning("OpenAI API key not configured")
            return None

        model_name == "text-embedding-3-small"

        logger.info(f"Creating embedding function for model: {model_name}")
        return OpenAIEmbeddings(
            model=model_name,
            api_key=api_key,
            # Add performance optimizations
            max_retries=3,
            request_timeout=30,
            # Use smaller batch sizes for better performance
            chunk_size=1000,
        )

    except Exception as e:
        logger.error(f"Failed to create embedding function: {e}")
        return None


@lru_cache(maxsize=10)
def get_llm(model_name: str, temperature: float = 0.0) -> ChatOpenAI | None:
    """
    Get cached LLM instance with OpenAI configuration.
    """
    try:
        config = get_openu_config()
        api_key = getattr(config.ai_config, "openai_api_key", None)

        if not api_key:
            logger.warning("OpenAI API key not configured")
            return None

        model_name = "gpt-4.1-nano"

        logger.info(f"Creating LLM for model: {model_name}")
        return ChatOpenAI(
            model=model_name,
            api_key=api_key,
            temperature=temperature,
            # Performance optimizations
            max_retries=2,
            request_timeout=20,
            # Streaming for better user experience
            streaming=True,
            # Move parameters from model_kwargs to explicit parameters
            frequency_penalty=0.0,
            presence_penalty=0.0,
            top_p=1.0,
        )

    except Exception as e:
        logger.error(f"Failed to create LLM: {e}")
        return None


def clear_ai_cache() -> None:
    """
    Clear all AI-related caches. Useful for configuration changes.
    """
    get_chromadb_client.cache_clear()
    get_embedding_function.cache_clear()
    get_llm.cache_clear()
    logger.info("AI caches cleared")
