import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

/**
 * Coin Loop: the Blender coins (public/models/coins.glb, from blender/coins.py) riding a ring that turns once per
 * loop, so every loop is seamless. Only an arc of the ring is in frame, which hides where it starts and ends.
 * The metal is brushed in circles and scratched (generated maps), lit by a studio HDRI.
 */

export type Stone = 'granite' | 'blackGranite' | 'marble' | 'concrete';
export type Paper = 'crumpled' | 'newsprint' | 'kraft' | 'riso' | 'scrapbook';
export type Finish = 'silver' | 'chrome' | 'graphite' | 'gold' | 'coral' | 'violet' | Stone | Paper;
/** Metals reflect the studio; stones carry their own texture (drawn in code, see stoneMaps) and are matte. */
export const FINISHES: Record<Finish, { color: string; rough: number; metal: number; irid: number; stone?: Stone; paper?: Paper; label?: string; swatch?: string }> = {
  silver: { color: '#d8dade', rough: 0.15, metal: 1, irid: 0 },
  chrome: { color: '#eceef2', rough: 0.05, metal: 1, irid: 0 },
  graphite: { color: '#5d6066', rough: 0.3, metal: 1, irid: 0 },
  gold: { color: '#e6be7a', rough: 0.22, metal: 1, irid: 0 },
  coral: { color: '#ec6a52', rough: 0.3, metal: 0.85, irid: 0 },
  violet: { color: '#b48cff', rough: 0.26, metal: 0.9, irid: 1 },
  granite: { color: '#c4c3bf', rough: 0.62, metal: 0, irid: 0, stone: 'granite' },
  blackGranite: { color: '#3a3a3d', rough: 0.38, metal: 0, irid: 0, stone: 'blackGranite', label: 'Black granite' },
  marble: { color: '#ecebe7', rough: 0.28, metal: 0, irid: 0, stone: 'marble' },
  concrete: { color: '#c2beb6', rough: 0.85, metal: 0, irid: 0, stone: 'concrete' },
  // paper: the colour lives in the printed texture (see paperMaps), so the finish colour is white
  crumpled: { swatch: '#f2f0ec', color: '#ffffff', rough: 0.92, metal: 0, irid: 0, paper: 'crumpled' },
  newsprint: { swatch: '#d9d4c8', color: '#ffffff', rough: 0.92, metal: 0, irid: 0, paper: 'newsprint' },
  kraft: { swatch: '#b98b5c', color: '#ffffff', rough: 0.95, metal: 0, irid: 0, paper: 'kraft' },
  riso: { swatch: '#ff5fa2', color: '#ffffff', rough: 0.9, metal: 0, irid: 0, paper: 'riso' },
  scrapbook: { swatch: '#8fae7a', color: '#ffffff', rough: 0.9, metal: 0, irid: 0, paper: 'scrapbook' }, // coloured by the page theme (accent)
};

/* ---------- stone, drawn in code: an albedo, a roughness and a relief map per stone ---------- */

function noise2(seed: number) {
  // value noise with smooth interpolation, tiled on a 256 grid
  const r = rand(seed), N = 256, g = new Float32Array(N * N).map(() => r());
  const at = (x: number, y: number) => g[((y & 255) << 8) | (x & 255)];
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
}
const stoneCache = new Map<Stone, { map: THREE.Texture; rough: THREE.Texture; bump: THREE.Texture }>();
function stoneMaps(kind: Stone) {
  if (stoneCache.has(kind)) return stoneCache.get(kind)!;
  const N = 1024;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d')!; return { c, x, img: x.createImageData(N, N) }; };
  const A = mk(), R = mk(), B = mk();
  const n1 = noise2(11), n2 = noise2(23), n3 = noise2(37), r = rand(91);
  const fbm = (x: number, y: number, n = n1) => n(x, y) * 0.5 + n(x * 2.03, y * 2.03) * 0.25 + n(x * 4.1, y * 4.1) * 0.125 + n(x * 8.3, y * 8.3) * 0.0625;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      let a = 0.5, rough = 0.6, h = 0.5; // albedo (0..1, multiplied by the finish colour), roughness, height
      if (kind === 'granite' || kind === 'blackGranite') {
        // crystals: grains of feldspar, quartz and mica at a few sizes
        const g1 = n2(x / 4.5, y / 4.5), g2 = n3(x / 10, y / 10), cloud = fbm(x / 160, y / 160); // crystals big enough to read as granite
        const grain = g1 > 0.82 ? 0.18 : g1 < 0.16 ? 1.55 : g2 > 0.78 ? 0.55 : 1;
        a = (0.86 + (cloud - 0.5) * 0.25) * grain * (kind === 'blackGranite' ? 1 : 1) + (r() - 0.5) * 0.08;
        if (kind === 'blackGranite' && g1 < 0.12) a = 2.4; // the odd bright fleck
        rough = 0.55 + (g1 > 0.82 ? -0.25 : 0) + (r() - 0.5) * 0.15; // mica glints
        h = 0.5 + (g2 - 0.5) * 0.3 + (r() - 0.5) * 0.2;
      } else if (kind === 'marble') {
        // veins: a sine through turbulence, thin and grey, with fainter secondary veins
        const t = fbm(x / 220, y / 220) * 7 + fbm(x / 60, y / 60, n2) * 1.4;
        const v1 = Math.pow(Math.abs(Math.sin(x / 140 + y / 260 + t)), 0.18);
        const v2 = Math.pow(Math.abs(Math.sin(x / 70 - y / 110 + t * 1.6)), 0.5);
        a = 0.98 - (1 - v1) * 0.55 - (1 - v2) * 0.12 + (fbm(x / 30, y / 30, n3) - 0.5) * 0.05;
        rough = 0.25 + (1 - v1) * 0.2;
        h = 0.5 + (1 - v1) * -0.15;
      } else {
        // concrete: blotchy cement, fine sand and the odd air pocket
        const cloud = fbm(x / 120, y / 120), sand = n2(x / 1.6, y / 1.6);
        a = 0.9 + (cloud - 0.5) * 0.35 + (sand - 0.5) * 0.18;
        rough = 0.9;
        h = 0.5 + (sand - 0.5) * 0.35 + (cloud - 0.5) * 0.2;
        if (r() < 0.0009) { a *= 0.45; h = 0; }
      }
      const av = Math.max(0, Math.min(255, a * 160)), rv = Math.max(0, Math.min(255, rough * 255)), hv = Math.max(0, Math.min(255, h * 255));
      A.img.data[i] = A.img.data[i + 1] = A.img.data[i + 2] = av; A.img.data[i + 3] = 255;
      R.img.data[i] = R.img.data[i + 1] = R.img.data[i + 2] = rv; R.img.data[i + 3] = 255;
      B.img.data[i] = B.img.data[i + 1] = B.img.data[i + 2] = hv; B.img.data[i + 3] = 255;
    }
  // concrete pores: a few soft dark pits drawn on top
  for (const M of [A, R, B]) M.x.putImageData(M.img, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const out = { map: tex(A.c, true), rough: tex(R.c, false), bump: tex(B.c, false) };
  stoneCache.set(kind, out);
  return out;
}
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'NGN', 'INR', 'BTC'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface CoinParams {
  // coins
  count: number; // on the whole ring
  currencies: Currency[];
  finishes: Finish[]; // cycled coin by coin
  relief: 'engraved' | 'raised'; // the symbol cut into the face, or standing up from it
  accent?: string; // the page theme's colour: the scrapbook paper is dyed with it
  size: number;
  // path
  shape: 'ring' | 'helix' | 'dna' | 'wave' | 'infinity' | 'market' | 'orbit' | 'cradle';
  turns: number; // helix, DNA and wave: whole turns (or waves) along the length
  length: number; // helix, DNA and wave: how long the path is (world units)
  twist: number; // whole rolls of each coin about the direction of travel, over the path
  radius: number;
  tilt: number; // ring plane towards the camera, degrees
  dutch: number; // camera roll, degrees
  offsetX: number; // where the ring sits, in world units: X across, Y up, Z towards the camera
  offsetY: number;
  offsetZ: number;
  zoom: number;
  // motion
  loop: number; // seconds per turn of the ring, at speed 1 (and the length of a recording)
  speed: number; // 0.1..2: slows or quickens the loop live, without a jump
  lean: number; // coin face between facing the camera (0) and facing along the track (90)
  spins: number; // whole turns of each coin about its own axis per loop
  wobble: number;
  reverse: boolean;
  // metal
  roughness: number; // added to each finish's own
  brushed: number;
  scratches: number;
  anisotropy: number;
  clearcoat: number;
  // light
  hdri: 'strips' | 'studio_small_08' | 'studio_small_03';
  exposure: number;
  envTurn: number; // degrees
  // background ('transparent' lets a page show through, as in the landing page)
  background: string;
}

