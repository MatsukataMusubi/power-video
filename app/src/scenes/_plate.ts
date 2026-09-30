// Shared kit for the symbiosis plates (docs/TREATMENT.md): the paper, the plate furniture, the two
// lines (ink = human, drawn by hand; blue = AI, plotted), and
// the glitch that means "the two have not understood each other yet".
import type * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, textPathCommands, textPath2D, layout } from '../engine/type';
import { clamp, ease, frameIdx, hash, noise2, prog } from '../engine/util';

export type Pt = { x: number; y: number };
export type Poly = Pt[];

// ------------------------------------------------------------------ paper + glitch composite

/** Composites a Canvas2D layer over bone paper, with the block glitch (8×8 logical-px blocks
 * quantised to one colour or dragged sideways) on `glitch` > 0. Seeded per video frame. */
const PAPER = /* glsl */ `
uniform sampler2D tex; uniform float glitch, seed, dark;
void main() {
  vec2 px = FRAG_PX;
  vec2 uv = vUv;
  float g = 0.0;
  if (glitch > 0.0) {
    vec2 blk = floor(px / 8.0);
    vec2 row = floor(px / vec2(1920.0, 24.0));
    float hb = hash13(vec3(blk, seed));
    float hr = hash13(vec3(row, seed + 7.0));
    // DCT-like blocks: the block takes the colour at its centre
    if (hb < glitch * 0.35) { uv = (blk * 8.0 + 4.0) / vec2(1920.0, 1080.0); g = 1.0; }
    // a dragged band: this row of blocks is read from further left (datamosh drag)
    if (hr < glitch * 0.12) { uv.x -= (0.02 + 0.08 * hash11(row.y + seed)) * glitch; g = 1.0; }
  }
  vec4 s = texture(tex, uv);
  // paper: bone with a faint fibre tone (static), or ink for the dark plates
  float fibre = fbm(px * 0.012, 3) * 0.018 + snoise(px * 0.35) * 0.006;
  vec3 paper = mix(C_BONE * (1.0 + fibre), C_INK * (1.0 + fibre * 4.0), dark);
  vec3 col = mix(paper, s.rgb, s.a);
  // quantised blocks lose a little depth (bit-depth drop)
  if (g > 0.0) col = floor(col * 6.0 + 0.5) / 6.0;
  fragColor = vec4(col, 1.0);
}`;

export class Paper {
  pass: FSPass;
  constructor(tex: THREE.Texture) {
    this.pass = new FSPass(PAPER, { tex: { value: tex }, glitch: { value: 0 }, seed: { value: 0 }, dark: { value: 0 } });
  }
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, t: number, glitch: number, dark = 0) {
    this.pass.u.glitch!.value = clamp(glitch);
    this.pass.u.seed!.value = frameIdx(t) % 997;
    this.pass.u.dark!.value = dark;
    this.pass.render(renderer, out);
  }
}

/** Post overrides for a bone-paper plate (the paper must not bloom; only signal may). */
export const PAPER_POST = { bloom: 0.35, bloomThreshold: 1.1, halation: 0.06, ca: 0.35, vignette: 0.18, grain: 0.035, paper: 1, hud: 0 };

// ------------------------------------------------------------------ plate furniture

export const MARGIN = 64;

/** Double-rule border, series title, plate number, and a figure caption in the naturalist's italic. */
export function drawPlate(c: CanvasRenderingContext2D, plate: string, caption: string, o: { ink?: string; alpha?: number } = {}) {
  const ink = o.ink ?? 'ink';
  const a = o.alpha ?? 1;
  c.save();
  c.strokeStyle = rgba(ink, 0.85 * a);
  c.lineWidth = 1.6;
  c.strokeRect(MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN);
  c.lineWidth = 0.6;
  c.strokeRect(MARGIN + 7, MARGIN + 7, W - 2 * MARGIN - 14, H - 2 * MARGIN - 14);
  c.fillStyle = rgba(ink, 0.7 * a);
  c.font = font(F.mono(500), 14);
  c.textBaseline = 'alphabetic';
  c.letterSpacing = '3px';
  c.fillText('A NATURAL HISTORY OF A NEW SYMBIOSIS', MARGIN + 26, MARGIN + 42);
  c.letterSpacing = '0px';
  c.font = font(F.serif(600, true), 30);
  c.textAlign = 'right';
  c.fillText(plate, W - MARGIN - 26, MARGIN + 46);
  c.textAlign = 'left';
  if (caption) {
    c.font = font(F.serif(400, true), 25);
    c.fillStyle = rgba(ink, 0.78 * a);
    c.fillText(caption, MARGIN + 26, H - MARGIN - 26);
  }
  c.restore();
}

