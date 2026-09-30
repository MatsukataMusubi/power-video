// PREACH ("We are preaching power" ×7, drums, no bass): a pipe organ engraved dead-on, and a hymn board.
// Structure: P(doom)'s dense quantisation ×7 (docs/PDOOM-STRUCTURE.md, approved mapping): seven bars,
// one quantised event per bar, the same action heavier each time (hook ×4's escalation shrunk to a
// bar). The event: on beat 4 a stop is drawn (hard cut to the jamb: the knob comes out with a thunk,
// its engraved name readable), and on the downbeat its rank speaks (hard cut wide: the blue wind shoots
// up its pipes, the value's number card slams onto the next ledge of the hymn board: 1 GW, 2 GW … 64 GW);
// then the camera snaps onto the board as the sung line is slotted in letter by letter (the empty slot
// being filled is bracketed in blue: the cursor; the sung word is printed blue), and punches on
// "power". Every kick pushes the wind; shake, punch and the subdivision of the pushes grow bar by bar.
//   bar 1  frame 1 is world5's last: the 23 cristae, now the central flat's pipes (HANDOFF.pipes). The
//          wind floods them on the downbeat and the camera is pulled back as the case and console
//          appear around them (Principal 8′; Vox Humana 8′ is already drawn).
//   bars 2–6  Octave 4′ · Mixture IV · Trumpet 8′ · Double Open Diapason 32′ · Tuba Mirabilis 8′
//   bar 7  the maximal hit: Vox Machina 8′ is drawn beside Vox Humana 8′, and on the downbeat every
//          pipe in the organ speaks at once, dead straight, flash, the biggest shake; 64 GW.
//   exit   the last beat: the wind leaves every pipe and is drawn into the dot riding the centre
//          pipe's wind, the organ goes dark around it; the dot ends alone at HANDOFF.spot (inst's
//          spotlight).
// Thread object: the dot, a point of light riding the wind in the centre pipe, bumped up by every kick.
// Geometry: organ-geo.ts; pipes (GL): organ-gl.ts; everything with a face or a word: organ-draw.ts.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse, springStep } from '../engine/util';
import { dot2D, burst2D, siW, HANDOFF } from './_power';
import { PipeMesh, groundPass, NRANK } from './organ-gl';
import {
  pipes, knobs, PULLS, VOX_HUMANA, CENTRE_PIPE, FLAT, FLAT_MOUTH, rowY, IMPOST, UPPER, CORNICE, SIDE, PEDAL, CROWN, MIXT,
} from './organ-geo';
import {
  type Cam, type Row, applyCam, w2s, viewRect, drawCase, drawConsoleBody, drawKnobs, drawBoard, layoutRow, knobHead, drawStreaks,
} from './organ-draw';

const HOLD = 2 / 60;               // frame 1 holds world5's shape for two frames
const ID: Cam = { x: W / 2, y: H / 2, z: 1, r: 0 };
/** The downbeat framings, bar by bar: a new angle each time, rolls alternating and growing, then dead straight on the hit. */
const ORGAN: Cam[] = [
  { x: 960, y: 770, z: 0.66, r: 0 },
  { x: 960, y: 560, z: 0.64, r: -0.018 },
  { x: 960, y: 650, z: 0.6, r: 0.026 },
  { x: 960, y: 700, z: 0.63, r: -0.034 },
  { x: 960, y: 640, z: 0.555, r: 0.042 },
  { x: 960, y: 820, z: 0.7, r: -0.05 },
  { x: 960, y: 695, z: 0.54, r: 0 },
];
/** Escalation per bar: downbeat shake (px), downbeat punch, knob thunk shake, wind push per kick. */
const SHAKE = [5, 5, 7, 9, 12, 15, 26];
const PUNCH = [0.02, 0.02, 0.025, 0.03, 0.036, 0.045, 0.085];
const THUNK = [0, 3, 4, 5, 6.5, 8, 12];
const PUSH = [0.3, 0.34, 0.4, 0.46, 0.54, 0.62, 0.8];
const DOT_EXIT_Y = 535;            // world y where the wind collapses (in the centre pipe)
const SPOT = HANDOFF.spot;

