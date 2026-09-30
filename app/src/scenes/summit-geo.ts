// submit / tail (summit.ts): the elevation profile's geometry. A route in (u, e): u is distance along
// the route (arbitrary units), e is the elevation in log10 watts. The approach is the film's values so
// far (the hooks' 20 W … 1 GW and world1's 2 kW spike, "briefly"); then one peak per sung
// "submit / summit", each higher than the last, each a false summit; after the last one the ground
// keeps rising (a smooth, unsurveyed projection) and runs off the sheet.
// The screen mapping ("view") fits the newest revealed peak at a fixed spot: elevation is log-linear
// from the datum (1 W) at YB; distance is compressed toward the start (horizontal scale NTS).
import { fbm1, lerp } from '../engine/util';
import { HANDOFF } from './_power';

export const XA = 170; // the elevation axis
export const XR0 = 196; // the route's start
export const YB = 930; // the datum, 1 W
export const XT = 1440, YT = 330; // where the newest revealed peak sits
export const PG = 2.2; // horizontal compression exponent
export const GAMMA = 2.2; // the ascents: flat out of the col, steep at the top
export const FLANK_A = 1.08; // the endless flank after the last col: e = ec + A (u - uc)^2

/** The peaks, one per sung submit/summit. Real-world values (watts) with deadpan notes. */
export const PEAKS = [
  { w: 2e13, note: 'K 0.73 · all of humanity, on average' },
  { w: 1.3e14, note: 'K 0.81 · all photosynthesis on Earth' },
  { w: 1e16, note: 'K 1.00 · Kardashev type I (Sagan)' },
  { w: 1.74e17, note: 'K 1.12 · all the sunlight reaching Earth' },
  { w: 3.83e26, note: 'K 2.06 · the Sun · Kardashev type II' },
  { w: 1e37, note: 'K 3.10 · the Milky Way · type III (approx.)' },
  { w: 1.5e39, note: 'K 3.32 · quasar 3C 273' },
  { w: 1e48, note: 'K 4.20 · every star in the observable universe (est.)' },
  { w: 3.6e49, note: 'K 4.36 · GW150914, two black holes merging, at peak' },
] as const;

/** The approach: the film's values so far (u, e = log10 W, label). */
const APPROACH: [number, number, string?][] = [
  [0, Math.log10(20), '20 W'], [0.1, 1.38], [0.17, 1.52], [0.2, 1.68],
  [0.222, Math.log10(2000), '2 kW (briefly)'], [0.245, 2.0], [0.3, 2.12], [0.37, 2.55],
  [0.44, Math.log10(700), '700 W'], [0.52, 2.5], [0.62, 3.7], [0.75, 5.9], [0.87, 7.25],
  [0.95, Math.log10(1.5e8), '150 MW'], [1.04, 7.55], [1.13, 8.25], [1.25, 9, '1 GW'], [1.36, 8.3],
];
const U_COL0 = 1.48, E_COL0 = 7.9, U_P0 = 2.0;

export interface View { uTop: number; eTop: number; xT: number; yT: number; a: number }
export const lerpView = (A: View, B: View, k: number): View => ({
  uTop: lerp(A.uTop, B.uTop, k), eTop: lerp(A.eTop, B.eTop, k), xT: lerp(A.xT, B.xT, k), yT: lerp(A.yT, B.yT, k), a: lerp(A.a, B.a, k),
});
export function sx(v: View, u: number) {
  const r = Math.max(0, u / v.uTop);
  return XR0 + (v.xT - XR0) * (v.a * r + (1 - v.a) * Math.pow(r, PG));
}
export function sy(v: View, e: number) { return YB - (e / v.eTop) * (YB - v.yT); }
/** u at screen x (bisection; sx is monotonic). */
export function ux(v: View, x: number) {
  let lo = 0, hi = v.uTop * 4;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sx(v, m) < x) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export interface RPeak {
  u: number; e: number; w: number; note: string;
  /** the col after this peak, and where the ground beyond reaches this peak's level again (the sight line's end) */
  cu: number; ce: number; land: number;
}

export class Route {
  peaks: RPeak[] = [];
  labels: { u: number; e: number; text: string }[] = [];
  us: Float32Array; es: Float32Array; N: number;
  du = 0.005;
  /** The endless flank after the last col (noise-free). */
  fu = 0; fe = 0;
  uEnd: number;

  constructor(values: { w: number; note: string }[]) {
    // peaks: spacing grows with the rise; the col after each peak is shallow, close to it
    let u = U_P0;
    values.forEach((v, i) => {
      const e = Math.log10(v.w);
      if (i > 0) { const prev = this.peaks[i - 1]!; u = prev.u + 0.95 + 0.28 * Math.sqrt(Math.max(0, e - prev.e)); }
      this.peaks.push({ u, e, w: v.w, note: v.note, cu: 0, ce: 0, land: 0 });
    });
    const n = this.peaks.length;
    for (let i = 0; i < n - 1; i++) {
      const p = this.peaks[i]!, q = this.peaks[i + 1]!;
      p.cu = p.u + 0.3 * (q.u - p.u);
      p.ce = p.e - (0.8 + 0.1 * (q.e - p.e));
    }
    const last = this.peaks[n - 1]!;
    last.cu = last.u + 0.4; last.ce = last.e - 2.0;
    this.fu = last.cu; this.fe = last.ce;
    this.uEnd = last.cu + 9;
    for (const [au, ae, lab] of APPROACH) if (lab) this.labels.push({ u: au, e: ae, text: lab });

    this.N = Math.ceil(this.uEnd / this.du) + 1;
    this.us = new Float32Array(this.N); this.es = new Float32Array(this.N);
    for (let i = 0; i < this.N; i++) { const uu = i * this.du; this.us[i] = uu; this.es[i] = this.shape(uu); }
    // sight lines: where the ascent after each col first reaches the peak's level
    for (let i = 0; i < n; i++) {
      const p = this.peaks[i]!;
      let j = Math.ceil(p.cu / this.du);
      while (j < this.N - 1 && this.es[j]! < p.e) j++;
      const a = this.es[j - 1]!, b = this.es[j]!;
      p.land = (j - 1 + (p.e - a) / Math.max(1e-6, b - a)) * this.du;
    }
  }

