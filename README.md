# DocuMind AI

Chat with Gemini, then turn any answer into an editable, exportable document.

Ask questions like a normal chat. Say **“create a document about X”** or **“create a
document from our chat history”**, and a LangGraph branch writes the full document,
saves it as markdown, and opens it in an editor beside the conversation — a Word-style
page, a spreadsheet, or a slide deck — with a formatting toolbar and one-click export
to `.md`, `.docx`, `.xlsx`, `.csv`, `.pptx`, `.html` or `.txt`.

```
┌─────────── frontend (React + Vite + TypeScript) ───────────┐
│  Sidebar  │      Chat panel       │    Document editor      │
│  chats    │  streamed answers     │  toolbar + live editing │
│  docs     │  document cards       │  export menu            │
└───────────────────────────┬────────────────────────────────┘
                            │  REST + Server-Sent Events
┌───────────────────────────┴────────────────────────────────┐
│              backend (FastAPI, layered)                    │
│  api/       routes, request/response models                │
│  agent/     LangGraph graph, prompts, tools, Gemini client  │
│  services/  chat orchestration, documents, exporters        │
│  db/        SQLAlchemy async models (SQLite)                │
└────────────────────────────────────────────────────────────┘
```

The two layers are fully separate processes — the frontend never imports backend code
and talks to it only over HTTP.

---

## 1. Prerequisites

- Python 3.11+
- Node 18+
- A Gemini API key from <https://aistudio.google.com/apikey>

## 2. Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env          # then put your real key in GOOGLE_API_KEY
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs> · health: <http://localhost:8000/api/health>
(`gemini_key_configured` tells you whether the key was picked up).

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to
`http://localhost:8000`, so there is nothing else to configure.

Both at once:

```bash
./scripts/dev.sh
```

---

## How the agent decides

`backend/app/agent/graph.py`

```
START ──▶ assistant ──tool call──▶ author ──▶ END
  │           └────no tool────────────────▶ END
  └──force_document──▶ planner ──▶ author ──▶ END
```

- **assistant** — answers normally, with the `CreateDocument` tool bound. Gemini calls
  the tool when the user asks for a document, choosing `doc`, `sheet` or `slides`.
- **planner** — used only when the UI's *Create document* toggle is on; forces a tool
  call so the title and format are still chosen by the model.
- **author** — writes the document with a format-specific prompt and streams the
  markdown to the editor as it is produced.

Conversation history lives in the database and is replayed into the graph on each turn,
so “create a document from our chat history” has the real transcript to work from.

## Documents and formats

Markdown is the canonical content. When a document is created the backend derives the
editor payload from it:

| Type     | Editor                                   | Stored as      | Exports                  |
| -------- | ---------------------------------------- | -------------- | ------------------------ |
| `doc`    | rich text page (TipTap)                  | `content_html` | md, docx, html, txt, pptx |
| `sheet`  | spreadsheet grid                         | `content_json` | xlsx, csv, md, docx      |
| `slides` | slide canvas + thumbnails                | `content_json` | pptx, md, docx           |

The **Doc / Sheet / Slides** switch in the editor header converts a document between
formats — markdown is the bridge, and the backend rebuilds the payload.

Formatting carried into the exports: bold, italic, underline, strikethrough, font
family, font size (points, 1:1 with Word), text colour, highlight/fill, alignment,
headings, bullet and numbered lists (nested), quotes, code blocks, tables, links,
inline images, per-cell spreadsheet styling and per-slide title/body styling plus
speaker notes.

## API

| Method   | Path                                       | Purpose                                  |
| -------- | ------------------------------------------ | ---------------------------------------- |
| `GET`    | `/api/health`                              | status + whether the Gemini key is set   |
| `POST`   | `/api/chat/stream`                         | chat turn, streamed as SSE               |
| `GET`    | `/api/conversations`                       | list chats                               |
| `POST`   | `/api/conversations`                       | create a chat                            |
| `GET`    | `/api/conversations/{id}`                  | chat with its messages                   |
| `PATCH`  | `/api/conversations/{id}`                  | rename                                   |
| `DELETE` | `/api/conversations/{id}`                  | delete (cascades to documents)           |
| `GET`    | `/api/conversations/{id}/documents`        | documents from that chat                 |
| `GET`    | `/api/documents`                           | recent documents                         |
| `POST`   | `/api/documents`                           | create a blank document                  |
| `GET`    | `/api/documents/formats`                   | export formats per document type         |
| `GET`    | `/api/documents/{id}`                      | fetch one                                |
| `PATCH`  | `/api/documents/{id}`                      | autosave / convert type                  |
| `DELETE` | `/api/documents/{id}`                      | delete                                   |
| `POST`   | `/api/documents/{id}/export`               | save live editor state and download      |

### SSE events on `/api/chat/stream`

| Event       | Payload                                | Meaning                        |
| ----------- | -------------------------------------- | ------------------------------ |
| `start`     | `{conversation_id, message}`            | user turn stored               |
| `token`     | `{text}`                                | chat answer delta              |
| `doc_start` | `{doc_type, title}`                     | the author node took over      |
| `doc_token` | `{text}`                                | markdown delta                 |
| `document`  | `{document}`                            | finished, persisted document   |
| `message`   | `{message}`                             | finished assistant turn        |
| `title`     | `{conversation_id, title}`              | chat auto-named                |
| `error`     | `{message}`                             | failure, stream still closes   |
| `done`      | `{}`                                    | end of stream                  |

## Configuration

`backend/.env`

| Variable                    | Default            | Notes                             |
| --------------------------- | ------------------ | --------------------------------- |
| `GOOGLE_API_KEY`            | —                  | required                          |
| `GEMINI_MODEL`              | `gemini-3.7-flash` | any Gemini chat model             |
| `GEMINI_TEMPERATURE`        | `0.4`              |                                   |
| `GEMINI_MAX_OUTPUT_TOKENS`  | `8192`             | raise for longer documents        |
| `HISTORY_WINDOW`            | `24`               | messages replayed to the model    |
| `DATABASE_URL`              | `sqlite+aiosqlite` | any SQLAlchemy async URL          |
| `CORS_ORIGINS`              | localhost dev ports | comma separated                   |

Frontend: set `VITE_API_BASE` to point at a backend on another host (defaults to the
dev proxy at `/api`).

## Layout

```
backend/
  app/
    main.py                 FastAPI app, CORS, error handling
    core/                   settings, domain errors
    api/routes/             health, conversations, chat, documents
    agent/                  graph, prompts, tools, Gemini client, state
    services/               chat orchestration, conversations, documents
      export/               docx / xlsx / pptx renderers + dispatcher
      markdown_tools.py     markdown <-> grid / deck / html
    db/                     async session + ORM models
    schemas/                request and response models
frontend/
  src/
    api/                    typed client + SSE reader
    store/                  zustand store
    components/chat/        chat panel, messages, composer
    components/editor/      document panel, three editors, toolbars, export
    lib/                    markdown conversion, font-size extension, constants
    styles/                 theme + editor styles
```

## Notes

- SQLite tables are created on boot; no migration step.
- Editor changes autosave ~0.7 s after you stop typing, and always before an export.
- Without a valid `GOOGLE_API_KEY` the app still runs — chat returns a clear error and
  the document editors and exports work on their own.
