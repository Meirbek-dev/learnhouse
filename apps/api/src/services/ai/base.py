import os
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

# Disable ChromaDB telemetry to prevent the capture() error
# This fixes: "capture() takes 1 positional argument but 3 were given"
os.environ["ANONYMIZED_TELEMETRY"] = "False"
# Additional ChromaDB telemetry disabling
os.environ["CHROMA_TELEMETRY"] = "0"
os.environ["CHROMA_TELEMETRY_ENABLED"] = "False"
os.environ["POSTHOG_DISABLED"] = "True"

# Use efficient text splitter settings
TEXT_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=100,
    length_function=len,
)


def ask_ai(
    question: str,
    message_history: RedisChatMessageHistory | list,
    text_reference: str,
    message_for_the_prompt: str,
    embedding_model_name: str,
    openai_model_name: str,
) -> dict[str, Any]:
    """
    Process an AI query with improved performance using cached components
    """
    # Get embedding function
    embedding_function = get_embedding_function(embedding_model_name)
    if not embedding_function:
        msg = f"Embedding model {embedding_model_name} not found or API key not configured"
        raise Exception(msg)

    # Split text into chunks efficiently
    documents = TEXT_SPLITTER.create_documents([text_reference])

    # Create vector store
    db = Chroma.from_documents(
        documents, embedding_function, client=get_chromadb_client()
    )

    # Create retriever tool
    retriever_tool = create_retriever_tool(
        db.as_retriever(search_kwargs={"k": 3}),
        "find_context_text",
        "Find associated text to get context about a course or a lecture",
    )

    # Get LLM
    llm = get_llm(openai_model_name)
    if not llm:
        msg = f"LLM model {openai_model_name} not found or API key not configured"
        raise Exception(msg)

    # Create agent prompt template
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", message_for_the_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
    )

    # Create agent using modern API
    agent = create_tool_calling_agent(llm, [retriever_tool], prompt)

    # Create and execute agent
    agent_executor = AgentExecutor(
        agent=agent,
        tools=[retriever_tool],
        verbose=True,
        return_intermediate_steps=True,
        handle_parsing_errors=True,
        max_iterations=3,  # Limit maximum iterations for better performance
    )

    # Create runnable with message history for session management
    agent_with_chat_history = RunnableWithMessageHistory(
        agent_executor,
        lambda session_id: message_history,
        input_messages_key="input",
        history_messages_key="chat_history",
    )

    try:
        # Use the agent with chat history and invoke instead of deprecated __call__
        return agent_with_chat_history.invoke(
            {"input": question}, config={"configurable": {"session_id": "default"}}
        )
    except Exception as e:
        msg = f"Error processing AI request: {e!s}"
        raise Exception(msg) from e


def get_chat_session_history(aichat_uuid: str | None = None) -> dict[str, Any]:
    """Get or create a new chat session history"""
    session_id = aichat_uuid if aichat_uuid else f"aichat_{ULID()}"

    LH_CONFIG = get_openu_config()
    redis_conn_string = LH_CONFIG.redis_config.redis_connection_string

    if redis_conn_string:
        try:
            message_history = RedisChatMessageHistory(
                url=redis_conn_string,
                ttl=2160000,  # 25 days
                session_id=session_id,
            )
        except Exception:
            print("Failed to connect to Redis, falling back to local memory")
            message_history = []
    else:
        print("Redis connection string not found, using local memory")
        message_history = []

    return {"message_history": message_history, "aichat_uuid": session_id}
