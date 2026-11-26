import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { dragFrom } from './lib';

/**
 * The Camba landing page, with the coin loop as its hero. Every piece of text is editable in place: click it and
 * type. The page's colours, type and sizes come from the panel (LandingParams).
 */

/** Every colour on the page. With `auto` on, only `bg` and `ink` are chosen; the rest follow them (see themed()). */
export interface PageColors {
  bg: string; // the page
  ink: string; // headline and logo
  sub: string; // subtitle
  nav: string; // navigation links
  primary: string; // the filled button (Open Account)
  primaryText: string;
  secondary: string; // the light button (Sign in)
  secondaryText: string;
}

export type Layout = 'centered' | 'split' | 'editorial' | 'card';

/** What each layout is, the paths that suit it, and the hero sizes it starts from when you switch to it. */
export const LAYOUTS: Record<Layout, { name: string; suits: string; start: Partial<LandingParams> }> = {
  centered: { name: 'Centred', suits: 'Ring, Market, Cradle, Wave', start: { headlineWidth: 960, subWidth: 660, headlineSize: 128, heroTop: 58 } },
  split: { name: 'Split', suits: 'Orbit, Helix, Infinity, Wave (stood upright)', start: { headlineWidth: 620, subWidth: 520, headlineSize: 112, heroTop: 150 } },
  editorial: { name: 'Editorial', suits: 'Market, Ring, Wave across the top', start: { headlineWidth: 980, subWidth: 560, headlineSize: 150, heroTop: 0 } },
  card: { name: 'Card', suits: 'any shape: the card keeps the text readable', start: { headlineWidth: 860, subWidth: 620, headlineSize: 112, heroTop: 110 } },
};

export interface LandingParams {
  layout: Layout;
  colors: PageColors;
  auto: boolean; // derive buttons, nav and subtitle from the background and ink, with readable button text
  font: string; // headline and logo
  body: string; // nav, subtitle, buttons
  headlineSize: number; // px at 1440 wide; scales with the stage
  weight: number;
  subSize: number; // px at 1440 wide
  heroTop: number; // px at 1440 wide, from the header to the headline
  headlineWidth: number; // the headline's text box, px at 1440 wide: drag its sides to change the line length
  subWidth: number; // the subtitle's text box
  radius: number; // button corners, px at 1440 wide (999 = pill)
  buttonHeight: number; // px at 1440 wide
  showNav: boolean;
  text: {
    logo: string;
    nav: string; // comma separated
    signIn: string;
    open: string;
    headline: string;
    sub: string;
    cta: string;
  };
}

/** Black or white, whichever reads better on a colour (WCAG relative luminance). */
export function readableOn(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#000000' : '#ffffff';
}

/** The colours the page actually uses: with auto on, everything follows the background and ink. */
export function themed(l: LandingParams): PageColors {
  const c = l.colors;
  if (!l.auto) return c;
  const secondary = readableOn(c.bg) === '#000000' ? '#ffffff' : '#ffffff';
  return {
    bg: c.bg,
    ink: c.ink,
    sub: c.ink,
    nav: c.ink,
    primary: c.ink,
    primaryText: readableOn(c.ink),
    secondary,
    secondaryText: readableOn(secondary),
  };
}

/** Whole looks: each sets every colour, buttons included. */
export const THEMES: { name: string; colors: PageColors }[] = [
  { name: 'Cyan', colors: { bg: '#1cdde8', ink: '#000000', sub: '#000000', nav: '#000000', primary: '#000000', primaryText: '#ffffff', secondary: '#ffffff', secondaryText: '#000000' } },
  { name: 'Orange', colors: { bg: '#ff6a1f', ink: '#1a0a00', sub: '#2b1305', nav: '#1a0a00', primary: '#1a0a00', primaryText: '#ffffff', secondary: '#fff1e6', secondaryText: '#1a0a00' } },
  { name: 'Lime', colors: { bg: '#c6f432', ink: '#0d1a00', sub: '#1d2e00', nav: '#0d1a00', primary: '#0d1a00', primaryText: '#c6f432', secondary: '#ffffff', secondaryText: '#0d1a00' } },
  { name: 'Violet', colors: { bg: '#7b5cff', ink: '#ffffff', sub: '#ebe5ff', nav: '#ffffff', primary: '#ffffff', primaryText: '#2a1a80', secondary: '#2a1a80', secondaryText: '#ffffff' } },
  { name: 'Midnight', colors: { bg: '#0b0d12', ink: '#ffffff', sub: '#a9b0bd', nav: '#d6dae2', primary: '#1cdde8', primaryText: '#000000', secondary: '#1c2029', secondaryText: '#ffffff' } },
];

