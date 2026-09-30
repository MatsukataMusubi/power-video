// verseA — PATENT (verse 2, first half). Structure: P(doom)'s bureau, state for state
// (docs/PDOOM-STRUCTURE.md); imagery: a patent application, APPARATUS FOR APPRECIATING POWER
// (docs/PLATES.md #7). Bone paper, black line art; the blue is the only colour and the dot the only light.
// One continuous document read by a restless 2D camera, one block per sung line, moving down:
//   A  the typewritten claims page. Frame 1 is the drop's line, now the page's first rule (it cools
//      from blue to ink); the camera pulls back off it onto the title, then snaps to claim 1, where the
//      typewriter types line 1 into the claim (the carriage and its blue type guide are the cursor; the
//      sung word is in the blue half of the ribbon). The machine rattles off claim 2 by itself: "…rated
//      power not less than 0.7 kW" (the value). Instrumental gap: a hard cut wide as the examiner's
//      stamp slams (INOPERABLE: the office's real ground against perpetual motion); a snap to the
//      examiner's pencil note; a whip-pan down the page.
//   B  the drawing sheet, Sheet 1 of 3: FIG. 1, the exploded assembly (our parts). The parts step apart
//      on the beats, a reference numeral pops on each, the camera snaps out per beat; hard cut to the
//      title block as the machine types itself in as the second inventor; hard cut wide on the downbeat:
//      INVENTOR MUST BE A NATURAL PERSON (Thaler v. Vidal, 2022), the plate's one maximal hit. Line 2
//      is lettered by a drafting pen in the figure's description; the pen draws on into a leader line
//      whose end point, inside the ring, is the dot. The gap after it: the leader's landing replayed
//      three times (time stutter), then the page rips and the halves fall into black (verseB opens
//      from black).
// Rendering as bureau: every ink on one Canvas2D layer as channel-coded coverage (R typewriter ink,
// G printed/drawn ink, B the blue), composited onto procedural paper by a shader, then a tear pass.
// All times come from the lyrics (lines found by position in the window) and the beat grid.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, makeRT } from '../engine/gl';
import type { Line, Word } from '../engine/lyrics';
import { F, font, measure, plain } from '../engine/type';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { clamp, ease, lerp, prog, hash, pulse, TAU, frameIdx } from '../engine/util';
import { paperPass, tearPass } from './patent-gl';
import { TYPE, PRINT, BLUE, stack, dotAt, drawAssembly, makeCallouts, drawCallout, type Callout, type Stack, type P2 } from './patent-fig';

type Ctx2 = CanvasRenderingContext2D;
interface Cam { x: number; y: number; z: number; r: number }
interface TypeChar { ch: string; t: number; x: number; y: number; dens: number; jx: number; jy: number; rot: number; w: number; blue: boolean }

// ---- page geometry (page px). Section A (claims) is centred on 0,0; sheet B on (0, BY).
const BY = 1750;
const RULE_Y = -560;                       // the claims page's first rule: the drop's line
const TS = 46, ADV = TS * 0.6;             // the typewriter (IBM Plex Mono is 0.6 em wide)
const X0 = -700;                           // claims: left edge of the typing
const ROWS = [-250, -170, -90, 10, 90];    // claim 1 (3 rows), claim 2 (2 rows)
const PRE = '1. An apparatus for appreciating power, wherein';
const CLAIM2 = ['2. The apparatus of claim 1, having a rated', '   power not less than Kardashev type I.'];
const VALUE = 'Kardashev type I';
const TITLE = 'APPARATUS FOR APPRECIATING POWER';
const TB = { x0: -60, x1: 740, y0: 560, y1: 776, r1: 606, r2: 740, col: 462 };   // sheet B title block
const TB_TS = 26, TB_ADV = TB_TS * 0.6;
const INV_ROWS = [670, 721];
const DESC = { x: -700, y: 474 };          // sheet B: the figure description (line 2), baseline
const STAMP_A = { x: 250, y: -150, hw: 332, hh: 118, rot: -0.09 };
const STAMP_B = { x: 372, y: BY + 698, hw: 384, hh: 126, rot: -0.07 };
const NOTE = { x: 130, y: 214, lead: 58, rot: -0.035, size: 46 };
const LOOP = { x: X0 + 20 * ADV + 6 * ADV, y: ROWS[0]! - 14, rx: 196, ry: 38 };  // pencil loop around "appreciating"

// camera framings (page px)
const C0: Cam = { x: -60, y: RULE_Y, z: 6, r: 0 };              // frame 1: nothing but the rule
const C1: Cam = { x: -20, y: -430, z: 1.25, r: -0.02 };           // the page head
const WIDE_A: Cam = { x: 60, y: -120, z: 1.0, r: -0.014 };
const NOTE_C: Cam = { x: 250, y: 40, z: 1.36, r: -0.028 };
const FIG1: Cam = { x: -160, y: BY - 350, z: 1.75, r: 0.02 };
const FIG2: Cam = { x: -150, y: BY - 280, z: 1.22, r: 0.008 };
const FIG3: Cam = { x: -110, y: BY - 190, z: 0.9, r: -0.004 };
const HIT_C: Cam = { x: 360, y: BY + 690, z: 1.68, r: -0.012 };
const REVEAL_C: Cam = { x: 0, y: BY - 20, z: 0.655, r: 0.008 };
const PUNCH_C: Cam = { x: 110, y: BY - 45, z: 0.82, r: -0.004 };

type Xf = { a: number; b: number; c: number; d: number; e: number; f: number };
function camXf(cam: Cam, shx = 0, shy = 0): Xf {
  const cs = Math.cos(cam.r) * cam.z, sn = Math.sin(cam.r) * cam.z;
  const a = cs, b = sn, c = -sn, d = cs;
  return { a, b, c, d, e: W / 2 + shx - (a * cam.x + c * cam.y), f: H / 2 + shy - (b * cam.x + d * cam.y) };
}
function invXf(m: Xf): Xf {
  const det = m.a * m.d - m.b * m.c;
  const ia = m.d / det, ib = -m.b / det, ic = -m.c / det, id = m.a / det;
  return { a: ia, b: ib, c: ic, d: id, e: -(ia * m.e + ic * m.f), f: -(ib * m.e + id * m.f) };
}
const apply = (m: Xf, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
const lerpCam = (p: Cam, q: Cam, k: number): Cam => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), z: Math.exp(lerp(Math.log(p.z), Math.log(q.z), k)), r: lerp(p.r, q.r, k) });

