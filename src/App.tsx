import { useEffect, useRef, useState } from 'react';
import { Accordion, ColorRow, FoldAll, Group, SelectRow, SliderRow, TextRow, ToggleRow } from './controls';
import { downloadBlob, dragFrom, stamp, store } from './lib';
import { CoinScene, coinsShown, CURRENCIES, DEFAULTS, FINISHES, type CoinParams, type Currency, type Finish } from './scene';
import { FONTS, LANDING, LAYOUTS, Landing, THEMES, themed, type Layout, type LandingParams, type PageColors } from './landing';

/**
 * Coin Loop: coins modelled in Blender (blender/coins.py), minted in silver and looped live with three.js.
 *   Studio:       the loop on its own, to tune and record.
 *   Landing page: the loop as the hero of a page whose text you edit in place.
 * Each mode keeps its own coin settings.
 */

type Mode = 'studio' | 'landing';
const KEY = 'coin-loop.v3';
const SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', NGN: '₦', INR: '₹', BTC: '₿' };
const ASPECTS = { Fill: 0, '4:3': 4 / 3, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 } as const;
type Aspect = keyof typeof ASPECTS;

/** The coins on the landing page: a wide, low arc under the hero, on the page's own colour. */
const LANDING_COINS: CoinParams = { ...DEFAULTS, background: 'transparent', count: 28, size: 1.75, radius: 13, offsetX: 0, offsetY: -16.2, offsetZ: 0, zoom: 0.89, dutch: -6, tilt: 14, lean: 40, loop: 18 };

/** Picking a shape also frames it: a good starting point you then drag, zoom and angle. */
const SHAPE_START: Record<CoinParams['shape'], Partial<CoinParams>> = {
  ring: { shape: 'ring', size: 1.7, radius: 9, tilt: 18, dutch: -12, offsetX: 0, offsetY: -6, offsetZ: 0, zoom: 1.6, lean: 42, count: 21, twist: 0 },
  helix: { shape: 'helix', size: 1.2, radius: 9, turns: 3, length: 40, tilt: 0, dutch: -18, offsetX: 0, offsetY: 0, offsetZ: 0, zoom: 1.25, lean: 15, count: 28, twist: 0 },
  dna: { shape: 'dna', size: 0.9, radius: 9, turns: 2, length: 36, tilt: 0, dutch: -22, offsetX: 0, offsetY: 0, offsetZ: 0, zoom: 1.05, lean: 8, count: 64, twist: 0 },
  wave: { shape: 'wave', size: 1.5, radius: 9, turns: 2, length: 40, tilt: 25, dutch: -8, offsetX: 0, offsetY: 0, offsetZ: 0, zoom: 1.3, lean: 35, count: 24, twist: 1 },
  market: { shape: 'market', size: 1.2, radius: 9, turns: 3, length: 44, tilt: 0, dutch: 0, offsetX: 0, offsetY: 0, offsetZ: 0, zoom: 1.2, lean: 30, count: 30, twist: 0 },
  orbit: { shape: 'orbit', size: 1.3, radius: 8, tilt: 16, dutch: -4, offsetX: 0, offsetY: 0, offsetZ: 0, zoom: 1.3, lean: 20, count: 24, twist: 0 },
  cradle: { shape: 'cradle', size: 1.25, radius: 11, length: 40, tilt: 0, dutch: 0, offsetX: 0, offsetY: -5, offsetZ: 0, zoom: 1.15, lean: 30, count: 32, twist: 0 },
  infinity: { shape: 'infinity', size: 1.3, radius: 9, tilt: 20, dutch: -6, offsetX: 0, offsetY: 0, offsetZ: 0, zoom: 1.2, lean: 30, count: 28, twist: 0 },
};

/** On the landing page the hero text owns the top and middle, so every shape runs flat and sideways in the band below
 *  it (fitBelowText then lowers it until it clears the button). */
const SHAPE_LANDING: Record<CoinParams['shape'], Partial<CoinParams>> = {
  ring: { shape: 'ring', size: 1.75, radius: 13, tilt: 14, dutch: -6, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 40, count: 28, twist: 0 },
  wave: { shape: 'wave', size: 1.35, radius: 7, turns: 2, length: 64, tilt: 20, dutch: -3, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 35, count: 34, twist: 1 },
  helix: { shape: 'helix', size: 1.05, radius: 6, turns: 5, length: 64, tilt: 0, dutch: -3, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 12, count: 44, twist: 0 },
  dna: { shape: 'dna', size: 0.8, radius: 6.5, turns: 4, length: 64, tilt: 0, dutch: -3, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 8, count: 80, twist: 0 },
  market: { shape: 'market', size: 1.1, radius: 8, turns: 3, length: 64, tilt: 0, dutch: 0, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 30, count: 40, twist: 0 },
  orbit: { shape: 'orbit', size: 1.2, radius: 10, tilt: 10, dutch: 0, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 20, count: 30, twist: 0 },
  cradle: { shape: 'cradle', size: 1.15, radius: 10, length: 26, tilt: 0, dutch: 0, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 30, count: 30, twist: 0 },
  infinity: { shape: 'infinity', size: 1, radius: 7.5, tilt: 35, dutch: 0, offsetX: 0, offsetZ: 0, zoom: 0.89, lean: 30, count: 30, twist: 0 },
};

