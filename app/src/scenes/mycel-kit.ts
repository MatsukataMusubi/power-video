// world5 (mycel.ts): shared drawing kit for the botanical engraving. Paths are built once in plate/world
// px (Path2D groups, like culture-cell.ts), then stroked every frame under a camera transform, so the
// line work stays crisp from the close ride to the whole plate and through the Droste levels.
import { rgba } from '../engine/palette';
import { F, font, layout, type TextLayout } from '../engine/type';
import { Lyrics, type Word } from '../engine/lyrics';
import { clamp, lerp, mulberry32, TAU } from '../engine/util';

export type P = { x: number; y: number };

// ------------------------------------------------------------------ camera
/** A 2D camera: world point (x, y) at the frame centre, zoom z, roll r (rad, canvas sense). */
export interface Cam { x: number; y: number; z: number; r: number }
export function camApply(c: CanvasRenderingContext2D, cam: Cam) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.translate(960, 540); c.rotate(cam.r); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
}
export function toScreen(cam: Cam, x: number, y: number): P {
  const cs = Math.cos(cam.r), sn = Math.sin(cam.r);
  const dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z;
  return { x: 960 + dx * cs - dy * sn, y: 540 + dx * sn + dy * cs };
}

// ------------------------------------------------------------------ polylines
export function addPoly(p: Path2D, pts: P[], closed = true) {
  if (pts.length < 2) return;
  p.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i]!.x, pts[i]!.y);
  if (closed) p.closePath();
}
export function addCircle(p: Path2D, x: number, y: number, r: number) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); }
export function lengths(pts: P[]) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return L;
}
/** Point and tangent angle at arc length s along a polyline (lengths from `lengths`). */
export function at(pts: P[], L: number[], s: number): { x: number; y: number; a: number } {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0, a: 0 };
  s = clamp(s, 0, L[n - 1]!);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m]! < s) lo = m; else hi = m; }
  const a = pts[lo]!, b = pts[hi]!, seg = L[hi]! - L[lo]!;
  const u = seg > 0 ? (s - L[lo]!) / seg : 0;
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), a: Math.atan2(b.y - a.y, b.x - a.x) };
}
/** Catmull-Rom through control points, `per` samples per span. */
export function spline(cp: P[], per = 16): P[] {
  const out: P[] = [];
  for (let i = 0; i < cp.length - 1; i++) {
    const p0 = cp[Math.max(0, i - 1)]!, p1 = cp[i]!, p2 = cp[i + 1]!, p3 = cp[Math.min(cp.length - 1, i + 2)]!;
    for (let k = 0; k < per; k++) {
      const u = k / per, u2 = u * u, u3 = u2 * u;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
      });
    }
  }
  out.push(cp[cp.length - 1]!);
  return out;
}
/** Unit normals (left of the direction of travel, y down) at each point. */
export function normals(pts: P[]): P[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.y - a.y) / l, y: -(b.x - a.x) / l };
  });
}
export function offset(pts: P[], d: number | ((i: number) => number)): P[] {
  const N = normals(pts);
  return pts.map((p, i) => { const k = typeof d === 'number' ? d : d(i); return { x: p.x + N[i]!.x * k, y: p.y + N[i]!.y * k }; });
}
/** Resample a polyline to points `step` apart. */
export function resample(pts: P[], step: number): P[] {
  const L = lengths(pts), tot = L[L.length - 1]!;
  const n = Math.max(1, Math.round(tot / step));
  const out: P[] = [];
  for (let i = 0; i <= n; i++) { const q = at(pts, L, (tot * i) / n); out.push({ x: q.x, y: q.y }); }
  return out;
}
/** Sideways wobble along a polyline (organic line work). */
export function wobble(pts: P[], amp: number, wl: number, seed: number): P[] {
  const L = lengths(pts), N = normals(pts), r = mulberry32(seed);
  const ph1 = r() * TAU, ph2 = r() * TAU;
  return pts.map((p, i) => {
    const s = L[i]!;
    const k = amp * (0.65 * Math.sin((s / wl) * TAU + ph1) + 0.35 * Math.sin((s / (wl * 0.43)) * TAU + ph2));
    const e = Math.min(1, i / 3, (pts.length - 1 - i) / 3); // pinned ends
    return { x: p.x + N[i]!.x * k * e, y: p.y + N[i]!.y * k * e };
  });
}

/**
 * A tapered tube (root, hypha, crista) around a centreline: widths w(u) with u = 0..1 along it, and a
 * rounded cap at the end. Returns the closed outline and the two edges.
 */
