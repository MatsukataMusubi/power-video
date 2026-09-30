// bridgeB movements 1–2 (dense-press, move for move): the platter in macro, the lyric written on its
// tracks by the head.
//  1. "And if you're wrong, you'll never die": the line on two tracks, the head as the cursor. On every
//     kick the tracks get denser (the areal-density squeeze): Archivo's width axis steps 125 → 62, the
//     weight 300 → 900, the track pitch collapses until the tracks shingle over each other, more tracks
//     (copies of the line: backups) are stuffed in from beyond the sector's walls, and the head re-seeks
//     its track (a jump and a ringing settle) with a leader-line readout of the new tracks-per-inch.
//  2. "Baby, plug in, I'll blow your mind": each stressed word is written on its own track, too wide for
//     it, and bursts through the drive's boundaries one after another: the sector (the packed tracks blow
//     out with it), the guard band, then the data zone under load, which bows and snaps on "mind"; MIND
//     runs off it. Then the camera dives into a stem of MIND (match cut to the sector map).
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import type { PostOverrides } from '../engine/scene';
import { clamp, ease, hash, lerp, prog, pulse, springStep, frameIdx } from '../engine/util';
import { dot2D } from './_power';
import { type Cam, U, PRESS_CAM, R_PRESS, CAP, lay, xAt, runU, mixCss, drawArm, applyCam, w2s, type DiscState } from './platter-kit';

export interface Rect { x0: number; y0: number; x1: number; y1: number }
const inset = (k: number): Rect => ({ x0: (W * (1 - k)) / 2, y0: (H * (1 - k)) / 2, x1: W - (W * (1 - k)) / 2, y1: H - (H * (1 - k)) / 2 });
/** The fences, in unrolled coordinates: the sector, the guard band, the data zone. */
export const SECTOR = inset(0.9);
export const GUARD = inset(0.93);
const ZONE: Rect = { x0: 3, y0: 3, x1: W - 3, y1: H - 3 };
const FENCE_X = 26; // the last word keeps its first letter inside the zone and bursts out on the right
const DIVE = 0.24, DIVE_Z = 6, DIVE_ROLL = -0.35;
const ARM_ANG = -0.72; // the arm leaves the slider toward the upper right (the actuator is off the platter)

/** Per-kick compression states of movement 1 (the areal-density squeeze). */
const STAGES = [
  { width: 125, weight: 300, track: 0.05, lead: 1.6 },
  { width: 112.5, weight: 500, track: 0.025, lead: 1.34 },
  { width: 100, weight: 500, track: 0.0, lead: 1.14 },
  { width: 87.5, weight: 700, track: -0.02, lead: 0.98 },
  { width: 75, weight: 900, track: -0.035, lead: 0.86 },
  { width: 62, weight: 900, track: -0.05, lead: 0.76 },
];
const TPI = [500e3, 1e6, 2e6, 4e6, 8e6, 16e6];

const up = (w: string) => w.replace(/[,.?!“”"]/g, '').toUpperCase();

/** Characters of `text` sung by t, across the words of a row (the spaces between words count as sung). */
function sungChars(ws: Word[], texts: string[], t: number) {
  let n = 0;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i]!, s = texts[i]!;
    if (t <= w.start) return n;
    if (t >= w.end) { n += s.length + (i < ws.length - 1 ? 1 : 0); continue; }
    return n + (s.length * (t - w.start)) / Math.max(1e-3, w.end - w.start);
  }
  return n;
}

interface Hero { words: Word[]; texts: string[]; text: string }
interface StackRow { text: string; words: Word[]; texts: string[]; fam: string; track: number; w: number; wPre: number; tIn: number; tShow: number; size: number; cap: number; left: boolean }
interface RowBox { base: number; cap: number; k: number; cy: number; ax: number; x0: number }

export class Press {
  t0: number; c2: number; c3: number;
  kicks: number[]; beats: number[];
  S = 120;
  A: Hero; B: Hero;
  rows: StackRow[] = [];
  /** Rupture times: the sector, the guard band, the data zone under load, the data zone snaps. */
  rup: number[] = [];
  private shake: [number, number] = [0, 0];
  private zoom = 1;
  /** Where the dive ends (world), for the match cut. */
  divePivot = { x: 0, y: 0 };
  diveStemPx = 60;