interface Timing {
  T0: number; TE: number; beat: number;
  tSnapA: number; tCR: number; tInsane: number; tStampA: number; tNote: number; tWhip0: number; tWhip1: number;
  tP1: number; tP2: number; tInv: number; tHit: number; tPen: number; tReveal: number; tPunch: number;
  tLead0: number; tDot: number; tStut0: number; tStut1: number; seg: number; tTear: number;
}

export default class Patent extends Scene {
  ink = new Layer2D();
  pageRT = makeRT();
  paper = paperPass();
  tear = tearPass();
  T!: Timing;
  L1!: Line; L2!: Line;
  pre: TypeChar[] = []; row1: TypeChar[] = []; row2: TypeChar[] = []; claim2: TypeChar[] = [];
  inv1: TypeChar[] = []; inv2: TypeChar[] = [];
  callouts: Callout[] = [];
  desc!: StrokeText; descTimes: [number, number][] = []; charWord: number[] = []; descSize = 60;
  note: StrokeText[] = []; noteTimes: [number, number][] = [];
  sig!: StrokeText; figLabel!: StrokeText;
  titleSize = 70;
  leadCtl: P2[] = [];

  override init() {
    const { lyrics, audio: au, start, end } = this.ctx;
    this.ink.texture.colorSpace = THREE.NoColorSpace; // channel coverage, not colour
    // the two sung lines in the window, by position (their wording waits for the proofread)
    const ls = lyrics.lines.filter((l) => l.start >= start - 0.3 && l.start < end - 0.3);
    if (ls.length < 2 || !ls[0]!.words.length || !ls[1]!.words.length) throw new Error('verseA: expected two lines in the window');
    const L1 = (this.L1 = ls[0]!), L2 = (this.L2 = ls[1]!);

    // ---- timing
    const bi = (t: number) => Math.round(au.beatAt(t));
    const bt = (i: number) => au.timeOfBeat(i);
    const beat = bt(bi(start) + 1) - bt(bi(start));
    const downAfter = (t: number) => au.downbeats.find((d) => d >= t - 1e-3) ?? t;
    const downBefore = (t: number) => { let b = au.downbeats[0] ?? t; for (const d of au.downbeats) if (d <= t + 1e-3) b = d; return b; };
    const tHit = downBefore(L2.words[0]!.start + 0.02); // the downbeat that opens line 2
    const bH = bi(tHit);
    const lastW = L2.words[L2.words.length - 1]!;
    const T: Timing = {
      T0: start, TE: end, beat,
      tSnapA: Math.max(start + 0.35, L1.words[0]!.start - 0.03),
      tCR: 0, tInsane: L1.words[L1.words.length - 1]!.start,
      tStampA: downAfter(L1.end + 0.1),
      tNote: bt(bH - 6), tWhip0: bt(bH - 4) - 0.42, tWhip1: bt(bH - 4), tP1: bt(bH - 3), tP2: bt(bH - 2), tInv: bt(bH - 1), tHit,
      tPen: bt(bH + 1), tReveal: 0, tPunch: 0, tLead0: 0, tDot: 0, tStut0: 0, tStut1: 0, seg: beat / 2, tTear: 0,
    };
    if (T.tNote < T.tStampA + 0.45) T.tNote = T.tStampA + 0.45;
    T.tReveal = downAfter(T.tPen + 1.0);
    T.tPunch = Math.max(T.tReveal + 0.45, au.nearestBeat(lastW.start));

    // ---- claim 1: the pre-typed preamble, then line 1 over two rows (split at the half, by characters)
    const jit = (k: number) => ({ dens: 0.8 + 0.2 * hash(k, 1), jx: (hash(k, 2) - 0.5) * 1.6, jy: (hash(k, 3) - 0.5) * 2.4, rot: (hash(k, 4) - 0.5) * 0.02 });
    this.pre = Array.from(PRE).map((ch, i) => ({ ch, t: -1e9, x: X0 + i * ADV, y: ROWS[0]!, w: -1, blue: false, ...jit(i + 900) }));
    const total = L1.words.reduce((s, w) => s + w.w.length + 1, -1);
    let acc = 0, split = L1.words.length;
    for (let i = 0; i < L1.words.length; i++) { if (acc >= total / 2 - 1 && i > 0) { split = i; break; } acc += L1.words[i]!.w.length + 1; }
    const mkLyric = (idx: number[], x0: number, y: number, seed: number, lowerFirst: boolean, tail: string) => {
      const out: TypeChar[] = [];
      let x = x0;
      idx.forEach((wi, n) => {
        const w = L1.words[wi]!;
        let s = plain(w.w);
        if (lowerFirst && n === 0) s = s.charAt(0).toLowerCase() + s.slice(1); // it continues "…, wherein"
        if (n === idx.length - 1) s += tail;
        const chars = Array.from(s);
        const per = Math.min(0.07, (w.end - w.start) / Math.max(1, chars.length));
        chars.forEach((ch, i) => { out.push({ ch, t: w.start + i * per, x, y, w: wi, blue: false, ...jit(out.length + seed * 100) }); x += ADV; });
        x += ADV;
      });
      return out;
    };
    const ix = L1.words.map((_, i) => i);
    this.row1 = mkLyric(ix.slice(0, split), X0 + 3 * ADV, ROWS[1]!, 1, true, '');
    this.row2 = mkLyric(ix.slice(split), X0 + 3 * ADV, ROWS[2]!, 2, false, '.');
    T.tCR = (this.row2[0]?.t ?? L1.end) - 0.03;
    // ---- claim 2: typed by the machine, at machine speed, right after line 1 ("0.7 kW" in the blue half)
    {
      let tt = (this.row2[this.row2.length - 1]?.t ?? L1.end) + 0.14;
      const per = 0.017;
      CLAIM2.forEach((s, r) => {
        const vi = s.indexOf(VALUE);
        Array.from(s).forEach((ch, i) => {
          if (ch !== ' ') this.claim2.push({ ch, t: tt, x: X0 + i * ADV, y: ROWS[3 + r]!, w: -1, blue: vi >= 0 && i >= vi && i < vi + VALUE.length, ...jit(500 + r * 60 + i) });
          tt += ch === ' ' && i < 3 ? 0.004 : per;
        });
        tt += 0.07; // carriage return
      });
    }
    // ---- the title block: the human, pre-typed and signed; the machine types itself in as the stamp approaches
    const tbx = TB.x0 + 22;
    this.inv1 = Array.from('1. DOE, Jane').map((ch, i) => ({ ch, t: -1e9, x: tbx + i * TB_ADV, y: INV_ROWS[0]!, w: -1, blue: false, ...jit(700 + i) }));
    {
      const s = '2. MACHINE, The (AI)';
      const t0 = T.tInv + 0.06, per = Math.min(0.022, (T.tHit - 0.08 - t0) / s.length);
      this.inv2 = Array.from(s).map((ch, i) => ({ ch, t: t0 + i * per, x: tbx + i * TB_ADV, y: INV_ROWS[1]!, w: -1, blue: false, ...jit(760 + i) }));
    }

    // ---- line 2: lettered by the drafting pen in the figure's description, each word while it is sung
    const text = L2.words.map((w) => w.w).join(' ');
    const st100 = strokeText(text, 'tech', 100);
    this.descSize = Math.min(64, (100 * 1250) / Math.max(1, st100.width));
    this.desc = strokeText(text, 'tech', this.descSize);
    {
      let ci = 0;
      L2.words.forEach((w, wi) => {
        const n = Array.from(w.w).length;
        const dur = Math.min(w.end - w.start, n * 0.085);
        for (let j = 0; j < n; j++) { this.descTimes[ci] = [w.start + (dur * j) / n, w.start + (dur * (j + 1)) / n]; this.charWord[ci] = wi; ci++; }
        if (wi < L2.words.length - 1) { const e = w.start + dur; this.descTimes[ci] = [e, e]; this.charWord[ci] = -1; ci++; }
      });
    }
    const lastEnd = this.descTimes[this.descTimes.length - 1]?.[1] ?? L2.end;
    T.tLead0 = Math.max(L2.end, lastEnd) + 0.02;
    T.tDot = T.tLead0 + 0.16;
    T.tStut0 = downAfter(T.tDot + 0.2);
    T.tStut1 = T.tStut0 + 3 * T.seg;
    T.tTear = Math.max(bt(bi(end) - 1), T.tStut1 + 0.12);
    if (T.tTear > end - 0.3) T.tTear = end - 0.3;
    this.T = T;

    // the leader from the end of the lettering into the ring's bore (sheet-B px)
    const s1 = stack(1), d = dotAt(s1);
    const a = { x: DESC.x + this.desc.width + 18, y: DESC.y - this.desc.capHeight * 0.45 };
    this.leadCtl = [a, { x: a.x + 150, y: a.y - 520 }, { x: d.x + 600, y: d.y + 10 }, d];

    // ---- reference numerals: popped on the beats of the escalation (22.1, 22.2, 22.3)
    const when: Record<string, number> = { '12': T.tWhip1, '20': T.tWhip1, '14': T.tP1, '16': T.tP1, '18': T.tP2, '22': T.tP2, '10': T.tP2 + 0.14 };
    this.callouts = makeCallouts().map((k) => ({ ...k, t: when[k.n] ?? T.tP2 }));

    // ---- handwriting: the examiner's pencil note, the inventor's signature; the figure label
    const noteLines = ['Examiner’s note: applicant states', 'the apparatus “appreciates”.', 'Clarify.'];
    this.note = noteLines.map((s) => strokeText(s, 'hscript', NOTE.size));
    {
      const tot = this.note.reduce((s, x) => s + x.total, 0);
      const t0 = T.tNote + 0.05, dur = Math.min(0.42, T.tWhip0 - 0.3 - t0);
      let u = 0;
      this.noteTimes = this.note.map((x) => { const a0 = t0 + (dur * u) / tot; u += x.total; return [a0, t0 + (dur * u) / tot]; });
    }
    this.sig = strokeText('Jane Doe', 'hscript', 50);
    this.figLabel = strokeText('FIG. 1', 'tech', 124);
    this.titleSize = Math.min(74, (100 * 1400) / measure(TITLE, F.archivo(112.5, 900), 100));
  }

