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
export type Finish = 'silver' | 'chrome' | 'graphite' | 'gold' | 'coral' | 'violet' | Stone;
/** Metals reflect the studio; stones carry their own texture (drawn in code, see stoneMaps) and are matte. */
export const FINISHES: Record<Finish, { color: string; rough: number; metal: number; irid: number; stone?: Stone; label?: string }> = {
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
      // the faces: flat across, like a stamp
      uv[i * 2] = (p.getX(i) - bb.min.x) / sx;
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

  private material(f: Finish, p: CoinParams) {
    const key = f;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshPhysicalMaterial();
      this.mats.set(key, m);
    }
    const F = FINISHES[f];
    m.color.set(F.color);
    m.metalness = F.metal;
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
    const finishes = p.finishes.length ? p.finishes : (['silver'] as Finish[]);
    finishes.forEach((f) => this.material(f, p));
    if (p.hdri !== prev.hdri || !this.scene.environment) await this.env(p.hdri);
    this.scene.environmentRotation.set(0, THREE.MathUtils.degToRad(p.envTurn), 0);
    this.renderer.toneMappingExposure = p.exposure;

    this.scene.background = p.background === 'transparent' ? null : new THREE.Color(p.background);

    const layout = `${p.count}|${p.currencies.join()}|${finishes.join()}|${p.relief}`;
    if (layout !== (this as any)._layout || !this.coins.length) {
      (this as any)._layout = layout;
      this.coins.forEach((c) => this.ring.remove(c));
      const cur = p.currencies.length ? p.currencies : (['USD'] as Currency[]);
      this.coins = Array.from({ length: p.count }, (_, i) => {
        const code = cur[i % cur.length];
        const mesh = new THREE.Mesh((p.relief === 'raised' && this.geos.get(code + '_raised')) || this.geos.get(code)!, this.mats.get(finishes[i % finishes.length])!);
        mesh.frustumCulled = false; // ~30 coins: cheaper to draw than to risk a wrong cull
        this.ring.add(mesh);
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
    }
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