/** How a shape's suggested framing changes for a layout: in Split long shapes stand upright and the orbit tips up to
 *  read as a ring beside the text; in Card the ring and orbit shrink to circle the card like a halo. */
const LAYOUT_SHAPE: Partial<Record<Layout, Partial<Record<CoinParams['shape'], Partial<CoinParams>>>>> = {
  split: {
    helix: { dutch: 90 },
    dna: { dutch: 90 },
    wave: { dutch: 90 },
    orbit: { radius: 6, tilt: 62, count: 22, size: 1.15 },
    ring: { radius: 7, tilt: 10, count: 20, size: 1.2, lean: 35 },
    infinity: { radius: 6, tilt: 20, dutch: 90 },
  },
  card: {
    ring: { radius: 6, tilt: 0, lean: 15, count: 20, size: 1.05 },
    orbit: { radius: 7, tilt: 25, count: 26, size: 1.1 },
    infinity: { radius: 9, tilt: 15, count: 30, size: 1 },
  },
};

/** A window with its side panel: the icon for showing and hiding the panel. */
function PanelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="2" y="3" width="14" height="12" rx="2.5" />
      <path d="M11 3v12" />
    </svg>
  );
}

/** Small drawings of each layout: where the text sits (lines) and where the coins go (dots). */
function LayoutIcon({ layout }: { layout: Layout }) {
  const parts = {
    centered: <><path d="M7 6h10M8.5 9h7M10 12h4" /><circle cx="6" cy="18" r="1.6" /><circle cx="10" cy="19" r="1.6" /><circle cx="14" cy="19" r="1.6" /><circle cx="18" cy="18" r="1.6" /></>,
    split: <><path d="M3 8h8M3 11h7M3 14h5" /><circle cx="17" cy="7" r="1.6" /><circle cx="19" cy="12" r="1.6" /><circle cx="17" cy="17" r="1.6" /></>,
    editorial: <><path d="M3 15h10M3 18h8M3 21h5" /><circle cx="8" cy="6" r="1.6" /><circle cx="13" cy="5" r="1.6" /><circle cx="18" cy="7" r="1.6" /><circle cx="20" cy="12" r="1.6" /></>,
    card: <><circle cx="4" cy="6" r="1.6" /><circle cx="20" cy="18" r="1.6" /><circle cx="19" cy="5" r="1.6" /><circle cx="5" cy="18" r="1.6" /><rect x="6" y="8" width="12" height="8" rx="2" /><path d="M9 11h6M10 13.5h4" /></>,
  }[layout];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      {parts}
    </svg>
  );
}

