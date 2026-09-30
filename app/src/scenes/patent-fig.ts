// verseA (patent.ts) FIG. 1: the exploded assembly the film has been building, drawn as patent line
// art. The parts are _parts.ts's four kinds (block, bar, plate, ring) stacked on one assembly axis in
// isometric, exploded apart; the base block is shown with a quarter removed (section hatching), the
// ring with patent surface shading. Occlusion is painter's order on the channel-coded ink layer:
// each face first erases what lies behind it (paints "no ink"), then is outlined. Coordinates are
// sheet-B px (the drawing sheet's centre at 0,0); Z is up the axis.
import { strokeText, drawStrokeText, type StrokeText } from '../engine/stroke';
import { clamp, ease, prog, TAU } from '../engine/util';

export type Ctx2 = CanvasRenderingContext2D;
export interface P2 { x: number; y: number }

// channel-coded inks (drawn with 'lighter' onto opaque black): R typewriter, G print/drawing, B the blue
export const TYPE = (a = 1) => `rgba(255,0,0,${a})`;
export const PRINT = (a = 1) => `rgba(0,255,0,${a})`;
export const BLUE = (a = 1) => `rgba(0,0,255,${a})`;

const C30 = Math.cos(Math.PI / 6);
/** The foot of the assembly axis (Z = 0) on sheet B. */
export const FIG = { ox: -150, oy: 215, s: 1.15 };
export const iso = (X: number, Y: number, Z: number): P2 => ({ x: FIG.ox + (X - Y) * C30 * FIG.s, y: FIG.oy + ((X + Y) * 0.5 - Z) * FIG.s });

const W1 = 3.1, W2 = 1.9, W3 = 1.15;
const BLK = { a: 140, h: 130, r: 46 };
const BAR = { L: 520, W: 84, h: 26, hole: 28, end: 16 };
const PLT = { s: 150, ch: 34, h: 22, hole: 42, bolt: 13, at: 104 };
export const RNG = { Ro: 150, Ri: 90, h: 34, bolt: 8, br: 121 };
const GAP = 150;

/** Heights along the axis for an explode factor e (0 = nearly seated, 1 = fully exploded). */
export interface Stack { blk0: number; blk1: number; bar0: number; bar1: number; plt0: number; plt1: number; rng0: number; rng1: number; top: number }
export function stack(e: number): Stack {
  const g = 12 + (GAP - 12) * e;
  const blk0 = 0, blk1 = BLK.h;
  const bar0 = blk1 + g, bar1 = bar0 + BAR.h;
  const plt0 = bar1 + g, plt1 = plt0 + PLT.h;
  const rng0 = plt1 + g, rng1 = rng0 + RNG.h;
  return { blk0, blk1, bar0, bar1, plt0, plt1, rng0, rng1, top: rng1 + 150 };
}

/** Where the dot sits: on the axis, inside the ring's bore (seen through it). */
export const dotAt = (s: Stack) => iso(0, 0, s.rng0 + RNG.h * 0.55);

// ------------------------------------------------------------------ geometry helpers
function circ(cx: number, cy: number, R: number, Z: number, n = 56, a0 = 0, a1 = TAU): P2[] {
  const out: P2[] = [];
  const closed = Math.abs(a1 - a0 - TAU) < 1e-6;
  const m = closed ? n : n + 1;
  for (let i = 0; i < m; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push(iso(cx + R * Math.cos(a), cy + R * Math.sin(a), Z)); }
  return out;
}
function hull(pts: P2[]): P2[] {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o: P2, a: P2, b: P2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: P2[] = [], up: P2[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]!; while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function path(c: Ctx2, pts: P2[], close = true) {
  pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
  if (close) c.closePath();
}
/** Paint "no ink" over a region (what is behind a face disappears). */
function erase(c: Ctx2, build: () => void, rule: CanvasFillRule = 'nonzero') {
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000';
  c.beginPath(); build(); c.fill(rule);
  c.globalCompositeOperation = 'lighter';
}
function line(c: Ctx2, pts: P2[], w: number, close = false) {
  c.lineWidth = w; c.beginPath(); path(c, pts, close); c.stroke();
}
/** Section hatching: 45° lines, `sp` apart, clipped to a polygon. */
function hatchPoly(c: Ctx2, poly: P2[], sp = 9) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const q of poly) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
  c.save();
  c.beginPath(); path(c, poly); c.clip();
  c.lineWidth = W3; c.beginPath();
  const h = y1 - y0;
  for (let x = x0 - h; x <= x1; x += sp) { c.moveTo(x, y1); c.lineTo(x + h, y0); }
  c.stroke();
  c.restore();
}
/** Outward normal of a CCW outline edge a→b faces the viewer (+X, +Y, +Z). */
const vis = (a: P2, b: P2) => (b.y - a.y) - (b.x - a.x) > 0;