  constructor(L1: Line, L2: Line, t0: number, c2: number, c3: number, kicks: number[], beats: number[]) {
    this.t0 = t0; this.c2 = c2; this.c3 = c3; this.beats = beats;
    this.kicks = kicks.filter((k) => k >= t0 + 0.1 && k < c2 - 0.05).slice(0, STAGES.length - 1);
    // the line on two tracks: split after the first comma (or at the middle)
    const ws = L1.words;
    let cut = ws.findIndex((w, i) => i > 0 && i < ws.length - 1 && /,$/.test(w.w));
    if (cut < 0) cut = Math.floor(ws.length / 2) - 1;
    const mk = (a: Word[]): Hero => { const texts = a.map((w) => up(w.w)); return { words: a, texts, text: texts.join(' ') }; };
    this.A = mk(ws.slice(0, cut + 1)); this.B = mk(ws.slice(cut + 1));
    // type size: the unsqueezed longer line just fits the sector's width
    const f0 = F.archivo(STAGES[0]!.width, STAGES[0]!.weight);
    const adv = Math.max(lay(this.A.text, f0, 100, 5).width, lay(this.B.text, f0, 100, 5).width) / 100;
    this.S = Math.min(150, (0.985 * (SECTOR.x1 - SECTOR.x0)) / adv);

    // movement 2: four rows, each bursting one fence further (dense's spec)
    const w2 = L2.words;
    const n2 = w2.length;
    const sizes = n2 >= 7 ? [1, 2, 2, n2 - 5] : [Math.ceil(n2 / 4), Math.ceil(n2 / 4), Math.ceil(n2 / 4), 99];
    const groups: Word[][] = [];
    let at = 0;
    for (const s of sizes) { if (at < n2) groups.push(w2.slice(at, Math.min(n2, at + s))); at += s; }
    const hitOf = (s: number) => kicks.find((k) => k >= s - 0.07 && k <= s + 0.15) ?? beats.find((b) => b >= s - 0.07) ?? s;
    const GW = GUARD.x1 - GUARD.x0, SW = SECTOR.x1 - SECTOR.x0;
    const spec: [number, number, number, boolean][] = [[62, GW, SW, false], [75, W, GW, false], [62, W * 1.06, W, false], [87.5, W * 1.05, W - 2 * FENCE_X, true]];
    this.rows = groups.slice(0, 4).map((g, i) => {
      const [wd, wT, wPre, left] = spec[i]!;
      const texts = g.map((w) => up(w.w));
      const text = texts.join(' ');
      // width-driven size, but a short word may not grow taller than a third of the frame: it goes to a
      // wider cut instead, and the rest is letter spacing
      let fam = F.archivo(wd, 900);
      let adv = lay(text, fam, 100).width / 100;
      let size = wT / adv, track = 0;
      const capMax = 0.34 * H;
      if (size * CAP > capMax) {
        size = capMax / CAP;
        for (const w2 of [75, 87.5, 100, 112.5, 125]) {
          if (w2 <= wd) continue;
          fam = F.archivo(w2, 900); adv = lay(text, fam, 100).width / 100;
          if (adv * size >= wT) break;
        }
        if (adv * size > wT) size = wT / adv;
        track = Math.max(0, (wT - adv * size) / Math.max(1, Array.from(text).length - 1));
      }
      // the rupture: the row's first word (row 1), else its last word's hit (the stressed one)
      const tIn = i === 0 ? c2 : hitOf(g[g.length - 1]!.start);
      return { text, words: g, texts, fam, track, w: wT, wPre, tIn, tShow: g[0]!.start, size, cap: size * CAP, left };
    });
    this.rup = this.rows.map((r) => r.tIn);
    if (this.rup.length === 4 && this.rup[1]! < c2 + 0.2) this.rup[1] = beats.find((b) => b > c2 + 0.2) ?? c2 + 0.55;
    this.rows.forEach((r, i) => (r.tIn = this.rup[i]!));
    // the dive's target: the stem of the last row's second word (MIND's I), else its second glyph
    const lr = this.rows[this.rows.length - 1]!;
    const sp = lr.text.indexOf(' ');
    const gi = sp >= 0 && sp + 2 < lr.text.length ? sp + 2 : 1;
    const l = lay(lr.text, lr.fam, lr.size, lr.track);
    const g = l.glyphs[gi] ?? l.glyphs[1]!;
    this.diveGlyph = { i: gi, cx: g.x + g.w * 0.5 };
    // the stem's width on screen when the dive ends (the last row has grown ~3% by then)
    this.diveStemPx = lr.size * 0.18 * DIVE_Z * 1.03;
  }
  private diveGlyph = { i: 1, cx: 0 };

  // -------------------------------------------------------------- state
  /** Compression stage 0..5 (index of the last kick) and the spring into it. */
  private stage(t: number) {
    let k = 0;
    for (let i = 0; i < this.kicks.length; i++) if (t >= this.kicks[i]!) k = i + 1;
    const sp = k === 0 ? 1 : springStep(t - this.kicks[k - 1]!, 3.2, 0.42);
    return { k, sp };
  }
  private kickT(k: number) { return k === 0 ? this.t0 : this.kicks[k - 1]!; }

  /** Slab geometry at t: font, squeeze, pitch, hero baselines. */
  private slab(t: number) {
    const { k, sp } = this.stage(t);
    const st = STAGES[k]!, prev = STAGES[Math.max(0, k - 1)]!;
    const S = this.S, cap = S * CAP;
    const fam = F.archivo(st.width, st.weight), famP = F.archivo(prev.width, prev.weight);
    const tr = st.track * S;
    const lA = lay(this.A.text, fam, S, tr), lB = lay(this.B.text, fam, S, tr);
    const ratio = k === 0 ? 1 : lay(this.A.text, famP, S, prev.track * S).width / lA.width;
    const sx = lerp(ratio, 1, sp);
    const nextK = this.kicks[k] ?? this.c2;
    const creep = prog(t, this.kickT(k), nextK) * 0.05;
    const lead = Math.max(0.62, lerp(prev.lead, st.lead, k === 0 ? 1 : sp) - creep);
    const pitch = cap * lead;
    const heroPitch = Math.max(pitch, cap * 1.1);
    const yc = H * 0.5;
    const yA = yc - heroPitch / 2 + cap / 2, yB = yA + heroPitch;
    return { k, sp, S, cap, fam, tr, lA, lB, sx, pitch, heroPitch, yA, yB, yc };
  }

  tpi(t: number) {
    const { k } = this.stage(t);
    const a = k === 0 ? TPI[0]! : TPI[k - 1]!, b = TPI[k]!;
    const u = k === 0 ? 1 : prog(t, this.kickT(k), this.kickT(k) + 0.3, ease.outExpo);
    return Math.round(Math.pow(2, lerp(Math.log2(a), Math.log2(b), u)) / 1000) * 1000;
  }

  /** 0..1 over the last beat's tail: the camera dives into a stem of the last word. */
  dive(t: number) {
    const wEnd = this.rows[this.rows.length - 1]!.words.slice(-1)[0]!.end;
    return prog(t, Math.max(wEnd + 0.02, this.c3 - DIVE), this.c3);
  }

