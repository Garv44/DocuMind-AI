"""Document persistence + editor payload construction."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.models import Document
from app.schemas.document import DocumentCreate, DocumentUpdate
from app.services.export import resolve_markdown
from app.services.markdown_tools import build_editor_payload

BLANK_TEMPLATES: dict[str, dict[str, Any]] = {
    "doc": {"markdown": "# Untitled document\n\nStart writing…\n"},
    "sheet": {"markdown": "# Untitled sheet\n\n| Column A | Column B | Column C |\n| --- | --- | --- |\n|  |  |  |\n"},
    "slides": {"markdown": "# Untitled deck\n\n## Slide 1\n\n- First point\n"},
}


async def create_document(
    session: AsyncSession,
    *,
    title: str,
    doc_type: str,
    markdown: str,
    conversation_id: str | None = None,
    content_html: str | None = None,
    content_json: dict[str, Any] | None = None,
) -> Document:
    """Persist a document, deriving editor state from the markdown when needed."""
    if content_html is None and content_json is None:
        payload = build_editor_payload(markdown, doc_type, title)
        content_html = payload["content_html"]
        content_json = payload["content_json"]

    document = Document(
        conversation_id=conversation_id,
        title=title[:200] or "Untitled document",
        doc_type=doc_type,
        markdown=markdown,
        content_html=content_html,
        content_json=content_json,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)
    return document


async def create_from_payload(session: AsyncSession, payload: DocumentCreate) -> Document:
    markdown = payload.markdown or BLANK_TEMPLATES.get(payload.doc_type, {}).get("markdown", "")
    return await create_document(
        session,
        title=payload.title,
        doc_type=payload.doc_type,
        markdown=markdown,
        conversation_id=payload.conversation_id,
        content_html=payload.content_html,
        content_json=payload.content_json,
    )


async def get_document(session: AsyncSession, document_id: str) -> Document:
    document = await session.get(Document, document_id)
    if document is None:
        raise NotFoundError(f"Document {document_id} was not found.")
    return document


async def list_documents(session: AsyncSession, conversation_id: str | None = None) -> list[Document]:
    statement = select(Document).order_by(Document.updated_at.desc())
    if conversation_id:
        statement = statement.where(Document.conversation_id == conversation_id)
    result = await session.execute(statement)
    return list(result.scalars().unique())


async def update_document(
    session: AsyncSession, document_id: str, payload: DocumentUpdate
) -> Document:
    document = await get_document(session, document_id)
    data = payload.model_dump(exclude_unset=True, exclude_none=True)

    new_type = data.get("doc_type", document.doc_type)
    converting = new_type != document.doc_type

    for field in ("title", "markdown", "content_html", "content_json"):
        if field in data:
            setattr(document, field, data[field])

    if converting:
        # Markdown is the bridge between formats: re-derive the editor payload from it.
        markdown = document.markdown if "markdown" in data else resolve_markdown(document)
        document.doc_type = new_type
        document.markdown = markdown
        rebuilt = build_editor_payload(markdown, new_type, document.title)
        document.content_html = rebuilt["content_html"]
        document.content_json = rebuilt["content_json"]
    elif document.doc_type in {"sheet", "slides"} and "content_json" in data:
        # For grids and decks the structured payload is the source of truth, so the
        # markdown mirror is always re-derived from it (never trusted from the client).
        document.markdown = resolve_markdown(document)

    await session.commit()
    await session.refresh(document)
    return document


async def delete_document(session: AsyncSession, document_id: str) -> None:
    document = await get_document(session, document_id)
    await session.delete(document)
    await session.commit()