export const LANDING: LandingParams = {
  layout: 'centered',
  colors: THEMES[0].colors,
  auto: true,
  font: 'Momo Trust Display',
  body: 'Momo Trust Sans',
  headlineSize: 128,
  weight: 400, // Momo Trust Display has one weight, already heavy; higher weights apply to the other faces
  subSize: 19,
  heroTop: 58,
  headlineWidth: 960,
  subWidth: 660,
  radius: 999,
  buttonHeight: 52,
  showNav: true,
  text: {
    logo: 'Camba',
    nav: 'Credit Card, Accounts, Loan, Resource',
    signIn: 'Sign in',
    open: 'Open Account',
    headline: 'Invest in what matters.',
    sub: 'Manage your stocks, ETFs, crypto, options, futures, and prediction markets. Get started with as little as $1.',
    cta: 'Open Account',
  },
};

export const FONTS = ['Momo Trust Display', 'Momo Trust Sans', 'Plus Jakarta Sans', 'Manrope', 'DM Sans', 'Space Grotesk', 'Inter'];

// The Camba logo (public/brand/camba-logo.svg): the mark and the wordmark, drawn in the page's ink.
const MARK = 'M24.2744 11.3402L11.632 12.7202C10.7102 12.8208 10.0048 13.5875 9.9812 14.5145L9.5363 31.9648C9.51582 32.7678 10.0153 33.4926 10.7731 33.7593L20.5664 37.2064L19.5935 43.9962C19.4135 45.2526 18.0519 45.9599 16.9204 45.3848L1.01271 37.299C0.380661 36.9777 -0.0125638 36.3239 -4.77397e-05 35.615L0.472545 8.8474C0.488422 7.94817 1.14791 7.19026 2.03631 7.05026L22.9398 3.75613C24.1711 3.56209 25.2388 4.61504 25.0619 5.84891L24.2744 11.3402ZM29.1787 38.0109C28.9513 39.1092 27.8078 39.755 26.7498 39.3827L20.5664 37.2064L24.2744 11.3402L32.4105 10.4531C33.6605 10.3168 34.6802 11.4389 34.4253 12.6701L29.1787 38.0109Z';
const WORDMARK = 'M55.2037 39.7297C52.4439 39.7297 50.0639 39.1347 48.0637 37.9447C46.0635 36.7294 44.519 35.0204 43.4303 32.8176C42.3416 30.5895 41.7972 27.9563 41.7972 24.918C41.7972 21.8797 42.3289 19.2592 43.3923 17.0564C44.4811 14.8283 46.0129 13.1193 47.9878 11.9293C49.988 10.714 52.33 10.1063 55.0138 10.1063C57.4191 10.1063 59.508 10.5621 61.2803 11.4736C63.078 12.385 64.4832 13.651 65.4959 15.2714C66.5087 16.8918 67.0404 18.7528 67.091 20.8543H60.4068C60.2042 19.4364 59.6346 18.2717 58.6977 17.3603C57.7863 16.4488 56.5836 15.993 55.0898 15.993C53.0896 15.993 51.5071 16.8032 50.3424 18.4237C49.2031 20.0441 48.6334 22.2215 48.6334 24.956C48.6334 27.6398 49.2031 29.8046 50.3424 31.4504C51.5071 33.0961 53.1529 33.919 55.2797 33.919C56.495 33.919 57.4698 33.6658 58.204 33.1594C58.9636 32.653 59.5333 31.9947 59.9131 31.1845C60.2929 30.349 60.5334 29.4628 60.6347 28.526H67.2809C67.1797 30.8807 66.61 32.8935 65.5719 34.5646C64.5591 36.2357 63.1666 37.5143 61.3942 38.4005C59.6472 39.2866 57.5837 39.7297 55.2037 39.7297ZM79.6602 39.7297C77.736 39.7297 76.0269 39.236 74.5331 38.2485C73.0646 37.2611 71.9126 35.8939 71.077 34.1468C70.2415 32.3998 69.8237 30.3996 69.8237 28.1462C69.8237 25.9434 70.2288 24.0065 71.039 22.3355C71.8493 20.6391 72.9633 19.3225 74.3812 18.3857C75.799 17.4236 77.4321 16.9425 79.2804 16.9425C80.6983 16.9425 81.9516 17.221 83.0403 17.778C84.1544 18.3097 85.0532 19.0566 85.7368 20.0188L86.0786 17.5122H91.1678V39.16H86.0786L85.7368 36.3116C85.0785 37.375 84.2177 38.2106 83.1543 38.8182C82.0909 39.4259 80.9262 39.7297 79.6602 39.7297ZM80.7616 34.3367C82.1795 34.3367 83.3062 33.7797 84.1417 32.6657C84.9772 31.5516 85.395 30.0451 85.395 28.1462C85.395 26.2473 84.9772 24.7534 84.1417 23.6647C83.3062 22.5507 82.1795 21.9937 80.7616 21.9937C79.3184 21.9937 78.179 22.5507 77.3435 23.6647C76.508 24.7534 76.0902 26.2473 76.0902 28.1462C76.0902 30.0451 76.508 31.5516 77.3435 32.6657C78.179 33.7797 79.3184 34.3367 80.7616 34.3367ZM95.0644 39.16V26.2473C95.0644 24.3737 95.4442 22.7279 96.2038 21.31C96.9887 19.8922 98.0648 18.7781 99.432 17.9679C100.799 17.1577 102.369 16.7526 104.141 16.7526C105.736 16.7526 107.205 17.0817 108.547 17.74C109.889 18.3983 110.978 19.3098 111.813 20.4745C112.674 19.3098 113.763 18.3983 115.079 17.74C116.421 17.0817 117.877 16.7526 119.447 16.7526C121.219 16.7526 122.776 17.1577 124.118 17.9679C125.46 18.7781 126.511 19.8922 127.27 21.31C128.03 22.7279 128.41 24.3737 128.41 26.2473V39.16H122.219V26.2473C122.219 25.0826 121.89 24.1331 121.232 23.3989C120.573 22.6646 119.687 22.2975 118.573 22.2975C117.485 22.2975 116.586 22.6646 115.877 23.3989C115.193 24.1331 114.851 25.0826 114.851 26.2473V39.16H108.699V26.2473C108.699 25.0826 108.344 24.1331 107.635 23.3989C106.952 22.6646 106.053 22.2975 104.939 22.2975C103.85 22.2975 102.951 22.6646 102.242 23.3989C101.559 24.1331 101.217 25.0826 101.217 26.2473V39.16H95.0644ZM132.344 39.16V10.676H138.496V19.639C139.205 18.7528 140.066 18.0818 141.079 17.6261C142.117 17.1704 143.231 16.9425 144.421 16.9425C145.56 16.9425 146.712 17.1577 147.877 17.5881C149.042 18.0186 150.105 18.7022 151.067 19.639C152.029 20.5505 152.802 21.7278 153.384 23.171C153.966 24.6142 154.258 26.3612 154.258 28.4121C154.258 30.6148 153.865 32.5771 153.08 34.2988C152.295 35.9951 151.194 37.3244 149.776 38.2865C148.358 39.2486 146.687 39.7297 144.763 39.7297C143.396 39.7297 142.117 39.4132 140.927 38.7802C139.737 38.1219 138.775 37.1851 138.041 35.9698L137.547 39.16H132.344ZM143.13 34.3367C144.624 34.3367 145.801 33.7797 146.662 32.6657C147.548 31.5516 147.991 30.0451 147.991 28.1462C147.991 26.2473 147.548 24.7534 146.662 23.6647C145.801 22.5507 144.624 21.9937 143.13 21.9937C141.712 21.9937 140.585 22.5507 139.75 23.6647C138.914 24.7534 138.496 26.2473 138.496 28.1462C138.496 30.0451 138.914 31.5516 139.75 32.6657C140.585 33.7797 141.712 34.3367 143.13 34.3367ZM166.707 39.7297C164.783 39.7297 163.074 39.236 161.58 38.2485C160.111 37.2611 158.959 35.8939 158.124 34.1468C157.288 32.3998 156.871 30.3996 156.871 28.1462C156.871 25.9434 157.276 24.0065 158.086 22.3355C158.896 20.6391 160.01 19.3225 161.428 18.3857C162.846 17.4236 164.479 16.9425 166.327 16.9425C167.745 16.9425 168.999 17.221 170.087 17.778C171.201 18.3097 172.1 19.0566 172.784 20.0188L173.126 17.5122H178.215V39.16H173.126L172.784 36.3116C172.125 37.375 171.265 38.2106 170.201 38.8182C169.138 39.4259 167.973 39.7297 166.707 39.7297ZM167.809 34.3367C169.226 34.3367 170.353 33.7797 171.189 32.6657C172.024 31.5516 172.442 30.0451 172.442 28.1462C172.442 26.2473 172.024 24.7534 171.189 23.6647C170.353 22.5507 169.226 21.9937 167.809 21.9937C166.365 21.9937 165.226 22.5507 164.39 23.6647C163.555 24.7534 163.137 26.2473 163.137 28.1462C163.137 30.0451 163.555 31.5516 164.39 32.6657C165.226 33.7797 166.365 34.3367 167.809 34.3367Z';