export const DEFAULTS: CoinParams = {
  count: 21,
  currencies: ['USD', 'EUR', 'GBP', 'JPY', 'NGN', 'INR', 'BTC'],
  finishes: ['silver'],
  relief: 'engraved',
  size: 1.7,
  shape: 'ring',
  turns: 3,
  length: 34,
  twist: 0,
  radius: 9,
  tilt: 18,
  dutch: -12,
  offsetX: 0,
  offsetY: -6,
  offsetZ: 0,
  zoom: 1.6,
  loop: 14,
  speed: 0.1,
  lean: 42,
  spins: 0,
  wobble: 0.1,
  reverse: false,
  roughness: 0,
  brushed: 0.15,
  scratches: 0.6,
  anisotropy: 0,
  clearcoat: 0.45,
  hdri: 'strips',
  exposure: 1,
  envTurn: 140,
  background: '#050505',
};

/* ---------- surface maps, drawn once per brushed/scratch setting ---------- */

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Roughness (G) for brushed rings + scratches, and a bump map for the scratches; planar UVs across the face. */
function surfaceMaps(brushed: number, scratches: number) {
  const N = 1024;
  const rough = document.createElement('canvas');
  rough.width = rough.height = N;
  const g = rough.getContext('2d')!;
  const bump = document.createElement('canvas');
  bump.width = bump.height = N;
  const b = bump.getContext('2d')!;
  g.fillStyle = 'rgb(150,150,150)';
  g.fillRect(0, 0, N, N);
  b.fillStyle = 'rgb(128,128,128)';
  b.fillRect(0, 0, N, N);
  const r = rand(7);
  // brushed: fine concentric rings of slightly different roughness (the lathe marks)
  for (let i = 0; i < 900 * brushed; i++) {
    const rad = r() * N * 0.72;
    const v = 150 + (r() - 0.5) * 120 * brushed;
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    g.arc(N / 2, N / 2, rad, 0, Math.PI * 2);
    g.stroke();
  }
  // scratches: short straight and slightly curved hairlines, polished (smoother) and dented (bump)
  const count = Math.round(900 * scratches);
  for (let i = 0; i < count; i++) {
    const x = r() * N, y = r() * N;
    const len = 4 + Math.pow(r(), 3) * 110; // mostly short hairlines, the odd longer one
    const a = r() * Math.PI * 2;
    const bend = (r() - 0.5) * 0.6;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    const cx = (x + x2) / 2 + Math.cos(a + Math.PI / 2) * len * bend * 0.3;
    const cy = (y + y2) / 2 + Math.sin(a + Math.PI / 2) * len * bend * 0.3;
    const w = 0.35 + r() * (r() < 0.05 ? 1.2 : 0.55);
    const shade = r() < 0.7 ? 70 : 225; // most scratches catch light (smoother), some are matte
    g.strokeStyle = `rgba(${shade},${shade},${shade},${0.35 + r() * 0.5})`;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(cx, cy, x2, y2);
    g.stroke();
    b.strokeStyle = `rgba(60,60,60,${0.4 + r() * 0.5})`;
    b.lineWidth = w;
    b.beginPath();
    b.moveTo(x, y);
    b.quadraticCurveTo(cx, cy, x2, y2);
    b.stroke();
  }
  // a few tiny pits
  for (let i = 0; i < 160 * scratches; i++) {
    const s = 0.6 + r() * 1.8;
    b.fillStyle = 'rgba(40,40,40,.7)';
    b.fillRect(r() * N, r() * N, s, s);
  }
  const mk = (c: HTMLCanvasElement, srgb = false) => {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; // the rim's coordinates run round it several times
    return t;
  };
  return { rough: mk(rough), bump: mk(bump) };
}

