"""Graph state shared between nodes."""
from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class DocRequest(TypedDict, total=False):
    title: str
    topic: str
    doc_type: str
    use_chat_history: bool
    instructions: str | None


class AgentState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    # set by the UI's "Create document" button to bypass routing
    force_document: bool
    # populated by the router / planner, consumed by the author node
    doc_request: DocRequest | None
    # populated by the author node
    document: dict[str, Any] | None
    # set when a response was streamed only partially before the provider dropped it
    warning: str | None
