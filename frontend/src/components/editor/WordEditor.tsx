import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Underline from '@tiptap/extension-underline';

import type { DocumentModel, DocumentPatch } from '../../api/types';
import { FontSize } from '../../lib/fontSize';
import { htmlToMarkdown, renderMarkdown } from '../../lib/markdown';
import { WordToolbar } from './WordToolbar';

interface Props {
  document: DocumentModel;
  onChange: (patch: DocumentPatch) => void;
}

export function WordEditor({ document, onChange }: Props) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
        Underline,
        TextStyle,
        Color,
        FontFamily.configure({ types: ['textStyle'] }),
        FontSize,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Link.configure({ openOnClick: false, autolink: true }),
        Image.configure({ inline: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({ placeholder: 'Start writing, or ask the assistant to draft something…' }),
      ],
      content: document.content_html ?? renderMarkdown(document.markdown),
      editorProps: {
        attributes: { class: 'page-surface', spellcheck: 'true' },
      },
      onUpdate: ({ editor: instance }) => {
        const html = instance.getHTML();
        onChange({ content_html: html, markdown: htmlToMarkdown(html) });
      },
    },
    [document.id],
  );

  // Keep the editor in sync when the agent rewrites the same document.
  useEffect(() => {
    if (!editor) return;
    const incoming = document.content_html ?? renderMarkdown(document.markdown);
    if (incoming && incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.updated_at]);

  if (!editor) return <div className="editor-loading">Loading editor…</div>;

  return (
    <div className="editor-shell">
      <WordToolbar editor={editor} />
      <div className="page-scroll">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
