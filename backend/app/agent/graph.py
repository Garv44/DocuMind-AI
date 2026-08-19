"""LangGraph pipeline: chat -> (optional) document authoring.

    START ──▶ assistant ──tool call──▶ author ──▶ END
      │           └────no tool────────────────▶ END
      └──force_document──▶ planner ──▶ author ──▶ END
"""
from __future__ import annotations

import asyncio
import logging
import re
from functools import lru_cache
from typing import Any

from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.agent.llm import get_author_llm, get_llm
from app.agent.prompts import (
    PROMPT_BY_TYPE,
    SYSTEM_PROMPT,
    TITLE_PROMPT,
    author_instructions,
)
from app.agent.state import AgentState, DocRequest
from app.agent.tools import CreateDocument

logger = logging.getLogger(__name__)

# Gemini returns these when a model is briefly overloaded or throttled; the request
# is worth repeating, unlike a bad key or an unknown model name.
RETRYABLE_MARKERS = (
    "503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "500", "INTERNAL",
    "DEADLINE_EXCEEDED", "high demand", "overloaded",
)
STREAM_ATTEMPTS = 3
TRUNCATED_WARNING = (
    "Gemini stopped part-way through, so this response is incomplete. "
    "What arrived has been kept — ask again to regenerate it."
)

# Gemini tells us how long to wait when it throttles; honour it instead of guessing.
RETRY_HINT_RE = re.compile(r"retry in ([\d.]+)s", re.IGNORECASE)
MAX_RETRY_WAIT = 30.0

FENCE_RE = re.compile(r"^\s*```(?:markdown|md)?\s*\n(.*?)\n\s*```\s*$", re.DOTALL)
TITLE_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)


# --------------------------------------------------------------------------- helpers
def _clean_markdown(text: str) -> str:
    text = (text or "").strip()
    match = FENCE_RE.match(text)
    if match:
        text = match.group(1).strip()
    return text


def _extract_title(markdown: str, fallback: str) -> str:
    match = TITLE_RE.search(markdown)
    title = match.group(1).strip() if match else fallback.strip()
    return (title or "Untitled document")[:200]


def _last_human_text(messages: list[Any]) -> str:
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            return str(message.content)
    return ""


def _extract_doc_request(message: Any) -> DocRequest | None:
    for call in getattr(message, "tool_calls", None) or []:
        if call.get("name") != CreateDocument.__name__:
            continue
        args = call.get("args") or {}
        return DocRequest(
            title=str(args.get("title") or "Untitled document")[:200],
            topic=str(args.get("topic") or ""),
            doc_type=args.get("doc_type") if args.get("doc_type") in PROMPT_BY_TYPE else "doc",
            use_chat_history=bool(args.get("use_chat_history")),
            instructions=args.get("instructions"),
        )
    return None


def _fallback_request(messages: list[Any]) -> DocRequest:
    prompt = _last_human_text(messages)
    return DocRequest(
        title=(prompt[:60].strip() or "Untitled document"),
        topic=prompt or "the conversation so far",
        doc_type="doc",
        use_chat_history="chat" in prompt.lower() or "history" in prompt.lower(),
        instructions=None,
    )


def _conversation_context(messages: list[Any], limit: int) -> list[Any]:
    """Plain user/assistant turns only — tool-call scaffolding is dropped."""
    clean = [
        m
        for m in messages
        if isinstance(m, (HumanMessage, AIMessage))
        and not getattr(m, "tool_calls", None)
        and str(m.content).strip()
    ]
    return clean[-limit:] if limit else clean


def _is_retryable(error: Exception) -> bool:
    message = str(error)
    return any(marker in message for marker in RETRYABLE_MARKERS)


def _retry_delay(error: Exception, attempt: int) -> float:
    """Provider-supplied wait when there is one, otherwise linear backoff."""
    hint = RETRY_HINT_RE.search(str(error))
    if hint:
        try:
            return min(float(hint.group(1)) + 0.5, MAX_RETRY_WAIT)
        except ValueError:
            pass
    return 1.5 * (attempt + 1)


async def _stream_text(llm: Any, messages: list[Any]) -> tuple[AIMessageChunk | None, str | None]:
    """Run the model in streaming mode so LangGraph can surface tokens live.

    Returns the accumulated message plus a warning when the answer was cut short.
    Transient failures are retried with backoff, but only while nothing has been
    emitted yet -- replaying a partly streamed answer would duplicate it. Once
    output exists we keep it: a truncated draft beats losing the whole response.
    """
    for attempt in range(STREAM_ATTEMPTS):
        accumulated: AIMessageChunk | None = None
        try:
            async for chunk in llm.astream(messages):
                accumulated = chunk if accumulated is None else accumulated + chunk
            return accumulated, None
        except Exception as exc:
            if accumulated is not None and _text_of(accumulated).strip():
                logger.warning("stream interrupted after partial output: %s", exc)
                return accumulated, TRUNCATED_WARNING
            if attempt == STREAM_ATTEMPTS - 1 or not _is_retryable(exc):
                raise
            delay = _retry_delay(exc, attempt)
            logger.warning("model call failed, retrying in %.1fs: %s", delay, exc)
            await asyncio.sleep(delay)
    return None, None


