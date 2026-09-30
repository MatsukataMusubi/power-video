// world1 (climb.ts) geometry: the IFSC speed wall as a 3D wireframe, in metres (y up = elevation,
// the face leaning 5° toward the viewer, +z). Two identical 3 m lanes either side of x = 0:
// left = lane A (the route drawn by hand), right = lane B (the same route, plotted).
//
// The wall "keeps growing past its 15 m top": section s (s = 0…NS−1) is the standard wall scaled
// by k = 2^s about the lane divider and stacked on the one below, so section s spans
// 15(2^s − 1) … 15(2^(s+1) − 1) m. Doubling heights (1, 2, 4 … 1024 m) climb one section per
// doubling from 16 m on, and 1024 m clears the top of the sixth section (945 m).
//
// The route is the IFSC standard's shape in spirit (20 hand holds, 11 foot holds, a top pad), not
// its surveyed bolt positions.
import { noise1 } from '../engine/util';

export type V3 = [number, number, number];
export type P2 = { x: number; y: number };

export const LEAN_A = (5 * Math.PI) / 180;
export const LEAN = Math.tan(LEAN_A);
const SN = Math.sin(LEAN_A), CS = Math.cos(LEAN_A);
/** Sections in the tower (the base wall + five copies). */
export const NS = 6;
export const K = (s: number) => 2 ** s;
export const Y0 = (s: number) => 15 * (2 ** s - 1);
export const TOP = (s: number) => 15 * (2 ** (s + 1) - 1);

/** Face coordinates (x across, y = elevation, o = out of the face toward the viewer) → world. */
export const face = (x: number, y: number, o = 0): V3 => [x, y - o * SN, y * LEAN + o * CS];
/** Face normal (toward the viewer) and the unit vector up along the face. */
export const NRM: V3 = [0, -SN, CS];
export const UPF: V3 = [0, CS, SN];

/** Hand holds in lane coordinates: u across the lane (0…3 m from its left edge), v elevation, rotation. */
export const HAND: [number, number, number][] = [
  [1.3, 1.0, -0.2], [1.95, 1.55, 0.35], [1.05, 2.0, -0.4], [1.8, 2.65, 0.25], [1.25, 3.3, -0.1],
  [1.95, 4.0, 0.4], [1.15, 4.65, -0.3], [2.05, 5.35, 0.2], [1.4, 6.05, -0.08], [2.25, 6.7, 0.45],
  [1.55, 7.35, -0.12], [0.95, 8.0, -0.5], [1.7, 8.7, 0.1], [2.3, 9.4, 0.5], [1.45, 10.1, -0.2],
  [2.05, 10.85, 0.3], [1.2, 11.6, -0.35], [1.85, 12.4, 0.2], [1.35, 13.2, -0.15], [1.75, 14.0, 0.1],
];
export const FOOT: [number, number][] = [[0.8, 0.35], [2.2, 0.6], [1.6, 1.3], [0.7, 2.4], [2.4, 3.0], [0.9, 4.2], [2.5, 5.0], [0.8, 6.4], [2.6, 7.8], [0.7, 9.9], [2.5, 11.2]];
/** The top (finish) pad of each lane: centre and size. */
export const PAD = { u: 1.5, v: 14.7, w: 0.38, h: 0.3 };
/** Hold heights: the hand hold's top face stands this far out of the wall. */
export const HOLD_OUT = 0.075;
export const FOOT_OUT = 0.035;
/** The timer board above the top, centred on the divider (face coords, metres). */
export const BOARD = { y: 16.25, hx: 1.65, hy: 0.72, hz: 0.1, out: 0.45 };

/** Lane x of a lane coordinate u, in section s (lane 0 = left/A, 1 = right/B). */
export const laneX = (lane: number, u: number, s: number) => (lane === 0 ? u - 3 : u) * K(s);

