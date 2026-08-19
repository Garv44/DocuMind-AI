from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest
from app.services.chat_service import stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


@router.post("/stream")
async def chat_stream(payload: ChatRequest) -> StreamingResponse:
    """Streams the assistant answer and any generated document as SSE."""
    return StreamingResponse(
        stream_chat(payload),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