interface Hole { x: number; y: number; r: number }
/** An extruded convex outline (XY, CCW) from z0 to z1 with through holes. */
function prism(c: Ctx2, outline: P2[], corner: boolean[] | null, z0: number, z1: number, holes: Hole[]) {
  const top = outline.map((p) => iso(p.x, p.y, z1)), bot = outline.map((p) => iso(p.x, p.y, z0));
  const hl = hull(top.concat(bot));
  const hT = holes.map((h) => circ(h.x, h.y, h.r, z1, Math.max(24, Math.round(h.r)))), hB = holes.map((h) => circ(h.x, h.y, h.r, z0, Math.max(24, Math.round(h.r))));
  // the body minus the hole openings; then each hole's inner wall (the opening minus the see-through)
  erase(c, () => { path(c, hl); for (const p of hT) path(c, p); }, 'evenodd');
  hT.forEach((p, i) => {
    c.save(); c.beginPath(); path(c, p); c.clip();
    erase(c, () => { path(c, p); path(c, hB[i]!); }, 'evenodd');
    c.restore();
  });
  c.strokeStyle = PRINT(1);
  line(c, hl, W1, true);
  c.lineWidth = W2; c.beginPath(); path(c, top);
  const n = outline.length;
  if (corner) for (let i = 0; i < n; i++) {
    if (!corner[i]) continue;
    const a = outline[(i - 1 + n) % n]!, b = outline[i]!, d = outline[(i + 1) % n]!;
    if (vis(a, b) && vis(b, d)) { c.moveTo(top[i]!.x, top[i]!.y); c.lineTo(bot[i]!.x, bot[i]!.y); }
  }
  c.stroke();
  c.beginPath(); for (const p of hT) path(c, p); c.stroke();
  hT.forEach((p, i) => { c.save(); c.beginPath(); path(c, p); c.clip(); line(c, hB[i]!, W3, true); c.restore(); });
}

// ------------------------------------------------------------------ the parts
function outlineCirc(R: number, n = 72): P2[] { return Array.from({ length: n }, (_, i) => ({ x: R * Math.cos((i / n) * TAU), y: R * Math.sin((i / n) * TAU) })); }
const RING_OUT = outlineCirc(RNG.Ro);
const PLATE_OUT: P2[] = (() => {
  const { s, ch } = PLT;
  return [{ x: -s + ch, y: -s }, { x: s - ch, y: -s }, { x: s, y: -s + ch }, { x: s, y: s - ch }, { x: s - ch, y: s }, { x: -s + ch, y: s }, { x: -s, y: s - ch }, { x: -s, y: -s + ch }];
})();
const BAR_OUT: P2[] = (() => {
  const hx = BAR.L / 2 - BAR.W / 2, r = BAR.W / 2, out: P2[] = [];
  out.push({ x: -hx, y: -r });
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 16; out.push({ x: hx + r * Math.cos(a), y: r * Math.sin(a) }); }
  for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + (Math.PI * i) / 16; out.push({ x: -hx + r * Math.cos(a), y: r * Math.sin(a) }); }
  return out;
})();

function drawRing(c: Ctx2, z0: number, z1: number) {
  prism(c, RING_OUT, null, z0, z1, [{ x: 0, y: 0, r: RNG.Ri }]);
  c.strokeStyle = PRINT(1);
  // surface shading on the turned outer face: lines close together on the shadow side
  c.lineWidth = W3; c.beginPath();
  for (let k = 1; k <= 10; k++) {
    const a = -Math.PI / 4 + (100 * Math.PI / 180) * Math.pow(k / 10, 1.9);
    const p = iso(RNG.Ro * Math.cos(a), RNG.Ro * Math.sin(a), z1), q = iso(RNG.Ro * Math.cos(a), RNG.Ro * Math.sin(a), z0);
    c.moveTo(p.x, p.y + 1.5); c.lineTo(q.x, q.y - 1);
  }
  c.stroke();
  // six blind bolt holes on the face
  c.beginPath();
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + 0.26; path(c, circ(RNG.br * Math.cos(a), RNG.br * Math.sin(a), RNG.bolt, z1, 20)); }
  c.lineWidth = W3; c.stroke();
}

