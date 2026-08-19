import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

export function ToolButton({ icon: Icon, label, onClick, active, disabled }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? ' is-active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

interface ToolSelectProps<T extends string | number> {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  title: string;
  width?: number;
}

export function ToolSelect<T extends string | number>({
  value,
  options,
  onChange,
  title,
  width = 130,
}: ToolSelectProps<T>) {
  return (
    <select
      className="tool-select"
      style={{ width }}
      title={title}
      aria-label={title}
      value={String(value)}
      onMouseDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        const found = options.find((option) => String(option.value) === event.target.value);
        if (found) onChange(found.value);
      }}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ToolDivider() {
  return <span className="tool-divider" aria-hidden="true" />;
}

interface PopoverProps {
  icon: LucideIcon;
  label: string;
  swatch?: string;
  children: (close: () => void) => ReactNode;
}

/** Small dropdown used for colour palettes and the table menu. */
export function ToolPopover({ icon: Icon, label, swatch, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="tool-popover" ref={ref}>
      <button
        type="button"
        className={`tool-btn${open ? ' is-active' : ''}`}
        title={label}
        aria-label={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon size={16} strokeWidth={2} />
        {swatch && <span className="tool-swatch" style={{ background: swatch }} />}
      </button>
      {open && <div className="tool-popover-panel">{children(() => setOpen(false))}</div>}
    </div>
  );
}

interface ColorGridProps {
  colors: string[];
  onPick: (color: string) => void;
  onClear?: () => void;
  clearLabel?: string;
}

export function ColorGrid({ colors, onPick, onClear, clearLabel = 'Remove' }: ColorGridProps) {
  return (
    <div className="color-grid-wrap">
      <div className="color-grid">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className="color-chip"
            style={{ background: color }}
            title={color}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
      <label className="color-custom">
        <span>Custom</span>
        <input type="color" onChange={(event) => onPick(event.target.value)} />
      </label>
      {onClear && (
        <button type="button" className="popover-action" onClick={onClear}>
          {clearLabel}
        </button>
      )}
    </div>
  );
}
