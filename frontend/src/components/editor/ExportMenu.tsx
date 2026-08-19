import { useEffect, useRef, useState } from 'react';
import { Check, Download, Loader2 } from 'lucide-react';

import * as api from '../../api/client';
import type { DocumentModel, ExportFormat } from '../../api/types';
import { EXPORT_LABELS, FALLBACK_FORMATS } from '../../lib/constants';

interface Props {
  document: DocumentModel;
  beforeExport: () => Promise<unknown>;
}

export function ExportMenu({ document: doc, beforeExport }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [done, setDone] = useState<ExportFormat | null>(null);
  const [formats, setFormats] = useState<ExportFormat[]>(FALLBACK_FORMATS[doc.doc_type]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getExportFormats()
      .then((map) => setFormats(map[doc.doc_type] ?? FALLBACK_FORMATS[doc.doc_type]))
      .catch(() => setFormats(FALLBACK_FORMATS[doc.doc_type]));
  }, [doc.doc_type]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await beforeExport();
      await api.exportDocument(doc.id, format, {
        title: doc.title,
        markdown: doc.markdown,
        content_html: doc.content_html,
        content_json: doc.content_json as Record<string, unknown> | null,
      });
      setDone(format);
      setTimeout(() => setDone(null), 1800);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-menu" ref={ref}>
      <button type="button" className="btn btn-primary" onClick={() => setOpen((value) => !value)}>
        {busy ? <Loader2 size={15} className="spin" /> : done ? <Check size={15} /> : <Download size={15} />}
        Export
      </button>
      {open && (
        <div className="export-panel">
          <p className="export-hint">Downloads the current editor content.</p>
          {formats.map((format) => (
            <button key={format} type="button" onClick={() => void run(format)} disabled={busy !== null}>
              {EXPORT_LABELS[format]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