interface Bar { k: number; d: number; line: Line | null; words: Word[]; tS: number; tPow: number; pull: number; ign: number }

export default class Organ extends Scene {
  private L = new Layer2D();
  private ground = groundPass();
  private pm = new PipeMesh(pipes);
  private hot!: FSPass;
  private bars: Bar[] = [];
  private rows: Row[] = [];
  private tX = 0; private s0 = 0; private e0 = 0;
  private kicks: [number, number][] = [];
  private pullT = new Float32Array(knobs.length).fill(1e9);
  private pull = new Float32Array(knobs.length);
  private lit = new Float32Array(knobs.length);
  private mouths: { x: number; y: number }[] = [];
  /** The next stage that has its own line (-1 after the last). */
  private nxt: number[] = [];

  override init() {
    const { lyrics: ly, audio: au, start: s0, end: e0 } = this.ctx;
    this.s0 = s0; this.e0 = e0;
    const bd = (i: number) => au.timeOfBeat(i);
    const b0 = Math.round(au.beatAt(s0));
    // seven stages (one stop and rank each), one sung line per bar; lines found by position inside the
    // window. A cut version may leave fewer lines: the stages spread over them evenly (4 lines → stages
    // 0, 2, 4, 6), a skipped stage fires with the next line, and the last line is always stage 6.
    const lines = ly.lines.filter((l) => l.start >= s0 - 0.3 && l.start < e0 - 0.2).slice(0, 7);
    const N = Math.max(1, lines.length);
    const present = Array.from({ length: N }, (_, i) => (N === 1 ? 6 : Math.round((i * 6) / (N - 1))));
    for (let k = 0; k < 7; k++) {
      const li = present.findIndex((p) => p >= k); // the line this stage fires with
      const own = present[li] === k;
      const d = bd(b0 + 4 * li);
      const line = own ? lines[li] ?? null : null;
      const words = line?.words ?? [];
      const wS = words[Math.min(2, words.length - 1)], wP = words[words.length - 1];
      const tS = wS ? Math.max(wS.start, d + 0.2) : d + 0.4;
      const tPow = wP ? Math.max(wP.start, tS + 0.15) : d + 1.1;
      const pull = li === 0 ? s0 + HOLD + 0.1 : bd(b0 + 4 * li - 1);
      const ign = li === 0 ? s0 + HOLD : d;
      this.bars.push({ k, d, line, words, tS, tPow, pull, ign });
      const row = layoutRow(li, siW(1e9 * 2 ** k), words, li === 0 ? s0 + 0.16 : d);
      if (!own) row.cards = [];
      this.rows.push(row);
      this.nxt.push(-1);
    }
    for (let k = 0; k < 7; k++) this.nxt[k] = present.find((p) => p > k) ?? -1;
    this.tX = bd(Math.round(au.beatAt(e0)) - 1);
    this.kicks = au.events('kick', s0 - 0.5, e0 + 0.1);
    this.bars.forEach((b, k) => { const i = PULLS[k]!; if (i >= 0) this.pullT[i] = b.pull; });
    if (VOX_HUMANA >= 0) this.pullT[VOX_HUMANA] = -1e9;
    // pipe mouths (where the wind leaves on the exit)
    for (const p of pipes) {
      if (p.type === 2) this.mouths.push({ x: p.cx, y: p.top });
      else if (p.type === 1) this.mouths.push({ x: p.cx, y: p.top + 6 });
      else this.mouths.push({ x: p.cx, y: p.mouth - 0.1 * p.w });
    }
    // the ground's recesses (world rect centre, half size)
    const rec: [number, number, number, number][] = [
      [FLAT.x0 - 2, CORNICE.y1, FLAT.x1 + 2, IMPOST.y0],
      [UPPER.x0 - 6, CROWN.y1, UPPER.x1 + 6, CORNICE.y0],
      [SIDE.x0 - 4, MIXT.top, SIDE.x1 + 4, IMPOST.y0],
      [2 * 960 - SIDE.x1 - 4, MIXT.top, 2 * 960 - SIDE.x0 + 4, IMPOST.y0],
      [PEDAL.cxL - PEDAL.rad - 30, -168, PEDAL.cxL + PEDAL.rad + 30, IMPOST.y0],
      [PEDAL.cxR - PEDAL.rad - 30, -168, PEDAL.cxR + PEDAL.rad + 30, IMPOST.y0],
    ];
    const ru = this.ground.u.recess!.value as THREE.Vector4[];
    rec.forEach(([x0, y0, x1, y1], i) => ru[i]!.set((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2));
    // only the blue glows: the blue-dominant pixels of the 2D layer are added again, hot
    this.hot = new FSPass(/* glsl */ `
      uniform sampler2D tex; uniform float gain;
      void main() {
        vec4 s = texture(tex, vUv);
        float h = smoothstep(0.25, 0.7, s.b - s.r * 1.3);
        fragColor = vec4(s.rgb * s.a * h * gain, 1.0);
      }`, { tex: { value: this.L.texture }, gain: { value: 1.2 } }, { transparent: true });
    const m = this.hot.mat;
    m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor;
    m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  }

  // ------------------------------------------------------------------ time helpers
  private barAt(t: number) {
    let k = 0;
    for (let i = 0; i < 7; i++) if (t >= this.bars[i]!.d - 1e-4) k = i;
    return k;
  }
  /** The wind push: every kick, and in the later bars the 8ths and 16ths too. */
  private push(t: number) {
    const k = this.barAt(t);
    let v = 0;
    for (const [kt, s] of this.kicks) {
      if (kt > t) break;
      if (t - kt < 1) v = Math.max(v, s * pulse(t, kt, 0.1));
    }
    let p = v * PUSH[k]!;
    const au = this.ctx.audio;
    const bt = au.beatAt(t);
    if (k >= 3) { const b8 = au.timeOfBeat(Math.floor(bt * 2) / 2); p = Math.max(p, 0.5 * PUSH[k]! * pulse(t, b8, 0.07)); }
    if (k >= 5) { const b16 = au.timeOfBeat(Math.floor(bt * 4) / 4); p = Math.max(p, 0.3 * PUSH[k]! * pulse(t, b16, 0.045)); }
    return p;
  }

  // ------------------------------------------------------------------ camera
  private lerpCam(a: Cam, b: Cam, e: number): Cam {
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), e)), r: lerp(a.r, b.r, e) };
  }
  private organCam(k: number, t: number): Cam {
    const b = this.bars[k]!;
    if (k === 0) {
      const e = ease.outExpo(prog(t, this.s0 + HOLD, this.s0 + HOLD + 0.62));
      return this.lerpCam(ID, ORGAN[0]!, e);
    }
    const o = ORGAN[k]!;
    return { ...o, z: o.z * (1 + 0.025 * prog(t, b.d, b.tS)) };
  }
  private rowCentre(k: number) {
    const cs = this.rows[k]!.cards;
    return cs.length ? (cs[0]!.x + cs[cs.length - 1]!.x + cs[cs.length - 1]!.w) / 2 : 960;
  }
  private boardCam(k: number, t: number): Cam {
    const b = this.bars[k]!;
    const end = this.nxt[k]! >= 0 ? this.bars[this.nxt[k]!]!.pull : this.tX;
    const A = this.organCam(k, b.tS);
    const sgn = k % 2 ? 1 : -1;
    const cs = this.rows[k]!.cards;
    const rowW = cs.length ? cs[cs.length - 1]!.x + cs[cs.length - 1]!.w - cs[0]!.x : 900;
    const zFit = 1760 / rowW; // the whole row, value to POWER, stays in frame
    const B: Cam = { x: this.rowCentre(k), y: rowY(k) - 52, z: Math.min(zFit / 1.1, 1.5 + 0.035 * k), r: sgn * (0.008 + 0.003 * k) };
    let cam = this.lerpCam(A, B, ease.outExpo(prog(t, b.tS, b.tS + 0.22)));
    // "power": snap in toward the word being slotted
    const pw = this.rows[k]!.cards.filter((c) => c.kind === 2 && c.word === b.words.length - 1);
    const px = pw.length ? (pw[0]!.x + pw[pw.length - 1]!.x + pw[pw.length - 1]!.w) / 2 : B.x;
    const zC = Math.min(zFit, B.z * 1.09);
    // toward POWER, as far as the value's first card stays in frame
    const C: Cam = { x: Math.min(lerp(B.x, px, 0.3), cs[0]!.x - 50 + W / 2 / zC), y: B.y + 6, z: zC, r: B.r * 1.4 };
    cam = this.lerpCam(cam, C, ease.outExpo(prog(t, b.tPow, b.tPow + 0.16)));
    cam.z *= 1 + 0.02 * prog(t, b.tS, end);
    return cam;
  }
  private knobCam(k: number, t: number): Cam {
    const b = this.bars[k]!;
    const i = PULLS[k]!;
    let x: number, y: number;
    if (k === 6 && VOX_HUMANA >= 0) {
      const a = knobHead(knobs[VOX_HUMANA]!, 1), c = knobHead(knobs[i]!, 1);
      x = (a.x + c.x) / 2 - 40; y = (a.y + c.y) / 2 + 22;
    } else {
      const h = knobHead(knobs[i]!, 1);
      // the knob sits a little off-centre toward the jamb's outside, its neighbours in view
      x = h.x + (knobs[i]!.side === 0 ? 150 : -150); y = h.y + 30;
    }
    const sgn = k % 2 ? 1 : -1;
    const z = k === 6 ? 3.0 : 2.3 + 0.1 * k;
    const r = k === 6 ? 0 : sgn * (0.03 + 0.013 * k);
    return { x, y, z: z * (1 + 0.05 * prog(t, b.pull, b.d)), r };
  }
  private exitCam(t: number): Cam {
    const z = Math.exp(lerp(Math.log(ORGAN[6]!.z), Math.log(0.95), ease.inCubic(prog(t, this.tX, this.e0))));
    return { x: 960 - (SPOT.x - W / 2) / z, y: DOT_EXIT_Y - (SPOT.y - H / 2) / z, z, r: 0 };
  }
  cam(t: number): Cam {
    if (t < this.s0 + HOLD) return ID;
    if (t >= this.tX) return this.exitCam(t);
    const k = this.barAt(t);
    const nk = this.nxt[k]!;
    if (nk >= 0 && t >= this.bars[nk]!.pull) return this.knobCam(nk, t);
    const b = this.bars[k]!;
    if (t < b.tS) return this.organCam(k, t);
    return this.boardCam(k, t);
  }

  // ------------------------------------------------------------------ render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const cam = this.cam(t);
    const k = this.barAt(t);
    const hit = this.bars[6]!.d;
    const push = this.push(t);
    const exitK = prog(t, this.tX, this.e0);
    const drain = ease.inQuad(prog(t, this.tX + 0.04, this.e0 - 0.12));

    // ---- reveal: the case and console appear around the flat after the first frames
    const tR = this.s0 + HOLD;
    const revR = t < tR ? 0 : 3600 * ease.outExpo(prog(t, tR, tR + 0.55));
    const revealing = revR < 3500;
    const RC = { x: 960, y: 600 };

    // ---- the ranks
    const u = this.pm.u;
    const I = u.rankI!.value as number[], Hh = u.rankH!.value as number[], Fl = u.rankF!.value as number[], Sh = u.rankShow!.value as number[];
    for (let r = 0; r < NRANK; r++) {
      const b = this.bars[r];
      if (!b || r >= 6) { I[r] = 0; Hh[r] = 0; Fl[r] = 0; Sh[r] = 0; continue; }
      const on = t >= b.ign;
      const surge = t >= hit ? 0.55 * pulse(t, hit, 0.22) + 0.18 : 0;
      I[r] = on ? 1 + 0.35 * pulse(t, b.ign, 0.16) + surge : t >= hit ? 1 + surge : 0;
      Hh[r] = on ? ease.outExpo(prog(t, b.ign, b.ign + 0.12)) : t >= hit ? ease.outExpo(prog(t, hit, hit + 0.06)) : 0;
      Fl[r] = (on ? pulse(t, b.ign, 0.08) : 0) + (t >= hit ? 0.9 * pulse(t, hit, 0.09) : 0);
      Sh[r] = r === 0 || t >= tR ? 1 : 0;
    }
    // before the hit only the ranks drawn so far speak; Vox Machina (the hit) makes them all speak
    u.push!.value = push;
    u.t!.value = t;
    u.drain!.value = drain;
    u.dim!.value = 0;
    u.lineK!.value = 4.6;
    u.lodK!.value = 4.2 / (4.6 * cam.z);
    u.engr0!.value = lerp(0.3, 1, prog(t, tR, tR + 0.1));
    (u.reveal!.value as THREE.Vector3).set(RC.x, RC.y, revealing ? revR : -1);
    (u.cam!.value as THREE.Vector4).set(cam.x, cam.y, cam.z, cam.r);
    const gu = this.ground.u;
    (gu.cam!.value as THREE.Vector4).set(cam.x, cam.y, cam.z, cam.r);
    (gu.reveal!.value as THREE.Vector3).set(RC.x, RC.y, revealing ? revR : -1);
    gu.dim!.value = 0.45 * (1 - prog(t, tR, tR + 0.3));
    this.ground.render(renderer, out);
    this.pm.render(renderer, out);

    // ---- knobs
    for (let i = 0; i < knobs.length; i++) {
      const tp = this.pullT[i]!;
      if (t < tp) { this.pull[i] = 0; this.lit[i] = 0; continue; }
      this.pull[i] = tp < -1e8 ? 1 : clamp(springStep(t - tp, 6, 0.42), 0, 1.25);
      this.lit[i] = tp < -1e8 ? 0.8 : 0.75 + 0.6 * pulse(t, tp, 0.12);
    }

    // ---- the 2D layer
    const L = this.L; L.clear();
    const c = L.ctx;
    const v = viewRect(cam);
    c.save();
    applyCam(c, cam);
    if (t >= tR) {
      drawCase(c, v, cam.z);
      const lamp = 0.85 + 0.15 * Math.sin(t * 3);
      drawConsoleBody(c, v, cam.z, t, lamp);
      drawKnobs(c, v, cam.z, this.pull, this.lit);
      // the board takes each row's slam and the kicks
      let slam = 0;
      for (const b of this.bars) if (t >= b.d && t < b.d + 0.4) slam = Math.max(slam, (2 + 0.9 * b.k) * pulse(t, b.d, 0.05) * Math.sin((t - b.d) * 70));
      const live = t >= this.rows[k]!.tNum ? k : -1;
      drawBoard(c, v, { t, z: cam.z, rows: this.rows, slam, rattle: Math.min(3, push * (1 + k) * 0.9), seed: Math.round(t * 60), live });
      if (revealing) {
        c.globalCompositeOperation = 'destination-in';
        const g = c.createRadialGradient(RC.x, RC.y, 0, RC.x, RC.y, Math.max(1, revR));
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.9, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(v.x0 - 100, v.y0 - 100, v.x1 - v.x0 + 200, v.y1 - v.y0 + 200);
        c.globalCompositeOperation = 'source-over';
      }
    }
    c.restore();

    // ---- exit: the organ goes dark; the wind leaves every mouth for the dot
    const dotW = { x: 960, y: this.dotY(t) };
    if (t >= this.tX) {
      const dimK = ease.inQuad(prog(t, this.tX + 0.05, this.e0 - 0.07));
      c.fillStyle = `rgba(8,9,10,${dimK})`; c.fillRect(0, 0, W, H);
      const ey = lerp(this.dotY(this.tX), DOT_EXIT_Y, ease.outCubic(prog(t, this.tX, this.tX + 0.14)));
      dotW.y = ey;
      c.save(); applyCam(c, cam);
      drawStreaks(c, this.mouths, dotW, prog(t, this.tX + 0.02, this.e0 - 0.06), 1 / cam.z);
      c.restore();
    }
    // ---- the dot: riding the centre pipe's wind (screen space, so it keeps its size)
    const firstOn = this.bars[0]!.ign;
    if (t >= firstOn) {
      const ds = w2s(cam, dotW.x, dotW.y);
      let flare = 0;
      for (const b of this.bars) if (t >= b.ign) flare = Math.max(flare, pulse(t, b.ign, 0.12) * (0.6 + 0.12 * b.k));
      if (t >= hit) flare = Math.max(flare, 1.6 * pulse(t, hit, 0.14));
      const sc = t >= this.tX ? lerp(0.9 + 0.3 * cam.z, 1.25, exitK) : (0.55 + 0.45 * cam.z) * (1 + flare);
      const inten = Math.min(1.25, prog(t, firstOn, firstOn + 0.06) * (0.9 + 0.3 * push + 0.4 * flare) + (t >= this.tX ? 0.35 * exitK : 0));
      if (t >= this.tX && t >= this.e0 - 0.03) dot2D(c, SPOT.x, SPOT.y, t, 1.2, 1.1);
      else dot2D(c, ds.x, ds.y, t, sc, inten, 0.35);
      if (t >= hit && t < hit + 0.6) burst2D(c, ds.x, ds.y, t, hit, { n: 150, speed: 1900, life: 0.55, seed: 17, width: 2.4 });
    }
    comp.draw(renderer, L.upload(), out);
    this.hot.u.gain!.value = 1.15;
    this.hot.render(renderer, out);

    return this.post(t, k, push);
  }

  /** The dot's height in the centre pipe: it rises with the registration and is bumped by every kick. */
  private dotY(t: number) {
    const p = pipes[CENTRE_PIPE]!;
    const k = this.barAt(t);
    const lev = clamp(0.3 + 0.07 * k + 0.35 * this.push(t), 0, 0.92);
    return lerp(FLAT_MOUTH - 0.2 * p.w, FLAT.top + 30, lev);
  }

  private post(t: number, k: number, push: number): PostOverrides {
    let sh = 0, zoom = 1 + 0.008 * push, ca = 0.45, flash = 0, exposure = 1;
    for (const b of this.bars) {
      const td = b.k === 0 ? this.s0 + HOLD : b.d;
      if (t >= td) { const p = pulse(t, td, 0.07); sh += SHAKE[b.k]! * p; zoom += PUNCH[b.k]! * pulse(t, td, 0.1); ca += 0.25 * b.k * p; }
      if (b.k > 0 && t >= b.pull) { const p = pulse(t, b.pull, 0.05); sh += THUNK[b.k]! * p; zoom += 0.012 * p; }
      if (t >= b.tPow) { const p = pulse(t, b.tPow, 0.06); sh += (1.5 + 0.4 * b.k) * p; zoom += (0.008 + 0.002 * b.k) * pulse(t, b.tPow, 0.09); }
    }
    const hit = this.bars[6]!.d;
    if (t >= hit) { flash = 0.28 * pulse(t, hit, 0.016); exposure += 0.15 * pulse(t, hit, 0.06); ca += 3.5 * pulse(t, hit, 0.08); }
    void k;
    const o: PostOverrides = {
      bloom: 0.6, bloomThreshold: 0.95, bloomKnee: 0.3, bloomRadius: 0.68, halation: 0.14,
      shake: [Math.sin(t * 93) * sh, Math.cos(t * 71) * sh * 0.8],
      zoom, ca, flash, exposure, vignette: 0.42, grain: 0.05,
    };
    if (t < this.s0 + HOLD) { o.shake = [0, 0]; o.zoom = 1; o.ca = 0.6; }
    if (t >= this.tX) {
      const q = prog(t, this.tX, this.e0 - 0.08);
      o.shake = [o.shake![0] * (1 - q), o.shake![1] * (1 - q)];
      o.zoom = lerp(zoom, 1, q); o.ca = lerp(ca, 0.5, q); o.vignette = lerp(0.42, 0.3, q);
    }
    return o;
  }
}


