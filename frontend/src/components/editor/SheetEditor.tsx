import { useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Baseline, Bold, Eraser, Italic,
  PaintBucket, Plus, Trash2, Underline as UnderlineIcon,
} from 'lucide-react';

import type { CellStyle, DocumentModel, DocumentPatch, SheetContent } from '../../api/types';
import { COLUMN_LETTERS, FONT_SIZES, HIGHLIGHT_COLORS, TEXT_COLORS } from '../../lib/constants';
import { ColorGrid, ToolButton, ToolDivider, ToolPopover, ToolSelect } from './ui';

interface Props {
  document: DocumentModel;
  onChange: (patch: DocumentPatch) => void;
}

interface CellRef {
  r: number; // -1 = header row
  c: number;
}

const EMPTY: SheetContent = { headers: ['Column A', 'Column B', 'Column C'], rows: [], cellStyles: {} };

function normalise(content: unknown): SheetContent {
  const grid = (content ?? {}) as Partial<SheetContent>;
  const headers = grid.headers?.length ? grid.headers.map(String) : [...EMPTY.headers];
  const width = headers.length;
  const rows = (grid.rows ?? []).map((row) => {
    const cells = (row ?? []).map((cell) => (cell == null ? '' : String(cell)));
    return cells.length >= width ? cells.slice(0, width) : [...cells, ...Array(width - cells.length).fill('')];
  });
  while (rows.length < 12) rows.push(Array(width).fill(''));
  return { headers, rows, cellStyles: grid.cellStyles ?? {}, headerStyle: grid.headerStyle };
}

const key = (r: number, c: number) => (r < 0 ? `h-${c}` : `${r}-${c}`);

function inRange(cell: CellRef, a: CellRef | null, b: CellRef | null): boolean {
  if (!a || !b) return false;
  const [r1, r2] = [Math.min(a.r, b.r), Math.max(a.r, b.r)];
  const [c1, c2] = [Math.min(a.c, b.c), Math.max(a.c, b.c)];
  return cell.r >= r1 && cell.r <= r2 && cell.c >= c1 && cell.c <= c2;
}

function styleToCss(style: CellStyle | undefined, isHeader: boolean): React.CSSProperties {
  return {
    fontWeight: style?.bold ?? isHeader ? 600 : 400,
    fontStyle: style?.italic ? 'italic' : 'normal',
    textDecoration: style?.underline ? 'underline' : 'none',
    textAlign: style?.align ?? 'left',
    color: style?.color,
    background: style?.bg,
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    fontFamily: style?.fontFamily,
  };
}

