"""Gemini model factory."""
from __future__ import annotations

from functools import lru_cache

from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.core.errors import ConfigurationError


def _require_key() -> str:
    if not settings.has_api_key:
        raise ConfigurationError(
            "GOOGLE_API_KEY is not set. Add it to backend/.env "
            "(get one at https://aistudio.google.com/apikey) and restart the server."
        )
    return settings.google_api_key.strip()


@lru_cache
def get_llm(temperature: float | None = None) -> ChatGoogleGenerativeAI:
    """Chat model used for conversation and routing."""
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=_require_key(),
        temperature=settings.gemini_temperature if temperature is None else temperature,
        max_output_tokens=settings.gemini_max_output_tokens,
        convert_system_message_to_human=False,
    )


@lru_cache
def get_author_llm() -> ChatGoogleGenerativeAI:
    """Slightly more deterministic model used to write long-form documents."""
    return get_llm(temperature=0.3)