export function tube(center: P[], w: (u: number) => number, cap = true) {
  const L = lengths(center), tot = L[L.length - 1] || 1, N = normals(center);
  const A: P[] = [], B: P[] = [];
  center.forEach((p, i) => {
    const hw = w(L[i]! / tot) / 2;
    A.push({ x: p.x + N[i]!.x * hw, y: p.y + N[i]!.y * hw });
    B.push({ x: p.x - N[i]!.x * hw, y: p.y - N[i]!.y * hw });
  });
  const outline = [...A];
  if (cap) {
    const e = center[center.length - 1]!, hw = w(1) / 2;
    const n = N[N.length - 1]!, a0 = Math.atan2(n.y, n.x);
    for (let k = 1; k < 16; k++) { const a = a0 + (k / 16) * Math.PI; outline.push({ x: e.x + Math.cos(a) * hw, y: e.y + Math.sin(a) * hw }); }
  }
  outline.push(...B.slice().reverse());
  return { outline, A, B };
}

export function inPoly(pts: P[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!;
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/**
 * Engraver's hatching: parallel lines at `ang`, `sp` apart, clipped to the polygon; each run goes to the
 * bucket of its darkness (thicker/brighter strokes where darker). Darkness below thr[0] leaves it bare.
 */
export function hatchPoly(poly: P[], ang: number, sp: number, dark: (x: number, y: number) => number, thr: number[], out: Path2D[], step = 1.5) {
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
          out[runB]!.moveTo(runS * ca - t * sa, runS * sa + t * ca);
          out[runB]!.lineTo(s * ca - t * sa, s * sa + t * ca);
        }
      };
      for (let s = xs[k]!; ; s = Math.min(s + step, xs[k + 1]!)) {
        const d = dark(s * ca - t * sa, s * sa + t * ca);
        let b = -1;
        for (let i = 0; i < thr.length; i++) if (d > thr[i]!) b = i;
        if (b !== runB) { flush(s); runB = b; runS = s; }
        if (s >= xs[k + 1]!) { flush(s); break; }
      }
    }
  }
}

/** A sand grain / soil crumb: an irregular closed polygon. */
export function grain(x: number, y: number, r: number, seed: number, n = 9): P[] {
  const rnd = mulberry32(seed);
  const rot = rnd() * TAU, ecc = 0.65 + 0.35 * rnd();
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (rnd() - 0.5) * 0.5;
    const rr = r * (0.78 + 0.34 * rnd());
    const u = Math.cos(a) * rr, v = Math.sin(a) * rr * ecc;
    pts.push({ x: x + u * Math.cos(rot) - v * Math.sin(rot), y: y + u * Math.sin(rot) + v * Math.cos(rot) });
  }
  return pts;
}

// ------------------------------------------------------------------ lettering along a path
export interface PathGlyph { ch: string; x: number; y: number; a: number; s: number; w: number }
/**
 * Text set along a polyline (a root, a membrane): each glyph sits on the path at its kerned advance,
 * turned to the tangent. `s0` = where the text starts along the path. The words map onto the glyphs so
 * the lyric can be written as sung.
 */