export function SheetEditor({ document: doc, onChange }: Props) {
  const grid = useMemo(() => normalise(doc.content_json), [doc.id, doc.updated_at]);
  const [draft, setDraft] = useState<SheetContent>(grid);
  const [anchor, setAnchor] = useState<CellRef | null>({ r: 0, c: 0 });
  const [focusCell, setFocusCell] = useState<CellRef | null>({ r: 0, c: 0 });
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const signature = useRef(`${doc.id}:${doc.updated_at}`);

  // Reload when a different document (or a fresh agent revision) arrives.
  if (signature.current !== `${doc.id}:${doc.updated_at}`) {
    signature.current = `${doc.id}:${doc.updated_at}`;
    setDraft(grid);
  }

  const commit = (next: SheetContent) => {
    setDraft(next);
    onChange({ content_json: next as unknown as Record<string, unknown> });
  };

  const selectedCells = (): CellRef[] => {
    if (!anchor || !focusCell) return [];
    const cells: CellRef[] = [];
    for (let r = Math.min(anchor.r, focusCell.r); r <= Math.max(anchor.r, focusCell.r); r += 1) {
      for (let c = Math.min(anchor.c, focusCell.c); c <= Math.max(anchor.c, focusCell.c); c += 1) {
        cells.push({ r, c });
      }
    }
    return cells;
  };

  const activeStyle = (): CellStyle => (anchor ? draft.cellStyles[key(anchor.r, anchor.c)] ?? {} : {});

  const applyStyle = (patch: CellStyle | null) => {
    const cellStyles = { ...draft.cellStyles };
    for (const cell of selectedCells()) {
      const id = key(cell.r, cell.c);
      if (patch === null) delete cellStyles[id];
      else cellStyles[id] = { ...(cellStyles[id] ?? {}), ...patch };
    }
    commit({ ...draft, cellStyles });
  };

  const toggle = (prop: 'bold' | 'italic' | 'underline') => {
    const enabled = !activeStyle()[prop];
    applyStyle({ [prop]: enabled } as CellStyle);
  };

  const setValue = (r: number, c: number, value: string) => {
    if (r < 0) {
      const headers = [...draft.headers];
      headers[c] = value;
      commit({ ...draft, headers });
      return;
    }
    const rows = draft.rows.map((row, index) => (index === r ? [...row] : row));
    rows[r][c] = value;
    commit({ ...draft, rows });
  };

  const addRow = () => {
    const at = (focusCell?.r ?? draft.rows.length - 1) + 1;
    const rows = [...draft.rows];
    rows.splice(Math.max(at, 0), 0, Array(draft.headers.length).fill(''));
    commit({ ...draft, rows });
  };

  const deleteRow = () => {
    if (draft.rows.length <= 1 || !focusCell || focusCell.r < 0) return;
    const rows = draft.rows.filter((_, index) => index !== focusCell.r);
    commit({ ...draft, rows });
  };

  const addColumn = () => {
    const at = (focusCell?.c ?? draft.headers.length - 1) + 1;
    const headers = [...draft.headers];
    headers.splice(at, 0, `Column ${COLUMN_LETTERS(headers.length)}`);
    const rows = draft.rows.map((row) => {
      const copy = [...row];
      copy.splice(at, 0, '');
      return copy;
    });
    commit({ ...draft, headers, rows });
  };

  const deleteColumn = () => {
    if (draft.headers.length <= 1 || !focusCell) return;
    const at = focusCell.c;
    commit({
      ...draft,
      headers: draft.headers.filter((_, index) => index !== at),
      rows: draft.rows.map((row) => row.filter((_, index) => index !== at)),
    });
  };

  const move = (r: number, c: number) => {
    const target = containerRef.current?.querySelector<HTMLInputElement>(
      `input[data-r="${r}"][data-c="${c}"]`,
    );
    if (target) {
      target.focus();
      target.select();
      setAnchor({ r, c });
      setFocusCell({ r, c });
    }
  };

  const onCellKeyDown = (event: React.KeyboardEvent, r: number, c: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      move(Math.min(r + 1, draft.rows.length - 1), c);
    } else if (event.key === 'ArrowDown' && event.metaKey) {
      event.preventDefault();
      move(Math.min(r + 1, draft.rows.length - 1), c);
    } else if (event.key === 'ArrowUp' && event.metaKey) {
      event.preventDefault();
      move(Math.max(r - 1, -1), c);
    }
  };

  const selectionLabel = () => {
    if (!anchor) return '';
    const cells = selectedCells();
    const start = `${COLUMN_LETTERS(anchor.c)}${anchor.r + 2}`;
    return cells.length > 1 ? `${start} · ${cells.length} cells` : start;
  };

  const current = activeStyle();

  return (
    <div className="editor-shell">
      <div className="toolbar" role="toolbar" aria-label="Spreadsheet formatting">
        <span className="cell-ref" title="Selection">{selectionLabel()}</span>
        <ToolDivider />
        <ToolButton icon={Bold} label="Bold" active={!!current.bold} onClick={() => toggle('bold')} />
        <ToolButton icon={Italic} label="Italic" active={!!current.italic} onClick={() => toggle('italic')} />
        <ToolButton icon={UnderlineIcon} label="Underline" active={!!current.underline} onClick={() => toggle('underline')} />
        <ToolSelect
          title="Font size"
          width={72}
          value={current.fontSize ? String(current.fontSize) : ''}
          options={[{ label: 'Size', value: '' }, ...FONT_SIZES.map((s) => ({ label: String(s), value: String(s) }))]}
          onChange={(value) => applyStyle({ fontSize: value ? Number(value) : undefined })}
        />
        <ToolPopover icon={Baseline} label="Text colour" swatch={current.color}>
          {(close) => (
            <ColorGrid
              colors={TEXT_COLORS}
              onPick={(color) => { applyStyle({ color }); close(); }}
              onClear={() => { applyStyle({ color: undefined }); close(); }}
            />
          )}
        </ToolPopover>
        <ToolPopover icon={PaintBucket} label="Fill colour" swatch={current.bg}>
          {(close) => (
            <ColorGrid
              colors={HIGHLIGHT_COLORS}
              onPick={(bg) => { applyStyle({ bg }); close(); }}
              onClear={() => { applyStyle({ bg: undefined }); close(); }}
            />
          )}
        </ToolPopover>
        <ToolDivider />
        <ToolButton icon={AlignLeft} label="Align left" active={current.align === 'left'} onClick={() => applyStyle({ align: 'left' })} />
        <ToolButton icon={AlignCenter} label="Align centre" active={current.align === 'center'} onClick={() => applyStyle({ align: 'center' })} />
        <ToolButton icon={AlignRight} label="Align right" active={current.align === 'right'} onClick={() => applyStyle({ align: 'right' })} />
        <ToolDivider />
        <button type="button" className="tool-text-btn" onClick={addRow}><Plus size={14} /> Row</button>
        <button type="button" className="tool-text-btn" onClick={addColumn}><Plus size={14} /> Column</button>
        <button type="button" className="tool-text-btn" onClick={deleteRow}><Trash2 size={14} /> Row</button>
        <button type="button" className="tool-text-btn" onClick={deleteColumn}><Trash2 size={14} /> Column</button>
        <ToolDivider />
        <ToolButton icon={Eraser} label="Clear formatting" onClick={() => applyStyle(null)} />
      </div>

      <div className="sheet-scroll" ref={containerRef} onMouseUp={() => { dragging.current = false; }}>
        <table className="sheet">
          <thead>
            <tr>
              <th className="sheet-corner" />
              {draft.headers.map((_, index) => (
                <th key={index} className="sheet-col-head">{COLUMN_LETTERS(index)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="sheet-row-head">1</th>
              {draft.headers.map((header, c) => {
                const cell = { r: -1, c };
                return (
                  <td
                    key={c}
                    className={`sheet-cell is-header${inRange(cell, anchor, focusCell) ? ' is-selected' : ''}`}
                    onMouseDown={(event) => {
                      dragging.current = true;
                      if (event.shiftKey) setFocusCell(cell);
                      else { setAnchor(cell); setFocusCell(cell); }
                    }}
                    onMouseEnter={() => dragging.current && setFocusCell(cell)}
                  >
                    <input
                      data-r={-1}
                      data-c={c}
                      value={header}
                      style={styleToCss(draft.cellStyles[key(-1, c)], true)}
                      onChange={(event) => setValue(-1, c, event.target.value)}
                      onFocus={() => { setAnchor(cell); setFocusCell(cell); }}
                      onKeyDown={(event) => onCellKeyDown(event, -1, c)}
                    />
                  </td>
                );
              })}
            </tr>
            {draft.rows.map((row, r) => (
              <tr key={r}>
                <th className="sheet-row-head">{r + 2}</th>
                {row.map((value, c) => {
                  const cell = { r, c };
                  return (
                    <td
                      key={c}
                      className={`sheet-cell${inRange(cell, anchor, focusCell) ? ' is-selected' : ''}`}
                      onMouseDown={(event) => {
                        dragging.current = true;
                        if (event.shiftKey) setFocusCell(cell);
                        else { setAnchor(cell); setFocusCell(cell); }
                      }}
                      onMouseEnter={() => dragging.current && setFocusCell(cell)}
                    >
                      <input
                        data-r={r}
                        data-c={c}
                        value={value}
                        style={styleToCss(draft.cellStyles[key(r, c)], false)}
                        onChange={(event) => setValue(r, c, event.target.value)}
                        onFocus={() => { setAnchor(cell); setFocusCell(cell); }}
                        onKeyDown={(event) => onCellKeyDown(event, r, c)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
