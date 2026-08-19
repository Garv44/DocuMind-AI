import { FileSpreadsheet, FileText, Loader2, Presentation, X } from 'lucide-react';

import type { DocType } from '../../api/types';
import { DOC_TYPE_LABEL, DOC_TYPE_SHORT } from '../../lib/constants';
import { renderMarkdown } from '../../lib/markdown';
import { useAppStore } from '../../store/useAppStore';
import { ExportMenu } from './ExportMenu';
import { SheetEditor } from './SheetEditor';
import { SlidesEditor } from './SlidesEditor';
import { WordEditor } from './WordEditor';

const ICONS: Record<DocType, typeof FileText> = {
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
};

const SAVE_LABEL = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Save failed',
} as const;

export function DocumentPanel() {
  const document = useAppStore((state) => state.activeDocument);
  const docStreaming = useAppStore((state) => state.docStreaming);
  const docDraft = useAppStore((state) => state.docDraft);
  const docDraftTitle = useAppStore((state) => state.docDraftTitle);
  const docDraftType = useAppStore((state) => state.docDraftType);
  const saveState = useAppStore((state) => state.saveState);
  const closePanel = useAppStore((state) => state.closePanel);
  const updateActiveDocument = useAppStore((state) => state.updateActiveDocument);
  const changeDocType = useAppStore((state) => state.changeDocType);
  const flushSave = useAppStore((state) => state.flushSave);

  if (docStreaming || (!document && docDraft)) {
    const Icon = ICONS[(docDraftType ?? 'doc') as DocType];
    return (
      <section className="doc-panel">
        <header className="doc-header">
          <div className="doc-title-group">
            <Icon size={18} className="doc-icon" />
            <span className="doc-title-static">{docDraftTitle ?? 'Drafting document…'}</span>
          </div>
          <div className="doc-actions">
            <span className="save-state"><Loader2 size={13} className="spin" /> Writing</span>
            <button type="button" className="icon-btn" onClick={closePanel} aria-label="Close panel">
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="doc-stream">
          <div className="page-surface" dangerouslySetInnerHTML={{ __html: renderMarkdown(docDraft) }} />
        </div>
      </section>
    );
  }

  if (!document) {
    return (
      <section className="doc-panel doc-panel-empty">
        <p>No document open.</p>
        <p className="muted">
          Ask the assistant to “create a document about …” or “create a document from this chat”.
        </p>
      </section>
    );
  }

  const Icon = ICONS[document.doc_type];

  return (
    <section className="doc-panel">
      <header className="doc-header">
        <div className="doc-title-group">
          <Icon size={18} className="doc-icon" />
          <input
            className="doc-title-input"
            value={document.title}
            aria-label="Document title"
            onChange={(event) => updateActiveDocument({ title: event.target.value })}
            onBlur={() => void flushSave()}
          />
        </div>

        <div className="doc-actions">
          <div className="mode-switch" role="group" aria-label="Editor mode">
            {(['doc', 'sheet', 'slides'] as DocType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={document.doc_type === type ? 'is-active' : ''}
                title={`Edit as ${DOC_TYPE_LABEL[type]}`}
                onClick={() => void changeDocType(type)}
              >
                {DOC_TYPE_SHORT[type]}
              </button>
            ))}
          </div>
          <span className={`save-state save-${saveState}`}>{SAVE_LABEL[saveState]}</span>
          <ExportMenu document={document} beforeExport={flushSave} />
          <button type="button" className="icon-btn" onClick={closePanel} aria-label="Close panel">
            <X size={16} />
          </button>
        </div>
      </header>

      {document.doc_type === 'sheet' ? (
        <SheetEditor document={document} onChange={updateActiveDocument} />
      ) : document.doc_type === 'slides' ? (
        <SlidesEditor document={document} onChange={updateActiveDocument} />
      ) : (
        <WordEditor document={document} onChange={updateActiveDocument} />
      )}
    </section>
  );
}