/** The mark on its own (when the name has been edited) or the full logo. */
export function CambaLogo({ color, wordmark = true }: { color: string; wordmark?: boolean }) {
  return wordmark ? (
    <svg className="lp-logo-svg" viewBox="0 0 182 50" fill={color} role="img" aria-label="Camba">
      <path d={MARK} />
      <path d={WORDMARK} />
    </svg>
  ) : (
    <svg className="lp-mark-svg" viewBox="0 3 35 44" fill={color} aria-hidden>
      <path d={MARK} />
    </svg>
  );
}

/* ---------- selecting and editing, the way Figma and Framer do it ----------
 * hover: a thin outline. click: select (a frame; text boxes get resize handles). double-click or Enter: edit the text,
 * caret where you clicked. Escape: stop editing, then deselect. Click the empty page: deselect (and drag the coins). */

interface Sel {
  selected: string | null;
  editing: string | null;
  select: (id: string | null) => void;
  edit: (id: string | null) => void;
}
const SelCtx = createContext<Sel>({ selected: null, editing: null, select: () => {}, edit: () => {} });

/** Put the caret at a screen point (where the double-click landed), or select all if that isn't possible. */
function caretAt(el: HTMLElement, x?: number, y?: number) {
  const sel = window.getSelection()!;
  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const r = x !== undefined && y !== undefined && doc.caretRangeFromPoint ? doc.caretRangeFromPoint(x, y) : null;
  sel.removeAllRanges();
  if (r && el.contains(r.startContainer)) sel.addRange(r);
  else {
    const all = document.createRange();
    all.selectNodeContents(el);
    sel.addRange(all);
  }
}

