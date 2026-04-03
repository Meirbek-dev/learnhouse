import asyncio
import hashlib
import logging
from threading import Lock
from typing import Any

import chromadb
from chromadb.api import ClientAPI
from chromadb.config import Settings

from config.config import get_settings
from src.services.ai.cache_manager import get_ai_cache_manager
from src.services.ai.chunking import chunk_documents
from src.services.ai.embeddings import embed_texts
from src.services.ai.exceptions import RetrievalError
from src.services.ai.models import DocumentChunk, RetrievedChunk

logger = logging.getLogger(__name__)

_chroma_client: ClientAPI | None = None
_chroma_lock = Lock()


def _create_chroma_client() -> ClientAPI:
    settings = get_settings()
    chromadb_config = settings.ai_config.chromadb_config
    chroma_settings = Settings(
        anonymized_telemetry=False,
        allow_reset=True,
        is_persistent=True,
    )

    is_remote = bool(
        chromadb_config.separate_db_enabled and chromadb_config.db_host
    )
    if is_remote:
        port = chromadb_config.db_port
        logger.info(
            "Connecting to remote ChromaDB at %s:%d",
            chromadb_config.db_host,
            port,
        )
        client = chromadb.HttpClient(
            host=chromadb_config.db_host,
            port=port,
            settings=chroma_settings,
        )
        client.heartbeat()
        return client

    logger.info(
        "Using local ChromaDB PersistentClient at %s",
        chromadb_config.persist_path,
    )
    return chromadb.PersistentClient(
        path=chromadb_config.persist_path,
        settings=chroma_settings,
    )


def get_chroma_client() -> ClientAPI:
    global _chroma_client
    if _chroma_client is None:
        with _chroma_lock:
            if _chroma_client is None:
                _chroma_client = _create_chroma_client()
    return _chroma_client


def _content_hash(documents: list[str]) -> str:
    normalized = sorted(" ".join(document.split()) for document in documents if document.strip())
    return hashlib.sha256("||".join(normalized).encode()).hexdigest()


def _collection_name(name: str | None, content_hash: str) -> str:
    if name:
        return name
    return f"doc_collection_{content_hash[:16]}"


async def ensure_collection(
    *,
    documents: list[str],
    embedding_model_name: str,
    collection_name: str | None,
) -> str:
    if not documents:
        raise RetrievalError("No documents available for retrieval")

    settings = get_settings().ai_config
    content_hash = _content_hash(documents)
    resolved_name = _collection_name(collection_name, content_hash)
    cache_key = f"{embedding_model_name}_{resolved_name}_{content_hash}"
    cache_manager = get_ai_cache_manager()
    cached_name = cache_manager.retrieval_cache.get(cache_key)
    if isinstance(cached_name, str):
        return cached_name

    chunks = await asyncio.to_thread(chunk_documents, documents, embedding_model_name)
    if not chunks:
        raise RetrievalError(
            "No valid chunks created from documents",
            details={"document_count": len(documents)},
        )

    embeddings = await embed_texts(
        [chunk.document for chunk in chunks],
        embedding_model_name,
    )
    if len(embeddings) != len(chunks):
        raise RetrievalError(
            "Embedding count did not match chunk count",
            details={"chunks": len(chunks), "embeddings": len(embeddings)},
        )

    await asyncio.to_thread(
        _upsert_collection,
        resolved_name,
        content_hash,
        chunks,
        embeddings,
        settings.collection_retention,
    )

    cache_manager.retrieval_cache.set(cache_key, resolved_name)
    if collection_name:
        activity_uuid = collection_name.removeprefix("activity_")
        cache_manager.register_retrieval_cache_key(activity_uuid, cache_key)
    return resolved_name


def _upsert_collection(
    collection_name: str,
    content_hash: str,
    chunks: list[DocumentChunk],
    embeddings: list[list[float]],
    collection_retention: int,
) -> None:
    client = get_chroma_client()
    try:
        collection = client.get_collection(collection_name)
        existing_hash = (collection.metadata or {}).get("content_hash")
        if existing_hash == content_hash:
            logger.info("Reusing existing Chroma collection: %s", collection_name)
            return
        client.delete_collection(collection_name)
    except Exception:
        pass

    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={
            "content_hash": content_hash,
            "collection_retention": collection_retention,
        },
    )
    collection.upsert(
        ids=[chunk.id for chunk in chunks],
        documents=[chunk.document for chunk in chunks],
        embeddings=embeddings,
        metadatas=[chunk.metadata for chunk in chunks],
    )
    logger.info(
        "Upserted %d chunks into Chroma collection %s",
        len(chunks),
        collection_name,
    )


async def retrieve_chunks(
    *,
    query: str,
    documents: list[str],
    embedding_model_name: str,
    collection_name: str | None,
) -> list[RetrievedChunk]:
    resolved_name = await ensure_collection(
        documents=documents,
        embedding_model_name=embedding_model_name,
        collection_name=collection_name,
    )

    query_embedding = await embed_texts([query], embedding_model_name)
    if not query_embedding:
        raise RetrievalError("Failed to create query embedding")

    settings = get_settings().ai_config
    result = await asyncio.to_thread(
        _query_collection,
        resolved_name,
        query_embedding[0],
        settings.retrieval_top_k,
    )

    documents_result = result.get("documents", [[]])
    ids_result = result.get("ids", [[]])
    distances_result = result.get("distances", [[]])
    metadatas_result = result.get("metadatas", [[]])

    retrieved: list[RetrievedChunk] = []
    for chunk_id, document, distance, metadata in zip(
        ids_result[0],
        documents_result[0],
        distances_result[0] if distances_result else [],
        metadatas_result[0] if metadatas_result else [],
        strict=False,
    ):
        retrieved.append(
            RetrievedChunk(
                id=chunk_id,
                document=document,
                score=None if distance is None else float(distance),
                metadata=metadata or {},
            )
        )

    logger.info(
        "Retrieved %d chunks from collection %s",
        len(retrieved),
        resolved_name,
    )
    return retrieved


def _query_collection(
    collection_name: str,
    query_embedding: list[float],
    top_k: int,
) -> dict[str, Any]:
    client = get_chroma_client()
    collection = client.get_collection(collection_name)
    return collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "distances", "metadatas"],
    )
