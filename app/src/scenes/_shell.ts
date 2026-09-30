// Shared kit for direction A (the assembly sequence): the graphite ground + composite pass, the
// numeral bursts, handwriting along a curve, and small helpers used by shell.ts, dock.ts, field.ts.
// Parts and measurement live in _parts.ts.
import * as THREE from 'three';
import { FSPass } from '../engine/gl';
import { W, H } from '../engine/gl';
import { HEX } from '../engine/palette';
import { F, font, fitSize, measure } from '../engine/type';
import type { StrokeText } from '../engine/stroke';
import { clamp, ease, frameIdx, hash, pointAtLength, prog, pulse } from '../engine/util';
import type { Poly } from './_plate';

export const CAP = 0.686;
export const SLAB = F.archivo(62, 900); // tall, condensed, machined
export const MONO = F.mono(500);
export const MONO_B = F.mono(600);
export const clean = (w: string) => w.replace(/[,.?!“”"]/g, '');
export const BONE = '#E8E6DF';
export const CELL = 30; // the grid's cell (the ground's minor grid is 60 px)

export function hexA(hex: string, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ------------------------------------------------------------------ ground + composite
export const SHELL = /* glsl */ `
uniform sampler2D tex; uniform float glitch, seed, invert, glowGain; uniform vec3 acc;
void main() {
  vec2 px = FRAG_PX;                         // logical px, y up
  vec2 uv = vUv;
  if (glitch > 0.0) {                        // slice glitch: bands of rows read from the side
    float band = floor(px.y / (6.0 + 26.0 * hash11(floor(px.y / 32.0) + seed)));
    if (hash12(vec2(band, seed)) < glitch * 0.45) uv.x += (hash12(vec2(band, seed + 3.0)) - 0.5) * 0.16 * glitch;
  }
  vec4 s = texture(tex, uv);
  float y = px.y / 1080.0;
  vec3 g = mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.102, 0.118, 0.114)), y);
  vec2 cell = abs(fract(px / 60.0) - 0.5), major = abs(fract(px / 240.0) - 0.5);
  float gl = (1.0 - smoothstep(0.0, 0.03, 0.5 - max(cell.x, cell.y))) * 0.25
           + (1.0 - smoothstep(0.0, 0.006, 0.5 - max(major.x, major.y))) * 0.5;
  g += toLinear(vec3(0.16, 0.18, 0.17)) * gl * 0.35;
  vec3 col = mix(g, s.rgb, s.a);
  float near = 1.0 - smoothstep(0.08, 0.35, distance(s.rgb, acc)); // only the accent glows
  col += s.rgb * near * s.a * glowGain;
  col *= 0.95 + 0.05 * step(0.5, fract(px.y * 0.5));
  col = mix(col, vec3(0.82) - col * 0.9, invert);
  fragColor = vec4(col, 1.0);
}`;

/** Text laid out straight (a StrokeText) to be drawn along a curve: the curve's points/lengths and the
 * per-character sing times; s0 = where along the curve the text starts. */
export interface Along { pts: Poly; L: Float32Array; st: StrokeText; charTimes: [number, number][]; s0: number }

/** The ground + composite pass (accent-aware glow gain). */
export function shellPass(tex: THREE.Texture, acc: string): FSPass {
  const accLin = hexLin(acc);
  return new FSPass(SHELL, {
    tex: { value: tex }, glitch: { value: 0 }, seed: { value: 0 }, invert: { value: 0 },
    glowGain: { value: clamp(1.3 / (0.2126 * accLin[0] + 0.7152 * accLin[1] + 0.0722 * accLin[2]) - 1, 1, 8) }, acc: { value: accLin },
  });
}

export function dataBurst(c: CanvasRenderingContext2D, t: number, tc: number, acc: string) {
    const fi = frameIdx(t), k = clamp((t - tc) / 0.12);
    c.save();
    c.font = font(MONO, 14);
    for (let col = 0; col < 7; col++) {
      const x = 60 + hash(col, fi, 1) * (W - 260), y0 = 90 + hash(col, fi, 2) * (H - 420);
      const rows = 6 + Math.floor(hash(col, fi, 3) * 10);
      for (let r = 0; r < rows; r++) {
        const hot = hash(col, r, fi) < 0.15;
        c.fillStyle = hot ? hexA(acc, 1 - k) : `rgba(232,230,223,${0.6 * (1 - k)})`;
        const v = Math.floor(hash(col, r, fi, 4) * 0xffffff).toString(16).toUpperCase().padStart(6, '0');
        c.fillText(`${v}  ${(hash(col, r, fi, 5) * 99.999).toFixed(3)}`, x, y0 + r * 20);
      }
    }
    c.restore();
  }

  /** Map the first `len` px of a straight stroke layout onto the curve (x along it, y off it). */
export function strokeAlong(c: CanvasRenderingContext2D, b: Along, len: number, style: string, width: number): { x: number; y: number } | null {
    const at = (x: number, y: number) => {
      const p = pointAtLength(b.pts, b.L, b.s0 + x);
      return { x: p.x - Math.sin(p.angle) * y, y: p.y + Math.cos(p.angle) * y };
    };
    c.save();
    c.strokeStyle = style; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    let head: { x: number; y: number } | null = null;
    const st = b.st;
    for (let i = 0; i < st.strokes.length; i++) {
      const s0 = st.startLen[i]!;
      if (s0 >= len) break;
      const pts = st.strokes[i]!, L = st.lens[i]!;
      for (let j = 0; j < pts.length; j++) {
        if (L[j]! > len - s0) break;
        const q = at(pts[j]!.x, pts[j]!.y);
        if (j) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y);
        head = q;
      }
    }
    c.stroke();
    c.restore();
    return head;
  }

/** A polyline offset along its left normal (negative = right), for text set beside an outline. */
export function offsetPoly(pts: Poly, d: number): Poly {
  return pts.map((q, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: q.x + (dy / l) * d, y: q.y - (dx / l) * d };
  });
}

export function hexLin(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
}

/** Laser spot with a few sparks, re-dealt every frame (standalone twin of MachinedHead.sparks). */
export function sparksAt(c: CanvasRenderingContext2D, at: { x: number; y: number }, t: number, r0: number, reach: number, acc: string) {
  c.fillStyle = hexA(acc, 1);
  c.beginPath(); c.arc(at.x, at.y, r0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = hexA(acc, 0.8); c.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) {
    const an = hash(k, frameIdx(t)) * Math.PI * 2, r = reach * (0.5 + hash(k, frameIdx(t), 2));
    c.beginPath(); c.moveTo(at.x, at.y); c.lineTo(at.x + Math.cos(an) * r, at.y + Math.sin(an) * r); c.stroke();
  }
}