  /** The world camera (the rest macro, then the dive into the stem). */
  cam(t: number): Cam {
    const dv = this.dive(t);
    if (dv <= 0) return { ...PRESS_CAM };
    const b = this.stackLayout(t)[this.rows.length - 1]!;
    const px = b.ax + (FENCE_X + this.diveGlyph.cx - b.ax) * b.k, py = b.cy;
    const P = U(px, py);
    this.divePivot = { x: P.x, y: P.y };
    const z = Math.exp(Math.log(DIVE_Z) * ease.inQuad(dv));
    const r = DIVE_ROLL * ease.inCubic(dv);
    const f = ease.inOutCubic(dv);
    // the pivot glides to the screen centre while the zoom and the roll close in on it
    const s0 = w2s(PRESS_CAM, P.x, P.y);
    const sx = lerp(s0.x, W / 2, f), sy = lerp(s0.y, H / 2, f);
    const dx = (sx - W / 2) / z, dy = (sy - H / 2) / z;
    const cs = Math.cos(r), sn = Math.sin(r);
    return { x: P.x - (cs * dx + sn * dy), y: P.y - (-sn * dx + cs * dy), z, r };
  }

  /** The disc's state under the press (grooves on the slab's pitch; fine tracks in movement 2). */
  disc(t: number, cam: Cam): DiscState {
    const beatK = this.lastBeat(t);
    const sw = beatK != null ? prog(t, beatK, beatK + 0.42, ease.inOutQuad) : 1;
    const sweepA = lerp(0.2, -0.2, sw);
    const sweepK = beatK != null ? (1 - prog(t, beatK + 0.25, beatK + 0.45)) * 1.0 : 0;
    if (t < this.c2) {
      const s = this.slab(t);
      const phase = R_PRESS - (s.yA - s.cap / 2 - H / 2) + s.pitch / 2;
      return { cam, t, pitch: s.pitch, phase, groove: 1, sheen: 0.8, sheenA: 0.55, sweepA, sweepK, wedge: 1, data: 1 };
    }
    return { cam, t, hot: 0.2, pitch: 48, phase: 0, groove: 0.6, sheen: 0.8, sheenA: 0.55, sweepA, sweepK: sweepK * 0.8, wedge: 1, data: 1.2 };
  }
  private lastBeat(t: number) {
    let b: number | null = null;
    for (const x of this.beats) if (x <= t) b = x;
    return b;
  }

  // -------------------------------------------------------------- draw
  draw(c: CanvasRenderingContext2D, t: number, cam: Cam): PostOverrides {
    const R = this.rup;
    const { k, sp } = this.stage(t);
    const kickP = t < this.c2 && k > 0 ? pulse(t, this.kickT(k), 0.08) : 0;
    const pressure = t < this.c2 ? (k + sp) / STAGES.length : 0;
    const bowT = t < this.c2 ? (1.5 + 8 * pressure) * (1 + 1.2 * kickP) : 0;
    // impacts shake/punch the type (in-scene: the fences and the platter stay put). The ruptures stay
    // under the head crash (the plate's one maximal hit, in movement 4).
    let hit = kickP * 0.35;
    const hw = [0.5, 0.45, 0.4, 0.62];
    for (let i = 0; i < R.length; i++) hit = Math.max(hit, pulse(t, R[i]!, 0.07) * hw[i]!);
    const lb = this.lastBeat(t);
    const beatP = lb != null ? pulse(t, lb, 0.09) : 0;
    const fr = frameIdx(t);
    this.shake = [(hash(fr, 1) - 0.5) * 30 * hit, (hash(fr, 2) - 0.5) * 20 * hit];
    this.zoom = 1 + 0.03 * hit + 0.012 * beatP;

    c.save();
    applyCam(c, cam);
    const px = 1 / cam.z;
    this.drawSlab(c, t, bowT, cam);
    if (t >= this.c2 - 0.04) this.drawStack(c, t, cam);
    this.drawTitleFence(c, t, bowT, px);
    this.drawGuardFence(c, t, px);
    this.drawZoneFence(c, t, px);
    this.drawHead(c, t, px);
    c.restore();
    if (t < this.c2 + 0.05) this.drawReadout(c, t, cam);
    return { hud: 0, bloom: t < this.c2 ? 0.62 : 0.45, bloomThreshold: 0.95, bloomKnee: 0.2, halation: 0.1, vignette: 0.34, ca: 0.7 + 1.6 * hit, grain: 0.05 };
  }

  /** In-scene punch: about the screen centre, before the world camera (unrolled ≈ screen). */
  private punch(c: CanvasRenderingContext2D, cam: Cam) {
    // undo the world camera, punch in screen space, redo it
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(W / 2 + this.shake[0], H / 2 + this.shake[1]);
    c.scale(this.zoom, this.zoom);
    c.translate(-W / 2, -H / 2);
    applyCam(c, cam);
  }

