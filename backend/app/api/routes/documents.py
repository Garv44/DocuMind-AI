from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Response, status

from app.api.deps import SessionDep
from app.schemas.document import DocumentCreate, DocumentOut, DocumentUpdate, ExportRequest
from app.services import document_service
from app.services.export import FORMATS_BY_TYPE, export_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
async def list_documents(session: SessionDep, conversation_id: str | None = None):
    return await document_service.list_documents(session, conversation_id)


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(payload: DocumentCreate, session: SessionDep):
    return await document_service.create_from_payload(session, payload)


@router.get("/formats")
async def export_formats() -> dict[str, list[str]]:
    return FORMATS_BY_TYPE


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(document_id: str, session: SessionDep):
    return await document_service.get_document(session, document_id)


@router.patch("/{document_id}", response_model=DocumentOut)
async def update_document(document_id: str, payload: DocumentUpdate, session: SessionDep):
    return await document_service.update_document(session, document_id, payload)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, session: SessionDep):
    await document_service.delete_document(session, document_id)


@router.post("/{document_id}/export")
async def export(document_id: str, payload: ExportRequest, session: SessionDep) -> Response:
    """Export a document, optionally saving the live editor state first."""
    update = DocumentUpdate(
        title=payload.title,
        markdown=payload.markdown,
        content_html=payload.content_html,
        content_json=payload.content_json,
    )
    if payload.persist and update.model_dump(exclude_none=True):
        document = await document_service.update_document(session, document_id, update)
    else:
        document = await document_service.get_document(session, document_id)

    result = export_document(document, payload.format)
    return Response(
        content=result.content,
        media_type=result.media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(result.filename)}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
