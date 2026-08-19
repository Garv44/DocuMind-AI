import type { Editor } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, Columns3, Eraser,
  Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Rows3, Strikethrough,
  Table as TableIcon, Trash2, Underline as UnderlineIcon, Undo2, Highlighter, Code2,
} from 'lucide-react';

import { FONT_FAMILIES, FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS } from '../../lib/constants';
import { ColorGrid, ToolButton, ToolDivider, ToolPopover, ToolSelect } from './ui';

const BLOCK_OPTIONS = [
  { label: 'Normal text', value: 'paragraph' },
  { label: 'Heading 1', value: 'h1' },
  { label: 'Heading 2', value: 'h2' },
  { label: 'Heading 3', value: 'h3' },
  { label: 'Heading 4', value: 'h4' },
  { label: 'Code block', value: 'code' },
];

export function WordToolbar({ editor }: { editor: Editor }) {
  const currentBlock = () => {
    for (const level of [1, 2, 3, 4] as const) {
      if (editor.isActive('heading', { level })) return `h${level}`;
    }
    if (editor.isActive('codeBlock')) return 'code';
    return 'paragraph';
  };

  const applyBlock = (value: string) => {
    const chain = editor.chain().focus();
    if (value === 'paragraph') chain.setParagraph().run();
    else if (value === 'code') chain.toggleCodeBlock().run();
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 }).run();
  };

  const currentFont = () => {
    const family = editor.getAttributes('textStyle').fontFamily as string | undefined;
    return FONT_FAMILIES.find((f) => f.value === family)?.value ?? '';
  };

  const currentSize = () => {
    const size = editor.getAttributes('textStyle').fontSize as string | undefined;
    return size ? String(parseFloat(size)) : '';
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="Document formatting">
      <ToolButton icon={Undo2} label="Undo (⌘Z)" onClick={() => editor.chain().focus().undo().run()} />
      <ToolButton icon={Redo2} label="Redo (⌘⇧Z)" onClick={() => editor.chain().focus().redo().run()} />
      <ToolDivider />

      <ToolSelect
        title="Paragraph style"
        width={130}
        value={currentBlock()}
        options={BLOCK_OPTIONS}
        onChange={applyBlock}
      />
      <ToolSelect
        title="Font"
        width={140}
        value={currentFont()}
        options={[{ label: 'Font', value: '' }, ...FONT_FAMILIES]}
        onChange={(value) =>
          value
            ? editor.chain().focus().setFontFamily(value).run()
            : editor.chain().focus().unsetFontFamily().run()
        }
      />
      <ToolSelect
        title="Font size"
        width={72}
        value={currentSize()}
        options={[
          { label: 'Size', value: '' },
          ...FONT_SIZES.map((size) => ({ label: String(size), value: String(size) })),
        ]}
        onChange={(value) =>
          value
            ? editor.chain().focus().setFontSize(`${value}pt`).run()
            : editor.chain().focus().unsetFontSize().run()
        }
      />
      <ToolDivider />

      <ToolButton icon={Bold} label="Bold (⌘B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolButton icon={Italic} label="Italic (⌘I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolButton icon={UnderlineIcon} label="Underline (⌘U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolButton icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <ToolButton icon={Code2} label="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />

      <ToolPopover icon={Baseline} label="Text colour" swatch={editor.getAttributes('textStyle').color as string | undefined}>
        {(close) => (
          <ColorGrid
            colors={TEXT_COLORS}
            onPick={(color) => { editor.chain().focus().setColor(color).run(); close(); }}
            onClear={() => { editor.chain().focus().unsetColor().run(); close(); }}
            clearLabel="Default colour"
          />
        )}
      </ToolPopover>

      <ToolPopover icon={Highlighter} label="Highlight" swatch={editor.getAttributes('highlight').color as string | undefined}>
        {(close) => (
          <ColorGrid
            colors={HIGHLIGHT_COLORS}
            onPick={(color) => { editor.chain().focus().toggleHighlight({ color }).run(); close(); }}
            onClear={() => { editor.chain().focus().unsetHighlight().run(); close(); }}
            clearLabel="No highlight"
          />
        )}
      </ToolPopover>
      <ToolDivider />

      <ToolButton icon={AlignLeft} label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
      <ToolButton icon={AlignCenter} label="Align centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
      <ToolButton icon={AlignRight} label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
      <ToolButton icon={AlignJustify} label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
      <ToolDivider />

      <ToolButton icon={List} label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolButton icon={Quote} label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolButton icon={Minus} label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} />

      <ToolButton
        icon={Link2}
        label="Link"
        active={editor.isActive('link')}
        onClick={() => {
          const previous = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt('Link URL', previous ?? 'https://');
          if (url === null) return;
          if (url === '') editor.chain().focus().unsetLink().run();
          else editor.chain().focus().setLink({ href: url }).run();
        }}
      />

      <ToolPopover icon={TableIcon} label="Table">
        {(close) => (
          <div className="popover-menu">
            <button type="button" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); close(); }}>
              <TableIcon size={14} /> Insert 3 × 3 table
            </button>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>
              <Rows3 size={14} /> Add row
            </button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <Columns3 size={14} /> Add column
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>
              <Trash2 size={14} /> Delete row
            </button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>
              <Trash2 size={14} /> Delete column
            </button>
            <button type="button" onClick={() => { editor.chain().focus().deleteTable().run(); close(); }}>
              <Trash2 size={14} /> Delete table
            </button>
          </div>
        )}
      </ToolPopover>

      <ToolDivider />
      <ToolButton
        icon={Eraser}
        label="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      />
    </div>
  );
}