  // -------------------------------------------------------------- movement 1: the slab
  private drawSlab(c: CanvasRenderingContext2D, t: number, bow: number, cam: Cam) {
    const rel = t < this.c2 ? 0 : prog(t, this.c2, this.c2 + 0.3);
    if (rel >= 1) return;
    const s = this.slab(t);
    const { k, sp, S, cap, fam, tr, lA, lB, sx, pitch, yA, yB, yc } = s;
    const slotY = (i: number) => (i <= 0 ? yA + i * pitch : yB + (i - 1) * pitch);
    const gap = 0.3 * S;
    const uA = lA.width + tr + gap, uB = lB.width + tr + gap;
    const nA = sungChars(this.A.words, this.A.texts, t), nB = sungChars(this.B.words, this.B.texts, t);
    const pr = (k + sp) / STAGES.length;
    const copyCol = mixCss('graphite', 'ash', 0.4 * clamp(pr * 1.3 - 0.2));
    const copyColB = mixCss('graphite', 'ash', 0.4 * clamp(pr * 1.3 - 0.2) - 0.14);

    c.save();
    // clip to the sector (bowed), then to the guard band once the sector has gone
    const clipR = rel === 0 ? SECTOR : GUARD;
    polyPath(c, bowPoly(clipR, rel === 0 ? bow : 0));
    c.clip();
    this.punch(c, cam);
    const trem = 3 * prog(t, this.kicks[this.kicks.length - 1] ?? this.c2, this.c2, ease.inQuad) * (rel === 0 ? 1 : 0);
    if (trem > 0) { const fr = frameIdx(t); c.translate((hash(fr, 31) - 0.5) * trem, (hash(fr, 32) - 0.5) * trem); }
    const rowsN = 9;
    // the track edges of the slab (hairlines between the tracks)
    c.strokeStyle = rgba('graphite', 0.5 * (1 - rel));
    c.lineWidth = 1;
    c.beginPath();
    for (let i = -rowsN; i <= rowsN + 1; i++) {
      const y = slotY(i) - cap / 2 - pitch / 2;
      if (y < SECTOR.y0 || y > SECTOR.y1) continue;
      for (let x = SECTOR.x0; x <= SECTOR.x1 + 1; x += 48) { const P = U(x, y); if (x === SECTOR.x0) c.moveTo(P.x, P.y); else c.lineTo(P.x, P.y); }
    }
    c.stroke();
    c.font = font(fam, S);
    c.letterSpacing = '0px';
    const heroes: [number, number, boolean][] = [];
    for (let i = -rowsN; i <= rowsN + 1; i++) {
      const hero = i === 0 || i === 1;
      const dist = i <= 0 ? -i : i - 1;
      const order = hero ? 0 : Math.min(STAGES.length - 1, dist);
      if (order > k) continue;
      const intro = order === 0 ? 1 : springStep(t - this.kickT(order), 3.2, 0.6);
      // new tracks are stuffed in from beyond the sector's walls and packed toward the head's tracks
      let y = slotY(i) + (i <= 0 ? -1 : 1) * H * 0.55 * (1 - intro);
      const isA = i % 2 === 0;
      const dir = isA ? -1 : 1;
      let xoff = 0;
      if (rel > 0) {
        y = yc + (y - cap / 2 - yc) * (1 + 1.2 * ease.outCubic(rel)) + cap / 2;
        xoff = dir * (0.8 + 0.4 * hash(i, 17)) * (1400 * rel + 1400 * rel * rel);
      }
      if (y - cap > GUARD.y1 + 20 || y < GUARD.y0 - 20) continue;
      if (hero) { heroes.push([y, xoff, isA]); continue; }
      const l = isA ? lA : lB, uu = isA ? uA : uB;
      const phase = ((Math.floor(i / 2) % 2 + 2) % 2) * 0.5 * uu + (isA ? 0 : 0.25 * uu);
      c.fillStyle = isA ? copyCol : copyColB;
      for (let x = SECTOR.x0 - phase - uu; x < SECTOR.x0 + (SECTOR.x1 - SECTOR.x0) / sx; x += uu) {
        if (x + uu < SECTOR.x0) continue;
        runU(c, l, x + xoff, y, 0, 999, sx, SECTOR.x0);
      }
    }
    // the head's two tracks on top: set on a flat band the packed tracks slide under
    const band = heroes.length ? 1 - prog(rel, 0, 0.12) : 0;
    if (band > 0 && heroes.length) {
      const ys = heroes.map(([y]) => y), pad = 0.16 * cap;
      const y0 = Math.min(...ys) - cap - pad, y1 = Math.max(...ys) + pad;
      c.fillStyle = rgba('ink', 0.94 * band);
      c.beginPath();
      for (let x = SECTOR.x0 - 40; x <= SECTOR.x1 + 40; x += 40) { const P = U(x, y0); if (x === SECTOR.x0 - 40) c.moveTo(P.x, P.y); else c.lineTo(P.x, P.y); }
      for (let x = SECTOR.x1 + 40; x >= SECTOR.x0 - 40; x -= 40) { const P = U(x, y1); c.lineTo(P.x, P.y); }
      c.closePath(); c.fill();
    }
    for (const [y, xoff, isA] of heroes) {
      const h = isA ? this.A : this.B, l = isA ? lA : lB, n = isA ? nA : nB;
      const x = SECTOR.x0 + xoff;
      if (rel > 0) { c.fillStyle = isA ? copyCol : copyColB; runU(c, l, x, y, 0, 999, sx, SECTOR.x0); continue; }
      const live = h.words.some((w) => t >= w.start && t < w.end + 0.05);
      c.fillStyle = rgba('bone', 0.22);
      runU(c, l, x, y, n, 999, sx, SECTOR.x0);
      if (n > 0) {
        // the words already written: bone; the one being written: signal
        const cur = this.curWord(h, t);
        const n0 = cur >= 0 ? this.wordStart(h, cur) : n;
        c.fillStyle = rgba('bone', 0.96);
        runU(c, l, x, y, 0, Math.min(n, n0), sx, SECTOR.x0);
        if (live && n > n0) { c.fillStyle = rgba('signal'); runU(c, l, x, y, n0, n, sx, SECTOR.x0); }
      }
    }
    c.restore();
    c.restore();
  }

  private curWord(h: Hero, t: number) { return h.words.findIndex((w) => t >= w.start && t < w.end + 0.05); }
  private wordStart(h: Hero, i: number) { let n = 0; for (let j = 0; j < i; j++) n += h.texts[j]!.length + 1; return n; }