  // ------------------------------------------------------------------ timing helpers
  /** Explode factor of FIG. 1: one step apart on each of the escalation's beats. */
  explode(t: number) {
    const T = this.T;
    let e = 0.38;
    e += 0.24 * ease.outExpo(prog(t, T.tWhip1, T.tWhip1 + 0.16));
    e += 0.2 * ease.outExpo(prog(t, T.tP1, T.tP1 + 0.16));
    e += 0.18 * ease.outExpo(prog(t, T.tP2, T.tP2 + 0.16));
    return clamp(e);
  }

  /** The time stutter: the leader's landing replayed three times, hard-cut, on 8ths. */
  remap(t: number): { tr: number; loop: number } {
    const T = this.T;
    if (t < T.tStut0 || t >= T.tStut1) return { tr: t, loop: -1 };
    const k = Math.min(2, Math.floor((t - T.tStut0) / T.seg));
    const u = (t - T.tStut0 - k * T.seg) / T.seg;
    return { tr: lerp(T.tLead0 - 0.06, T.tDot + 0.24, u), loop: k };
  }

  /** Carriage position: steps one character per keystroke (short eased step). */
  caretX(list: TypeChar[], t: number, adv = ADV) {
    let x = list[0]!.x;
    for (const c of list) { if (t < c.t) break; x = lerp(x, c.x + adv, ease.outCubic(prog(t, c.t, c.t + 0.05))); }
    return x;
  }