/** Small drawings of each path shape for the picker. */
function ShapeIcon({ shape }: { shape: CoinParams['shape'] }) {
  const d = {
    ring: 'M4 15a8 8 0 1 1 16 0',
    helix: 'M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0 2 3 2 3',
    dna: 'M2 7c4 0 6 10 10 10s6-10 10-10M2 17c4 0 6-10 10-10s6 10 10 10M7 9v6M12 7v10M17 9v6',
    wave: 'M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3-4 5-3',
    infinity: 'M12 12c-2-3-4-5-6.5-5a5 5 0 0 0 0 10c2.5 0 4.5-2 6.5-5s4-5 6.5-5a5 5 0 0 1 0 10c-2.5 0-4.5-2-6.5-5z',
    market: 'M2 18l4-5 3 3 4-7 3 4 6-8',
    orbit: 'M21 12c0 2.2-4 4-9 4s-9-1.8-9-4 4-4 9-4 9 1.8 9 4z',
    cradle: 'M3 4c1 9 5 15 9 15s8-6 9-15',
  }[shape];
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const PRESETS: { name: string; p: Partial<CoinParams> }[] = [
  { name: 'Silver', p: { finishes: ['silver'], clearcoat: 0.45, roughness: 0, scratches: 0.6, brushed: 0.15, exposure: 1 } },
  { name: 'Chrome', p: { finishes: ['chrome'], clearcoat: 0.6, roughness: 0, scratches: 0.25, brushed: 0.1, exposure: 1.05 } },
  { name: 'Candy', p: { finishes: ['silver', 'violet', 'coral'], clearcoat: 0.3, scratches: 0.2, brushed: 0.2, exposure: 1.1 } },
  { name: 'Gold', p: { finishes: ['gold', 'silver'], clearcoat: 0.3, scratches: 0.45, brushed: 0.3, exposure: 1 } },
  { name: 'Graphite', p: { finishes: ['graphite', 'silver'], clearcoat: 0.2, scratches: 0.5, brushed: 0.3, exposure: 1.1 } },
];

/** Finishes that no longer exist in saved settings (the papers) become concrete. */
const fixFinishes = (c?: Partial<CoinParams>) => {
  if (c?.finishes) c.finishes = c.finishes.map((f) => (FINISHES[f] ? f : 'concrete')) as Finish[];
  return c;
};

interface Saved {
  mode?: Mode;
  studio?: Partial<CoinParams>;
  landing?: Partial<CoinParams>;
  page?: Partial<LandingParams>;
  aspect?: Aspect;
  render?: number;
  brand?: string; // set once the Fidda → Camba switch has been applied
  at?: number; // when it was saved: the newer of the browser's copy and the project file wins // version of the render defaults the saved settings were made with
}

export default function App() {
  const saved = store.get<Saved>(KEY, {});
  // once: drop settings from the removed photoreal pipeline
  if ((saved.render ?? 0) < 3) for (const k of ['studio', 'landing'] as const) for (const f of ['quality', 'tone', 'bloom', 'grain', 'focus', 'vignette', 'keyLight', 'occlusion', 'shadowSoftness']) delete (saved[k] as Record<string, unknown> | undefined)?.[f];
  // once: the default speed became 0.1×
  if ((saved.render ?? 0) < 4) for (const k of ['studio', 'landing'] as const) delete saved[k]?.speed;
  // once: the landing page's default zoom became 89%
  if ((saved.render ?? 0) < 5 && saved.landing) delete saved.landing.zoom;
  // once: glints briefly defaulted to on; that was the default, not a choice, so clear it
  if ((saved.render ?? 0) < 6) for (const k of ['studio', 'landing'] as const) delete (saved[k] as Record<string, unknown> | undefined)?.glints;
  // once: the brand is Camba again (the real logo), not the Fidda wordmark
  if (saved.brand !== 'camba' && saved.page?.text?.logo === 'Fidda') saved.page.text.logo = 'Camba';
  fixFinishes(saved.studio);
  fixFinishes(saved.landing);
  const [mode, setMode] = useState<Mode>(saved.mode ?? 'studio');
  const [ps, setPs] = useState<Record<Mode, CoinParams>>({
    studio: { ...DEFAULTS, ...saved.studio },
    landing: { ...LANDING_COINS, ...saved.landing },
  });
  const [page, setPage] = useState<LandingParams>({ ...LANDING, ...saved.page, colors: { ...LANDING.colors, ...saved.page?.colors }, text: { ...LANDING.text, ...saved.page?.text } });
  const [aspect, setAspect] = useState<Aspect>(saved.aspect ?? 'Fill');
  const [paused, setPaused] = useState(false);
  // the side panel folds away so the stage (and the landing page) can use the whole width
  const [panelOpen, setPanelOpen] = useState(() => store.get<boolean>('coin-loop.panel', true));
  useEffect(() => store.set('coin-loop.panel', panelOpen), [panelOpen]);
  // while the panel opens or closes the stage resizes every frame: render light until the motion settles
  const firstPanel = useRef(true);
  useEffect(() => {
    if (firstPanel.current) return void (firstPanel.current = false);
    scene.current?.setMoving(true);
    const t = setTimeout(() => scene.current?.setMoving(false), 460);
    return () => clearTimeout(t);
  }, [panelOpen]);
  const [rec, setRec] = useState<null | number>(null);
  const [loading, setLoading] = useState(true);
  const studioHost = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);
  const saveTimer = useRef<number>();
  const [savedAt, setSavedAt] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const landingHost = useRef<HTMLDivElement>(null);
  const scene = useRef<CoinScene>();
  const p = ps[mode];
  const e = (patch: Partial<CoinParams>) => setPs((all) => ({ ...all, [mode]: { ...all[mode], ...patch } }));
  const ep = (patch: Partial<LandingParams>) => setPage((v) => ({ ...v, ...patch }));
  /** Set one colour. Background and headline keep auto on; any other colour is a manual choice, so auto turns off
   *  (starting from the colours auto had been showing, so nothing else jumps). */
  const ec = (key: keyof PageColors, v: string) =>
    setPage((pg) => {
      const keep = key === 'bg' || key === 'ink';
      return { ...pg, auto: keep ? pg.auto : false, colors: { ...(keep ? pg.colors : themed(pg)), [key]: v } };
    });
  const et = (patch: Partial<LandingParams['text']>) => setPage((v) => ({ ...v, text: { ...v.text, ...patch } }));
  // dragging the coins on the landing page: remember where they were when the drag began
  const dragStart = useRef({ x: 0, y: 0 });
  const onDrag = (phase: 'start' | 'move', dx: number, dy: number) => {
    if (phase === 'start') return void (dragStart.current = { x: p.offsetX, y: p.offsetY });
    const { k, right, up } = scene.current!.dragAxes();
    e({
      offsetX: +(dragStart.current.x + (dx * right[0] - dy * up[0]) * k).toFixed(2),
      offsetY: +(dragStart.current.y + (dx * right[1] - dy * up[1]) * k).toFixed(2),
    });
  };
  // scroll or pinch zooms the camera; with Option held it moves the coins nearer or further instead
  const clampZoom = (z: number) => Math.max(0.1, Math.min(10, +z.toFixed(3)));
  // Scroll or pinch on the studio stage zooms the camera; with Option held it moves the coins nearer or further.
  // A trackpad pinch arrives as a wheel event with Ctrl held, which the browser would use to zoom the whole page, so
  // the listener is attached directly and non-passive, so it can stop that (React's onWheel can't).
  const live = useRef({ p, e });
  live.current = { p, e };
  useEffect(() => {
    const wheel = (ev: WheelEvent) => {
      const stage = (ev.target as HTMLElement).closest('.cl-stage-card');
      if (!stage) return;
      // the landing page only moves the coins on purpose: a pinch zooms, Option + scroll brings them nearer or further;
      // a plain scroll there does nothing (so it can't nudge the coins by accident)
      if (mode !== 'studio' && !ev.ctrlKey && !ev.altKey) return;
      ev.preventDefault(); // never zoom or scroll the browser page over the stage
      const { p, e } = live.current;
      if (ev.altKey) return e({ offsetZ: Math.max(-80, Math.min(22, +((p.offsetZ ?? 0) - ev.deltaY * (ev.ctrlKey ? 0.08 : 0.02)).toFixed(2))) });
      e({ zoom: clampZoom(p.zoom * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))) });
    };
    const gesture = (ev: Event) => (ev.target as HTMLElement).closest?.('.cl-stage-card') && ev.preventDefault(); // Safari's pinch
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('gesturestart', gesture, { passive: false } as AddEventListenerOptions);
    window.addEventListener('gesturechange', gesture, { passive: false } as AddEventListenerOptions);
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('gesturestart', gesture);
      window.removeEventListener('gesturechange', gesture);
    };
  }, [mode]);

  /** Landing page: move (never shrink) the coins into the free space the layout leaves, measured from where the text
   *  actually is: below the button (centred), the right half (split), above the headline (editorial), behind the card. */
  const fitBelowText = (next: CoinParams = p, layout: Layout = page.layout ?? 'centered') => {
    const s = scene.current, stage = landingHost.current;
    const hero = document.querySelector('.lp-hero'), cta = document.querySelector('.lp-hero > .lp-btn'), head = document.querySelector('.lp-head');
    if (!s || !stage || !hero || !cta) return e(next);
    const st = stage.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    const headBottom = (head?.getBoundingClientRect().bottom ?? st.top) - st.top;
    const margin = 28;
    if (layout === 'split') return e({ ...next, ...s.fitRegion(next, 'right', hr.right - st.left + 48, (headBottom + st.height) / 2) });
    if (layout === 'editorial') return e({ ...next, ...s.fitRegion(next, 'between', 0, (headBottom + hr.top - st.top) / 2) }); // in the gap between header and headline
    if (layout === 'card') return e({ ...next, ...s.fitRegion(next, 'center', st.width / 2, (headBottom + st.height) / 2) });
    const top = cta.getBoundingClientRect().bottom - st.top + margin;
    e({ ...next, ...s.fitLanding(next, top, st.height - 70, next.shape === 'cradle' ? 'middle' : 'top') }); // centred: under the button
  };
  const host = () => (mode === 'studio' ? studioHost.current : landingHost.current);

  // once, even in a tab that's already open: the brand is Camba now (a later deliberate rename is left alone)
  useEffect(() => {
    if (store.get<Saved>(KEY, {}).brand !== 'camba') setPage((pg) => (pg.text.logo === 'Fidda' ? { ...pg, text: { ...pg.text, logo: 'Camba' } } : pg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = new CoinScene(host()!);
    scene.current = s;
    if (import.meta.env.DEV) (window as unknown as { __coins: CoinScene }).__coins = s;
    s.ready.then(() => setLoading(false));
    s.start();
    return () => s.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // the landing page's coins render on the page's own colour, so the photographic passes (which need an opaque frame) work there too
    scene.current?.set(mode === 'landing' ? { ...p, background: themed(page).bg } : p);
    if (!hydrated.current) return; // don't save the defaults over the project file before it has been read
    const data: Saved = { mode, studio: ps.studio, landing: ps.landing, page, aspect, render: 7, brand: 'camba', at: Date.now() };
    store.set(KEY, data);
    // also to settings.local.json in the project (while developing), shortly after the last change
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch('/__settings', { method: 'PUT', body: JSON.stringify(data) })
        .then((r) => r.ok && setSavedAt(Date.now()))
        .catch(() => {});
    }, 400);
  }, [p, ps, page, mode, aspect]);

  useEffect(() => scene.current?.setPaused(paused), [paused]);


  // on load: if the project file holds newer settings than this browser, use them
  useEffect(() => {
    fetch('/__settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((f: Saved) => {
        if (f && f.at && (f.render ?? 0) < 6) for (const k of ['studio', 'landing'] as const) delete (f[k] as Record<string, unknown> | undefined)?.glints;
        if (f && f.at && f.brand !== 'camba' && f.page?.text?.logo === 'Fidda') f.page.text.logo = 'Camba';
        fixFinishes(f?.studio);
        fixFinishes(f?.landing);
        if (f && f.at && (!saved.at || f.at > saved.at)) {
          if (f.mode) setMode(f.mode);
          setPs({ studio: { ...DEFAULTS, ...f.studio }, landing: { ...LANDING_COINS, ...f.landing } });
          setPage({ ...LANDING, ...f.page, colors: { ...LANDING.colors, ...f.page?.colors }, text: { ...LANDING.text, ...f.page?.text } });
          if (f.aspect) setAspect(f.aspect);
        }
      })
      .catch(() => {})
      .finally(() => (hydrated.current = true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // put the canvas in the current mode's stage and fit it (studio: at the chosen aspect; landing: the whole page)
  useEffect(() => {
    const el = host()!;
    const s = scene.current!;
    if (s.canvas.parentElement !== el) el.appendChild(s.canvas);
    const fit = () => {
      const r = el.getBoundingClientRect();
      const a = mode === 'landing' ? r.width / r.height : ASPECTS[aspect] || r.width / r.height;
      let w = r.width, h = w / a;
      if (h > r.height) (h = r.height), (w = h * a);
      if (w < 2 || h < 2) return;
      s.canvas.style.width = `${w}px`;
      s.canvas.style.height = `${h}px`;
      s.resize(Math.round(w), Math.round(h));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, mode]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const png = () => scene.current!.canvas.toBlob((b) => b && downloadBlob(b, `coin-loop-${stamp()}.png`), 'image/png');

  /** Record exactly one loop, starting at phase 0, so the clip loops without a seam. */
  const record = async () => {
    const s = scene.current!;
    const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t))!;
    const mr = new MediaRecorder(s.canvas.captureStream(60), { mimeType: type, videoBitsPerSecond: 24_000_000 });
    const chunks: Blob[] = [];
    mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    const done = new Promise<void>((res) => (mr.onstop = () => res()));
    setPaused(false);
    const start = performance.now();
    s.clock = () => (performance.now() - start) / 1000;
    mr.start();
    const secs = p.loop / p.speed; // one full turn of the ring at the current speed
    const tick = setInterval(() => setRec(Math.min(1, (performance.now() - start) / 1000 / secs)), 100);
    await new Promise((r) => setTimeout(r, secs * 1000));
    mr.stop();
    await done;
    clearInterval(tick);
    s.clock = undefined;
    setRec(null);
    downloadBlob(new Blob(chunks, { type }), `coin-loop-${stamp()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
  };

  return (
    <div className="app">
      <div className={`workspace ${panelOpen ? '' : 'panel-closed'}`}>
        <div className="rl-main">
          <section className="card cl-stage-card" style={{ background: mode === 'studio' ? p.background : page.colors.bg }}>
            {!panelOpen && (
              <button className="cl-panel-open" onClick={() => setPanelOpen(true)} aria-label="Show the panel" title="Show the panel">
                <PanelIcon />
              </button>
            )}
            {mode === 'studio' ? (
              <div className="cl-stage cl-drag" ref={studioHost} onPointerDown={(ev) => dragFrom(ev, onDrag)}
                title="Drag to move the coins. Scroll or pinch to zoom; hold Option to bring them nearer">
                {loading && <span className="cl-loading">Loading the coins…</span>}
              </div>
            ) : (
              <Landing l={page} onText={et} onPage={ep} onDrag={onDrag}>
                <div className="cl-stage" ref={landingHost} />
              </Landing>
            )}
            <div className="cl-bar">
              <div className="cl-presets">
                {PRESETS.map((pr) => (
                  <button key={pr.name} onClick={() => e(pr.p)}>
                    {pr.name}
                  </button>
                ))}
              </div>
              {(
              <div className="cl-zoom" aria-label="Zoom">
                <button aria-label="Zoom out" onClick={() => e({ zoom: clampZoom(p.zoom / 1.2) })}>−</button>
                <button className="cl-zoom-value" title="Reset zoom" onClick={() => e({ zoom: (mode === 'studio' ? DEFAULTS : LANDING_COINS).zoom })}>
                  {Math.round(p.zoom * 100)}%
                </button>
                <button aria-label="Zoom in" onClick={() => e({ zoom: clampZoom(p.zoom * 1.2) })}>+</button>
              </div>
              )}
              <button className="cl-chip" onClick={() => setPaused((v) => !v)}>
                {paused ? 'Play' : 'Pause'}
              </button>
            </div>
          </section>
        </div>

        <aside className="panel" aria-label="Coin Loop settings" ref={panelRef}>
          <Accordion scope={mode}>
          <header className="panel-head">
            <h1>Coin Loop</h1>
            <span className={`cl-saved ${Date.now() - savedAt < 1800 ? 'on' : ''}`} key={savedAt}>Saved</span>
            <FoldAll key={mode} panel={panelRef} />
            <button className="cl-panel-close" onClick={() => setPanelOpen(false)} aria-label="Hide the panel" title="Hide the panel">
              <PanelIcon />
            </button>
          </header>
          <div className="panel-body">
            <div className="cl-modes" role="tablist" aria-label="View">
              {(['studio', 'landing'] as Mode[]).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                  {m === 'studio' ? 'Studio' : 'Landing page'}
                </button>
              ))}
            </div>

            {mode === 'landing' && (
              <>
                <Group title="Theme">
                  <div className="cl-themes" role="radiogroup" aria-label="Themes">
                    {THEMES.map((th) => {
                      const on = !page.auto && Object.entries(th.colors).every(([k, v]) => page.colors[k as keyof PageColors] === v);
                      return (
                        <button key={th.name} role="radio" aria-checked={on} className={on ? 'on' : ''} style={{ background: th.colors.bg, color: th.colors.ink }}
                          onClick={() => ep({ colors: th.colors, auto: false })}>
                          <i style={{ background: th.colors.primary }} />
                          {th.name}
                        </button>
                      );
                    })}
                  </div>
                  <ToggleRow label="Auto contrast" value={page.auto} onChange={(v) => ep({ auto: v, colors: v ? page.colors : themed(page) })} />
                </Group>
                <Group title="Colours" open={false}>
                  <ColorRow label="Background" value={page.colors.bg} onChange={(v) => ec('bg', v)} />
                  <ColorRow label="Headline" value={page.colors.ink} onChange={(v) => ec('ink', v)} />
                  <ColorRow label="Subtitle" value={themed(page).sub} onChange={(v) => ec('sub', v)} />
                  <ColorRow label="Navigation" value={themed(page).nav} onChange={(v) => ec('nav', v)} />
                  <ColorRow label="Primary button" value={themed(page).primary} onChange={(v) => ec('primary', v)} />
                  <ColorRow label="Primary text" value={themed(page).primaryText} onChange={(v) => ec('primaryText', v)} />
                  <ColorRow label="Secondary button" value={themed(page).secondary} onChange={(v) => ec('secondary', v)} />
                  <ColorRow label="Secondary text" value={themed(page).secondaryText} onChange={(v) => ec('secondaryText', v)} />
                  <p className="rl-note">With auto contrast on, pick a background and headline colour; buttons, nav and subtitle follow, and button text turns black or white to stay readable. Changing any other colour switches it off.</p>
                </Group>
                <Group title="Type" open={false}>
                  <SelectRow label="Headline face" value={page.font} options={FONTS.map((f) => ({ value: f, label: f }))} onChange={(v) => ep({ font: v })} />
                  <SelectRow label="Body face" value={page.body} options={FONTS.map((f) => ({ value: f, label: f }))} onChange={(v) => ep({ body: v })} />
                  <SliderRow label="Headline size" value={page.headlineSize} min={24} max={320} step={1} onChange={(v) => ep({ headlineSize: v })} format={(v) => `${v}px`} />
                  <SliderRow label="Headline weight" value={page.weight} min={400} max={800} step={100} onChange={(v) => ep({ weight: v })} />
                  <SliderRow label="Subtitle size" value={page.subSize} min={10} max={60} step={1} onChange={(v) => ep({ subSize: v })} format={(v) => `${v}px`} />
                </Group>
                <Group title="Layout">
                  <div className="cl-layouts" role="radiogroup" aria-label="Page layout">
                    {(Object.keys(LAYOUTS) as Layout[]).map((id) => (
                      <button key={id} role="radio" aria-checked={(page.layout ?? 'centered') === id} className={(page.layout ?? 'centered') === id ? 'on' : ''}
                        onClick={() => {
                          // the text moves to the layout's place and sizes; the coins then slide into the space it leaves
                          ep({ layout: id, ...LAYOUTS[id].start });
                          setTimeout(() => fitBelowText(live.current.p, id), 80);
                        }}>
                        <LayoutIcon layout={id} />
                        {LAYOUTS[id].name}
                      </button>
                    ))}
                  </div>
                  <p className="rl-note">Suits: {LAYOUTS[page.layout ?? 'centered'].suits}.</p>
                  <SliderRow label="Headline width" value={page.headlineWidth} min={80} max={1440} step={10} onChange={(v) => ep({ headlineWidth: v })} format={(v) => `${v}px`} />
                  <SliderRow label="Subtitle width" value={page.subWidth} min={80} max={1440} step={10} onChange={(v) => ep({ subWidth: v })} format={(v) => `${v}px`} />
                  <SliderRow label="Hero from top" value={page.heroTop} min={0} max={600} step={2} onChange={(v) => ep({ heroTop: v })} format={(v) => `${v}px`} />
                  <SliderRow label="Button corners" value={page.radius >= 999 ? 40 : page.radius} min={0} max={40} step={1} onChange={(v) => ep({ radius: v >= 40 ? 999 : v })} format={(v) => (v >= 40 ? 'Pill' : `${v}px`)} />
                  <SliderRow label="Button height" value={page.buttonHeight} min={24} max={120} step={1} onChange={(v) => ep({ buttonHeight: v })} format={(v) => `${v}px`} />
                  <ToggleRow label="Navigation" value={page.showNav} onChange={(v) => ep({ showNav: v })} />
                  <TextRow label="Nav items" value={page.text.nav} onChange={(v) => et({ nav: v })} />
                  <p className="rl-note">Click any text on the page to edit it. Drag the sides of the headline or subtitle to change their line length.</p>
                </Group>
              </>
            )}

            {mode === 'landing' && (
              <Group title="Position" action={<button className="text-btn" onClick={() => e({ offsetX: LANDING_COINS.offsetX, offsetY: LANDING_COINS.offsetY, offsetZ: LANDING_COINS.offsetZ, zoom: LANDING_COINS.zoom, size: LANDING_COINS.size })}>Reset</button>}>
                <SliderRow label="X  across" value={p.offsetX} min={-50} max={50} step={0.05} onChange={(v) => e({ offsetX: v })} format={(v) => v.toFixed(2)} />
                <SliderRow label="Y  up" value={p.offsetY} min={-50} max={50} step={0.05} onChange={(v) => e({ offsetY: v })} format={(v) => v.toFixed(2)} />
                <SliderRow label="Nearer / further" value={p.offsetZ ?? 0} min={-80} max={22} step={0.05} onChange={(v) => e({ offsetZ: v })} format={(v) => (v > 0 ? '+' : '') + v.toFixed(2)} />
                <SliderRow label="Zoom" value={p.zoom} min={0.1} max={10} step={0.01} onChange={(v) => e({ zoom: v })} format={(v) => `${Math.round(v * 100)}%`} />
                <SliderRow label="Coin size" value={p.size} min={0.1} max={6} step={0.01} onChange={(v) => e({ size: v })} format={(v) => v.toFixed(2)} />
                <button className="btn-panel" onClick={() => fitBelowText()}>Keep clear of text</button>
                <p className="rl-note">Drag the coins on the page to move them. Pinch to zoom; hold Option (⌥) and scroll to bring them nearer or further. Keep clear of text tucks them under the button without changing their size. Double-click any value in the panel to type an exact number.</p>
              </Group>
            )}

            <Group title="Coins" open={mode === 'studio'}>
              <div className="cl-chips" role="group" aria-label="Currencies">
                {CURRENCIES.map((c) => (
                  <button key={c} className={p.currencies.includes(c) ? 'on' : ''} aria-pressed={p.currencies.includes(c)} title={c}
                    onClick={() => e({ currencies: toggle(p.currencies, c) })}>
                    {SYMBOL[c]}
                  </button>
                ))}
              </div>
              <SliderRow label="Count" value={p.count} min={1} max={200} step={1} onChange={(v) => e({ count: v })} />
              <SliderRow label="Size" value={p.size} min={0.1} max={6} onChange={(v) => e({ size: v })} format={(v) => v.toFixed(2)} />
            </Group>

            <Group title="Finish" open={mode === 'studio'}>
              {([['Metal', 'metal'], ['Stone', 'stone']] as const).map(([title, kind]) => (
                <div key={title} className="cl-finish-set">
                  <span className="cl-sub">{title}</span>
                  <div className={`cl-chips wide ${kind !== 'metal' ? 'two' : ''}`} role="group" aria-label={`${title} finishes, cycled coin by coin`}>
                    {(Object.keys(FINISHES) as Finish[]).filter((f) => (FINISHES[f].stone ? 'stone' : 'metal') === kind).map((f) => (
                      <button key={f} className={p.finishes.includes(f) ? 'on' : ''} aria-pressed={p.finishes.includes(f)}
                        onClick={(ev) => e({ finishes: ev.metaKey || ev.shiftKey ? (toggle(p.finishes, f).length ? toggle(p.finishes, f) : [f]) : [f] })}>
                        <i style={{ background: FINISHES[f].swatch ?? FINISHES[f].color }} />
                        {FINISHES[f].label ?? f[0].toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="rl-note">Click a finish to make every coin that. ⌘ or Shift-click to add more to a mix, and the coins take them in turn.</p>
              <SelectRow label="Symbol" value={p.relief} options={[{ value: 'engraved', label: 'Engraved' }, { value: 'raised', label: 'Raised' }]} onChange={(v) => e({ relief: v })} />
              <SliderRow label="Roughness" value={p.roughness} min={-0.5} max={1} onChange={(v) => e({ roughness: v })} format={(v) => (v >= 0 ? '+' : '') + v.toFixed(2)} />
              {p.finishes.some((f) => FINISHES[f] && !FINISHES[f].stone) && (
                <>
                  <span className="cl-sub">Metal surface</span>
                  <SliderRow label="Brushed" value={p.brushed} min={0} max={1} onChange={(v) => e({ brushed: v })} format={(v) => v.toFixed(2)} />
                  <SliderRow label="Scratches" value={p.scratches} min={0} max={1} onChange={(v) => e({ scratches: v })} format={(v) => v.toFixed(2)} />
                  <SliderRow label="Anisotropy" value={p.anisotropy} min={0} max={1} onChange={(v) => e({ anisotropy: v })} format={(v) => v.toFixed(2)} />
                </>
              )}
              <SliderRow label="Clear coat" value={p.clearcoat} min={0} max={1} onChange={(v) => e({ clearcoat: v })} format={(v) => v.toFixed(2)} />
            </Group>

            <Group title="Motion" open={false}>
              <SliderRow label="Speed" value={p.speed} min={0} max={4} step={0.01} onChange={(v) => e({ speed: v })} format={(v) => `${v.toFixed(2)}×`} />
              <SliderRow label="Loop length" value={p.loop} min={1} max={120} step={0.5} onChange={(v) => e({ loop: v })} format={(v) => `${v.toFixed(1)}s`} />
              <SliderRow label="Lean" value={p.lean} min={-90} max={90} step={1} onChange={(v) => e({ lean: v })} format={(v) => `${v}°`} />
              <SliderRow label="Spins per loop" value={p.spins} min={-12} max={12} step={1} onChange={(v) => e({ spins: v })} />
              <SliderRow label="Wobble" value={p.wobble} min={0} max={3} onChange={(v) => e({ wobble: v })} format={(v) => v.toFixed(2)} />
              <ToggleRow label="Reverse" value={p.reverse} onChange={(v) => e({ reverse: v })} />
            </Group>

            <Group title="Path" open={mode === 'studio'}>
              <div className="cl-shapes" role="radiogroup" aria-label="Path shape">
                {([['ring', 'Ring'], ['market', 'Market'], ['orbit', 'Orbit'], ['cradle', 'Cradle'], ['wave', 'Wave'], ['helix', 'Helix'], ['dna', 'DNA'], ['infinity', 'Infinity']] as const).map(([id, name]) => (
                  <button key={id} role="radio" aria-checked={(p.shape ?? 'ring') === id} className={(p.shape ?? 'ring') === id ? 'on' : ''}
                    onClick={() => e({ shape: id })}>
                    <ShapeIcon shape={id} />
                    {name}
                  </button>
                ))}
              </div>
              <button className="btn-panel" onClick={() => (mode === 'landing' ? fitBelowText({ ...p, ...SHAPE_LANDING[p.shape], ...LAYOUT_SHAPE[page.layout ?? 'centered']?.[p.shape] }) : e(SHAPE_START[p.shape]))}>
                Suggest framing for this shape
              </button>
              {['helix', 'dna', 'wave', 'market', 'cradle'].includes(p.shape) && (
                <>
                  {p.shape !== 'cradle' && <SliderRow label={p.shape === 'wave' ? 'Waves' : p.shape === 'market' ? 'Swings' : 'Turns'} value={p.turns} min={1} max={24} step={1} onChange={(v) => e({ turns: v })} />}
                  <SliderRow label="Length" value={p.length} min={4} max={200} step={1} onChange={(v) => e({ length: v })} format={(v) => v.toFixed(0)} />
                </>
              )}
              <SliderRow label="Twist" value={p.twist} min={-16} max={16} step={1} onChange={(v) => e({ twist: v })} format={(v) => (v === 0 ? 'None' : `${v > 0 ? '+' : ''}${v} turn${Math.abs(v) > 1 ? 's' : ''}`)} />
              {coinsShown(p) < p.count && (
                <p className="rl-note cl-warn">
                  Showing {coinsShown(p)} of {p.count} coins: turned coins need a coin's width between them, or they'd cut through each other. For more, make the
                  path longer ({p.shape === 'ring' || p.shape === 'infinity' ? 'Radius' : 'Length'}) or the coins smaller (Size).
                </p>
              )}
              <SliderRow label={p.shape === 'ring' || p.shape === 'infinity' ? 'Radius' : 'Width'} value={p.radius} min={0.5} max={40} step={0.1} onChange={(v) => e({ radius: v })} format={(v) => v.toFixed(1)} />
              <SliderRow label="Tilt" value={p.tilt} min={-180} max={180} step={1} onChange={(v) => e({ tilt: v })} format={(v) => `${v}°`} />
              <SliderRow label="Dutch angle" value={p.dutch} min={-180} max={180} step={1} onChange={(v) => e({ dutch: v })} format={(v) => `${v}°`} />
              <SliderRow label="Offset X" value={p.offsetX} min={-50} max={50} step={0.05} onChange={(v) => e({ offsetX: v })} format={(v) => v.toFixed(2)} />
              <SliderRow label="Offset Y" value={p.offsetY} min={-50} max={50} step={0.05} onChange={(v) => e({ offsetY: v })} format={(v) => v.toFixed(2)} />
              <SliderRow label="Offset Z" value={p.offsetZ ?? 0} min={-80} max={22} step={0.05} onChange={(v) => e({ offsetZ: v })} format={(v) => v.toFixed(2)} />
              {mode === 'studio' && <p className="rl-note">Or drag the coins on the stage. Scroll or pinch to zoom; hold Option (⌥) while scrolling to bring them nearer.</p>}
              <SliderRow label="Zoom" value={p.zoom} min={0.1} max={10} step={0.01} onChange={(v) => e({ zoom: v })} format={(v) => `${Math.round(v * 100)}%`} />
            </Group>

            <Group title="Light" open={false}>
              <SelectRow label="Studio" value={p.hdri} options={[{ value: 'strips', label: 'Product strips' }, { value: 'studio_small_08', label: 'Studio (photo)' }, { value: 'studio_small_03', label: 'Studio 2 (photo)' }]}
                onChange={(v) => e({ hdri: v })} />
              <SliderRow label="Turn" value={p.envTurn} min={0} max={360} step={1} onChange={(v) => e({ envTurn: v })} format={(v) => `${v}°`} />
              <SliderRow label="Exposure" value={p.exposure} min={0.1} max={4} onChange={(v) => e({ exposure: v })} format={(v) => v.toFixed(2)} />
            </Group>

            {mode === 'studio' && (
              <>
                <Group title="Background" open={false}>
                  <ColorRow label="Colour" value={p.background === 'transparent' ? '#050505' : p.background} onChange={(v) => e({ background: v })} />
                </Group>
                <Group title="Export" open={false}>
                  <SelectRow label="Frame" value={aspect} options={(Object.keys(ASPECTS) as Aspect[]).map((a) => ({ value: a, label: a }))} onChange={setAspect} />
                  <button className="btn-panel" onClick={record} disabled={rec !== null}>
                    {rec === null ? `Record one loop (${(p.loop / p.speed).toFixed(1)}s)` : `Recording… ${Math.round(rec * 100)}%`}
                  </button>
                  <button className="btn-panel" onClick={png}>
                    Save frame as PNG
                  </button>
                </Group>
              </>
            )}
            <p className="rl-note">
              Modelled in Blender (blender/coins.py): a raised rim, a reeded edge and the symbol engraved on both faces. The ring turns once per
              loop, so a recording always loops without a seam.
            </p>
            <button className="text-btn" onClick={() => (mode === 'studio' ? setPs((a) => ({ ...a, studio: DEFAULTS })) : (setPs((a) => ({ ...a, landing: LANDING_COINS })), setPage(LANDING)))}>
              Reset {mode === 'studio' ? 'the studio' : 'the landing page'}
            </button>
          </div>
          </Accordion>
        </aside>
      </div>
    </div>
  );
}