function drawPlate(c: Ctx2, z0: number, z1: number) {
  const b = PLT.at;
  prism(c, PLATE_OUT, PLATE_OUT.map(() => true), z0, z1, [
    { x: 0, y: 0, r: PLT.hole }, { x: -b, y: -b, r: PLT.bolt }, { x: b, y: -b, r: PLT.bolt }, { x: b, y: b, r: PLT.bolt }, { x: -b, y: b, r: PLT.bolt },
  ]);
}

function drawBar(c: Ctx2, z0: number, z1: number) {
  const hx = BAR.L / 2 - BAR.W / 2;
  prism(c, BAR_OUT, null, z0, z1, [{ x: 0, y: 0, r: BAR.hole }, { x: -hx, y: 0, r: BAR.end }, { x: hx, y: 0, r: BAR.end }]);
}

/** The base block with its front quarter removed: the far bore wall, two hatched cut faces, two outer faces, the L-shaped top. */
function drawBlock(c: Ctx2, z0: number, z1: number) {
  const { a, r } = BLK;
  const P = iso;
  c.strokeStyle = PRINT(1);
  // 1. the bore's far wall
  const wT = circ(0, 0, r, z1, 28, (3 * Math.PI) / 4, (7 * Math.PI) / 4), wB = circ(0, 0, r, z0, 28, (3 * Math.PI) / 4, (7 * Math.PI) / 4);
  erase(c, () => path(c, wT.concat(wB.slice().reverse())));
  line(c, wB, W2);
  // 2. the cut faces, hatched
  const cutX = [P(0, r, z0), P(0, a, z0), P(0, a, z1), P(0, r, z1)];
  const cutY = [P(r, 0, z0), P(a, 0, z0), P(a, 0, z1), P(r, 0, z1)];
  for (const f of [cutX, cutY]) {
    erase(c, () => path(c, f));
    hatchPoly(c, f, 9);
    line(c, f, W2, true);
  }
  // 3. the outer faces
  const fX = [P(a, -a, z0), P(a, 0, z0), P(a, 0, z1), P(a, -a, z1)];
  const fY = [P(-a, a, z0), P(0, a, z0), P(0, a, z1), P(-a, a, z1)];
  for (const f of [fX, fY]) { erase(c, () => path(c, f)); line(c, f, W2, true); }
  // 4. the top: an L around the bore's opening
  const top = [P(-a, -a, z1), P(a, -a, z1), P(a, 0, z1), ...circ(0, 0, r, z1, 36, 0, -1.5 * Math.PI), P(0, a, z1), P(-a, a, z1)];
  erase(c, () => path(c, top));
  line(c, top, W2, true);
  // 5. silhouette
  line(c, [P(-a, a, z0), P(-a, a, z1), P(-a, -a, z1), P(a, -a, z1), P(a, -a, z0), P(a, 0, z0), P(r, 0, z0)], W1);
  line(c, [P(0, r, z0), P(0, a, z0), P(-a, a, z0)], W1);
}

/** The assembly axis: a chain line between z0 and z1 (drawn in pieces so the parts can hide it). */
function axis(c: Ctx2, z0: number, z1: number, clip?: P2[]) {
  if (z1 <= z0) return;
  const p = iso(0, 0, z0), q = iso(0, 0, z1);
  c.save();
  if (clip) { c.beginPath(); path(c, clip); c.clip(); }
  c.strokeStyle = PRINT(0.9); c.lineWidth = 1.2;
  c.setLineDash([30, 6, 5, 6]); c.lineDashOffset = q.y; // the dash pattern is anchored to the axis, not to each piece
  c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x, p.y); c.stroke();
  c.setLineDash([]);
  c.restore();
}

/** The whole exploded assembly, bottom to top (painter's order), with the axis in between. */
export function drawAssembly(c: Ctx2, s: Stack) {
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = PRINT(1);
  axis(c, -70, 0);
  drawBlock(c, s.blk0, s.blk1);
  axis(c, s.blk0, s.blk1); // in the open bore, seen through the removed quarter
  axis(c, s.blk1, s.bar0);
  drawBar(c, s.bar0, s.bar1);
  axis(c, s.bar0, s.bar1, circ(0, 0, BAR.hole, s.bar1, 24));
  axis(c, s.bar1, s.plt0);
  drawPlate(c, s.plt0, s.plt1);
  axis(c, s.plt0, s.plt1, circ(0, 0, PLT.hole, s.plt1, 24));
  axis(c, s.plt1, s.rng0);
  drawRing(c, s.rng0, s.rng1);
  axis(c, s.rng0, s.rng1, circ(0, 0, RNG.Ri, s.rng1, 40));
  axis(c, s.rng1, s.top);
  c.restore();
}