  shake(t: number): [number, number] {
    const T = this.T;
    let amp = 0;
    amp += 30 * pulse(t, T.tHit, 0.07);                       // the one maximal hit
    amp += 12 * pulse(t, T.tStampA, 0.06);                    // the single stamp
    amp += 5 * pulse(t, T.tWhip1, 0.05) + 5 * pulse(t, T.tP1, 0.05) + 5 * pulse(t, T.tP2, 0.05); // per-beat punches
    if (t >= T.tStut0 && t < T.tStut1 + 0.2) for (let k = 0; k < 3; k++) amp += 9 * pulse(t, T.tStut0 + k * T.seg, 0.04);
    amp += 3.5 * pulse(t, T.tDot, 0.05);
    amp += 6 * pulse(t, T.tTear, 0.08);
    for (const list of [this.row1, this.row2]) for (const ch of list) if (t >= ch.t && t < ch.t + 0.1) amp += 1.8 * pulse(t, ch.t, 0.025);
    for (const list of [this.claim2, this.inv2]) for (const ch of list) if (t >= ch.t && t < ch.t + 0.06) amp += 0.7 * pulse(t, ch.t, 0.02);
    const ph = frameIdx(t);
    return [amp * (hash(ph, 11) - 0.5) * 2, amp * (hash(ph, 12) - 0.5) * 2];
  }

  // ------------------------------------------------------------------ camera
  camAt(t: number): Cam {
    const T = this.T;
    if (t < T.tSnapA) return lerpCam(C0, C1, ease.outExpo(prog(t, T.T0 + 0.05, T.T0 + 0.5))); // the line holds for 3 frames, then the page is pulled out
    if (t < T.tStampA) return this.camType(t);
    if (t < T.tNote) return { ...WIDE_A, z: WIDE_A.z * lerp(1, 1.035, prog(t, T.tStampA, T.tNote)) };
    if (t < T.tWhip0) {
      const from = { ...WIDE_A, z: WIDE_A.z * 1.035 };
      const to = { ...NOTE_C, z: NOTE_C.z * lerp(1, 1.04, prog(t, T.tNote, T.tWhip0)) };
      return lerpCam(from, to, ease.outExpo(prog(t, T.tNote - 0.02, T.tNote + 0.28)));
    }
    if (t < T.tWhip1) return lerpCam(this.camAt(T.tWhip0 - 1e-4), this.camFig(T.tWhip1), ease.inOutExpo(prog(t, T.tWhip0, T.tWhip1)));
    if (t < T.tInv) return this.camFig(t);
    if (t < T.tHit) {
      // tight on the inventors, dollying with the carriage, a counter-roll
      const k = prog(t, T.tInv, T.tHit);
      const x = Math.max(this.caretX(this.inv2, t, TB_ADV) - 60, TB.x0 + 330);
      return { x, y: BY + INV_ROWS[1]! - 26, z: 2.5 * (1 + 0.04 * k), r: lerp(0.03, -0.006, ease.inOutCubic(k)) };
    }
    if (t < T.tPen) return { ...HIT_C, z: HIT_C.z * (1 + 0.03 * prog(t, T.tHit, T.tPen)) };
    return this.camB(this.remap(t).tr);
  }

  /** A: tracking the carriage through line 1; a step-in per sung word; carriage return; a push on the last word. */
  camType(t: number): Cam {
    const T = this.T;
    const settle = ease.outExpo(prog(t, T.tSnapA, T.tSnapA + 0.28));
    const cr = prog(t, T.tCR, T.tCR + 0.17, ease.inOutCubic);
    // the whole preamble in frame; the carriage pulls the frame a little
    const x1 = -30 + 0.25 * (this.caretX(this.row1, t) + 300), x2 = -30 + 0.25 * (this.caretX(this.row2, t) + 300);
    let z = 1.36, r = -0.032;
    this.L1.words.forEach((w, i) => {
      if (i === 0 || t < w.start) return;
      const k = ease.outExpo(prog(t, w.start, w.start + 0.18));
      z *= 1 + 0.026 * k;
      r += (i % 2 ? 0.009 : -0.009) * k;
    });
    const push = ease.outExpo(prog(t, T.tInsane, T.tInsane + 0.22));
    z *= 1 + 0.12 * push;
    const track: Cam = { x: lerp(lerp(x1, x2, cr), -235, push), y: lerp(ROWS[1]! - 30, ROWS[2]! - 30, cr) + 30 * push, z, r };
    return lerpCam(C1, track, settle);
  }

  /** B: FIG. 1, tight, then a snap out on each beat (bureau's M, L, P). */
  camFig(t: number): Cam {
    const T = this.T;
    let cam: Cam = { ...FIG1, z: FIG1.z * (1 - 0.04 * prog(t, T.tWhip1, T.tP1)) };
    cam = lerpCam(cam, FIG2, ease.outExpo(prog(t, T.tP1 - 0.02, T.tP1 + 0.22)));
    cam = lerpCam(cam, FIG3, ease.outExpo(prog(t, T.tP2 - 0.02, T.tP2 + 0.22)));
    return cam;
  }

  /** B after the hit: tracking the pen, the reveal of the whole sheet, the punch-in, the dot's landing. */
  camB(t: number): Cam {
    const T = this.T;
    const pen = this.penAt(t);
    const track: Cam = { x: clamp(pen.x - 120, DESC.x + 560, DESC.x + this.desc.width - 480), y: BY + DESC.y - 60, z: 1.42, r: -0.022 };
    let cam = lerpCam({ ...HIT_C, z: HIT_C.z * 1.03 }, track, ease.outExpo(prog(t, T.tPen - 0.02, T.tPen + 0.3)));
    cam = lerpCam(cam, { ...REVEAL_C, z: REVEAL_C.z * (1 + 0.025 * prog(t, T.tReveal, T.tPunch)) }, ease.outExpo(prog(t, T.tReveal - 0.04, T.tReveal + 0.34)));
    cam = lerpCam(cam, { ...PUNCH_C, z: PUNCH_C.z * (1 + 0.03 * prog(t, T.tPunch, T.tTear)) }, ease.outExpo(prog(t, T.tPunch - 0.03, T.tPunch + 0.25)));
    const d = dotAt(stack(1));
    const kD = ease.outExpo(prog(t, T.tDot, T.tDot + 0.22));
    cam = lerpCam(cam, { x: d.x, y: BY + d.y, z: cam.z * 1.9, r: cam.r - 0.01 }, 0.07 * kD);
    return cam;
  }