  // -------------------------------------------------------------- the head (the cursor)
  private headPos(t: number): { x: number; y: number; on: boolean } | null {
    if (t < this.c2) {
      const s = this.slab(t);
      const onB = t >= this.B.words[0]!.start - 0.06;
      const h = onB ? this.B : this.A, l = onB ? s.lB : s.lA;
      const n = sungChars(h.words, h.texts, t);
      let x = SECTOR.x0 + xAt(l, n) * s.sx;
      let y = (onB ? s.yB : s.yA) - s.cap * 0.45;
      // the carriage return to the second track: a 70 ms seek
      const tb = this.B.words[0]!.start - 0.06;
      if (onB && t < tb + 0.09) {
        const e = ease.outExpo(prog(t, tb, tb + 0.09));
        x = lerp(SECTOR.x0 + s.lA.width * s.sx, x, e);
        y = lerp(s.yA - s.cap * 0.45, y, e);
      }
      // a seek on every kick: off the track and a ringing settle back onto it
      const kk = this.stage(t).k;
      if (kk > 0) {
        const dt = t - this.kickT(kk);
        const sgn = kk % 2 ? -1 : 1;
        y += sgn * s.pitch * 0.55 * Math.exp(-dt / 0.07) * Math.cos(dt * 55);
        x += 10 * Math.exp(-dt / 0.05) * Math.sin(dt * 70);
      }
      const on = h.words.some((w) => t >= w.start - 0.02 && t < w.end + 0.03);
      return { x, y, on };
    }
    // movement 2: the head rides the row being written
    const boxes = this.stackLayout(t);
    let ri = -1;
    for (let i = 0; i < this.rows.length; i++) if (t >= this.rows[i]!.tShow - 0.1) ri = i;
    if (ri < 0) return null;
    const r = this.rows[ri]!, b = boxes[ri]!;
    const l = lay(r.text, r.fam, r.size, r.track);
    const n = sungChars(r.words, r.texts, t);
    const x0 = r.left ? FENCE_X : W / 2 - l.width / 2;
    const lx = x0 + xAt(l, n);
    const x = b.ax + (lx - b.ax) * b.k, y = b.cy + (b.base - b.cap * 0.5 - b.cy) * b.k;
    const on = r.words.some((w) => t >= w.start - 0.02 && t < w.end + 0.03);
    return { x, y, on };
  }

  private drawHead(c: CanvasRenderingContext2D, t: number, px: number) {
    const h = this.headPos(t);
    if (!h) return;
    const dv = this.dive(t);
    if (dv > 0.6) return;
    const P = U(h.x, h.y);
    const burst = t >= this.c2 ? this.rup.reduce((m, r) => Math.max(m, pulse(t, r, 0.06)), 0) : 0;
    const kick = t < this.c2 ? this.kicks.reduce((m, k) => Math.max(m, pulse(t, k, 0.05)), 0) : 0;
    // the arm swings a hair with each seek (it pivots off-frame)
    const ang = ARM_ANG + 0.02 * Math.sin((t - this.t0) * 0.9) + 0.03 * kick - 0.04 * burst;
    drawArm(c, P.x, P.y, ang + P.a, px, { hot: h.on ? 1 : 0.25, slam: burst });
    // the servo reads a wedge on every beat: the dot ticks
    const lb = this.lastBeat(t);
    const tick = lb != null ? pulse(t, lb, 0.06) : 0;
    c.save();
    c.translate(P.x, P.y);
    dot2D(c, 0, 0, t, (h.on ? 1.05 : 0.7) * (1 + 0.8 * burst + 0.5 * kick + 0.35 * tick), h.on ? 1 : 0.7 + 0.3 * tick, 0.35);
    c.restore();
  }

  /** The leader-line readout on each seek: tracks per inch (gone within half a second). */
  private drawReadout(c: CanvasRenderingContext2D, t: number, cam: Cam) {
    const { k } = this.stage(t);
    const tk = this.kickT(k);
    const age = t - tk;
    const life = k === 0 ? 1 - prog(t, this.t0 + 0.45, this.t0 + 0.6) : 1 - prog(age, 0.42, 0.55);
    const inA = k === 0 ? prog(t, this.t0 + 0.02, this.t0 + 0.08) : prog(age, 0, 0.04);
    const a = Math.min(inA, life) * (1 - prog(t, this.c2 - 0.02, this.c2 + 0.04));
    if (a <= 0.01) return;
    const h = this.headPos(t);
    if (!h) return;
    const Pw = U(h.x, h.y);
    const p = w2s(cam, Pw.x, Pw.y);
    const v = this.tpi(t);
    c.save();
    c.globalAlpha = a;
    // above the head's two tracks, up and to the left of the head (the arm goes up and to the right)
    const s = this.slab(t);
    const bw = 262, bh = 70;
    const by = Math.min(p.y - 150, s.yA - s.cap - 36 - bh);
    const bx = Math.max(40, Math.min(W - bw - 40, p.x - 110 - bw));
    const ex = Math.min(p.x - 30, bx + bw), ey = by + bh;
    c.strokeStyle = rgba('bone', 0.75); c.lineWidth = 1;
    c.beginPath(); c.moveTo(p.x - 6, p.y - 12); c.lineTo(ex, ey + 18); c.lineTo(ex, ey); c.stroke();
    c.fillStyle = rgba('ink', 0.92); c.fillRect(bx, by, bw, bh);
    c.strokeStyle = rgba('bone', 0.35); c.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    c.font = font(F.mono(500), 12); c.letterSpacing = '2.5px'; c.fillStyle = rgba('bone', 0.6);
    c.fillText(k === 0 ? 'TRACKS / INCH' : `SEEK · TRK ${(48212 + 1733 * k).toLocaleString('en-US')}`, bx + 14, by + 22);
    c.letterSpacing = '0px';
    c.font = font(F.mono(500), 32);
    c.fillStyle = k >= STAGES.length - 1 ? rgba('signal') : rgba('bone', 0.95);
    c.textAlign = 'right'; c.fillText(v.toLocaleString('en-US'), bx + bw - 14, by + 58);
    c.font = font(F.mono(400), 12); c.fillStyle = rgba('bone', 0.5); c.textAlign = 'left';
    c.fillText('TPI', bx + 14, by + 57);
    c.restore();
  }

