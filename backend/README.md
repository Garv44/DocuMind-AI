# DocuMind AI — Backend

FastAPI + LangGraph service that powers the chat and the document generation.
See the [root README](../README.md) for the full picture.

## Run

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env          # add your GOOGLE_API_KEY
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

- Interactive docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/api/health> — `gemini_key_configured` confirms the key loaded.

## Layout

```
app/
├── main.py            FastAPI app, CORS, error handling, startup
├── core/              settings (pydantic-settings) + domain errors
├── api/
│   ├── router.py      aggregates the routers
│   └── routes/        health · conversations · chat · documents
├── agent/
│   ├── graph.py       LangGraph pipeline: assistant → author
│   ├── prompts.py     system + per-format authoring prompts
│   ├── tools.py       CreateDocument tool schema
│   ├── llm.py         Gemini client factory
│   └── state.py       graph state
├── services/
│   ├── chat_service.py         runs the graph, emits SSE
│   ├── conversation_service.py conversations + message history
│   ├── document_service.py     document CRUD + editor payloads
│   ├── markdown_tools.py       markdown ↔ grid / deck / html
│   └── export/                 docx / xlsx / pptx renderers + dispatcher
├── db/                async SQLAlchemy session + ORM models
└── schemas/           pydantic request/response models
```

## How a chat turn flows

1. `POST /api/chat/stream` → `chat_service.stream_chat()`
2. The user turn is stored, then the LangGraph graph runs.
3. **assistant** node answers (with the `CreateDocument` tool bound); if it calls the tool, the **author** node writes the document.
4. Tokens are streamed to the client as Server-Sent Events; a generated document is persisted and its payload sent as a `document` event.

## Configuration

All settings come from `backend/.env` (see `.env.example`). Key ones:
`GOOGLE_API_KEY` (required), `GEMINI_MODEL` (default `gemini-3.7-flash`),
`GEMINI_TEMPERATURE`, `GEMINI_MAX_OUTPUT_TOKENS`, `HISTORY_WINDOW`,
`DATABASE_URL`, `CORS_ORIGINS`.

## Notes

- SQLite tables are created on startup — no migrations.
- Transient Gemini errors (429/503) are retried with backoff; a partially streamed
  answer is kept rather than discarded.