def _text_of(message: Any) -> str:
    """Gemini may return content as a string or as a list of parts."""
    content = getattr(message, "content", "") if message is not None else ""
    if isinstance(content, str):
        return content
    parts = []
    for part in content or []:
        if isinstance(part, str):
            parts.append(part)
        elif isinstance(part, dict) and part.get("type") == "text":
            parts.append(part.get("text", ""))
    return "".join(parts)


# --------------------------------------------------------------------------- nodes
async def assistant_node(state: AgentState) -> dict[str, Any]:
    """Answer the user, or decide that a document should be authored."""
    llm = get_llm().bind_tools([CreateDocument])
    messages = [SystemMessage(content=SYSTEM_PROMPT), *state["messages"]]
    reply, warning = await _stream_text(llm, messages)
    if reply is None:
        reply = AIMessage(content="")
    return {
        "messages": [reply],
        "doc_request": _extract_doc_request(reply),
        "warning": warning,
    }


async def planner_node(state: AgentState) -> dict[str, Any]:
    """Forced document mode: derive title / type without answering in chat."""
    llm = get_llm(temperature=0.0)
    try:
        bound = llm.bind_tools([CreateDocument], tool_choice="any")
    except Exception:  # pragma: no cover - provider without forced tool choice
        bound = llm.bind_tools([CreateDocument])

    instruction = SystemMessage(
        content=(
            "Decide the title, subject and best format for the document the user wants. "
            "Respond only with a CreateDocument tool call."
        )
    )
    try:
        reply = await bound.ainvoke([instruction, *state["messages"]])
        request = _extract_doc_request(reply)
    except Exception as exc:  # pragma: no cover - network/provider failure
        logger.warning("planner failed, using fallback request: %s", exc)
        request = None
    return {"doc_request": request or _fallback_request(state["messages"])}


async def author_node(state: AgentState) -> dict[str, Any]:
    """Write the actual document, streaming markdown as it is produced."""
    request = state.get("doc_request") or _fallback_request(state["messages"])
    doc_type = request.get("doc_type", "doc")
    system_prompt = PROMPT_BY_TYPE.get(doc_type, PROMPT_BY_TYPE["doc"])

    history_limit = 0 if request.get("use_chat_history") else 6
    context = _conversation_context(state["messages"], history_limit)

    messages = [
        SystemMessage(content=system_prompt),
        *context,
        HumanMessage(
            content=author_instructions(
                title=request.get("title", "Untitled document"),
                topic=request.get("topic", ""),
                doc_type=doc_type,
                use_chat_history=bool(request.get("use_chat_history")),
                extra=request.get("instructions"),
            )
        ),
    ]

    reply, warning = await _stream_text(get_author_llm(), messages)
    markdown = _clean_markdown(_text_of(reply))
    title = _extract_title(markdown, request.get("title", "Untitled document"))

    return {
        "document": {
            "title": title,
            "doc_type": doc_type,
            "markdown": markdown,
        },
        "warning": warning,
    }


# --------------------------------------------------------------------------- wiring
def _entry_router(state: AgentState) -> str:
    return "planner" if state.get("force_document") else "assistant"


def _after_assistant(state: AgentState) -> str:
    return "author" if state.get("doc_request") else END


@lru_cache
def get_graph():
    builder = StateGraph(AgentState)
    builder.add_node("assistant", assistant_node)
    builder.add_node("planner", planner_node)
    builder.add_node("author", author_node)

    builder.add_conditional_edges(
        START, _entry_router, {"assistant": "assistant", "planner": "planner"}
    )
    builder.add_conditional_edges("assistant", _after_assistant, {"author": "author", END: END})
    builder.add_edge("planner", "author")
    builder.add_edge("author", END)
    return builder.compile()


async def generate_conversation_title(first_message: str) -> str:
    """Short label for the sidebar; falls back to a truncated message."""
    fallback = (first_message.strip().splitlines() or ["New chat"])[0][:60] or "New chat"
    try:
        reply = await get_llm(temperature=0.2).ainvoke(
            [HumanMessage(content=TITLE_PROMPT.format(message=first_message[:500]))]
        )
        title = _text_of(reply).strip().strip('"').strip()
        return (title or fallback)[:80]
    except Exception as exc:  # pragma: no cover - titling is best effort
        logger.info("title generation failed: %s", exc)
        return fallback
