// world4 (culture.ts), part 2: the reveal. A textbook plate, "Animal cell, in section": bone line
// engraving on graphite (membranes, envelope with pores, rough ER with ribosomes, a Golgi stack,
// lysosomes, vesicles, centrioles, mitochondria with their cristae), with plate letters, a figure
// caption, a scale bar and a specimen label. One mitochondrion is the dot: its matrix glows blue and
// its double membrane is the dot's faint double ring. The lyric is engraved along its callout.
// Everything is precomputed in plate px (1920x1080 at zoom 1) as Path2D groups, so the camera can
// pull back from a 12x macro to the whole plate with crisp vector lines.
import { rgba } from '../engine/palette';
import { F, font, layout, type TextLayout } from '../engine/type';
import { Lyrics, type Word } from '../engine/lyrics';
import { clamp, lerp, mulberry32, smoothstep, TAU } from '../engine/util';
import { dot2D } from './_power';

type P = { x: number; y: number };
export interface PlateCam { x: number; y: number; z: number; r: number }

// ------------------------------------------------------------------ shapes
interface Blob { cx: number; cy: number; rx: number; ry: number; rot: number; h: [number, number, number][] }
const blobR = (b: Blob, th: number) => 1 + b.h.reduce((s, [a, f, p]) => s + a * Math.sin(f * th + p), 0);
function blobPt(b: Blob, th: number, k = 1): P {
  const r = blobR(b, th) * k;
  const u = b.rx * r * Math.cos(th), v = b.ry * r * Math.sin(th);
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return { x: b.cx + u * c - v * s, y: b.cy + u * s + v * c };
}
function blobPts(b: Blob, n = 220, k = 1, dr = 0): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    if (!dr) { out.push(blobPt(b, th, k)); continue; }
    // inset by dr px along the normal (approx.)
    const p = blobPt(b, th, k), q = blobPt(b, th + 1e-3, k);
    const tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1;
    out.push({ x: p.x - (ty / l) * dr, y: p.y + (tx / l) * dr });
  }
  return out;
}
/** 0 at the centre, 1 on the outline. */
function blobRho(b: Blob, p: P) {
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
  const dx = p.x - b.cx, dy = p.y - b.cy;
  const u = (dx * c - dy * s) / b.rx, v = (dx * s + dy * c) / b.ry;
  return Math.hypot(u, v) / blobR(b, Math.atan2(v, u));
}

/** A mitochondrion: a stadium of length L and half-width w, bent into a bean, rotated by a. */
export interface Mito { cx: number; cy: number; a: number; L: number; w: number; bend: number; seed: number }
const mitoXf = (m: Mito, u: number, v: number): P => {
  const vb = v + m.bend * m.w * (1 - (2 * u / m.L) ** 2);
  const c = Math.cos(m.a), s = Math.sin(m.a);
  return { x: m.cx + u * c - vb * s, y: m.cy + u * s + vb * c };
};
function mitoLocal(m: Mito, p: P) {
  const c = Math.cos(-m.a), s = Math.sin(-m.a);
  const dx = p.x - m.cx, dy = p.y - m.cy;
  const u = dx * c - dy * s, vb = dx * s + dy * c;
  const v = vb - m.bend * m.w * (1 - (2 * u / m.L) ** 2);
  return { u, v };
}
/** Signed distance to the outline (< 0 inside), in the bean's straightened frame. */
function mitoSD(m: Mito, p: P, w = m.w) {
  const { u, v } = mitoLocal(m, p);
  const qx = Math.max(Math.abs(u) - (m.L / 2 - m.w), 0);
  return Math.hypot(qx, v) - w;
}
/** Outline (inset by `ins`), clockwise from the top-left. */
function mitoOutline(m: Mito, ins = 0, n = 26): P[] {
  const w = m.w - ins, h = m.L / 2 - m.w;
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) pts.push(mitoXf(m, lerp(-h, h, i / n), -w));
  for (let i = 1; i < n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; pts.push(mitoXf(m, h + Math.cos(a) * w, Math.sin(a) * w)); }
  for (let i = 0; i <= n; i++) pts.push(mitoXf(m, lerp(h, -h, i / n), w));
  for (let i = 1; i < n; i++) { const a = Math.PI / 2 + (i / n) * Math.PI; pts.push(mitoXf(m, -h + Math.cos(a) * w, Math.sin(a) * w)); }
  return pts;
}
/**
 * The inner membrane with its cristae: the inset outline, folded inward into fingers from the two long
 * sides, alternating. Returned as a closed polyline (the matrix is inside it).
 */