  /** The ground's elevation at u (analytic; the samples cache it). */
  private shape(u: number): number {
    const P = this.peaks, n = P.length;
    if (u < U_COL0) {
      let k = 0;
      while (k < APPROACH.length - 1 && APPROACH[k + 1]![0] <= u) k++;
      const A = APPROACH[k]!, B = APPROACH[k + 1] ?? [U_COL0, E_COL0];
      const s = Math.min(1, (u - A[0]) / Math.max(1e-6, B[0] - A[0]));
      return lerp(A[1], B[1], s) + fbm1(u * 38, 3, 5) * 0.16 * Math.sin(Math.PI * s);
    }
    if (u < P[0]!.u) {
      const s = (u - U_COL0) / (P[0]!.u - U_COL0);
      return this.ascent(E_COL0, P[0]!.e, s, u, 11);
    }
    for (let i = 0; i < n; i++) {
      const p = P[i]!;
      if (u < p.cu) { // descent into the col: steep off the top, flat at the saddle
        const s = (u - p.u) / (p.cu - p.u);
        const d = p.e - p.ce;
        return p.e - d * (1 - (1 - s) * (1 - s)) + rough(u, 20 + i) * (0.09 * d + 0.22) * Math.sin(Math.PI * s);
      }
      if (i < n - 1 && u < P[i + 1]!.u) return this.ascent(p.ce, P[i + 1]!.e, (u - p.cu) / (P[i + 1]!.u - p.cu), u, 30 + i);
    }
    // the endless flank: smooth (unsurveyed), up and to the right
    return this.fe + FLANK_A * (u - this.fu) * (u - this.fu);
  }
  private ascent(e0: number, e1: number, s: number, u: number, seed: number) {
    const d = e1 - e0;
    return e0 + d * Math.pow(s, GAMMA) + rough(u, seed) * (0.045 * d + 0.2) * Math.sin(Math.PI * s);
  }

  eAt(u: number) {
    const x = u / this.du;
    const i = Math.max(0, Math.min(this.N - 2, Math.floor(x)));
    const f = Math.max(0, Math.min(1, x - i));
    return this.es[i]! * (1 - f) + this.es[i + 1]! * f;
  }
  /** The endless flank: u at elevation e (inverse, noise-free). */
  flankU(e: number) { return this.fu + Math.sqrt(Math.max(0, e - this.fe) / FLANK_A); }
}

/** Terrain roughness: fractal, with a sharper small-scale octave (ridges, not bowls). */
function rough(u: number, seed: number) {
  const r = fbm1(u * 9, 4, seed);
  const k = fbm1(u * 34, 3, seed + 50);
  return r + 0.45 * (Math.abs(k) * 2 - 0.5);
}

// ------------------------------------------------------------------ views
/** The detonation's view: the first peak at the frame centre (the cladogram's branch tip). */
export function view0(r: Route): View {
  const p = r.peaks[0]!;
  return { uTop: p.u, eTop: p.e, xT: HANDOFF.summit.x, yT: HANDOFF.summit.y, a: 1 };
}
/** Peak i revealed as the newest, fitted top right. */
export function viewFit(r: Route, i: number): View {
  const p = r.peaks[Math.min(i, r.peaks.length - 1)]!;
  return { uTop: p.u, eTop: p.e, xT: XT, yT: YT, a: 0.45 };
}
/** The end card: the last peak lower and further left, so the endless flank has the room to leave the sheet. */
export function viewCard(r: Route): View {
  const p = r.peaks[r.peaks.length - 1]!;
  return { uTop: p.u, eTop: p.e, xT: 1150, yT: 400, a: 0.45 };
}

// ------------------------------------------------------------------ values
/** A value for display: plain SI ("20 TW") or mantissa × 10^exponent ("3.8×10²⁶ W", "10³⁷ W"). */
export interface Val { plain?: string; m?: string; e?: number }
export function fmtW(v: number, si: (x: number) => string): Val {
  const s = si(v);
  const m = s.match(/^([\d.]+)×10([⁰¹²³⁴⁵⁶⁷⁸⁹]+) W$/);
  if (!m) return { plain: s };
  const e = +Array.from(m[2]!).map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('');
  // exact powers of ten are orders of magnitude here: 10³⁷ W, not 1.0×10³⁷ W
  return m[1] === '1.0' ? { e } : { m: m[1]!, e };
}
export const valText = (v: Val) => v.plain ?? `${v.m ? `${v.m}×` : ''}10^${v.e} W`;