// ------------------------------------------------------------------ reference numerals
export interface Callout { n: string; st: StrokeText; target: (s: Stack) => P2; lab: (s: Stack) => P2; arrow?: boolean; t: number }

export function makeCallouts(): Omit<Callout, 't'>[] {
  const st = (n: string) => strokeText(n, 'tech', 46);
  const R = RNG.Ro;
  return [
    { n: '12', st: st('12'), target: (s) => iso(R * Math.cos(1.9), R * Math.sin(1.9), s.rng0 + RNG.h * 0.5), lab: (s) => ({ x: -600, y: iso(0, 0, s.rng0).y + 24 }) },
    { n: '20', st: st('20'), target: (s) => iso(0, 0, s.top - 30), lab: (s) => ({ x: FIG.ox + 64, y: iso(0, 0, s.top).y + 4 }) },
    { n: '14', st: st('14'), target: (s) => iso(-112, 96, s.plt1), lab: (s) => ({ x: -620, y: iso(0, 0, s.plt1).y - 10 }) },
    { n: '16', st: st('16'), target: (s) => iso(222, 14, s.bar1), lab: (s) => ({ x: 250, y: iso(0, 0, s.bar1).y + 150 }) },
    { n: '18', st: st('18'), target: () => iso(-74, BLK.a, 70), lab: () => ({ x: -600, y: 214 }) },
    { n: '22', st: st('22'), target: () => iso(96, 0, 58), lab: () => ({ x: 230, y: 290 }) },
    { n: '10', st: st('10'), target: (s) => ({ x: iso(0, 0, 0).x - RNG.Ro * 1.25 * FIG.s - 20, y: iso(0, 0, s.rng1).y - 40 }), lab: (s) => ({ x: -610, y: iso(0, 0, s.top).y + 30 }), arrow: true },
  ];
}

/** A numeral pops in at its time (scale overshoot), its leader grows to the part. */
export function drawCallout(c: Ctx2, k: Callout, s: Stack, t: number) {
  if (t < k.t) return;
  const pop = 1 - ease.outExpo(prog(t, k.t, k.t + 0.14));
  const grow = ease.outExpo(prog(t, k.t + 0.02, k.t + 0.2));
  const L = k.lab(s), T = k.target(s);
  const w = k.st.width, capH = k.st.capHeight;
  c.save();
  c.strokeStyle = PRINT(1); c.lineCap = 'round'; c.lineJoin = 'round';
  // numeral, centred on its label point
  c.save();
  c.translate(L.x, L.y); c.scale(1 + 0.35 * pop, 1 + 0.35 * pop);
  c.translate(-w / 2, capH / 2);
  c.lineWidth = 2.7;
  drawStrokeText(c, k.st, k.st.total);
  if (k.arrow) { c.beginPath(); c.moveTo(-2, 9); c.lineTo(w + 2, 9); c.stroke(); }
  c.restore();
  // leader: a gentle curve from the numeral's edge to the part
  const dx = T.x - L.x, dy = T.y - L.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const r0 = Math.max(w, capH) * 0.5 + 12;
  const a = { x: L.x + ux * r0, y: L.y + uy * r0 };
  const bend = (k.n.charCodeAt(1) % 2 ? 1 : -1) * Math.min(40, d * 0.12);
  const m = { x: (a.x + T.x) / 2 - uy * bend, y: (a.y + T.y) / 2 + ux * bend };
  const n = 24, upto = Math.max(1, Math.round(n * grow));
  const q = (u: number) => ({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * m.x + u * u * T.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * m.y + u * u * T.y });
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i <= upto; i++) { const p = q(i / n); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
  c.stroke();
  if (k.arrow && grow > 0.98) {
    const p = q(1), p0 = q(0.93), an = Math.atan2(p.y - p0.y, p.x - p0.x);
    c.fillStyle = PRINT(1);
    c.beginPath(); c.moveTo(p.x, p.y);
    c.lineTo(p.x - 20 * Math.cos(an - 0.3), p.y - 20 * Math.sin(an - 0.3));
    c.lineTo(p.x - 20 * Math.cos(an + 0.3), p.y - 20 * Math.sin(an + 0.3));
    c.closePath(); c.fill();
  }
  c.restore();
}

export const clampE = (e: number) => clamp(e);