  // -------------------------------------------------------------- movement 2: the stack
  stackLayout(t: number): (RowBox | null)[] {
    const rows = this.rows;
    let cur = -1;
    for (let i = 0; i < rows.length; i++) if (t >= rows[i]!.tShow - 0.12) cur = i;
    const ys: number[] = [];
    let y = 0;
    rows.forEach((r, i) => { y += i === 0 ? r.cap : r.cap + 0.1 * r.cap; ys.push(y); });
    const target = (i: number) => {
      if (i === 0) return H / 2 + rows[0]!.cap / 2 - ys[0]!;
      if (i === rows.length - 1) return H * 0.6 + rows[i]!.cap / 2 - ys[i]!;
      const top = ys[i - 1]! - rows[i - 1]!.cap, bot = ys[i]!;
      return H / 2 - (top + bot) / 2;
    };
    let off = target(0);
    for (let i = 1; i <= Math.max(0, cur); i++) off = lerp(off, target(i), prog(t, rows[i]!.tShow - 0.03, rows[i]!.tShow + 0.22, ease.outExpo));
    return rows.map((r, i) => {
      if (i > cur) return null;
      const burst = t < r.tIn ? 0 : springStep(t - r.tIn, 3.4, 0.45);
      let k = lerp(r.wPre / r.w, 1, burst) + 0.05 * pulse(t, r.tIn, 0.05);
      if (i === rows.length - 1) {
        k *= 1 + 0.03 * prog(t, r.tIn, this.c3, ease.outQuad);
        const lb = this.lastBeat(t);
        if (lb != null && lb > r.tIn + 0.1 && t < this.c3 - DIVE) k *= 1 + 0.035 * pulse(t, lb, 0.07);
      }
      const base = off + ys[i]!;
      const ax = r.left ? FENCE_X : W / 2;
      const x0 = r.left ? FENCE_X : W / 2 - (r.w * k) / 2;
      return { base, cap: r.cap, k, cy: base - r.cap / 2, ax, x0 };
    });
  }

  private drawStack(c: CanvasRenderingContext2D, t: number, cam: Cam) {
    const boxes = this.stackLayout(t);
    this.punch(c, cam);
    this.rows.forEach((r, i) => {
      const b = boxes[i];
      if (!b) return;
      const appear = prog(t, r.tShow - 0.12, r.tShow);
      const l = lay(r.text, r.fam, r.size, r.track);
      const x0 = r.left ? FENCE_X : W / 2 - l.width / 2;
      // scale about (ax, cy) in unrolled coordinates: glyph positions and sizes
      const base = b.cy + (b.base - b.cy) * b.k;
      const xk = b.ax + (x0 - b.ax) * b.k;
      c.font = font(r.fam, r.size);
      const run = (from: number, to: number) => runU(c, l, xk, base, from, to, 1, xk, b.k);
      // the first row is punched out of the slab: an ink cut-out until the debris has cleared
      if (i === 0 && t < this.c2 + 0.35) { c.fillStyle = rgba('ink', 1 - prog(t, this.c2 + 0.15, this.c2 + 0.35)); run(0, 999); }
      let ci = 0;
      r.words.forEach((w, wi) => {
        const len = r.texts[wi]!.length;
        const n = sungChars([w], [r.texts[wi]!], t);
        if (n < len) { c.fillStyle = rgba('bone', 0.16 * appear); run(ci + n, ci + len); }
        if (n > 0) { c.fillStyle = t < w.end + 0.04 ? rgba('signal') : rgba('bone'); run(ci, ci + n); }
        ci += len + 1;
      });
    });
    c.restore();
  }

  // -------------------------------------------------------------- fences
  private label(c: CanvasRenderingContext2D, text: string, x: number, y: number, a: number, alignRight = false, strike = 0, warn = '') {
    if (a <= 0) return;
    const P = U(x, y);
    c.save();
    c.translate(P.x, P.y); c.rotate(P.a);
    c.font = font(F.mono(500), 11); c.letterSpacing = '2px';
    const w = c.measureText(text).width;
    const lx = alignRight ? -w : 0;
    c.fillStyle = rgba('ink', a); c.fillRect(lx - 7, -7, w + 12, 13);
    c.fillStyle = rgba('bone', 0.8 * a);
    c.textBaseline = 'middle';
    c.fillText(text, lx, 0.5);
    if (strike > 0) { c.fillStyle = rgba('signal', a); c.fillRect(lx - 3, -0.5, (w + 4) * strike, 1.5); }
    if (warn) {
      const ww = c.measureText(warn).width;
      const wx = alignRight ? lx - 16 - ww : lx + w + 16;
      c.fillStyle = rgba('ink', a); c.fillRect(wx - 7, -7, ww + 12, 13);
      c.fillStyle = rgba('signal', a); c.fillText(warn, wx, 0.5);
    }
    c.restore();
  }

  /** The tripwire flash: the whole fence runs hot for an instant as it gives way. */
  private trip(c: CanvasRenderingContext2D, r: Rect, dt: number, px: number, k = 1) {
    if (dt < 0 || dt > 0.25) return;
    const hot = k * Math.exp(-dt * 16);
    c.save();
    c.strokeStyle = rgba('ember', Math.min(1, hot)); c.lineWidth = 2.2 * px;
    polyPath(c, bowPoly(r, 0)); c.stroke();
    c.strokeStyle = rgba('signal', Math.min(1, hot * 0.8)); c.lineWidth = 6 * px;
    c.stroke();
    c.restore();
  }

