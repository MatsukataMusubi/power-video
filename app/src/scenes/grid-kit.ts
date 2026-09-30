// world2 (grid.ts) kit: the 2D camera, the plate's timing (all derived from the lyric and the beat
// grid in grid.ts init), and the ground + composite pass shared by the four movements.
import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import type { Word } from '../engine/lyrics';

/** A 2D camera: world point (x, y) at the screen centre, zoom z, roll r (rad, clockwise). World y is down. */
export interface Cam { x: number; y: number; z: number; r: number }

export function applyCam(c: CanvasRenderingContext2D, k: Cam) {
  c.translate(W / 2, H / 2);
  c.rotate(k.r);
  c.scale(k.z, k.z);
  c.translate(-k.x, -k.y);
}

export function w2s(k: Cam, x: number, y: number) {
  const dx = (x - k.x) * k.z, dy = (y - k.y) * k.z;
  const cs = Math.cos(k.r), sn = Math.sin(k.r);
  return { x: W / 2 + cs * dx - sn * dy, y: H / 2 + sn * dx + cs * dy };
}

/** The camera that shows world point (x, y) at screen point (sx, sy) with zoom z and roll r. */
export function camAt(x: number, y: number, sx: number, sy: number, z: number, r = 0): Cam {
  const dx = (sx - W / 2) / z, dy = (sy - H / 2) / z;
  const cs = Math.cos(r), sn = Math.sin(r);
  return { x: x - (cs * dx + sn * dy), y: y - (-sn * dx + cs * dy), z, r };
}

/** The plate's timing. Four movements; words split between them by position in the two lines. */
export interface Timing {
  s0: number; e0: number; beat: number;
  /** ① words (breakers), ② words (notches, the last one locks), ③ words (network), ④ words (wheels). */
  w1: Word[]; w2: Word[]; w3: Word[]; w4: Word[];
  cutB: number; cutC: number; cutD: number;
  /** ① release: the last breaker closes. */
  tImpA: number;
  /** ② phase notches, the lock (all units in phase: the plate's maximal hit), the wide reframe. */
  notches: number[]; tLock: number; tR: number;
  /** ④ the last wheel lands (thunk). */
  tLockD: number;
}

export const upper = (w: string) => w.replace(/[,.?!“”"…]/g, '').toUpperCase();

// ------------------------------------------------------------------ ground + composite
// Dark drafting ground with a world-anchored engineering grid, or bone chart paper with its printed
// grid, strip rules and sprocket holes; the Canvas layer on top; only the blue glows (boosted past the
// bloom threshold by hue, as in hook.ts).
const GROUND = /* glsl */ `
uniform sampler2D tex;
uniform vec2 uCam; uniform float uZoom, uRot;
uniform float uPaper, uDarkGrid, uBlack, uHot, uStrip;
uniform vec4 uCell;   // minor x, minor y, major x, major y (world px)
float gridD(vec2 w, vec2 cell, float z) { vec2 g = abs(fract(w / cell + 0.5) - 0.5) * cell * z; return min(g.x, g.y); }
void main() {
  vec2 sp = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  vec2 d = (sp - vec2(960.0, 540.0)) / uZoom;
  float cs = cos(uRot), sn = sin(uRot);
  vec2 w = uCam + vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
  float lMin = pxLine(gridD(w, uCell.xy, uZoom), 0.3, 1.2);
  float lMaj = pxLine(gridD(w, uCell.zw, uZoom), 0.45, 1.45);
  // dark drafting ground (graphite grey-green, a faint grid)
  float yy = sp.y / 1080.0;
  vec3 dark = mix(toLinear(vec3(0.043, 0.050, 0.050)), toLinear(vec3(0.085, 0.098, 0.095)), yy);
  dark += toLinear(vec3(0.17, 0.19, 0.18)) * (0.2 * lMin + 0.42 * lMaj) * 0.45 * uDarkGrid;
  // chart paper
  float inStrip = 1.0 - step(uStrip, abs(w.y));
  float fib = snoise(w * vec2(0.004, 0.03)) * 0.5 + snoise(w * 0.05 + 3.1) * 0.5;
  vec3 paper = C_BONE * (0.94 + 0.022 * fib);
  float ink = inStrip * (0.2 * lMin + 0.42 * lMaj + 0.4 * pxLine(abs(w.y) * uZoom, 0.5, 1.6));
  ink += 0.55 * pxLine(abs(abs(w.y) - uStrip) * uZoom, 0.5, 1.5);
  paper = mix(paper, toLinear(vec3(0.36, 0.35, 0.33)), clamp(ink, 0.0, 1.0));
  vec2 hp = vec2(mod(w.x, 48.0) - 24.0, abs(w.y) - (uStrip + 34.0));
  float hole = sdBox(hp, vec2(6.0, 4.0)) - 2.5;
  paper = mix(paper, C_INK2, 1.0 - smoothstep(-0.7 / uZoom, 0.7 / uZoom, hole));
  vec3 g = mix(mix(dark, paper, uPaper), C_INK, uBlack);
  vec4 s = texture(tex, vUv);
  float h = smoothstep(0.25, 0.7, s.b - s.r * 1.3);
  fragColor = vec4(mix(g, s.rgb * (1.0 + uHot * h), s.a), 1.0);
}`;

export function makeGround(tex: THREE.Texture) {
  return new FSPass(GROUND, {
    tex: { value: tex }, uCam: { value: new THREE.Vector2(W / 2, H / 2) }, uZoom: { value: 1 }, uRot: { value: 0 },
    uPaper: { value: 0 }, uDarkGrid: { value: 0 }, uBlack: { value: 0 }, uHot: { value: 1 }, uStrip: { value: 300 },
    uCell: { value: new THREE.Vector4(60, 60, 240, 240) },
  });
}

export function setGround(p: FSPass, k: Cam, o: { paper?: number; darkGrid?: number; black?: number; hot?: number; cell?: [number, number, number, number]; strip?: number }) {
  const u = p.u;
  (u.uCam!.value as THREE.Vector2).set(k.x, k.y);
  u.uZoom!.value = k.z;
  u.uRot!.value = k.r;
  u.uPaper!.value = o.paper ?? 0;
  u.uDarkGrid!.value = o.darkGrid ?? 0;
  u.uBlack!.value = o.black ?? 0;
  u.uHot!.value = o.hot ?? 1;
  u.uStrip!.value = o.strip ?? 300;
  (u.uCell!.value as THREE.Vector4).set(...(o.cell ?? [60, 60, 240, 240]));
}
