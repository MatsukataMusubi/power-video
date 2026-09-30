// bridgeB (platter.ts) kit: the drive's geometry, the 2D camera, polar text (the lyric laid along a
// track), the head stack assembly drawn top-down, and the disc pass (platter surface, tracks, servo
// wedges, the sector map, and the Canvas layer composited on top with only the blue glowing).
// World units: the platter is centred at the origin, y down, radius RP. Angles are measured clockwise
// from "up" (a = 0 is the top of the platter), so text along the top of a track reads left to right.
import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import { rgba, LIN, type PaletteKey } from '../engine/palette';
import { layout, type TextLayout } from '../engine/type';
import { lerp, springStep, TAU } from '../engine/util';

export const RP = 9000; // platter radius
export const R_IN = 2970, R_OUT = 8730; // the data zone (the sector map's rings)
export const NR = 100; // sector-map rings
export const RING = (R_OUT - R_IN) / NR;
export const CELL = RING; // sector arc length (zoned: square cells on every ring)
export const NS_MAX = Math.ceil((TAU * R_OUT) / CELL) + 1;
export const HUB = 2150; // the clamp's outer radius
export const PIVOT = { x: 11600, y: 4600 }; // actuator pivot, outside the platter (lower right)
export const ARM_L = 14480; // pivot to the write element
export const NW = 96; // servo wedges per revolution
export const CAP = 0.686; // Archivo cap height / em

// ------------------------------------------------------------------ camera
/** A 2D camera: world point (x, y) at the screen centre, zoom z, roll r (rad, clockwise). */
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

// ------------------------------------------------------------------ polar helpers
export const polar = (r: number, a: number) => ({ x: r * Math.sin(a), y: -r * Math.cos(a) });
export const angOf = (x: number, y: number) => Math.atan2(x, -y);

/** The macro's reference track: the frame centre sits on it (movements 1–2). */
export const R_PRESS = 6800;
export const PRESS_CAM: Cam = { x: 0, y: -R_PRESS, z: 1, r: 0 };
/**
 * "Unrolled" coordinates of the macro: x along the track, y down across the tracks, both in screen px
 * at the rest camera. Vertical lines map to radial ones (servo wedges); horizontal lines to tracks.
 * k is the local horizontal scale (r / R_PRESS): glyphs on inner tracks are that much narrower.
 */
export function U(x: number, y: number) {
  const r = R_PRESS - (y - H / 2), a = (x - W / 2) / R_PRESS;
  return { x: r * Math.sin(a), y: -r * Math.cos(a), a, k: r / R_PRESS };
}

// ------------------------------------------------------------------ text
const layCache = new Map<string, TextLayout>();
export function lay(text: string, fam: string, size: number, trackPx = 0) {
  const k = `${text}|${fam}|${size.toFixed(2)}|${trackPx.toFixed(2)}`;
  let l = layCache.get(k);
  if (!l) { l = layout(text, fam, size, trackPx); layCache.set(k, l); }
  return l;
}
/** x after n (fractional) glyphs: kerned glyph positions, continuous in n. */
export function xAt(l: TextLayout, n: number) {
  if (n <= 0) return 0;
  const g = l.glyphs;
  if (n >= g.length) return l.width;
  const i = Math.floor(n), f = n - i;
  return lerp(g[i]!.x, i + 1 < g.length ? g[i + 1]!.x : l.width, f);
}

/** Draw glyph i of a run, clipped to the fraction [lo, hi] of its advance (the karaoke wipe). */
function glyphClip(c: CanvasRenderingContext2D, ch: string, w: number, size: number, lo: number, hi: number) {
  if (lo <= 0 && hi >= 1) { c.fillText(ch, 0, 0); return; }
  c.save();
  c.beginPath();
  const x0 = lo <= 0 ? -size : lo * w, x1 = hi >= 1 ? w + size : hi * w;
  c.rect(x0, -size * 1.3, x1 - x0, size * 1.8);
  c.clip();
  c.fillText(ch, 0, 0);
  c.restore();
}

/**
 * Glyphs [from, to) (fractional char counts) of a run laid along the macro's unrolled track at
 * baseline y. The run starts at x0 and is squeezed by sx about pivot (the width axis spring); gsc scales
 * the glyphs uniformly (the caller sets c.font at l.size).
 */
