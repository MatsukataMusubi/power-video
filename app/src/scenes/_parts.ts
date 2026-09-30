// Exploded assemblies (direction A, after the director's note of 2026-09-28: no figurative body;
// code draws geometry, typography and measurement well, not organic wholes). Parts are machined
// primitives — plates, bars, rings, blocks — that fly in and lock into a scattered constellation.
// They never touch to form a figure; what relates them is the language of measurement: leader
// lines with dimensions, datum axes, part numbers, a shared grid. Lyrics are etched into parts,
// handwritten along datum curves, or scanned; the cursors are the laser, the pen, the scan line.
import { W, H } from '../engine/gl';
import { font, fitSize, measure } from '../engine/type';
import type { Word } from '../engine/lyrics';
import { clamp, ease, hash, pulse, type V2 } from '../engine/util';
import { specimen, type Specimen } from './_plate';
import { CAP, SLAB, MONO, BONE, hexA, sparksAt } from './_shell';

export type Kind = 'plate' | 'bar' | 'ring' | 'block';
export interface Part {
  id: string;
  kind: Kind;
  /** World position and orientation; w/h in world px (a ring's w is its diameter). */
  x: number; y: number; ang: number; w: number; h: number;
  /** Parallax factor: 1 = the focal plane, < 1 further away. */
  pf: number;
  tLock: number;
  /** Fly-in direction (world radians): the part arrives from there. */
  dir: number;
  etch?: { text: string; sp: Specimen; size: number; wpx: number; word?: Word };
}
export interface Cam { x: number; y: number; a: number; z: number }
export interface Key extends Cam { t: number; dur: number }
export interface Link { a: number; b: number; label: string }

// ------------------------------------------------------------------ camera

/** Camera keyframes: a key with dur 0 is a hard cut; otherwise an outExpo move from the previous key. */
export function camAt(keys: Key[], t: number): Cam {
  let prev = keys[0]!, cur = keys[0]!;
  for (const k of keys) { if (k.t > t) break; prev = cur; cur = k; }
  const e = cur.dur <= 0 ? 1 : ease.outExpo(clamp((t - cur.t) / cur.dur));
  const from = cur.dur <= 0 ? cur : prev;
  const l = (a: number, b: number) => a + (b - a) * e;
  return { x: l(from.x, cur.x), y: l(from.y, cur.y), a: l(from.a, cur.a), z: l(from.z, cur.z) };
}

/** Screen position of a world point on a part's parallax plane. */
export function toScreen(cam: Cam, x: number, y: number, pf = 1): V2 {
  const dx = (x - cam.x) * pf, dy = (y - cam.y) * pf;
  const ca = Math.cos(-cam.a), sa = Math.sin(-cam.a);
  return { x: W / 2 + cam.z * (dx * ca - dy * sa), y: H / 2 + cam.z * (dx * sa + dy * ca) };
}

/** Enter a part's local frame (origin at its centre, rotated by ang, on its parallax plane). */
export function enterPart(c: CanvasRenderingContext2D, cam: Cam, p: Part, offX = 0, offY = 0) {
  c.translate(W / 2, H / 2); c.scale(cam.z, cam.z); c.rotate(-cam.a);
  c.translate((p.x - cam.x) * p.pf + offX, (p.y - cam.y) * p.pf + offY);
  c.rotate(p.ang);
}

// ------------------------------------------------------------------ parts

export function makeEtch(text: string, maxW: number, maxCap: number, word?: Word): NonNullable<Part['etch']> {
  const size = Math.min(fitSize(text, SLAB, maxW), maxCap / CAP);
  const wpx = measure(text, SLAB, size);
  return { text, sp: specimen(text, SLAB, size, -wpx / 2, (size * CAP) / 2), size, wpx, word };
}

