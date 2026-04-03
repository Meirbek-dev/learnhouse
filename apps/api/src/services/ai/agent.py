import logging

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from config.config import get_settings
from src.services.ai.exceptions import RetrievalError
from src.services.ai.models import AgentDependencies

logger = logging.getLogger(__name__)

_BASE_SYSTEM_PROMPT = (
    "You are an educational assistant helping a student with course material. "
    "Prioritize the provided lecture context when it is relevant. "
    "If the provided context is insufficient, you may use general knowledge, but say so plainly. "
    "Stay on topic, decline unrelated requests, "
    "and prefer clear, structured explanations."
)

_AGENT = Agent(
    system_prompt=_BASE_SYSTEM_PROMPT,
    deps_type=AgentDependencies,
    output_type=str,
    retries=1,
    instrument=False,
)


@_AGENT.instructions
def _build_instructions(ctx: RunContext[AgentDependencies]) -> str:
    deps = ctx.deps
    context_blocks = [
        f"Course: {deps.course_name}",
        f"Activity: {deps.activity_name}",
        f"Activity UUID: {deps.activity_uuid}",
    ]

    if deps.retrieved_chunks:
        rendered_chunks = []
        for index, chunk in enumerate(deps.retrieved_chunks, start=1):
            rendered_chunks.append(f"[{index}] {chunk.document}")
        context_blocks.append("Relevant context:\n" + "\n\n".join(rendered_chunks))
    else:
        context_blocks.append(
            "Relevant context: none retrieved; use general knowledge cautiously and say that the answer is not grounded in lecture context."
        )

    return "\n\n".join(context_blocks)


def get_agent() -> Agent[AgentDependencies, str]:
    return _AGENT


def get_model() -> OpenAIChatModel:
    settings = get_settings().ai_config
    api_key = settings.openai_api_key
    if not api_key:
        raise RetrievalError("OpenAI API key not configured")

    return OpenAIChatModel(
        settings.chat_model,
        provider=OpenAIProvider(api_key=api_key),
    )
