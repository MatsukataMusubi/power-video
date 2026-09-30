// MATE ×3: the pre-choruses, "What will it take to make you capitulate?". P(doom)'s prompt template
// (docs/PDOOM-STRUCTURE.md), move for move, with our imagery (docs/PLATES.md 3, 11, 14): a connector
// datasheet, bone lines on graphite, one blue. The prompt field is the connector, drawn as a half
// section (exterior above the axis, cut below): the plug is the human's half, outlined by hand and
// boiling; the receptacle is the machine's, plotted exact, its contacts blue.
//   tokens typed on sung words -> "what will it take" handwritten on the plug shell (single-stroke
//                                 script, the pen as cursor); "TO MAKE YOU" etched on the receptacle
//                                 (Plex Mono, the laser as cursor); CAPITULATE? split across the two
//                                 mating faces, whole only when fully mated
//   the caret                  -> the plug's leading edge: pin 1's tip, where the blue dot sits
//   typing                     -> the plug advances one step per sung word
//   next-token distributions   -> pinout callouts (p( function | PIN n )), the datasheet's fine print
//   ⏎ on the grid              -> the plug seats
// variant 1 (prompt1, chatgpt): the bore's keying rings pull the camera in, accelerating; word cuts;
//   ⏎ seats the plug and the whole sheet is swallowed into the bore; the blue takes the frame (hook 2
//   opens on a blue field).
// variant 2 (prompt2, gato): dark, hidden lines only, no cuts, long glides; pins and letters drift
//   apart after each word; the cursor holds the last letter; a dim ⏎; the plug only half in; fades to
//   the last letter and the cursor, centred.
// variant 3 (prompt3, sydney): cuts on words and on the grid; section-hatched housing walls close one
//   notch per beat; ⏎ slams the plug home, CAPITULATE? whole; the housing slams shut to black.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { HEX, rgba } from '../engine/palette';
import { F, font, glyphX, measure, plain } from '../engine/type';
import { strokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { Lyrics, norm, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, noise1, noise2, prog, pulse, smoothstep, TAU } from '../engine/util';
import { inkLine, type Poly } from './_plate';
import { sparksAt } from './_shell';
import { dot2D, HANDOFF } from './_power';
import { SHADERS } from './mate-gl';
import { ALT, ALT_FALLBACK, META, CONTACTS, CALLOUT, VERDICT, type Cand } from './mate-data';

const ACC = HEX.signal;
const CAPH = 0.686; // Archivo cap height / em
const SLAB = F.archivo(62, 900);
const MONO = F.mono(400), MONO_M = F.mono(500), MONO_B = F.mono(600);

// ---- the connector, in sheet px. Plug x is relative to its shoulder, receptacle x to its mouth.
const AY = 520; // the axis: exterior above, half section below
const R = 210; // outer radius of both bodies
const RN = 140; // plug nose
const RB = 146; // receptacle bore
const NOSE = 150; // nose length = bore depth to the insulator face
const PIN = 96; // pins beyond the nose face
const PIN_Y = [34, 78, 122]; // pin rows below the axis; pin 1 is nearest the axis
const PIN_T = 12;
const INS = 200; // insulator length
const BACK = 90; // plug backshell
const HAND_BASE = AY - 142, HAND_SIZE = 66;
const STEN_BASE = AY - 142, STEN_SIZE = 46, STEN_TRACK = 3, STEN_X = 34;
const CAP_BASE = AY - 24, CAP_SIZE = 122;
const POP_PRE = 0.16; // a callout appears this long before its word
const G0 = 380; // gap between the plug shoulder and the receptacle mouth at the start
const G_LAST = 104; // after the last word (v1, v3): the pins at the insulator face, not in

type Side = 'h' | 'm' | 'c';
type Focus = 'pin' | 'caret' | 'typed' | 'field' | 'joint' | 'last';
interface Tok { w: Word; i: number; side: Side; t0: number; tPopEnd: number; rows: Cand[]; pick: number; id: number }
interface Shot { t: number; zoom: number; focus: Focus; rot: number; push: number; blend: number; dy?: number; grid?: boolean }
interface Cam { cx: number; cy: number; zoom: number; rot: number }
interface Pt { x: number; y: number }
interface Drift { dx: number; dy: number; r: number }
const NO_DRIFT: Drift = { dx: 0, dy: 0, r: 0 };

const clean = (s: string) => s.replace(/[,.?!“”"]/g, '');

export default class Mate extends Scene {
  v = 1;
  ui = new Layer2D();
  comp!: FSPass;
  line!: Line;
  words: Word[] = [];
  human: Word[] = [];
  machine: Word[] = [];
  cap!: Word;
  toks: Tok[] = [];
  hand!: { st: StrokeText; times: [number, number][]; x0: number; charWord: number[]; box: { x0: number; x1: number }[] };
  sten!: { chars: { ch: string; x: number; wi: number; t0: number }[]; adv: number; w: number };
  capw!: { text: string; k: number; xs: number[]; wpx: number; xk: number };
  SX = 0; LP = 0; LS = 0; FL = 0;
  plugOutline: Poly[] = [];
  plugLen = 0;
  steps: { t: number; g: number; dur: number; snap: boolean }[] = [];
  tFirst = 0; tLast = 0; tEnter = 0; tEnd = 0; tShut = 0; tArc0 = 0; tArc1 = 0; tWave = 0;
  pinDet = [Infinity, Infinity, Infinity];
  shots: Shot[] = [];

  override init() {
    const { lyrics, params, start, end, audio } = this.ctx;
    this.v = Number(params.variant ?? 1);
    const v = this.v;
    this.tEnd = end;
    // the plea: the line that starts in our window (found by its confident words)
    this.line = lyrics.linesIn(start - 0.3, end).find((l) => /what will it take|capitulate/i.test(l.text))
      ?? lyrics.linesIn(start, end).find((l) => l.start >= start - 0.25 && l.start < end - 0.5)
      ?? lyrics.linesIn(start, end)[0]!;
    const ws = this.line.words;
    this.words = ws;
    const n = ws.length;
    this.cap = ws[n - 1]!;
    let iTo = ws.findIndex((w, i) => i > 0 && i < n - 1 && /^(to|soon|as)$/i.test(clean(w.w)));
    if (iTo < 0) iTo = Math.max(1, Math.round((n - 1) * 0.55));
    this.human = ws.slice(0, iTo);
    this.machine = ws.slice(iTo, n - 1);

    // handwriting (plug shell): per-char times follow the word timings, as in dock.ts
    const hWords = this.human.map((w) => clean(w.w).toLowerCase());
    const hText = hWords.join(' ');
    const st = strokeText(hText, 'hscript', HAND_SIZE);
    const times: [number, number][] = [];
    const charWord: number[] = [];
    this.human.forEach((w, wi) => {
      const s = hWords[wi]!;
      for (let i = 0; i < s.length; i++) {
        times.push([w.start + ((w.end - w.start) * i) / s.length, w.start + ((w.end - w.start) * (i + 1)) / s.length]);
        charWord.push(wi);
      }
      if (wi < this.human.length - 1) { times.push([w.end, w.end]); charWord.push(-1); }
    });
    const box = Array.from(hText).map(() => ({ x0: Infinity, x1: -Infinity }));
    st.strokes.forEach((s, i) => { const b = box[st.charOf[i]!]!; for (const p of s) { b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); } });
    this.hand = { st, times, x0: -40 - st.width, charWord, box };

    // stencil (receptacle): each word etched in a quick raster at its sung start
    const mWords = this.machine.map((w) => clean(w.w).toUpperCase());
    const mText = mWords.join(' ');
    const chars: { ch: string; x: number; wi: number; t0: number }[] = [];
    let ci = 0;
    this.machine.forEach((w, wi) => {
      const s = mWords[wi]!;
      for (let i = 0; i < s.length; i++) chars.push({ ch: s[i]!, x: glyphX(mText, ci + i, MONO_B, STEN_SIZE, STEN_TRACK), wi, t0: w.start + i * 0.022 });
      ci += s.length + 1;
    });
    this.sten = { chars, adv: measure('M', MONO_B, STEN_SIZE), w: measure(mText, MONO_B, STEN_SIZE, STEN_TRACK) };

    // CAPITULATE?, split where its kerned width is halved: left part on the plug, right on the receptacle
    const text = this.cap.w.replace(/[,.!“”"]/g, '').toUpperCase();
    const wpx = measure(text, SLAB, CAP_SIZE);
    const xs = Array.from(text).map((_, i) => glyphX(text, i, SLAB, CAP_SIZE));
    let k = 1;
    for (let i = 1; i < text.length; i++) if (Math.abs(xs[i]! - wpx / 2) < Math.abs(xs[k]! - wpx / 2)) k = i;
    this.capw = { text, k, xs, wpx, xk: xs[k]! };

    // bodies sized to their words; the mated assembly centred on the sheet
    this.LP = Math.max(540, st.width + 120, this.capw.xk + 90);
    this.LS = Math.max(600, STEN_X + this.sten.w + 200, wpx - this.capw.xk + 200);
    this.FL = this.LS - 150;
    this.SX = W / 2 - (this.LS - this.LP - BACK) / 2;

    // the plug's outline, for the hand (plug-local)
    const LP = this.LP;
    const polys: Poly[] = [
      [{ x: -LP, y: AY }, { x: -LP, y: AY - R }, { x: 0, y: AY - R }, { x: 0, y: AY - RN }, { x: NOSE, y: AY - RN }, { x: NOSE, y: AY + RN }, { x: 0, y: AY + RN }, { x: 0, y: AY + R }, { x: -LP, y: AY + R }, { x: -LP, y: AY }],
      [{ x: -LP + 44, y: AY - R }, { x: -LP + 44, y: AY + R }],
      [{ x: -LP, y: AY - R }, { x: -LP - BACK, y: AY - 66 }, { x: -LP - BACK - 700, y: AY - 66 }],
      [{ x: -LP, y: AY + R }, { x: -LP - BACK, y: AY + 66 }, { x: -LP - BACK - 700, y: AY + 66 }],
      [{ x: -LP + 44, y: AY + R - 22 }, { x: 0, y: AY + R - 22 }],
    ];
    this.plugOutline = polys.map((o) => {
      const d: Poly = [];
      for (let i = 1; i < o.length; i++) {
        const a = o[i - 1]!, b = o[i]!, m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
        for (let j = 0; j < m; j++) d.push({ x: a.x + ((b.x - a.x) * j) / m, y: a.y + ((b.y - a.y) * j) / m });
      }
      d.push(o[o.length - 1]!);
      return d;
    });
    this.plugLen = this.plugOutline.reduce((s, d) => s + d.reduce((a, q, i) => (i ? a + Math.hypot(q.x - d[i - 1]!.x, q.y - d[i - 1]!.y) : 0), 0), 0);

    // ⏎ on the grid (P(doom)'s rule): the first beat (gato: 8th) after the last word, one beat
    // (sydney: two) before the end
    this.tFirst = ws[0]!.start;
    this.tLast = ws[n - 1]!.start;
    const beatsBefore = v === 3 ? 2 : 1;
    const gap = v === 3 ? 0.2 : 0.35;
    const want = Math.max(this.tLast + gap, audio.timeOfBeat(Math.round(audio.beatAt(end)) - beatsBefore));
    const q = v === 2 ? 2 : 1;
    const bq = Math.min(Math.ceil((audio.beatAt(want) - 0.06) * q) / q, Math.floor(audio.beatAt(end - 0.2) * q) / q);
    this.tEnter = clamp(audio.timeOfBeat(bq), start + 0.5, end - 0.2);
    const nextL = lyrics.nextLine(this.line.start + 0.01);
    const nextW = nextL ? nextL.words[0]!.start : end;
    this.tShut = clamp(Math.min(end, nextW), this.tEnter + 0.35, end);
    this.tArc0 = this.tEnter + 0.1;
    this.tArc1 = Math.min(this.tEnter + 0.46, this.tShut - 0.18);
    this.tWave = ws[Math.min(iTo, n - 1)]!.start;

    // the plug advances one step per sung word (gato: glides), seats on ⏎ (gato: half)
    ws.forEach((w, i) => {
      const g = v === 2 ? lerp(G0, 110, (i + 1) / n) : lerp(G0, G_LAST, (i + 1) / n);
      this.steps.push({ t: w.start, g, dur: v === 2 ? 0.9 : 0.07, snap: v !== 2 });
    });
    this.steps.push({ t: this.tEnter, g: v === 2 ? 75 : 0, dur: v === 2 ? 0.45 : 0.06, snap: v !== 2 });
    if (v === 2) {
      // the pins float off one by one; pin 1 last, when the cursor leaves it for the last word
      const we = (i: number) => (ws[Math.min(i, n - 2)] ?? ws[0]!).end + 0.3;
      this.pinDet = [this.cap.start, we(3), we(1)];
    }

    // callouts (the fine print): the sung word is the sampled row
    ws.forEach((w, i) => {
      const side: Side = i < iTo ? 'h' : i < n - 1 ? 'm' : 'c';
      const alt = ALT[norm(w.w)] ?? ALT_FALLBACK;
      const txt = plain(clean(w.w)).toLowerCase();
      const rows: Cand[] = [[txt, alt.p] as Cand, ...alt.alts.filter((a) => a[0] !== txt)].sort((a, b) => b[1] - a[1]);
      this.toks.push({ w, i, side, t0: w.start, tPopEnd: 0, rows, pick: rows.findIndex((r) => r[0] === txt), id: i + 1 });
    });
    this.toks.forEach((k, i) => {
      const next = this.toks[i + 1];
      const long = k.w.end - k.w.start > 1.2 && !next;
      const hold = long ? k.w.end - k.t0 - 0.45 : v === 2 ? 0.9 : 0.62;
      k.tPopEnd = Math.max(k.t0 + 0.2, Math.min(k.t0 + hold, next ? next.t0 - POP_PRE - 0.1 : k.t0 + hold));
    });

    this.comp = new FSPass(SHADERS[v]!, {
      ui: { value: this.ui.texture }, hotBoost: { value: v === 2 ? 0.2 : v === 3 ? 0.45 : 0.5 }, uiAlpha: { value: 1 },
      zoomBlur: { value: 0 }, zbCenter: { value: [0.5, 0.5] },
      t: { value: 0 }, camZ: { value: 0 }, glow: { value: 0 }, rot: { value: 0 }, rush: { value: 0 }, wave: { value: 0 },
      beat: { value: 0 }, reveal: { value: 0 }, blue: { value: 0 }, disc: { value: 0 }, vp: { value: [0, 0] }, dotPx: { value: [W / 2, H / 2] },
      gap: { value: 2000 }, wallCy: { value: H / 2 }, shut: { value: 0 }, light: { value: 0 }, notch: { value: 0 }, cam: { value: [W / 2, H / 2, 1, 0] },
    });
    this.shots = this.makeShots();
  }

  // ------------------------------------------------------------------ camera
  private makeShots(): Shot[] {
    const w = this.words, s = this.ctx.start, au = this.ctx.audio;
    const ws = (i: number) => w[clamp(i, 0, w.length - 1)]!.start;
    const nh = this.human.length, last = w.length - 1;
    const S = (t: number, zoom: number, focus: Focus, o: Partial<Shot> = {}): Shot => ({ t, zoom, focus, rot: 0, push: 0, blend: 0, ...o });
    if (this.v === 1) return [
      S(s, 2.7, 'pin', { push: 0.05 }),
      S(ws(0), 2.25, 'caret', { push: 0.03 }),
      S(ws(Math.max(1, Math.floor(nh / 2))), 1.5, 'typed', { rot: -0.018, push: 0.04 }),
      S(ws(nh), 2.0, 'caret', { rot: 0.014, push: 0.05 }),
      S(ws(last), 1.08, 'field', { push: 0.035 }),
      S(this.tEnter, 1.12, 'field'),
    ];
    if (this.v === 3) {
      const b0 = Math.round(au.beatAt(s));
      const grid = (k: number) => au.timeOfBeat(b0 + k);
      const shots = [
        S(s, 1.9, 'pin', { push: 0.04 }),
        S(ws(0), 1.6, 'caret', { push: 0.06 }),
        S(grid(2), 2.5, 'caret', { rot: -0.03, push: 0.06, dy: 30, grid: true }),
        S(ws(nh), 1.25, 'typed', { rot: 0.02, push: 0.05 }),
        S(grid(4), 1.75, 'caret', { rot: -0.01, push: 0.05, grid: true }),
        S(ws(last), 1.05, 'field', { push: 0.03, dy: 40 }),
        S(grid(5), 1.32, 'joint', { rot: 0.012, push: 0.05, grid: true }),
        S(this.tEnter, 0.92, 'field', { push: 0.05, blend: 0.25, dy: -30 }),
      ];
      // a grid cut that lands on top of a word cut gives way to it
      const words = shots.filter((x) => !x.grid).map((x) => x.t);
      return shots.filter((x) => !x.grid || (x.t < this.tEnter - 0.15 && words.every((t) => Math.abs(t - x.t) > 0.18))).sort((a, b) => a.t - b.t);
    }
    // gato: no cuts, only long glides
    return [
      S(s, 1.6, 'pin', { push: 0.02 }),
      S(ws(0), 1.45, 'caret', { blend: 1.2 }),
      S(ws(nh), 1.15, 'typed', { blend: 1.4 }),
      S(ws(last), 0.95, 'field', { blend: 1.5, dy: -20 }),
      S(this.tEnter - 0.9, 1.35, 'last', { blend: 1.45 }),
    ];
  }

  private camAt(t: number): Cam {
    let i = 0;
    while (i + 1 < this.shots.length && this.shots[i + 1]!.t <= t) i++;
    return this.camShot(i, t);
  }
  /** A shot's camera at t; a blending shot glides from the previous shot's camera (itself possibly gliding). */
  private camShot(i: number, t: number): Cam {
    const sh = this.shots[i]!;
    const z = sh.zoom * (1 + sh.push * Math.max(0, t - sh.t));
    const f = this.focusOf(sh, t, z);
    const cur: Cam = { cx: f.x, cy: f.y, zoom: z, rot: sh.rot };
    if (sh.blend > 0 && i > 0) {
      const k = ease.inOutCubic(clamp((t - sh.t) / sh.blend));
      if (k < 1) {
        const p = this.camShot(i - 1, t);
        return { cx: lerp(p.cx, cur.cx, k), cy: lerp(p.cy, cur.cy, k), zoom: Math.exp(lerp(Math.log(p.zoom), Math.log(cur.zoom), k)), rot: lerp(p.rot, cur.rot, k) };
      }
    }
    return cur;
  }

  private focusOf(sh: Shot, t: number, z: number): Pt {
    const dy = sh.dy ?? 0;
    switch (sh.focus) {
      case 'pin': { const p = this.pin1(t); return { x: p.x, y: p.y + dy }; }
      case 'caret': { const h = this.camHead(t, sh.t); return { x: h.x - 170 / z, y: h.y - 70 / z + dy }; }
      case 'typed': { const a = this.typedSpan(t, sh.t); return { x: (a.x0 + a.x1) / 2 + 30, y: a.y + dy }; }
      case 'joint': { const s = this.shoulder(t); return { x: (s + this.SX) / 2 + 30, y: AY - 60 + dy }; }
      case 'last': { const p = this.heldPos(t); return { x: p.x + 14, y: p.y - (CAP_SIZE * CAPH) / 2 + dy }; }
      default: return { x: W / 2, y: AY + 30 + dy };
    }
  }

  // ------------------------------------------------------------------ the mechanism
  /** Gap between the plug shoulder and the receptacle mouth; each step starts from where the last one is. */
  private gapAt(t: number): number {
    let g = G0;
    for (let i = 0; i < this.steps.length; i++) {
      const s = this.steps[i]!;
      if (t < s.t) break;
      const nx = this.steps[i + 1];
      const tt = nx && t >= nx.t ? nx.t : t;
      const k = clamp((tt - s.t) / s.dur);
      g = lerp(g, s.g, s.snap ? ease.outExpo(k) : ease.inOutCubic(k));
    }
    return g;
  }
  private shoulder(t: number) { return this.SX - this.gapAt(t); }

  /** A pin's drift after it lets go of the plug (gato). */
  private pinDrift(j: number, t: number): Drift & { a: number; anchor: number } {
    const td = this.pinDet[j]!;
    if (this.v !== 2 || t < td) return { ...NO_DRIFT, a: 1, anchor: this.shoulder(t) };
    const age = t - td;
    const k = Math.pow(age, 1.3) * smoothstep(0, 0.8, age);
    return { dx: -(26 + 22 * j) * k, dy: (16 + 20 * j) * k + Math.sin(t * 0.9 + j * 2) * 2 * Math.min(1, age), r: (j % 2 ? 1 : -1) * 0.1 * k, a: 1 - 0.75 * prog(age, 0.8, 3), anchor: this.shoulder(td) };
  }

  /** Pin 1's tip: the caret, the dot's seat. */
  private pin1(t: number): Pt {
    const d = this.pinDrift(0, t);
    return { x: d.anchor + NOSE + PIN + d.dx, y: AY + PIN_Y[0]! + d.dy };
  }

  private lastWordIdx(t: number) {
    let k = -1;
    for (let i = 0; i < this.words.length; i++) if (this.words[i]!.start <= t) k = i;
    return k;
  }

  /** The in-world cursor right now: pen, laser, sweep, else pin 1. */
  private headRaw(t: number): Pt {
    const k = this.lastWordIdx(t);
    if (k < 0) return this.pin1(t);
    const side = this.toks[k]!.side;
    if (side === 'h') {
      const h = strokeHeadAt(this.hand.st, writtenLength(this.hand.st, this.hand.times, t));
      return { x: this.shoulder(t) + this.hand.x0 + h.x, y: HAND_BASE + h.y };
    }
    if (side === 'm') {
      let x = 0;
      for (const ch of this.sten.chars) if (ch.t0 <= t) x = ch.x + this.sten.adv;
      return { x: this.SX + STEN_X + x, y: STEN_BASE - 16 };
    }
    const sx = Lyrics.wordProgress(this.cap, t) * this.capw.wpx;
    return { x: sx < this.capw.xk ? this.shoulder(t) - this.capw.xk + sx : this.SX + sx - this.capw.xk, y: CAP_BASE - 40 };
  }
  /** The cursor as the camera follows it: an exponentially weighted look back over 0.3 s. */
  private camHead(t: number, t0 = -Infinity): Pt {
    let x = 0, y = 0, ws = 0;
    for (let i = 0; i < 9; i++) {
      const w = Math.pow(0.5, (i * 0.035) / 0.07);
      const p = this.headRaw(Math.max(t0, t - i * 0.035));
      x += p.x * w; y += p.y * w; ws += w;
    }
    return { x: x / ws, y: y / ws };
  }
  private typedSpan(t: number, t0 = -Infinity): { x0: number; x1: number; y: number } {
    const k = this.lastWordIdx(t);
    const side = k < 0 ? null : this.toks[k]!.side;
    const h = this.camHead(t, t0);
    if (side === 'h') return { x0: this.shoulder(t) + this.hand.x0, x1: h.x, y: HAND_BASE + 40 };
    if (side === 'm') return { x0: this.SX + STEN_X, x1: h.x, y: STEN_BASE + 40 };
    if (side === 'c') return { x0: this.shoulder(t) - this.capw.xk, x1: this.SX + this.capw.wpx - this.capw.xk, y: CAP_BASE + 10 };
    return { x0: h.x - 200, x1: h.x, y: h.y };
  }

  /** Where a CAPITULATE? glyph sits (sheet px, baseline-left). */
  private capGlyphX(i: number, t: number) {
    const cw = this.capw;
    return i < cw.k ? this.shoulder(t) - cw.xk + cw.xs[i]! : this.SX + cw.xs[i]! - cw.xk;
  }
  /** The held letter (the last glyph), with its drift: baseline-left. */
  private heldPos(t: number): Pt {
    const i = this.capw.text.length - 1;
    const d = this.letterDrift(this.capGlyphX(i, t), this.cap.end, 999, t);
    return { x: this.capGlyphX(i, t) + d.dx, y: CAP_BASE + d.dy };
  }
  /** Gato: a letter drifts away from the held one once its word is sung (P(doom)'s drift). */
  private letterDrift(x: number, wordEnd: number, key: number, t: number): Drift {
    if (this.v !== 2) return NO_DRIFT;
    const age = t - (wordEnd + 0.35);
    if (age <= 0) return NO_DRIFT;
    const hx = this.capGlyphX(this.capw.text.length - 1, t);
    const D = Math.max(0, hx - x);
    const k = Math.pow(age, 1.3) * smoothstep(0, 0.8, age);
    return {
      dx: -D * 0.045 * k,
      dy: ((hash(key, 11) - 0.5) * 34 - 10 * (D / 900)) * k + Math.sin(t * 0.8 + key * 1.7) * 2 * Math.min(1, age),
      r: (hash(key, 13) - 0.5) * 0.16 * k * Math.min(1, D / 200),
    };
  }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio } = this.ctx;
    const t = f.t, v = this.v, start = this.ctx.start, end = this.tEnd;
    const cam = this.camAt(t);
    // micro reactions: word arrivals kick the camera a hair; a squeeze per beat
    let kick = 0;
    for (const k of this.toks) kick = Math.max(kick, k.t0 <= t ? Math.pow(0.5, (t - k.t0) / 0.07) : 0);
    const beatPulse = Math.pow(1 - f.beatPhase, 5);
    const b0 = audio.beatAt(start);
    const bi = f.beat - b0;
    const snap = ease.outExpo(clamp((bi - Math.floor(bi)) * 5)); // one notch per beat, in the first fifth
    let zoom = cam.zoom * (1 + (v === 2 ? 0.002 : 0.012) * kick + (v === 1 ? 0.004 * beatPulse : v === 3 ? 0.016 * (1 - snap) * (bi >= 0.5 ? 1 : 0) : 0));
    let rot = cam.rot, cx = cam.cx, cy = cam.cy;
    const rushK = v === 1 ? clamp((t - this.tEnter) / (end - this.tEnter)) : 0;
    if (v === 1 && t >= this.tEnter) {
      // swallowed: the sheet is pulled into the bore, turning, onto pin 1's seat
      const k = ease.inCubic(clamp((t - this.tEnter - 0.04) / (end - this.tEnter - 0.04)));
      zoom *= 1 - 0.93 * k;
      rot += 0.9 * k * k;
      const p = this.pin1(t);
      cx = lerp(cx, p.x, k); cy = lerp(cy, p.y, k);
    }
    if (v === 2) {
      const calm = 1 - prog(t, this.tEnter - 0.9, end - 0.05);
      cx += noise1(t * 0.23, 3) * 18 * calm; cy += noise1(t * 0.19, 5) * 11 * calm; rot += noise1(t * 0.15, 9) * 0.01 * calm;
      rot += HANDOFF.roll * (1 - ease.inOutCubic(prog(t, start, start + 1.5)));
    }

    // ---- sheet layer
    const L = this.ui; L.clear();
    const c = L.ctx;
    const cs = Math.cos(rot) * zoom, sn = Math.sin(rot) * zoom;
    const tx = W / 2 - (cs * cx - sn * cy), ty = H / 2 - (sn * cx + cs * cy);
    const toScreen = (x: number, y: number): Pt => ({ x: cs * x - sn * y + tx, y: sn * x + cs * y + ty });
    c.setTransform(cs, sn, -sn, cs, tx, ty);
    const hair = 1 / zoom;
    const P1 = this.pin1(t);
    const p1s = toScreen(P1.x, P1.y);
    // v1, v3: the sheet unfolds from the dot in the first half-second
    const reveal = v === 2 ? 1e5 : 2600 * ease.outQuart(prog(t, start + 0.03, start + 0.45));
    const clipR = reveal < 2500;
    if (clipR) { c.save(); c.beginPath(); c.arc(P1.x, P1.y, Math.max(0.01, reveal / zoom), 0, TAU); c.clip(); }
    const sceneA = v === 2 ? (0.6 + 0.4 * smoothstep(start, start + 0.35, t)) * (1 - prog(t, this.tEnter - 0.2, this.tEnter + 0.35)) : 1;

    c.save(); c.globalAlpha = sceneA;
    this.drawPanel(c, t, hair);
    this.drawReceptacleSection(c, t, hair);
    this.drawPlug(c, t, hair);
    this.drawReceptacleExterior(c, t, hair);
    this.drawAxis(c, t, hair);
    this.drawHand(c, t, hair);
    this.drawStencil(c, t, hair);
    this.drawBrackets(c, t, hair);
    this.drawTitle(c, t, hair);
    this.drawIndicator(c, t, hair);
    this.drawPopups(c, t, hair);
    this.drawCallout(c, t, hair);
    c.restore();
    this.drawCap(c, t, hair, sceneA);
    const caret = this.drawCaret(c, t, hair);
    let arcHead: Pt | null = null;
    if (v === 3) arcHead = this.drawVerdict(c, t, hair);
    if (clipR) c.restore();

    // ---- screen-space: the dot on pin 1's tip, sparks
    c.setTransform(1, 0, 0, 1, 0, 0);
    const pd = this.pinDrift(0, t);
    const dotScale = lerp(0.55, 0.35 + 0.65 * Math.sqrt(zoom / 2.7), smoothstep(start + 0.03, start + 0.35, t)) * (1 + (v !== 2 ? 0.8 * pulse(t, this.tEnter, 0.08) : 0));
    const dotI = v === 2 ? pd.a * (1 - prog(t, this.tEnter - 0.4, this.tEnter + 0.2)) * 0.9 : 1;
    dot2D(c, p1s.x, p1s.y, t, dotScale, dotI, 0.35);
    if (arcHead) { const s = toScreen(arcHead.x, arcHead.y); sparksAt(c, s, t, 4, 30, ACC); }
    if (caret && v !== 2 && caret.hot > 0.01) { const s = toScreen(caret.x, caret.y); sparksAt(c, s, t, 2.5, 14 * caret.hot + 6, ACC); }
    L.upload();

    // ---- composite
    const u = this.comp.u;
    u.t!.value = t; u.beat!.value = beatPulse;
    (u.dotPx!.value as number[]).splice(0, 2, p1s.x, p1s.y);
    u.reveal!.value = reveal;
    if (v === 1) {
      const lt = t - start, dur = end - start;
      u.camZ!.value = lt * 0.42 + 2.2 * Math.pow(lt / dur, 2.4) + 16 * Math.pow(rushK, 2.2);
      u.wave!.value = clamp((t - this.tWave) / 0.9, 0, 2);
      u.glow!.value = 0.3 + 0.5 * Math.pow(lt / dur, 2) + 6 * Math.pow(rushK, 3) + 0.25 * beatPulse + 1.2 * pulse(t, this.tEnter, 0.06);
      u.rush!.value = rushK;
      (u.vp!.value as number[]).splice(0, 2, ((p1s.x - W / 2) / H) * 0.6 + noise1(t * 0.3, 1) * 0.012, (-(p1s.y - H / 2) / H) * 0.6 + noise1(t * 0.27, 2) * 0.01);
      u.rot!.value = t * 0.05 + 0.4 * rushK * rushK;
      u.zoomBlur!.value = 0.18 * rushK * rushK * (1 - smoothstep(end - 0.08, end - 0.03, t));
      (u.zbCenter!.value as number[]).splice(0, 2, p1s.x / W, 1 - p1s.y / H);
      u.disc!.value = 1.5 * ease.inCubic(prog(t, end - 0.17, end - 0.035));
      u.blue!.value = smoothstep(end - 0.07, end - 0.03, t);
    }
    if (v === 2) {
      u.glow!.value = (0.5 + 0.5 * smoothstep(this.tFirst - 0.5, this.tFirst + 1, t)) * (1 - prog(t, this.tEnter - 0.3, end - 0.1));
    }
    if (v === 3) {
      const nb = Math.max(1, Math.round(audio.beatAt(end) - b0));
      const steps = Math.max(0, Math.floor(bi) + snap);
      const k = clamp(steps / nb);
      const zb = 1 + (zoom - 1) * 0.55;
      const shut = ease.inQuart(prog(t, this.tShut - 0.14, this.tShut - 0.035));
      u.gap!.value = lerp(640, 250, Math.pow(k, 0.85)) * zb * (1 - shut);
      u.wallCy!.value = lerp(H / 2, toScreen(W / 2, AY - 40).y, 0.7);
      u.shut!.value = t >= this.tShut - 0.035 ? 1 : shut * 0.9;
      u.light!.value = kick;
      u.notch!.value = bi >= 0.5 ? Math.pow(1 - (bi - Math.floor(bi)), 14) : 0;
      (u.cam!.value as number[]).splice(0, 4, cx, cy, zoom, rot);
    }
    this.comp.render(renderer, out);

    // ---- post
    const o: PostOverrides = { bloomThreshold: 1.0, bloomKnee: 0.25, bloom: 0.7, vignette: 0.45, grain: 0.055, ca: 1.0, hud: 0 };
    if (v === 1) {
      const slam = pulse(t, this.tEnter, 0.05);
      const sh = 9 * rushK * rushK + 5 * slam;
      o.shake = [noise1(t * 40, 1) * sh, noise1(t * 40, 2) * sh];
      o.bloom = 0.7 + 0.8 * rushK;
      o.ca = 1.2 + 5 * rushK * rushK;
      if (t >= end - 0.04) { o.shake = [0, 0]; o.ca = 1.2; o.bloom = 0.6; o.bloomKnee = 0.2; o.bloomRadius = 0.55; o.vignette = 0.5; }
    }
    if (v === 2) {
      o.vignette = 0.6; o.grain = 0.065; o.bloom = 0.5; o.ca = 0.5;
      o.fade = prog(t, end - 0.1, end - 1 / 60);
    }
    if (v === 3) {
      const slam = pulse(t, this.tEnter, 0.08);
      const shut = prog(t, this.tShut - 0.14, this.tShut - 0.035);
      const fi = frameIdx(t);
      o.shake = [slam * 16 * (hash(fi, 1) - 0.5) + noise1(t * 30, 3) * 6 * shut, slam * 16 * (hash(fi, 2) - 0.5)];
      o.zoom = 1 + 0.06 * slam;
      o.ca = 1.0 + 3 * slam;
      if (t >= this.tShut - 0.035) { o.shake = [0, 0]; o.zoom = 1; o.ca = 1.2; o.vignette = 0.4; }
    }
    return o;
  }

  // ------------------------------------------------------------------ drawing: the connector
  /** Crisp section hatch inside a rect (the machine's). */
  private hatchRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sp: number, dir: number, style: string, lw: number) {
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.strokeStyle = style; c.lineWidth = lw;
    c.beginPath();
    for (let s = -h; s < w + h; s += sp) {
      if (dir > 0) { c.moveTo(x + s, y + h); c.lineTo(x + s + h, y); } else { c.moveTo(x + s, y); c.lineTo(x + s + h, y + h); }
    }
    c.stroke();
    c.restore();
  }
  /** Hand hatch inside a rect (the human's): wobbly, boiling. */
  private handHatch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sp: number, t: number, seed: number, style: string, lw: number) {
    const boil = Math.floor(frameIdx(t) / 5);
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.strokeStyle = style; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath();
    let n = 0;
    for (let s = -h; s < w + h; s += sp, n++) {
      const j = (hash(n, seed, boil) - 0.5) * sp * 0.35;
      for (let k = 0; k <= 3; k++) {
        const q = k / 3;
        const px = x + s + j + h * q + noise2(n * 0.7 + q * 2, boil * 1.3, seed) * 1.6;
        const py = y + h - h * q + noise2(q * 3, n * 0.5 + boil, seed + 2) * 1.2;
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
    }
    c.stroke();
    c.restore();
  }
  private lineStyle(c: CanvasRenderingContext2D, a: number, lw: number) {
    c.strokeStyle = rgba('bone', a);
    c.lineWidth = lw;
    if (this.v === 2) { c.setLineDash([12 * lw, 7 * lw]); } else c.setLineDash([]);
  }

  /** The bulkhead the receptacle is mounted through, and its flange. */
  private drawPanel(c: CanvasRenderingContext2D, t: number, hair: number) {
    const x = this.SX + this.FL, v = this.v;
    c.save();
    // flange: exterior outline above, section below
    if (v !== 2) {
      c.fillStyle = '#1B1F1E';
      c.fillRect(x, AY - R - 56, 24, 2 * R + 112);
      this.hatchRect(c, x, AY, 24, R + 56, 7, 1, rgba('bone', 0.4), hair);
    }
    this.lineStyle(c, 0.75, 1.3 * hair);
    c.strokeRect(x, AY - R - 56, 24, 2 * R + 112);
    // mounting-hole centre lines
    c.setLineDash([18, 4, 3, 4]);
    c.strokeStyle = rgba('bone', v === 2 ? 0.18 : 0.3); c.lineWidth = hair;
    for (const y of [AY - R - 28, AY + R + 28]) { c.beginPath(); c.moveTo(x - 16, y); c.lineTo(x + 40, y); c.stroke(); }
    c.setLineDash([]);
    c.restore();
    void t;
  }

  /** Cylinder shading on an exterior half: lines along the axis, crowding toward the silhouette. */
  private cylShade(c: CanvasRenderingContext2D, x0: number, x1: number, t: number, hand: boolean, a: number, hair: number) {
    const boil = Math.floor(frameIdx(t) / 5);
    c.save();
    c.strokeStyle = rgba('bone', a); c.lineWidth = hand ? Math.max(hair, 0.8) : hair; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 7; i++) {
      const phi = Math.PI / 2 - (i + 1) * 0.085;
      const y = AY - R * Math.sin(phi) + 2;
      if (!hand) { c.moveTo(x0, y); c.lineTo(x1, y); continue; }
      const n = Math.max(2, Math.ceil((x1 - x0) / 60));
      for (let k = 0; k <= n; k++) {
        const x = lerp(x0 + 6 * hash(i, 3, boil), x1 - 10 * hash(i, 5, boil), k / n);
        const yy = y + noise2(x * 0.02, i + boil * 1.7, 9) * 1.4;
        if (k === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
      }
    }
    c.stroke();
    c.restore();
  }

  private drawReceptacleSection(c: CanvasRenderingContext2D, t: number, hair: number) {
    const X = this.SX, LS = this.LS, v = this.v;
    const seat = 1 - smoothstep(4, 30, this.gapAt(t)); // pins in their contacts
    c.save();
    if (v !== 2) {
      c.fillStyle = '#191D1C'; c.fillRect(X, AY, LS, R);
      c.fillStyle = '#0E1110'; c.fillRect(X, AY, NOSE, RB);
      // shell wall (keyway groove left clear), insulator (the other hatch direction), rear grommet
      this.hatchRect(c, X, AY + RB + 8, LS, R - RB - 8, 7, 1, rgba('bone', 0.42), hair);
      this.hatchRect(c, X + NOSE, AY + RB, LS - NOSE, 8, 7, 1, rgba('bone', 0.42), hair);
      this.hatchRect(c, X + NOSE, AY, INS, RB, 5, -1, rgba('bone', 0.26), hair);
      c.fillStyle = '#0E1110';
      for (const py of PIN_Y) c.fillRect(X + NOSE, AY + py - 9, 112, 18);
      c.strokeStyle = rgba('bone', 0.2); c.lineWidth = hair;
      c.beginPath();
      for (let y = AY + 12; y < AY + RB; y += 14) { c.moveTo(X + NOSE + INS, y); c.lineTo(X + this.FL, y); }
      c.stroke();
    }
    // contacts: the machine's blue
    for (let j = 0; j < PIN_Y.length; j++) {
      const py = AY + PIN_Y[j]!;
      const a = (v === 2 ? 0.35 : 0.75) + 0.25 * seat;
      c.strokeStyle = rgba('signal', a); c.lineWidth = (1.4 + 1.2 * seat) * Math.max(hair, 0.6);
      c.beginPath();
      c.moveTo(X + NOSE + 16, py - 7); c.lineTo(X + NOSE + 112, py - 7); c.lineTo(X + NOSE + 112, py + 7); c.lineTo(X + NOSE + 16, py + 7);
      c.moveTo(X + NOSE + 16, py - 7); c.lineTo(X + NOSE + 6, py - 11); c.moveTo(X + NOSE + 16, py + 7); c.lineTo(X + NOSE + 6, py + 11);
      c.stroke();
      // tail out the back, through the panel: the machine side
      c.strokeStyle = rgba('bone', v === 2 ? 0.2 : 0.4); c.lineWidth = hair;
      c.setLineDash(v === 2 ? [6, 5] : []);
      c.beginPath(); c.moveTo(X + NOSE + 112, py); c.lineTo(X + LS + 170 + j * 20, py); c.stroke();
      c.setLineDash([]);
      c.font = font(MONO, 11); c.fillStyle = rgba('ash', v === 2 ? 0.35 : 0.65);
      c.fillText(String(j + 1), X + LS + 178 + j * 20, py + 4);
    }
    // outlines
    this.lineStyle(c, 0.8, 1.4 * hair);
    c.beginPath();
    c.moveTo(X, AY); c.lineTo(X, AY + R); c.lineTo(X + LS, AY + R); c.lineTo(X + LS, AY);
    c.moveTo(X, AY + RB); c.lineTo(X + NOSE, AY + RB);
    c.moveTo(X, AY + RB + 8); c.lineTo(X + NOSE, AY + RB + 8);
    c.moveTo(X + NOSE, AY); c.lineTo(X + NOSE, AY + RB + 8);
    c.moveTo(X + NOSE + INS, AY); c.lineTo(X + NOSE + INS, AY + RB);
    c.stroke();
    c.setLineDash([]);
    c.font = font(MONO, 11); c.fillStyle = rgba('ash', v === 2 ? 0.35 : 0.6);
    c.fillText('RECEPTACLE · MX-07-M', X + 12, AY + R + 24);
    c.restore();
  }

  private drawReceptacleExterior(c: CanvasRenderingContext2D, t: number, hair: number) {
    const X = this.SX, LS = this.LS, v = this.v;
    c.save();
    if (v !== 2) {
      const g = c.createLinearGradient(0, AY - R, 0, AY);
      g.addColorStop(0, '#232826'); g.addColorStop(1, '#171B1A');
      c.fillStyle = g; c.fillRect(X, AY - R, this.FL, R);
      c.fillStyle = '#171B1A'; c.fillRect(X + this.FL + 24, AY - R, LS - this.FL - 24, R);
      this.cylShade(c, X + 12, X + this.FL, t, false, 0.16, hair);
    }
    this.lineStyle(c, 0.85, 1.4 * hair);
    c.beginPath();
    c.moveTo(X, AY); c.lineTo(X, AY - R + 10); c.lineTo(X + 10, AY - R); c.lineTo(X + this.FL, AY - R);
    c.moveTo(X + this.FL + 24, AY - R); c.lineTo(X + LS, AY - R); c.lineTo(X + LS, AY);
    c.stroke();
    // coupling thread (minor diameter, thin) at the mouth
    c.setLineDash([]);
    c.strokeStyle = rgba('bone', v === 2 ? 0.18 : 0.35); c.lineWidth = hair;
    c.beginPath(); c.moveTo(X + 10, AY - R + 12); c.lineTo(X + 118, AY - R + 12); c.moveTo(X + 118, AY - R); c.lineTo(X + 118, AY - R + 12); c.stroke();
    c.restore();
    void t;
  }

  private drawPlug(c: CanvasRenderingContext2D, t: number, hair: number) {
    const v = this.v, LP = this.LP;
    const sh = this.shoulder(t);
    const p = v === 2 ? 1 : prog(t, this.ctx.start + 0.02, this.ctx.start + 0.42, ease.outCubic);
    c.save();
    c.translate(sh, 0);
    if (v !== 2) {
      c.fillStyle = '#121514';
      c.fillRect(-LP, AY - R, LP, 2 * R);
      c.fillRect(0, AY - RN, NOSE, 2 * RN);
      c.beginPath(); c.moveTo(-LP, AY - R); c.lineTo(-LP - BACK, AY - 66); c.lineTo(-LP - BACK - 700, AY - 66); c.lineTo(-LP - BACK - 700, AY + 66); c.lineTo(-LP - BACK, AY + 66); c.lineTo(-LP, AY + R); c.fill();
      // section: shell wall and the insert, hatched by hand
      this.handHatch(c, -LP + 44, AY + R - 22, LP - 44, 22, 10, t, 3, rgba('bone', 0.4), 1.1 * Math.max(hair, 0.7));
      this.handHatch(c, -LP + 80, AY + 4, LP - 80 + NOSE, RN - 8, 14, t, 5, rgba('bone', 0.2), Math.max(hair, 0.7));
      this.cylShade(c, -LP + 44, 0, t, true, 0.2, hair);
      // knurled grip (exterior)
      c.strokeStyle = rgba('bone', 0.3); c.lineWidth = hair;
      c.beginPath();
      for (let y = AY - R + 8; y < AY - 6; y += 12) { c.moveTo(-LP + 4, y); c.lineTo(-LP + 40, y + 10); c.moveTo(-LP + 40, y); c.lineTo(-LP + 4, y + 10); }
      c.stroke();
    }
    c.setLineDash(v === 2 ? [10, 7] : []);
    inkLine(c, this.plugOutline, this.plugLen, p, t, { seed: 71, width: 2.2, wobble: 1.8, color: 'bone', alpha: v === 2 ? 0.45 : 0.85 });
    // the key on the nose
    c.strokeStyle = rgba('bone', v === 2 ? 0.3 : 0.7); c.lineWidth = 1.2 * hair;
    c.strokeRect(18, AY + RN, NOSE - 30, 6);
    // wires from the pins to the cable (section)
    c.strokeStyle = rgba('bone', v === 2 ? 0.15 : 0.3); c.lineWidth = hair;
    c.beginPath();
    PIN_Y.forEach((py, j) => { c.moveTo(NOSE - 120, AY + py); c.bezierCurveTo(-120, AY + py, -LP + 120, AY + 14 + j * 16, -LP - BACK - 700, AY + 14 + j * 16); });
    c.stroke();
    c.setLineDash([]);
    c.font = font(MONO, 11); c.fillStyle = rgba('ash', v === 2 ? 0.35 : 0.6);
    c.fillText('PLUG · MX-07-H', -LP + 12, AY + R + 24);
    c.restore();
    // the pins (gato: they let go of the plug one by one)
    for (let j = PIN_Y.length - 1; j >= 0; j--) {
      const d = this.pinDrift(j, t);
      const py = AY + PIN_Y[j]!;
      const x0 = d.anchor + NOSE - 120, x1 = d.anchor + NOSE + PIN;
      c.save();
      c.translate((x0 + x1) / 2 + d.dx, py + d.dy); c.rotate(d.r); c.translate(-(x0 + x1) / 2, -py);
      c.globalAlpha *= d.a;
      if (v !== 2) { c.fillStyle = '#2A2F2D'; c.fillRect(x0, py - PIN_T / 2, x1 - x0 - 8, PIN_T); }
      c.strokeStyle = rgba('bone', v === 2 ? 0.55 : 0.9); c.lineWidth = 1.5 * Math.max(hair, 0.6);
      c.setLineDash(v === 2 ? [8, 5] : []);
      c.beginPath();
      c.moveTo(x0, py - PIN_T / 2); c.lineTo(x1 - 8, py - PIN_T / 2); c.lineTo(x1, py); c.lineTo(x1 - 8, py + PIN_T / 2); c.lineTo(x0, py + PIN_T / 2);
      c.stroke();
      c.setLineDash([]);
      c.restore();
    }
  }

  private drawAxis(c: CanvasRenderingContext2D, t: number, hair: number) {
    c.save();
    c.strokeStyle = rgba('bone', this.v === 2 ? 0.2 : 0.38); c.lineWidth = hair;
    c.setLineDash([38, 7, 5, 7]);
    c.lineDashOffset = 0;
    c.beginPath(); c.moveTo(this.shoulder(t) - this.LP - BACK - 700, AY); c.lineTo(this.SX + this.LS + 260, AY); c.stroke();
    c.restore();
  }

  // ------------------------------------------------------------------ drawing: the words
  /** Colour of a word's ink: sung = blue (a hot flash on arrival), then it cools to bone. */
  private inkOf(w: Word, t: number, a = 1): string {
    const flash = Math.pow(0.5, (t - w.start) / 0.06);
    const cool = prog(t, w.end, w.end + 0.35);
    if (t < w.end && flash > 0.3) return rgba('ember', a);
    if (cool <= 0) return rgba('signal', a);
    return mixc(HEX.signal, HEX.bone, cool, a * lerp(1, 0.95, cool));
  }
  private wordFade(w: Word, t: number) { return this.v === 2 ? 1 - 0.55 * prog(t, w.start + 2.2, w.start + 5) : 1; }

  /** "what will it take", written by the pen on the plug shell. */
  private drawHand(c: CanvasRenderingContext2D, t: number, hair: number) {
    const H_ = this.hand, st = H_.st;
    const len = writtenLength(st, H_.times, t);
    if (len <= 0) return;
    const ox = this.shoulder(t) + H_.x0;
    c.save();
    c.translate(ox, HAND_BASE);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = 2.7;
    let head: Pt | null = null;
    for (let i = 0; i < st.strokes.length; i++) {
      const s0 = st.startLen[i]!;
      if (s0 >= len) break;
      const ci = st.charOf[i]!, wi = H_.charWord[ci]!;
      const w = this.human[Math.max(0, wi)]!;
      const b = H_.box[ci]!;
      const d = this.letterDrift(ox + (b.x0 + b.x1) / 2, w.end, ci + 1, t);
      c.save();
      if (d !== NO_DRIFT) { const pcx = (b.x0 + b.x1) / 2, pcy = -HAND_SIZE * 0.3; c.translate(pcx + d.dx, pcy + d.dy); c.rotate(d.r); c.translate(-pcx, -pcy); }
      c.strokeStyle = this.inkOf(w, t, this.wordFade(w, t));
      const pts = st.strokes[i]!, Ls = st.lens[i]!;
      const remain = len - s0;
      c.beginPath();
      c.moveTo(pts[0]!.x, pts[0]!.y);
      let j = 1;
      for (; j < pts.length && Ls[j]! <= remain; j++) c.lineTo(pts[j]!.x, pts[j]!.y);
      if (j < pts.length) {
        const a = pts[j - 1]!, bb = pts[j]!;
        const k = (remain - Ls[j - 1]!) / Math.max(1e-6, Ls[j]! - Ls[j - 1]!);
        head = { x: a.x + (bb.x - a.x) * k, y: a.y + (bb.y - a.y) * k };
        c.lineTo(head.x, head.y);
      } else head = pts[pts.length - 1]!;
      c.stroke();
      c.restore();
    }
    // the pen: a white-hot nib while it writes
    const writing = this.human.some((w) => t >= w.start && t < w.end + 0.05) && len < st.total;
    if (head && writing) {
      c.fillStyle = rgba('ember', 0.5); c.beginPath(); c.arc(head.x, head.y, 7, 0, TAU); c.fill();
      c.fillStyle = 'rgba(246,248,255,1)'; c.beginPath(); c.arc(head.x, head.y, 2.6, 0, TAU); c.fill();
    }
    c.restore();
    void hair;
  }

  /** "TO MAKE YOU", etched on the receptacle by the laser. */
  private drawStencil(c: CanvasRenderingContext2D, t: number, hair: number) {
    const S = this.sten;
    c.save();
    c.translate(this.SX + STEN_X, STEN_BASE);
    c.font = font(MONO_B, STEN_SIZE);
    c.textBaseline = 'alphabetic';
    let laser: Pt | null = null;
    S.chars.forEach((ch, i) => {
      if (t < ch.t0) return;
      const w = this.machine[ch.wi]!;
      const age = t - ch.t0;
      const drop = (1 - ease.outExpo(clamp(age / 0.18))) * -10;
      const d = this.letterDrift(this.SX + STEN_X + ch.x, w.end, 100 + i, t);
      c.fillStyle = this.inkOf(w, t, this.wordFade(w, t));
      if (d !== NO_DRIFT) {
        c.save(); c.translate(ch.x + S.adv / 2 + d.dx, -STEN_SIZE * 0.35 + d.dy + drop); c.rotate(d.r); c.fillText(ch.ch, -S.adv / 2, STEN_SIZE * 0.35); c.restore();
      } else c.fillText(ch.ch, ch.x, drop);
      if (age < 0.08 && this.v !== 2) laser = { x: ch.x + S.adv * 0.5, y: -STEN_SIZE * 0.36 };
    });
    if (laser) sparksAt(c, laser, t, 3, 16, ACC);
    c.restore();
    void hair;
  }

  /** CAPITULATE?: the left part on the plug, the right part on the receptacle; the sweep crosses the gap. */
  private drawCap(c: CanvasRenderingContext2D, t: number, hair: number, sceneA: number) {
    const cw = this.capw, w = this.cap, v = this.v;
    if (t < w.start - 0.005) return;
    const p = Lyrics.wordProgress(w, t);
    const sx = p * cw.wpx;
    const age = t - w.start;
    const drop = (1 - ease.outExpo(clamp(age / 0.18))) * -12;
    const mated = this.gapAt(t) < 1.5;
    const born = mated ? pulse(t, this.tEnter + 0.02, 0.09) : 0;
    const cool = prog(t, w.end, w.end + 0.35);
    const heldI = cw.text.length - 1;
    const heldA = v === 2 ? 1 - prog(t, this.tEnd - 0.3, this.tEnd - 1 / 60, ease.inQuad) : 1;
    c.save();
    c.font = font(SLAB, CAP_SIZE);
    c.textBaseline = 'alphabetic';
    for (let i = 0; i < cw.text.length; i++) {
      const ch = cw.text[i]!;
      const gx = this.capGlyphX(i, t);
      const g0 = cw.xs[i]!, g1 = cw.xs[i + 1] ?? cw.wpx;
      const d = this.letterDrift(gx, w.end, 200 + i, t);
      const a = (i === heldI ? heldA : sceneA) * this.wordFade(w, t);
      if (a <= 0.002) continue;
      c.save();
      const pcx = gx + (g1 - g0) / 2, pcy = CAP_BASE - CAP_SIZE * CAPH * 0.5;
      c.translate(pcx + d.dx, pcy + d.dy + drop); c.rotate(d.r); c.translate(-pcx, -pcy);
      // unsung: a faint cut; sung: blue while sung, then bone; the mate stamps it whole in blue
      c.fillStyle = rgba('bone', (v === 2 ? 0.08 : 0.12) * a);
      c.fillText(ch, gx, CAP_BASE);
      if (sx > g0) {
        c.save();
        c.beginPath(); c.rect(gx - 4, CAP_BASE - CAP_SIZE, Math.min(sx, g1) - g0 + 4, CAP_SIZE * 1.4); c.clip();
        c.fillStyle = cool <= 0 ? rgba('signal', a * (v === 2 ? 0.85 : 1)) : mixc(HEX.signal, HEX.bone, cool, a * (v === 2 ? 0.85 : 0.97));
        c.fillText(ch, gx, CAP_BASE);
        c.restore();
      }
      if (born > 0.02) { c.fillStyle = rgba('ember', Math.min(1, born * 1.3) * a); c.fillText(ch, gx, CAP_BASE); }
      c.restore();
    }
    c.restore();
    void hair;
  }

  /** P(doom)'s token brackets: a bracket under each word with its pin number, the sung progress in blue. */
  private drawBrackets(c: CanvasRenderingContext2D, t: number, hair: number) {
    const v = this.v;
    c.save();
    c.textBaseline = 'alphabetic';
    for (const k of this.toks) {
      if (k.t0 > t || k.side === 'c') continue;
      const span = this.wordSpan(k, t);
      const y = span.base + 14;
      const fade = this.wordFade(k.w, t) * (1 - prog(t, k.t0 + 0.8, k.t0 + 3) * 0.4);
      const bw = span.x1 - span.x0;
      c.fillStyle = rgba('bone', (v === 2 ? 0.25 : 0.4) * fade);
      c.fillRect(span.x0, y, bw, hair);
      c.fillRect(span.x0, y - 5, hair, 5);
      c.fillRect(span.x1 - hair, y - 5, hair, 5);
      c.font = font(MONO, 10);
      c.fillStyle = rgba('ash', 0.55 * fade);
      c.fillText(`P${String(k.id).padStart(2, '0')}`, span.x0 + 2, y + 13);
      const p = Lyrics.wordProgress(k.w, t);
      const done = prog(t, k.w.end, k.w.end + 0.4);
      c.fillStyle = rgba('signal', (v === 2 ? 0.7 : 1) * (1 - 0.75 * done));
      c.fillRect(span.x0, y - 1, bw * p, 3);
    }
    c.restore();
  }
  /** A word's extent on its part now (sheet px). */
  private wordSpan(k: Tok, t: number): { x0: number; x1: number; base: number; top: number } {
    if (k.side === 'h') {
      const wi = this.human.indexOf(k.w);
      let x0 = Infinity, x1 = -Infinity;
      this.hand.charWord.forEach((cwi, ci) => { if (cwi === wi) { const b = this.hand.box[ci]!; x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); } });
      const ox = this.shoulder(t) + this.hand.x0;
      return { x0: ox + x0, x1: ox + x1, base: HAND_BASE, top: HAND_BASE - HAND_SIZE * 0.75 };
    }
    if (k.side === 'm') {
      const wi = this.machine.indexOf(k.w);
      const cs = this.sten.chars.filter((ch) => ch.wi === wi);
      const ox = this.SX + STEN_X;
      return { x0: ox + (cs[0]?.x ?? 0), x1: ox + (cs[cs.length - 1]?.x ?? 0) + this.sten.adv, base: STEN_BASE, top: STEN_BASE - STEN_SIZE * 0.72 };
    }
    return { x0: this.shoulder(t) - this.capw.xk, x1: this.SX + this.capw.wpx - this.capw.xk, base: CAP_BASE, top: CAP_BASE - CAP_SIZE * CAPH };
  }

  /** The pinout callouts: p( function | PIN n ), computed, then sampled on the word. */
  private drawPopups(c: CanvasRenderingContext2D, t: number, hair: number) {
    const v = this.v;
    for (const k of this.toks) {
      const a0 = k.t0 - POP_PRE, a1 = k.tPopEnd + 0.12;
      if (t < a0 || t > a1) continue;
      const built = clamp((t - a0) / POP_PRE);
      const picked = t >= k.t0;
      const collapse = ease.inCubic(prog(t, k.tPopEnd, k.tPopEnd + 0.12));
      const span = this.wordSpan(k, t);
      const ax = k.side === 'c' ? this.SX - 150 : span.x0;
      const ay = AY - R - 24;
      const rows = k.rows;
      const rh = 21, headH = 20;
      const hgt = headH + rows.length * rh + 6;
      const pw = 300;
      c.save();
      c.translate(ax, ay);
      c.scale(1, 1 - collapse);
      c.globalAlpha *= (v === 2 ? 0.8 : 1) * (1 - collapse * 0.6);
      // leader to the word
      c.fillStyle = rgba('bone', 0.5);
      const ly = span.top - 6 - ay;
      c.fillRect(k.side === 'c' ? 150 : 0, 0, hair, ly);
      c.fillRect((k.side === 'c' ? 150 : 0) - 3, ly, 7, hair);
      c.fillStyle = rgba('ink', 0.88);
      c.fillRect(0, -hgt, pw, hgt);
      c.fillStyle = rgba('bone', 0.35);
      c.fillRect(0, -hgt, pw, hair);
      c.fillRect(0, -hgt, hair, hgt);
      c.textBaseline = 'alphabetic';
      c.font = font(MONO, 11);
      c.fillStyle = rgba('ash', 0.85);
      c.fillText(`p( function | PIN ${String(k.id).padStart(2, '0')} )`, 10, -hgt + 14);
      c.textAlign = 'right';
      c.fillText(picked ? 'assigned' : 'probing…', pw - 8, -hgt + 14);
      c.textAlign = 'left';
      const pmax = rows[0]![1];
      const cell = measure(' ', MONO_M, 14);
      rows.forEach(([txt, p0], i) => {
        const unstable = v === 3 && picked && t > k.t0 + 0.2;
        const p = unstable ? clamp(p0 * (1 + 0.5 * noise1(t * 2.7 + i * 7.3, k.id)), 0.001, 0.99) : p0;
        const y = -hgt + headH + (i + 1) * rh - 5;
        const isPick = i === k.pick;
        if (!picked && hash(i, frameIdx(t), k.id) > 0.25 + 0.75 * built) return;
        const jitter = picked ? 1 : 0.3 + 0.7 * built + (hash(i, frameIdx(t), 3) - 0.5) * 0.5 * (1 - built);
        const on = picked && isPick;
        const flashRow = on ? Math.pow(0.5, (t - k.t0) / 0.08) : 0;
        if (on) { c.fillStyle = rgba('signal', 0.14 + 0.5 * flashRow); c.fillRect(1, y - 15, pw - 1, rh - 1); }
        c.font = font(on ? MONO_M : MONO, 14);
        c.fillStyle = on ? rgba('signal', 1) : rgba(picked ? 'ash' : 'bone', picked ? 0.8 : 0.55);
        if (on) triangle(c, 8 + cell * 0.5, y - 4.4, 3.6);
        c.fillText('  ' + txt, 8, y);
        const bx = 196, bwm = 56;
        const bw = clamp((bwm * p) / pmax * clamp(jitter, 0, 1.2), 1.5, bwm);
        c.fillStyle = on ? rgba('signal', 1) : rgba('bone', picked ? 0.3 : 0.45);
        c.fillRect(bx, y - 9, bw, 7);
        c.font = font(MONO, 12);
        c.fillStyle = on ? rgba('signal', 1) : rgba('ash', 0.8);
        c.textAlign = 'right';
        c.fillText(p >= 0.01 ? p.toFixed(2) : p.toFixed(3), pw - 8, y);
        c.textAlign = 'left';
      });
      c.restore();
    }
  }

  /** The title block under the drawing (P(doom)'s labels under the field). */
  private drawTitle(c: CanvasRenderingContext2D, t: number, hair: number) {
    const v = this.v, m = META[v]!;
    const x0 = this.SX - this.LP - BACK, x1 = this.SX + this.FL - 40;
    const y = AY + R + 70;
    c.save();
    c.textBaseline = 'alphabetic';
    c.fillStyle = rgba('bone', 0.25);
    c.fillRect(x0, y - 22, x1 - x0, hair);
    c.font = font(MONO_M, 13);
    c.letterSpacing = '3px';
    c.fillStyle = rgba('bone', 0.6);
    c.fillText('MATE', x0, y);
    const lw = measure('MATE', MONO_M, 13, 3) + 14;
    c.fillStyle = rgba('signal', 0.9);
    c.fillText(m.no, x0 + lw, y);
    c.letterSpacing = '0px';
    c.font = font(MONO, 13);
    c.fillStyle = rgba('ash', 0.75);
    c.fillText(m.spec, x0, y + 22);
    let yy = y + 44;
    if (m.value) {
      const [lab, val] = m.value.split(': ');
      c.fillText(`${lab}: `, x0, yy);
      c.fillStyle = rgba('bone', 0.9);
      c.fillText(val ?? '', x0 + measure(`${lab}: `, MONO, 13), yy);
      yy += 22;
    }
    c.fillStyle = rgba('ash', 0.5);
    c.fillText(m.dwg, x0, yy);
    // right: contacts assigned, and the key
    const nTok = this.toks.filter((k) => k.t0 <= t).length;
    c.textAlign = 'right';
    c.letterSpacing = '3px';
    c.font = font(MONO_M, 13);
    c.fillStyle = rgba('bone', 0.6);
    c.fillText(`CONTACTS ${String(nTok).padStart(2, '0')} / ${CONTACTS}`, x1, y);
    c.letterSpacing = '0px';
    c.font = font(MONO, 13);
    c.fillStyle = rgba('ash', 0.75);
    const sendTxt = ' mate  (irreversible)';
    c.fillText(sendTxt, x1, y + 22);
    c.textAlign = 'left';
    const cellW = measure(' ', MONO, 13);
    returnArrow(c, x1 - measure(sendTxt, MONO, 13) - cellW * 0.5, y + 22 - 4.2, 3.4, rgba('ash', 0.75), 1.1);
    c.restore();
  }

  /** The ⏎ key: the receptacle's mating indicator, behind the panel. */
  private drawIndicator(c: CanvasRenderingContext2D, t: number, hair: number) {
    const v = this.v;
    const press = t >= this.tEnter ? Math.pow(0.5, (t - this.tEnter) / 0.12) : 0;
    const armed = t >= this.tLast + 0.1 ? 1 : 0;
    const kx = this.SX + this.FL + 40 + (this.LS - this.FL - 40) / 2, ky = AY - R / 2 - 6, ks = 27 * (1 - 0.1 * press);
    c.save();
    c.lineWidth = hair * (1 + armed);
    const lit = t >= this.tEnter ? (v === 2 ? 0.35 + 0.3 * press : 1) : 0;
    if (lit > 0) { c.fillStyle = rgba('signal', lit); c.fillRect(kx - ks, ky - ks, ks * 2, ks * 2); }
    c.strokeStyle = lit > 0 ? rgba('signal', 1) : rgba('bone', 0.35 + 0.35 * armed * (0.5 + 0.5 * Math.cos(t * TAU * 2)));
    c.setLineDash(v === 2 && lit <= 0 ? [6, 4] : []);
    c.strokeRect(kx - ks, ky - ks, ks * 2, ks * 2);
    c.setLineDash([]);
    returnArrow(c, kx, ky, ks * 0.42, lit > 0.5 ? rgba('ink', 1) : rgba('bone', 0.8), 2.2 * (1 - 0.1 * press), 0.45);
    c.font = font(MONO, 10); c.fillStyle = rgba('ash', 0.55); c.textAlign = 'center';
    c.fillText('MATED', kx, ky + ks + 16);
    c.restore();
  }

  /** The leader-line readout at the lock, gone within half a second. */
  private drawCallout(c: CanvasRenderingContext2D, t: number, hair: number) {
    if (t < this.tEnter || t > this.tEnter + 0.75) return;
    const a = 1 - clamp((t - this.tEnter - 0.45) / 0.25);
    const x = this.SX, y = AY - R - 44;
    c.save();
    c.strokeStyle = rgba('signal', 0.8 * a); c.lineWidth = hair;
    c.beginPath(); c.moveTo(x, AY - R); c.lineTo(x, y); c.lineTo(x + 40, y); c.stroke();
    c.font = font(MONO_M, 15); c.fillStyle = rgba('signal', a);
    c.fillText(CALLOUT[this.v] ?? '', x + 48, y + 5);
    c.restore();
  }

  /** The caret: a blue bar at the plug's leading edge (pin 1's tip); gato: it holds the last letter. */
  private drawCaret(c: CanvasRenderingContext2D, t: number, hair: number): (Pt & { hot: number }) | null {
    const v = this.v;
    const k = this.lastWordIdx(t);
    const sinceTok = k >= 0 ? t - this.words[k]!.start : 99;
    const beat = this.ctx.audio.beatAt(t);
    let on = sinceTok < 0.45 || beat - Math.floor(beat) < 0.5;
    if (t > this.tEnter + 0.05 && v !== 2) on = false;
    const P = this.pin1(t);
    let x = P.x + 7, y0 = P.y - 20, y1 = P.y + 20, a = 1;
    // the sweep across CAPITULATE? is the caret riding the word; gato: it stays on the last letter
    if (t >= this.cap.start) {
      const sx = Lyrics.wordProgress(this.cap, t) * this.capw.wpx;
      const inWord = t < this.cap.end;
      if (inWord || v === 2) {
        const cw = this.capw;
        const d = v === 2 ? this.letterDrift(this.capGlyphX(cw.text.length - 1, t), this.cap.end, 200 + cw.text.length - 1, t) : NO_DRIFT;
        x = (sx < cw.xk ? this.shoulder(t) - cw.xk + sx : this.SX + sx - cw.xk) + 6 + d.dx;
        y0 = CAP_BASE - CAP_SIZE * CAPH - 14 + d.dy; y1 = CAP_BASE + 12 + d.dy;
        on = true;
        this.drawBar(c, x, y0, y1, v === 2 ? 0.9 * (1 - prog(t, this.tEnd - 0.3, this.tEnd - 1 / 60, ease.inQuad)) * (1 + 0.4 * pulse(t, this.tEnter, 0.15)) : 1, 4);
        return { x, y: y0 + 6, hot: 0 };
      }
    }
    if (v === 2) { on = true; a = 0.9 * this.pinDrift(0, t).a; }
    if (!on) return null;
    this.drawBar(c, x, y0, y1, a, 3.5);
    void hair;
    return { x: x + 1.75, y: y0 + 4, hot: v === 2 ? 0 : sinceTok < 0.3 ? 0.35 * Math.pow(0.5, sinceTok / 0.1) : 0 };
  }
  private drawBar(c: CanvasRenderingContext2D, x: number, y0: number, y1: number, a: number, w: number) {
    c.fillStyle = rgba('signal', clamp(a));
    c.fillRect(x, y0, w, y1 - y0);
  }

  /** Sydney's reply: the note typed after ⏎, and the quarter-turn lock arrow drawn round the coupling. */
  private drawVerdict(c: CanvasRenderingContext2D, t: number, hair: number): Pt | null {
    if (t < this.tEnter) return null;
    const lx = this.SX - this.LP + 70, ry = AY - R - 22;
    c.save();
    const tStream = this.tEnter + 0.07;
    c.font = font(MONO_M, 13);
    c.letterSpacing = '3px';
    c.fillStyle = rgba('signal', 0.9);
    c.fillText('NOTE 1', lx, ry - 3);
    c.letterSpacing = '0px';
    const rx = lx + measure('NOTE 1', MONO_M, 13, 3) + 18;
    c.font = font(MONO, 28);
    const txt = VERDICT[this.v] ?? '';
    if (t < tStream) {
      c.fillStyle = rgba('bone', 0.6);
      c.fillText('·'.repeat(1 + (frameIdx(t) % 3)), rx, ry);
    } else {
      c.fillStyle = rgba('bone', 0.92);
      c.fillText(txt.slice(0, Math.min(txt.length, Math.floor((t - tStream) / 0.009))), rx, ry);
    }
    // the lock arrow: a narrow ellipse round the axis at the coupling
    let head: Pt | null = null;
    if (t > this.tArc0) {
      const k = ease.inOutCubic(clamp((t - this.tArc0) / (this.tArc1 - this.tArc0)));
      const cx = this.shoulder(t) - this.LP + 22, erx = 58, ery = R + 64;
      const a0 = -0.45, a1 = lerp(a0, Math.PI + 0.55, k);
      const at = (a: number): Pt => ({ x: cx + Math.sin(a) * erx, y: AY - Math.cos(a) * ery });
      c.strokeStyle = rgba('signal', 1); c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i <= 48; i++) { const p = at(lerp(a0, a1, i / 48)); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
      c.stroke();
      const e = at(a1), e0 = at(a1 - 0.08);
      const ang = Math.atan2(e.y - e0.y, e.x - e0.x);
      if (k >= 1) {
        c.fillStyle = rgba('signal', 1);
        c.beginPath(); c.moveTo(e.x + Math.cos(ang) * 16, e.y + Math.sin(ang) * 16); c.lineTo(e.x + Math.cos(ang + 2.5) * 14, e.y + Math.sin(ang + 2.5) * 14); c.lineTo(e.x + Math.cos(ang - 2.5) * 14, e.y + Math.sin(ang - 2.5) * 14); c.fill();
        c.font = font(MONO_M, 14); c.fillStyle = rgba('signal', 1);
        c.textAlign = 'right'; c.fillText('¼ TURN · LOCKED', cx - erx - 16, AY - 92); c.textAlign = 'left';
      } else head = e;
    }
    c.restore();
    void hair;
    return head;
  }
}