/** Anisotropy direction (RG, tangent space) running round the face in circles, strength in B. */
function circularAnisotropy() {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = x / N - 0.5, dy = 0.5 - y / N;
      const l = Math.hypot(dx, dy) || 1;
      const tx = -dy / l, ty = dx / l; // tangent of the circle
      const i = (y * N + x) * 4;
      img.data[i] = (tx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ty * 0.5 + 0.5) * 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Planar UVs across the coin face (the model's axis is Y after the glTF export), so maps sit flat on it. */
function planarUV(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z;
  const nrm = geo.attributes.normal;
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
  for (let i = 0; i < p.count; i++) {
    if (nrm && Math.abs(nrm.getY(i)) < 0.6) {
      // the rim (its normal points outward, not up): wrap the map round it like a label, so texture runs along the
      // edge instead of stretching across it in streaks
      const a = Math.atan2(p.getZ(i) - cz, p.getX(i) - cx);
      uv[i * 2] = (a / (Math.PI * 2) + 0.5) * 6;
      uv[i * 2 + 1] = 0.5 + ((p.getY(i) - cy) / sx) * 6;
    } else {
      // the faces: flat across, like a stamp; the back face flipped so anything printed reads the right way round there
      const back = nrm ? nrm.getY(i) > 0 : false; // (the +Y face is the one the flat mapping mirrors)
      uv[i * 2] = back ? 1 - (p.getX(i) - bb.min.x) / sx : (p.getX(i) - bb.min.x) / sx;
      uv[i * 2 + 1] = (p.getZ(i) - bb.min.z) / sz;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // centre it, so it turns about its own middle
  const c = new THREE.Vector3();
  bb.getCenter(c);
  geo.translate(-c.x, -c.y, -c.z);
  geo.computeBoundingBox();
  geo.computeBoundingSphere(); // the loader's sphere is for the uncentred, quantised mesh
}

/** A product-photography rig as an HDR panorama: soft boxes on black, so polished metal shows black with crisp white
 *  streaks (what makes silver read as silver). Painted straight into a float equirectangular map. */
function stripStudio(pmrem: THREE.PMREMGenerator) {
  const W = 1024, H = 512;
  const data = new Float32Array(W * H * 4);
  // boxes in degrees, in three's equirect frame: longitude 0 is +X, 90 is +Z (where the camera stands, so what the
  // coin faces see), -90 is -Z (behind the coins). [longitude centre, width, latitude from, to, intensity]
  const boxes: [number, number, number, number, number][] = [
    [155, 14, -35, 62, 8], // tall strip, camera left
    [28, 10, -30, 60, 6.5], // tall strip, camera right
    [90, 110, 60, 85, 3.5], // wide box overhead
    [-90, 50, 8, 40, 2.2], // rim light behind the coins
    [-150, 20, -10, 30, 1.6], // low fill, behind left
  ];
  const soft = (d: number, half: number, edge: number) => THREE.MathUtils.clamp((half - Math.abs(d)) / edge + 0.5, 0, 1);
  for (let y = 0; y < H; y++) {
    const lat = -90 + ((y + 0.5) / H) * 180; // row 0 is the bottom (v = 0)
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * 360 - 180;
      let v = lat < -25 ? 0.1 : 0; // a faint floor so dark faces keep a shape
      // the cyclorama: a soft band round the horizon, brighter in two places, so faces leaning along the track
      // (which mirror the horizon) read as bright silver with a slow gradient across them
      v += 1.5 * soft(lat - 6, 22, 16) * (0.55 + 0.45 * Math.cos(THREE.MathUtils.degToRad(lon - 120) * 2));
      // a big graduated soft box behind the camera (what the faces see): bright at the top, falling to dim
      {
        let d = lon - 90;
        d = ((d + 540) % 360) - 180;
        const g = soft(d, 55, 18) * soft(lat - 18, 40, 14);
        v += g * (0.25 + 2.6 * THREE.MathUtils.smoothstep(lat, -20, 58));
      }
      v += Math.exp(-((lat + 2) ** 2) / 1.5) * 1.2; // a thin horizon line
      for (const [c, w, l0, l1, k] of boxes) {
        let d = lon - c;
        d = ((d + 540) % 360) - 180;
        v += k * soft(d, w / 2, 2.5) * soft(lat - (l0 + l1) / 2, (l1 - l0) / 2, 2.5);
      }
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  return env;
}

/* ---------- paths: where a coin sits at s (0..1), which way it travels (T) and which way it faces (F) ---------- */

/** Ring and infinity are closed loops. Helix, DNA and wave run along X and wrap from one end to the other, out of
 *  frame (make Length longer than the frame is wide). `phase` offsets the second DNA strand by half a turn. */
export function pathAt(p: CoinParams, s: number, phase = 0) {
  const TAU = Math.PI * 2, R = p.radius, eps = 1e-3;
  const at = (t: number): THREE.Vector3 => {
    switch (p.shape ?? 'ring') {
      case 'helix':
      case 'dna': {
        const th = TAU * (p.turns ?? 3) * t + phase, r = R * 0.38;
        return new THREE.Vector3((t - 0.5) * (p.length ?? 34), Math.cos(th) * r, Math.sin(th) * r);
      }
      case 'wave':
        return new THREE.Vector3((t - 0.5) * (p.length ?? 34), Math.sin(TAU * (p.turns ?? 3) * t) * R * 0.32, 0);
      case 'market': {
        // a rising market: an uptrend with sharp chart zigzags (two rhythms, so it never looks regular)
        const tri = (x: number) => 2 * Math.abs(x - Math.floor(x) - 0.5) - 0.5;
        const N = 6 * (p.turns ?? 3);
        const L = p.length ?? 34;
        const y = (t - 0.5) * L * 0.18 + R * 0.2 * tri(t * N) + R * 0.1 * tri(t * N * 2.37 + 0.3);
        return new THREE.Vector3((t - 0.5) * L, y, 0);
      }
      case 'orbit': {
        // a flat ellipse, like Saturn's ring seen from a low angle (Tilt lifts the far side)
        const a = TAU * t;
        return new THREE.Vector3(Math.cos(a) * R * 1.45, 0, Math.sin(a) * R * 0.75);
      }
      case 'cradle': {
        // a U: up the left side, under the middle, up the right; the ends run out of frame
        const u = 2 * t - 1, L = p.length ?? 34;
        return new THREE.Vector3(u * L * 0.5, R * 1.1 * Math.pow(Math.abs(u), 2.6), 0);
      }
      case 'infinity': {
        const a = TAU * t, d = 1 + Math.sin(a) ** 2; // a lemniscate of Bernoulli, gently tipped back
        return new THREE.Vector3((R * 1.5 * Math.cos(a)) / d, (R * 1.5 * Math.sin(a) * Math.cos(a)) / d, (R * 0.35 * Math.sin(a)) / d);
      }
      default:
        return new THREE.Vector3(Math.cos(TAU * t) * R, Math.sin(TAU * t) * R, 0);
    }
  };
  const pos = at(s);
  const T = at(s + eps).sub(at(s - eps)).normalize();
  if (p.reverse) T.negate();
  // helix and DNA coins face out from the axis, like the bases of a strand; everything else faces the camera
  let F: THREE.Vector3;
  if (p.shape === 'helix' || p.shape === 'dna') F = new THREE.Vector3(0, pos.y, pos.z).normalize();
  else F = new THREE.Vector3(0, 0, 1);
  // keep F square to the direction of travel
  F.sub(T.clone().multiplyScalar(F.dot(T))).normalize();
  return { pos, T, F };
}

/** How many coins fit along the path without any two touching: a coin is 2 × size across (its radius is 1 in the
 *  model), so centres at least that far apart can never meet, however each coin is turned. Needed when coins turn
 *  relative to their neighbours (twist, spins): side by side they'd otherwise cut through each other. DNA counts
 *  per strand. */
export function roomFor(p: CoinParams) {
  let len = 0;
  let prev = pathAt(p, 0).pos;
  for (let k = 1; k <= 400; k++) {
    const cur = pathAt(p, k / 400).pos;
    len += cur.distanceTo(prev);
    prev = cur;
  }
  const perStrand = Math.max(1, Math.floor(len / (2.08 * p.size)));
  return p.shape === 'dna' ? perStrand * 2 : perStrand;
}

/** Coins actually shown: all of them, unless they turn against each other (twist or spins) and wouldn't fit. */
const roomCache = new Map<string, number>();
export function coinsShown(p: CoinParams) {
  if (!p.twist && !p.spins) return p.count;
  const key = [p.shape, p.radius, p.turns, p.length, p.size].join('|');
  if (!roomCache.has(key)) {
    if (roomCache.size > 200) roomCache.clear();
    roomCache.set(key, roomFor(p));
  }
  return Math.min(p.count, roomCache.get(key)!);
}

/* ---------- paper, printed in code: halftone dots, torn edges, type, grain ---------- */

/** Newspaper comes in this many different pages, so neighbouring coins are each wrapped in their own piece. */
export const NEWS_PAGES = 7;
/** Scrapbook comes in this many arrangements (tears, tape, stars), one per coin in turn. */
export const SCRAP_PAGES = 5;
/** Pages a paper comes in, so neighbouring coins differ. */
export const pagesOf = (paper?: Paper) => (paper === 'newsprint' ? NEWS_PAGES : paper === 'scrapbook' ? SCRAP_PAGES : 1);
const paperCache = new Map<string, { map: THREE.Texture; rough: THREE.Texture; bump: THREE.Texture }>();
function paperMaps(kind: Paper, variant = 0, accent = '#8fae7a') {
  const cacheKey = `${kind}:${variant}${kind === 'scrapbook' ? ':' + accent : ''}`;
  if (paperCache.size > 60) paperCache.clear(); // re-coloured scrapbooks pile up as the theme changes
  if (paperCache.has(cacheKey)) return paperCache.get(cacheKey)!;
  const N = 1024;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return { c, g: c.getContext('2d')! }; };
  const A = mk(), R = mk(), B = mk(); // colour, roughness (ink is a touch smoother), relief (fibres and the tear)
  const r = rand(kind.length * 97 + 13 + variant * 7919), n1 = noise2(5 + variant);
  const fbm = (x: number, y: number) => n1(x, y) * 0.55 + n1(x * 2.1, y * 2.1) * 0.27 + n1(x * 4.3, y * 4.3) * 0.18;
  const papers: Record<Paper, string> = { crumpled: '#f3f1ed', newsprint: '#e9e1d0', kraft: '#b98b5c', riso: '#f3eee6', scrapbook: '#f1e8db' };
  // crumple: a height field of tilted facets (Voronoi cells, each a small plane) crossed by sharp creases; it drives the
  // relief and a little shading
  const cells = Array.from({ length: 46 }, () => ({ x: r() * N, y: r() * N, gx: (r() - 0.5) * 0.9, gy: (r() - 0.5) * 0.9 }));
  const creases = Array.from({ length: 16 }, () => { const a = r() * Math.PI; return { nx: Math.cos(a), ny: Math.sin(a), c: r() * N * 1.4 - N * 0.2, amp: (r() - 0.5) * 1.3, w: 16 + r() * 30 }; }); // broad, soft ridges, not cracks
  const wrinkles = 11 + Math.floor(r() * 7); // how many folds fan out round a wrapped coin
  const crumple = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let h = 0;
      if (kind !== 'newsprint' && kind !== 'scrapbook') { // (those two have their own relief; skipping the facets keeps them quick)
        let best = Infinity, cell = cells[0];
        for (const c of cells) { const d = (x - c.x) ** 2 + (y - c.y) ** 2; if (d < best) (best = d), (cell = c); }
        h = (x - cell.x) * cell.gx * 0.25 + (y - cell.y) * cell.gy * 0.25; // the facet's tilt
      }
      if (kind === 'newsprint') {
        // wrapped round a coin: flat where it's pressed onto the face, wrinkles fanning out, crinkled where it gathers
        const dx = x - N / 2, dy = y - N / 2, rad = Math.hypot(dx, dy) / (N / 2), ang = Math.atan2(dy, dx);
        const out = Math.max(0, (rad - 0.35) / 0.65);
        h = out * out * (Math.sin(ang * wrinkles + Math.sin(ang * 3 + variant) * 2.2) * 36 + Math.sin(ang * wrinkles * 2.7 + variant * 1.3) * 14);
        h += Math.max(0, rad - 0.86) * 260 * Math.sin(ang * 90 + n1(ang * 6, rad * 4) * 4) * 0.18; // the gathered edge
      } else for (const k of creases) { const d = Math.abs(x * k.nx + y * k.ny - k.c); h += k.amp * 12 * Math.exp(-d / k.w); } // ridges and valleys
      crumple[y * N + x] = h;
    }

  // the sheet: its colour with soft mottling and fibres
  const sheet = (g: CanvasRenderingContext2D, base: string, fibre: string, fibres = 900) => {
    g.fillStyle = base;
    g.fillRect(0, 0, N, N);
    const img = g.getImageData(0, 0, N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4, m = (fbm(x / 90, y / 90) - 0.5) * 18 + (r() - 0.5) * 10;
        img.data[i] += m; img.data[i + 1] += m; img.data[i + 2] += m;
      }
    g.putImageData(img, 0, 0);
    g.strokeStyle = fibre;
    for (let k = 0; k < fibres; k++) {
      const x = r() * N, y = r() * N, a = r() * Math.PI * 2, l = 4 + r() * 22;
      g.globalAlpha = 0.08 + r() * 0.18;
      g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
  };
  // halftone: ink dots on a 45° grid, each dot's size following a tone field (0 paper .. 1 solid)
  const halftone = (g: CanvasRenderingContext2D, ink: string, tone: (x: number, y: number) => number, step = 13, angle = Math.PI / 4, dx = 0, dy = 0) => {
    g.save();
    g.fillStyle = ink;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    for (let v = -N; v < 2 * N; v += step)
      for (let u = -N; u < 2 * N; u += step) {
        const x = u * ca - v * sa + dx, y = u * sa + v * ca + dy;
        if (x < -step || y < -step || x > N + step || y > N + step) continue;
        const t = Math.max(0, Math.min(1, tone(x, y)));
        if (t < 0.03) continue;
        g.beginPath(); g.arc(x, y, step * 0.72 * Math.sqrt(t), 0, Math.PI * 2); g.fill();
      }
    g.restore();
  };
  // printed lines of type in columns
  const type = (g: CanvasRenderingContext2D, ink: string, x0: number, y0: number, w: number, h: number, size = 17) => {
    const words = 'invest save grow capital interest yield market fund rate return shares bond growth value account balance compound dividend asset future plan'.split(' ');
    g.save();
    g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    g.fillStyle = ink;
    g.font = `${size}px Georgia, 'Times New Roman', serif`;
    for (let y = y0 + size; y < y0 + h; y += size * 1.45) {
      let x = x0, line = '';
      while (x < x0 + w) { const wd = words[Math.floor(r() * words.length)]; line += wd + ' '; x += g.measureText(wd + ' ').width; }
      g.fillText(line, x0, y);
    }
    g.restore();
  };

  if (kind === 'crumpled') {
    // plain paper, nothing printed: the crumple (shading and relief, below) is the whole look
    sheet(A.g, papers.crumpled, '#b9b6b0', 300);
  } else if (kind === 'newsprint') {
    // a page of its own for every variant: headline, columns, a photo and rules, the whole page turned at its own angle
    sheet(A.g, papers.newsprint, '#9a968c');
    const g = A.g;
    const heads = ['MARKETS RALLY', 'RATES HOLD', 'NAIRA FIRMS', 'GOLD SURGES', 'BANKS BOOM', 'SAVERS WIN', 'STOCKS SLIP', 'YIELDS RISE', 'FUNDS GROW', 'TRADE TALKS'];
    g.save();
    g.translate(N / 2, N / 2);
    g.rotate((r() - 0.5) * 1.1);
    g.translate(-N * 0.62, -N * 0.62);
    const W = N * 1.24, ink = '#141311';
    // masthead rule and the headline
    g.fillStyle = ink;
    g.fillRect(40, 70, W - 80, 4);
    g.font = `900 ${112 + Math.floor(r() * 40)}px Georgia, 'Times New Roman', serif`;
    const head = heads[(variant * 3 + Math.floor(r() * 3)) % heads.length];
    g.fillText(head, 46, 180);
    g.font = "italic 26px Georgia, 'Times New Roman', serif";
    g.fillText(['Investors cheer as the week closes higher', 'Central bank keeps its course, for now', 'A quiet week turns into a busy one'][variant % 3], 50, 228);
    g.fillRect(40, 250, W - 80, 2);
    // columns of body type, with a photo set into one of them
    const cols = 2 + (variant % 3), gap = 26, colW = (W - 80 - gap * (cols - 1)) / cols;
    const photoCol = Math.floor(r() * cols), photoTop = 280 + r() * 380, photoH = 220 + r() * 160;
    for (let ci = 0; ci < cols; ci++) {
      const x0 = 40 + ci * (colW + gap);
      if (ci) g.fillRect(x0 - gap / 2, 270, 1.2, W - 330); // the rule between columns
      if (ci === photoCol) {
        type(g, ink, x0, 270, colW, photoTop - 285, 21);
        g.save(); g.beginPath(); g.rect(x0, photoTop, colW, photoH); g.clip();
        g.fillStyle = '#d8d3c8'; g.fillRect(x0, photoTop, colW, photoH);
        halftone(g, '#0e0d0c', (x, y) => fbm(x / 90 + variant, y / 90) * 2 - 0.5, 9);
        g.restore();
        g.font = "italic 13px Georgia, serif"; g.fillStyle = ink;
        g.fillText('Traders on the floor, Friday.', x0, photoTop + photoH + 18);
        type(g, ink, x0, photoTop + photoH + 26, colW, W - photoTop - photoH - 100, 21);
      } else type(g, ink, x0, 270, colW, W - 330, 21);
    }
    g.restore();
  } else if (kind === 'scrapbook') {
    // a scrapbook page dyed with the theme's colour: cream graph paper, torn open to woven gingham, washi tape, doodle stars.
    // Every variant arranges them differently.
    const g = A.g;
    const hex = (h: string) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const mix = (c: number[], to: number[], t: number) => `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * t)).join(',')})`;
    const base = hex(accent), dark = mix(base, [10, 12, 10], 0.55), mid = mix(base, [10, 12, 10], 0.15), light = mix(base, [246, 239, 230], 0.5); // high contrast: deep checks, clear lights
    sheet(g, papers.scrapbook, '#c9bfb2', 260);
    // the graph paper's grid
    g.strokeStyle = 'rgba(120, 108, 100, 0.45)';
    g.lineWidth = 1.2;
    for (let k = 0; k <= N; k += 34) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, N); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(N, k); g.stroke(); }
    // woven gingham: two-tone checks with fine threads, so it reads as cloth
    const gingham = (gg: CanvasRenderingContext2D, cell: number) => {
      gg.fillStyle = light; gg.fillRect(0, 0, N, N);
      gg.globalAlpha = 0.7; gg.fillStyle = mid;
      for (let k = 0; k * cell < N; k += 2) { gg.fillRect(k * cell, 0, cell, N); gg.fillRect(0, k * cell, N, cell); }
      gg.globalAlpha = 1; gg.fillStyle = dark;
      for (let i = 0; i * cell < N; i += 2) for (let j = 0; j * cell < N; j += 2) gg.fillRect(i * cell, j * cell, cell, cell);
      gg.globalAlpha = 0.18; gg.strokeStyle = '#fff'; gg.lineWidth = 1;
      for (let y = 0; y < N; y += 4) { gg.beginPath(); for (let x = 0; x < N; x += 6) { gg.moveTo(x, y + (x / 6) % 2); gg.lineTo(x + 3, y + (x / 6) % 2); } gg.stroke(); }
      gg.globalAlpha = 1;
    };
    // a torn opening across the face: a jagged chord cutting off part of the circle; the cut-off part shows cloth
    const tears = variant % 2 ? 2 : 1;
    for (let ti = 0; ti < tears; ti++) {
      const a0 = r() * Math.PI * 2 + ti * Math.PI, span = 1.5 + r() * 0.9, R0 = N * 0.47;
      const A = [N / 2 + Math.cos(a0) * R0, N / 2 + Math.sin(a0) * R0], Bp = [N / 2 + Math.cos(a0 + span) * R0, N / 2 + Math.sin(a0 + span) * R0];
      const pts: [number, number][] = [];
      for (let t = 0; t <= 1.0001; t += 0.025) pts.push([A[0] + (Bp[0] - A[0]) * t + (r() - 0.5) * 16, A[1] + (Bp[1] - A[1]) * t + (r() - 0.5) * 16]);
      g.save();
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      for (let k = 12; k >= 0; k--) { const a = a0 + (span * k) / 12; g.lineTo(N / 2 + Math.cos(a) * N * 0.75, N / 2 + Math.sin(a) * N * 0.75); } // round the outside
      g.closePath(); g.clip();
      gingham(g, 40 + Math.floor(r() * 22));
      g.restore();
      g.strokeStyle = '#fffdf8'; g.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) { g.lineWidth = 7 - pass * 3; g.globalAlpha = 1 - pass * 0.3; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + (r() - 0.5) * 3, y + (r() - 0.5) * 3) : g.moveTo(x, y))); g.stroke(); }
      g.globalAlpha = 1;
    }
    // washi tape: a translucent strip of small gingham with torn ends, laid at an angle
    g.save();
    g.translate(N * (0.38 + r() * 0.24), N * (0.38 + r() * 0.24));
    g.rotate((r() - 0.5) * 1.6);
    const tw = 110, th = 300;
    g.beginPath(); g.moveTo(-tw / 2, -th / 2);
    for (let x = -tw / 2; x <= tw / 2; x += 10) g.lineTo(x, -th / 2 + (r() - 0.5) * 12);
    g.lineTo(tw / 2, th / 2);
    for (let x = tw / 2; x >= -tw / 2; x -= 10) g.lineTo(x, th / 2 + (r() - 0.5) * 12);
    g.closePath(); g.clip();
    g.globalAlpha = 0.82; g.translate(-N / 2, -N / 2);
    const cell = 18;
    g.fillStyle = light; g.fillRect(0, 0, N, N);
    g.fillStyle = mid;
    for (let k = 0; k * cell < N; k += 2) { g.globalAlpha = 0.45; g.fillRect(k * cell, 0, cell, N); g.fillRect(0, k * cell, N, cell); }
    g.globalAlpha = 1;
    g.restore();
    // doodle stars: wobbly, hand-cut, with a light inner line
    const star = (x: number, y: number, R: number, rot: number) => {
      const path = (scale: number) => { g.beginPath(); for (let k = 0; k <= 10; k++) { const ang = rot + (k * Math.PI) / 5, rr = (k % 2 ? R * 0.46 : R) * scale * (0.9 + r() * 0.2); k ? g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr) : g.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); } g.closePath(); };
      path(1); g.fillStyle = mid; g.fill();
      path(0.62); g.strokeStyle = light; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke();
    };
    for (let k = 0; k < 1 + (variant % 2); k++) { const a = r() * Math.PI * 2, d = N * (0.12 + r() * 0.2); star(N / 2 + Math.cos(a) * d, N / 2 + Math.sin(a) * d, 60 + r() * 40, r() * Math.PI); } // inside the face
  } else if (kind === 'kraft') {
    sheet(A.g, papers.kraft, '#5c3d22', 2600);
    halftone(A.g, '#1f140c', (x, y) => (y / N) * 1.3 - 0.25 + (fbm(x / 160, y / 160) - 0.5) * 0.6, 22);
  } else {
    sheet(A.g, papers.riso, '#a9a39a');
    // two inks, each its own halftone angle, slightly out of register
    A.g.globalCompositeOperation = 'multiply';
    halftone(A.g, '#ff5fa2', (x, y) => 1.1 - Math.hypot(x - N * 0.35, y - N * 0.4) / (N * 0.5), 12, Math.PI / 12);
    halftone(A.g, '#3a6cff', (x, y) => 1.05 - Math.hypot(x - N * 0.62, y - N * 0.58) / (N * 0.5), 12, Math.PI / 4, 5, 3);
    A.g.globalCompositeOperation = 'source-over';
  }
  // the cut: a white margin of paper core round the face, its inner edge a little uneven as scissors leave it
  {
    const g = A.g;
    g.save();
    g.beginPath();
    for (let k = 0; k <= 180; k++) {
      const a = (k / 180) * Math.PI * 2, rr = N * (0.415 + (n1(Math.cos(a) * 3 + variant, Math.sin(a) * 3) - 0.5) * 0.012);
      k ? g.lineTo(N / 2 + Math.cos(a) * rr, N / 2 + Math.sin(a) * rr) : g.moveTo(N / 2 + Math.cos(a) * rr, N / 2 + Math.sin(a) * rr);
    }
    g.closePath();
    g.rect(N, 0, -N, N); // everything outside that circle (even-odd)
    g.fillStyle = '#fbfaf6';
    g.fill('evenodd');
    // a hairline where the print meets the cut, so the edge reads crisp
    g.globalCompositeOperation = 'multiply';
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(N / 2, N / 2, N * 0.415, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  // roughness: paper is matte; ink (darker) a touch smoother
  const ai = A.g.getImageData(0, 0, N, N), ri = R.g.createImageData(N, N);
  for (let i = 0; i < ai.data.length; i += 4) {
    const lum = (ai.data[i] + ai.data[i + 1] + ai.data[i + 2]) / 765;
    const v = 200 + lum * 50;
    ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = v; ri.data[i + 3] = 255;
  }
  R.g.putImageData(ri, 0, 0);
  // shading: valleys of the crumple a touch darker, as soft light across a creased sheet
  const strength = kind === 'crumpled' ? 1.8 : kind === 'newsprint' ? 1.2 : kind === 'scrapbook' ? 0.4 : 0.55; // crumpled paper hard, newspaper wrapped, the others gently
  const ap = A.g.getImageData(0, 0, N, N);
  for (let y = 1; y < N; y++)
    for (let x = 1; x < N; x++) {
      const i = (y * N + x) * 4;
      const xm = Math.max(0, x - 3), ym = Math.max(0, y - 3);
      const slope = (crumple[y * N + x] - crumple[y * N + xm] + crumple[y * N + x] - crumple[ym * N + x]) * 3.5 * strength; // lit from the top left
      ap.data[i] += slope; ap.data[i + 1] += slope; ap.data[i + 2] += slope;
    }
  A.g.putImageData(ap, 0, 0);
  // relief: the crumple's facets and creases, plus fibres and grain
  const bi = B.g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const v = 128 + crumple[y * N + x] * 3.2 * strength + (fbm(x / 6, y / 6) - 0.5) * 26 + (r() - 0.5) * 10;
      bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = v; bi.data[i + 3] = 255;
    }
  B.g.putImageData(bi, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const out = { map: tex(A.c, true), rough: tex(R.c, false), bump: tex(B.c, false) };
  paperCache.set(cacheKey, out);
  return out;
}

/* ---------- the scene ---------- */

export class CoinScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 4 / 3, 0.1, 200);
  ring = new THREE.Group();
  private geos = new Map<string, THREE.BufferGeometry>(); // 'USD' engraved, 'USD_raised' in relief
  private mats = new Map<string, THREE.MeshPhysicalMaterial>();
  private coins: THREE.Mesh[] = [];
  private maps?: { rough: THREE.Texture; bump: THREE.Texture };
  private mapsKey = '';
  private aniso = circularAnisotropy();
  private envs = new Map<string, THREE.Texture>();
  private pmrem: THREE.PMREMGenerator;
  private p: CoinParams = DEFAULTS;
  private raf = 0;
  private paused = false;
  private disposed = false;
  private shadows: (THREE.Mesh | undefined)[] = []; // paper coins' cut-out drop shadows
  private shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false });
  /** seconds into the loop; set by the recorder so frames come out exactly once per loop */
  clock?: () => number;
  ready: Promise<void>;

  /** The scene makes and owns its canvas: two renderers sharing one WebGL context (React mounts twice in
   *  development) corrupt each other's state. */
  canvas = document.createElement('canvas');

  constructor(host: HTMLElement) {
    const canvas = this.canvas;
    canvas.className = 'cl-canvas';
    host.appendChild(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.add(this.ring);
    this.ready = this.load();
  }

  private async load() {
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync('/models/coins.glb');
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      const key = m.name?.replace('coin_', '') ?? '';
      if (m.isMesh && CURRENCIES.includes(key.replace('_raised', '') as Currency)) {
        const g = m.geometry.clone();
        planarUV(g);
        this.geos.set(key, g);
      }
    });
    draco.dispose();
    if (this.disposed) return; // React's development double-mount: the first copy stops here
    await this.env(this.p.hdri);
  }

  private async env(name: CoinParams['hdri']) {
    if (this.disposed) return;
    if (!this.envs.has(name) && name === 'strips') this.envs.set(name, stripStudio(this.pmrem));
    if (!this.envs.has(name)) {
      const hdr = await new RGBELoader().loadAsync(`/hdri/${name}.hdr`);
      const tex = this.pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      this.envs.set(name, tex);
    }
    this.scene.environment = this.envs.get(name)!;
  }

  private material(f: Finish, p: CoinParams, variant = 0) {
    const key = variant ? `${f}:${variant}` : f;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial();
      this.mats.set(key, m);
    }
    const F = FINISHES[f];
    m.color.set(F.color);
    m.metalness = F.metal;
    if (F.paper) {
      // paper is a print: show its colours as printed (an unlit layer), with only a little studio light for shape, so the
      // contrast stays high and graphic instead of washing out like a lit 3D surface
      const P = paperMaps(F.paper, variant, p.accent);
      m.map = P.map;
      m.emissive.set('#ffffff');
      m.emissiveMap = P.map;
      m.emissiveIntensity = 0.85;
      m.toneMapped = false; // the print's exact colours
      m.roughness = 1;
      m.roughnessMap = null;
      m.bumpMap = P.bump;
      m.bumpScale = F.paper === 'newsprint' ? 2.4 : 1.6; // the crumples, and the wrapped newspaper's folds
      m.anisotropy = 0;
      m.anisotropyMap = null;
      m.clearcoat = 0;
      m.iridescence = 0;
      m.envMapIntensity = 0.32;
      m.vertexColors = true; // the symbol pressed into the paper reads darker
      m.needsUpdate = true;
      return m;
    }
    m.emissive.set('#000000');
    m.emissiveMap = null;
    m.toneMapped = true;
    if (F.stone) {
      // stone: its own texture, matte, a little relief; no clear coat or iridescence (marble keeps a soft polish)
      const S = stoneMaps(F.stone);
      m.map = S.map;
      m.roughness = THREE.MathUtils.clamp(F.rough + p.roughness, 0.05, 1) * 1.6;
      m.roughnessMap = S.rough;
      m.bumpMap = S.bump;
      m.bumpScale = F.stone === 'concrete' ? 2.2 : 1.2;
      m.anisotropy = 0;
      m.anisotropyMap = null;
      m.clearcoat = F.stone === 'marble' ? 0.35 : 0;
      m.clearcoatRoughness = 0.2;
      m.iridescence = 0;
      m.envMapIntensity = 2.6; // matte stone needs broad light; the product studio is mostly black, made for metal
      m.vertexColors = true; // engravings darker inside, as in carved stone
      m.needsUpdate = true;
      return m;
    }
    m.map = null;
    m.roughness = THREE.MathUtils.clamp(F.rough + p.roughness, 0.02, 1) * 1.7; // the map sits around 0.6
    m.roughnessMap = this.maps!.rough;
    m.bumpMap = this.maps!.bump;
    m.bumpScale = 0.18 * p.scratches;
    m.anisotropy = p.anisotropy;
    m.anisotropyMap = p.anisotropy > 0 ? this.aniso : null;
    m.clearcoat = p.clearcoat;
    m.clearcoatRoughness = 0.08;
    m.iridescence = F.irid;
    m.iridescenceIOR = 1.6;
    m.iridescenceThicknessRange = [180, 620];
    m.envMapIntensity = 1;
    m.vertexColors = true; // the cavity shading baked in Blender: engravings darker inside, so they read
    m.needsUpdate = true;
    return m;
  }

  /** Apply settings. Rebuilds coins only when their number, currencies or finishes change. */
  async set(p: CoinParams) {
    const prev = this.p;
    this.p = p;
    await this.ready;
    if (this.disposed) return;
    const key = `${p.brushed.toFixed(2)}|${p.scratches.toFixed(2)}`;
    if (key !== this.mapsKey) {
      this.maps?.rough.dispose();
      this.maps?.bump.dispose();
      this.maps = surfaceMaps(p.brushed, p.scratches);
      this.mapsKey = key;
    }
    const known = p.finishes.map((f) => (FINISHES[f] ? f : (['halftone', 'graph'].includes(String(f)) ? 'crumpled' : 'silver'))) as Finish[]; // old saves: Halftone and Graph are now Crumpled
    const finishes = known.length ? known : (['silver'] as Finish[]);
    finishes.forEach((f) => { this.material(f, p); for (let v = 1; v < pagesOf(FINISHES[f].paper); v++) this.material(f, p, v); });
    if (p.hdri !== prev.hdri || !this.scene.environment) await this.env(p.hdri);
    this.scene.environmentRotation.set(0, THREE.MathUtils.degToRad(p.envTurn), 0);
    this.renderer.toneMappingExposure = p.exposure;

    this.scene.background = p.background === 'transparent' ? null : new THREE.Color(p.background);

    const layout = `${p.count}|${p.currencies.join()}|${finishes.join()}|${p.relief}`;
    if (layout !== (this as any)._layout || !this.coins.length) {
      (this as any)._layout = layout;
      this.coins.forEach((c) => this.ring.remove(c));
      this.shadows.forEach((sh) => sh && this.ring.remove(sh));
      this.shadows = [];
      const cur = p.currencies.length ? p.currencies : (['USD'] as Currency[]);
      this.coins = Array.from({ length: p.count }, (_, i) => {
        const code = cur[i % cur.length];
        const mesh = new THREE.Mesh((p.relief === 'raised' && this.geos.get(code + '_raised')) || this.geos.get(code)!, this.mats.get(((f) => { const n = pagesOf(FINISHES[f].paper); return n > 1 && i % n ? `${f}:${i % n}` : f; })(finishes[i % finishes.length]))!); // newspaper and scrapbook: each coin its own page
        mesh.frustumCulled = false; // ~30 coins: cheaper to draw than to risk a wrong cull
        this.ring.add(mesh);
        // paper: a cut-out lying on the page casts a crisp offset shadow; a flat dark copy just behind it
        const paper = !!FINISHES[finishes[i % finishes.length]].paper;
        mesh.userData.paper = paper;
        if (paper) {
          const sh = new THREE.Mesh(mesh.geometry, this.shadowMat);
          sh.frustumCulled = false;
          sh.renderOrder = -1;
          this.ring.add(sh);
          this.shadows[i] = sh;
        }
        return mesh;
      });
    }
    this.frame();
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frame();
  }

  /** time into the loop, 0..1. Accumulated frame by frame, so changing the speed or loop length never jumps. */
  private u = 0;
  private last = performance.now();
  phase() {
    if (this.clock) return (((this.clock() * (this.p.speed ?? 1)) / this.p.loop) % 1 + 1) % 1; // recording: exact time
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.u = (this.u + (dt * (this.p.speed ?? 1)) / this.p.loop) % 1;
    return this.u;
  }

  /** Lay the coins round the ring for loop phase u (0..1) and draw. */
  frame(u = this.phase()) {
    const p = this.p;
    if (!this.coins.length || this.disposed || !this.scene.environment) return;
    // with twist or spins, only as many coins as fit without touching (see roomFor); the rest wait, hidden
    const n = Math.min(this.coins.length, coinsShown(p));
    this.coins.forEach((c, i) => (c.visible = i < n));
    const dir = p.reverse ? -1 : 1;
    const lean = THREE.MathUtils.degToRad(p.lean);
    const q = new THREE.Quaternion(), qs = new THREE.Quaternion(), qw = new THREE.Quaternion();
    const basis = new THREE.Matrix4();
    // the camera's right, up and towards-camera directions, in the ring's own frame (for the paper shadows)
    const toRing = this.ring.quaternion.clone().invert();
    this.camera.updateMatrixWorld();
    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).applyQuaternion(toRing);
    const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).applyQuaternion(toRing);
    const camBack = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2).applyQuaternion(toRing);
    for (let i = 0; i < n; i++) {
      const c = this.coins[i];
      // where along the path (0..1), moving with the loop. DNA pairs coins across its two strands.
      const dna = p.shape === 'dna';
      const slots = dna ? Math.ceil(n / 2) : n;
      const k = dna ? Math.floor(i / 2) : i;
      const sPos = (((k / slots + dir * u) % 1) + 1) % 1;
      const { pos, T, F } = pathAt(p, sPos, dna ? (i % 2) * Math.PI : 0);
      c.position.copy(pos);
      c.scale.setScalar(p.size);
      // the coin's axis (model Y) leans from its facing direction (F) towards the direction of travel (T)
      const axis = F.clone().multiplyScalar(Math.cos(lean)).add(T.clone().multiplyScalar(Math.sin(lean))).normalize();
      // twist: roll the coin about the direction of travel, whole turns over the path, so the loop stays seamless
      if (p.twist) axis.applyAxisAngle(T, sPos * Math.PI * 2 * p.twist);
      let side = new THREE.Vector3().crossVectors(T, axis);
      if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0);
      side.normalize();
      const fwd = new THREE.Vector3().crossVectors(side, axis).normalize();
      side = new THREE.Vector3().crossVectors(axis, fwd).normalize();
      basis.makeBasis(side, axis, fwd);
      q.setFromRotationMatrix(basis);
      // whole spins per loop (seamless), plus a small seamless wobble
      qs.setFromAxisAngle(new THREE.Vector3(0, 1, 0), u * Math.PI * 2 * p.spins + i * 0.9);
      const w = Math.sin(u * Math.PI * 2 * 3 + i * 1.7) * p.wobble * 0.35;
      qw.setFromAxisAngle(new THREE.Vector3(1, 0, 0), w);
      c.quaternion.copy(q).multiply(qw).multiply(qs);
      if (c.userData.paper) {
        c.scale.set(p.size, p.size * 0.32, p.size); // thin, like card
        const sh = this.shadows[i];
        if (sh) {
          sh.visible = c.visible;
          sh.quaternion.copy(c.quaternion);
          sh.scale.copy(c.scale);
          sh.position.copy(c.position)
            .addScaledVector(camRight, 0.16 * p.size)
            .addScaledVector(camUp, -0.22 * p.size)
            .addScaledVector(camBack, -0.45 * p.size); // down-right, and just behind
        }
      }
    }
    this.shadows.forEach((sh, i) => sh && i >= n && (sh.visible = false));
    this.ring.rotation.set(THREE.MathUtils.degToRad(-p.tilt), 0, 0);
    this.ring.position.set(p.offsetX, p.offsetY, p.offsetZ ?? 0);
    const dist = 26 / p.zoom;
    this.camera.position.set(0, 0, dist);
    this.camera.up.set(Math.sin(THREE.MathUtils.degToRad(p.dutch)), Math.cos(THREE.MathUtils.degToRad(p.dutch)), 0);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  /** Screen pixels to world units at the ring's depth, along the screen's right and up (the dutch angle rolls them):
   *  so a drag moves the coins exactly with the pointer. */
  dragAxes() {
    const p = this.p;
    const h = this.canvas.clientHeight || 1;
    const depth = 26 / p.zoom - (p.offsetZ ?? 0);
    const k = (2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / h;
    const d = THREE.MathUtils.degToRad(p.dutch);
    return { k, right: [Math.cos(d), -Math.sin(d)] as const, up: [Math.sin(d), Math.cos(d)] as const };
  }

  /** The box the coins cover on screen (px from the canvas's top left), counting each coin's size, for a position. */
  private extents(p: CoinParams, offX: number, offY: number) {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.ring.rotation.set(THREE.MathUtils.degToRad(-p.tilt), 0, 0);
    this.ring.position.set(offX, offY, p.offsetZ ?? 0);
    this.ring.updateMatrixWorld(true);
    this.camera.position.set(0, 0, 26 / p.zoom);
    this.camera.up.set(Math.sin(THREE.MathUtils.degToRad(p.dutch)), Math.cos(THREE.MathUtils.degToRad(p.dutch)), 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    const up = this.camera.up.clone().multiplyScalar(p.size * 1.05);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).multiplyScalar(p.size * 1.05);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const px = (v: THREE.Vector3) => [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h] as const;
    for (const phase of p.shape === 'dna' ? [0, Math.PI] : [0])
      for (let k = 0; k < 240; k++) {
        const c = this.ring.localToWorld(pathAt(p, k / 240, phase).pos.clone());
        const ctr = c.clone().project(this.camera);
        if (ctr.z >= 1) continue;
        // horizontal reach among coins on screen vertically, vertical reach among coins on screen horizontally
        if (Math.abs(ctr.y) <= 1.05) {
          const [l] = px(c.clone().sub(right).project(this.camera)), [r] = px(c.clone().add(right).project(this.camera));
          minX = Math.min(minX, l, r); maxX = Math.max(maxX, l, r);
        }
        if (Math.abs(ctr.x) <= 1.05) {
          const [, t] = px(c.clone().add(up).project(this.camera)), [, b] = px(c.clone().sub(up).project(this.camera));
          minY = Math.min(minY, t, b); maxY = Math.max(maxY, t, b);
        }
      }
    const k = (2 * (26 / p.zoom - (p.offsetZ ?? 0)) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / h;
    return { minX, maxX, minY, maxY, k };
  }

  /** Slide the coins (never scale them) into free space on the page:
   *  'right': their left edge at `x`, centred on `y` (beside left-aligned text).
   *  'above': their bottom edge at `y` (over text in the bottom corner).
   *  'center': centred on (x, y) (behind a card). 'between': centred on `y` only (in a gap between header and text).
   *  Returns the new offsets. */
  fitRegion(p: CoinParams, anchor: 'right' | 'above' | 'center' | 'between', x: number, y: number) {
    let offX = p.offsetX, offY = p.offsetY;
    for (let iter = 0; iter < 10; iter++) {
      const e = this.extents(p, offX, offY);
      if (anchor === 'right' && isFinite(e.minX)) offX += (x - e.minX) * e.k;
      if (anchor === 'center' && isFinite(e.minX)) offX += (x - (e.minX + e.maxX) / 2) * e.k;
      if (anchor === 'above' && isFinite(e.maxY)) offY += (e.maxY - y) * e.k;
      if (anchor !== 'above' && isFinite(e.minY)) offY += ((e.minY + e.maxY) / 2 - y) * e.k; // right, center, between
    }
    return { offsetX: +offX.toFixed(2), offsetY: +offY.toFixed(2) };
  }

  /** Where the coins reach on screen (px from the canvas top): the top of the highest coin and the bottom of the lowest,
   *  among those horizontally in frame. */
  private reach(p: CoinParams, offY: number, zoom: number, middleOnly = false) {
    const h = this.canvas.clientHeight || 1;
    this.ring.rotation.set(THREE.MathUtils.degToRad(-p.tilt), 0, 0);
    this.ring.position.set(p.offsetX, offY, p.offsetZ ?? 0);
    this.ring.updateMatrixWorld(true);
    this.camera.position.set(0, 0, 26 / zoom);
    this.camera.up.set(Math.sin(THREE.MathUtils.degToRad(p.dutch)), Math.cos(THREE.MathUtils.degToRad(p.dutch)), 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    const up = this.camera.up.clone().multiplyScalar(p.size * 1.05);
    let top = Infinity, bottom = -Infinity;
    for (const phase of p.shape === 'dna' ? [0, Math.PI] : [0])
      for (let k = 0; k < 240; k++) {
        const c = this.ring.localToWorld(pathAt(p, k / 240, phase).pos.clone());
        const t = c.clone().add(up).project(this.camera), b = c.clone().sub(up).project(this.camera);
        if (middleOnly && Math.abs(t.x) > 0.35) continue; // the cradle: only its bottom must clear the text
        if (Math.abs(t.x) <= 1.05 && t.z < 1) top = Math.min(top, ((1 - t.y) / 2) * h);
        if (Math.abs(b.x) <= 1.05 && b.z < 1) bottom = Math.max(bottom, ((1 - b.y) / 2) * h);
      }
    return { top, bottom, k: (2 * (26 / zoom - (p.offsetZ ?? 0)) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / h };
  }

  /** Landing page placement, so the coins never cross the hero text.
   *  'top': the highest coin sits at `topPx` and the rest may run off the bottom (the ring's sweeping arc).
   *  'band': the whole shape is scaled and centred to fit between `topPx` and `bottomPx` (wave, helix, DNA, infinity). */
  fitLanding(p: CoinParams, topPx: number, bottomPx: number, mode: 'top' | 'band' | 'middle') {
    let offY = p.offsetY, zoom = p.zoom;
    for (let iter = 0; iter < 10; iter++) {
      let r = this.reach(p, offY, zoom, mode === 'middle');
      if (!isFinite(r.top)) break;
      if (mode === 'band' && isFinite(r.bottom)) {
        // scale so the shape's height fills the band (screen size grows with zoom)
        const ext = r.bottom - r.top, band = bottomPx - topPx;
        if (ext > 1) zoom = Math.max(0.4, Math.min(5, zoom * Math.pow(band / ext, 0.9)));
        r = this.reach(p, offY, zoom);
        offY += ((r.top + r.bottom) / 2 - (topPx + bottomPx) / 2) * r.k;
      } else offY += (r.top - topPx) * r.k;
    }
    return { offsetY: +offY.toFixed(2), zoom: +zoom.toFixed(3) };
  }

  start() {
    const tick = () => {
      this.frame();
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    tick();
  }

  setPaused(v: boolean) {
    this.paused = v;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