// ------------------------------------------------------------------ outlines → polylines

/** Flatten opentype commands into polylines (one per contour), about `step` px apart. */
export function flatten(cmds: ReturnType<typeof textPathCommands>, step = 3): Poly[] {
  const out: Poly[] = [];
  let cur: Poly = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const push = () => { if (cur.length > 1) out.push(cur); cur = []; };
  for (const k of cmds as any[]) {
    if (k.type === 'M') { push(); x = sx = k.x; y = sy = k.y; cur.push({ x, y }); }
    else if (k.type === 'L') { segLine(cur, x, y, k.x, k.y, step); x = k.x; y = k.y; }
    else if (k.type === 'Q') { segCurve(cur, [x, y, k.x1, k.y1, k.x1, k.y1, k.x, k.y], step, true); x = k.x; y = k.y; }
    else if (k.type === 'C') { segCurve(cur, [x, y, k.x1, k.y1, k.x2, k.y2, k.x, k.y], step, false); x = k.x; y = k.y; }
    else if (k.type === 'Z') { segLine(cur, x, y, sx, sy, step); x = sx; y = sy; push(); }
  }
  push();
  return out;
}
function segLine(p: Poly, x0: number, y0: number, x1: number, y1: number, step: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
  for (let i = 1; i <= n; i++) p.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
}
function segCurve(p: Poly, q: number[], step: number, quad: boolean) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q as [number, number, number, number, number, number, number, number];
  const n = Math.max(2, Math.ceil((Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x3 - x1, y3 - y1)) / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    if (quad) p.push({ x: u * u * x0 + 2 * u * t * x1 + t * t * x3, y: u * u * y0 + 2 * u * t * y1 + t * t * y3 });
    else p.push({ x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3 });
  }
}

/** A word as a specimen: its contours (for the ink line), its fill path (for the blue hatching), its box. */
export interface Specimen { polys: Poly[]; len: number; path: Path2D; x: number; base: number; w: number; size: number }
export function specimen(text: string, family: string, size: number, x: number, base: number, tracking = 0): Specimen {
  const cmds = textPathCommands(text, family, size, x, base, tracking);
  const polys = flatten(cmds, Math.max(2, size / 90));
  let len = 0;
  for (const p of polys) for (let i = 1; i < p.length; i++) len += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y);
  return { polys, len, path: textPath2D(text, family, size, x, base, tracking), x, base, w: layout(text, family, size, tracking).width, size };
}

// ------------------------------------------------------------------ the ink line (human)

/**
 * Draw polylines by hand: the first `p` (0..1) of their total length, with a pencil wobble that
 * "boils" at 12 fps (like hand-drawn animation) and a second, fainter pass slightly off the first.
 */
export function inkLine(c: CanvasRenderingContext2D, polys: Poly[], total: number, p: number, t: number, o: { seed?: number; width?: number; wobble?: number; color?: string; alpha?: number } = {}) {
  if (p <= 0) return;
  const seed = o.seed ?? 1, wob = o.wobble ?? 2.2, a = o.alpha ?? 1;
  const boil = Math.floor(frameIdx(t) / 5);
  const budget = p * total;
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = rgba(o.color ?? 'ink', (pass ? 0.35 : 0.92) * a);
    c.lineWidth = (o.width ?? 2.2) * (pass ? 0.6 : 1);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    let used = 0;
    c.beginPath();
    for (let k = 0; k < polys.length && used < budget; k++) {
      const poly = polys[k]!;
      for (let i = 0; i < poly.length; i++) {
        const q = poly[i]!;
        if (i > 0) {
          const d = Math.hypot(q.x - poly[i - 1]!.x, q.y - poly[i - 1]!.y);
          if (used + d > budget) break;
          used += d;
        }
        const ph = pass * 3.1 + seed * 11.3;
        const dx = noise2(q.x * 0.018 + ph, q.y * 0.018 + boil * 3.7, seed) * wob + (pass ? 1.1 : 0);
        const dy = noise2(q.y * 0.018 + ph, q.x * 0.018 - boil * 2.9, seed + 5) * wob - (pass ? 0.7 : 0);
        if (i === 0) c.moveTo(q.x + dx, q.y + dy); else c.lineTo(q.x + dx, q.y + dy);
      }
    }
    c.stroke();
  }
}