function mitoInner(m: Mito, ins: number): P[] {
  const w = m.w - ins, h = m.L / 2 - m.w;
  const rnd = mulberry32(m.seed);
  const pitch = Math.max(7, m.L / 11);
  const fw = Math.max(2.2, pitch * 0.34);
  const pts: P[] = [];
  const side = (sgn: number) => {
    // sgn = -1: top side, left -> right; +1: bottom side, right -> left
    const us: number[] = [];
    for (let u = -h + pitch * (sgn < 0 ? 0.55 : 1.05); u < h - pitch * 0.3; u += pitch * (0.85 + 0.3 * rnd())) us.push(u);
    const ord = sgn < 0 ? us : us.reverse();
    let u0 = sgn < 0 ? -h : h;
    const dir = sgn < 0 ? 1 : -1;
    pts.push(mitoXf(m, u0, sgn * w));
    for (const uc of ord) {
      const depth = w * (0.45 + 1.25 * rnd()) * (1 - 0.3 * Math.abs(uc) / (h + 1e-3));
      const fwi = fw * (0.7 + 0.6 * rnd());
      const lean = (rnd() - 0.5) * pitch * 0.7;
      const a0 = uc - (dir * fwi) / 2, a1 = uc + (dir * fwi) / 2;
      pts.push(mitoXf(m, a0, sgn * w));
      const tip = sgn * w - sgn * depth;
      for (let i = 0; i <= 10; i++) {
        const k = i / 10;
        // down one wall, round the (leaning, slightly swollen) tip, up the other
        const sw = Math.sin(k * Math.PI);
        const uu = lerp(a0, a1, 0.5 - 0.5 * Math.cos(k * Math.PI)) + lean * sw ** 1.5 + dir * (k - 0.5) * fwi * 0.5 * sw ** 6;
        const vv = lerp(sgn * w, tip, sw ** 0.35);
        pts.push(mitoXf(m, uu, vv));
      }
      pts.push(mitoXf(m, a1, sgn * w));
      u0 = a1;
    }
    pts.push(mitoXf(m, sgn < 0 ? h : -h, sgn * w));
  };
  const cap = (right: boolean) => {
    for (let i = 1; i < 20; i++) {
      const a = (right ? -Math.PI / 2 : Math.PI / 2) + (i / 20) * Math.PI;
      pts.push(mitoXf(m, (right ? h : -h) + Math.cos(a) * w, Math.sin(a) * w));
    }
  };
  side(-1); cap(true); side(1); cap(false);
  return pts;
}

