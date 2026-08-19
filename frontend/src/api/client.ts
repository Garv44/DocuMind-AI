import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  DocType,
  DocumentModel,
  DocumentPatch,
  ExportFormat,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text();
    let message = detail;
    try {
      message = JSON.parse(detail).detail ?? detail;
    } catch {
      /* plain text error */
    }
    throw new Error(message || `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ health */
export const getHealth = () =>
  request<{ status: string; model: string; gemini_key_configured: boolean }>('/health');

/* ----------------------------------------------------------- conversations */
export const listConversations = () => request<ConversationSummary[]>('/conversations');

export const getConversation = (id: string) => request<ConversationDetail>(`/conversations/${id}`);

export const createConversation = (title = 'New chat') =>
  request<ConversationSummary>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });

export const renameConversation = (id: string, title: string) =>
  request<ConversationSummary>(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const deleteConversation = (id: string) =>
  request<void>(`/conversations/${id}`, { method: 'DELETE' });

export const listConversationDocuments = (id: string) =>
  request<DocumentModel[]>(`/conversations/${id}/documents`);

/* -------------------------------------------------------------- documents */
export const getDocument = (id: string) => request<DocumentModel>(`/documents/${id}`);

/** Most recent documents; scoped to a conversation when one is given. */
export const listDocuments = (conversationId?: string) =>
  request<DocumentModel[]>(
    `/documents${conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ''}`,
  );

export const createDocument = (payload: {
  title: string;
  doc_type: DocType;
  conversation_id?: string | null;
}) =>
  request<DocumentModel>('/documents', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateDocument = (id: string, patch: DocumentPatch) =>
  request<DocumentModel>(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteDocument = (id: string) =>
  request<void>(`/documents/${id}`, { method: 'DELETE' });

export const getExportFormats = () => request<Record<DocType, ExportFormat[]>>('/documents/formats');

/** Exports the live editor state and hands the file to the browser. */
export async function exportDocument(
  id: string,
  format: ExportFormat,
  state: DocumentPatch,
): Promise<string> {
  const response = await fetch(`${API_BASE}/documents/${id}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, persist: true, ...state }),
  });
  if (!response.ok) {
    throw new Error((await response.text()) || 'Export failed');
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition) ?? /filename="?([^";]+)"?/.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `document.${format}`;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return filename;
}

/* ------------------------------------------------------------------- chat */
export interface ChatStreamHandlers {
  onStart?: (data: { conversation_id: string; message: ChatMessage }) => void;
  onToken?: (text: string) => void;
  onDocStart?: (data: { doc_type: DocType | null; title: string | null }) => void;
  onDocToken?: (text: string) => void;
  onDocument?: (document: DocumentModel) => void;
  onMessage?: (message: ChatMessage) => void;
  onTitle?: (data: { conversation_id: string; title: string }) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/**
 * POSTs a chat turn and consumes the Server-Sent Event stream.
 * EventSource cannot POST, so the stream is parsed manually.
 */
export async function streamChat(
  payload: { message: string; conversation_id?: string | null; force_document?: boolean },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok || !response.body) {
    handlers.onError?.(`Chat request failed (${response.status})`);
    handlers.onDone?.();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (event: string, raw: string) => {
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return;
    }
    switch (event) {
      case 'start':
        handlers.onStart?.(data);
        break;
      case 'token':
        handlers.onToken?.(data.text ?? '');
        break;
      case 'doc_start':
        handlers.onDocStart?.(data);
        break;
      case 'doc_token':
        handlers.onDocToken?.(data.text ?? '');
        break;
      case 'document':
        handlers.onDocument?.(data.document);
        break;
      case 'message':
        handlers.onMessage?.(data.message);
        break;
      case 'title':
        handlers.onTitle?.(data);
        break;
      case 'error':
        handlers.onError?.(data.message ?? 'Unknown error');
        break;
      case 'done':
        handlers.onDone?.();
        break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = 'message';
      const dataLines: string[] = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      dispatch(event, dataLines.join('\n'));
      boundary = buffer.indexOf('\n\n');
    }
  }
}
