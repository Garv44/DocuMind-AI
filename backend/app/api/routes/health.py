from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "model": settings.gemini_model,
        "gemini_key_configured": settings.has_api_key,
    }