// ------------------------------------------------------------------ path helpers
function addPoly(p: Path2D, pts: P[], closed = true) {
  if (!pts.length) return;
  p.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]!.x, pts[i]!.y);
  if (closed) p.closePath();
}
function addDash(p: Path2D, pts: P[], on: number, off: number, phase = 0) {
  let s = -phase, pen = false;
  const per = on + off;
  for (let i = 0; i <= pts.length; i++) {
    const a = pts[i % pts.length]!, b = pts[(i + 1) % pts.length]!;
    if (i === pts.length) break;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    const m = ((s % per) + per) % per;
    const nowOn = m < on;
    if (nowOn && !pen) { p.moveTo(a.x, a.y); pen = true; }
    if (nowOn) p.lineTo(b.x, b.y);
    else pen = false;
    s += l;
  }
}
function inPoly(pts: P[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/**
 * Engraver's hatching: parallel lines at `ang`, `sp` apart, clipped to the polygon; each run goes to the
 * bucket of its darkness (thicker lines where darker). Darkness < thr[0] leaves the paper bare.
 */
function hatchPoly(poly: P[], ang: number, sp: number, dark: (x: number, y: number) => number, thr: number[], out: Path2D[], step = 1.5) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const rp = poly.map((p) => ({ s: p.x * ca + p.y * sa, t: -p.x * sa + p.y * ca }));
  let t0 = Infinity, t1 = -Infinity;
  for (const q of rp) { t0 = Math.min(t0, q.t); t1 = Math.max(t1, q.t); }
  for (let t = Math.ceil(t0 / sp) * sp; t <= t1; t += sp) {
    const xs: number[] = [];
    for (let i = 0, j = rp.length - 1; i < rp.length; j = i++) {
      const a = rp[i]!, b = rp[j]!;
      if ((a.t > t) !== (b.t > t)) xs.push(a.s + ((t - a.t) / (b.t - a.t)) * (b.s - a.s));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let runB = -1, runS = 0;
      const flush = (s: number) => {
        if (runB >= 0 && s - runS > 0.8) {
          const pa = { x: runS * ca - t * sa, y: runS * sa + t * ca }, pb = { x: s * ca - t * sa, y: s * sa + t * ca };
          out[runB]!.moveTo(pa.x, pa.y); out[runB]!.lineTo(pb.x, pb.y);
        }
      };
      for (let s = xs[k]!; ; s = Math.min(s + step, xs[k + 1]!)) {
        const x = s * ca - t * sa, y = s * sa + t * ca;
        const d = dark(x, y);
        let b = -1;
        for (let i = 0; i < thr.length; i++) if (d > thr[i]!) b = i;
        if (b !== runB) { flush(s); runB = b; runS = s; }
        if (s >= xs[k + 1]!) { flush(s); break; }
      }
    }
  }
}
const light = { x: -0.55, y: -0.83 }; // light from the upper left (plate px, y down)

// ------------------------------------------------------------------ the plate
export const HERO: Mito = { cx: 1088, cy: 352, a: 0.5, L: 128, w: 25, bend: 0.16, seed: 71 };

export class CellPlate {
  heavy = new Path2D();
  line = new Path2D();
  hair = new Path2D();
  faint = new Path2D();
  hatch = [new Path2D(), new Path2D(), new Path2D()];
  dots = new Path2D();
  dotsFaint = new Path2D();
  heroOuter = new Path2D();
  heroInner = new Path2D();
  heroInnerPts: P[] = [];
  heroOuterPts: P[] = [];
  heroDots = new Path2D();
  heroHatch = [new Path2D(), new Path2D(), new Path2D()];
  heroStip = new Path2D();
  heroDNA = new Path2D();
  letters: { t: string; x: number; y: number }[] = [];
  lead = { a: { x: 0, y: 0 }, b: { x: 1398, y: 236 }, c: { x: 1842, y: 236 } };
  lyricLay: TextLayout | null = null;
  lyricText = '';
  lyricX0 = 1412;
  lyricY = 222;
  lyricFam = F.serif(600, true);
  lyricSize = 58;

  constructor(lyric: Word[]) {
    this.build();
    this.lyricText = lyric.map((w) => w.w.replace(/[,.]$/, '')).join(' ');
    this.lyricLay = layout(this.lyricText, this.lyricFam, this.lyricSize, 0.5);
    // the lyric must fit between the elbow and the right margin
    const room = this.lead.c.x - this.lyricX0 - 6;
    if (this.lyricLay.width > room) {
      this.lyricSize *= room / this.lyricLay.width;
      this.lyricLay = layout(this.lyricText, this.lyricFam, this.lyricSize, 0.5);
    }
  }

  private build() {
    const rnd = mulberry32(1313);
    // the cell and its membrane (a bilayer: two lines)
    const cell: Blob = { cx: 860, cy: 530, rx: 478, ry: 392, rot: -0.04, h: [[0.035, 2, 0.7], [0.03, 3, 2.1], [0.018, 5, 0.3], [0.01, 7, 1.9]] };
    const cellPts = blobPts(cell, 360);
    addPoly(this.heavy, cellPts);
    addPoly(this.line, blobPts(cell, 360, 1, 5.5));
    hatchPoly(blobPts(cell, 200, 1, 6), 0.78, 4.2, (x, y) => {
      const r = blobRho(cell, { x, y });
      const dx = x - cell.cx, dy = y - cell.cy, l = Math.hypot(dx, dy) || 1;
      const sh = (dx / l) * -light.x + (dy / l) * -light.y;
      return smoothstep(0.9, 0.985, r) * smoothstep(-0.3, 0.7, sh);
    }, [0.12, 0.45, 0.8], this.hatch);

    // the nucleus: a double envelope with pores, chromatin, a nucleolus
    const nuc: Blob = { cx: 752, cy: 572, rx: 186, ry: 160, rot: -0.22, h: [[0.03, 2, 1.2], [0.025, 3, 0.4], [0.012, 5, 2.2]] };
    const nOut = blobPts(nuc, 300), nIn = blobPts(nuc, 300, 1, 6);
    addDash(this.line, nOut, 38, 7, 0);
    addDash(this.line, nIn, 38, 7, 0);
    // pores: little bridges across the gaps
    for (let i = 0; i < 300; i += 1) {
      const s = i / 300;
      if (Math.abs(((s * 1100) % 45) - 41.5) > 0.6) continue;
      const a = nOut[i]!, b = nIn[i]!;
      this.hair.moveTo(a.x, a.y); this.hair.lineTo(b.x, b.y);
    }
    const nucl: Blob = { cx: 800, cy: 540, rx: 52, ry: 46, rot: 0.3, h: [[0.06, 3, 0.2], [0.04, 5, 1.1]] };
    addPoly(this.line, blobPts(nucl, 120));
    hatchPoly(blobPts(nuc, 200, 1, 9), 0.52, 5, (x, y) => {
      const r = blobRho(nuc, { x, y });
      const n = 0.5 + 0.5 * Math.sin(x * 0.045 + Math.sin(y * 0.05) * 2) * Math.sin(y * 0.038 + Math.cos(x * 0.03) * 2);
      const dx = x - nuc.cx, dy = y - nuc.cy, l = Math.hypot(dx, dy) || 1;
      const sh = (dx / l) * -light.x + (dy / l) * -light.y;
      if (blobRho(nucl, { x, y }) < 1.05) return 0;
      return 0.18 + 0.35 * n + 0.35 * smoothstep(0.55, 1, r) * smoothstep(-0.2, 0.8, sh);
    }, [0.3, 0.55, 0.8], this.hatch, 1.5);
    const nuclPts = blobPts(nucl, 100, 0.97);
    hatchPoly(nuclPts, 0.52, 3.2, (x, y) => 0.6 + 0.3 * smoothstep(0.2, 1, blobRho(nucl, { x, y })), [0.3, 0.55, 0.8], this.hatch);
    hatchPoly(nuclPts, -0.6, 3.6, (x, y) => (blobRho(nucl, { x, y }) > 0.55 ? 0.5 : 0), [0.3], this.hatch);

    // rough ER: flattened sacs wrapped round the nucleus on the left, studded with ribosomes
    for (let k = 0; k < 4; k++) {
      const off = 34 + k * 24;
      const a0 = 1.95 + k * 0.08 + rnd() * 0.1, a1 = 4.25 - k * 0.1 - rnd() * 0.1;
      const mid: P[] = [];
      for (let i = 0; i <= 90; i++) {
        const th = lerp(a0, a1, i / 90);
        const p = blobPt(nuc, th), q = blobPt(nuc, th + 1e-3);
        const tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1;
        const wob = 5 * Math.sin(th * 7 + k * 1.7) + 3 * Math.sin(th * 13 + k);
        mid.push({ x: p.x + (ty / l) * (off + wob), y: p.y - (tx / l) * (off + wob) });
      }
      const nrm = (i: number) => { const a = mid[Math.max(0, i - 1)]!, b = mid[Math.min(mid.length - 1, i + 1)]!; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }; };
      const hw = 3.6;
      const A = mid.map((p, i) => { const n = nrm(i); return { x: p.x + n.x * hw, y: p.y + n.y * hw }; });
      const B = mid.map((p, i) => { const n = nrm(i); return { x: p.x - n.x * hw, y: p.y - n.y * hw }; });
      addPoly(this.line, [...A, ...B.reverse()]);
      for (let i = 2; i < mid.length - 2; i++) {
        if (i % 2) continue;
        for (const [S, sg] of [[A, 1], [B.slice().reverse(), -1]] as const) {
          const n = nrm(i), p = S[i]!;
          const rr = 1.5;
          const x = p.x + n.x * 3.2 * sg, y = p.y + n.y * 3.2 * sg;
          this.dots.moveTo(x + rr, y); this.dots.arc(x, y, rr, 0, TAU);
        }
      }
    }

    // the Golgi body: a stack of curved cisternae, concave toward the nucleus, with vesicles
    {
      const gc = { x: 1236, y: 770 };
      const dir = Math.atan2(nuc.cy - gc.y, nuc.cx - gc.x);
      for (let k = 0; k < 5; k++) {
        const R = 112 + k * 13, span = 0.34 - k * 0.03;
        const mid: P[] = [];
        for (let i = 0; i <= 40; i++) { const a = dir + lerp(-span, span, i / 40); mid.push({ x: gc.x + Math.cos(a) * R, y: gc.y + Math.sin(a) * R }); }
        const hw = 4.6 + (k === 2 ? 0.8 : 0);
        const A: P[] = [], B: P[] = [];
        mid.forEach((p, i) => {
          const a = dir + lerp(-span, span, i / 40);
          const sw = 1 + 0.9 * Math.pow(Math.abs(i / 40 - 0.5) * 2, 6);
          A.push({ x: p.x + Math.cos(a) * hw * sw, y: p.y + Math.sin(a) * hw * sw });
          B.push({ x: p.x - Math.cos(a) * hw * sw, y: p.y - Math.sin(a) * hw * sw });
        });
        addPoly(this.line, [...A, ...B.reverse()]);
        hatchPoly([...A, ...B], dir + 1.3, 3.2, () => 0.35, [0.3], this.hatch);
        for (const e of [-1, 1]) {
          if (rnd() < 0.35) continue;
          const a = dir + e * (span + 0.1 + 0.05 * rnd());
          const r = 4 + rnd() * 2.5;
          const x = gc.x + Math.cos(a) * (R + (rnd() - 0.5) * 14), y = gc.y + Math.sin(a) * (R + (rnd() - 0.5) * 14);
          this.line.moveTo(x + r, y); this.line.arc(x, y, r, 0, TAU);
        }
      }
    }

    // mitochondria (bone): the same organelle as the hero, several of them
    const mitos: Mito[] = [
      { cx: 566, cy: 318, a: -0.55, L: 112, w: 21, bend: -0.12, seed: 3 },
      { cx: 700, cy: 842, a: 0.12, L: 116, w: 22, bend: -0.1, seed: 7 },
      { cx: 968, cy: 832, a: -0.3, L: 96, w: 19, bend: 0.12, seed: 9 },
      { cx: 1262, cy: 520, a: 1.42, L: 104, w: 20, bend: -0.15, seed: 11 },
      { cx: 868, cy: 292, a: 0.08, L: 92, w: 19, bend: 0.1, seed: 13 },
    ];
    for (const m of mitos) {
      const out = mitoOutline(m);
      addPoly(this.line, out);
      addPoly(this.hair, mitoInner(m, 3.4));
      hatchPoly(out, 0.8, 3.4, (x, y) => {
        const { u, v } = mitoLocal(m, { x, y });
        const sd = mitoSD(m, { x, y });
        const ca = Math.cos(m.a), sa = Math.sin(m.a);
        const nx = -sa * Math.sign(v), ny = ca * Math.sign(v);
        const sh = nx * -light.x + ny * -light.y + (Math.abs(u) > m.L / 2 - m.w ? 0.2 : 0);
        return smoothstep(-m.w * 0.55, -1, sd) * smoothstep(-0.1, 0.8, sh);
      }, [0.2, 0.55], this.hatch);
    }
    this.letters.push({ t: 'm', x: 520, y: 262 }, { t: 'm', x: 1310, y: 592 }, { t: 'n', x: 690, y: 480 }, { t: 'nu', x: 846, y: 520 }, { t: 'er', x: 470, y: 520 }, { t: 'g', x: 1090, y: 690 });

    // lysosomes, vesicles, centrioles
    for (const [x, y, r] of [[1012, 628, 15], [640, 402, 12], [1148, 470, 11]] as [number, number, number][]) {
      this.line.moveTo(x + r, y); this.line.arc(x, y, r, 0, TAU);
      const circ: P[] = []; for (let i = 0; i < 40; i++) circ.push({ x: x + Math.cos((i / 40) * TAU) * (r - 1.5), y: y + Math.sin((i / 40) * TAU) * (r - 1.5) });
      hatchPoly(circ, 0.9, 2.2, () => 0.6, [0.3, 0.55], this.hatch);
    }
    this.letters.push({ t: 'ly', x: 1034, y: 604 });
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, rr = lerp(0.35, 0.9, Math.sqrt(rnd()));
      const x = cell.cx + Math.cos(a) * cell.rx * rr, y = cell.cy + Math.sin(a) * cell.ry * rr;
      if (blobRho(nuc, { x, y }) < 1.5 || Math.hypot(x - HERO.cx, y - HERO.cy) < 90 || mitos.some((m) => mitoSD(m, { x, y }) < 14)) continue;
      const r = 4 + rnd() * 4;
      this.line.moveTo(x + r, y); this.line.arc(x, y, r, 0, TAU);
    }
    {
      const cx = 986, cy = 488;
      for (const [a, ox] of [[0.3, 0], [0.3 + Math.PI / 2, 16]] as [number, number][]) {
        const c = Math.cos(a), s = Math.sin(a);
        const X = (u: number, v: number) => ({ x: cx + ox + u * c - v * s, y: cy + u * s + v * c });
        addPoly(this.line, [X(-12, -6), X(12, -6), X(12, 6), X(-12, 6)]);
        for (let i = 0; i < 5; i++) { const v = -4 + i * 2; const a0 = X(-10, v), a1 = X(10, v); this.hair.moveTo(a0.x, a0.y); this.hair.lineTo(a1.x, a1.y); }
      }
      this.letters.push({ t: 'c', x: 1016, y: 470 });
    }

    // free ribosomes and a faint cytoskeleton
    for (let i = 0; i < 900; i++) {
      const x = lerp(cell.cx - cell.rx, cell.cx + cell.rx, rnd()), y = lerp(cell.cy - cell.ry, cell.cy + cell.ry, rnd());
      if (blobRho(cell, { x, y }) > 0.95 || blobRho(nuc, { x, y }) < 1.12) continue;
      if (mitoSD(HERO, { x, y }) < 8 || mitos.some((m) => mitoSD(m, { x, y }) < 5)) continue;
      const r = 0.9 + rnd() * 0.7;
      const P2 = rnd() < 0.7 ? this.dotsFaint : this.dots;
      P2.moveTo(x + r, y); P2.arc(x, y, r, 0, TAU);
    }
    for (let i = 0; i < 9; i++) {
      let x = lerp(cell.cx - cell.rx * 0.8, cell.cx + cell.rx * 0.8, rnd()), y = lerp(cell.cy - cell.ry * 0.8, cell.cy + cell.ry * 0.8, rnd());
      let a = rnd() * TAU;
      const pts: P[] = [];
      for (let j = 0; j < 40; j++) {
        if (blobRho(cell, { x, y }) > 0.96 || blobRho(nuc, { x, y }) < 1.03) break;
        pts.push({ x, y });
        a += (rnd() - 0.5) * 0.35; x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      }
      if (pts.length > 4) addPoly(this.faint, pts, false);
    }

    // the hero: the dot's organelle
    this.heroOuterPts = mitoOutline(HERO, 0, 40);
    addPoly(this.heroOuter, this.heroOuterPts);
    this.heroInnerPts = mitoInner(HERO, 3.6);
    addPoly(this.heroInner, this.heroInnerPts);
    const hr = mulberry32(77);
    for (let i = 0; i < 70; i++) {
      const u = lerp(-HERO.L / 2, HERO.L / 2, hr()), v = lerp(-HERO.w, HERO.w, hr());
      const p = mitoXf(HERO, u, v);
      if (mitoSD(HERO, p) > -5 || !inPoly(this.heroInnerPts, p.x, p.y)) continue;
      const r = i < 8 ? 1.15 : 0.6;
      this.heroDots.moveTo(p.x + r, p.y); this.heroDots.arc(p.x, p.y, r, 0, TAU);
    }
    // engraved light in the matrix: lines along the organelle, denser toward its rim
    hatchPoly(this.heroInnerPts, HERO.a + 0.08, 1.7, (x, y) => {
      const sd = mitoSD(HERO, { x, y }, HERO.w - 3.6);
      const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(y * 0.17) * 2.1);
      return smoothstep(-HERO.w * 0.9, -1, sd) * 0.8 + 0.25 * n;
    }, [0.3, 0.55, 0.8], this.heroHatch, 0.8);
    // the intermembrane space and the cristae's lumen: a fine stipple
    for (let i = 0; i < 520; i++) {
      const u = lerp(-HERO.L / 2, HERO.L / 2, hr()), v = lerp(-HERO.w, HERO.w, hr());
      const p = mitoXf(HERO, u, v);
      if (mitoSD(HERO, p) > -0.6 || inPoly(this.heroInnerPts, p.x, p.y)) continue;
      const r = 0.28 + 0.2 * hr();
      this.heroStip.moveTo(p.x + r, p.y); this.heroStip.arc(p.x, p.y, r, 0, TAU);
    }
    // its own genome, a little ring (as a bacterium's)
    {
      const p = mitoXf(HERO, -20, 3);
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * TAU;
        const r = 5.2 + 0.9 * Math.sin(a * 5);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.8;
        if (i === 0) this.heroDNA.moveTo(x, y); else this.heroDNA.lineTo(x, y);
      }
    }
    // the callout starts on the hero's upper edge
    this.lead.a = mitoXf(HERO, HERO.L * 0.28, -HERO.w - 1);
  }

  /** Plate px -> screen px under the camera. */
  static toScreen(cam: PlateCam, x: number, y: number) {
    const c = Math.cos(-cam.r), s = Math.sin(-cam.r);
    const dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z;
    return { x: 960 + dx * c - dy * s, y: 540 + dx * s + dy * c };
  }

  /**
   * Draw the plate. `a` = overall alpha; `hero` = the hero's outline; `glow` = its matrix light;
   * `lead` = how far the callout's leader is drawn (0..1, the elbow at 0.25); `label` / `spec` =
   * the organelle's name and the specimen label (0..1); `words` = the lyric on the leader.
   */
  draw(c: CanvasRenderingContext2D, t: number, cam: PlateCam, o: { a: number; hero: number; glow: number; lead: number; label: number; spec: number; words: Word[]; dot: number; dotScale: number; ring?: number }) {
    const z = cam.z;
    const k = Math.pow(z, -0.42); // line widths: thicker in the macro, but not proportionally
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(960, 540); c.rotate(-cam.r); c.scale(z, z); c.translate(-cam.x, -cam.y);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const A = o.a;
    if (A > 0.002) {
      c.strokeStyle = rgba('bone', 0.07 * A); c.lineWidth = 0.9 * k; c.stroke(this.faint);
      c.fillStyle = rgba('bone', 0.28 * A); c.fill(this.dotsFaint);
      c.fillStyle = rgba('bone', 0.55 * A); c.fill(this.dots);
      const hw = [0.55, 0.85, 1.2];
      this.hatch.forEach((h, i) => { c.strokeStyle = rgba('bone', (0.3 + 0.12 * i) * A); c.lineWidth = hw[i]! * k; c.stroke(h); });
      c.strokeStyle = rgba('bone', 0.5 * A); c.lineWidth = 0.75 * k; c.stroke(this.hair);
      c.strokeStyle = rgba('bone', 0.78 * A); c.lineWidth = 1.2 * k; c.stroke(this.line);
      c.strokeStyle = rgba('bone', 0.9 * A); c.lineWidth = 2.0 * k; c.stroke(this.heavy);
      this.drawFurniture(c, A, k, t);
    }
    // the hero: the matrix glows (the dot's light), bone membranes, cristae
    if (o.glow > 0.002 || o.hero > 0.002) {
      c.save();
      c.clip(this.heroInner);
      const cx = HERO.cx, cy = HERO.cy;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, HERO.L * 0.6);
      g.addColorStop(0, `rgba(190,205,255,${0.95 * o.glow})`);
      g.addColorStop(0.25, rgba('signal', 0.95 * o.glow));
      g.addColorStop(0.75, rgba('signal', 0.7 * o.glow));
      g.addColorStop(1, rgba('blood', 0.8 * o.glow));
      c.fillStyle = g;
      c.fillRect(cx - HERO.L, cy - HERO.L, HERO.L * 2, HERO.L * 2);
      const hw = [0.35, 0.55, 0.8];
      this.heroHatch.forEach((h, i) => { c.strokeStyle = rgba('blood', (0.35 + 0.15 * i) * o.glow); c.lineWidth = hw[i]! * k; c.stroke(h); });
      c.fillStyle = rgba('ember', 0.8 * o.hero);
      c.fill(this.heroDots);
      c.strokeStyle = rgba('ember', 0.85 * o.hero); c.lineWidth = 0.9 * k; c.stroke(this.heroDNA);
      c.restore();
      c.fillStyle = rgba('ember', 0.35 * o.hero); c.fill(this.heroStip);
      // each membrane a bilayer: a bone line cased with a dark core
      for (const [path, w] of [[this.heroOuter, 2.3], [this.heroInner, 1.7]] as [Path2D, number][]) {
        c.strokeStyle = rgba('bone', 0.95 * o.hero); c.lineWidth = w * k; c.stroke(path);
        if (z > 2.2) { c.strokeStyle = rgba('blood', 0.9 * o.hero * smoothstep(2.2, 4, z)); c.lineWidth = w * k * 0.38; c.stroke(path); }
      }
    }
    c.restore();
    // the dot itself, at the organelle's heart (screen space)
    if (o.dot > 0.002) {
      const s = CellPlate.toScreen(cam, HERO.cx, HERO.cy);
      dot2D(c, s.x, s.y, t, o.dotScale, o.dot, o.ring ?? 0);
    }
    // the callout (plate space again), drawn over the dot's halo
    if (A > 0.002 && o.lead > 0) {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(960, 540); c.rotate(-cam.r); c.scale(z, z); c.translate(-cam.x, -cam.y);
      this.drawCallout(c, t, A, k, o);
      c.restore();
    }
  }

  private drawFurniture(c: CanvasRenderingContext2D, A: number, k: number, t: number) {
    c.fillStyle = rgba('bone', 0.62 * A);
    c.font = font(F.serif(400, true), 25);
    c.textAlign = 'center';
    for (const l of this.letters) c.fillText(l.t, l.x, l.y);
    c.textAlign = 'left';
    // plate furniture: a ruled border, the plate number, the caption, a scale bar
    c.strokeStyle = rgba('bone', 0.22 * A); c.lineWidth = 1 * k;
    c.strokeRect(42, 40, 1836, 1000);
    c.strokeStyle = rgba('bone', 0.12 * A);
    c.strokeRect(48, 46, 1824, 988);
    c.fillStyle = rgba('bone', 0.7 * A);
    c.font = font(F.serif(600), 26);
    c.letterSpacing = '4px';
    c.fillText('PL. XIII', 84, 96);
    c.font = font(F.serif(400), 17);
    c.fillStyle = rgba('bone', 0.45 * A);
    c.fillText('THE CELL, IN SECTION', 84, 124);
    c.letterSpacing = '0px';
    c.font = font(F.serif(400, true), 21);
    c.fillStyle = rgba('bone', 0.55 * A);
    c.fillText('Fig. 13. — Animal cell, in section. n, nucleus; nu, nucleolus; er, endoplasmic reticulum; g, Golgi body; c, centrioles; ly, lysosome; m, mitochondria,', 84, 992);
    c.fillText('the cell’s power plants. Formerly a free-living bacterium: engulfed c. 2 × 10⁹ years ago, not digested; stayed. Own genome: kept.', 84, 1018);
    // scale bar: 5 µm
    const x0 = 84, y0 = 944, len = 118;
    c.strokeStyle = rgba('bone', 0.6 * A); c.lineWidth = 1.4 * k;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + len, y0); c.moveTo(x0, y0 - 6); c.lineTo(x0, y0 + 6); c.moveTo(x0 + len, y0 - 6); c.lineTo(x0 + len, y0 + 6); c.stroke();
    c.font = font(F.serif(400, true), 20);
    c.fillText('5 µm', x0 + len + 12, y0 + 6);
  }

  private drawCallout(c: CanvasRenderingContext2D, t: number, A: number, k: number, o: { lead: number; label: number; spec: number; words: Word[] }) {
    const { a, b, c: e } = this.lead;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = e.x - b.x;
    // the leader: to the elbow in the first quarter, then along the lyric
    const k1 = clamp(o.lead / 0.25), k2 = clamp((o.lead - 0.25) / 0.75);
    c.strokeStyle = rgba('bone', 0.85 * A); c.lineWidth = 1.2 * k;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(lerp(a.x, b.x, k1), lerp(a.y, b.y, k1));
    if (k2 > 0) c.lineTo(b.x + l2 * k2, b.y);
    c.stroke();
    // a dot where the leader touches the organelle
    c.fillStyle = rgba('bone', 0.9 * A);
    c.beginPath(); c.arc(a.x, a.y, 2.4, 0, TAU); c.fill();
    // the lyric, engraved along the leader as it is sung
    const lay = this.lyricLay!;
    c.font = font(this.lyricFam, this.lyricSize);
    c.textBaseline = 'alphabetic';
    let gi = 0;
    let penX = this.lyricX0 - 4;
    for (const w of o.words) {
      const txt = w.w.replace(/[,.]$/, '');
      const start = this.lyricText.indexOf(txt, gi);
      const p = Lyrics.wordProgress(w, t);
      const n = Array.from(txt).length;
      for (let i = 0; i < n; i++) {
        const g = lay.glyphs[start + i];
        if (!g) continue;
        const kk = clamp(p * n - i);
        const x = this.lyricX0 + g.x;
        if (kk <= 0) { c.fillStyle = rgba('bone', 0.1 * A); }
        else if (p < 1) { c.fillStyle = rgba('signal', A); penX = Math.max(penX, x + g.w * kk); }
        else { c.fillStyle = rgba('bone', 0.92 * A); penX = Math.max(penX, x + g.w); }
        c.fillText(g.ch, x, this.lyricY);
      }
      gi = start + txt.length;
    }
    // the pen: a blue point riding the leader under the word being engraved
    const pen = o.lead < 0.25 ? { x: lerp(a.x, b.x, k1), y: lerp(a.y, b.y, k1) } : { x: Math.min(e.x, Math.max(b.x + l2 * k2, penX)), y: b.y };
    if (o.lead < 0.999 || o.words.some((w) => t >= w.start && t < w.end)) {
      c.fillStyle = rgba('ember', 0.95 * A);
      c.beginPath(); c.arc(pen.x, pen.y, 2.6, 0, TAU); c.fill();
      c.fillStyle = rgba('signal', 0.35 * A);
      c.beginPath(); c.arc(pen.x, pen.y, 7, 0, TAU); c.fill();
    }
    // the name, under the leader; then the specimen label with the value
    if (o.label > 0) {
      const la = A * smoothstep(0, 1, o.label);
      c.fillStyle = rgba('bone', 0.9 * la);
      c.font = font(F.serif(600), 27);
      c.letterSpacing = '5px';
      c.fillText('m.  MITOCHONDRION', this.lyricX0, b.y + 40);
      c.letterSpacing = '0px';
      c.font = font(F.serif(400, true), 23);
      c.fillStyle = rgba('bone', 0.6 * la);
      c.fillText('(formerly: a bacterium)', this.lyricX0 + 44, b.y + 70);
    }
    if (o.spec > 0) {
      const sa = A * clamp(o.spec * 3);
      const pop = 1 + 0.18 * (1 - smoothstep(0, 1, o.spec)) * (1 - smoothstep(0, 0.3, o.spec) * 0);
      const bx = 1592, by = 858, bw = 250, bh = 112;
      c.save();
      c.translate(bx + bw / 2, by + bh / 2); c.scale(pop, pop); c.translate(-bx - bw / 2, -by - bh / 2);
      c.strokeStyle = rgba('bone', 0.7 * sa); c.lineWidth = 1.2 * k;
      c.strokeRect(bx, by, bw, bh);
      c.strokeRect(bx + 5, by + 5, bw - 10, bh - 10);
      c.fillStyle = rgba('bone', 0.55 * sa);
      c.font = font(F.mono(500), 13);
      c.letterSpacing = '3px';
      c.fillText('SPECIMEN 13·b', bx + 20, by + 32);
      c.letterSpacing = '0px';
      c.font = font(F.mono(400), 13);
      c.fillText('1 cell · in section', bx + 20, by + 52);
      c.font = font(F.archivo(87.5, 700), 38);
      c.fillStyle = rgba('bone', 0.95 * sa);
      c.fillText('≈ 1 pW', bx + 20, by + 94);
      c.font = font(F.mono(500), 20); c.fillStyle = rgba('bone', 0.7 * sa); c.fillText('Kardashev −1.80', bx + 150, by + 92);
      c.restore();
    }
  }
}