export class PathText {
  lay: TextLayout;
  glyphs: PathGlyph[] = [];
  ranges: [number, number][] = [];
  text: string;
  constructor(public words: Word[], public fam: string, public size: number, pts: P[], s0 = 0, tracking = 0, public upper = true) {
    const toks = words.map((w) => (upper ? w.w.toUpperCase() : w.w));
    this.text = toks.join(' ');
    this.lay = layout(this.text, fam, size, tracking);
    const L = lengths(pts);
    for (const g of this.lay.glyphs) {
      const s = s0 + g.x + g.w / 2;
      const q = at(pts, L, s);
      // glyph origin = its centre on the path, pulled back half an advance along the tangent
      this.glyphs.push({ ch: g.ch, x: q.x - Math.cos(q.a) * g.w / 2, y: q.y - Math.sin(q.a) * g.w / 2, a: q.a, s, w: g.w });
    }
    let gi = 0;
    for (const tk of toks) { const st = this.text.indexOf(tk, gi); this.ranges.push([st, st + Array.from(tk).length]); gi = st + tk.length; }
  }
  /** Fitted size for a path of `len` px (keeps `margin` free at both ends). */
  static fit(words: Word[], fam: string, max: number, len: number, tracking = 0, upper = true) {
    const txt = words.map((w) => (upper ? w.w.toUpperCase() : w.w)).join(' ');
    const w1 = layout(txt, fam, 100, tracking * 100 / max).width / 100;
    return Math.min(max, len / w1);
  }
  /**
   * Draw as sung: unsung = a faint guide, the word being sung = blue, sung = bone. Returns the pen
   * (the writing head: after the last written glyph, on the path) or null before the first word.
   */
  draw(c: CanvasRenderingContext2D, t: number, o: { a?: number; guide?: number; bone?: number; lw?: number } = {}): P | null {
    const A = o.a ?? 1;
    c.font = font(this.fam, this.size);
    c.textBaseline = 'alphabetic';
    let pen: P | null = null;
    this.words.forEach((w, wi) => {
      const [g0, g1] = this.ranges[wi]!;
      const n = g1 - g0;
      const p = Lyrics.wordProgress(w, t);
      for (let i = 0; i < n; i++) {
        const g = this.glyphs[g0 + i];
        if (!g) continue;
        const k = clamp(p * n - i);
        if (k <= 0) c.fillStyle = rgba('bone', (o.guide ?? 0.1) * A);
        else if (p < 1) c.fillStyle = rgba('signal', A);
        else c.fillStyle = rgba('bone', (o.bone ?? 0.94) * A);
        c.save();
        c.translate(g.x, g.y); c.rotate(g.a);
        c.fillText(g.ch, 0, 0);
        c.restore();
        if (k > 0) {
          const e = g.x + Math.cos(g.a) * g.w * k, f = g.y + Math.sin(g.a) * g.w * k;
          pen = { x: e, y: f };
        }
      }
    });
    return pen;
  }
  /** Is any word being sung (the pen is live)? */
  live(t: number) { return this.words.some((w) => t >= w.start - 0.02 && t < w.end + 0.1); }
}

// ------------------------------------------------------------------ plate furniture
/** The plate's ruled border (double rule), in plate px. */
export function border(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, a: number, k: number) {
  c.strokeStyle = rgba('bone', 0.5 * a); c.lineWidth = 2.2 * k;
  c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = rgba('bone', 0.2 * a); c.lineWidth = 1 * k;
  c.strokeRect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24);
}
/** Plate lettering: a spaced roman title and a subtitle (Cormorant), as in world4's plate. */
export function plateTitle(c: CanvasRenderingContext2D, x: number, y: number, title: string, sub: string, a: number, s = 1) {
  c.textBaseline = 'alphabetic';
  c.fillStyle = rgba('bone', 0.72 * a);
  c.font = font(F.serif(600), 26 * s);
  c.letterSpacing = `${4 * s}px`;
  c.fillText(title, x, y);
  c.font = font(F.serif(400), 17 * s);
  c.fillStyle = rgba('bone', 0.46 * a);
  c.fillText(sub, x, y + 28 * s);
  c.letterSpacing = '0px';
}
export function caption(c: CanvasRenderingContext2D, x: number, y: number, lines: string[], a: number, s = 1) {
  c.textBaseline = 'alphabetic';
  c.font = font(F.serif(400, true), 21 * s);
  c.fillStyle = rgba('bone', 0.55 * a);
  lines.forEach((l, i) => c.fillText(l, x, y + i * 26 * s));
}
export function scaleBar(c: CanvasRenderingContext2D, x: number, y: number, len: number, label: string, a: number, k: number) {
  c.strokeStyle = rgba('bone', 0.6 * a); c.lineWidth = 1.4 * k;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.moveTo(x + len, y - 6); c.lineTo(x + len, y + 6); c.stroke();
  c.fillStyle = rgba('bone', 0.6 * a);
  c.font = font(F.serif(400, true), 20);
  c.fillText(label, x + len + 12, y + 6);
}
/** A specimen label: double-ruled box with mono lines. */
export function specimen(c: CanvasRenderingContext2D, x: number, y: number, w: number, lines: string[], a: number, k: number) {
  const h = 30 + lines.length * 21;
  c.strokeStyle = rgba('bone', 0.62 * a); c.lineWidth = 1.2 * k;
  c.strokeRect(x, y, w, h);
  c.strokeRect(x + 5, y + 5, w - 10, h - 10);
  c.textBaseline = 'alphabetic';
  lines.forEach((l, i) => {
    c.font = font(F.mono(i === 0 ? 500 : 400), 13);
    c.letterSpacing = i === 0 ? '3px' : '0px';
    c.fillStyle = rgba('bone', (i === 0 ? 0.6 : 0.52) * a);
    c.fillText(l, x + 18, y + 30 + i * 21);
  });
  c.letterSpacing = '0px';
}
