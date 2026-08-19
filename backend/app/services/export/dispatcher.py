"""Pick the right renderer for a document + requested format."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.core.errors import ExportError
from app.services.export.docx_export import html_to_docx, markdown_to_docx
from app.services.export.pptx_export import deck_to_pptx
from app.services.export.xlsx_export import grid_to_csv, grid_to_xlsx
from app.services.markdown_tools import (
    deck_to_markdown,
    grid_to_markdown,
    markdown_to_deck,
    markdown_to_grid,
    markdown_to_html,
)

MEDIA_TYPES = {
    "md": "text/markdown; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
    "html": "text/html; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

# Which formats the UI offers per document type (first entry is the default).
FORMATS_BY_TYPE = {
    "doc": ["md", "docx", "html", "txt", "pptx"],
    "sheet": ["xlsx", "csv", "md", "docx"],
    "slides": ["pptx", "md", "docx"],
}

HTML_SHELL = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  body {{ max-width: 820px; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.65;
         font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; }}
  h1, h2, h3 {{ line-height: 1.25; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #d1d5db; padding: .5rem .65rem; text-align: left; }}
  th {{ background: #f3f4f6; }}
  blockquote {{ border-left: 3px solid #d1d5db; margin: 0; padding-left: 1rem; color: #4b5563; }}
  pre {{ background: #f3f4f6; padding: 1rem; overflow-x: auto; border-radius: 6px; }}
</style></head><body>
{body}
</body></html>"""


@dataclass(slots=True)
class ExportResult:
    content: bytes
    filename: str
    media_type: str


class DocumentLike:
    """Structural type used by the dispatcher (satisfied by the ORM model)."""

    title: str
    doc_type: str
    markdown: str
    content_html: str | None
    content_json: dict[str, Any] | None


def slugify(value: str, fallback: str = "document") -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", (value or "")).strip("-").lower()
    return (slug or fallback)[:60]


def _grid_of(document: DocumentLike) -> dict[str, Any]:
    if document.doc_type == "sheet" and document.content_json:
        return document.content_json
    return markdown_to_grid(document.markdown)


def _deck_of(document: DocumentLike) -> dict[str, Any]:
    if document.doc_type == "slides" and document.content_json:
        return document.content_json
    return markdown_to_deck(document.markdown, document.title)


def resolve_markdown(document: DocumentLike) -> str:
    """Canonical markdown for the current editor state."""
    if document.doc_type == "sheet" and document.content_json:
        return grid_to_markdown(document.content_json, document.title)
    if document.doc_type == "slides" and document.content_json:
        return deck_to_markdown(document.content_json, document.title)
    return document.markdown or ""


def _plain_text(markdown_text: str) -> str:
    text = re.sub(r"^#{1,6}\s+", "", markdown_text or "", flags=re.MULTILINE)
    text = re.sub(r"(\*\*|__|\*|_|`)", "", text)
    return text


def export_document(document: DocumentLike, fmt: str) -> ExportResult:
    fmt = (fmt or "md").lower()
    if fmt not in MEDIA_TYPES:
        raise ExportError(f"Unsupported export format: {fmt}")

    title = document.title or "document"
    markdown_text = resolve_markdown(document)

    if fmt == "md":
        content = markdown_text.encode("utf-8")
    elif fmt == "txt":
        content = _plain_text(markdown_text).encode("utf-8")
    elif fmt == "html":
        body = document.content_html if document.doc_type == "doc" and document.content_html else markdown_to_html(markdown_text)
        content = HTML_SHELL.format(title=title, body=body).encode("utf-8")
    elif fmt == "docx":
        if document.doc_type == "doc" and document.content_html:
            content = html_to_docx(document.content_html, title)
        else:
            content = markdown_to_docx(markdown_text, title)
    elif fmt == "xlsx":
        content = grid_to_xlsx(_grid_of(document), title)
    elif fmt == "csv":
        content = grid_to_csv(_grid_of(document))
    elif fmt == "pptx":
        content = deck_to_pptx(_deck_of(document), title)
    else:  # pragma: no cover - guarded above
        raise ExportError(f"Unsupported export format: {fmt}")

    return ExportResult(
        content=content,
        filename=f"{slugify(title)}.{fmt}",
        media_type=MEDIA_TYPES[fmt],
    )