  /** The pen's head (sheet-B px): along the lettering, then along the leader into the ring. */
  penAt(t: number): P2 {
    const T = this.T;
    if (t >= T.tLead0) return this.leadPt(this.leadK(t));
    const len = writtenLength(this.desc, this.descTimes, t);
    const h = strokeHead(this.desc, len);
    return { x: DESC.x + (h?.x ?? 0), y: DESC.y + (h?.y ?? 0) };
  }
  leadK(t: number) { return prog(t, this.T.tLead0, this.T.tDot, ease.inOutQuad); }
  leadPt(u: number): P2 {
    const [a, b, c, d] = this.leadCtl as [P2, P2, P2, P2];
    const m = 1 - u;
    return { x: m * m * m * a.x + 3 * m * m * u * b.x + 3 * m * u * u * c.x + u * u * u * d.x, y: m * m * m * a.y + 3 * m * m * u * b.y + 3 * m * u * u * c.y + u * u * u * d.y };
  }

  /** No motion blur across cuts; the directional blur is for the whip only. */
  blurOn(t0: number, t1: number) { return t0 >= this.T.tWhip0 && t1 <= this.T.tWhip1 + 0.02; }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const T = this.T;
    const t = f.t;
    const rm = this.remap(t);
    const cam = this.camAt(t);
    cam.z *= 1 + 0.05 * pulse(t, T.tHit, 0.09) + 0.02 * pulse(t, T.tStampA, 0.07) + 0.015 * (pulse(t, T.tP1, 0.06) + pulse(t, T.tP2, 0.06));
    if (rm.loop >= 0) cam.z *= 1 + 0.03 * pulse(t, T.tStut0 + rm.loop * T.seg, 0.05);
    const [shx, shy] = this.shake(t);
    const m = camXf(cam, shx, shy);
    const im = invXf(m);

    // motion blur: the page's centre displacement over one frame, only on the whip
    let bl: [number, number] = [0, 0];
    const dtb = 1 / 60;
    if (this.blurOn(t - dtb, t)) {
      const m2 = camXf(this.camAt(t - dtb));
      const pc = apply(im, W / 2 + shx, H / 2 + shy);
      const q = apply(m2, pc.x, pc.y);
      const bx = q.x - W / 2, by = q.y - H / 2, len = Math.hypot(bx, by);
      const k = len > 40 ? (Math.min(1, (len - 40) / 30) * Math.min(170, len * 0.5)) / len : 0;
      bl = [bx * k, by * k];
    }

    // ---- ink layer (page space)
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const v = this.viewRect(im);
    if (v.y0 < 760 && v.y1 > -760) this.drawClaims(c, t, cam);
    if (v.y0 < BY + 860 && v.y1 > BY - 900) this.drawSheet(c, t, rm.tr);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';

    // ---- paper + inks + the light
    const P = this.paper.u;
    P.inkTex!.value = L.upload();
    (P.camA!.value as THREE.Vector3).set(im.a, im.c, im.e);
    (P.camB!.value as THREE.Vector3).set(im.b, im.d, im.f);
    (P.blurV!.value as THREE.Vector2).set(bl[0], bl[1]);
    P.zoom!.value = cam.z;
    const sB = this.stampB(t), sA = this.stampA(t);
    (P.st0!.value as THREE.Vector4).set(sB.x, sB.y, sB.hw * 1.1, sB.hh * 1.1);
    (P.st0b!.value as THREE.Vector4).set(sB.rot, sB.on ? sB.strength : 0, 3.7, 0);
    (P.st1!.value as THREE.Vector4).set(sA.x, sA.y, sA.hw * 1.1, sA.hh * 1.1);
    (P.st1b!.value as THREE.Vector4).set(sA.rot, sA.on ? sA.strength : 0, 9.1, 0);
    const dI = this.dotI(rm.tr);
    if (dI > 0) {
      const dp = dotAt(stack(1)), ds = apply(m, dp.x, BY + dp.y);
      (P.dotP!.value as THREE.Vector4).set(ds.x, ds.y, 21 * cam.z, dI);
    } else (P.dotP!.value as THREE.Vector4).set(0, 0, 1, 0);
    const hot = 1 - prog(t, T.T0 + 0.02, T.T0 + 0.17, ease.outQuad);
    (P.hotL!.value as THREE.Vector3).set(apply(m, 0, RULE_Y).y, hot * hot, W);
    this.paper.render(renderer, this.pageRT);

    // ---- the tear (bureau's, a little faster: the halves are gone by the cut)
    const U = this.tear.u;
    U.page!.value = this.pageRT.texture;
    const tt = t - T.tTear;
    let hudA = 1, paperA = 1;
    if (tt > 0) {
      const rip = prog(tt, 0, 0.12, ease.outQuad);
      const fall = Math.max(0, tt - 0.09) * 0.8;
      const cx = 1000;
      const pieceXf = (side: number) => {
        const hinge = 0.06 * rip * side;
        const sc = 1 / (1 + fall * 1.9 + fall * fall * 3);
        const ang = hinge + side * (fall * 1.6 + fall * fall * 5);
        const pivot = { x: cx + side * 30, y: lerp(0, 1080, rip) };
        const off = { x: side * (40 * rip + 1400 * fall * fall), y: 2600 * fall * fall + 150 * fall };
        const cs = Math.cos(ang) * sc, sn = Math.sin(ang) * sc;
        return invXf({ a: cs, b: sn, c: -sn, d: cs, e: pivot.x + off.x - (cs * pivot.x - sn * pivot.y), f: pivot.y + off.y - (sn * pivot.x + cs * pivot.y) });
      };
      const i0 = pieceXf(-1), i1 = pieceXf(1);
      (U.inv0a!.value as THREE.Vector3).set(i0.a, i0.c, i0.e);
      (U.inv0b!.value as THREE.Vector3).set(i0.b, i0.d, i0.f);
      (U.inv1a!.value as THREE.Vector3).set(i1.a, i1.c, i1.e);
      (U.inv1b!.value as THREE.Vector3).set(i1.b, i1.d, i1.f);
      U.tear!.value = 1;
      U.tipY!.value = lerp(-20, 1120, rip);
      (U.shade!.value as THREE.Vector2).set(1 - 0.4 * clamp(fall * 3), 1 - 0.3 * clamp(fall * 3));
      U.blackout!.value = prog(t, T.TE - 0.05, T.TE - 1 / 120, ease.linear);
      hudA = 0;
      paperA = tt < 0.1 ? 1 : 0;
    } else {
      U.tear!.value = 0;
      U.blackout!.value = 0;
    }
    this.tear.render(renderer, out);