function chaikin(p: P2[], n: number): P2[] {
  let q = p;
  for (let k = 0; k < n; k++) {
    const r: P2[] = [];
    for (let i = 0; i < q.length; i++) {
      const a = q[i]!, b = q[(i + 1) % q.length]!;
      r.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    q = r;
  }
  return q;
}
/** The standard hand hold's outline (hold-local metres, y up): a rounded trapezoid, the jug edge on top. */
export const HOLD_SHAPE = chaikin([{ x: -0.2, y: -0.12 }, { x: 0.2, y: -0.12 }, { x: 0.22, y: -0.02 }, { x: 0.15, y: 0.13 }, { x: -0.15, y: 0.13 }, { x: -0.22, y: -0.02 }], 2);
export const HOLD_TOP = { s: 0.78, dy: 0.02 };
const FOOT_SHAPE = chaikin([{ x: -0.08, y: -0.05 }, { x: 0.08, y: -0.05 }, { x: 0, y: 0.08 }], 2);

// ------------------------------------------------------------------ static segments
export const KIND = { EDGE: 0, PANEL: 1, BACK: 2, HOLD: 3, FOOT: 4, PAD: 5, DIV: 6, FLOOR: 7 } as const;

/** Static wireframe of one section: segment endpoints (6 floats each), px width, alpha, kind; plus the
 * segment's mid elevation (the plot-in sweep) and distance from the first hold (section 0's unfold). */
export interface Segs { s: Float32Array; w: Float32Array; a: Float32Array; k: Uint8Array; ym: Float32Array; d0: Float32Array; n: number }

export function buildSection(sec: number): Segs {
  const k = K(sec), y0 = Y0(sec);
  const out: number[] = [], ws: number[] = [], as: number[] = [], ks: number[] = [];
  const seg = (a: V3, b: V3, w: number, al: number, kind: number) => { out.push(...a, ...b); ws.push(w); as.push(al); ks.push(kind); };
  const F = (x: number, v: number, o = 0) => face(x * k, y0 + v * k, o * k);
  const hx = 3, hv = 15, back = -0.55;
  // face: outline, panel grid (1.5 m panels), the lane divider
  seg(F(-hx, 0), F(hx, 0), 1.5, 0.85, KIND.EDGE);
  seg(F(-hx, hv), F(hx, hv), 1.5, 0.85, KIND.EDGE);
  seg(F(-hx, 0), F(-hx, hv), 1.5, 0.85, KIND.EDGE);
  seg(F(hx, 0), F(hx, hv), 1.5, 0.85, KIND.EDGE);
  seg(F(0, 0), F(0, hv), 1.3, 0.7, KIND.DIV);
  for (const x of [-1.5, 1.5]) seg(F(x, 0), F(x, hv), 1, 0.3, KIND.PANEL);
  for (let v = 1.5; v < hv - 0.01; v += 1.5) seg(F(-hx, v), F(hx, v), 1, 0.3, KIND.PANEL);
  // behind the face: the frame (studs, rails, depth edges, a few braces)
  for (const x of [-hx, -1.5, 0, 1.5, hx]) seg(F(x, 0, back), F(x, hv, back), 1, 0.5, KIND.BACK);
  for (let v = 0; v <= hv + 0.01; v += 3) seg(F(-hx, v, back), F(hx, v, back), 1, 0.5, KIND.BACK);
  for (const x of [-hx, hx]) for (const v of [0, 7.5, hv]) seg(F(x, v, 0), F(x, v, back), 1.1, 0.6, KIND.BACK);
  for (let v = 0; v < hv - 0.01; v += 3) { seg(F(-hx, v, back), F(-1.5, v + 3, back), 1, 0.3, KIND.BACK); seg(F(hx, v, back), F(1.5, v + 3, back), 1, 0.3, KIND.BACK); }
  // holds, identical in both lanes
  for (let lane = 0; lane < 2; lane++) {
    const lx = (u: number) => (lane === 0 ? u - 3 : u);
    for (const [u, v, rot] of HAND) {
      const c = Math.cos(rot), sn = Math.sin(rot);
      const P = (p: P2, sc: number, dy: number, o: number) => F(lx(u) + (p.x * c - (p.y + dy) * sn) * sc, v + (p.x * sn + (p.y + dy) * c) * sc, o);
      const n = HOLD_SHAPE.length;
      for (let i = 0; i < n; i++) {
        const a = HOLD_SHAPE[i]!, b = HOLD_SHAPE[(i + 1) % n]!;
        seg(P(a, 1, 0, 0), P(b, 1, 0, 0), 1.2, 0.75, KIND.HOLD);
        seg(P(a, HOLD_TOP.s, HOLD_TOP.dy, HOLD_OUT), P(b, HOLD_TOP.s, HOLD_TOP.dy, HOLD_OUT), 1.2, 0.8, KIND.HOLD);
      }
      for (let i = 0; i < n; i += n / 4) seg(P(HOLD_SHAPE[i]!, 1, 0, 0), P(HOLD_SHAPE[i]!, HOLD_TOP.s, HOLD_TOP.dy, HOLD_OUT), 1, 0.6, KIND.HOLD);
    }
    for (const [u, v] of FOOT) {
      const n = FOOT_SHAPE.length;
      for (let i = 0; i < n; i++) {
        const a = FOOT_SHAPE[i]!, b = FOOT_SHAPE[(i + 1) % n]!;
        seg(F(lx(u) + a.x, v + a.y), F(lx(u) + b.x, v + b.y), 1, 0.55, KIND.FOOT);
        seg(F(lx(u) + a.x * 0.6, v + a.y * 0.6, FOOT_OUT), F(lx(u) + b.x * 0.6, v + b.y * 0.6, FOOT_OUT), 1, 0.55, KIND.FOOT);
      }
    }
    // top pad
    const pu = lx(PAD.u), pv = PAD.v, pw = PAD.w / 2, ph = PAD.h / 2;
    const q = [[-pw, -ph], [pw, -ph], [pw, ph], [-pw, ph]] as const;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = q[i]!, [bx, by] = q[(i + 1) % 4]!;
      seg(F(pu + ax, pv + ay, 0.04), F(pu + bx, pv + by, 0.04), 1.3, 0.85, KIND.PAD);
      seg(F(pu + ax, pv + ay, 0), F(pu + ax, pv + ay, 0.04), 1, 0.6, KIND.PAD);
    }
  }
  if (sec === 0) {
    // the floor and the landing mat in front of the wall
    const fl = (x: number, y: number, z: number): V3 => [x, y, z];
    seg(fl(-5, 0, 0), fl(5, 0, 0), 1, 0.35, KIND.FLOOR);
    const mx = 3.3, z0 = 0.25, z1 = 2.4, mh = 0.32;
    const mb: V3[] = [[-mx, 0, z0], [mx, 0, z0], [mx, 0, z1], [-mx, 0, z1]], mt: V3[] = mb.map(([x, , z]) => [x, mh, z] as V3);
    for (let i = 0; i < 4; i++) { seg(mb[i]!, mb[(i + 1) % 4]!, 1, 0.4, KIND.FLOOR); seg(mt[i]!, mt[(i + 1) % 4]!, 1, 0.5, KIND.FLOOR); seg(mb[i]!, mt[i]!, 1, 0.4, KIND.FLOOR); }
    seg(fl(0, mh, z0), fl(0, mh, z1), 1, 0.3, KIND.FLOOR);
  }
  const n = ws.length;
  const s = new Float32Array(out);
  const ym = new Float32Array(n), d0 = new Float32Array(n);
  const hx0 = (HAND[0]![0] - 3) * k, hy0 = y0 + HAND[0]![1] * k;
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const mxw = (s[o]! + s[o + 3]!) / 2, myw = (s[o + 1]! + s[o + 4]!) / 2;
    ym[i] = myw;
    d0[i] = Math.hypot(mxw - hx0, myw - hy0);
  }
  return { s, w: new Float32Array(ws), a: new Float32Array(as), k: new Uint8Array(ks), ym, d0, n };
}

