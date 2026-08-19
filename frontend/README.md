# DocuMind AI — Frontend

React + Vite + TypeScript single-page app: the chat panel and the three document editors.
See the [root README](../README.md) for the full picture.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:8000`, so start the
[backend](../backend/README.md) alongside it. Other scripts:

```bash
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
```

## Layout

```
src/
├── main.tsx              entry
├── App.tsx               layout: sidebar + chat + resizable document panel
├── api/
│   ├── client.ts         typed REST client + SSE stream reader
│   └── types.ts          shared types
├── store/
│   └── useAppStore.ts    zustand store (chat, documents, autosave)
├── components/
│   ├── chat/             ChatPanel · MessageItem · Composer
│   ├── editor/           DocumentPanel · WordEditor · SheetEditor
│   │                     · SlidesEditor · toolbars · ExportMenu
│   └── layout/           Sidebar
├── lib/
│   ├── markdown.ts       markdown ↔ HTML (marked / turndown)
│   ├── fontSize.ts       TipTap font-size extension (points)
│   └── constants.ts      fonts, colours, export labels
└── styles/               theme + editor styles
```

## The three editors

| Type | Component | Built on |
|------|-----------|----------|
| Doc | `WordEditor` | [TipTap](https://tiptap.dev) rich-text |
| Sheet | `SheetEditor` | custom grid with range selection & per-cell styles |
| Slides | `SlidesEditor` | custom 16:9 canvas + thumbnail strip |

All three share the export flow (`ExportMenu`) and autosave through the store,
which debounces `PATCH /api/documents/{id}` ~0.7s after you stop typing and
always flushes before an export.

## Configuration

Set `VITE_API_BASE` to point at a backend on another host (defaults to the dev
proxy at `/api`). `PORT` overrides the dev-server port if 5173 is taken.