/** The part's outline in local coordinates. */
export function partPath(p: Part): Path2D {
  const path = new Path2D();
  const w2 = p.w / 2, h2 = p.h / 2;
  if (p.kind === 'ring') {
    path.arc(0, 0, w2, 0, Math.PI * 2);
    path.moveTo(w2 * 0.55, 0);
    path.arc(0, 0, w2 * 0.55, 0, Math.PI * 2, true);
  } else if (p.kind === 'bar') {
    path.moveTo(-w2 + h2, -h2); path.lineTo(w2 - h2, -h2); path.arc(w2 - h2, 0, h2, -Math.PI / 2, Math.PI / 2);
    path.lineTo(-w2 + h2, h2); path.arc(-w2 + h2, 0, h2, Math.PI / 2, (3 * Math.PI) / 2); path.closePath();
  } else {
    const ch = Math.min(w2, h2) * 0.28;
    path.moveTo(-w2 + ch, -h2); path.lineTo(w2 - ch, -h2); path.lineTo(w2, -h2 + ch); path.lineTo(w2, h2 - ch);
    path.lineTo(w2 - ch, h2); path.lineTo(-w2 + ch, h2); path.lineTo(-w2, h2 - ch); path.lineTo(-w2, -h2 + ch); path.closePath();
  }
  return path;
}

/**
 * Draw a part in its local frame at time t: flies in from `dir` and locks at tLock (outExpo over
 * 75 ms), edge flashing in the accent on the lock and glowing with `glow` (0..1). Returns the lock
 * pulse. The caller has entered the part's frame (enterPart) — the fly-in offset is applied here.
 */
export function drawPart(c: CanvasRenderingContext2D, p: Part, t: number, acc: string, glow = 0, edgeOnly = false): number {
  if (t < p.tLock - 0.075) return 0;
  const e = ease.outExpo(clamp((t - (p.tLock - 0.075)) / 0.075));
  const flash = t >= p.tLock ? pulse(t, p.tLock, 0.12) : 0;
  const off = (1 - e) * 900;
  c.save();
  // the fly-in is along dir in world space: undo the part's rotation, offset, redo it
  c.rotate(-p.ang); c.translate(Math.cos(p.dir) * off, Math.sin(p.dir) * off); c.rotate(p.ang);
  const path = partPath(p);
  if (!edgeOnly) {
    const g = c.createLinearGradient(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2);
    g.addColorStop(0, '#A9A59D'); g.addColorStop(0.55, '#DAD7CF'); g.addColorStop(1, BONE);
    c.fillStyle = g;
    c.fill(path, 'evenodd');
    if (p.kind === 'block') { // an inset face
      c.fillStyle = 'rgba(40,44,43,0.12)';
      c.fillRect(-p.w / 2 + 18, -p.h / 2 + 18, p.w - 36, p.h - 36);
    }
    // bolt holes
    c.fillStyle = '#1A1D1C';
    const holes: V2[] = p.kind === 'ring'
      ? [0, 1, 2, 3, 4, 5].map((k) => ({ x: Math.cos((k * Math.PI) / 3) * p.w * 0.39, y: Math.sin((k * Math.PI) / 3) * p.w * 0.39 }))
      : p.kind === 'bar' ? [{ x: -p.w / 2 + p.h / 2, y: 0 }, { x: p.w / 2 - p.h / 2, y: 0 }]
      : [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => ({ x: sx! * (p.w / 2 - 22), y: sy! * (p.h / 2 - 22) }));
    for (const hq of holes) { c.beginPath(); c.arc(hq.x, hq.y, 5, 0, Math.PI * 2); c.fill(); }
    // part number
    c.font = font(MONO, 12);
    c.fillStyle = 'rgba(40,44,43,0.7)';
    if (p.kind !== 'ring') c.fillText(p.id, -p.w / 2 + 14, p.h / 2 - 10);
    else c.fillText(p.id, -p.w * 0.12, p.w * 0.5 + 18);
  }
  const edge = Math.max(flash, glow);
  c.strokeStyle = edge > 0.05 ? hexA(acc, 0.35 + 0.65 * edge) : 'rgba(40,44,43,0.9)';
  c.lineWidth = 2 + 2.5 * edge;
  c.stroke(path);
  c.restore();
  return t >= p.tLock ? pulse(t, p.tLock, 0.07) : 0;
}

/** A word laser-etched into a part (local frame): the groove is revealed left → right by `p`, the
 * laser tracing the outline with sparks while cutting; `lit` floods the groove with the accent. */
