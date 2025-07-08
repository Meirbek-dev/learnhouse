import logging
import os
from typing import Any, Dict, List, Optional, Union

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

# Disable ChromaDB telemetry to prevent errors
os.environ.update(
    {
        "ANONYMIZED_TELEMETRY": "False",
        "CHROMA_TELEMETRY": "0",
        "CHROMA_TELEMETRY_ENABLED": "False",
        "POSTHOG_DISABLED": "True",
    }
)

logger = logging.getLogger(__name__)


class OptimizedTextSplitter:
    """
    Optimized text splitter with caching and improved performance.
    """

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
            separators=["\n\n", "\n", " ", ""],
        )

    def split_text(self, text: str) -> list[str]:
        """Split text into optimized chunks."""
        if not text or not isinstance(text, str):
            return []

        # Remove excessive whitespace
        text = " ".join(text.split())

        # Split into chunks
        chunks = self.splitter.split_text(text)

        # Filter out very short chunks
        return [chunk for chunk in chunks if len(chunk.strip()) > 50]


class AIService:
    """
    Optimized AI service with better error handling and performance.
    """

    def __init__(self) -> None:
        self.text_splitter = OptimizedTextSplitter()
        self.config = get_openu_config()

    def create_vector_store(
        self,
        documents: list[str],
        embedding_model_name: str,
        collection_name: str | None = None,
    ) -> Chroma | None:
        """
        Create an optimized vector store from documents.
        """
        try:
            # Get embedding function
            embedding_function = get_embedding_function(embedding_model_name)
            if not embedding_function:
                logger.error(f"Embedding model {embedding_model_name} not available")
                return None

            # Split documents into chunks
            all_chunks = []
            for doc in documents:
                chunks = self.text_splitter.split_text(doc)
                all_chunks.extend(chunks)

            if not all_chunks:
                logger.warning("No valid chunks created from documents")
                return None

            logger.info(
                f"Created {len(all_chunks)} chunks from {len(documents)} documents"
            )

            # Create vector store
            chroma_client = get_chromadb_client()
            try:
                return Chroma.from_texts(
                    texts=all_chunks,
                    embedding=embedding_function,
                    client=chroma_client,
                    collection_name=collection_name or f"doc_collection_{ULID()}",
                )
            except Exception as chroma_error:
                logger.error(f"ChromaDB connection failed: {chroma_error}")
                # Try to create a new local client as fallback
                try:
                    import chromadb

                    fallback_client = chromadb.Client()
                    logger.info("Using fallback local ChromaDB client")
                    return Chroma.from_texts(
                        texts=all_chunks,
                        embedding=embedding_function,
                        client=fallback_client,
                        collection_name=collection_name or f"doc_collection_{ULID()}",
                    )
                except Exception as fallback_error:
                    logger.error(
                        f"Fallback ChromaDB client also failed: {fallback_error}"
                    )
                    return None

        except Exception as e:
            logger.error(f"Failed to create vector store: {e}")
            return None

    def create_agent(
        self,
        llm_model_name: str,
        system_prompt: str,
        vector_store: Chroma,
        max_iterations: int = 3,
    ) -> AgentExecutor | None:
        """
        Create an optimized agent with tools and error handling.
        """
        try:
            # Get LLM
            llm = get_llm(llm_model_name)
            if not llm:
                logger.error(f"LLM model {llm_model_name} not available")
                return None

            # Create retriever tool
            retriever_tool = create_retriever_tool(
                retriever=vector_store.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": 3},
                ),
                name="find_context_text",
                description="Find relevant context from the knowledge base to answer questions",
            )

            # Create agent prompt
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

            # Create agent executor with optimized settings
            return AgentExecutor(
                agent=agent,
                tools=[retriever_tool],
                verbose=False,  # Disable verbose logging in production
                return_intermediate_steps=True,
                handle_parsing_errors=True,
                max_iterations=max_iterations,
                max_execution_time=30,  # Timeout after 30 seconds
            )

        except Exception as e:
            logger.error(f"Failed to create agent: {e}")
            return None


def ask_ai(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
    session_id: str = "default",
) -> dict[str, Any]:
    if not question or not question.strip():
        return {"error": "Question cannot be empty"}

    if not text_reference or not text_reference.strip():
        return {"error": "Text reference cannot be empty"}

    try:
        # Initialize AI service
        ai_service = AIService()

        # Create vector store
        vector_store = ai_service.create_vector_store(
            documents=[text_reference],
            embedding_model_name=embedding_model_name,
            collection_name=f"session_{session_id}",
        )

        if not vector_store:
            return {"error": "Failed to create knowledge base"}

        # Create agent
        agent_executor = ai_service.create_agent(
            llm_model_name=openai_model_name,
            system_prompt=message_for_the_prompt,
            vector_store=vector_store,
        )

        if not agent_executor:
            return {"error": "Failed to create AI agent"}

        # Create agent with chat history
        agent_with_history = RunnableWithMessageHistory(
            agent_executor,
            lambda session_id: message_history,
            input_messages_key="input",
            history_messages_key="chat_history",
        )

        # Process the question
        logger.info(f"Processing AI query: {question[:100]}...")

        result = agent_with_history.invoke(
            {"input": question.strip()},
            config={"configurable": {"session_id": session_id}},
        )

        logger.info("AI query processed successfully")
        return result

    except Exception as e:
        logger.error(f"Error processing AI request: {e}")
        return {
            "error": f"AI processing failed: {e!s}",
            "type": "ai_processing_error",
        }


def get_chat_session_history(aichat_uuid: str | None = None) -> dict[str, Any]:
    """
    Get or create a chat session history.
    """
    try:
        session_id = aichat_uuid or f"aichat_{ULID()}"
        config = get_openu_config()
        redis_conn_string = config.redis_config.redis_connection_string

        if redis_conn_string:
            try:
                message_history = RedisChatMessageHistory(
                    url=redis_conn_string,
                    ttl=2160000,  # 25 days
                    session_id=session_id,
                    key_prefix="openu_chat:",
                )
                logger.info(f"Using Redis for chat history: {session_id}")

                # Test the connection
                message_history.add_user_message("test")
                message_history.clear()

                return {
                    "message_history": message_history,
                    "aichat_uuid": session_id,
                    "storage_type": "redis",
                }

            except Exception as redis_error:
                logger.warning(f"Redis connection failed: {redis_error}")
                # Fall back to in-memory storage
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