export function runU(c: CanvasRenderingContext2D, l: TextLayout, x0: number, base: number, from: number, to: number, sx = 1, pivot = x0, gsc = 1) {
  const gs = l.glyphs;
  for (let i = Math.max(0, Math.floor(from)); i < gs.length && i < to; i++) {
    const g = gs[i]!;
    if (g.ch === ' ') continue;
    const lo = from - i, hi = to - i;
    const x = pivot + (x0 + g.x * gsc - pivot) * sx;
    if (x < -300 - l.size * gsc || x > W + 300) continue;
    const P = U(x, base);
    c.save();
    c.translate(P.x, P.y); c.rotate(P.a); c.scale(sx * P.k * gsc, gsc);
    glyphClip(c, g.ch, g.w, l.size, lo, hi);
    c.restore();
  }
}

/**
 * Glyphs [from, to) of a run along a track of radius R: glyph 0's left edge at angle a0 (clockwise
 * from up), the run reading clockwise. `skip` culls glyphs outside an angle window.
 */
export function runRing(c: CanvasRenderingContext2D, l: TextLayout, R: number, a0: number, from: number, to: number, win?: [number, number]) {
  const gs = l.glyphs;
  for (let i = Math.max(0, Math.floor(from)); i < gs.length && i < to; i++) {
    const g = gs[i]!;
    if (g.ch === ' ') continue;
    const a = a0 + g.x / R;
    if (win && (a < win[0] || a > win[1])) continue;
    const P = polar(R, a);
    c.save();
    c.translate(P.x, P.y); c.rotate(a);
    glyphClip(c, g.ch, g.w, l.size, from - i, to - i);
    c.restore();
  }
}

// ------------------------------------------------------------------ small things
type SK = [time: number, value: number];
/** A value that steps between keys, each step caught by a damped spring (overshoot = momentum). */
export function stepped(t: number, ks: SK[], freq: number, damp: number) {
  let v = ks[0]![1];
  for (let i = 1; i < ks.length; i++) {
    const [ti, vi] = ks[i]!;
    if (t <= ti) break;
    v += (vi - ks[i - 1]![1]) * springStep(t - ti, freq, damp);
  }
  return v;
}

/** CSS colour between two palette entries. */
export function mixCss(a: PaletteKey, b: PaletteKey, k: number, alpha = 1) {
  const pa = rgba(a).match(/\d+/g)!.map(Number), pb = rgba(b).match(/\d+/g)!.map(Number);
  const q = Math.max(0, Math.min(1, k));
  return `rgba(${[0, 1, 2].map((i) => Math.round(lerp(pa[i]!, pb[i]!, q))).join(',')},${alpha})`;
}

/** Head position for a target track radius (the actuator's reach from the pivot). */
export function headAt(r: number) {
  const pl = Math.hypot(PIVOT.x, PIVOT.y), th = Math.atan2(PIVOT.y, PIVOT.x);
  const C = (r * r - pl * pl - ARM_L * ARM_L) / (2 * ARM_L);
  const ta = th - Math.acos(Math.max(-1, Math.min(1, C / pl)));
  return { x: PIVOT.x + ARM_L * Math.cos(ta), y: PIVOT.y + ARM_L * Math.sin(ta), ta };
}
/** Head position for an actuator angle (the angle of pivot → head). */
export const headOf = (ta: number) => ({ x: PIVOT.x + ARM_L * Math.cos(ta), y: PIVOT.y + ARM_L * Math.sin(ta) });

// ------------------------------------------------------------------ the head stack assembly
const METAL = '#222826', METAL2 = '#262C2A', SLIDER = '#2E3431';
/**
 * The head stack top-down, in world units, drawn from the write element (origin) along +x toward the
 * pivot: slider, flexure, load beam with its traces, swage plate, E-block arm, pivot bearing, voice
 * coil. `px` is one screen pixel in world units. `reach` limits how far along the arm to draw.
 */