// ------------------------------------------------------------------ the blue line (AI)

/**
 * Plotted hatching inside `path`: exact parallel lines at `angle`, `spacing` apart, laid down left to
 * right up to `p` (0..1) of the box width; (dx, dy) shifts the hatching off the outline it should fill
 * (misregistration: the AI has misread the human's shape).
 */
export function hatch(c: CanvasRenderingContext2D, path: Path2D, box: { x: number; y: number; w: number; h: number }, p: number, o: { dx?: number; dy?: number; spacing?: number; angle?: number; width?: number; alpha?: number } = {}) {
  if (p <= 0) return;
  const sp = o.spacing ?? 7, ang = o.angle ?? -0.62, a = o.alpha ?? 1;
  c.save();
  c.translate(o.dx ?? 0, o.dy ?? 0);
  c.clip(path);
  c.strokeStyle = rgba('signal', a);
  c.lineWidth = o.width ?? 1.7;
  c.lineCap = 'butt';
  const tan = Math.tan(ang);
  const reach = box.h * Math.abs(tan);
  const x1 = box.x + (box.w + reach) * clamp(p) - reach;
  c.beginPath();
  for (let x = box.x - reach; x <= x1; x += sp) {
    c.moveTo(x, box.y + box.h);
    c.lineTo(x + box.h * -tan, box.y);
  }
  c.stroke();
  c.restore();
}

// ------------------------------------------------------------------ the face

/** A face in profile looking right, in a unit box (y down): the front line, and the back of the head. */
const FRONT: [number, number][] = [
  [0.45, 0.04], [0.6, 0.09], [0.68, 0.2], [0.7, 0.3], [0.675, 0.365], [0.745, 0.43], [0.835, 0.5], [0.8, 0.53],
  [0.725, 0.55], [0.745, 0.605], [0.735, 0.63], [0.705, 0.655], [0.735, 0.685], [0.72, 0.715], [0.685, 0.74],
  [0.705, 0.785], [0.7, 0.83], [0.6, 0.865], [0.555, 0.9], [0.56, 1.0],
];
const BACK: [number, number][] = [[0.45, 0.04], [0.25, 0.09], [0.1, 0.27], [0.08, 0.47], [0.16, 0.66], [0.3, 0.8], [0.32, 1.0]];
const EYE: [number, number][] = [[0.575, 0.345], [0.61, 0.33], [0.645, 0.345], [0.61, 0.355], [0.575, 0.345]];
const EAR: [number, number][] = [[0.32, 0.4], [0.28, 0.43], [0.28, 0.5], [0.32, 0.53]];

export function catmull(pts: [number, number][], box: { x: number; y: number; w: number; h: number }, per = 10): Poly {
  const P = pts.map(([x, y]) => ({ x: box.x + x * box.w, y: box.y + y * box.h }));
  const out: Poly = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[Math.min(P.length - 1, i + 2)]!;
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(P[P.length - 1]!);
  return out;
}
export const polyLen = (p: Poly) => p.reduce((s, q, i) => (i ? s + Math.hypot(q.x - p[i - 1]!.x, q.y - p[i - 1]!.y) : 0), 0);

export interface Face { front: Poly; back: Poly; eye: Poly; ear: Poly; all: Poly[]; len: number; clip: Path2D; box: { x: number; y: number; w: number; h: number } }

/** The profile (front line, back of the head, eye, ear) in `box`, with the head as a closed clip path. */
export function faceGeometry(box: { x: number; y: number; w: number; h: number }): Face {
  const front = catmull(FRONT, box), back = catmull(BACK, box), eye = catmull(EYE, box, 6), ear = catmull(EAR, box, 8);
  const all = [front, back, eye, ear];
  const clip = new Path2D();
  const ring = [...front, ...back.slice().reverse()];
  ring.forEach((q, i) => (i ? clip.lineTo(q.x, q.y) : clip.moveTo(q.x, q.y)));
  clip.closePath();
  return { front, back, eye, ear, all, len: all.reduce((s, p) => s + polyLen(p), 0), clip, box };
}
