"""Pydantic contracts for document endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

DocType = Literal["doc", "sheet", "slides"]
ExportFormat = Literal["md", "docx", "xlsx", "csv", "pptx", "html", "txt"]


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str | None = None
    title: str
    doc_type: DocType
    markdown: str
    content_html: str | None = None
    content_json: dict[str, Any] | None = None
    created_at: datetime
    updated_at: datetime


class DocumentCreate(BaseModel):
    title: str = "Untitled document"
    doc_type: DocType = "doc"
    markdown: str = ""
    conversation_id: str | None = None
    content_html: str | None = None
    content_json: dict[str, Any] | None = None


class DocumentUpdate(BaseModel):
    """Every field optional: the editor autosaves partial state."""

    title: str | None = None
    doc_type: DocType | None = None
    markdown: str | None = None
    content_html: str | None = None
    content_json: dict[str, Any] | None = None


class ExportRequest(BaseModel):
    format: ExportFormat = "md"
    # optional live editor state so the user can export without saving first
    title: str | None = None
    markdown: str | None = None
    content_html: str | None = None
    content_json: dict[str, Any] | None = None
    persist: bool = Field(default=True, description="Store the supplied state before exporting")