export function drawArm(c: CanvasRenderingContext2D, x: number, y: number, ang: number, px: number, o: { reach?: number; alpha?: number; slam?: number; hot?: number } = {}) {
  const a = o.alpha ?? 1;
  const reach = o.reach ?? ARM_L + 3200;
  const line = (al: number, w = 1) => { c.strokeStyle = rgba('bone', al * a); c.lineWidth = w * px; };
  c.save();
  c.translate(x, y); c.rotate(ang);
  c.lineJoin = 'round';
  // ---- the E-block arm (from the swage plate to the pivot) and the coil beyond
  if (reach > 3300) {
    const L = ARM_L;
    c.beginPath();
    c.moveTo(3150, -300); c.lineTo(L - 1300, -820); c.quadraticCurveTo(L - 700, -980, L - 420, -880);
    c.lineTo(L - 420, 880); c.quadraticCurveTo(L - 700, 980, L - 1300, 820); c.lineTo(3150, 300); c.closePath();
    c.fillStyle = METAL2; c.fill(); line(0.5, 1.1); c.stroke();
    // lightening cut-outs
    c.beginPath();
    c.moveTo(4300, -210); c.lineTo(L - 3600, -520); c.lineTo(L - 3000, 0); c.lineTo(L - 3600, 520); c.lineTo(4300, 210); c.closePath();
    c.moveTo(L - 2500, -470); c.lineTo(L - 1500, -620); c.lineTo(L - 1500, 620); c.lineTo(L - 2500, 470); c.closePath();
    c.fillStyle = 'rgba(8,10,10,0.92)'; c.fill(); line(0.28); c.stroke();
    // voice coil (behind the pivot) and the bearing
    c.beginPath();
    c.moveTo(L + 500, -700); c.lineTo(L + 3000, -1900); c.arc(L, 0, 3300, -0.62, 0.62); c.lineTo(L + 500, 700); c.closePath();
    c.fillStyle = METAL; c.fill(); line(0.42); c.stroke();
    c.beginPath(); c.moveTo(L + 1300, -560); c.lineTo(L + 2700, -1250); c.arc(L, 0, 2950, -0.44, 0.44); c.lineTo(L + 1300, 560); c.closePath();
    line(0.22); c.stroke();
    c.beginPath(); c.arc(L, 0, 700, 0, TAU); c.fillStyle = METAL2; c.fill(); line(0.6, 1.2); c.stroke();
    c.beginPath(); c.arc(L, 0, 420, 0, TAU); line(0.35); c.stroke();
    c.beginPath(); c.arc(L, 0, 150, 0, TAU); c.fillStyle = rgba('bone', 0.3 * a); c.fill();
  }
  // ---- the load beam (suspension): etched stainless, tapered, its bent rails and lightening hole
  c.beginPath();
  c.moveTo(130, -34); c.lineTo(3250, -150); c.lineTo(3250, 150); c.lineTo(130, 34); c.closePath();
  c.fillStyle = METAL; c.fill(); line(0.62, 1.1); c.stroke();
  c.save(); c.clip();
  c.strokeStyle = rgba('bone', 0.045 * a); c.lineWidth = 34;
  c.beginPath(); c.moveTo(130, -6); c.lineTo(3250, -40); c.stroke();
  c.restore();
  c.beginPath(); c.moveTo(360, -30); c.lineTo(3150, -128); c.moveTo(360, 30); c.lineTo(3150, 128); line(0.22); c.stroke();
  c.beginPath(); c.moveTo(1000, 0); c.lineTo(2600, -66); c.lineTo(2600, 66); c.closePath();
  c.fillStyle = 'rgba(8,10,10,0.9)'; c.fill(); line(0.3); c.stroke();
  // swage plate
  c.beginPath(); c.arc(3350, 0, 200, 0, TAU); c.fillStyle = METAL2; c.fill(); line(0.55); c.stroke();
  c.beginPath(); c.arc(3350, 0, 110, 0, TAU); line(0.3); c.stroke();
  // the trace pair along the lower edge, to the slider
  c.beginPath();
  c.moveTo(40, 26); c.quadraticCurveTo(110, 58, 260, 62); c.lineTo(3200, 176);
  c.moveTo(40, 16); c.quadraticCurveTo(120, 46, 260, 50); c.lineTo(3200, 162);
  c.strokeStyle = rgba('ash', 0.55 * a); c.lineWidth = 1.1 * px; c.stroke();
  // flexure tongue
  c.beginPath(); c.roundRect(-18, -50, 176, 100, 14); line(0.3); c.stroke();
  // ---- the slider (air-bearing rails seen through), the write element at the trailing edge
  const sl = o.slam ?? 0;
  c.save();
  c.rotate(0.12 * sl);
  c.beginPath(); c.roundRect(-6, -36, 116, 72, 6); c.fillStyle = SLIDER; c.fill(); line(0.85, 1.2); c.stroke();
  c.beginPath(); c.rect(14, -29, 84, 9); c.rect(14, 20, 84, 9); c.rect(74, -20, 11, 40); line(0.3); c.stroke();
  c.beginPath(); c.arc(60, 0, 7, 0, TAU); line(0.45); c.stroke();
  // trailing-edge pad and the element
  c.fillStyle = rgba('bone', 0.55 * a); c.fillRect(-3, -7, 6, 14);
  const hot = o.hot ?? 0;
  if (hot > 0) { c.fillStyle = rgba('signal', Math.min(1, hot) * a); c.fillRect(-2, -4.5, 3.5, 9); }
  c.restore();
  c.restore();
}

