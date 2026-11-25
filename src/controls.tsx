import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type React from 'react';
import { clamp } from './lib';
import { ChevronUpDown, Plus } from './icons';

/* All controls are designed for the dark settings panel. */

/* ---------- the accordion: groups fold and unfold, and the panel remembers which are open ---------- */

const OPEN_KEY = 'coin-loop.open.v1';
type OpenState = Record<string, boolean>;
const openStore = {
  get(): OpenState { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'); } catch { return {}; } },
  set(v: OpenState) { try { localStorage.setItem(OPEN_KEY, JSON.stringify(v)); } catch { /* ignore */ } },
};
const AccordionCtx = createContext<{ scope: string; open: OpenState; toggle: (id: string, def: boolean) => void }>({
  scope: '', open: {}, toggle: () => {},
});

/** Wraps the panel: holds which groups are open (per scope, e.g. studio or landing) and lets them fold all at once. */
export function Accordion({ scope, children }: { scope: string; children: ReactNode }) {
  const [open, setOpen] = useState<OpenState>(openStore.get);
  const toggle = (id: string, def: boolean) =>
    setOpen((o) => {
      const n = { ...o, [id]: !(o[id] ?? def) };
      openStore.set(n);
      return n;
    });
  return <AccordionCtx.Provider value={{ scope, open, toggle }}>{children}</AccordionCtx.Provider>;
}

export function Group({ title, action, children, open: defaultOpen = true }: { title: string; action?: ReactNode; children: ReactNode; open?: boolean }) {
  const { scope, open, toggle } = useContext(AccordionCtx);
  const id = `${scope}:${title}`;
  const isOpen = open[id] ?? defaultOpen;
  const bodyId = useId();
  return (
    <section className={`group ${isOpen ? 'is-open' : 'is-closed'}`} data-group={title}>
      <header className="group-head">
        <button type="button" className="group-toggle" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggle(id, defaultOpen)}>
          <svg className="group-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3>{title}</h3>
        </button>
        {isOpen && action}
      </header>
      {isOpen && (
        <div className="group-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Collapse all / expand all, for the panel header: acts on the groups currently in the panel. */
export function FoldAll({ panel }: { panel: React.RefObject<HTMLElement> }) {
  const ctx = useContext(AccordionCtx);
  const [next, setNext] = useState<'collapse' | 'expand'>('collapse');
  return (
    <button
      type="button"
      className="panel-action"
      onClick={() => {
        const v = next === 'expand';
        panel.current?.querySelectorAll<HTMLElement>('[data-group]').forEach((g) => {
          const cur = g.classList.contains('is-open');
          if (cur !== v) ctx.toggle(`${ctx.scope}:${g.dataset.group}`, cur);
        });
        setNext(v ? 'collapse' : 'expand');
      }}
    >
      {next === 'collapse' ? 'Collapse all' : 'Expand all'}
    </button>
  );
}

/** The whole row is the slider: drag anywhere across it. Double-click it to type an exact number, which may go beyond
 *  the slider's range (Enter sets it, Escape cancels). */
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
  const [typing, setTyping] = useState(false);
  // the value before a double-click's first click (which moves the slider): restored when typing opens
  const before = useRef({ v: value, t: 0 });
  const pct = clamp((value - min) / (max - min)) * 100;
  const commit = (raw: string) => {
    const v = parseFloat(raw.replace(/[^0-9.+-]/g, ''));
    if (Number.isFinite(v)) onChange(raw.trim().endsWith('%') ? v / 100 : v);
    setTyping(false);
  };
  return (
    <label
      className="row slider-row"
      style={{ ['--pct' as string]: `${pct}%` }}
      onPointerDownCapture={() => {
        const now = performance.now();
        if (now - before.current.t > 450) before.current = { v: value, t: now };
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        if (before.current.v !== value) onChange(before.current.v);
        setTyping(true);
      }}
    >
      <span className="fill" aria-hidden />
      <span className="row-label">{label}</span>
      {typing ? (
        <input
          className="row-type"
          autoFocus
          defaultValue={String(+before.current.v.toFixed(4))}
          aria-label={`${label}, exact value`}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit(e.currentTarget.value);
            if (e.key === 'Escape') setTyping(false);
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      ) : (
        <span className="row-value">{format ? format(value) : value}</span>
      )}
      {!typing && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
    </label>
  );
}

/** A dropdown drawn in the page rather than the browser's own menu: the browser's menu opens in the wrong place (or
 *  not at all) when the tool runs inside a scaled frame, as it does on a deck slide. Click or Enter/Space to open,
 *  ↑ ↓ to move, Enter to choose, Escape or a click outside to close. */
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
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value)?.label ?? value;

  const show = () => {
    const r = btn.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom, need = Math.min(280, options.length * 34 + 12);
    setPos(below >= need || below > r.top ? { left: r.left, width: r.width, top: r.bottom + 4 } : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 });
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };

  // close on a click anywhere else, or when the panel scrolls or the window resizes
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('resize', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) (e.preventDefault(), show());
      return;
    }
    e.preventDefault();
    e.stopPropagation(); // not the deck's slide keys
    if (e.key === 'ArrowDown') setHi((h) => Math.min(options.length - 1, h + 1));
    else if (e.key === 'ArrowUp') setHi((h) => Math.max(0, h - 1));
    else if (e.key === 'Enter' || e.key === ' ') choose(hi);
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`row select-row ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span className="row-label">{label}</span>
        <span className="row-value">
          {current}
          <ChevronUpDown className="row-icon" />
        </span>
      </button>
      {open && (
        <div ref={menu} id={listId} role="listbox" aria-label={label} className="select-menu" style={{ position: 'fixed', ...pos }}>
          {options.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled}
              className={`select-option ${i === hi ? 'hi' : ''} ${o.value === value ? 'on' : ''}`}
              onPointerEnter={() => setHi(i)}
              onClick={() => choose(i)}
            >
              {o.label}
              {o.value === value && <span className="select-tick">✓</span>}
            </div>
          ))}
        </div>
      )}
    </>
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
