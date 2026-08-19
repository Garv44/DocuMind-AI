"""Aggregate API router."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import chat, conversations, documents, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(conversations.router)
api_router.include_router(chat.router)
api_router.include_router(documents.router)