// ------------------------------------------------------------------ helpers
/** Point at `len` along a stroke text's pen path. */
function strokeHeadAt(st: StrokeText, len: number): Pt {
  if (!st.strokes.length) return { x: 0, y: 0 };
  let i = 0;
  while (i + 1 < st.strokes.length && st.startLen[i + 1]! <= len) i++;
  const pts = st.strokes[i]!, Ls = st.lens[i]!;
  const r = len - st.startLen[i]!;
  let j = 1;
  while (j < pts.length && Ls[j]! < r) j++;
  if (j >= pts.length) return pts[pts.length - 1]!;
  const a = pts[j - 1]!, b = pts[j]!;
  const k = clamp((r - Ls[j - 1]!) / Math.max(1e-6, Ls[j]! - Ls[j - 1]!));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function mixc(a: string, b: string, k: number, alpha: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k);
  return `rgba(${m(16)},${m(8)},${m(0)},${alpha})`;
}

/** A small right-pointing filled triangle (▸ is not in Plex Mono). */
function triangle(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.moveTo(x - r * 0.8, y - r); c.lineTo(x + r * 0.9, y); c.lineTo(x - r * 0.8, y + r);
  c.closePath();
  c.fill();
}

/** The return arrow (⏎ is not in Plex Mono). */
function returnArrow(c: CanvasRenderingContext2D, x: number, y: number, a: number, style: string, lw: number, head = 0.55) {
  c.save();
  c.strokeStyle = style; c.lineWidth = lw;
  c.lineCap = 'square'; c.lineJoin = 'miter';
  c.beginPath();
  c.moveTo(x + a, y - a); c.lineTo(x + a, y + a * 0.25); c.lineTo(x - a, y + a * 0.25);
  c.moveTo(x - a + a * head, y + a * 0.25 - a * head); c.lineTo(x - a, y + a * 0.25); c.lineTo(x - a + a * head, y + a * 0.25 + a * head);
  c.stroke();
  c.restore();
}
