"""Conversation + message persistence."""
from __future__ import annotations

from datetime import datetime, timezone

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import NotFoundError
from app.db.models import Conversation, Message


async def create_conversation(session: AsyncSession, title: str = "New chat") -> Conversation:
    conversation = Conversation(title=title[:200] or "New chat")
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    return conversation


async def list_conversations(session: AsyncSession) -> list[Conversation]:
    result = await session.execute(select(Conversation).order_by(Conversation.updated_at.desc()))
    return list(result.scalars().unique())


async def get_conversation(session: AsyncSession, conversation_id: str) -> Conversation:
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None:
        raise NotFoundError(f"Conversation {conversation_id} was not found.")
    return conversation


async def get_or_create(session: AsyncSession, conversation_id: str | None, title: str) -> tuple[Conversation, bool]:
    if conversation_id:
        return await get_conversation(session, conversation_id), False
    return await create_conversation(session, title), True


async def rename_conversation(session: AsyncSession, conversation_id: str, title: str) -> Conversation:
    conversation = await get_conversation(session, conversation_id)
    conversation.title = title[:200] or conversation.title
    await session.commit()
    await session.refresh(conversation)
    return conversation


async def delete_conversation(session: AsyncSession, conversation_id: str) -> None:
    conversation = await get_conversation(session, conversation_id)
    await session.delete(conversation)
    await session.commit()


async def add_message(
    session: AsyncSession,
    conversation_id: str,
    role: str,
    content: str,
    document_id: str | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        document_id=document_id,
    )
    session.add(message)
    # Bump the conversation so the sidebar keeps most-recent-first ordering.
    conversation = await session.get(Conversation, conversation_id)
    if conversation is not None:
        conversation.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(message)
    return message


async def load_history(session: AsyncSession, conversation_id: str) -> list[AnyMessage]:
    """Recent turns replayed to the model, oldest first."""
    result = await session.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(settings.history_window)
    )
    rows = list(result.scalars())[::-1]
    history: list[AnyMessage] = []
    for row in rows:
        if not (row.content or "").strip():
            continue
        history.append(
            HumanMessage(content=row.content) if row.role == "user" else AIMessage(content=row.content)
        )
    return history


async def clear_messages(session: AsyncSession, conversation_id: str) -> None:
    await session.execute(delete(Message).where(Message.conversation_id == conversation_id))
    await session.commit()
