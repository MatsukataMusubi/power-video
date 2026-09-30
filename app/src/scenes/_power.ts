// Shared motifs, read-only for the plate files (so they look identical everywhere):
//  - the DOT: the thread object handed across every cut (P(doom)'s spark, ours): a blue point with a
//    white-hot core and a faint double ring, the membrane it will turn out to have (world4 reveals it
//    as a mitochondrion, docs/PLATES.md)
//  - the VALUE: power on the Kardashev scale (K, with the watts and what they are), full screen only on
//    the hooks, once per plate elsewhere in that plate's own idiom
//  - HANDOFF: where one plate's last shape sits, so the next plate's first frame starts from it
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { hash, TAU } from '../engine/util';

// ------------------------------------------------------------------ the dot
/** The dot's head, Canvas2D: blue halo, white-hot core, and (ring > 0) the faint double membrane. */
export function dot2D(c: CanvasRenderingContext2D, x: number, y: number, t: number, scale = 1, intensity = 1, ring = 0.35) {
  const flick = 0.9 + 0.1 * Math.sin(t * 83.1) * Math.sin(t * 51.7);
  const I = Math.max(0, intensity * flick);
  if (I <= 0.001) return;
  c.save();
  const R = 22 * scale;
  const g = c.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(246,248,255,${Math.min(1, I)})`);
  g.addColorStop(0.16, `rgba(157,180,255,${0.95 * Math.min(1, I)})`);
  g.addColorStop(0.42, rgba('signal', 0.5 * Math.min(1, I)));
  g.addColorStop(1, rgba('signal', 0));
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
  if (ring > 0) {
    c.lineWidth = Math.max(0.8, 1.1 * scale);
    c.strokeStyle = rgba('ember', ring * Math.min(1, I));
    c.beginPath(); c.ellipse(x, y, 9.5 * scale, 7.5 * scale, 0.5, 0, TAU); c.stroke();
    c.strokeStyle = rgba('ember', 0.55 * ring * Math.min(1, I));
    c.beginPath(); c.ellipse(x, y, 12.5 * scale, 10 * scale, 0.5, 0, TAU); c.stroke();
  }
  c.restore();
}

/** A burst of short blue streaks from a point (ignition, arrivals). Deterministic in (t0, seed). */
export function burst2D(c: CanvasRenderingContext2D, x: number, y: number, t: number, t0: number, o: { n?: number; speed?: number; life?: number; seed?: number; width?: number } = {}) {
  const age = t - t0, life = o.life ?? 0.5;
  if (age < 0 || age > life) return;
  const n = o.n ?? 90, sp = o.speed ?? 1400, seed = o.seed ?? 7;
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed) * TAU, v = sp * (0.2 + hash(i, seed + 1) ** 2);
    const lf = life * (0.3 + 0.7 * hash(i, seed + 2));
    if (age > lf) continue;
    const k = 1 - age / lf;
    const d0 = v * Math.max(0, age - 0.02) * (1 - age / (2 * lf)), d1 = v * age * (1 - age / (2 * lf));
    c.strokeStyle = k > 0.6 ? `rgba(230,236,255,${k})` : rgba('signal', k * 1.2);
    c.lineWidth = (o.width ?? 2) * (0.4 + k);
    c.beginPath();
    c.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0);
    c.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1);
    c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ the value
/** The four hooks' values (watts) and their deadpan footnotes. */
export const VALUES = [
  { w: 20, note: 'one adult human brain, at rest' },
  { w: 700, note: 'one datacentre GPU, rated' },
  { w: 1.5e8, note: 'one 100,000-GPU cluster (est.)' },
  { w: 1e9, note: 'one datacentre campus' },
] as const;

/**
 * The Kardashev index, Sagan's continuous form (1973): K = (log₁₀ P − 6) / 10, P in watts. The film's
 * power line runs on it: a brain (20 W) is −0.47, one GPU −0.32, 1 MW is 0, humanity today ≈ 0.73,
 * type I 1.0, the Sun 2.06, a galaxy ≈ 3.1. Zero watts is −∞.
 */
export const kIndex = (w: number) => (w > 0 ? (Math.log10(w) - 6) / 10 : -Infinity);
/** K as printed: "−0.32", "0.73", "−∞" (true minus sign). */
export function fmtK(k: number, digits = 2): string {
  if (!Number.isFinite(k)) return k < 0 ? '−∞' : '∞';
  const s = Math.abs(k).toFixed(digits);
  return (k < 0 && Number(s) !== 0 ? '−' : '') + s;
}
/** Humanity's primary power use today (≈ 19.6 TW): the one fixed mark on every Kardashev ruler. */
export const HUMANITY_W = 1.96e13;

/** SI form: 20 W, 700 W, 150 MW, 1 GW, 3.8×10²⁶ W. */
export function siW(v: number): string {
  const P: [number, string][] = [[1e12, 'TW'], [1e9, 'GW'], [1e6, 'MW'], [1e3, 'kW'], [1, 'W']];
  if (v >= 1e15) {
    const e = Math.floor(Math.log10(v)), m = v / 10 ** e;
    const sup = String(e).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
    return `${m.toFixed(1)}×10${sup} W`;
  }
  for (const [s, u] of P) if (v >= s) { const x = v / s; return `${x >= 100 || Number.isInteger(x) ? Math.round(x) : x.toFixed(1)} ${u}`; }
  return `${v.toPrecision(2)} W`;
}

/** Plain integer watts with thousands separators: 150,000,000. */
export const fullW = (v: number) => Math.round(v).toLocaleString('en-US');

// ------------------------------------------------------------------ hand-offs (logical px, 1920×1080)
export const HANDOFF = {
  /** hook1 → world1: the dot lands on the first hold of the climbing wall. */
  climb: { x: W * 0.5, y: H * 0.8 },
  /** hook2 → world2: the blue field collapses into the one-line diagram's busbar. */
  bus: { y: Math.round(H * 0.46), w: 3 },
  /** hook3 → world4: one dot left in the dark, the petri dish's centre. */
  petri: { x: W / 2, y: H / 2 },
  /** hook4 → world5: the string of zeros becomes a full-width line, the first hypha; its tip. */
  hypha: { y: 629, x: 300 },
  /** world1 → prompt1, world4 → prompt3: the dot stops on the tip of the connector's pin 1. */
  pin: { x: W * 0.5, y: H * 0.5 },
  /** world2 → drop: the last counter wheel's window becomes the patch bay's first jack (centre, radius). */
  jack: { x: W * 0.5, y: H * 0.5, r: 16 },
  /** drop → verseA: the last lamp stretched into a full-width line; the patent sheet's first line. */
  paperLine: { y: Math.round(H * 0.5) },
  /** verseB → bridgeA: one rack slot left; the tape library's first slot (centre, size). */
  slot: { x: W * 0.5, y: H * 0.5, w: 132, h: 36 },
  /** bridgeB → prompt2: the frame's roll angle at the cut (rad); prompt2 opens on it and glides straight. */
  roll: -0.12,
  /** world5 → preach: the folds (cristae) line up as a row of organ pipes. */
  pipes: { x0: W * 0.18, x1: W * 0.82, top: H * 0.22, bot: H * 0.86, n: 23 },
  /** preach → inst: the wind collapses to a point; the exhibit's spotlight. */
  spot: { x: W * 0.5, y: H * 0.42 },
  /** inst → outroV: the spotlight collapses to a point, the cladogram's root. */
  clade: { x: W * 0.5, y: H * 0.5 },
  /** outroV → submit: the new blue branch's tip; submit detonates there. */
  summit: { x: W * 0.5, y: H * 0.5 },
} as const;
