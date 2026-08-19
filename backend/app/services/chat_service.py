"""Runs the LangGraph pipeline and turns it into a Server-Sent Event stream.

Event protocol (all payloads are JSON):
    start      {conversation_id, message}          user turn stored
    token      {text}                              chat answer delta
    doc_start  {doc_type, title}                   the author node took over
    doc_token  {text}                              markdown delta
    document   {document}                          finished, persisted document
    message    {message}                           finished assistant turn
    title      {conversation_id, title}            auto-named conversation
    error      {message}
    done       {}
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from app.agent.graph import _text_of, generate_conversation_title, get_graph
from app.core.errors import AppError
from app.db.session import SessionLocal
from app.schemas.chat import ChatRequest, MessageOut
from app.schemas.document import DocumentOut
from app.services import conversation_service, document_service

logger = logging.getLogger(__name__)

DOC_REPLY = (
    "I've drafted **{title}** and opened it in the editor on the right. "
    "Edit it there, then export it as .md, Word, Excel or PowerPoint — "
    "or tell me what to change and I'll rewrite it."
)


def sse(event: str, data: dict[str, Any] | None = None) -> str:
    return f"event: {event}\ndata: {json.dumps(data or {}, default=str)}\n\n"


def _explain(error: Exception) -> str:
    """Turn a provider error into something a user can act on."""
    detail = str(error)
    if "API key not valid" in detail or "API_KEY_INVALID" in detail:
        return "Gemini rejected the API key. Check GOOGLE_API_KEY in backend/.env."
    if "no longer available" in detail or "NOT_FOUND" in detail:
        return f"The configured model is unavailable — update GEMINI_MODEL in backend/.env. ({detail[:180]})"
    if any(marker in detail for marker in ("503", "UNAVAILABLE", "high demand", "overloaded")):
        return "Gemini is busy right now and did not respond after 3 attempts. Try again in a moment."
    if "429" in detail or "RESOURCE_EXHAUSTED" in detail:
        return "Gemini rate limit reached. Wait a moment, or switch GEMINI_MODEL to a lighter model."
    return f"The model call failed: {detail[:300]}"


async def stream_chat(payload: ChatRequest) -> AsyncIterator[str]:
    conversation_id = payload.conversation_id
    created_conversation = False

    try:
        async with SessionLocal() as session:
            conversation, created_conversation = await conversation_service.get_or_create(
                session, conversation_id, payload.message[:60]
            )
            conversation_id = conversation.id
            user_message = await conversation_service.add_message(
                session, conversation_id, "user", payload.message
            )
            history = await conversation_service.load_history(session, conversation_id)
            yield sse(
                "start",
                {
                    "conversation_id": conversation_id,
                    "message": MessageOut.model_validate(user_message).model_dump(mode="json"),
                },
            )
    except AppError as exc:
        yield sse("error", {"message": exc.message})
        yield sse("done")
        return

    chat_parts: list[str] = []
    doc_parts: list[str] = []
    document_state: dict[str, Any] | None = None
    announced_document = False
    warning: str | None = None

    try:
        graph = get_graph()
        inputs = {"messages": history, "force_document": payload.force_document}

        if payload.force_document:
            announced_document = True
            yield sse("doc_start", {"doc_type": None, "title": None})

        async for mode, chunk in graph.astream(inputs, stream_mode=["messages", "updates"]):
            if mode == "messages":
                message, meta = chunk
                text = _text_of(message)
                if not text:
                    continue
                node = (meta or {}).get("langgraph_node")
                if node == "assistant":
                    chat_parts.append(text)
                    yield sse("token", {"text": text})
                elif node == "author":
                    doc_parts.append(text)
                    yield sse("doc_token", {"text": text})
                continue

            for node_name, update in (chunk or {}).items():
                if not isinstance(update, dict):
                    continue
                request = update.get("doc_request")
                if request and not announced_document:
                    announced_document = True
                    yield sse(
                        "doc_start",
                        {"doc_type": request.get("doc_type", "doc"), "title": request.get("title")},
                    )
                if update.get("document"):
                    document_state = update["document"]
                if update.get("warning"):
                    warning = update["warning"]

    except AppError as exc:
        yield sse("error", {"message": exc.message})
        yield sse("done")
        return
    except Exception as exc:  # pragma: no cover - provider/runtime failure
        logger.exception("chat stream failed")
        yield sse("error", {"message": _explain(exc)})
        yield sse("done")
        return

    reply_text = "".join(chat_parts).strip()

    try:
        async with SessionLocal() as session:
            document = None
            if document_state and (document_state.get("markdown") or "").strip():
                document = await document_service.create_document(
                    session,
                    title=document_state.get("title") or "Untitled document",
                    doc_type=document_state.get("doc_type") or "doc",
                    markdown=document_state.get("markdown") or "",
                    conversation_id=conversation_id,
                )
                if not reply_text:
                    reply_text = DOC_REPLY.format(title=document.title)
                yield sse(
                    "document",
                    {"document": DocumentOut.model_validate(document).model_dump(mode="json")},
                )
            elif announced_document and not document_state:
                reply_text = reply_text or "I couldn't generate that document — try rephrasing the request."

            if not reply_text:
                reply_text = "(no response)"

            assistant_message = await conversation_service.add_message(
                session,
                conversation_id,
                "assistant",
                reply_text,
                document_id=document.id if document else None,
            )
            yield sse(
                "message",
                {"message": MessageOut.model_validate(assistant_message).model_dump(mode="json")},
            )

            if warning:
                # Non-fatal: the partial answer above was still saved.
                yield sse("error", {"message": warning})

            if created_conversation:
                title = await generate_conversation_title(payload.message)
                await conversation_service.rename_conversation(session, conversation_id, title)
                yield sse("title", {"conversation_id": conversation_id, "title": title})
    except Exception as exc:  # pragma: no cover
        logger.exception("failed to persist chat result")
        yield sse("error", {"message": f"Could not save the response: {exc}"})

    yield sse("done")
