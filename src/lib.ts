import type React from 'react';

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** localStorage wrapper that never throws (private mode, blocked storage…). */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/** Drag a thing by pressing anywhere on `el` (except on text being edited or controls): calls onDrag with the
 *  offset from where the press began. Shared by the studio stage and the landing page. */
export function dragFrom(e: React.PointerEvent<HTMLElement>, onDrag: (phase: 'start' | 'move', dx: number, dy: number) => void) {
  if ((e.target as HTMLElement).closest('.lp-edit, .lp-handle, button, a, input, select, span[title]')) return;
  e.preventDefault();
  const el = e.currentTarget, x0 = e.clientX, y0 = e.clientY;
  el.setPointerCapture(e.pointerId);
  el.classList.add('dragging');
  onDrag('start', 0, 0);
  const move = (m: PointerEvent) => onDrag('move', m.clientX - x0, m.clientY - y0);
  const up = () => {
    el.classList.remove('dragging');
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