  /** A hairline edge recoiling into its corner after it snapped: the free end whips outward. */
  private recoil(c: CanvasRenderingContext2D, cx: number, cy: number, px0: number, py0: number, nx: number, ny: number, dt: number, a: number, seed: number, px: number) {
    const rec = ease.outCubic(prog(dt, 0, 0.28 + 0.08 * hash(seed, 1)));
    const L = 1 - rec;
    if (L <= 0.003) return;
    const ex = lerp(cx, px0, L), ey = lerp(cy, py0, L);
    const fl = (50 + 40 * hash(seed, 2)) * Math.sin(Math.PI * Math.min(1, dt / 0.3)) * L;
    const qx = (cx + ex) / 2 + nx * fl * 0.6, qy = (cy + ey) / 2 + ny * fl * 0.6, fx = ex + nx * fl, fy = ey + ny * fl;
    c.strokeStyle = rgba('bone', a); c.lineWidth = 1.25 * px;
    c.beginPath();
    for (let i = 0; i <= 16; i++) {
      const s = i / 16, m = 1 - s;
      const P = U(m * m * cx + 2 * m * s * qx + s * s * fx, m * m * cy + 2 * m * s * qy + s * s * fy);
      if (i) c.lineTo(P.x, P.y); else c.moveTo(P.x, P.y);
    }
    c.stroke();
    const hot = Math.exp(-dt * 8);
    if (hot > 0.03) {
      const dx = cx - fx, dy = cy - fy, dl = Math.hypot(dx, dy) || 1;
      const A = U(fx, fy), B = U(fx + (dx / dl) * 24, fy + (dy / dl) * 24);
      c.strokeStyle = rgba('ember', hot); c.lineWidth = 2.5 * px;
      c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
    }
  }

  /** A loose hairline fragment flung outward. */
  private fragment(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, vx: number, vy: number, spin: number, dt: number, a: number, px: number) {
    const mx = (ax + bx) / 2 + vx * dt, my = (ay + by) / 2 + vy * dt + 300 * dt * dt;
    const hx = (bx - ax) / 2, hy = (by - ay) / 2;
    const r = spin * dt, cs = Math.cos(r), sn = Math.sin(r);
    const qx = hx * cs - hy * sn, qy = hx * sn + hy * cs;
    const A = U(mx - qx, my - qy), B = U(mx + qx, my + qy);
    c.strokeStyle = rgba('bone', a); c.lineWidth = 1.25 * px;
    c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke();
    const hot = Math.exp(-dt * 7);
    if (hot > 0.03) { c.strokeStyle = rgba('ember', 0.8 * hot); c.lineWidth = 1.8 * px; c.stroke(); }
  }

  private drawTitleFence(c: CanvasRenderingContext2D, t: number, bow: number, px: number) {
    const r = SECTOR, tb = this.rup[0]!, dt = t - tb;
    const inA = prog(t, this.t0, this.t0 + 0.1, ease.outCubic);
    c.save();
    if (dt < 0) {
      c.strokeStyle = rgba('bone', 0.5 + 0.35 * clamp(bow / 8));
      c.lineWidth = px;
      polyPath(c, bowPoly(r, bow)); c.stroke();
      this.label(c, 'SECTOR 0x3A1F · 4 KiB', r.x0 + 26, r.y0 - 0.06 * bow, inA);
    } else {
      this.trip(c, r, dt, px);
      const life = 1 - prog(dt, 0.3, 0.75);
      if (life > 0) {
        for (const [x, s] of [[r.x0, -1], [r.x1, 1]] as const) {
          let y = r.y0;
          for (let j = 0; y < r.y1; j++) {
            const len = 50 + 90 * hash(j, s, 21);
            const y1 = Math.min(r.y1, y + len);
            const v = 500 + 1300 * hash(j, s, 22);
            this.fragment(c, x, y + 3, x, y1 - 3, s * v, (hash(j, s, 23) - 0.5) * 300, (hash(j, s, 24) - 0.5) * 14, dt, 0.8 * life, px);
            y = y1;
          }
        }
        for (const [yy, ny] of [[r.y0, -1], [r.y1, 1]] as const) {
          const pxm = lerp(r.x0, r.x1, 0.45 + 0.1 * hash(ny, 5));
          this.recoil(c, r.x0, yy, pxm, yy, 0, ny, dt, 0.8 * life, 11 + ny, px);
          this.recoil(c, r.x1, yy, pxm, yy, 0, ny, dt, 0.8 * life, 13 + ny, px);
        }
        this.label(c, 'SECTOR 0x3A1F · 4 KiB', r.x0 + 26, r.y0 - 30 * ease.outCubic(prog(dt, 0, 0.3)), life, false, ease.outExpo(prog(dt, 0, 0.1)), 'WARN write past sector');
      }
    }
    c.restore();
  }