// ------------------------------------------------------------------ the route
/** A lane's route through all sections, in face coordinates (x, y), with arc length. */
export interface Route { x: Float32Array; y: Float32Array; s: Float32Array; sec: Uint8Array; n: number; len: number }

export function buildRoute(lane: number, wobble: number, seed: number): Route {
  const key: { x: number; y: number; s: number }[] = [];
  for (let sec = 0; sec < NS; sec++) {
    for (const [u, v] of HAND) key.push({ x: laneX(lane, u, sec), y: Y0(sec) + v * K(sec), s: sec });
    key.push({ x: laneX(lane, PAD.u, sec), y: Y0(sec) + PAD.v * K(sec), s: sec });
  }
  // beyond the last section's top: straight up, where the dot bursts out
  const last = key[key.length - 1]!;
  key.push({ x: last.x, y: TOP(NS - 1) * 1.45, s: NS - 1 });
  const xs: number[] = [], ys: number[] = [], ss: number[] = [], secs: number[] = [];
  let acc = 0, px = key[0]!.x, py = key[0]!.y;
  for (let i = 0; i + 1 < key.length; i++) {
    const a = key[i]!, b = key[i + 1]!;
    const k = K(b.s);
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.ceil(L / (0.14 * k)));
    const nx = -(b.y - a.y) / (L || 1), ny = (b.x - a.x) / (L || 1);
    for (let j = i === 0 ? 0 : 1; j <= n; j++) {
      const u = j / n;
      // a hand's wobble: slow drift across the line, pinned at the holds
      const pin = Math.sin(Math.PI * u);
      const wv = wobble * k * pin * (noise1((acc + L * u) / k * 1.1, seed) * 0.8 + noise1((acc + L * u) / k * 4.3, seed + 5) * 0.25);
      const x = a.x + (b.x - a.x) * u + nx * wv, y = a.y + (b.y - a.y) * u + ny * wv;
      if (xs.length) acc += Math.hypot(x - px, y - py);
      xs.push(x); ys.push(y); ss.push(acc); secs.push(b.s);
      px = x; py = y;
    }
  }
  return { x: new Float32Array(xs), y: new Float32Array(ys), s: new Float32Array(ss), sec: new Uint8Array(secs), n: xs.length, len: acc };
}

/** Arc length at which the route first reaches elevation y. */
export function routeSAtY(r: Route, y: number): number {
  if (y <= r.y[0]!) return 0;
  for (let i = 1; i < r.n; i++) {
    if (r.y[i]! >= y) {
      const u = (y - r.y[i - 1]!) / Math.max(1e-6, r.y[i]! - r.y[i - 1]!);
      return r.s[i - 1]! + (r.s[i]! - r.s[i - 1]!) * u;
    }
  }
  return r.len;
}
/** Point on the route at arc length s. */
export function routeAt(r: Route, s: number): P2 {
  if (s <= 0) return { x: r.x[0]!, y: r.y[0]! };
  let lo = 0, hi = r.n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.s[m]! < s) lo = m; else hi = m; }
  const u = Math.min(1, (s - r.s[lo]!) / Math.max(1e-6, r.s[hi]! - r.s[lo]!));
  return { x: r.x[lo]! + (r.x[hi]! - r.x[lo]!) * u, y: r.y[lo]! + (r.y[hi]! - r.y[lo]!) * u };
}
