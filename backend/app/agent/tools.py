"""Tool schema the model uses to hand a request over to the document author."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CreateDocument(BaseModel):
    """Create an editable, exportable document for the user.

    Call this whenever the user asks to *create*, *write*, *draft*, *generate* or
    *export* a document, report, summary file, spreadsheet, table or slide deck —
    either about a new topic or based on the conversation so far. Do not call it
    for ordinary questions that just need an answer in chat.
    """

    title: str = Field(description="Short human title for the document, in Title Case.")
    topic: str = Field(description="What the document must cover, in one or two sentences.")
    doc_type: Literal["doc", "sheet", "slides"] = Field(
        default="doc",
        description=(
            "'doc' for prose/report/notes (Word), 'sheet' for tabular data, budgets, "
            "comparisons, trackers (Excel), 'slides' for a presentation deck (PowerPoint)."
        ),
    )
    use_chat_history: bool = Field(
        default=False,
        description="True when the user asks to build the document from the conversation so far.",
    )
    instructions: str | None = Field(
        default=None,
        description="Extra constraints from the user: length, tone, audience, sections, columns.",
    )
