// world1 — CLIMB (chorus 1 body, after hook1). Structure: P(doom)'s room.ts, shot for shot
// (docs/PDOOM-STRUCTURE.md); imagery: the IFSC speed wall as a 3D wireframe (docs/PLATES.md #2).
//
//  1  "Elevate the human race,"  one exponential shot. The dot (the climber) sits on the first hold
//     where hook1 left it; the wall plots itself out around it. The dot doubles its elevation on
//     every 8th (1, 2, 4, 8 m), passes the 15 m top, and the machine copies the wall on top of
//     itself at twice the size, again and again (a tower of doubling copies); after the peak word
//     the doublings come on 16ths, and the 10th (1,024 m) bursts through the top of the last copy:
//     the plate's one maximal hit. The lyric is handwritten along the hand-drawn route of lane A
//     (the pen tip is the cursor), one word per copy, "race" one letter per copy.
//     "let it wake up on my face": the camera dives back down the tower, one copy per word, and the
//     dot etches each word into the face of its copy (the laser is the cursor), landing on the base
//     wall; the shot burns out into the cut.
//  2–5  the hook repeat, four one-beat shots: a crash dolly onto a hold (WE), a dutch tracking shot
//     (APPRECIATE), a low hero angle (POWER,), each word etched into a hold of lane B; then a punch-in
//     on the finish board as the dot slaps the top pad: the plate's value (≈ 2 kW, briefly).
//  6  "we appreciate power": whip up into a high orbit round the wall top, accelerating; the board
//     flips and the hook is stamped on its back; POWER tears off toward the lens as the orbit tips
//     into a roll, and the dot is left alone at the centre (HANDOFF.pin) for prompt1.
// Every time comes from the lyrics and the beat grid (init). Palette: ink/graphite, bone, signal.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { HEX, LIN, rgba } from '../engine/palette';
import { F, font, layout, measure } from '../engine/type';
import { strokeText, writtenLength, type StrokeText } from '../engine/stroke';
import type { Line, Word } from '../engine/lyrics';
import { clamp, lerp, ease, prog, pulse, springStep, smoothstep, hash, noise1, frameIdx, TAU } from '../engine/util';
import { dot2D, burst2D, HANDOFF } from './_power';
import { sparksAt } from './_shell';
import {
  type V3, type P2, type Segs, type Route, NS, K, Y0, TOP, LEAN, face, HAND, PAD, HOLD_OUT, HOLD_TOP, BOARD,
  KIND, buildSection, buildRoute, routeAt, routeSAtY, laneX,
} from './climb-geo';