  private drawGuardFence(c: CanvasRenderingContext2D, t: number, px: number) {
    const r = GUARD, tb = this.rup[1]!, dt = t - tb;
    const inA = prog(t, this.t0 + 0.04, this.t0 + 0.14, ease.outCubic);
    const load = t < this.rup[0]! ? 0 : 1;
    const bow = t < this.rup[0]! ? 0 : 22 * pulse(t, this.rup[0]!, 0.07) + 3;
    c.save();
    if (dt < 0) {
      c.strokeStyle = rgba('bone', 0.4 + 0.45 * load);
      c.lineWidth = (1 + 0.25 * load) * px;
      polyPath(c, bowPoly(r, bow)); c.stroke();
      this.label(c, 'GUARD BAND', r.x1 - 26, r.y0 - 0.06 * bow, inA, true);
    } else {
      this.trip(c, r, dt, px);
      const life = 1 - prog(dt, 0.3, 0.75);
      if (life > 0) {
        const bx = this.stackLayout(tb)[1];
        const yb0 = bx ? bx.base - bx.cap * bx.k - 8 : H * 0.4, yb1 = bx ? bx.base + 8 : H * 0.6;
        for (const [x, s] of [[r.x0, -1], [r.x1, 1]] as const) {
          this.recoil(c, x, r.y0, x, yb0, s, 0, dt, 0.85 * life, 31 + s, px);
          this.recoil(c, x, r.y1, x, yb1, s, 0, dt, 0.85 * life, 33 + s, px);
          for (let j = 0; j < 3; j++) {
            const a0 = lerp(yb0, yb1, j / 3), b0 = lerp(yb0, yb1, (j + 1) / 3);
            this.fragment(c, x, a0 + 2, x, b0 - 2, s * (900 + 900 * hash(j, s, 41)), (hash(j, s, 42) - 0.5) * 400, (hash(j, s, 43) - 0.5) * 16, dt, 0.85 * life, px);
          }
        }
        for (const [yy, ny] of [[r.y0, -1], [r.y1, 1]] as const) {
          const pxm = lerp(r.x0, r.x1, 0.5 + 0.12 * (hash(ny, 6) - 0.5));
          const d2 = dt - 0.05;
          if (d2 < 0) { c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.25 * px; c.beginPath(); edge(c, r.x0, yy, r.x1, yy); c.stroke(); continue; }
          this.recoil(c, r.x0, yy, pxm, yy, 0, ny, d2, 0.85 * life, 35 + ny, px);
          this.recoil(c, r.x1, yy, pxm, yy, 0, ny, d2, 0.85 * life, 37 + ny, px);
        }
        this.label(c, 'GUARD BAND', r.x1 - 26, r.y0 - 30 * ease.outCubic(prog(dt, 0, 0.3)), life, true, ease.outExpo(prog(dt, 0, 0.1)), 'WARN adjacent tracks erased');
      }
    }
    c.restore();
  }

  /** The last fence: the data zone (the platter's recording area), with its corner marks. */
  private drawZoneFence(c: CanvasRenderingContext2D, t: number, px: number) {
    const [, tA, tB, tS] = this.rup as [number, number, number, number];
    const snap = t - tS;
    const bowK = t < tB ? 0 : springStep(t - tB, 2.4, 0.4);
    const bowI = t < tA ? 0 : 10 * pulse(t, tA, 0.06);
    const lb = this.lastBeat(t);
    const shiver = lb != null && lb > tA + 0.05 && t < tS ? 9 * pulse(t, lb, 0.06) : 0;
    const bow = bowI + 70 * bowK + shiver;
    c.save();
    if (t >= tA && snap < 0) {
      const a = 0.75 * prog(t, tA, tA + 0.04);
      c.strokeStyle = t >= tB ? rgba('signal', a) : rgba('bone', a);
      c.lineWidth = 1.5 * px;
      polyPath(c, bowPoly(ZONE, bow)); c.stroke();
      this.label(c, t >= tB ? 'DATA ZONE — UNDER LOAD' : 'DATA ZONE', W / 2, 16 - 0.5 * bow, a / 0.75, false, 0, t >= tB ? 'WARN head near edge' : '');
    }
    if (snap >= 0) this.trip(c, ZONE, snap, px, 1.4);
    if (snap >= 0 && snap < 0.75) this.label(c, 'DATA ZONE', W / 2, 16 - 40 * ease.outCubic(prog(snap, 0, 0.3)), 1 - prog(snap, 0.3, 0.75), false, ease.outExpo(prog(snap, 0, 0.1)), 'FAIL write outside data zone');
    // corner marks: the zone's guides
    const m = 36, l0 = 22;
    const l = l0 + 18 * (t < tA ? 0 : 1) * prog(t, tA, tA + 0.1, ease.outCubic);
    const splay = 0.38 * bowK;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy], i) => {
      let ox = -sx! * 10 * bowK, oy = -sy! * 7 * bowK, rot = 0;
      let alpha = t < tA ? 0 : 0.75 * prog(t, tA, tA + 0.04);
      if (snap > 0) {
        const v = 1100 + 600 * hash(i, 9);
        ox += -sx! * v * snap; oy += -sy! * v * 0.55 * snap + 500 * snap * snap;
        rot = (hash(i, 4) - 0.5) * 10 * snap;
        alpha *= 1 - prog(snap, 0.15, 0.45);
      }
      if (alpha <= 0) return;
      const P = U(x! + ox, y! + oy);
      c.save();
      c.translate(P.x, P.y); c.rotate(rot + P.a);
      c.strokeStyle = t >= tB ? rgba('signal', alpha) : rgba('bone', alpha);
      c.lineWidth = 1.5 * px;
      c.beginPath();
      c.moveTo(sx! * l * Math.cos(splay), -sy! * l * Math.sin(splay)); c.lineTo(0, 0);
      c.lineTo(-sx! * l * Math.sin(splay), sy! * l * Math.cos(splay));
      c.stroke();
      c.restore();
    });
    c.restore();
  }
}

// ------------------------------------------------------------------ bowed boxes on the platter
/** Rectangle (unrolled) with each edge bowed outward by b at its midpoint, sampled, in world points. */
export function bowPoly(r: Rect, b: number): { x: number; y: number }[] {
  const { x0, y0, x1, y1 } = r;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const bh = 2 * b * 0.56;
  const pts: { x: number; y: number }[] = [];
  const quad = (ax: number, ay: number, qx: number, qy: number, bx: number, by: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const s = i / n, m = 1 - s;
      pts.push(U(m * m * ax + 2 * m * s * qx + s * s * bx, m * m * ay + 2 * m * s * qy + s * s * by));
    }
  };
  quad(x0, y0, mx, y0 - bh, x1, y0, 40);
  quad(x1, y0, x1 + 2 * b, my, x1, y1, 16);
  quad(x1, y1, mx, y1 + bh, x0, y1, 40);
  quad(x0, y1, x0 - 2 * b, my, x0, y0, 16);
  return pts;
}
export function polyPath(c: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
}
function edge(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number) {
  for (let i = 0; i <= 24; i++) { const P = U(lerp(ax, bx, i / 24), lerp(ay, by, i / 24)); if (i) c.lineTo(P.x, P.y); else c.moveTo(P.x, P.y); }
}