// ------------------------------------------------------------------ the disc pass
const DISC = /* glsl */ `
uniform sampler2D tex;
uniform sampler2D mask;
uniform vec4 uCam;          // x, y, zoom, roll
uniform float uT, uHot, uRot;
uniform float uPitch, uPhase, uGroove;   // track grooves (world), a boundary radius, visibility
uniform float uSheen, uSheenA, uSweepA, uSweepK;
uniform float uWedge, uData;
uniform float uMap, uDetail, uLit;
uniform float uProg[8];
uniform float uGhost[8];
uniform vec4 uBeats;
uniform float uCast;        // the base casting's grid
uniform float uExp;         // overall gain of the surface (the platter only, not the Canvas layer)
const float RP = ${RP.toFixed(1)};
const float R_IN = ${R_IN.toFixed(1)}, R_OUT = ${R_OUT.toFixed(1)}, RING = ${RING.toFixed(4)};
const float NW = ${NW.toFixed(1)};

float gridD(vec2 w, float cell, float z) { vec2 g = abs(fract(w / cell + 0.5) - 0.5) * cell * z; return min(g.x, g.y); }

void main() {
  vec2 sp = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  float z = uCam.z;
  vec2 d = (sp - vec2(960.0, 540.0)) / z;
  float cs = cos(uCam.w), sn = sin(uCam.w);
  vec2 w = uCam.xy + vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
  float r = length(w);
  float aW = atan(w.x, -w.y);              // world angle (clockwise from up)
  float aP = aW - uRot;                    // platter-frame angle
  float pxw = 1.0 / z;                     // one logical px in world units

  // ---- the base casting (outside the platter)
  float yy = sp.y / 1080.0;
  vec3 casting = mix(toLinear(vec3(0.050, 0.058, 0.057)), toLinear(vec3(0.078, 0.090, 0.087)), yy);
  casting *= 0.92 + 0.08 * snoise(w * 0.004) + 0.05 * snoise(w * 0.05);
  float gMin = pxLine(gridD(w, 600.0, z), 0.3, 1.2), gMaj = pxLine(gridD(w, 2400.0, z), 0.45, 1.45);
  casting += toLinear(vec3(0.17, 0.19, 0.18)) * (0.18 * gMin + 0.4 * gMaj) * 0.45 * uCast;
  // the recess wall around the platter: a shadow ring
  casting *= 1.0 - 0.55 * smoothstep(RP + 900.0, RP + 40.0, r);

  // ---- the platter: a dark mirror
  vec3 col = casting;
  if (r < RP + pxw * 2.0) {
    vec3 pl = toLinear(vec3(0.030, 0.035, 0.035)) + toLinear(vec3(0.020, 0.024, 0.023)) * (r / RP);
    // the broad anisotropic highlight (a bow tie across the disc) and the brushed rings in it
    float lobe = pow(0.5 + 0.5 * cos(2.0 * (aW - uSheenA)), 18.0) * smoothstep(HUBR, RP, r);
    float brush = 0.75 + 0.25 * snoise(vec2(r * 0.03, aP * 2.0)) + 0.2 * snoise(vec2(r * 0.4, aP * 40.0));
    pl += toLinear(vec3(0.16, 0.175, 0.17)) * lobe * brush * uSheen;
    // the beat sweep: a narrow light band crossing the frame (the disc turning under a fixed light)
    float sw = exp(-pow((aW - uSweepA) * r / 380.0, 2.0));
    pl += toLinear(vec3(0.13, 0.14, 0.14)) * sw * uSweepK * brush;
    // tracks: grooves on the pitch (they fade out once they are finer than a few px)
    float tr = (r - uPhase) / uPitch;
    float gd = abs(fract(tr + 0.5) - 0.5) * uPitch * z;
    float lod = smoothstep(2.5, 7.0, uPitch * z);
    pl += toLinear(vec3(0.20, 0.215, 0.21)) * pxLine(gd, 0.25, 1.0) * 0.28 * lod * uGroove * (0.6 + 0.8 * sw * uSweepK + 0.5 * lobe * uSheen);
    // written data: faint along-track dashes on fine sub-tracks (magnetic domains)
    float ti = floor(r / 9.0);
    float sAl = aP * r;
    float dash = hash12(vec2(ti, floor(sAl / (6.0 + 10.0 * hash11(ti)))));
    float dLod = smoothstep(2.0, 6.0, 9.0 * z);
    pl += toLinear(vec3(0.032, 0.036, 0.035)) * step(0.5, dash) * uData * dLod * (0.45 + 0.8 * sw * uSweepK + 0.4 * lobe * uSheen);
    // servo wedges: narrow radial strips with their chevron bursts
    float wi = aP * NW / TAU;
    float wd = abs(fract(wi + 0.5) - 0.5) * TAU / NW * r;   // world distance to the wedge centre line
    float wedge = 1.0 - smoothstep(9.0, 9.0 + 1.2 * pxw, wd);
    float chev = step(0.5, fract((r + wd * 1.4) / 14.0));
    pl = mix(pl, pl * 0.7 + toLinear(vec3(0.05, 0.056, 0.055)) * chev, wedge * uWedge * smoothstep(1.2, 5.0, 14.0 * z));
    pl += toLinear(vec3(0.05, 0.056, 0.055)) * wedge * uWedge * (1.0 - smoothstep(1.2, 5.0, 14.0 * z)) * 0.5;

    // ---- the sector map
    if (uMap > 0.0 && r > R_IN && r < R_OUT) {
      float ringF = (R_OUT - r) / RING;
      float ri = floor(ringF);
      float rc = R_OUT - (ri + 0.5) * RING;
      float ns = floor(TAU * rc / RING);
      float ap = mod(aP, TAU);
      float cf = ap / TAU * ns;
      float cj = floor(cf);
      vec2 q = vec2(fract(cf), fract(ringF)) - 0.5;
      float aa = max(fwidth(ringF), 1e-4) * 1.2;
      float aaB = aa * PX_SCALE;
      float body = 1.0 - smoothstep(0.41 - aaB, 0.41 + aaB, max(abs(q.x), abs(q.y)));
      vec4 m = texelFetch(mask, ivec2(int(cj), int(ri)), 0);
      int wi2 = int(floor(m.b * 8.0 + 0.5));
      float pr = uProg[wi2], gh = uGhost[wi2];
      float inTxt = step(0.5, m.r);
      float isTxt = inTxt * step(m.g, pr) * step(0.0001, pr);
      float front = isTxt * step(pr - 0.045, m.g) * step(pr, 0.999);
      float ghostTxt = inTxt * (1.0 - isTxt) * gh;
      // activity: used / free sectors, travelling read waves, read rings from the hub on the beats
      vec2 cell = vec2(cj, ri);
      float h = hash12(cell + 7.0);
      float used = step(0.38, hash12(cell * 1.7 + 3.1));
      float act = 0.5 + 0.5 * sin(rc * 0.0011 - uT * 4.0 + h * 0.8 + cj * 0.02);
      act *= 0.5 + 0.5 * sin(ap * 3.0 + uT * 2.6);
      float ring = 0.0;
      for (int i = 0; i < 4; i++) {
        float dt = uT - uBeats[i];
        if (dt > 0.0 && dt < 1.0) {
          float fr = (R_IN + dt * 9000.0) - rc;
          ring += exp(-pow(fr / 110.0, 2.0)) * exp(-dt * 3.0);
        }
      }
      float flick = step(0.985, hash12(cell + floor(uT * 20.0)));
      vec3 idle = mix(toLinear(vec3(0.028, 0.032, 0.032)), toLinear(vec3(0.085, 0.095, 0.092)), used);
      vec3 c = idle * (0.8 + 0.6 * act * used) + toLinear(vec3(0.22, 0.24, 0.235)) * flick * used;
      c += C_SIGNAL * 0.4 * ring * (0.5 + 0.5 * used);
      // close up: the bits inside a sector (along-track stripes)
      float bits = step(0.5, hash12(vec2(floor(q.x * 22.0 + 11.0), cj * 3.0 + ri)));
      c *= 1.0 - 0.25 * uDetail * bits;
      c = mix(c, C_BONE * (0.9 - 0.1 * uDetail * bits) * uLit, isTxt);
      c = mix(c, C_SIGNAL * 1.9 + C_EMBER * 0.25, front);
      c = mix(c, C_BONE * 0.2, ghostTxt);
      pl = mix(pl, c, body * uMap);
    }
    // rim: the polished bevel
    float rimD = abs(r - RP + 60.0) * z;
    pl += toLinear(vec3(0.35, 0.36, 0.35)) * pxLine(rimD, 0.4, 1.4) * 0.7;
    pl *= uExp;
    col = mix(casting, pl, 1.0 - smoothstep(RP - pxw, RP + pxw, r));
  }

  // ---- the Canvas layer; only the blue glows (boosted past the bloom threshold by hue)
  vec4 s = texture(tex, vUv);
  float hb = smoothstep(0.25, 0.7, s.b - s.r * 1.3);
  fragColor = vec4(mix(col, s.rgb * (1.0 + uHot * hb), s.a), 1.0);
}`.replace('HUBR', (HUB * 1.1).toFixed(1));

