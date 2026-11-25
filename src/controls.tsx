import { useId, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { clamp } from './lib';
import { ChevronUpDown, Plus } from './icons';

/* All controls are designed for the dark settings panel. */

export function Group({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="group">
      <header className="group-head">
        <h3>{title}</h3>
        {action}
      </header>
      <div className="group-body">{children}</div>
    </section>
  );
}

/** The whole row is the slider: drag anywhere across it. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = clamp((value - min) / (max - min)) * 100;
  return (
    <label className="row slider-row" style={{ ['--pct' as string]: `${pct}%` }}>
      <span className="fill" aria-hidden />
      <span className="row-label">{label}</span>
      <span className="row-value">{format ? format(value) : value}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <label className="row select-row">
      <span className="row-label">{label}</span>
      <span className="row-value">
        {current}
        <ChevronUpDown className="row-icon" />
      </span>
      <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="row color-row">
      <label htmlFor={id} className="row-label">
        {label}
      </label>
      <span className="row-value">
        <input
          className="hex"
          defaultValue={value}
          key={value}
          spellCheck={false}
          aria-label={`${label} hex`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (/^#?[0-9a-f]{6}$/i.test(v)) onChange(v.startsWith('#') ? v : `#${v}`);
            else e.target.value = value;
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="swatch" style={{ background: value }}>
          <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </span>
      </span>
    </div>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row toggle-row">
      <span className="row-label">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}

export function TextRow({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="row text-row">
      <span className="row-label">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** A 2D pad: drag the knob to set two values at once (both 0..1). */
export function XYPad({
  x,
  y,
  onChange,
  labels,
}: {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  labels: { top: string; bottom: string; left: string; right: string };
}) {
  const ref = useRef<HTMLDivElement>(null);

  const fromPointer = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const inset = 18;
    onChange(
      clamp((e.clientX - r.left - inset) / (r.width - inset * 2)),
      clamp((e.clientY - r.top - inset) / (r.height - inset * 2)),
    );
  };

  const onKey = (e: KeyboardEvent) => {
    const s = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-s, 0],
      ArrowRight: [s, 0],
      ArrowUp: [0, -s],
      ArrowDown: [0, s],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange(clamp(x + m[0]), clamp(y + m[1]));
  };

  return (
    <div
      ref={ref}
      className="xy-pad"
      role="slider"
      tabIndex={0}
      aria-label={`${labels.left} to ${labels.right}, ${labels.top} to ${labels.bottom}`}
      aria-valuetext={`${Math.round(x * 100)}% ${labels.right.toLowerCase()}, ${Math.round(y * 100)}% ${labels.bottom.toLowerCase()}`}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        fromPointer(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
    >
      <span className="xy-label top">{labels.top}</span>
      <span className="xy-label bottom">{labels.bottom}</span>
      <span className="xy-label left">{labels.left}</span>
      <span className="xy-label right">{labels.right}</span>
      <span className="xy-cross" aria-hidden />
      <span
        className="xy-knob"
        style={{ left: `calc(18px + (100% - 36px) * ${x})`, top: `calc(18px + (100% - 36px) * ${y})` }}
      />
    </div>
  );
}

/** A strip of swatches with a custom-colour button at the end. */
export function ColorStrip({
  value,
  colors,
  onChange,
}: {
  value: string;
  colors: string[];
  onChange: (v: string) => void;
}) {
  const isCustom = !colors.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className="strip-wrap">
      <div className="strip" role="radiogroup" aria-label="Accent colour">
        {colors.map((c) => {
          const on = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              role="radio"
              aria-checked={on}
              aria-label={c}
              className={on ? 'on' : ''}
              style={{ background: c }}
              onClick={() => onChange(c)}
            />
          );
        })}
      </div>
      <label className={`strip-add ${isCustom ? 'on' : ''}`} style={isCustom ? { background: value } : undefined}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom accent" />
        {!isCustom && <Plus />}
      </label>
    </div>
  );
}