/** A text box with Figma-style side handles: drag either side to change its width (the text re-wraps into longer or
 *  shorter lines). It's centred, so both sides move together. Double-click a handle to reset. */
function Box({ id, width, onWidth, reset, children, anchored = false }: { id: string; width: number; onWidth: (w: number) => void; reset: number; children: ReactNode; anchored?: boolean }) {
  const { selected, select } = useContext(SelCtx);
  const grab = (e: React.PointerEvent<HTMLElement>, side: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation(); // not a page drag
    select(id);
    const handle = e.currentTarget, box = handle.parentElement!, page = box.closest('.lp') as HTMLElement;
    const k = 1440 / page.clientWidth; // screen px to page px (sizes are set for a 1440-wide page)
    const x0 = e.clientX, w0 = width;
    handle.setPointerCapture(e.pointerId);
    box.classList.add('sizing');
    const move = (m: PointerEvent) => onWidth(Math.round(Math.max(80, Math.min(1440, w0 + side * (anchored ? 1 : 2) * (m.clientX - x0) * k)))); // centred text grows both ways; left-aligned text from its anchored edge
    const up = () => {
      box.classList.remove('sizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };
  return (
    <span
      className={`lp-box ${selected === id ? 'active' : ''}`}
      style={{ width: `calc(${width} / 1440 * 100cqw)` }}
      onPointerDown={(e) => {
        // the box's empty space selects it too, as in Figma
        e.stopPropagation();
        e.preventDefault();
        select(id);
      }}
    >
      {children}
      <i className="lp-handle l" onPointerDown={(e) => grab(e, -1)} onDoubleClick={() => onWidth(reset)} title="Drag to change the line length" />
      <i className="lp-handle r" onPointerDown={(e) => grab(e, 1)} onDoubleClick={() => onWidth(reset)} title="Drag to change the line length" />
      <b className="lp-size">{width}</b>
    </span>
  );
}

/** A piece of text on the page: click to select it, double-click (or Enter) to edit it. Saves when the edit ends. */
function Edit({ id, value, onChange, as: Tag = 'span', multiline, className, style }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  as?: 'span' | 'h1' | 'p';
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { selected, editing, select, edit } = useContext(SelCtx);
  const ref = useRef<HTMLElement>(null);
  const isEditing = editing === id;
  // entering edit mode: focus it (the caret is placed by the double-click, or all of it selected after Enter)
  useEffect(() => {
    if (isEditing && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
      if (!window.getSelection()?.rangeCount || !ref.current.contains(window.getSelection()!.anchorNode)) caretAt(ref.current);
    }
  }, [isEditing]);
  return (
    <Tag
      ref={ref as never}
      data-id={id}
      className={`lp-edit ${selected === id ? 'is-selected' : ''} ${isEditing ? 'is-editing' : ''} ${className ?? ''}`}
      style={style}
      contentEditable={isEditing}
      suppressContentEditableWarning
      spellCheck={false}
      onPointerDown={(e) => {
        e.stopPropagation(); // never a page drag
        if (isEditing) return; // clicking inside the text being edited moves the caret
        e.preventDefault(); // a click selects; it doesn't start typing
        if (editing) (document.activeElement as HTMLElement | null)?.blur(); // finish another edit first
        select(id);
      }}
      onDoubleClick={(e) => {
        const { clientX: x, clientY: y } = e;
        edit(id);
        requestAnimationFrame(() => ref.current && (ref.current.focus(), caretAt(ref.current, x, y)));
      }}
      onKeyDown={(e) => {
        if (!isEditing) return;
        if (e.key === 'Escape' || (e.key === 'Enter' && !multiline)) {
          e.preventDefault();
          e.stopPropagation();
          ref.current?.blur();
        }
      }}
      onBlur={() => {
        if (!isEditing) return;
        const v = ref.current!.innerText.trim();
        edit(null); // stays selected, like Figma
        if (v !== value) onChange(v);
      }}
    >
      {value}
    </Tag>
  );
}

export function Landing({ l, onText, onPage, onDrag, children }: {
  l: LandingParams;
  onPage: (patch: Partial<LandingParams>) => void;
  onText: (patch: Partial<LandingParams['text']>) => void;
  /** a drag on the page (not on its text) moves the coins: start, then pixel offsets from the start */
  onDrag: (phase: 'start' | 'move', dx: number, dy: number) => void;
  children: ReactNode; // the coin canvas host
}) {
  const t = l.text;
  const c = themed(l);
  const anchored = l.layout === 'split' || l.layout === 'editorial'; // left-aligned text
  const px = (v: number) => `calc(${v} / 1440 * 100cqw)`; // sizes are set for a 1440-wide page and scale with it
  const [selected, select] = useState<string | null>(null);
  const [editing, edit] = useState<string | null>(null);
  const sel = useMemo(() => ({ selected, editing, select, edit }), [selected, editing]);

  // with something selected (not being edited): Enter edits it, Escape deselects
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || editing) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea')) return; // typing in the panel
      if (e.key === 'Enter') {
        e.preventDefault();
        edit(selected);
      } else if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, editing]);

  return (
    <SelCtx.Provider value={sel}>
      <div
        className={`lp layout-${l.layout ?? 'centered'}`}
        onPointerDown={(e) => {
          // the empty page: deselect, and drag the coins
          if (editing) (document.activeElement as HTMLElement | null)?.blur();
          select(null);
          dragFrom(e, onDrag);
        }}
        style={{ background: c.bg, color: c.ink, ['--lp-bg' as string]: c.bg, ['--lp-radius' as string]: l.radius >= 999 ? '999px' : px(l.radius), ['--lp-btn-h' as string]: px(l.buttonHeight), ['--lp-sub' as string]: px(l.subSize), ['--lp-top' as string]: px(l.heroTop), fontFamily: `'${l.body}', system-ui, sans-serif`, ['--lp-display' as string]: `'${l.font}', system-ui, sans-serif`, ['--lp-h' as string]: l.headlineSize, ['--lp-w' as string]: l.weight } as CSSProperties}
      >
        <div className="lp-coins">{children}</div>
        <header className="lp-head">
          <span className="lp-logo">
            {t.logo === 'Camba' ? (
              // the real logo; double-click it to type a different name next to the mark
              <span onDoubleClick={() => onText({ logo: 'Brand' })} title="Double-click to rename">
                <CambaLogo color={c.ink} />
              </span>
            ) : (
              <>
                {/* any other name: a wordmark in the display face; clear it to get the Camba logo back */}
                <Edit id="logo" className="lp-wordmark" value={t.logo} onChange={(v) => onText({ logo: v || 'Camba' })} />
              </>
            )}
          </span>
          {l.showNav && (
            <nav className="lp-nav" style={{ color: c.nav }}>
              {t.nav.split(',').map((item, i, all) => (
                <Edit key={i} id={`nav-${i}`} value={item.trim()} onChange={(v) => onText({ nav: all.map((x, j) => (j === i ? v : x.trim())).join(', ') })} />
              ))}
            </nav>
          )}
          <span className="lp-actions">
            <Edit id="signIn" className="lp-btn" value={t.signIn} onChange={(v) => onText({ signIn: v })} style={{ background: c.secondary, color: c.secondaryText }} />
            <Edit id="open" className="lp-btn" value={t.open} onChange={(v) => onText({ open: v })} style={{ background: c.primary, color: c.primaryText }} />
          </span>
        </header>
        <section className="lp-hero">
          <Box id="headline" anchored={anchored} width={l.headlineWidth} reset={LAYOUTS[l.layout ?? 'centered'].start.headlineWidth!} onWidth={(w) => onPage({ headlineWidth: w })}>
            <Edit id="headline" as="h1" multiline value={t.headline} onChange={(v) => onText({ headline: v })} />
          </Box>
          <Box id="sub" anchored={anchored} width={l.subWidth} reset={LAYOUTS[l.layout ?? 'centered'].start.subWidth!} onWidth={(w) => onPage({ subWidth: w })}>
            <Edit id="sub" as="p" multiline value={t.sub} onChange={(v) => onText({ sub: v })} style={{ color: c.sub }} />
          </Box>
          <Edit id="cta" className="lp-btn" value={t.cta} onChange={(v) => onText({ cta: v })} style={{ background: c.primary, color: c.primaryText }} />
        </section>
      </div>
    </SelCtx.Provider>
  );
}