    const hitK = pulse(t, T.tHit, 0.08);
    return { hud: hudA, paper: paperA, bloom: 0.3, bloomThreshold: 1.25, bloomKnee: 0.3, halation: 0.05, vignette: 0.18, grain: 0.045, ca: 0.5 + 3 * hitK + 1.2 * pulse(t, T.tStampA, 0.06) };
  }

  viewRect(im: Xf) {
    const pts = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => apply(im, x!, y!));
    return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
  }

  /** The dot's light (0 until the leader lands). */
  dotI(tr: number) {
    const T = this.T;
    if (tr < T.tDot) return 0;
    return 1 + 2.2 * pulse(tr, T.tDot, 0.08);
  }

  // ------------------------------------------------------------------ stamps
  stampA(t: number) {
    const k = prog(t, this.T.tStampA, this.T.tStampA + 0.05, ease.outQuad);
    return { ...STAMP_A, on: t >= this.T.tStampA, strength: 1 + 0.5 * (1 - k), scale: lerp(1.07, 1, k) };
  }
  stampB(t: number) {
    const k = prog(t, this.T.tHit, this.T.tHit + 0.05, ease.outQuad);
    return { ...STAMP_B, on: t >= this.T.tHit, strength: 1 + 0.5 * (1 - k), scale: lerp(1.08, 1, k) };
  }

  drawStamp(c: Ctx2, s: { x: number; y: number; hw: number; hh: number; rot: number; scale: number }, ink: (a?: number) => string, big: string[], top: string, bottom: string) {
    c.save();
    c.translate(s.x, s.y); c.rotate(s.rot); c.scale(s.scale, s.scale);
    const hw = s.hw - 12, hh = s.hh - 12;
    c.strokeStyle = ink(1);
    c.lineWidth = 11; c.strokeRect(-hw, -hh, hw * 2, hh * 2);
    c.lineWidth = 3.2; c.strokeRect(-hw + 18, -hh + 18, hw * 2 - 36, hh * 2 - 36);
    c.fillStyle = ink(1);
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const fam = F.archivo(75, 900);
    const wmax = Math.max(...big.map((b) => measure(b, fam, 100)));
    const lines = big.length;
    const size = Math.min(lines > 1 ? 74 : 118, (100 * (hw * 2 - 80)) / wmax);
    c.font = font(fam, size);
    const lead = size * 0.9;
    big.forEach((b, i) => c.fillText(b, 0, size * 0.36 + (i - (lines - 1) / 2) * lead));
    c.font = font(F.mono(700), 15);
    c.letterSpacing = '5px';
    c.fillText(top, 0, -hh + 44);
    c.fillText(bottom, 0, hh - 28);
    c.letterSpacing = '0px';
    c.restore();
  }

  // ------------------------------------------------------------------ A. the claims page
  drawClaims(c: Ctx2, t: number, cam: Cam) {
    const T = this.T;
    c.save();
    c.textBaseline = 'alphabetic';
    // running head
    c.fillStyle = PRINT(0.7); c.font = font(F.mono(500), 14); c.letterSpacing = '3px';
    c.fillText('APPLICATION NO. 18/070,001', X0, -690);
    c.textAlign = 'right'; c.fillText('PAGE 14 OF 14', 760, -690); c.textAlign = 'left';
    c.letterSpacing = '0px';
    // the first rule: the drop's line, cooling from blue to ink over the first frames
    {
      const k = 1 - prog(t, T.T0 + 0.03, T.T0 + 0.2, ease.outQuad);
      const th = Math.min(2.4, 5.5 / cam.z);
      if (k < 1) { c.fillStyle = PRINT(1 - k); c.fillRect(-760, RULE_Y - th / 2, 1520, th); }
      if (k > 0) { c.fillStyle = BLUE(k); c.fillRect(-760, RULE_Y - th / 2, 1520, th); }
    }
    // title, heading
    c.fillStyle = PRINT(1);
    c.font = font(F.archivo(112.5, 900), this.titleSize);
    c.fillText(TITLE, X0, -410);
    c.font = font(F.mono(700), 17); c.letterSpacing = '4px';
    c.fillText('WHAT IS CLAIMED IS:', X0, -330);
    c.letterSpacing = '0px';
    c.fillStyle = PRINT(0.45); c.font = font(F.mono(400), 13);
    for (const [i, y] of ROWS.entries()) if (i % 2 === 0) c.fillText(String(5 * (i / 2 + 1)).padStart(2, ' '), -780, y);
    // page number
    c.fillStyle = PRINT(0.6); c.font = font(F.mono(500), 16); c.textAlign = 'center';
    c.fillText('— 14 —', 0, 600);
    c.textAlign = 'left';
    c.restore();

    this.drawTyped(c, this.pre, t, TS);
    this.drawTyped(c, this.row1, t, TS, 0.9);
    this.drawTyped(c, this.row2, t, TS, 0.12);
    this.drawTyped(c, this.claim2, t, TS, 0.05);

    // the examiner's single stamp
    const sA = this.stampA(t);
    if (sA.on) this.drawStamp(c, sA, PRINT, ['INOPERABLE'], 'EXAMINER’S OBJECTION · 35 U.S.C. § 101', 'LACKS UTILITY · WORKING MODEL REQUIRED');
    // the examiner's pencil: a loop round "appreciating", then the note
    if (t >= T.tNote - 0.03) {
      c.save();
      c.strokeStyle = PRINT(0.42); c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
      const k = prog(t, T.tNote - 0.03, T.tNote + 0.1);
      c.beginPath();
      const n = 60;
      for (let i = 0; i <= n * k; i++) {
        const a = -2.6 + (i / n) * TAU * 1.08, wob = 1 + 0.04 * Math.sin(i * 0.7);
        const x = LOOP.x + Math.cos(a) * LOOP.rx * wob, y = LOOP.y + Math.sin(a) * LOOP.ry * wob + (i / n) * 6;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
      c.translate(NOTE.x, NOTE.y); c.rotate(NOTE.rot);
      this.note.forEach((st, i) => {
        const [a0, a1] = this.noteTimes[i]!;
        if (t < a0) return;
        c.save(); c.translate(i === 2 ? 40 : 0, i * NOTE.lead);
        drawStrokeText(c, st, st.total * prog(t, a0, a1));
        if (i === 2 && t > a1) {
          const u = prog(t, a1, a1 + 0.08);
          c.beginPath(); c.moveTo(-4, 12); c.lineTo(-4 + (st.width + 16) * u, 9);
          c.moveTo(4, 20); c.lineTo(4 + (st.width + 4) * u, 18); c.stroke();
        }
        c.restore();
      });
      c.restore();
    }
  }

  drawTyped(c: Ctx2, list: TypeChar[], t: number, size: number, guideLead = 0) {
    if (!list.length) return;
    c.save();
    c.font = font(F.mono(500), size);
    c.textBaseline = 'alphabetic';
    const ws = this.L1.words;
    for (const ch of list) {
      if (t < ch.t) break;
      const fresh = pulse(t, ch.t, 0.04);
      // the sung word is in the ribbon's blue half; it goes to black once the word has been sung
      let kb = ch.blue ? 1 : 0;
      if (ch.w >= 0) { const w = ws[ch.w]!; kb = t < w.end ? 1 : 1 - prog(t, w.end, w.end + 0.15); }
      c.save();
      c.translate(ch.x + ch.jx, ch.y + ch.jy - 4 * fresh * (size / TS));
      c.rotate(ch.rot);
      if (kb < 1) { c.fillStyle = TYPE(ch.dens * (1 - kb)); c.fillText(ch.ch, 0, 0); }
      if (kb > 0) { c.fillStyle = BLUE(Math.min(1, ch.dens * 1.1) * kb); c.fillText(ch.ch, 0, 0); }
      c.restore();
    }
    // the type guide: where the next letter will strike (the carriage's cursor)
    const next = list.find((ch) => ch.t > t);
    if (next && t > list[0]!.t - guideLead) {
      const gs = size / TS, gx = next.x + size * 0.3;
      c.fillStyle = BLUE(1);
      c.beginPath(); c.moveTo(gx - 9 * gs, next.y + 21 * gs); c.lineTo(gx + 9 * gs, next.y + 21 * gs); c.lineTo(gx, next.y + 9 * gs); c.closePath(); c.fill();
    }
    c.restore();
  }

  // ------------------------------------------------------------------ B. the drawing sheet
  drawSheet(c: Ctx2, t: number, tr: number) {
    const T = this.T;
    const s = stack(this.explode(t));
    c.save();
    c.translate(0, BY);
    c.textBaseline = 'alphabetic';
    // header, as on a published drawing sheet
    c.fillStyle = PRINT(0.85); c.font = font(F.serif(600), 27);
    c.fillText('Patent Application Publication', -740, -826);
    c.textAlign = 'center'; c.fillText('Sep. 29, 2026    Sheet 1 of 3', 70, -826);
    c.textAlign = 'right'; c.fillText('US 2026/0070700 A1', 740, -826);
    c.textAlign = 'left';
    // frame
    c.strokeStyle = PRINT(0.95); c.lineWidth = 2.6; c.strokeRect(-740, -790, 1480, 1580);
    c.strokeStyle = PRINT(0.6); c.lineWidth = 0.9; c.strokeRect(-730, -780, 1460, 1560);

    // FIG. 1 (drawn first: its faces erase what is behind them)
    drawAssembly(c, s);
    for (const k of this.callouts) drawCallout(c, k, s, t);
    c.save();
    c.translate(250, -668);
    c.strokeStyle = PRINT(1); c.lineWidth = 6.2; c.lineCap = 'round'; c.lineJoin = 'round';
    drawStrokeText(c, this.figLabel, this.figLabel.total);
    c.fillStyle = PRINT(0.7); c.font = font(F.mono(500), 14); c.letterSpacing = '3px';
    c.fillText('EXPLODED VIEW', 4, 40);
    c.fillText('ASSEMBLED VIEW NOT SUPPLIED', 4, 62);
    c.letterSpacing = '0px';
    c.restore();

    // the figure description: line 2, lettered by the pen between light guide lines
    c.fillStyle = PRINT(0.75); c.font = font(F.mono(600), 13); c.letterSpacing = '3px';
    c.fillText('DESCRIPTION OF FIG. 1', DESC.x, DESC.y - this.desc.capHeight - 34);
    c.letterSpacing = '0px';
    c.fillStyle = PRINT(0.08);
    c.fillRect(DESC.x, DESC.y + 0.5, 1330, 1); c.fillRect(DESC.x, DESC.y - this.desc.capHeight - 0.5, 1330, 1);
    this.drawLettering(c, t, tr);

    // the title block, the inventors, the maximal hit
    this.drawTitleBlock(c, t);
    c.restore();
    const sB = this.stampB(t);
    if (sB.on) this.drawStamp(c, sB, BLUE, ['INVENTOR MUST BE', 'A NATURAL PERSON'], 'REFUSED · 35 U.S.C. § 100(f)', 'THALER v. VIDAL · FED. CIR. 2022');
  }

  /** Line 2 in drafting lettering, each word in the blue while it is sung; the pen goes on into the leader. */
  drawLettering(c: Ctx2, t: number, tr: number) {
    const T = this.T;
    const st = this.desc;
    const len = writtenLength(st, this.descTimes, t);
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (len > 0) {
      c.save();
      c.translate(DESC.x, DESC.y);
      c.lineWidth = Math.max(2.4, this.descSize * 0.055);
      const ws = this.L2.words;
      for (let wi = 0; wi < ws.length; wi++) {
        const w = ws[wi]!;
        const kb = t < w.end ? 1 : 1 - prog(t, w.end, w.end + 0.2);
        c.beginPath();
        let any = false;
        for (let i = 0; i < st.strokes.length; i++) {
          if (this.charWord[st.charOf[i]!] !== wi) continue;
          const s0 = st.startLen[i]!;
          if (s0 >= len) break;
          const pts = st.strokes[i]!, Ls = st.lens[i]!, rem = len - s0;
          c.moveTo(pts[0]!.x, pts[0]!.y);
          let j = 1;
          for (; j < pts.length && Ls[j]! <= rem; j++) c.lineTo(pts[j]!.x, pts[j]!.y);
          if (j < pts.length) { const a = pts[j - 1]!, b = pts[j]!, u = (rem - Ls[j - 1]!) / Math.max(1e-6, Ls[j]! - Ls[j - 1]!); c.lineTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u); }
          any = true;
        }
        if (!any) continue;
        if (kb < 1) { c.strokeStyle = PRINT(1 - kb); c.stroke(); }
        if (kb > 0) { c.strokeStyle = BLUE(kb); c.stroke(); }
      }
      c.restore();
    }
    // the leader: the pen runs on from the last word into the ring's bore; its end point is the dot
    const lk = this.leadK(tr);
    if (lk > 0) {
      const n = 60, upto = Math.round(n * lk);
      c.strokeStyle = PRINT(1); c.lineWidth = 1.9;
      c.beginPath();
      for (let i = 0; i <= upto; i++) { const p = this.leadPt(i / n); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
      c.stroke();
    }
    // the dot's body (its light is in the paper shader) and the membrane it will turn out to have
    if (tr >= T.tDot) {
      const d = dotAt(stack(1));
      const land = pulse(tr, T.tDot, 0.1);
      c.fillStyle = BLUE(1);
      c.beginPath(); c.arc(d.x, d.y, 12 + 7 * land, 0, TAU); c.fill();
      c.strokeStyle = BLUE(0.55); c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(d.x, d.y, 18, 14, 0.5, 0, TAU); c.stroke();
      c.strokeStyle = BLUE(0.3);
      c.beginPath(); c.ellipse(d.x, d.y, 24, 19, 0.5, 0, TAU); c.stroke();
      if (land > 0.02) {
        const r = 22 + 120 * (1 - land);
        c.strokeStyle = BLUE(0.8 * land); c.lineWidth = 2.5;
        c.beginPath(); c.arc(d.x, d.y, r, 0, TAU); c.stroke();
      }
    }
    // the pen's nib (the cursor) while it letters or draws the leader
    const writing = t >= (this.descTimes[0]?.[0] ?? Infinity) - 0.05 && tr < T.tDot;
    if (writing) {
      const p = this.penAt(tr);
      c.fillStyle = BLUE(1);
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 7, p.y - 22); c.lineTo(p.x + 17, p.y - 16); c.closePath(); c.fill();
    }
    c.restore();
  }

  drawTitleBlock(c: Ctx2, t: number) {
    const { x0, x1, y0, y1, r1, r2, col } = TB;
    c.save();
    c.strokeStyle = PRINT(0.95); c.lineWidth = 2.4; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x0, r1); c.lineTo(x1, r1); c.moveTo(x0, r2); c.lineTo(x1, r2);
    c.moveTo(col, r1); c.lineTo(col, y1); c.moveTo(200, r2); c.lineTo(200, y1);
    c.stroke();
    c.fillStyle = PRINT(0.62); c.font = font(F.mono(500), 12); c.letterSpacing = '2px';
    c.fillText('TITLE', x0 + 12, y0 + 18);
    c.fillText('INVENTOR(S)', x0 + 12, r1 + 20);
    c.fillText('SIGNATURE', col + 12, r1 + 20);
    c.fillText('SCALE', x0 + 12, r2 + 16); c.fillText('DRAWN', 212, r2 + 16); c.fillText('PLOTTED', col + 12, r2 + 16);
    c.fillStyle = PRINT(0.95); c.font = font(F.mono(600), 19);
    c.fillText(TITLE, x0 + 96, y0 + 30);
    c.font = font(F.mono(600), 15);
    c.fillText('NONE', x0 + 20, r2 + 34); c.fillText('BY HAND', 222, r2 + 34); c.fillText('BY MACHINE', col + 20, r2 + 34);
    c.letterSpacing = '0px';
    c.fillStyle = PRINT(0.4);
    for (const y of INV_ROWS) c.fillRect(col + 16, y + 8, x1 - col - 34, 1);
    c.restore();
    this.drawTyped(c, this.inv1, t, TB_TS);
    this.drawTyped(c, this.inv2, t, TB_TS, 0.05);
    // the human signs by hand; the machine's cell stays empty
    c.save();
    c.translate(col + 34, INV_ROWS[0]! + 2); c.rotate(-0.06);
    c.strokeStyle = TYPE(0.92); c.lineWidth = 2.3; c.lineCap = 'round'; c.lineJoin = 'round';
    drawStrokeText(c, this.sig, this.sig.total);
    c.restore();
  }

  override dispose() {
    this.pageRT.dispose();
  }
}

/** The head of a StrokeText written to `len` (local px), without drawing. */
function strokeHead(st: StrokeText, len: number): P2 | null {
  let head: P2 | null = null;
  for (let i = 0; i < st.strokes.length; i++) {
    const s0 = st.startLen[i]!;
    if (s0 >= len) break;
    const pts = st.strokes[i]!, L = st.lens[i]!, rem = len - s0;
    let j = 1;
    for (; j < pts.length && L[j]! <= rem; j++);
    if (j < pts.length) { const a = pts[j - 1]!, b = pts[j]!, u = (rem - L[j - 1]!) / Math.max(1e-6, L[j]! - L[j - 1]!); head = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }; }
    else head = pts[pts.length - 1]!;
  }
  return head;
}
