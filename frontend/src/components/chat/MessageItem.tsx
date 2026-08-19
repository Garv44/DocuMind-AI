import { Bot, FileSpreadsheet, FileText, Presentation, User } from 'lucide-react';

import type { ChatMessage, DocType } from '../../api/types';
import { DOC_TYPE_LABEL } from '../../lib/constants';
import { renderMarkdown } from '../../lib/markdown';
import { useAppStore } from '../../store/useAppStore';

const ICONS: Record<DocType, typeof FileText> = {
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
};

export function MessageItem({ message }: { message: ChatMessage }) {
  const documents = useAppStore((state) => state.documents);
  const openDocument = useAppStore((state) => state.openDocument);
  const attached = message.document_id
    ? documents.find((doc) => doc.id === message.document_id)
    : undefined;

  const isUser = message.role === 'user';
  const Icon = attached ? ICONS[attached.doc_type] : FileText;

  return (
    <article className={`msg msg-${message.role}`}>
      <div className="msg-avatar" aria-hidden="true">
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className="msg-body">
        {isUser ? (
          <p className="msg-text">{message.content}</p>
        ) : (
          <div className="msg-text markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
        )}

        {message.document_id && (
          <button type="button" className="doc-card" onClick={() => void openDocument(message.document_id!)}>
            <Icon size={18} />
            <span className="doc-card-text">
              <strong>{attached?.title ?? 'Open document'}</strong>
              <em>{attached ? DOC_TYPE_LABEL[attached.doc_type] : 'Click to open in the editor'}</em>
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
