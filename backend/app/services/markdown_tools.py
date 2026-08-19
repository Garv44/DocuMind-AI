"""Convert agent markdown into the structures the editor and exporters use.

The backend owns this translation so the browser and the export pipeline never
disagree about what a document contains.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

import markdown as md_lib

_MD_EXTENSIONS = ["extra", "sane_lists", "admonition"]

SLIDE_SEPARATOR = re.compile(r"^\s*(?:---|\*\*\*|___)\s*$")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
BULLET_RE = re.compile(r"^\s*[-*+]\s+(.*)$")
NUMBERED_RE = re.compile(r"^\s*\d+[.)]\s+(.*)$")
NOTE_RE = re.compile(r"^\s*>\s?(.*)$")
TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$")
TABLE_DIVIDER_RE = re.compile(r"^\s*\|?[\s:\-|]+\|?\s*$")
INLINE_MD_RE = re.compile(r"(\*\*|__|\*|_|`)")


def _uid() -> str:
    return uuid.uuid4().hex[:8]


def strip_inline_markdown(text: str) -> str:
    """Plain text for cells / bullets, where we render styling separately."""
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    return INLINE_MD_RE.sub("", text).strip()


def markdown_to_html(markdown_text: str) -> str:
    """Rich text for the Word-style editor."""
    return md_lib.markdown(markdown_text or "", extensions=_MD_EXTENSIONS, output_format="html")


def document_title(markdown_text: str, fallback: str = "Untitled document") -> str:
    for line in (markdown_text or "").splitlines():
        heading = HEADING_RE.match(line)
        if heading and len(heading.group(1)) == 1:
            return strip_inline_markdown(heading.group(2))[:200] or fallback
    return fallback


# --------------------------------------------------------------------- sheet (Excel)
def _split_row(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [strip_inline_markdown(cell) for cell in stripped.split("|")]


def markdown_to_grid(markdown_text: str, min_cols: int = 4, min_rows: int = 12) -> dict[str, Any]:
    """Pick the first markdown table out of the text and turn it into a grid."""
    lines = (markdown_text or "").splitlines()
    headers: list[str] = []
    rows: list[list[str]] = []

    index = 0
    while index < len(lines):
        if TABLE_ROW_RE.match(lines[index]) and index + 1 < len(lines):
            divider = lines[index + 1]
            if TABLE_ROW_RE.match(divider) and TABLE_DIVIDER_RE.match(divider):
                headers = _split_row(lines[index])
                index += 2
                while index < len(lines) and TABLE_ROW_RE.match(lines[index]):
                    rows.append(_split_row(lines[index]))
                    index += 1
                break
        index += 1

    if not headers:
        # No table in the output: fall back to a single "content" column.
        headers = ["Item", "Details"]
        for line in lines:
            bullet = BULLET_RE.match(line) or NUMBERED_RE.match(line)
            if bullet:
                text = strip_inline_markdown(bullet.group(1))
                left, _, right = text.partition(":")
                rows.append([left.strip(), right.strip()])

    width = max([len(headers)] + [len(row) for row in rows] or [0])
    width = max(width, min_cols)
    headers = (headers + [""] * width)[:width]
    normalised = [(row + [""] * width)[:width] for row in rows]

    # Blank padding rows so the sheet looks like a spreadsheet, not a table.
    while len(normalised) < min_rows:
        normalised.append([""] * width)

    return {
        "headers": headers,
        "rows": normalised,
        "cellStyles": {},
        "headerStyle": {"bold": True},
    }


def grid_to_markdown(grid: dict[str, Any], title: str = "") -> str:
    headers = [str(h) for h in grid.get("headers") or []]
    rows = grid.get("rows") or []
    if not headers:
        return f"# {title}\n" if title else ""

    lines = [f"# {title}", ""] if title else []
    lines.append("| " + " | ".join(headers) + " |")
    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        cells = [str(cell) if cell is not None else "" for cell in row]
        cells = (cells + [""] * len(headers))[: len(headers)]
        if not any(cell.strip() for cell in cells):
            continue  # skip the blank padding rows
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines) + "\n"


# -------------------------------------------------------------------- slides (PPTX)
def markdown_to_deck(markdown_text: str, fallback_title: str = "Presentation") -> dict[str, Any]:
    lines = (markdown_text or "").splitlines()
    deck_title = document_title(markdown_text, fallback_title)

    slides: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    def flush() -> None:
        nonlocal current
        if current and (current["title"] or current["bullets"] or current["body"]):
            slides.append(current)
        current = None

    def start(title: str) -> dict[str, Any]:
        return {
            "id": _uid(),
            "title": title,
            "layout": "bullets",
            "bullets": [],
            "body": "",
            "notes": "",
        }

    seen_h1 = False
    for line in lines:
        heading = HEADING_RE.match(line)
        if heading:
            level, text = len(heading.group(1)), strip_inline_markdown(heading.group(2))
            if level == 1 and not seen_h1:
                seen_h1 = True
                continue  # the H1 is the deck title
            flush()
            current = start(text)
            continue

        if SLIDE_SEPARATOR.match(line):
            flush()
            continue

        if current is None:
            if line.strip():
                current = start(deck_title if not slides else "")
            else:
                continue

        note = NOTE_RE.match(line)
        if note:
            current["notes"] = (current["notes"] + " " + strip_inline_markdown(note.group(1))).strip()
            continue

        bullet = BULLET_RE.match(line) or NUMBERED_RE.match(line)
        if bullet:
            text = strip_inline_markdown(bullet.group(1))
            if text:
                current["bullets"].append(text)
            continue

        if line.strip():
            current["body"] = (current["body"] + "\n" + strip_inline_markdown(line)).strip()

    flush()

    if not slides:
        slides = [{"id": _uid(), "title": deck_title, "layout": "title", "bullets": [], "body": "", "notes": ""}]

    cover = {
        "id": _uid(),
        "title": deck_title,
        "layout": "title",
        "subtitle": "",
        "bullets": [],
        "body": "",
        "notes": "",
    }
    return {"title": deck_title, "slides": [cover, *slides]}


def deck_to_markdown(deck: dict[str, Any], title: str = "") -> str:
    deck_title = title or deck.get("title") or "Presentation"
    parts = [f"# {deck_title}", ""]
    for index, slide in enumerate(deck.get("slides") or []):
        if index == 0 and slide.get("layout") == "title":
            if slide.get("subtitle"):
                parts.extend([str(slide["subtitle"]), ""])
            continue
        parts.append("---")
        parts.append("")
        if slide.get("title"):
            parts.append(f"## {slide['title']}")
            parts.append("")
        if slide.get("subtitle"):
            parts.extend([f"*{slide['subtitle']}*", ""])
        for bullet in slide.get("bullets") or []:
            parts.append(f"- {bullet}")
        if slide.get("body"):
            parts.extend(["", str(slide["body"])])
        if slide.get("notes"):
            parts.extend(["", f"> {slide['notes']}"])
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


# ------------------------------------------------------------------------- dispatch
def build_editor_payload(markdown_text: str, doc_type: str, title: str) -> dict[str, Any]:
    """Structured state the editor opens with, derived from the agent's markdown."""
    if doc_type == "sheet":
        return {"content_html": None, "content_json": markdown_to_grid(markdown_text)}
    if doc_type == "slides":
        return {"content_html": None, "content_json": markdown_to_deck(markdown_text, title)}
    return {"content_html": markdown_to_html(markdown_text), "content_json": None}
