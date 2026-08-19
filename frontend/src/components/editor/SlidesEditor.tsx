import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, ChevronUp, Copy,
  Italic, Layout, Plus, Trash2, Underline as UnderlineIcon,
} from 'lucide-react';

import type { DeckContent, DocumentModel, DocumentPatch, Slide, TextStyle } from '../../api/types';
import { FONT_SIZES, TEXT_COLORS } from '../../lib/constants';
import { ColorGrid, ToolButton, ToolDivider, ToolPopover, ToolSelect } from './ui';

interface Props {
  document: DocumentModel;
  onChange: (patch: DocumentPatch) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** The canvas is authored at PowerPoint's 16:9 point size and scaled to fit. */
const SLIDE_W = 960;
const SLIDE_H = 540;

function blankSlide(title = 'New slide'): Slide {
  return { id: uid(), title, layout: 'bullets', bullets: ['Point one'], body: '', notes: '' };
}

function normalise(content: unknown, fallbackTitle: string): DeckContent {
  const deck = (content ?? {}) as Partial<DeckContent>;
  const slides = (deck.slides ?? []).map((slide) => ({
    id: slide.id ?? uid(),
    title: slide.title ?? '',
    layout: slide.layout === 'title' ? 'title' : 'bullets',
    subtitle: slide.subtitle ?? '',
    bullets: slide.bullets ?? [],
    body: slide.body ?? '',
    notes: slide.notes ?? '',
    titleStyle: slide.titleStyle,
    bodyStyle: slide.bodyStyle,
  })) as Slide[];
  return {
    title: deck.title ?? fallbackTitle,
    slides: slides.length ? slides : [{ ...blankSlide(fallbackTitle), layout: 'title', bullets: [] }],
  };
}

function textCss(style: TextStyle | undefined, defaultSize: number): React.CSSProperties {
  return {
    fontWeight: style?.bold ? 700 : undefined,
    fontStyle: style?.italic ? 'italic' : undefined,
    textDecoration: style?.underline ? 'underline' : undefined,
    textAlign: style?.align,
    color: style?.color,
    fontSize: `${style?.fontSize ?? defaultSize}px`,
    fontFamily: style?.fontFamily,
  };
}

export function SlidesEditor({ document: doc, onChange }: Props) {
  const deck = useMemo(() => normalise(doc.content_json, doc.title), [doc.id, doc.updated_at]);
  const [draft, setDraft] = useState<DeckContent>(deck);
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<'title' | 'body'>('body');
  const signature = useRef(`${doc.id}:${doc.updated_at}`);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  if (signature.current !== `${doc.id}:${doc.updated_at}`) {
    signature.current = `${doc.id}:${doc.updated_at}`;
    setDraft(deck);
    setIndex(0);
  }

  // Keep the authored slide size honest: scale the whole canvas instead of the text,
  // so a 40px title here is still a 40pt title in the exported deck.
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, Math.max(0.2, entry.contentRect.width / SLIDE_W)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const active = draft.slides[Math.min(index, draft.slides.length - 1)];

  const commit = (next: DeckContent) => {
    setDraft(next);
    onChange({ content_json: next as unknown as Record<string, unknown> });
  };

  const patchSlide = (patch: Partial<Slide>) => {
    const slides = draft.slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide));
    commit({ ...draft, slides });
  };

  const styleKey = target === 'title' ? 'titleStyle' : 'bodyStyle';
  const currentStyle: TextStyle = (active?.[styleKey] as TextStyle) ?? {};

  const applyStyle = (patch: TextStyle) => patchSlide({ [styleKey]: { ...currentStyle, ...patch } });

  const addSlide = () => {
    const slides = [...draft.slides];
    slides.splice(index + 1, 0, blankSlide());
    commit({ ...draft, slides });
    setIndex(index + 1);
  };

  const duplicateSlide = () => {
    const slides = [...draft.slides];
    slides.splice(index + 1, 0, { ...active, id: uid() });
    commit({ ...draft, slides });
    setIndex(index + 1);
  };

  const removeSlide = () => {
    if (draft.slides.length <= 1) return;
    const slides = draft.slides.filter((_, i) => i !== index);
    commit({ ...draft, slides });
    setIndex(Math.max(0, index - 1));
  };

  const moveSlide = (delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= draft.slides.length) return;
    const slides = [...draft.slides];
    const [removed] = slides.splice(index, 1);
    slides.splice(to, 0, removed);
    commit({ ...draft, slides });
    setIndex(to);
  };

  if (!active) return <div className="editor-loading">Empty deck</div>;

  return (
    <div className="editor-shell">
      <div className="toolbar" role="toolbar" aria-label="Slide formatting">
        <ToolSelect
          title="Formatting target"
          width={110}
          value={target}
          options={[
            { label: 'Title text', value: 'title' },
            { label: 'Body text', value: 'body' },
          ]}
          onChange={(value) => setTarget(value as 'title' | 'body')}
        />
        <ToolSelect
          title="Font size"
          width={72}
          value={currentStyle.fontSize ? String(currentStyle.fontSize) : ''}
          options={[{ label: 'Size', value: '' }, ...FONT_SIZES.map((s) => ({ label: String(s), value: String(s) }))]}
          onChange={(value) => applyStyle({ fontSize: value ? Number(value) : undefined })}
        />
        <ToolButton icon={Bold} label="Bold" active={!!currentStyle.bold} onClick={() => applyStyle({ bold: !currentStyle.bold })} />
        <ToolButton icon={Italic} label="Italic" active={!!currentStyle.italic} onClick={() => applyStyle({ italic: !currentStyle.italic })} />
        <ToolButton icon={UnderlineIcon} label="Underline" active={!!currentStyle.underline} onClick={() => applyStyle({ underline: !currentStyle.underline })} />
        <ToolPopover icon={Baseline} label="Text colour" swatch={currentStyle.color}>
          {(close) => (
            <ColorGrid
              colors={TEXT_COLORS}
              onPick={(color) => { applyStyle({ color }); close(); }}
              onClear={() => { applyStyle({ color: undefined }); close(); }}
            />
          )}
        </ToolPopover>
        <ToolDivider />
        <ToolButton icon={AlignLeft} label="Align left" active={currentStyle.align === 'left'} onClick={() => applyStyle({ align: 'left' })} />
        <ToolButton icon={AlignCenter} label="Align centre" active={currentStyle.align === 'center'} onClick={() => applyStyle({ align: 'center' })} />
        <ToolButton icon={AlignRight} label="Align right" active={currentStyle.align === 'right'} onClick={() => applyStyle({ align: 'right' })} />
        <ToolDivider />
        <ToolButton
          icon={Layout}
          label={active.layout === 'title' ? 'Switch to content slide' : 'Switch to title slide'}
          active={active.layout === 'title'}
          onClick={() => patchSlide({ layout: active.layout === 'title' ? 'bullets' : 'title' })}
        />
        <ToolButton icon={Plus} label="Add slide" onClick={addSlide} />
        <ToolButton icon={Copy} label="Duplicate slide" onClick={duplicateSlide} />
        <ToolButton icon={ChevronUp} label="Move slide up" onClick={() => moveSlide(-1)} />
        <ToolButton icon={ChevronDown} label="Move slide down" onClick={() => moveSlide(1)} />
        <ToolButton icon={Trash2} label="Delete slide" onClick={removeSlide} disabled={draft.slides.length <= 1} />
      </div>

      <div className="slides-body">
        <aside className="slide-strip" aria-label="Slides">
          {draft.slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              className={`slide-thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
            >
              <span className="slide-thumb-index">{i + 1}</span>
              <span className="slide-thumb-preview">
                <strong>{slide.title || 'Untitled slide'}</strong>
                {slide.layout !== 'title' && <em>{slide.bullets.length} bullets</em>}
              </span>
            </button>
          ))}
        </aside>

        <div className="slide-stage" ref={stageRef}>
          <div className="slide-viewport" style={{ height: SLIDE_H * scale }}>
          <div
            className={`slide-canvas${active.layout === 'title' ? ' is-title' : ''}`}
            style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})` }}
          >
            <textarea
              className="slide-title-input"
              rows={active.layout === 'title' ? 2 : 1}
              style={textCss(active.titleStyle, active.layout === 'title' ? 40 : 30)}
              value={active.title}
              placeholder="Slide title"
              onFocus={() => setTarget('title')}
              onChange={(event) => patchSlide({ title: event.target.value.replace(/\n/g, ' ') })}
            />

            {active.layout === 'title' ? (
              <input
                className="slide-subtitle-input"
                style={textCss(active.bodyStyle, 20)}
                value={active.subtitle ?? ''}
                placeholder="Subtitle or presenter name"
                onFocus={() => setTarget('body')}
                onChange={(event) => patchSlide({ subtitle: event.target.value })}
              />
            ) : (
              <textarea
                className="slide-bullets"
                style={textCss(active.bodyStyle, 18)}
                value={active.bullets.join('\n')}
                placeholder={'One bullet per line'}
                onFocus={() => setTarget('body')}
                onChange={(event) =>
                  patchSlide({ bullets: event.target.value.split('\n').map((line) => line.replace(/^[-*]\s*/, '')) })
                }
              />
            )}
          </div>
          </div>

          <label className="slide-notes">
            <span>Speaker notes</span>
            <textarea
              value={active.notes ?? ''}
              placeholder="Notes are exported into the PowerPoint notes pane"
              onChange={(event) => patchSlide({ notes: event.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
