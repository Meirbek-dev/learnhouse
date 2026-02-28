"""
Shared message conversion utilities for AI services.
"""

from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage


def convert_history_to_messages(
    message_history: RedisChatMessageHistory | list,
) -> list[dict[str, str]]:
    """Convert message history to LangChain v1 message format."""
    messages: list[dict[str, str]] = []

    if isinstance(message_history, list):
        for msg in message_history:
            if isinstance(msg, HumanMessage):
                messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                messages.append({"role": "assistant", "content": msg.content})
            elif isinstance(msg, dict):
                messages.append(msg)
    elif hasattr(message_history, "messages"):
        for msg in message_history.messages:
            if isinstance(msg, HumanMessage):
                messages.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                messages.append({"role": "assistant", "content": msg.content})

    return messages