export interface DiscState {
  cam: Cam; t: number; rot?: number; hot?: number;
  pitch?: number; phase?: number; groove?: number;
  sheen?: number; sheenA?: number; sweepA?: number; sweepK?: number;
  wedge?: number; data?: number; cast?: number; exp?: number;
  map?: number; detail?: number; lit?: number;
  prog?: number[]; ghost?: number[]; beats?: number[];
}

export class Disc {
  pass: FSPass;
  constructor(tex: THREE.Texture, mask: THREE.Texture) {
    this.pass = new FSPass(DISC, {
      tex: { value: tex }, mask: { value: mask },
      uCam: { value: new THREE.Vector4(0, 0, 1, 0) }, uT: { value: 0 }, uHot: { value: 1 }, uRot: { value: 0 },
      uPitch: { value: 100 }, uPhase: { value: 0 }, uGroove: { value: 1 },
      uSheen: { value: 1 }, uSheenA: { value: 0.6 }, uSweepA: { value: 9 }, uSweepK: { value: 0 },
      uWedge: { value: 1 }, uData: { value: 1 }, uMap: { value: 0 }, uDetail: { value: 0 }, uLit: { value: 1 },
      uProg: { value: new Array(8).fill(0) }, uGhost: { value: new Array(8).fill(0) },
      uBeats: { value: new THREE.Vector4(-9, -9, -9, -9) }, uCast: { value: 1 }, uExp: { value: 1 },
    });
  }
  set(s: DiscState) {
    const u = this.pass.u;
    (u.uCam!.value as THREE.Vector4).set(s.cam.x, s.cam.y, s.cam.z, s.cam.r);
    u.uT!.value = s.t; u.uHot!.value = s.hot ?? 1.2; u.uRot!.value = s.rot ?? 0;
    u.uPitch!.value = s.pitch ?? 60; u.uPhase!.value = s.phase ?? 0; u.uGroove!.value = s.groove ?? 1;
    u.uSheen!.value = s.sheen ?? 1; u.uSheenA!.value = s.sheenA ?? 0.6;
    u.uSweepA!.value = s.sweepA ?? 9; u.uSweepK!.value = s.sweepK ?? 0;
    u.uWedge!.value = s.wedge ?? 1; u.uData!.value = s.data ?? 1; u.uCast!.value = s.cast ?? 1; u.uExp!.value = s.exp ?? 1;
    u.uMap!.value = s.map ?? 0; u.uDetail!.value = s.detail ?? 0; u.uLit!.value = s.lit ?? 1;
    const p = u.uProg!.value as number[], g = u.uGhost!.value as number[];
    for (let i = 0; i < 8; i++) { p[i] = s.prog?.[i] ?? 0; g[i] = s.ghost?.[i] ?? 0; }
    const b = s.beats ?? [-9, -9, -9, -9];
    (u.uBeats!.value as THREE.Vector4).set(b[0] ?? -9, b[1] ?? -9, b[2] ?? -9, b[3] ?? -9);
  }
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget) { this.pass.render(renderer, out); }
}

/** Linear RGB scaled (for LineBatch glows). */
export const lin = (k: PaletteKey, s = 1): [number, number, number] => [LIN[k][0] * s, LIN[k][1] * s, LIN[k][2] * s];
