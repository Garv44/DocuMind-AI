import { useEffect, useState } from 'react';
import {
  FilePlus2, FileSpreadsheet, FileText, MessageSquarePlus, Presentation, Sparkles, Trash2,
} from 'lucide-react';

import type { DocType } from '../../api/types';
import { useAppStore } from '../../store/useAppStore';

const NEW_DOC_OPTIONS: { type: DocType; label: string; icon: typeof FileText }[] = [
  { type: 'doc', label: 'Blank document', icon: FileText },
  { type: 'sheet', label: 'Blank spreadsheet', icon: FileSpreadsheet },
  { type: 'slides', label: 'Blank deck', icon: Presentation },
];

const DOC_ICONS: Record<DocType, typeof FileText> = {
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
};

export function Sidebar() {
  const conversations = useAppStore((state) => state.conversations);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const documents = useAppStore((state) => state.documents);
  const activeDocument = useAppStore((state) => state.activeDocument);
  const selectConversation = useAppStore((state) => state.selectConversation);
  const startNewConversation = useAppStore((state) => state.startNewConversation);
  const removeConversation = useAppStore((state) => state.removeConversation);
  const openDocument = useAppStore((state) => state.openDocument);
  const createBlankDocument = useAppStore((state) => state.createBlankDocument);
  const [showNewDoc, setShowNewDoc] = useState(false);

  useEffect(() => {
    if (!showNewDoc) return;
    const close = () => setShowNewDoc(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [showNewDoc]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <Sparkles size={18} />
        <span>DocuMind<em>AI</em></span>
      </div>

      <button type="button" className="btn btn-ghost full" onClick={startNewConversation}>
        <MessageSquarePlus size={16} /> New chat
      </button>

      <div className="new-doc">
        <button
          type="button"
          className="btn btn-ghost full"
          onClick={(event) => {
            event.stopPropagation();
            setShowNewDoc((value) => !value);
          }}
        >
          <FilePlus2 size={16} /> New document
        </button>
        {showNewDoc && (
          <div className="new-doc-menu">
            {NEW_DOC_OPTIONS.map(({ type, label, icon: Icon }) => (
              <button key={type} type="button" onClick={() => void createBlankDocument(type)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="sidebar-section" aria-label="Conversations">
        <h2>Chats</h2>
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className={`side-item${conversation.id === activeConversationId ? ' is-active' : ''}`}
                onClick={() => void selectConversation(conversation.id)}
              >
                <span>{conversation.title}</span>
              </button>
              <button
                type="button"
                className="side-delete"
                aria-label={`Delete ${conversation.title}`}
                onClick={() => void removeConversation(conversation.id)}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
          {conversations.length === 0 && <li className="side-empty">No chats yet</li>}
        </ul>
      </nav>

      {documents.length > 0 && (
        <nav className="sidebar-section" aria-label="Documents">
          <h2>Documents</h2>
          <ul>
            {documents.map((document) => {
              const Icon = DOC_ICONS[document.doc_type];
              return (
                <li key={document.id}>
                  <button
                    type="button"
                    className={`side-item${document.id === activeDocument?.id ? ' is-active' : ''}`}
                    onClick={() => void openDocument(document.id)}
                  >
                    <Icon size={13} />
                    <span>{document.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </aside>
  );
}