export function etchWord(c: CanvasRenderingContext2D, e: NonNullable<Part['etch']>, t: number, p: number, lit: number, acc: string, cutting = true) {
  c.save();
  c.beginPath(); c.rect(-e.wpx / 2 - 10, -e.size, (e.wpx + 20) * p, e.size * 1.4); c.clip();
  c.translate(1.2, 1.2); c.fillStyle = '#4E4A44'; c.fill(e.sp.path);
  c.translate(-1.2, -1.2); c.fillStyle = '#8F8A80'; c.fill(e.sp.path);
  c.restore();
  if (lit > 0) {
    c.save();
    c.beginPath(); c.rect(-e.wpx / 2 - 10, -e.size, (e.wpx + 20) * lit, e.size * 1.4); c.clip();
    c.fillStyle = hexA(acc, 1); c.fill(e.sp.path);
    c.restore();
  }
  if (cutting && p > 0 && p < 1) {
    const budget = p * e.sp.len;
    let used = 0;
    let head: V2 | null = null;
    c.save();
    c.strokeStyle = 'rgba(40,36,30,0.9)'; c.lineWidth = 1.4;
    c.beginPath();
    outer: for (const poly of e.sp.polys) {
      for (let i = 0; i < poly.length; i++) {
        const q = poly[i]!;
        if (i) {
          const d = Math.hypot(q.x - poly[i - 1]!.x, q.y - poly[i - 1]!.y);
          if (used + d > budget) break outer;
          used += d; c.lineTo(q.x, q.y);
        } else c.moveTo(q.x, q.y);
        head = q;
      }
    }
    c.stroke();
    c.restore();
    if (head) sparksAt(c, head, t, 3.5, 12, acc);
  }
}

/** Beside a part that just locked: its number and a seating readout on a leader line, gone in 0.45 s. */
export function lockCallout(c: CanvasRenderingContext2D, cam: Cam, p: Part, t: number, acc: string) {
  if (t < p.tLock || t > p.tLock + 0.45) return;
  const age = t - p.tLock, a = 1 - clamp((age - 0.25) / 0.2);
  const s = toScreen(cam, p.x, p.y, p.pf);
  const right = s.x < W / 2;
  const x1 = s.x + (right ? 1 : -1) * (Math.max(p.w, p.h) * 0.5 * cam.z + 70), y1 = s.y - 40;
  c.save();
  c.strokeStyle = hexA(acc, 0.8 * a); c.lineWidth = 1;
  c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(x1, y1); c.lineTo(x1 + (right ? 30 : -30), y1); c.stroke();
  c.font = font(MONO, 13); c.fillStyle = hexA(acc, a);
  c.textAlign = right ? 'left' : 'right';
  const tx = x1 + (right ? 36 : -36);
  c.fillText(`${p.id}`, tx, y1 - 4);
  c.fillText(`SEAT ${(0.4 * Math.exp(-age * 18)).toFixed(3)} MM  LOCK`, tx, y1 + 13);
  c.restore();
}

// ------------------------------------------------------------------ measurement (what relates the parts)

/** A leader/dimension line between two locked parts, in screen space, with `surge` (0..1 position of
 * a bright pulse along it, or -1) and `lit` (0..1 overall accent). */
