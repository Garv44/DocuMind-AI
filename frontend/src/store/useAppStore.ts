import { create } from 'zustand';
import * as api from '../api/client';
import type {
  ChatMessage,
  ConversationSummary,
  DocType,
  DocumentModel,
  DocumentPatch,
} from '../api/types';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AppState {
  /* chat */
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  streamingReply: string;
  isStreaming: boolean;
  error: string | null;

  /* documents */
  documents: DocumentModel[];
  activeDocument: DocumentModel | null;
  panelOpen: boolean;
  docStreaming: boolean;
  docDraft: string;
  docDraftTitle: string | null;
  docDraftType: DocType | null;
  saveState: SaveState;
  modelReady: boolean;

  bootstrap: () => Promise<void>;
  loadConversations: () => Promise<void>;
  loadRecentDocuments: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  removeConversation: (id: string) => Promise<void>;
  sendMessage: (text: string, forceDocument?: boolean) => Promise<void>;
  stopStreaming: () => void;

  openDocument: (id: string) => Promise<void>;
  createBlankDocument: (docType: DocType) => Promise<void>;
  closePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  updateActiveDocument: (patch: DocumentPatch) => void;
  changeDocType: (docType: DocType) => Promise<void>;
  flushSave: () => Promise<DocumentModel | null>;
  dismissError: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  streamingReply: '',
  isStreaming: false,
  error: null,

  documents: [],
  activeDocument: null,
  panelOpen: false,
  docStreaming: false,
  docDraft: '',
  docDraftTitle: null,
  docDraftType: null,
  saveState: 'idle',
  modelReady: true,

  async bootstrap() {
    try {
      const health = await api.getHealth();
      set({ modelReady: health.gemini_key_configured });
      if (!health.gemini_key_configured) {
        set({
          error:
            'No Gemini API key configured. Add GOOGLE_API_KEY to backend/.env and restart the backend.',
        });
      }
    } catch {
      set({ error: 'Backend is unreachable. Start it with: uvicorn app.main:app --reload' });
    }
    await Promise.all([get().loadConversations(), get().loadRecentDocuments()]);
  },

  async loadConversations() {
    try {
      set({ conversations: await api.listConversations() });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  /** Documents that are not tied to the open chat still deserve a home in the sidebar. */
  async loadRecentDocuments() {
    try {
      set({ documents: await api.listDocuments() });
    } catch {
      /* the toast from bootstrap already covers a dead backend */
    }
  },

  async selectConversation(id) {
    try {
      const [detail, documents] = await Promise.all([
        api.getConversation(id),
        api.listConversationDocuments(id),
      ]);
      set({
        activeConversationId: id,
        messages: detail.messages,
        documents,
        streamingReply: '',
        docDraft: '',
        docStreaming: false,
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  startNewConversation() {
    set({
      activeConversationId: null,
      messages: [],
      documents: [],
      activeDocument: null,
      panelOpen: false,
      streamingReply: '',
      docDraft: '',
      docStreaming: false,
    });
    void get().loadRecentDocuments();
  },

  async removeConversation(id) {
    try {
      await api.deleteConversation(id);
      const isActive = get().activeConversationId === id;
      set((state) => ({ conversations: state.conversations.filter((c) => c.id !== id) }));
      if (isActive) get().startNewConversation();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async sendMessage(text, forceDocument = false) {
    if (get().isStreaming || !text.trim()) return;

    abortController = new AbortController();
    set({ isStreaming: true, streamingReply: '', error: null });

    await api.streamChat(
      {
        message: text,
        conversation_id: get().activeConversationId,
        force_document: forceDocument,
      },
      {
        onStart: ({ conversation_id, message }) => {
          set((state) => ({
            activeConversationId: conversation_id,
            messages: [...state.messages, message],
          }));
        },
        onToken: (token) => set((state) => ({ streamingReply: state.streamingReply + token })),
        onDocStart: ({ doc_type, title }) =>
          set({
            docStreaming: true,
            panelOpen: true,
            docDraft: '',
            docDraftTitle: title,
            docDraftType: doc_type,
            activeDocument: null,
          }),
        onDocToken: (token) => set((state) => ({ docDraft: state.docDraft + token })),
        onDocument: (document) =>
          set((state) => ({
            activeDocument: document,
            documents: [document, ...state.documents.filter((d) => d.id !== document.id)],
            docStreaming: false,
            panelOpen: true,
            saveState: 'idle',
          })),
        onMessage: (message) =>
          set((state) => ({ messages: [...state.messages, message], streamingReply: '' })),
        onTitle: ({ conversation_id, title }) =>
          set((state) => ({
            conversations: state.conversations.some((c) => c.id === conversation_id)
              ? state.conversations.map((c) => (c.id === conversation_id ? { ...c, title } : c))
              : [
                  {
                    id: conversation_id,
                    title,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  ...state.conversations,
                ],
          })),
        onError: (message) => set({ error: message }),
        onDone: () => {
          set({ isStreaming: false, docStreaming: false, streamingReply: '' });
          void get().loadConversations();
        },
      },
      abortController.signal,
    ).catch((err) => {
      if ((err as Error).name !== 'AbortError') set({ error: (err as Error).message });
      set({ isStreaming: false, docStreaming: false });
    });
  },

  stopStreaming() {
    abortController?.abort();
    abortController = null;
    set({ isStreaming: false, docStreaming: false });
  },

  async openDocument(id) {
    try {
      const document = await api.getDocument(id);
      set({ activeDocument: document, panelOpen: true, docStreaming: false, saveState: 'idle' });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async createBlankDocument(docType) {
    try {
      const titles: Record<DocType, string> = {
        doc: 'Untitled document',
        sheet: 'Untitled sheet',
        slides: 'Untitled deck',
      };
      const document = await api.createDocument({
        title: titles[docType],
        doc_type: docType,
        conversation_id: get().activeConversationId,
      });
      set((state) => ({
        activeDocument: document,
        documents: [document, ...state.documents],
        panelOpen: true,
        docStreaming: false,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  closePanel() {
    set({ panelOpen: false });
  },

  setPanelOpen(open) {
    set({ panelOpen: open });
  },

  /** Optimistic local update + debounced persistence. */
  updateActiveDocument(patch) {
    const current = get().activeDocument;
    if (!current) return;

    const next = { ...current, ...patch } as DocumentModel;
    set((state) => ({
      activeDocument: next,
      documents: state.documents.map((d) => (d.id === next.id ? next : d)),
      saveState: 'saving',
    }));

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void get().flushSave();
    }, 700);
  },

  /** Re-open the same content in a different editor; the backend rebuilds the payload. */
  async changeDocType(docType) {
    const document = get().activeDocument;
    if (!document || document.doc_type === docType) return;
    await get().flushSave();
    try {
      const updated = await api.updateDocument(document.id, { doc_type: docType });
      set((state) => ({
        activeDocument: updated,
        documents: state.documents.map((d) => (d.id === updated.id ? updated : d)),
        saveState: 'saved',
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const document = get().activeDocument;
    if (!document) return null;
    try {
      const saved = await api.updateDocument(document.id, {
        title: document.title,
        markdown: document.markdown,
        content_html: document.content_html,
        content_json: document.content_json as Record<string, unknown> | null,
      });
      set((state) => ({
        saveState: 'saved',
        documents: state.documents.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)),
      }));
      return saved;
    } catch (err) {
      set({ saveState: 'error', error: (err as Error).message });
      return null;
    }
  },

  dismissError() {
    set({ error: null });
  },
}));
