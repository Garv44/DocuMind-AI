from __future__ import annotations

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.api.deps import SessionDep
from app.schemas.chat import ConversationDetail, ConversationSummary
from app.schemas.document import DocumentOut
from app.services import conversation_service, document_service

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationCreate(BaseModel):
    title: str = "New chat"


class ConversationRename(BaseModel):
    title: str


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(session: SessionDep):
    return await conversation_service.list_conversations(session)


@router.post("", response_model=ConversationSummary, status_code=status.HTTP_201_CREATED)
async def create_conversation(payload: ConversationCreate, session: SessionDep):
    return await conversation_service.create_conversation(session, payload.title)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str, session: SessionDep):
    return await conversation_service.get_conversation(session, conversation_id)


@router.get("/{conversation_id}/documents", response_model=list[DocumentOut])
async def conversation_documents(conversation_id: str, session: SessionDep):
    await conversation_service.get_conversation(session, conversation_id)
    return await document_service.list_documents(session, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def rename_conversation(conversation_id: str, payload: ConversationRename, session: SessionDep):
    return await conversation_service.rename_conversation(session, conversation_id, payload.title)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: str, session: SessionDep):
    await conversation_service.delete_conversation(session, conversation_id)