export function drawLink(c: CanvasRenderingContext2D, cam: Cam, parts: Part[], l: Link, t: number, acc: string, surge = -1, lit = 0) {
  const A = parts[l.a]!, B = parts[l.b]!;
  const tOn = Math.max(A.tLock, B.tLock);
  if (t < tOn) return;
  const grow = ease.outExpo(clamp((t - tOn) / 0.25));
  const a = toScreen(cam, A.x, A.y, A.pf), b = toScreen(cam, B.x, B.y, B.pf);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const ra = Math.max(A.w, A.h) * 0.5 * cam.z * (A.kind === 'ring' ? 1 : 0.7), rb = Math.max(B.w, B.h) * 0.5 * cam.z * (B.kind === 'ring' ? 1 : 0.7);
  const x0 = a.x + ux * ra, y0 = a.y + uy * ra, x1 = x0 + (b.x - ux * rb - x0) * grow, y1 = y0 + (b.y - uy * rb - y0) * grow;
  c.save();
  c.strokeStyle = lit > 0.05 ? hexA(acc, 0.35 + 0.65 * lit) : 'rgba(232,230,223,0.32)';
  c.lineWidth = 1 + lit;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  // dimension ticks at both ends
  for (const [px, py] of [[x0, y0], [x1, y1]] as [number, number][]) { c.beginPath(); c.moveTo(px - nx * 7, py - ny * 7); c.lineTo(px + nx * 7, py + ny * 7); c.stroke(); }
  if (grow >= 1) {
    c.font = font(MONO, 12);
    c.fillStyle = lit > 0.05 ? hexA(acc, 0.6 + 0.4 * lit) : 'rgba(232,230,223,0.55)';
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    c.translate(mx, my); c.rotate(Math.atan2(uy, ux) + (ux < 0 ? Math.PI : 0));
    c.textAlign = 'center';
    c.fillText(l.label, 0, -6);
  }
  c.restore();
  if (surge >= 0 && surge <= 1) {
    const px = x0 + (x1 - x0) * surge, py = y0 + (y1 - y0) * surge;
    const g = c.createLinearGradient(px - ux * 60, py - uy * 60, px, py);
    g.addColorStop(0, hexA(acc, 0)); g.addColorStop(1, hexA(acc, 1));
    c.save();
    c.strokeStyle = g; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(px - ux * 60, py - uy * 60); c.lineTo(px, py); c.stroke();
    c.fillStyle = hexA(acc, 1); c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}

/** Datum axes through a world point: two hairlines with ticks and A/B labels. */
export function drawDatum(c: CanvasRenderingContext2D, cam: Cam, x: number, y: number, alpha: number, acc: string) {
  const s = toScreen(cam, x, y);
  c.save();
  c.translate(s.x, s.y); c.rotate(-cam.a);
  c.strokeStyle = `rgba(232,230,223,${0.28 * alpha})`; c.lineWidth = 1;
  c.setLineDash([3, 9]);
  c.beginPath(); c.moveTo(-W, 0); c.lineTo(W, 0); c.moveTo(0, -H); c.lineTo(0, H); c.stroke();
  c.setLineDash([]);
  c.strokeStyle = hexA(acc, 0.8 * alpha); c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(-16, 0); c.lineTo(16, 0); c.moveTo(0, -16); c.lineTo(0, 16); c.stroke();
  c.font = font(MONO, 12); c.fillStyle = `rgba(232,230,223,${0.6 * alpha})`;
  c.fillText('DATUM A', 22, -8); c.fillText('B', -8, -22);
  c.restore();
}

/** A mechanical aperture (iris) at the local origin: `open` 0..1. */
export function drawIris(c: CanvasRenderingContext2D, R: number, open: number, acc: string) {
  const r = R * 0.82 * open;
  c.save();
  c.fillStyle = '#1A1D1C'; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
  // eight blades: chords that swing out as it opens
  c.strokeStyle = 'rgba(232,230,223,0.55)'; c.lineWidth = 2;
  for (let k = 0; k < 8; k++) {
    const a0 = (k * Math.PI) / 4 + open * 0.9;
    const ex = Math.cos(a0) * R, ey = Math.sin(a0) * R;
    const ix = Math.cos(a0 + 1.1) * r, iy = Math.sin(a0 + 1.1) * r;
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(ix, iy); c.stroke();
  }
  if (open > 0) {
    const g = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    g.addColorStop(0, hexA(acc, 1)); g.addColorStop(1, hexA(acc, 0.15));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hexA(acc, 1); c.lineWidth = 2; c.stroke();
  }
  c.strokeStyle = 'rgba(232,230,223,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
  c.restore();
}

/** A raster scan over a screen rect: an accent line sweeping top → bottom over `p` 0..1, the scanned
 * area hatched with the machine's measurement lines. */
export function drawScan(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: number, acc: string, t: number) {
  if (p <= 0) return;
  const yy = y + h * p;
  c.save();
  c.strokeStyle = hexA(acc, 0.35); c.lineWidth = 1;
  c.beginPath();
  for (let ly = y; ly < yy; ly += 14) { c.moveTo(x, ly + 0.5); c.lineTo(x + w, ly + 0.5); }
  c.stroke();
  if (p < 1) {
    c.strokeStyle = hexA(acc, 1); c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 30, yy); c.lineTo(x + w + 30, yy); c.stroke();
    c.font = font(MONO, 12); c.fillStyle = hexA(acc, 1);
    c.fillText(`SCAN ${(p * 100).toFixed(0).padStart(3, '0')}%  ${(hash(Math.floor(t * 60), 3) * 9.99).toFixed(2)}`, x + w + 40, yy + 4);
  }
  c.restore();
}
