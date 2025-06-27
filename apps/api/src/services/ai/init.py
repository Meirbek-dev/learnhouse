from typing import Optional
from functools import lru_cache
import os
import chromadb
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from config.config import get_openu_config

# Set telemetry environment variables before importing chromadb
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "0"
os.environ["CHROMA_TELEMETRY_ENABLED"] = "False"
os.environ["POSTHOG_DISABLED"] = "True"


@lru_cache()
def get_chromadb_client():
    """Get cached ChromaDB client instance"""
    LH_CONFIG = get_openu_config()
    chromadb_config = getattr(LH_CONFIG.ai_config, "chromadb_config", None)

    if (
        chromadb_config
        and isinstance(chromadb_config.db_host, str)
        and chromadb_config.db_host
        and getattr(chromadb_config, "isSeparateDatabaseEnabled", False)
    ):
        return chromadb.HttpClient(host=chromadb_config.db_host, port=8000)
    return chromadb.Client()


@lru_cache()
def get_embedding_function(model_name: str) -> Optional[OpenAIEmbeddings]:
    """Get cached embedding function"""
    LH_CONFIG = get_openu_config()
    api_key = getattr(LH_CONFIG.ai_config, "openai_api_key", None)

    if not api_key:
        return None

    if model_name == "text-embedding-3-small":
        return OpenAIEmbeddings(model=model_name, api_key=api_key)
    return None


@lru_cache()
def get_llm(model_name: str, temperature: float = 0) -> Optional[ChatOpenAI]:
    """Get cached LLM instance with modern OpenAI configuration"""
    LH_CONFIG = get_openu_config()
    api_key = getattr(LH_CONFIG.ai_config, "openai_api_key", None)

    if not api_key:
        return None

    return ChatOpenAI(
        temperature=temperature,
        api_key=api_key,
        model="gpt-4.1-nano",
        max_retries=3,  # Add retry logic
        request_timeout=60,  # Add timeout
    )