type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix3 = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const WHITE: RGB = [1, 1, 1];
const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vsc = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnorm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const clean = (s: string) => s.replace(/[,.?!“”"]/g, '');

/** Pinhole camera: position, orthonormal basis (right, up, forward), focal length in px. */
interface Cam { p: V3; R: V3; U: V3; F: V3; f: number; cx: number; cy: number }
interface Key { p: V3; tg: V3; roll: number; f: number }
/** Anchor framing: world point A appears at screen (sx, sy) at depth 2^ld, orientation yaw/pitch/roll. */
interface Par { A: V3; ld: number; sx: number; sy: number; yaw: number; pitch: number; roll: number; f: number }
interface Shot { t0: number; key: (t: number) => Key; snap: number; kick?: number }
interface Affine { a: number; b: number; c: number; d: number; e: number; f: number }
interface Plane { O: V3; ux: V3; up: V3 }
/** A word laid out on a plane (u across, v up, metres), glyph by glyph, with its etch/stamp window. */
interface Etch { word: Word; text: string; fam: string; cap: number; em: number; g: { ch: string; u: number; v: number; w: number }[]; t0: number; t1: number; plane: (t: number) => Plane | null; sec: number; stamp: boolean; alpha: number }
/** Handwriting along a straight path on the face: StrokeText at 100 px, mapped by em metres. */
interface Script { st: StrokeText; P0: P2; dir: P2; em: number; times: [number, number][]; sec: number; k: number }

const lerpKey = (a: Key, b: Key, k: number): Key => ({ p: vlerp(a.p, b.p, k), tg: vlerp(a.tg, b.tg, k), roll: lerp(a.roll, b.roll, k), f: lerp(a.f, b.f, k) });
const lerpPar = (a: Par, b: Par, k: number): Par => ({ A: vlerp(a.A, b.A, k), ld: lerp(a.ld, b.ld, k), sx: lerp(a.sx, b.sx, k), sy: lerp(a.sy, b.sy, k), yaw: lerp(a.yaw, b.yaw, k), pitch: lerp(a.pitch, b.pitch, k), roll: lerp(a.roll, b.roll, k), f: lerp(a.f, b.f, k) });
const S_PX = 100; // canvas px per em for plane glyphs
const MONO_CAP = 0.698, ARCH_CAP = 0.686;
const FINE = ['Route: IFSC standard · both lanes identical', 'left: drawn by hand · right: copied'];

export default class Climb extends Scene {
  bg = new FSPass(/* glsl */ `
    uniform float gridK, roll, fade;
    uniform vec2 dotP;
    uniform vec4 rings[4];
    uniform vec2 ringI[4];
    void main() {
      vec2 px = FRAG_PX;                                   // logical px, y up
      float y = px.y / 1080.0;
      vec3 g = mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.102, 0.118, 0.114)), y);
      // the sheet's faint engineering grid, turning with the camera's roll
      vec2 c = vec2(960.0, 540.0);
      vec2 q = px - c; float cr = cos(roll), sr = sin(roll);
      q = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr) + c;
      vec2 cell = abs(fract(q / 60.0) - 0.5), major = abs(fract(q / 240.0) - 0.5);
      float gl = (1.0 - smoothstep(0.0, 0.03, 0.5 - max(cell.x, cell.y))) * 0.25
               + (1.0 - smoothstep(0.0, 0.006, 0.5 - max(major.x, major.y))) * 0.5;
      float r = length(px - dotP);
      float reveal = smoothstep(gridK * 2600.0 + 60.0, gridK * 2600.0 - 60.0, r);
      g += toLinear(vec3(0.16, 0.18, 0.17)) * gl * 0.3 * reveal;
      // the hit: shockwave fronts from where the dot broke through
      for (int i = 0; i < 4; i++) {
        if (ringI[i].x <= 0.001) continue;
        vec4 R = rings[i];
        float d = length(px - R.xy) - R.z;
        float front = exp(-d * d / (R.w * R.w));
        float wake = d < 0.0 ? exp(d / (R.w * 12.0)) * 0.05 : 0.0;
        g += mix(C_SIGNAL * 1.4, vec3(1.0), ringI[i].y) * (front * 1.2 + wake) * ringI[i].x;
      }
      g *= 1.0 - fade;
      fragColor = vec4(g, 1.0);
    }`, {
    gridK: { value: 0 }, roll: { value: 0 }, fade: { value: 0 },
    dotP: { value: new THREE.Vector2(W / 2, H * 0.2) },
    rings: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    ringI: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
  });
  ink = new LineBatch(90000, { blend: 'max' }); // bone/graphite wireframe, the hand
  glow = new LineBatch(20000, { blend: 'add' }); // the machine: plotted route, plotter heads, the dot's core
  text = new Layer2D();

  // ---- timing (song seconds), all derived in init()
  private L1!: Line; private L2!: Line;
  private part1: Word[] = []; private part2: Word[] = [];
  private tX = 0; private tF = 0; private tHit = 0; private tDive = 0; private tB = 0; private tEnd = 0;
  private gens: number[] = []; private nF = 0;
  private secT: number[] = [];
  private tb: number[] = [];
  private tPad = 0; private tFlip = 0; private tEsc = 0; private tRoll = 0;

  // ---- world
  private secs: Segs[] = [];
  private routeA!: Route; private routeB!: Route;
  private dot0: V3 = [0, 0, 0];
  private p0: P2 = { x: 0, y: 0 };
  private scripts: Script[] = [];
  private dive: Etch[] = [];
  private hook: Etch[] = [];
  private holdIx = [8, 10, 12]; // lane B holds that carry WE / APPRECIATE / POWER
  private shots: Shot[] = [];
  private stamps: number[] = [];
  private debris: { x: number; y: number; vx: number; vy: number; len: number; a0: number; spin: number }[] = [];
  private debrisOrigin = { x: 0, y: 0 };

  override init() {
    const { lyrics: ly, audio: au, start, end } = this.ctx;
    this.tEnd = end;
    const lines = ly.linesIn(start - 0.3, end + 0.3);
    // the verse line after the hook, and the hook's repeat after it (found by position/confident words)
    this.L1 = lines.find((l) => l.start >= start - 0.3 && !/appreciate/i.test(l.text)) ?? lines[0]!;
    this.L2 = lines.find((l) => l.start > this.L1.start && /appreciate/i.test(l.text)) ?? lines[lines.length - 1]!;
    const w1 = this.L1.words;
    let split = w1.findIndex((w) => /,$/.test(w.w)) + 1;
    if (split <= 1 || split >= w1.length) split = Math.min(4, w1.length - 1);
    this.part1 = w1.slice(0, split);
    this.part2 = w1.slice(split);
    this.tX = Math.max(start, this.part1[0]!.start);
    this.tF = this.part1[this.part1.length - 1]!.start; // the peak word
    this.tDive = this.part2[0]!.start;
    // the hard cut into the hook repeat: the beat nearest its first word (room: nearest "Trapped")
    this.tB = au.nearestBeat(this.L2.words[0]!.start);
    const B0 = Math.round(au.beatAt(this.tB));
    for (let k = 0; k <= 10; k++) this.tb.push(au.timeOfBeat(B0 + k));

    // doublings: 8ths from "Elevate" until the peak word, then 16ths; the 10th is the hit
    this.gens.push(this.tX);
    let b = Math.ceil(au.beatAt(this.tX + 0.15) * 2) / 2;
    let tt = au.timeOfBeat(b);
    while (tt < this.tF - 0.07) { this.gens.push(tt); b += 0.5; tt = au.timeOfBeat(b); }
    this.nF = this.gens.length;
    while (tt < this.tDive - 0.06 && this.gens.length < 11) { this.gens.push(tt); b += 0.25; tt = au.timeOfBeat(b); }
    this.tHit = this.gens[this.gens.length - 1]!;
    // copy s appears on the doubling that first climbs into it
    this.secT = [start];
    for (let s = 1; s < NS; s++) {
      const i = this.gens.findIndex((_, g) => 2 ** g > Y0(s));
      this.secT.push(i >= 0 ? this.gens[i]! - 0.02 : Infinity);
    }

    const w2 = this.L2.words;
    this.tPad = this.tb[3]!;
    this.tFlip = this.tb[4]! - 0.03;
    const lastPow = w2[w2.length - 1]!;
    this.tEsc = lastPow.start + 0.1;
    this.tRoll = this.tb[7]! - 0.05;

    this.secs = Array.from({ length: NS }, (_, s) => buildSection(s));
    this.routeA = buildRoute(0, 0.06, 17);
    this.routeB = buildRoute(1, 0, 0);
    this.p0 = routeAt(this.routeA, routeSAtY(this.routeA, 1));
    this.dot0 = face(this.p0.x, this.p0.y, 0.1);

    this.buildScripts();
    this.buildDive();
    this.buildHook();
    this.stamps = [...this.dive.map((e) => e.t0), ...this.hook.map((e) => e.t0)];
    this.buildShots();
  }

  // ================================================================== layout
  private charTimes(words: Word[]): [number, number][] {
    const out: [number, number][] = [];
    words.forEach((w, wi) => {
      const s = clean(w.w);
      const d = Math.max(0.12, (w.end - w.start) * 0.85);
      for (let i = 0; i < s.length; i++) out.push([w.start + (d * i) / s.length, w.start + (d * (i + 1)) / s.length]);
      if (wi < words.length - 1) out.push([w.end, w.end]);
    });
    return out;
  }

  /** "Elevate" on the base wall, the middle words on the first copy, the peak word a letter per copy. */
  private buildScripts() {
    const words = this.part1;
    const dir = (a: P2, b: P2) => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; };
    const along = (sec: number, text: string, times: [number, number][], a: P2, b: P2, emMax: number) => {
      const k = K(sec);
      const A = { x: a.x * k, y: Y0(sec) + a.y * k }, B = { x: b.x * k, y: Y0(sec) + b.y * k };
      const st = strokeText(text, 'hscript', S_PX);
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      const em = Math.min(emMax * k, (len / st.width) * S_PX);
      this.scripts.push({ st, P0: A, dir: dir(A, B), em, times, sec, k });
    };
    const first = words[0]!;
    along(0, clean(first.w), this.charTimes([first]), { x: -3.22, y: 1.3 }, { x: -3.12, y: 7.0 }, 1.45);
    const mid = words.slice(1, -1);
    if (mid.length) along(1, mid.map((w) => clean(w.w)).join(' '), this.charTimes(mid), { x: -3.22, y: 1.0 }, { x: -3.1, y: 9.5 }, 2.0);
    const peak = words[words.length - 1]!;
    if (words.length > 1) {
      const letters = clean(peak.w);
      for (let j = 0; j < letters.length; j++) {
        const sec = Math.min(NS - 1, 2 + j);
        const tg = this.gens[this.nF + j] ?? peak.start + j * 0.1;
        const t0 = j === 0 ? Math.max(peak.start, tg - 0.02) : tg;
        // upright, in the margin of its copy: r a c e stack up the tower, each twice the last
        const k = K(sec), st = strokeText(letters[j]!, 'hscript', S_PX), em = 6.2 * k;
        const entry = (2 ** Math.min(this.gens.length - 1, this.nF + j) - Y0(sec)) / k; // where the dot enters this copy (local m)
        const v = clamp(entry - 1.2, 0.4, 9);
        this.scripts.push({ st, P0: { x: -3.4 * k - (st.width / S_PX) * em, y: Y0(sec) + v * k }, dir: { x: 1, y: 0 }, em, times: [[t0, t0 + 0.09]], sec, k });
      }
    }
  }

  /** "let it wake up on my face": one word per copy, top copy first, etched across the face. */
  private buildDive() {
    const ws = this.part2, n = ws.length;
    const fam = F.mono(600);
    const onBase: number[] = [];
    ws.forEach((w, i) => {
      const sec = n >= NS ? Math.max(0, NS - 1 - i) : Math.round(((NS - 1) * (n - 1 - i)) / Math.max(1, n - 1));
      if (sec === 0) onBase.push(i);
      const k = K(sec);
      const text = clean(w.w).toUpperCase();
      const cap = 1.6 * k, em = cap / MONO_CAP;
      const lay = layout(text, fam, S_PX);
      const row = sec === 0 ? onBase.length - 1 : 0;
      const vc = sec === 0 ? Y0(0) + 13.6 - 2.8 * row : Y0(sec) + 10.8 * k;
      const wM = (lay.width / S_PX) * em;
      const g = lay.glyphs.map((gl) => ({ ch: gl.ch, u: -wM / 2 + ((gl.x + gl.w / 2) / S_PX) * em, v: vc, w: gl.w }));
      const t1 = w.start + Math.max(0.1, Math.min(0.5, (w.end - w.start) * 0.8));
      this.dive.push({ word: w, text, fam, cap, em, g, t0: w.start, t1, plane: () => ({ O: face(0, 0, 0.02 * k), ux: [1, 0, 0], up: [0, 1, LEAN] }), sec, stamp: false, alpha: 0.9 });
    });
  }

  private holdPlane(ix: number): Plane {
    const [u, v, rot] = HAND[ix]!;
    const r = rot * 0.6;
    const cx = laneX(1, u, 0), cy = v + HOLD_TOP.dy;
    return { O: face(cx, cy, HOLD_OUT + 0.004), ux: vnorm([Math.cos(r), Math.sin(r), Math.sin(r) * LEAN]), up: vnorm([-Math.sin(r), Math.cos(r), Math.cos(r) * LEAN]) };
  }

  /** The hook repeat: three words etched into lane B's holds, the rest stamped on the board's back. */
  private buildHook() {
    const ws = this.L2.words;
    const fam = F.archivo(62, 900);
    ws.forEach((w, i) => {
      const text = clean(w.w).toUpperCase();
      const lay = layout(text, fam, S_PX);
      if (i < 3) {
        const P = this.holdPlane(this.holdIx[i]!);
        const em = Math.min(0.26 / (lay.width / S_PX), 0.11 / ARCH_CAP);
        const cap = em * ARCH_CAP, wM = (lay.width / S_PX) * em;
        const g = lay.glyphs.map((gl) => ({ ch: gl.ch, u: -wM / 2 + ((gl.x + gl.w / 2) / S_PX) * em, v: 0, w: gl.w }));
        const t1 = w.start + Math.max(0.12, Math.min(0.55, (w.end - w.start) * 0.8));
        this.hook.push({ word: w, text, fam, cap, em, g, t0: w.start, t1, plane: () => P, sec: 0, stamp: false, alpha: 1 });
      } else {
        // the board's back: row 1 "WE APPRECIATE", row 2 "POWER" (the last word gets its own row)
        const last = i === ws.length - 1;
        const row1 = ws.slice(3, ws.length - 1).map((x) => clean(x.w).toUpperCase()).join(' ');
        const capR = last ? 0.5 : 0.26;
        const emR = capR / ARCH_CAP;
        const layR = layout(last ? text : row1, fam, S_PX);
        let em = emR;
        if ((layR.width / S_PX) * em > BOARD.hx * 2 - 0.3) em = (BOARD.hx * 2 - 0.3) / (layR.width / S_PX);
        const cap = em * ARCH_CAP;
        const wRow = (layR.width / S_PX) * em;
        // offset of this word inside row 1
        let off = 0;
        if (!last) { const before = ws.slice(3, i).map((x) => clean(x.w).toUpperCase() + ' ').join(''); off = (measure(before, fam, S_PX) / S_PX) * em; }
        const vc = last ? -0.28 : 0.36;
        const g = lay.glyphs.map((gl) => ({ ch: gl.ch, u: -wRow / 2 + off + ((gl.x + gl.w / 2) / S_PX) * em, v: vc, w: gl.w }));
        this.hook.push({ word: w, text, fam, cap, em, g, t0: w.start, t1: w.start + 0.06, plane: (t) => this.boardSide(t, false), sec: 0, stamp: true, alpha: 1 });
      }
    });
  }

  // ================================================================== camera
  /** Continuous doubling index: each doubling snaps in (outExpo); the dot leads, the camera follows. */
  private gAt(t: number, dot: boolean) {
    let g = 0;
    for (let i = 1; i < this.gens.length; i++) {
      const fast = i >= this.nF;
      const dur = dot ? (i === this.gens.length - 1 ? 0.09 : fast ? 0.05 : 0.07) : fast ? 0.11 : 0.17;
      g += ease.outExpo(clamp((t - this.gens[i]!) / dur));
    }
    return g;
  }
  private dotE(t: number) { return 2 ** this.gAt(t, true); }

  private parX(t: number): Par {
    const g = this.gAt(t, false);
    const E = 2 ** g;
    const post = 0.9 * prog(t, this.tHit, this.tHit + 0.3, ease.outCubic);
    const cV = lerp(1.55, 1.08, smoothstep(10, 40, E));
    const V = Math.max(4.8, cV * E) * 2 ** post;
    const f = 1100;
    const xs = lerp(this.p0.x, -0.05 * E, prog(t, this.ctx.start, this.ctx.start + 0.8, ease.inOutCubic));
    const ys = lerp(this.p0.y, E, prog(t, this.ctx.start, this.ctx.start + 0.12));
    const A = face(xs, ys, 0.1);
    const sy = lerp(lerp(H * 0.8, H * 0.5, prog(t, this.ctx.start + 0.03, this.gens[2] ?? this.tF, ease.outCubic)), H * 0.3, prog(t, this.tHit, this.tHit + 0.3, ease.outCubic));
    const yaw = lerp(0.06, 0.42, prog(t, this.ctx.start, this.tHit + 0.3, ease.inOutQuad));
    // the tower tips into a dutch diagonal as the copies start
    const roll = -0.03 + 0.45 * ease.inOutCubic(prog(t, this.gens[3] ?? this.tF, this.gens[5] ?? this.tF));
    return { A, ld: Math.log2((V * f) / H), sx: W / 2, sy, yaw, pitch: 0.16, roll, f };
  }
  /** The dive: one copy per word, top copy first. */
  private parDive(i: number): Par {
    const e = this.dive[i]!;
    const k = K(e.sec);
    const n = this.dive.length;
    const onBase = this.dive.filter((d) => d.sec === 0);
    const lastBase = e.sec === 0 && onBase.length > 1 && e === onBase[onBase.length - 1];
    const vc = lastBase ? (onBase[0]!.g[0]!.v + e.g[0]!.v) / 2 : e.g[0]!.v;
    const V = lastBase ? 12.5 : 9.5 * k;
    const f = 1100;
    return { A: face(0, vc, 0), ld: Math.log2((V * f) / H), sx: W / 2, sy: H * 0.5, yaw: lerp(0.42, 0.06, i / Math.max(1, n - 1)), pitch: 0.1, roll: lerp(0.36, 0.0, ease.outCubic(i / Math.max(1, n - 1))), f };
  }
  private keyShot1(t: number): Key {
    if (t < this.tDive) return this.keyPar(this.parX(t));
    let i = 0;
    while (i + 1 < this.dive.length && t >= this.dive[i + 1]!.t0) i++;
    const e = this.dive[i]!;
    const from = i === 0 ? this.parX(this.tDive) : this.parDive(i - 1);
    const to = this.parDive(i);
    const snap = i === 0 ? 0.22 : 0.15;
    const p = lerpPar(from, to, ease.outExpo(clamp((t - e.t0) / snap)));
    // a slow push while the word is etched; after the last word, the push continues to the cut
    const next = this.dive[i + 1]?.t0 ?? this.tB;
    p.ld -= 0.1 * prog(t, e.t0, next);
    return this.keyPar(p);
  }

  private keyPar(P: Par): Key {
    const Fw = vnorm([-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch)]);
    const R0 = vnorm([-Fw[2], 0, Fw[0]]);
    const U0 = vcross(R0, Fw);
    const c = Math.cos(P.roll), s = Math.sin(P.roll);
    const R = vadd(vsc(R0, c), vsc(U0, s)), U = vsub(vsc(U0, c), vsc(R0, s));
    const d = 2 ** P.ld;
    const xc = ((P.sx - W / 2) * d) / P.f, yc = ((H / 2 - P.sy) * d) / P.f;
    const p = vsub(vsub(vsub(P.A, vsc(R, xc)), vsc(U, yc)), vsc(Fw, d));
    return { p, tg: vadd(p, vsc(Fw, d)), roll: P.roll, f: P.f };
  }

  private boardC(): V3 { return face(0, BOARD.y, BOARD.out); }

  private buildShots() {
    const tb = this.tb;
    const hp = (i: number) => this.holdPlane(this.holdIx[i]!).O;
    const ld = (V: number, f: number) => Math.log2((V * f) / H);
    const parK = (a: Par, b: Par, t0: number, t1: number, e: (x: number) => number, rollSpring?: [number, number]) => (t: number) => {
      const u = e(clamp((t - t0) / (t1 - t0)));
      const p = lerpPar(a, b, u);
      if (rollSpring) p.roll = lerp(a.roll, b.roll, springStep(t - t0, rollSpring[0], rollSpring[1]));
      return this.keyPar(p);
    };
    const A = hp(0), B = hp(1), C = hp(2);
    const bc = this.boardC();
    this.shots = [
      { t0: this.ctx.start, key: (t) => this.keyShot1(t), snap: 0 },
      // "WE": a crash dolly onto the hold, rolling out of a dutch angle on a spring
      { t0: tb[0]!, key: parK({ A, ld: ld(7.5, 1000), sx: W / 2 + 90, sy: H / 2 - 30, yaw: 0.34, pitch: 0.06, roll: -0.5, f: 1000 }, { A, ld: ld(0.62, 1000), sx: W / 2 + 40, sy: H / 2, yaw: 0.2, pitch: 0.02, roll: -0.02, f: 1000 }, tb[0]!, tb[1]!, (x) => 0.8 * ease.outCubic(x) + 0.2 * x, [1.25, 0.36]), snap: 0 },
      // "APPRECIATE": snap, dutch, tracking across the lane
      { t0: tb[1]!, key: parK({ A: vadd(B, [-0.2, -0.04, 0]), ld: ld(0.84, 1000), sx: W / 2, sy: H / 2, yaw: -0.4, pitch: -0.14, roll: 0.14, f: 1000 }, { A: vadd(B, [0.14, 0.03, 0]), ld: ld(0.78, 1000), sx: W / 2, sy: H / 2, yaw: -0.36, pitch: -0.12, roll: 0.09, f: 1000 }, tb[1]!, tb[2]!, ease.linear), snap: 0.13, kick: 0.05 },
      // "POWER,": a low hero angle from below the hold
      { t0: tb[2]!, key: parK({ A: vadd(C, [0, 0.02, 0]), ld: ld(1.1, 1000), sx: W / 2 - 40, sy: H * 0.56, yaw: 0.46, pitch: 0.62, roll: -0.16, f: 1000 }, { A: vadd(C, [0, 0.02, 0]), ld: ld(0.92, 1000), sx: W / 2 - 40, sy: H * 0.55, yaw: 0.42, pitch: 0.6, roll: -0.1, f: 1000 }, tb[2]!, tb[3]!, ease.linear), snap: 0.12, kick: -0.05 },
      // the pad: punch-in on the finish board (focal push)
      { t0: tb[3]!, key: parK({ A: vadd(bc, [0, -0.32, 0]), ld: Math.log2(3.4), sx: W / 2, sy: H / 2, yaw: 0.05, pitch: 0.12, roll: 0.02, f: 1150 }, { A: vadd(bc, [0, -0.32, 0]), ld: Math.log2(3.4), sx: W / 2, sy: H / 2, yaw: 0.04, pitch: 0.12, roll: 0.0, f: 1250 }, tb[3]!, tb[4]!, ease.outCubic), snap: 0.09 },
      // "we appreciate power": whip up into a high orbit round the wall top, tipping into a roll
      { t0: tb[4]!, key: (t) => this.orbitKey(t), snap: 0.16, kick: 0.06 },
    ];
  }

  private orbitKey(t: number): Key {
    const au = this.ctx.audio;
    const u = prog(t, this.tb[4]!, this.tEnd);
    const C = this.boardC();
    const phi = lerp(0.78, -0.8, 0.6 * u + 0.4 * u * u);
    const r = 4.3 - 1.0 * u;
    const p: V3 = vadd(C, [Math.sin(phi) * r, 2.1 - 0.6 * u, Math.cos(phi) * r]);
    const tg: V3 = vadd(C, [0.2 * Math.sin(phi), lerp(-0.55, -0.2, u), 0]);
    const roll = 0.12 * Math.sin(phi) - 1.15 * ease.inCubic(prog(t, this.tRoll, this.tEnd));
    const kick = pulse(t, au.timeOfBeat(Math.floor(au.beatAt(t))), 0.07);
    const breath = Math.sin(Math.PI * (au.beatAt(t) - au.beatAt(this.tb[4]!)));
    return { p, tg, roll, f: 860 * (1 + 0.06 * breath * u + 0.03 * kick) };
  }

  private keyAt(t: number): Key {
    const S = this.shots;
    let i = 0;
    while (i + 1 < S.length && t >= S[i + 1]!.t0) i++;
    const s = S[i]!;
    let k = s.key(t);
    if (i > 0 && s.snap > 0 && t - s.t0 < s.snap) k = lerpKey(S[i - 1]!.key(t), k, ease.outExpo(clamp((t - s.t0) / s.snap)));
    if (s.kick && t >= s.t0) k.roll += s.kick * Math.sin(TAU * 2.6 * (t - s.t0)) * Math.exp(-(t - s.t0) * 6);
    return k;
  }
  private camAt(t: number): Cam {
    const k = this.keyAt(t);
    const Fw = vnorm(vsub(k.tg, k.p));
    const R0 = vnorm([-Fw[2], 0, Fw[0]]);
    const U0 = vcross(R0, Fw);
    const c = Math.cos(k.roll), s = Math.sin(k.roll);
    return { p: k.p, F: Fw, R: vadd(vsc(R0, c), vsc(U0, s)), U: vsub(vsc(U0, c), vsc(R0, s)), f: k.f, cx: W / 2, cy: H / 2 };
  }

  // ================================================================== projection
  private P5 = [0, 0, 0, 0, 0];
  private proj(c: Cam, X: number, Y: number, Z: number): [number, number] | null {
    const rx = X - c.p[0], ry = Y - c.p[1], rz = Z - c.p[2];
    const z = rx * c.F[0] + ry * c.F[1] + rz * c.F[2];
    if (z < 1e-4) return null;
    const x = rx * c.R[0] + ry * c.R[1] + rz * c.R[2], y = rx * c.U[0] + ry * c.U[1] + rz * c.U[2];
    return [c.cx + (c.f * x) / z, c.cy - (c.f * y) / z];
  }
  private projV(c: Cam, p: V3) { return this.proj(c, p[0], p[1], p[2]); }
  private depth(c: Cam, X: number, Y: number, Z: number) { return (X - c.p[0]) * c.F[0] + (Y - c.p[1]) * c.F[1] + (Z - c.p[2]) * c.F[2]; }
  /** Near-clip and project a segment into P[0..3]; false if culled. */
  private clipSeg(c: Cam, ax: number, ay: number, az: number, bx: number, by: number, bz: number, P: number[]): boolean {
    const near = this.near;
    let da = this.depth(c, ax, ay, az), db = this.depth(c, bx, by, bz);
    if (da < near && db < near) return false;
    if (da < near) { const u = (near - da) / (db - da); ax += (bx - ax) * u; ay += (by - ay) * u; az += (bz - az) * u; da = near; }
    else if (db < near) { const u = (near - db) / (da - db); bx += (ax - bx) * u; by += (ay - by) * u; bz += (az - bz) * u; db = near; }
    const pa = this.proj(c, ax, ay, az)!, pb = this.proj(c, bx, by, bz)!;
    P[0] = pa[0]; P[1] = pa[1]; P[2] = pb[0]; P[3] = pb[1]; P[4] = (da + db) / 2;
    const m = 60;
    if ((P[0]! < -m && P[2]! < -m) || (P[0]! > W + m && P[2]! > W + m) || (P[1]! < -m && P[3]! < -m) || (P[1]! > H + m && P[3]! > H + m)) return false;
    return true;
  }
  private near = 0.05;
  private seg3(lb: LineBatch, c: Cam, a: V3, b: V3, w: number, col: RGB, al: number) {
    const P = this.P5;
    if (!this.clipSeg(c, a[0], a[1], a[2], b[0], b[1], b[2], P)) return;
    lb.seg2(P[0]!, P[1]!, P[2]!, P[3]!, w, col, al);
  }
  /** Canvas affine putting canvas point (cx, cy) at world P; canvas x along ux, canvas y along dn (m metres per canvas px). */
  private planeAffine(c: Cam, P: V3, ux: V3, dn: V3, m: number, cx: number, cy: number, scale = 1): Affine | null {
    const d = 10;
    const p0 = this.projV(c, P);
    const pa = this.projV(c, vadd(P, vsc(ux, m * d)));
    const pb = this.projV(c, vadd(P, vsc(dn, m * d)));
    if (!p0 || !pa || !pb) return null;
    if (this.depth(c, P[0], P[1], P[2]) < 0.08) return null;
    const a = ((pa[0] - p0[0]) / d) * scale, b = ((pa[1] - p0[1]) / d) * scale, cc = ((pb[0] - p0[0]) / d) * scale, dd = ((pb[1] - p0[1]) / d) * scale;
    return { a, b, c: cc, d: dd, e: p0[0] - a * cx - cc * cy, f: p0[1] - b * cx - dd * cy };
  }

  // ================================================================== state helpers
  /** Is copy s standing at t? (the copies are gone after the cut) */
  private secOn(s: number, t: number) { return s === 0 ? true : t >= this.secT[s]! && t < this.tB; }
  private plotLevel(s: number, t: number) {
    const k = K(s);
    const fast = this.secT[s]! >= (this.gens[this.nF] ?? Infinity) - 0.03;
    return Y0(s) + 15 * k * ease.outExpo(prog(t, this.secT[s]!, this.secT[s]! + (fast ? 0.09 : 0.13)));
  }
  /** Section 0 unfolds from the first hold at the start. */
  private unfoldR(t: number) { return 26 * ease.outExpo(prog(t, this.ctx.start, this.ctx.start + 0.5)) ** 1.4; }

  private routeFacePt(r: Route, s: number, o: number): V3 {
    const p = routeAt(r, s);
    const sec = Math.max(0, Math.min(NS - 1, Math.floor(Math.log2(p.y / 15 + 1))));
    return face(p.x, p.y, o * K(sec));
  }

  /** The board's visible side as a plane (front or back), rotated by the flip. */
  private boardTh(t: number) {
    let th = t >= this.tFlip ? Math.PI * springStep(t - this.tFlip, 2.3, 0.5) : 0;
    for (const e of this.hook) if (e.stamp && t >= e.t0 && t - e.t0 < 1.2) th += 0.05 * Math.sin((t - e.t0) * 21) * Math.exp(-(t - e.t0) * 6.5);
    return th;
  }
  private boardSide(t: number, front: boolean): Plane {
    const th = this.boardTh(t);
    const up: V3 = [0, Math.cos(th), Math.sin(th)], n: V3 = [0, -Math.sin(th), Math.cos(th)];
    return { O: vadd(this.boardC(), vsc(n, (front ? 1 : -1) * (BOARD.hz + 0.005))), ux: [1, 0, 0], up: front ? up : vsc(up, -1) };
  }
  private boardVisible(t: number) { return t < this.secT[1]! || t >= this.tB; }

  /** Where the dot is: world position (or a screen override at the very end), size and heat. */
  private dotAt(t: number, cam: Cam): { p: V3 | null; scr: [number, number] | null; scale: number; I: number } {
    let p: V3;
    if (t < this.tDive) {
      const E = this.dotE(t);
      const s = routeSAtY(this.routeA, E);
      p = this.routeFacePt(this.routeA, s, 0.1);
    } else if (t < this.tB) {
      p = this.etchPath(this.dive, t, this.dotAtBurst());
    } else {
      p = this.etchPath(this.hook, t, this.hook[0] ? this.etchStart(this.hook[0], t) : this.dot0);
    }
    let scr: [number, number] | null = null;
    if (t >= this.tEsc) {
      const q = this.projV(cam, p);
      const k = prog(t, this.tEsc, this.tEnd - 0.3, ease.inOutCubic);
      if (q) scr = [lerp(q[0], HANDOFF.pin.x, k), lerp(q[1], HANDOFF.pin.y, k)];
      else scr = [HANDOFF.pin.x, HANDOFF.pin.y];
    }
    return { p, scr, scale: 0.8, I: 1 };
  }
  private dotAtBurst(): V3 {
    const s = routeSAtY(this.routeA, this.dotE(this.tDive));
    return this.routeFacePt(this.routeA, s, 0.1);
  }
  private etchPt(e: Etch, i: number, t: number, du = 0): V3 | null {
    const P = e.plane(t);
    if (!P) return null;
    const g = e.g[Math.max(0, Math.min(e.g.length - 1, i))]!;
    return vadd(vadd(P.O, vsc(P.ux, g.u + du)), vsc(P.up, g.v));
  }
  private etchStart(e: Etch, t: number): V3 { return this.etchPt(e, 0, t, -e.em * 0.3) ?? this.dot0; }
  /** The laser: along the glyphs of the word being etched; a fast hop (outExpo) between words. */
  private etchPath(list: Etch[], t: number, before: V3): V3 {
    let i = -1;
    for (let j = 0; j < list.length; j++) if (t >= list[j]!.t0 - 0.1) i = j;
    // the pad slap and the board: special stops of the hook sequence
    if (list === this.hook) {
      const e2 = this.hook[2];
      const e3 = this.hook[3];
      if (e2 && t >= e2.t1 && (!e3 || t < e3.t0 - 0.1)) {
        const padP = face(laneX(1, PAD.u, 0), PAD.v, 0.08);
        const from = this.etchPt(e2, e2.g.length - 1, t, e2.em * 0.4) ?? padP;
        const k = ease.inCubic(prog(t, Math.max(e2.t1, this.tPad - 0.12), this.tPad));
        return vlerp(from, padP, k);
      }
    }
    if (i < 0) return before;
    const e = list[i]!;
    const n = e.g.length;
    const cur = (tt: number): V3 => {
      const u = e.stamp ? 1 : clamp((tt - e.t0) / Math.max(0.01, e.t1 - e.t0));
      const x = u * n;
      const gi = Math.min(n - 1, Math.floor(x));
      const fr = x - gi;
      const a = this.etchPt(e, gi, t, -e.em * 0.25 + fr * e.em * 0.55);
      return a ?? before;
    };
    const target = t < e.t0 ? this.etchStart(e, t) : cur(t);
    const prevEnd = i === 0 ? before : (() => { const pe = list[i - 1]!; return this.etchPt(pe, pe.g.length - 1, t, pe.em * 0.35) ?? before; })();
    const from = list === this.hook && i === 3 ? face(laneX(1, PAD.u, 0), PAD.v, 0.08) : prevEnd;
    const k = ease.outExpo(clamp((t - (e.t0 - 0.1)) / 0.1));
    return vlerp(from, target, k);
  }

  // ================================================================== render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t;
    const cam = this.camAt(t);
    this.near = t < this.tB ? Math.max(0.05, cam.p[1] * 0.002) : 0.03;
    this.ink.clear(); this.glow.clear();
    const L = this.text; L.clear();
    const c = L.ctx;
    const dot = this.dotAt(t, cam);
    const fadeOut = ease.inCubic(prog(t, this.tEnd - 0.42, this.tEnd - 0.05));
    const worldA = 1 - fadeOut;

    // ---- wireframe
    for (let s = 0; s < NS; s++) if (this.secOn(s, t)) this.drawSection(cam, t, s, worldA);
    this.drawRoutes(cam, t, worldA);
    this.drawScripts(c, cam, t, worldA);
    if (t >= this.tB) this.drawBoltGrid(cam, t, worldA);
    if (this.boardVisible(t)) this.drawBoardLines(cam, t, worldA);
    this.drawDebris(t);

    // ---- paper: etchings, the board, readouts
    c.save();
    // (the dive's words are hidden in the hook's close-ups, where they would only be giant fragments)
    if (t < this.tB || t >= this.tb[4]!) this.drawEtches(c, cam, t, this.dive, worldA);
    this.drawEtches(c, cam, t, this.hook.slice(0, 3), worldA);
    this.drawFine(c, cam, t);
    if (this.boardVisible(t)) this.drawBoard(c, cam, t, worldA);
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.drawReadouts(c, cam, t, dot);
    this.drawTags(c, cam, t);
    this.drawPower(c, t);
    this.drawDot(c, cam, t, dot);
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);

    // ---- ground
    const u = this.bg.u;
    u.gridK!.value = prog(t, this.ctx.start, this.ctx.start + 0.6, ease.outCubic);
    u.roll!.value = this.keyAt(t).roll;
    u.fade!.value = Math.max(1 - ease.outCubic(prog(t, this.ctx.start, this.ctx.start + 0.4)), 0.65 * fadeOut);
    const dp = dot.scr ?? (dot.p ? this.projV(cam, dot.p) : null) ?? [W / 2, H / 2];
    (u.dotP!.value as THREE.Vector2).set(dp[0], H - dp[1]);
    this.setRings(t);
    this.bg.render(renderer, out);
    this.ink.render(renderer, out);
    this.glow.render(renderer, out);
    comp.draw(renderer, L.upload(), out);

    // ---- post: the hit is the only shake; beat punches otherwise
    const hitK = t >= this.tHit ? pulse(t, this.tHit, 0.1) : 0;
    let stampK = 0;
    for (const s of this.stamps) if (t >= s) stampK = Math.max(stampK, pulse(t, s, 0.06));
    const beatP = t < this.tB && t > this.tX + 0.1 ? pulse(t, au.timeOfBeat(Math.floor(au.beatAt(t) * 2) / 2), 0.06) : 0;
    const padK = t >= this.tPad ? pulse(t, this.tPad, 0.08) : 0;
    const snare = au.events('snare', this.tb[4]!, this.tEnd).reduce((m, [ts]) => (t >= ts ? Math.max(m, pulse(t, ts, 0.07)) : m), 0);
    const sh = 16 * hitK;
    const burn = t < this.tB ? 1.6 * Math.pow(smoothstep(this.tB - 0.12, this.tB, t), 2) : 0;
    const cutPop = t >= this.tB ? 0.3 * pulse(t, this.tB, 0.035) : 0;
    const o: PostOverrides = {
      bloom: 0.62, bloomThreshold: 0.92, bloomKnee: 0.4, halation: 0.22,
      exposure: 1 + 0.9 * (t >= this.tHit ? pulse(t, this.tHit, 0.03) : 0) + burn + cutPop + 0.25 * padK,
      shake: [noise1(t * 60, 1) * sh, noise1(t * 60, 2) * sh],
      zoom: 1 + 0.028 * (t >= this.tHit ? pulse(t, this.tHit, 0.15) : 0) + 0.012 * stampK + 0.01 * beatP + 0.02 * padK + 0.018 * snare,
      ca: 0.6 + 2.5 * (t >= this.tHit ? pulse(t, this.tHit, 0.15) : 0),
      vignette: 0.4, grain: 0.055,
    };
    if (t >= this.tEnd - 0.1) { o.shake = [0, 0]; o.zoom = 1; o.ca = 0.5; }
    return o;
  }

  private setRings(t: number) {
    const RV = this.bg.u.rings!.value as THREE.Vector4[], RI = this.bg.u.ringI!.value as THREE.Vector2[];
    const au = this.ctx.audio;
    const b0 = au.beatAt(this.tHit);
    for (let i = 0; i < 4; i++) {
      if (i >= 0) { RI[i]!.set(0, 0); continue; } // (no rings: the tower itself flashes on the hit)
      const te = au.timeOfBeat(b0 + i / 4);
      const age = t - te;
      if (age < 0 || age > 1.3 || t >= this.tB) { RI[i]!.set(0, 0); continue; }
      const cam = this.camAt(te);
      const d = this.dotAt(te, cam);
      const q = d.p ? this.projV(cam, d.p) : null;
      if (!q) { RI[i]!.set(0, 0); continue; }
      const r = 20 + 2400 * (1 - Math.exp(-age * 2.4));
      RV[i]!.set(q[0], H - q[1], r, 10 + 70 * Math.exp(-age * 3));
      RI[i]!.set(0.3 * Math.exp(-age * 3.2), Math.exp(-age * 30));
    }
  }

  // ------------------------------------------------------------------ wireframe
  private drawSection(cam: Cam, t: number, s: number, alphaMul: number) {
    const S = this.secs[s]!;
    const k = K(s);
    // level of detail from the copy's height on screen
    const pb = this.projV(cam, face(0, Y0(s))), pt = this.projV(cam, face(0, TOP(s)));
    const hPx = pb && pt ? Math.hypot(pb[0] - pt[0], pb[1] - pt[1]) : 4000;
    const lodAll = smoothstep(3, 18, hPx) * alphaMul;
    if (lodAll <= 0.01) return;
    const lodD = smoothstep(60, 220, hPx);
    const unfold = s === 0 ? this.unfoldR(t) : 0;
    const level = s === 0 ? Infinity : this.plotLevel(s, t);
    const P = this.P5, sg = S.s;
    const bone = mul(LIN.bone, 0.8), graph = mul(LIN.graphite, 1.6);
    const hot = mul(LIN.signal, 2.2);
    const burst = s === NS - 1 && t >= this.tHit;
    // the hit flashes the tower; the shot burns out through its lines into the cut
    const flash = t >= this.tHit && t < this.tB ? Math.max(pulse(t, this.tHit, 0.07), smoothstep(this.tB - 0.13, this.tB - 0.01, t)) : 0;
    const xb = this.dotAtBurst()[0];
    for (let i = 0; i < S.n; i++) {
      const kind = S.k[i]!;
      const detail = kind === KIND.HOLD || kind === KIND.FOOT || kind === KIND.PANEL || kind === KIND.PAD || kind === KIND.BACK;
      if (detail && lodD <= 0.02) continue;
      let a = S.a[i]! * (detail ? lodD : 1) * lodAll;
      let heat = 0;
      if (s === 0) {
        if (t < this.ctx.start + 0.6) {
          const d = S.d0[i]!;
          if (d > unfold) continue;
          heat = 0.6 * smoothstep(2.5, 0, unfold - d);
        }
      } else {
        const ym = S.ym[i]!;
        if (ym > level) continue;
        heat = smoothstep(2.0 * k, 0, level - ym) * (level < Y0(s) + 15 * k - 0.01 ? 1 : 0);
      }
      const o = i * 6;
      if (burst && i === 1) {
        // the top rail of the last copy, broken where the dot went through
        const gap = 14 * k / 32 * 2.2;
        this.seg3(this.ink, cam, [sg[o]!, sg[o + 1]!, sg[o + 2]!], [xb - gap, sg[o + 1]!, sg[o + 2]!], S.w[i]!, bone, a);
        this.seg3(this.ink, cam, [xb + gap, sg[o + 4]!, sg[o + 5]!], [sg[o + 3]!, sg[o + 4]!, sg[o + 5]!], S.w[i]!, bone, a);
        continue;
      }
      if (!this.clipSeg(cam, sg[o]!, sg[o + 1]!, sg[o + 2]!, sg[o + 3]!, sg[o + 4]!, sg[o + 5]!, P)) continue;
      const col = kind === KIND.BACK ? graph : bone;
      if (P[4]! < 0.6 && t >= this.tB) a *= smoothstep(0.03, 0.6, P[4]!); // lines grazing the lens fade
      this.ink.seg2(P[0]!, P[1]!, P[2]!, P[3]!, S.w[i]!, col, a);
      heat = Math.max(heat, flash);
      if (heat > 0.02) this.glow.seg2(P[0]!, P[1]!, P[2]!, P[3]!, S.w[i]! + 0.6, hot, heat * lodAll);
    }
    // the plotter's gantry sweeping up a new copy
    if (s > 0 && level < Y0(s) + 15 * k - 0.01) {
      const a = face(-3.3 * k, level), b = face(3.3 * k, level);
      this.seg3(this.glow, cam, a, b, 2.2, mul(LIN.signal, 3.5), lodAll);
      this.seg3(this.glow, cam, a, b, 7, mul(LIN.signal, 0.6), lodAll);
    }
  }

  private drawRoutes(cam: Cam, t: number, alphaMul: number) {
    const fb = Math.floor(frameIdx(t) / 3);
    const bone = mul(LIN.bone, 0.92);
    const blue = mul(LIN.signal, 1.8);
    // how far the hand's line (lane A, drawn by the dot) and the plotter's copy (lane B) have got on the base wall
    const Ed = t < this.tDive ? this.dotE(t) : 1e9;
    const sA = t < this.ctx.start + 0.02 ? 0 : routeSAtY(this.routeA, Math.min(Ed, 15.5));
    const Ep = t < this.tDive ? 2 ** this.gAt(t - 0.06, true) : 1e9;
    const lodAt = (sec: number) => {
      const pb = this.projV(cam, face(0, Y0(sec))), pt = this.projV(cam, face(0, TOP(sec)));
      const h = pb && pt ? Math.hypot(pb[0] - pt[0], pb[1] - pt[1]) : 4000;
      return smoothstep(3, 18, h);
    };
    const lods = Array.from({ length: NS }, (_, s) => (this.secOn(s, t) ? lodAt(s) : 0));
    for (const [r, hand] of [[this.routeA, true], [this.routeB, false]] as const) {
      let prev: V3 | null = null;
      for (let i = 0; i < r.n; i++) {
        const sec = r.sec[i]!;
        const y = r.y[i]!;
        let on = lods[sec]! > 0;
        if (sec === 0) on = hand ? r.s[i]! <= sA : y <= Math.min(Ep, 15.5) && t >= this.ctx.start + 0.05;
        else if (on && y > this.plotLevel(sec, t)) on = false;
        if (y > TOP(NS - 1)) on = false;
        if (!on) { prev = null; continue; }
        const k = K(sec);
        let x = r.x[i]!, yy = y;
        if (hand) { x += (hash(i, fb, 3) - 0.5) * 0.03 * k; yy += (hash(i, fb, 4) - 0.5) * 0.03 * k; }
        const p = face(x, yy, 0.03 * k);
        if (prev) {
          const a = lods[sec]! * alphaMul;
          if (hand) this.seg3(this.ink, cam, prev, p, 2.0, bone, a);
          else this.seg3(this.glow, cam, prev, p, 1.3, blue, a);
        }
        prev = p;
      }
    }
    // the hand's line still being drawn: close the gap to the dot
    if (t < this.tDive && t >= this.ctx.start + 0.02 && Ed < 15.5) {
      const q = routeAt(this.routeA, sA);
      const end = face(q.x, q.y, 0.03);
      const d = this.dotAt(t, cam).p;
      if (d) this.seg3(this.ink, cam, end, d, 2.0, bone, alphaMul);
    }
    // the plotter head copying lane A onto lane B
    if (t < this.secT[1]! + 0.1 && t >= this.ctx.start + 0.05) {
      const sB = routeSAtY(this.routeB, Math.min(Ep, 14.7));
      const q = routeAt(this.routeB, sB);
      const hp = this.projV(cam, face(q.x, q.y, 0.03));
      if (hp) {
        const g = mul(LIN.signal, 4);
        this.glow.seg2(hp[0] - 9, hp[1], hp[0] + 9, hp[1], 1.4, g, 1);
        this.glow.seg2(hp[0], hp[1] - 9, hp[0], hp[1] + 9, 1.4, g, 1);
        this.glow.seg2(hp[0], hp[1], hp[0] + 0.01, hp[1], 10, mul(LIN.signal, 0.9), 0.8);
      }
    }
  }

  /** Handwriting along lane A: strokes mapped onto the face (the pen is the cursor). */
  private drawScripts(c: CanvasRenderingContext2D, cam: Cam, t: number, alphaMul: number) {
    const fb = Math.floor(frameIdx(t) / 3);
    const bone = mul(LIN.bone, 0.95);
    for (let si = 0; si < this.scripts.length; si++) {
      const sc = this.scripts[si]!;
      if (!this.secOn(sc.sec, t)) continue;
      const len = writtenLength(sc.st, sc.times, t);
      if (len <= 0) continue;
      const m = sc.em / S_PX;
      const nx = -sc.dir.y, ny = sc.dir.x;
      const map = (x: number, y: number, j: number): V3 => {
        const jx = (hash(si, j, fb) - 0.5) * 0.8, jy = (hash(si, j, fb, 9) - 0.5) * 0.8;
        const X = sc.P0.x + sc.dir.x * (x + jx) * m + nx * -(y + jy) * m;
        const Y = sc.P0.y + sc.dir.y * (x + jx) * m + ny * -(y + jy) * m;
        return face(X, Y, 0.03 * sc.k);
      };
      let head: V3 | null = null;
      const st = sc.st;
      const w = sc.st.charOf.length && sc.times.length === 1 ? 3.2 : sc.sec === 0 ? 2.2 : 2.4;
      for (let i = 0; i < st.strokes.length; i++) {
        const s0 = st.startLen[i]!;
        if (s0 >= len) break;
        const pts = st.strokes[i]!, Ls = st.lens[i]!;
        let prev = map(pts[0]!.x, pts[0]!.y, i * 97);
        for (let j = 1; j < pts.length; j++) {
          if (Ls[j]! > len - s0) {
            const u = (len - s0 - Ls[j - 1]!) / Math.max(1e-6, Ls[j]! - Ls[j - 1]!);
            if (u > 0) {
              const a = pts[j - 1]!, b = pts[j]!;
              const q = map(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, i * 97 + j);
              this.seg3(this.ink, cam, prev, q, w, bone, alphaMul);
              head = q;
            }
            break;
          }
          const q = map(pts[j]!.x, pts[j]!.y, i * 97 + j);
          this.seg3(this.ink, cam, prev, q, w, bone, alphaMul);
          prev = q; head = q;
        }
      }
      // the pen tip while writing
      const tEndW = sc.times[sc.times.length - 1]![1];
      if (head && t < tEndW + 0.04) {
        const h = this.projV(cam, head);
        if (h) {
          c.save();
          c.fillStyle = rgba('bone', 0.95);
          c.beginPath(); c.arc(h[0], h[1], 3.2, 0, TAU); c.fill();
          c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1;
          c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0] + 16, h[1] - 22); c.stroke();
          c.restore();
        }
      }
    }
  }

  /** Close shots: the panels' bolt-hole grid (125 mm) around the framed spot. */
  private drawBoltGrid(cam: Cam, t: number, alphaMul: number) {
    const centre = this.keyAt(t).tg;
    const d = Math.hypot(centre[0] - cam.p[0], centre[1] - cam.p[1], centre[2] - cam.p[2]);
    if (d > 4) return;
    const a = smoothstep(4, 1.5, d) * 0.5 * alphaMul;
    const cx = Math.round(centre[0] / 0.125) * 0.125, cy = Math.round(centre[1] / 0.125) * 0.125;
    const col = mul(LIN.graphite, 1.8);
    const n = 11, e = 0.012;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const x = cx + i * 0.125, y = cy + j * 0.125;
      if (Math.abs(x) > 3 || y < 0 || y > 15) continue;
      this.seg3(this.ink, cam, face(x - e, y), face(x + e, y), 1, col, a);
      this.seg3(this.ink, cam, face(x, y - e), face(x, y + e), 1, col, a);
    }
  }

  private boardCorners(t: number): V3[] {
    const th = this.boardTh(t);
    const C = this.boardC();
    const up: V3 = [0, Math.cos(th), Math.sin(th)], n: V3 = [0, -Math.sin(th), Math.cos(th)];
    const out: V3[] = [];
    for (const sz of [1, -1]) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) out.push(vadd(vadd(vadd(C, [sx * BOARD.hx, 0, 0]), vsc(up, sy * BOARD.hy)), vsc(n, sz * BOARD.hz)));
    return out;
  }
  private drawBoardLines(cam: Cam, t: number, alphaMul: number) {
    const q = this.boardCorners(t);
    const bone = mul(LIN.bone, 0.75);
    for (let i = 0; i < 4; i++) {
      this.seg3(this.ink, cam, q[i]!, q[(i + 1) % 4]!, 1.3, bone, alphaMul);
      this.seg3(this.ink, cam, q[4 + i]!, q[4 + ((i + 1) % 4)]!, 1.3, bone, alphaMul);
      this.seg3(this.ink, cam, q[i]!, q[4 + i]!, 1.2, bone, alphaMul);
    }
    // hangers from the top rail
    for (const x of [-1.2, 1.2]) this.seg3(this.ink, cam, face(x, 15, 0), vadd(this.boardC(), [x, -BOARD.hy * Math.cos(this.boardTh(t)), -BOARD.hy * Math.sin(this.boardTh(t))]), 1.1, mul(LIN.bone, 0.5), alphaMul);
  }

  private drawDebris(t: number) {
    if (t < this.tHit || t > this.tHit + 0.7 || t >= this.tB) return;
    if (!this.debris.length) {
      const cam = this.camAt(this.tHit);
      const p = this.projV(cam, face(this.dotAtBurst()[0], TOP(NS - 1)));
      if (!p) return;
      this.debrisOrigin = { x: p[0], y: p[1] };
      for (let i = 0; i < 26; i++) {
        const a = -Math.PI / 2 + (hash(i, 41) - 0.5) * 2.4;
        const sp = 500 + 1300 * hash(i, 42);
        this.debris.push({ x: (hash(i, 43) - 0.5) * 60, y: (hash(i, 44) - 0.5) * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, len: 8 + 22 * hash(i, 45), a0: hash(i, 46) * TAU, spin: (hash(i, 47) - 0.5) * 18 });
      }
    }
    const age = t - this.tHit;
    for (const d of this.debris) {
      const life = 0.35 + 0.35 * ((d.len - 8) / 22);
      if (age > life) continue;
      const k = 1 - age / life;
      const tau = (1 - Math.exp(-age * 4)) / 4;
      const x = this.debrisOrigin.x + d.x + d.vx * tau, y = this.debrisOrigin.y + d.y + d.vy * tau + 500 * age * age;
      const an = d.a0 + d.spin * tau;
      const hx = Math.cos(an) * d.len / 2, hy = Math.sin(an) * d.len / 2;
      const hot = Math.exp(-age / 0.06);
      this.ink.seg2(x - hx, y - hy, x + hx, y + hy, 1.6, mix3(mul(LIN.bone, 0.8), WHITE, hot), Math.min(1, k * 1.4));
      if (hot > 0.1) this.glow.seg2(x - hx, y - hy, x + hx, y + hy, 2.4, mul(LIN.signal, 3 * hot), 1);
    }
  }

  // ------------------------------------------------------------------ paper
  private drawEtches(c: CanvasRenderingContext2D, cam: Cam, t: number, list: Etch[], alphaMul: number) {
    for (const e of list) {
      if (t < e.t0) continue;
      if (e.sec > 0 && !this.secOn(e.sec, t)) continue;
      const P = e.plane(t);
      if (!P) continue;
      const dn = vsc(P.up, -1);
      const m = e.em / S_PX;
      const capPx = e.cap / m;
      c.font = font(e.fam, S_PX);
      const n = e.g.length;
      for (let i = 0; i < n; i++) {
        const ti = e.stamp ? e.t0 : e.t0 + ((e.t1 - e.t0) * i) / n;
        if (t < ti) break;
        const g = e.g[i]!;
        const W3 = vadd(vadd(P.O, vsc(P.ux, g.u)), vsc(P.up, g.v));
        const age = t - ti;
        const lift = e.stamp ? 1 + 0.7 * (1 - ease.outExpo(clamp(age / 0.12))) : 1;
        const A = this.planeAffine(cam, W3, P.ux, dn, m, g.w / 2, -capPx / 2, lift);
        if (!A) continue;
        const sz = Math.hypot(A.c, A.d) * capPx;
        const big = 1 - smoothstep(360, 760, sz);
        if (big <= 0.01) continue;
        c.setTransform(A.a, A.b, A.c, A.d, A.e, A.f);
        const hot = Math.exp(-age / 0.05);
        const cool = prog(t, ti + 0.05, ti + 0.35);
        const recede = e.sec >= 0 && list === this.dive && t >= this.tB ? 0.5 : 1;
        c.globalAlpha = clamp(age / 0.02) * e.alpha * alphaMul * big * recede;
        c.fillStyle = hot > 0.35 ? '#EEF2FF' : cool < 1 ? mixCss(HEX.signal, HEX.bone, cool) : rgba('bone', 0.92);
        c.fillText(g.ch, 0, 0);
      }
      c.globalAlpha = 1;
      c.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  /** The fine print, stencilled on the base wall's kickboard as the wall plots out. */
  private drawFine(c: CanvasRenderingContext2D, cam: Cam, t: number) {
    if (t > this.secT[1]!) return;
    const fam = F.mono(400);
    const cap = 0.085, em = cap / MONO_CAP, m = em / S_PX;
    c.font = font(fam, S_PX);
    FINE.forEach((line, li) => {
      const w = measure(line, fam, S_PX);
      const v = 0.42 - li * 0.2;
      const n = Array.from(line).length;
      const typed = Math.floor(n * prog(t, this.ctx.start + 0.06 + li * 0.12, this.ctx.start + 0.4 + li * 0.12));
      if (typed <= 0) return;
      const P = face(0, v, 0.01);
      const A = this.planeAffine(cam, P, [1, 0, 0], [0, -1, -LEAN], m, w / 2, -cap / m / 2);
      if (!A) return;
      c.setTransform(A.a, A.b, A.c, A.d, A.e, A.f);
      c.fillStyle = rgba('ash', 0.85);
      c.fillText(line.slice(0, typed), 0, 0);
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** The finish board: its visible face filled (it hides what is behind it), the timer / the stamped hook. */
  private drawBoard(c: CanvasRenderingContext2D, cam: Cam, t: number, alphaMul: number) {
    const th = this.boardTh(t);
    const C = this.boardC();
    const nA: V3 = [0, -Math.sin(th), Math.cos(th)];
    const front = vdot(nA, vsub(cam.p, C)) > 0;
    const P = this.boardSide(t, front);
    const nn = front ? nA : vsc(nA, -1);
    const O = vadd(C, vsc(nn, BOARD.hz));
    const at = (u: number, v: number): V3 => vadd(vadd(O, vsc(P.ux, u)), vsc(P.up, v));
    const pc = [at(-BOARD.hx, -BOARD.hy), at(BOARD.hx, -BOARD.hy), at(BOARD.hx, BOARD.hy), at(-BOARD.hx, BOARD.hy)].map((p) => this.projV(cam, p));
    if (pc.some((q) => !q)) return;
    c.save();
    c.globalAlpha = alphaMul;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.beginPath();
    pc.forEach((q, i) => (i ? c.lineTo(q![0], q![1]) : c.moveTo(q![0], q![1])));
    c.closePath();
    c.fillStyle = rgba('ink2', 0.985);
    c.fill();
    const padK = t >= this.tPad ? pulse(t, this.tPad, 0.1) : 0;
    c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1.4 + 1.5 * padK;
    c.stroke();
    const dn = vsc(P.up, -1);
    const txt = (s: string, fam: string, cap: number, u: number, v: number, col: string, align: 'l' | 'c' | 'r' = 'c') => {
      const em = cap / (fam.startsWith('Plex') ? MONO_CAP : ARCH_CAP), m = em / S_PX;
      c.font = font(fam, S_PX);
      const w = measure(s, fam, S_PX);
      const cx = align === 'c' ? w / 2 : align === 'r' ? w : 0;
      const A = this.planeAffine(cam, at(u, v), P.ux, dn, m, cx, -cap / m / 2);
      if (!A) return;
      c.setTransform(A.a, A.b, A.c, A.d, A.e, A.f);
      c.fillStyle = col;
      c.fillText(s, 0, 0);
      c.setTransform(1, 0, 0, 1, 0, 0);
    };
    if (front) {
      txt('IFSC · SPEED · 15 m', F.mono(500), 0.06, -BOARD.hx + 0.14, BOARD.hy - 0.13, rgba('ash', 0.9), 'l');
      txt('A', F.mono(500), 0.06, -BOARD.hx + 0.14, 0.18, rgba('ash', 0.9), 'l');
      txt('B', F.mono(500), 0.06, BOARD.hx - 0.14, 0.18, rgba('ash', 0.9), 'r');
      const on = t >= this.tPad;
      const lock = on ? ease.outExpo(prog(t, this.tPad, this.tPad + 0.1)) : 0;
      const shown = on ? (lock < 1 ? (4.2 + 0.8 * lock).toFixed(2) : '5.00') : '–.––';
      txt(shown, F.mono(500), 0.4, -0.05, 0.2, on ? (padK > 0.5 ? '#EEF2FF' : rgba('bone', 0.95)) : rgba('graphite', 0.9));
      txt('s', F.mono(400), 0.12, 0.72, 0.06, rgba('ash', on ? 0.9 : 0.4), 'l');
      if (on) {
        const k1 = prog(t, this.tPad + 0.05, this.tPad + 0.1), k2 = prog(t, this.tPad + 0.1, this.tPad + 0.16);
        if (k1 > 0) txt('70 kg · 15 m · 5 s', F.mono(400), 0.085, 0, -0.24, rgba('bone', 0.85 * k1));
        if (k2 > 0) {
          const s1 = '≈ ', s2 = '2 kW', s3 = ' (briefly) · Kardashev −0.27';
          const fam = F.mono(600), cap = 0.11, em = cap / MONO_CAP, m = em / S_PX;
          const w1 = measure(s1, fam, S_PX), w2 = measure(s2, fam, S_PX), w3 = measure(s3, F.mono(400), S_PX);
          const x0 = -((w1 + w2 + w3) * m) / 2;
          txt(s1, fam, cap, x0, -0.49, rgba('bone', k2), 'l');
          txt(s2, fam, cap, x0 + w1 * m, -0.49, rgba('signal', k2), 'l');
          txt(s3, F.mono(400), cap * 0.9, x0 + (w1 + w2) * m, -0.49, rgba('ash', k2), 'l');
        }
      }
    } else {
      this.drawEtches(c, cam, t, this.hook.slice(3).filter((e) => t < this.tEsc || e !== this.hook[this.hook.length - 1]), alphaMul);
    }
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** The elevation, beside the dot on every doubling; the hit's number, big. */
  private drawReadouts(c: CanvasRenderingContext2D, cam: Cam, t: number, dot: { p: V3 | null }) {
    if (t < this.tX || t >= this.tDive + 0.02 || !dot.p) return;
    const q = this.projV(cam, dot.p);
    if (!q) return;
    let g = 0;
    for (let i = 0; i < this.gens.length; i++) if (t >= this.gens[i]!) g = i;
    const E = 2 ** g;
    const tg = this.gens[g]!;
    const hitG = g === this.gens.length - 1 && this.gens.length >= 2;
    c.save();
    if (!hitG) {
      // an event label: in on the doubling, out before the next one on the 8ths
      const a = prog(t, tg, tg + 0.02) * (1 - prog(t, tg + 0.2, tg + 0.26));
      const fl = pulse(t, tg, 0.05);
      const x0 = q[0] + 16, y0 = q[1] - 14;
      c.globalAlpha = a;
      c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 26, y0 - 26); c.lineTo(x0 + 130, y0 - 26); c.stroke();
      c.font = font(F.mono(500), 30);
      c.fillStyle = fl > 0.4 ? rgba('signal') : rgba('bone', 0.95);
      c.fillText(`${E.toLocaleString('en-US')} m`, x0 + 32, y0 - 36);
      if (E > 15 && E < 64) {
        c.font = font(F.mono(400), 13);
        c.fillStyle = rgba('ash', 0.85);
        c.fillText('past the top · 15 m', x0 + 32, y0 - 8);
      }
    } else {
      const age = t - tg;
      const slam = springStep(age, 3.2, 0.35);
      const out = prog(t, this.tDive - 0.12, this.tDive + 0.01, ease.inCubic);
      c.globalAlpha = 1 - out;
      const x0 = q[0] + 30, y0 = q[1] + 8;
      c.translate(x0, y0); c.scale(0.7 + 0.3 * slam, 0.7 + 0.3 * slam);
      c.strokeStyle = rgba('bone', 0.7); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-14, -8); c.lineTo(20, -60); c.lineTo(420, -60); c.stroke();
      c.font = font(F.mono(600), 92);
      c.fillStyle = age < 0.06 ? '#EEF2FF' : rgba('bone', 0.97);
      c.fillText(`${E.toLocaleString('en-US')} m`, 26, -76);
      c.font = font(F.mono(400), 18);
      c.fillStyle = rgba('ash', 0.95);
      c.fillText(`top of the wall: ${TOP(NS - 1).toLocaleString('en-US')} m`, 28, -32);
    }
    c.restore();
  }

  /** Numeral flashes on events: each copy's elevation as its word is etched on the way down; each
   * hold's number and height on the hard cuts of the hook repeat (~7 frames). */
  private drawTags(c: CanvasRenderingContext2D, cam: Cam, t: number) {
    const tag = (x: number, y: number, big: string, small: string, a: number, dx = 1) => {
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * 22, y + 22); c.lineTo(x + dx * 150, y + 22); c.stroke();
      c.font = font(F.mono(500), 22);
      c.fillStyle = rgba('bone', 0.95);
      c.textAlign = dx > 0 ? 'left' : 'right';
      c.fillText(big, x + dx * 28, y + 16);
      c.font = font(F.mono(400), 12);
      c.fillStyle = rgba('ash', 0.9);
      c.fillText(small, x + dx * 28, y + 40);
      c.restore();
    };
    if (t >= this.tDive && t < this.tB) {
      for (const e of this.dive) {
        if (t < e.t0 || t > e.t0 + 0.32) continue;
        const P = e.plane(t)!;
        const g0 = e.g[0]!;
        const q = this.projV(cam, vadd(vadd(P.O, vsc(P.ux, g0.u - e.em * 0.45)), vsc(P.up, g0.v - e.cap * 0.62)));
        if (!q) continue;
        const a = prog(t, e.t0, e.t0 + 0.02) * (1 - prog(t, e.t0 + 0.24, e.t0 + 0.32));
        tag(q[0], q[1], `${Math.round(g0.v).toLocaleString('en-US')} m`, e.sec > 0 ? `copy ${e.sec} · ×${K(e.sec)}` : 'the wall · ×1', a, -1);
      }
    }
    if (t >= this.tB && t < this.tb[3]!) {
      const i = Math.min(2, Math.floor((t - this.tB) / Math.max(0.1, this.tb[1]! - this.tb[0]!)));
      const t0 = this.tb[i]!;
      if (t - t0 < 7 / 60) {
        const ix = this.holdIx[i]!;
        const q = this.projV(cam, this.holdPlane(ix).O);
        if (q) tag(q[0] + 30, q[1] - 70, `B-${String(ix + 1).padStart(2, '0')}`, `${HAND[ix]![1].toFixed(2)} m · lane B`, 1);
      }
    }
  }

  /** POWER tears off the board toward the lens (room's SHROOMS). */
  private drawPower(c: CanvasRenderingContext2D, t: number) {
    const e = this.hook[this.hook.length - 1];
    if (!e || !e.stamp || t < this.tEsc) return;
    c.font = font(e.fam, S_PX);
    const m0 = e.em / S_PX;
    const capPx = e.cap / m0;
    for (let echo = 3; echo >= 0; echo--) {
      const te = t - echo * 0.03;
      if (te < this.tEsc) continue;
      const cm = this.camAt(te);
      const P = this.boardSide(te, false);
      const k = ease.inCubic(prog(te, this.tEsc, this.tEnd - 0.24));
      e.g.forEach((g, i) => {
        const onB = vadd(vadd(P.O, vsc(P.ux, g.u)), vsc(P.up, g.v));
        // over the top of the lens and out to the sides: the centre stays clear for the dot
        const spread = (i - (e.g.length - 1) / 2) * 0.75;
        const lens = vadd(vadd(vadd(cm.p, vsc(cm.F, -0.3)), vsc(cm.R, spread)), vsc(cm.U, 0.85));
        const W3 = vlerp(onB, lens, k);
        const ux = vnorm(vlerp(P.ux, cm.R, k)), dn = vnorm(vlerp(vsc(P.up, -1), vsc(cm.U, -1), k));
        const A = this.planeAffine(cm, W3, ux, dn, m0, g.w / 2, -capPx / 2);
        if (!A) return;
        const sz = Math.hypot(A.c, A.d) * capPx;
        c.setTransform(A.a, A.b, A.c, A.d, A.e, A.f);
        // at the lens the letters thin out instead of whiting out the frame (the flash belongs to the hit)
        c.globalAlpha = echo === 0 ? 1 : 0.28 * Math.pow(0.6, echo - 1) * Math.min(1, 4 * k * (1 - k)) * (1 - smoothstep(250, 600, sz));
        c.fillStyle = echo === 0 ? rgba('bone') : rgba('signal');
        c.fillText(g.ch, 0, 0);
      });
    }
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawDot(c: CanvasRenderingContext2D, cam: Cam, t: number, dot: { p: V3 | null; scr: [number, number] | null }) {
    const q = dot.scr ?? (dot.p ? this.projV(cam, dot.p) : null);
    if (!q) return;
    // flare on every doubling, every etched word, the pad; the hit
    let fl = 0;
    for (const g of this.gens) if (t >= g) fl = Math.max(fl, pulse(t, g, 0.06));
    for (const s of this.stamps) if (t >= s) fl = Math.max(fl, 0.6 * pulse(t, s, 0.05));
    if (t >= this.tPad) fl = Math.max(fl, pulse(t, this.tPad, 0.08));
    const hitK = t >= this.tHit ? pulse(t, this.tHit, 0.1) : 0;
    const settle = t >= this.tEnd - 0.3 ? 0 : 1;
    const sc = 0.8 + (0.7 * fl + 1.6 * hitK) * settle;
    this.glow.seg2(q[0], q[1], q[0] + 0.01, q[1], 30 * sc, mul(LIN.signal, 0.7), 0.5);
    dot2D(c, q[0], q[1], t, sc, 1);
    // sparks on each doubling, and the hit's burst
    for (let i = 1; i < this.gens.length; i++) {
      const g = this.gens[i]!;
      if (t < g || t > g + 0.3) continue;
      const big = i === this.gens.length - 1;
      burst2D(c, q[0], q[1], t, g, big ? { n: 150, speed: 2000, life: 0.6, seed: 90 } : { n: 16, speed: 520, life: 0.22, seed: 30 + i });
    }
    if (t >= this.tPad && t < this.tPad + 0.3) burst2D(c, q[0], q[1], t, this.tPad, { n: 40, speed: 900, life: 0.3, seed: 77 });
    // etching: the laser's sparks while a word is being cut
    for (const e of [...this.dive, ...this.hook.slice(0, 3)]) {
      if (t >= e.t0 && t < e.t1 + 0.03) { sparksAt(c, { x: q[0], y: q[1] }, t, 2.2, 18, HEX.signal); break; }
    }
  }
}

function mixCss(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  return `rgb(${[16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k)).join(',')})`;
}
