// VERSE B (verse 2, second half): "the world's most powerful computer" / "simulation". Structure: P(doom)'s
// leftturn, move for move (docs/PDOOM-STRUCTURE.md): one continuous drawing sheet, no hard cut, a chase
// camera behind the thread object, three whips (true multi-tap motion blur) dividing it into blocks, one
// landing punch, a crane-out reveal, stamps on beats rising to per-syllable punches, and a drain to one
// shape that becomes the next plate's first. Imagery (docs/PLATES.md #8): a data-hall floor plan that
// becomes its own airflow simulation. 9.75 bars, twice leftturn: an extra block between the lines.
//  A  (plan)  The sheet rises from black. The tracer (a blue air particle; the rack status LEDs wake as it
//     passes) runs east down cold aisle 3; the first line is stencilled on the perforated floor tiles one
//     letter per tile as it is sung, the tracer as cursor; the racks it passes are stamped ONLINE on the beats.
//  W1 On "world's" it swerves out through the containment doors into the cross aisle: the camera whips 90°.
//  B  (certificate)  "world's most powerful" painted on the cross-aisle floor as it brakes; the camera pushes
//     in on row J's end cabinet, developed flat in the aisle, where a ranking certificate hangs on the door.
//     HIT "computer": the tracer lands in the rank box; a stamp COMPUTER / RANK #1 slams down (the maximal
//     hit). Crane out with a quarter turn back to north up, landing on the downbeat: the whole hall, one of
//     564 racks, IT LOAD 150 MW in the corner. On the snare, a tighter reframe and the callout: the
//     certificate is valid until the next list.
//  W2 Whip west to the CRAH end of cold aisle 3.
//  C  (air, the added block)  The cold air switches on tile by tile along the aisle, one tile per beat, then
//     one per 8th: the perforations blow blue, the stencilled letters light again as the front passes.
//  W3 On "Simulation" a whip north with a zoom dip: the plan becomes its own CFD model around the tracer,
//     one layer per syllable (mesh, isotherms, streaks, temperature), a punch per syllable. The lyric is set
//     as the isotherms' contour labels: SIMULATION along the 20 °C line, IT'S / THE / FUTURE on the
//     lines the tracer crosses as it climbs through the rack row.
//  D  Crane out to the whole simulated hall; the tracer rides the flow across it to the one hot spot, row
//     J's cabinet, where a 3U slot has no blanking panel. Push in with a quarter turn; everything drains
//     but the slot: HANDOFF.slot, the tape library's first slot.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, layout, smart } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog, pulse, TAU } from '../engine/util';
import { dot2D, burst2D, HANDOFF } from './_power';
import {
  HALL, TILE, PANEL, CERT, SLOT, Route, makeRoute, S_TILES, S_CORNER, S_LANE,
  certCentre, rankCentre, slotCentre, traceIso, isoY,
} from './hall-plan';
import { WorldLayer, makeHallPass, type Cam } from './hall-gl';
import { makeCertificate, makeStamp, STAMP, drawPlan, drawSheet, drawPanels, drawSlot, type Box } from './hall-draw';

const clean = (s: string) => smart(s).replace(/[,.?!“”"…]/g, '').toUpperCase();
const TILE_F = F.archivo(62, 900);
const ZL = 4.0; // zoom on the certificate as the tracer lands (before the punch)
const LABEL_F = F.archivo(75, 900);

type Glyph = { ch: string; s: number; w: number; tP: number; word: number };
type Label = { route: Route; glyphs: { ch: string; s: number; w: number }[]; s0: number; s1: number; size: number; word: Word; T0: number };

/** Char timeline of consecutive words: keyframes (time, chars), spaces crossed between words. */
function charKeys(words: Word[]): [number, number][] {
  const ks: [number, number][] = [];
  let c = 0, tPrev = -1e9;
  words.forEach((w, i) => {
    const len = Array.from(clean(w.w)).length;
    if (i > 0) c += 1;
    const a = Math.max(w.start, tPrev + 0.04), b = Math.max(w.end, a + 0.05);
    ks.push([a, c], [b, c + len]);
    c += len; tPrev = b;
  });
  return ks;
}
function interp(ks: [number, number][], t: number) {
  if (t <= ks[0]![0]) return ks[0]![1];
  for (let i = 1; i < ks.length; i++) {
    const [tb, vb] = ks[i]!, [ta, va] = ks[i - 1]!;
    if (t <= tb) return lerp(va, vb, (t - ta) / Math.max(1e-6, tb - ta));
  }
  return ks[ks.length - 1]![1];
}

/** Blend two camera poses (zoom in log space). */
function mixCam(a: Cam, b: Cam, k: number): Cam {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rot: lerp(a.rot, b.rot, k), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)) };
}
/** Flat screen position of a world point. */
function toScreen(c: Cam, x: number, y: number) {
  const dx = (x - c.x) * c.zoom, dy = (y - c.y) * c.zoom, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
  return { x: W / 2 + cs * dx - sn * dy, y: H / 2 + sn * dx + cs * dy };
}
/** The camera that puts world point P at screen point s with zoom z and roll r. */
function camAnchor(Px: number, Py: number, sx: number, sy: number, z: number, r: number): Cam {
  const dx = (sx - W / 2) / z, dy = (sy - H / 2) / z, cs = Math.cos(r), sn = Math.sin(r);
  return { x: Px - (cs * dx + sn * dy), y: Py - (-sn * dx + cs * dy), rot: r, zoom: z };
}
/** Blend two poses keeping world point P on a straight screen path (no drift on big zooms). */
function mixAnchored(a: Cam, b: Cam, k: number, P: { x: number; y: number }): Cam {
  const z = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)), r = lerp(a.rot, b.rot, k);
  const sa = toScreen(a, P.x, P.y), sb = toScreen(b, P.x, P.y);
  return camAnchor(P.x, P.y, lerp(sa.x, sb.x, k), lerp(sa.y, sb.y, k), z, r);
}
/** Camera centred ahead of a point along the screen's +x (forward = right). */
function chaseCam(px: number, py: number, rot: number, zoom: number, leadPx: number, upPx = 0): Cam {
  return camAnchor(px, py, W / 2 - leadPx, H / 2 + upPx, zoom, rot);
}

export default class Hall extends Scene {
  ov = new WorldLayer();
  pass = makeHallPass(this.ov);
  route: Route = makeRoute();
  cert!: HTMLCanvasElement;
  stamp!: HTMLCanvasElement;
  tiles: Glyph[] = [];
  lane: Glyph[] = [];
  labels: Label[] = [];
  nums: { route: Route; text: string; s: number }[] = [];
  simRoute!: Route;
  simKeys: [number, number][] = [];
  capTile = 1; capLabel = 1;
  tileSize = 170; laneSize = 170;
  T = {
    s0: 0, end: 0, l1: null as unknown as Line, l2: null as unknown as Line,
    wA: [] as Word[], wB: [] as Word[], wC: null as unknown as Word, wS: [] as Word[],
    kA: [] as [number, number][], kB: [] as [number, number][],
    db0: 0, dbR: 0, fast: 0, ws: 0, pw: 0, land: 0, crane0: 0, db1: 0, call: 0,
    air0: 0, airT: [] as number[], sim: 0, syl: [] as number[], wide2: 0, hot: 0, quiet: 0, call2: 0, drain0: 0, slotIn: 0,
    beatsA: [] as number[], laneS0: 0, laneS1: 0, sLand: 0,
  };

  override init() {
    const { lyrics: ly, audio: au, start: s0, end } = this.ctx;
    const T = this.T;
    T.s0 = s0; T.end = end;
    const beatAfter = (t: number) => au.timeOfBeat(Math.ceil(au.beatAt(t) - 1e-6));
    const downAfter = (t: number) => au.downbeats.find((d) => d >= t - 1e-6) ?? beatAfter(t);
    const bi = (t: number) => Math.round(au.beatAt(t));
    // the two lines in the window: found by position (the first two lines starting inside it)
    const ls = ly.lines.filter((l) => l.start >= s0 - 0.3 && l.start < end - 0.5);
    if (ls.length < 2) throw new Error('verseB: expected two lines in the window');
    T.l1 = ls[0]!; T.l2 = ls[1]!;
    const n1 = T.l1.words.length;
    let iW = T.l1.words.findIndex((w) => /world/i.test(w.w));
    if (iW < 1 || iW > n1 - 2) iW = Math.max(1, Math.floor(n1 * 0.45));
    T.wA = T.l1.words.slice(0, iW);
    T.wB = T.l1.words.slice(iW, n1 - 1);
    T.wC = T.l1.words[n1 - 1]!;
    T.wS = T.l2.words;
    T.ws = T.wB[0]!.start;
    T.pw = T.wB[T.wB.length - 1]!.start;
    T.land = T.wC.start;
    T.db0 = downAfter(s0 + 0.05);
    T.dbR = downAfter(T.db0 + 0.1);
    if (T.dbR > T.ws - 0.8) T.dbR = T.db0;
    T.fast = T.wA.length > 1 ? T.wA[1]!.start : T.ws - 0.6;
    T.db1 = downAfter(T.wC.end - 0.1);
    T.crane0 = Math.max(T.land + 0.45, T.db1 - 0.8);
    T.call = beatAfter(T.db1 + 0.05);
    T.air0 = beatAfter(T.call + 0.05);
    T.sim = T.wS[0]!.start;
    // air tiles: one per beat, then one per 8th over the last three beats before "Simulation"
    const bSim = bi(T.sim), b8 = bSim - 3;
    T.airT = [];
    for (let b = bi(T.air0); b < b8; b++) T.airT.push(au.timeOfBeat(b));
    for (let h = 0; h < 6; h++) T.airT.push(au.timeOfBeat(b8 + h / 2));
    // "Simulation": four syllables, sung on the grid; each snaps to a vocal onset near its beat if one is close
    const sw = T.wS[0]!;
    if (sw.syl && sw.syl.length >= 4) T.syl = sw.syl.slice(0, 4).map((s) => s[0]);
    else {
      const vo = au.events('vocal', sw.start + 0.2, sw.end).map((e) => e[0]);
      T.syl = [sw.start];
      for (let k = 1; k < 4; k++) {
        const g = au.nearestBeat(sw.start + (k * (sw.end - sw.start)) / 4);
        const near = vo.filter((v) => Math.abs(v - g) < 0.12).sort((a, b) => Math.abs(a - g) - Math.abs(b - g))[0];
        T.syl.push(Math.max(T.syl[k - 1]! + 0.2, near ?? g));
      }
    }
    const lastS = T.wS[T.wS.length - 1]!;
    T.wide2 = downAfter(lastS.end - 0.05);
    T.drain0 = au.timeOfBeat(bi(end) - 2);
    T.hot = au.timeOfBeat(bi(T.wide2) + 2);
    T.quiet = Math.min(downAfter(T.hot + 0.1), T.drain0 - 1.0);
    T.call2 = Math.min(au.timeOfBeat(bi(T.quiet) + 2), T.drain0 - 0.5);
    T.slotIn = end - 0.34;
    T.beatsA = [];
    for (let b = bi(T.db0); au.timeOfBeat(b) < T.ws - 0.05; b++) T.beatsA.push(au.timeOfBeat(b));

    this.cert = makeCertificate();
    this.stamp = makeStamp(clean(T.wC.w));
    T.kA = charKeys(T.wA);
    const lastA = T.kA[T.kA.length - 1]!, prevA = T.kA[T.kA.length - 2]!;
    lastA[0] = Math.max(prevA[0] + 0.02, Math.min(lastA[0], T.ws - 0.06));
    T.kA.push([T.ws, lastA[1] + 1]); // the trailing space reaches the corner exactly on the whip
    T.kB = charKeys(T.wB);
    this.layoutLane();
    this.layoutTiles();
    this.layoutLabels();
    (this.pass.u.uAirX0!.value as number) = HALL.RW0;
    const at = this.pass.u.uAirT!.value as number[];
    for (let i = 0; i < 20; i++) at[i] = T.airT[i] ?? 1e5;
  }

  // ------------------------------------------------------------------ the lettering
  /** Cold aisle 3: one letter per perforated tile, painted as the tracer passes over it. */
  private layoutTiles() {
    const T = this.T;
    const c = document.createElement('canvas').getContext('2d')!;
    c.font = font(TILE_F, 100);
    this.capTile = c.measureText('H').actualBoundingBoxAscent / 100;
    let widest = 0;
    const text = T.wA.map((w) => clean(w.w)).join(' ');
    for (const ch of text) widest = Math.max(widest, c.measureText(ch).width / 100);
    this.tileSize = Math.min(150 / (this.capTile * 1.28), 100 / Math.max(widest, 0.01));
    let wi = 0;
    Array.from(text).forEach((ch, i) => {
      if (ch === ' ') { wi++; return; }
      const s = S_TILES + i * TILE + TILE / 2;
      this.tiles.push({ ch, s, w: TILE, tP: this.timeAtS(s - 20), word: wi });
    });
  }

  /** The cross aisle: "world's most powerful" set along the lane, proportional, in the tracer's wake. */
  private layoutLane() {
    const T = this.T;
    const text = T.wB.map((w) => clean(w.w)).join(' ');
    T.laneS0 = S_LANE + 70;
    T.sLand = this.route.length;
    T.laneS1 = T.sLand - 150;
    const lay0 = layout(text, TILE_F, 100);
    this.laneSize = (100 * (T.laneS1 - T.laneS0)) / lay0.width;
    const lay = layout(text, TILE_F, this.laneSize);
    let wi = 0;
    lay.glyphs.forEach((g) => {
      if (g.ch === ' ') { wi++; return; }
      const s = T.laneS0 + g.x + g.w / 2;
      this.lane.push({ ch: g.ch, s, w: g.w, tP: 0, word: wi });
    });
    this.laneX = lay.glyphs.map((g) => ({ x: g.x, w: g.w }));
    for (const g of this.lane) g.tP = this.timeAtS(g.s - g.w * 0.3);
  }
  laneX: { x: number; w: number }[] = [];
  /** Arc length of lane char progress c (glyph boundaries). */
  private laneSOf(c: number) {
    const G = this.laneX;
    if (c <= 0) return this.T.laneS0;
    const i = Math.min(Math.floor(c), G.length - 1), f = Math.min(1, c - i);
    return this.T.laneS0 + G[i]!.x + f * G[i]!.w;
  }

  /** The contour labels: SIMULATION along the 20 °C isotherm, the other words on the lines the tracer climbs across. */
  private layoutLabels() {
    const T = this.T;
    const c = document.createElement('canvas').getContext('2d')!;
    c.font = font(LABEL_F, 100);
    this.capLabel = c.measureText('H').actualBoundingBoxAscent / 100;
    const size = 34;
    const ws = T.wS;
    const x0 = -1980, yA = -960; // cold aisle 2 (pair −1); row C's fronts at y = −1080
    const mk = (w: Word, T0: number, x: number, y0: number, y1: number): Label => {
      const text = clean(w.w);
      const lay = layout(text, LABEL_F, size);
      const y = isoY(T0, x, y0, y1);
      const pts = traceIso(T0, x - 30, y, lay.width + 120, 1, 3);
      const route = new Route(pts);
      const sA = 30;
      return { route, glyphs: lay.glyphs.map((g) => ({ ch: g.ch, s: sA + g.x + g.w / 2, w: g.w })), s0: sA, s1: sA + lay.width, size, word: w, T0 };
    };
    this.labels = [];
    this.labels.push(mk(ws[0]!, 20, x0, yA - 119, yA - 20));
    // the rest climb through row C: one isotherm each, 4 °C apart, stepping right
    let x = x0 + 60;
    ws.slice(1).forEach((w, i) => {
      const T0 = 26 + 4 * i;
      x += 70 + 30 * i;
      this.labels.push(mk(w, Math.min(T0, 34), x, -1080, -1330));
    });
    // numbered isotherms around them (the plain labels a model carries)
    this.nums = [];
    for (const [T0, xs, y0, y1] of [[22, x0 - 380, -1080, -960], [24, x0 - 300, -1090, -1300], [28, x0 - 330, -1090, -1300], [32, x0 - 360, -1090, -1300], [20, x0 + 520, -960, -1079], [30, x0 + 560, -1090, -1300]] as const) {
      const y = isoY(T0, xs, y0, y1);
      const r = new Route(traceIso(T0, xs, y, 140, 1, 4));
      this.nums.push({ route: r, text: `${T0} °C`, s: 40 });
    }
    // the sim tracer's path: along each label, crossing between them, then off with the flow to the hot spot
    const pts: { x: number; y: number }[] = [];
    const offs: number[] = [];
    this.labels.forEach((lb) => {
      const p0 = lb.route.at(lb.s0 - 18);
      if (pts.length) {
        const q = pts[pts.length - 1]!;
        for (let k = 1; k <= 8; k++) pts.push({ x: lerp(q.x, p0.x, k / 8), y: lerp(q.y, p0.y, k / 8) });
      }
      const base = pts.length ? new Route(pts).length : 0;
      offs.push(base - (lb.s0 - 18));
      for (let s = lb.s0 - 18; s <= lb.s1 + 14; s += 4) { const p = lb.route.at(s); pts.push({ x: p.x, y: p.y }); }
    });
    const last = pts[pts.length - 1]!, sc = slotCentre();
    const ctrl = [last, { x: last.x + 160, y: -1440 }, { x: -600, y: -1470 }, { x: 420, y: -1260 }, { x: 640, y: 200 }, { x: 560, y: 1700 }, { x: sc.x + 260, y: sc.y - 60 }, { x: sc.x, y: sc.y }];
    // Catmull-Rom through the control points
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)]!, p1 = ctrl[i]!, p2 = ctrl[i + 1]!, p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]!;
      for (let k = 1; k <= 24; k++) {
        const u = k / 24, u2 = u * u, u3 = u2 * u;
        pts.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
        });
      }
    }
    this.simRoute = new Route(pts);
    // keys: along each word as sung, quick crossings between them, then the drift to the slot
    const ks: [number, number][] = [];
    this.labels.forEach((lb, i) => {
      const w = lb.word, o = offs[i]!;
      const a = Math.max(w.start, (ks[ks.length - 1]?.[0] ?? -1e9) + 0.05);
      ks.push([a, o + lb.s0 - 18], [Math.max(w.end, a + 0.1), o + lb.s1 + 6]);
    });
    const lastK = ks[ks.length - 1]!;
    ks.push([lastK[0] + 0.25, lastK[1] + 30], [T.slotIn, this.simRoute.length]);
    this.simKeys = ks;
    this.labelOffs = offs;
  }
  labelOffs: number[] = [];

  // ------------------------------------------------------------------ the tracer
  /** Arc length along the route (blocks A and B). */
  sAt(t: number) {
    const T = this.T;
    const w0 = T.wA[0]!.start;
    if (t < w0) return lerp(S_TILES - 400, S_TILES, prog(t, T.s0, w0, ease.inQuad));
    if (t < T.ws) return S_TILES + TILE * interp(T.kA, t);
    const laneAt = (tt: number) => this.laneSOf(interp(T.kB, tt));
    const tj = T.ws + 0.2;
    if (t < tj) return lerp(S_CORNER, laneAt(tj), prog(t, T.ws, tj, (u) => u * (1.35 - 0.35 * u)));
    const td = T.land - 0.1;
    if (t < td) return laneAt(t);
    return lerp(laneAt(td), T.sLand, prog(t, td, T.land, ease.inQuad));
  }
  /** Inverse of sAt (monotonic), for paint times. */
  timeAtS(s: number) {
    let lo = this.T.s0 - 0.2, hi = this.T.land + 0.01;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (this.sAt(m) < s) lo = m; else hi = m; }
    return hi;
  }
  /** The air front's x in cold aisle 3 (block C): a 70 ms slide per tile. */
  airX(t: number) {
    const A = this.T.airT;
    let x = HALL.RW0;
    for (let i = 0; i < A.length; i++) if (t >= A[i]!) x = HALL.RW0 + TILE * i + TILE * ease.outExpo(clamp((t - A[i]!) / 0.07));
    return x;
  }
  simS(t: number) { return interp(this.simKeys, t); }

  /** Where the thread is, how bright. */
  tracer(t: number): { x: number; y: number; I: number } {
    const T = this.T;
    if (t < T.crane0) {
      const p = this.route.at(this.sAt(t));
      return { x: p.x, y: p.y, I: prog(t, T.s0 - 0.02, T.s0 + 0.1) * (1 - prog(t, T.land + 0.08, T.land + 0.5)) };
    }
    if (t < T.sim - 0.3) {
      const on = prog(t, T.air0 - 0.12, T.air0) * (1 - prog(t, T.sim - 0.45, T.sim - 0.3));
      return { x: this.airX(t) - 10, y: 0, I: on };
    }
    const p = this.simRoute.at(this.simS(t));
    return { x: p.x, y: p.y, I: prog(t, T.sim - 0.3, T.sim - 0.1) * (1 - prog(t, T.slotIn - 0.02, T.end - 0.08)) };
  }

  // ------------------------------------------------------------------ camera
  camChase(t: number): Cam {
    const T = this.T;
    const sp = this.route.at(this.sAt(t));
    const turn = (Math.PI / 2) * prog(t, T.ws - 0.02, T.ws + 0.24, ease.inOutCubic);
    // after the swerve, lean a little with the lane's curve
    const lean = t > T.ws ? 0.45 * (sp.a - Math.PI / 2) * prog(t, T.ws + 0.1, T.ws + 0.4) : 0;
    let zoom = keys(t, [
      [T.s0, 0.6], [T.db0, 0.76, ease.outCubic], [T.dbR, 0.8, ease.inOutQuad], [T.dbR + 0.25, 0.68, ease.outExpo],
      [T.fast, 0.7, ease.linear], [T.fast + 0.35, 0.76, ease.inOutQuad], [T.ws, 0.8, ease.linear],
      [T.ws + 0.2, 0.96, ease.outCubic], [T.ws + 0.45, 0.82, ease.inOutQuad], [T.pw, 0.86, ease.linear],
    ]);
    for (const b of T.beatsA) zoom *= 1 + 0.025 * pulse(t, b, 0.09);
    let roll = keys(t, [[T.dbR, 0], [T.dbR + 0.35, -0.035, (u) => ease.outBack(u)], [T.fast + 0.3, 0.012, ease.inOutQuad]]);
    roll += lean;
    // the tracer runs right of centre so the word it is painting trails behind it, readable whole;
    // when it speeds up on the short words the camera overtakes it, ready for the swerve
    const lead = keys(t, [[T.s0, 120], [T.db0, -300, ease.inOutCubic], [T.fast, -300], [T.fast + 0.35, 180, ease.inOutQuad], [T.ws + 0.3, 420, ease.inOutQuad]]);
    const c = chaseCam(sp.x, sp.y, -turn + roll, zoom, lead, keys(t, [[T.s0, 90], [T.db0, 40, ease.outCubic], [T.dbR + 0.25, 20, ease.outExpo], [T.ws, 30], [T.ws + 0.3, 60]]));
    if (t < T.pw) return c;
    // "powerful": push in on the certificate as the tracer brakes into it
    const k = prog(t, T.pw, T.land, ease.inOutCubic);
    const P = certCentre();
    const target: Cam = camAnchor(P.x, P.y, W / 2 + 40, H / 2 + 20, ZL, -Math.PI / 2 + 0.035);
    return mixAnchored(c, target, k, P);
  }
  camLand(t: number): Cam {
    const T = this.T, P = certCentre();
    let z = ZL * (1 + 0.32 * ease.outExpo(prog(t, T.land, T.land + 0.3))) * (1 + 0.07 * prog(t, T.land + 0.3, T.crane0, ease.inOutQuad));
    if (t > T.land + 0.2) z *= 1 + 0.03 * this.ctx.audio.hit('kick', t, 0.09);
    const rot = -Math.PI / 2 + 0.035 + 0.06 * ease.outBack(prog(t, T.land, T.land + 0.35));
    return camAnchor(P.x, P.y, W / 2 + 40, H / 2 + 20, z, rot);
  }
  camWide(t: number): Cam {
    const T = this.T;
    const snap = ease.outExpo(prog(t, T.call, T.call + 0.22));
    const drift = prog(t, T.db1, T.air0, ease.inOutQuad);
    const z = 0.19 * (1 + 0.05 * drift) * (1 + 0.17 * snap);
    const rot = -0.015 * drift + 0.045 * ease.outBack(prog(t, T.call, T.call + 0.3));
    return { x: 60 + 380 * snap + 60 * drift, y: 1380 + 60 * snap, rot, zoom: z };
  }
  camAir(t: number): Cam {
    const T = this.T;
    const xf = this.airX(t);
    // one tile per beat, then per 8th: the 8ths get a tighter, tilted framing (a reframe on the bar's 2nd half)
    const t8 = T.airT[T.airT.length - 6]!;
    const r8 = ease.outExpo(prog(t, t8, t8 + 0.22));
    let z = lerp(0.9, 1.0, prog(t, T.air0, t8, ease.inQuad)) * (1 + 0.24 * r8) * (1 + 0.05 * prog(t, t8, T.sim, ease.inQuad));
    for (let i = 0; i < T.airT.length; i++) z *= 1 + (i < T.airT.length - 6 ? 0.03 : 0.018) * pulse(t, T.airT[i]!, 0.1);
    return chaseCam(xf, 0, 0.018 - 0.045 * ease.outBack(prog(t, t8, t8 + 0.3)), z, lerp(280, 420, r8), lerp(70, 20, r8));
  }
  camSim(t: number): Cam {
    const T = this.T;
    const lb = this.labels[0]!;
    const mid = lb.route.at((lb.s0 + lb.s1) / 2), tr = this.tracer(t);
    let z = 3.1;
    const [, s1, s2, s3] = T.syl as [number, number, number, number];
    z *= (1 + 0.1 * ease.outExpo(prog(t, s1, s1 + 0.14))) * (1 + 0.12 * ease.outExpo(prog(t, s2, s2 + 0.14))) * (1 + 0.14 * ease.outExpo(prog(t, s3, s3 + 0.14)));
    const rot = -0.03 + 0.03 * ease.outBack(prog(t, s1, s1 + 0.25)) - 0.05 * ease.outBack(prog(t, s2, s2 + 0.25)) + 0.035 * ease.outBack(prog(t, s3, s3 + 0.25));
    return camAnchor(lerp(mid.x, tr.x, 0.3), lerp(mid.y, tr.y, 0.3) - 12, W / 2, H / 2 + 40, z, rot);
  }
  camClimb(t: number): Cam {
    const tr = this.tracer(t);
    const a = this.labels[1] ?? this.labels[0]!, b = this.labels[this.labels.length - 1]!;
    const xm = (a.route.at(a.s0).x + b.route.at(b.s1).x) / 2;
    let z = 2.35;
    for (const lb of this.labels.slice(1)) z *= 1 + 0.06 * pulse(t, lb.word.start, 0.1);
    return camAnchor(lerp(xm, tr.x, 0.25), tr.y, W / 2, H / 2 + 60, z, 0.02);
  }
  camWide2(t: number): Cam {
    const T = this.T, P = slotCentre();
    const wide: Cam = { x: 380 + 80 * prog(t, T.wide2, T.hot), y: 900, rot: 0, zoom: 0.175 * (1 + 0.04 * prog(t, T.wide2, T.hot)) };
    const hotK = ease.outExpo(prog(t, T.hot, T.hot + 0.4));
    const push = prog(t, T.quiet, T.drain0, ease.inOutQuad);
    const zh = 0.46 * (1 + 0.5 * push) * (1 + 0.05 * pulse(t, T.call2, 0.12));
    const near = camAnchor(P.x, P.y, W / 2 + 60 - 120 * push, H / 2 + 110 - 60 * push, zh, 0.02 - 0.05 * push);
    return mixAnchored(wide, near, hotK, P);
  }
  camEnd(t: number): Cam {
    const T = this.T, P = slotCentre();
    const k = ease.inOutCubic(prog(t, T.drain0, T.end - 0.07));
    const fin: Cam = camAnchor(P.x, P.y, HANDOFF.slot.x, HANDOFF.slot.y, HANDOFF.slot.w / SLOT.w, -Math.PI / 2);
    return mixAnchored(this.camWide2(Math.min(t, T.drain0)), fin, k, P);
  }

  camAt(t: number): Cam {
    const T = this.T;
    if (t < T.land) return this.camChase(t);
    if (t < T.crane0) return this.camLand(t);
    const revEnd = T.db1 + 0.12;
    if (t < T.air0 - 0.28) {
      const k = 1 - Math.pow(1 - prog(t, T.crane0, revEnd), 3.2);
      return mixAnchored(this.camLand(Math.min(t, T.crane0)), this.camWide(t), k, certCentre());
    }
    if (t < T.air0) {
      const k = ease.inOutCubic(prog(t, T.air0 - 0.28, T.air0));
      const c = mixCam(this.camWide(t), this.camAir(t), k);
      c.zoom *= 1 - 0.45 * Math.sin(Math.PI * k);
      return c;
    }
    if (t < T.sim - 0.24) return this.camAir(t);
    if (t < T.sim) {
      const k = ease.inOutCubic(prog(t, T.sim - 0.24, T.sim));
      const c = mixCam(this.camAir(t), this.camSim(t), k);
      c.zoom *= 1 - 0.45 * Math.sin(Math.PI * k);
      return c;
    }
    const its = this.labels[1]?.word.start ?? T.wide2;
    const endSim = this.labels[0]!.word.end;
    if (t < T.wide2 - 0.05) {
      if (t < endSim + 0.05) return this.camSim(t);
      const k = ease.inOutCubic(prog(t, endSim + 0.05, Math.min(its, endSim + 0.5)));
      return mixCam(this.camSim(Math.min(t, endSim + 0.05)), this.camClimb(t), k);
    }
    if (t < T.drain0) {
      const k = ease.outExpo(prog(t, T.wide2 - 0.05, T.wide2 + 0.43));
      const tr = this.tracer(t);
      return mixAnchored(this.camClimb(Math.min(t, T.wide2 - 0.05)), this.camWide2(t), k, tr);
    }
    return this.camEnd(t);
  }

  kAt(t: number) {
    const T = this.T;
    return keys(t, [[T.s0, 0.00034], [T.land, 0.0003], [T.db1, 0.00011, ease.inOutCubic], [T.air0, 0.0003, ease.inOutCubic], [T.sim, 0.00022, ease.inOutCubic], [T.wide2 + 0.3, 0.00015, ease.inOutCubic], [T.drain0, 0.00012], [T.end - 0.08, 0, ease.inOutCubic]]);
  }
  whipAt(t: number) {
    const T = this.T;
    return Math.max(
      prog(t, T.ws - 0.05, T.ws + 0.02) * (1 - prog(t, T.ws + 0.22, T.ws + 0.34)),
      prog(t, T.land - 0.12, T.land) * (1 - prog(t, T.land + 0.08, T.land + 0.2)),
      prog(t, T.crane0, T.crane0 + 0.05) * (1 - prog(t, T.db1 - 0.05, T.db1 + 0.1)),
      prog(t, T.air0 - 0.3, T.air0 - 0.25) * (1 - prog(t, T.air0 - 0.03, T.air0 + 0.03)),
      prog(t, T.sim - 0.26, T.sim - 0.2) * (1 - prog(t, T.sim - 0.03, T.sim + 0.03)),
      prog(t, T.wide2 - 0.05, T.wide2) * (1 - prog(t, T.wide2 + 0.15, T.wide2 + 0.3)),
    );
  }

  // ------------------------------------------------------------------ render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const T = this.T, t = f.t;
    const cam = this.camAt(t);
    const K = this.kAt(t);
    const whip = this.whipAt(t);
    const shutter = lerp(1 / 300, 1 / 80, whip);
    const camB = this.camAt(t - shutter);
    const u = this.pass.u;
    (u.uCamA!.value as THREE.Vector4).set(cam.x, cam.y, cam.rot, cam.zoom);
    (u.uCamB!.value as THREE.Vector4).set(camB.x, camB.y, camB.rot, camB.zoom);
    let motion = 0;
    for (const [sx, sy] of [[-900, -500], [900, 500], [900, -500]] as const) {
      const cs = Math.cos(cam.rot), sn = Math.sin(cam.rot);
      const wx = cam.x + (cs * sx + sn * sy) / cam.zoom, wy = cam.y + (-sn * sx + cs * sy) / cam.zoom;
      const a = toScreen(cam, wx, wy), b = toScreen(camB, wx, wy);
      motion = Math.max(motion, Math.hypot(a.x - b.x, a.y - b.y));
    }
    u.uTaps!.value = clamp(Math.ceil(motion / 3), 1, 16);
    u.uK!.value = K;
    (u.uKd!.value as THREE.Vector2).set(0, 1);
    u.uT!.value = t;
    // the drawing rises from below (south) out of the black the patent sheet fell into
    u.uRevealY!.value = t < T.s0 + 0.6 ? lerp(cam.y + 900 / cam.zoom, cam.y - 900 / cam.zoom, prog(t, T.s0 - 0.02, T.s0 + 0.42, ease.outCubic)) : -1e5;
    u.uHaze!.value = keys(t, [[T.s0, 0.55], [T.land, 0.45], [T.db1, 0.2], [T.air0, 0.45], [T.sim, 0.3], [T.wide2 + 0.3, 0.15], [T.end - 0.1, 0]]);
    const drain = prog(t, T.drain0, T.end - 0.12, ease.inOutQuad);
    u.uDim!.value = 1 - drain;
    u.uGrid!.value = 1;
    u.uLedX!.value = t < T.crane0 ? this.route.at(this.sAt(t)).x : 1e5;
    u.uAirFront!.value = t >= T.air0 - 0.02 && t < T.sim ? this.airX(t) : -1e5;
    // the simulation spreads out from the tracer, one layer per syllable
    const simOn = t >= T.syl[0]! - 0.02;
    u.uSim!.value = simOn ? 1 : 0;
    if (simOn) {
      const o = this.labels[0]!.route.at(this.labels[0]!.s0);
      (u.uSimO!.value as THREE.Vector2).set(o.x, o.y);
      const R = (k: number) => { const d = t - T.syl[k]! + 0.02; return d >= 0 ? 30 + 1400 * d + 4200 * d * d : -1; };
      (u.uSimR!.value as THREE.Vector4).set(R(0), R(1), R(2), R(3));
    }

    // ---- the overlay
    const L = this.ov;
    L.begin(cam);
    const c = L.c, px = L.px;
    const b: Box = L.bounds(200);
    const keep = 1 - prog(t, T.drain0, T.drain0 + 0.5, ease.inOutQuad);
    const legend = prog(t, T.wide2, T.wide2 + 0.3);
    drawSheet(c, b, px, keep, legend);
    drawPlan(c, b, px, cam.zoom, keep, prog(t, T.ws - 0.06, T.ws + 0.04, ease.outCubic));
    this.drawTrail(c, t, px, keep);
    this.drawLetters(c, t, px, keep);
    this.drawBeatStamps(c, t, px, keep);
    drawPanels(c, b, px, keep, this.cert, { certA: 1, zoom: cam.zoom });
    this.drawStamp(c, t, px, keep);
    this.drawCallouts(c, t, px, cam.zoom, keep);
    if (t >= T.syl[0]! - 0.02) this.drawLabels(c, t, px, keep);
    drawSlot(c, px, t > T.hot ? 1 : 0, 1 - prog(t, T.drain0, T.drain0 + 0.4));
    this.drawTracer(c, t, px, cam.zoom);
    L.upload();
    (u.uOvCam!.value as THREE.Vector4).set(cam.x, cam.y, cam.rot, cam.zoom);
    this.pass.render(renderer, out);

    // ---- post: one maximal hit (the stamp), a whip kick, small punches on the beats and syllables
    const corner = pulse(t, T.ws, 0.08);
    const land = pulse(t, T.land, 0.08);
    let beat = 0;
    for (const bt of T.beatsA) beat = Math.max(beat, pulse(t, bt, 0.06));
    let tile = 0;
    for (const at of T.airT) tile = Math.max(tile, pulse(t, at, 0.06));
    let syl = 0;
    for (const st of T.syl.slice(1)) syl = Math.max(syl, pulse(t, st, 0.06));
    let word = 0;
    for (const lb of this.labels.slice(1)) word = Math.max(word, pulse(t, lb.word.start, 0.06));
    const whips = Math.max(pulse(t, T.air0, 0.07), pulse(t, T.sim, 0.07), pulse(t, T.wide2, 0.07));
    const sh = 10 * corner + 18 * land + 2 * beat + 3 * tile + 7 * syl + 4 * word + 6 * whips + 2.5 * pulse(t, T.call, 0.08);
    const end = t > T.end - 0.1;
    return {
      bloom: 0.6, bloomThreshold: 1.0, bloomKnee: 0.35, bloomRadius: 0.65,
      vignette: lerp(0.45, 0.55, drain), grain: 0.055, halation: 0.18,
      fade: 1 - prog(t, T.s0 - 0.02, T.s0 + 0.12),
      exposure: 1 + 0.08 * land,
      flash: 0.12 * land,
      shake: end ? [0, 0] : [Math.sin(t * 93) * sh, Math.cos(t * 71) * sh * 0.8],
      ca: end ? 0.6 : 1.2 + 4 * corner + 5 * whip + 3 * land,
      zoom: end ? 1 : 1 + 0.03 * corner + 0.05 * land + 0.012 * syl,
    };
  }

  // ------------------------------------------------------------------ overlay pieces
  private glyphAt(c: CanvasRenderingContext2D, ch: string, x: number, y: number, a: number, size: number, sx: number, sy: number, cap: number, style: string) {
    c.save();
    c.translate(x, y); c.rotate(a); c.scale(sx, sy);
    c.fillStyle = style;
    c.fillText(ch, 0, (cap * size) / 2);
    c.restore();
  }

  /** The stencilled letters: sung word in blue, bone once sung; the air front relights the aisle's letters. */
  private drawLetters(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    if (keep <= 0.002) return;
    c.save();
    c.globalAlpha = keep * lerp(1, 0.28, prog(t, T.sim, T.sim + 0.6));
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const b = this.ov.bounds(300);
    const air = this.T.airT;
    c.font = font(TILE_F, this.tileSize);
    for (const g of this.tiles) {
      if (t < g.tP) continue;
      const p = this.route.at(g.s);
      if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
      const w = T.wA[g.word]!;
      const sung = t < w.end + 0.02;
      const ti = Math.floor((p.x - HALL.RW0) / TILE);
      const blown = ti >= 0 && ti < air.length && t >= air[ti]! ? pulse(t, air[ti]!, 0.12) : 0;
      const pop = 1 + 0.3 * pulse(t, g.tP, 0.05) + 0.12 * blown;
      const style = sung || blown > 0.35 ? rgba('signal', 1) : rgba('bone', 0.9);
      this.glyphAt(c, g.ch, p.x, p.y, 0, this.tileSize, pop, pop * 1.28, this.capTile, style);
    }
    c.font = font(TILE_F, this.laneSize);
    for (const g of this.lane) {
      if (t < g.tP) continue;
      const p = this.route.at(g.s);
      if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) continue;
      const w = T.wB[g.word]!;
      const sung = t < w.end + 0.02;
      const pop = 1 + 0.3 * pulse(t, g.tP, 0.05);
      this.glyphAt(c, g.ch, p.x, p.y, p.a, this.laneSize, pop, pop * 1.2, this.capTile, sung ? rgba('signal', 1) : rgba('bone', 0.9));
    }
    c.restore();
  }

  /** On each beat of the first line the rack the tracer is passing is stamped ONLINE (a blue check, then a bone one). */
  private drawBeatStamps(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    c.save();
    c.globalAlpha = keep;
    c.textBaseline = 'alphabetic';
    T.beatsA.forEach((bt, i) => {
      if (t < bt) return;
      const x = this.route.at(this.sAt(bt)).x;
      const rc = HALL.RW0 + (Math.floor((x - HALL.RW0) / TILE) + 0.5) * TILE;
      const south = i % 2 === 1;
      const y = south ? 205 : -205;
      const e = t - bt;
      const hot = Math.pow(0.5, e / 0.08);
      const s = 1 + 0.4 * Math.pow(0.5, e / 0.05);
      c.save(); c.translate(rc, y); c.scale(s, s);
      c.strokeStyle = rgba('bone', 0.85); c.lineWidth = Math.max(2.2, 1.4 * px);
      c.strokeRect(-19, -19, 38, 38);
      c.strokeStyle = hot > 0.2 || e < 0.5 ? rgba('signal', 1) : rgba('bone', 0.8);
      c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-11, 1); c.lineTo(-3, 10); c.lineTo(13, -11); c.stroke();
      c.restore();
      const la = prog(e, 0, 0.03) * (1 - prog(e, 0.45, 0.7));
      if (la > 0) {
        c.fillStyle = rgba('signal', la); c.font = font(F.mono(600), 24); c.textAlign = 'center';
        c.fillText('ONLINE', rc, y + (south ? 50 : -32));
      }
    });
    c.restore();
  }

  /** COMPUTER / RANK #1: the stamp drops onto the rank box on the sung word, a shock ring off the impact. */
  private drawStamp(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    const e = t - T.land;
    if (e < -0.14 || keep <= 0.002) return;
    const r = CERT.rank;
    const pc = { x: CERT.x + r.x + r.w / 2 - 2, y: CERT.y + r.y + r.h / 2 + 1 };
    const fall = ease.inQuad(prog(e, -0.14, 0));
    const s = lerp(3.4, 1, fall);
    c.save();
    c.globalAlpha = keep;
    // panel coords
    c.transform(0, 1, -1, 0, PANEL.x0 + PANEL.h, PANEL.yc - PANEL.w / 2);
    c.translate(pc.x, pc.y);
    c.rotate(-0.1);
    if (e < 0) {
      c.fillStyle = `rgba(0,0,0,${0.35 * fall})`;
      c.fillRect(-STAMP.w / 2 * s + 10 * (s - 1), -STAMP.h / 2 * s + 10 * (s - 1), STAMP.w * s, STAMP.h * s);
      c.globalAlpha = keep * prog(e, -0.14, -0.08);
    }
    c.drawImage(this.stamp, (-STAMP.w / 2) * s, (-STAMP.h / 2) * s, STAMP.w * s, STAMP.h * s);
    c.restore();
    if (e > 0 && e < 0.6) {
      const p = rankCentre();
      c.save();
      c.globalAlpha = keep;
      const rr = 40 * (1 + 7 * ease.outCubic(prog(e, 0, 0.5)));
      c.strokeStyle = rgba('signal', 0.85 * (1 - prog(e, 0.05, 0.55))); c.lineWidth = Math.max(2, 2.2 * px);
      c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.stroke();
      c.restore();
      burst2D(c, p.x, p.y, t, T.land, { n: 70, speed: 900, life: 0.45, seed: 17, width: 1.6 });
    }
  }

  /** Leader-line callouts: the certificate's validity on the snare after the reveal; the slot's defect. */
  private drawCallouts(c: CanvasRenderingContext2D, t: number, px: number, zoom: number, keep: number) {
    const T = this.T;
    const callout = (t0: number, t1: number, P: { x: number; y: number }, dx: number, dy: number, shelf: number, l1: string, l2: string, sz: number) => {
      const a = prog(t, t0 - 0.01, t0 + 0.04) * (1 - prog(t, t1, t1 + 0.25)) * keep;
      if (a <= 0.002) return;
      const k = ease.outExpo(prog(t, t0, t0 + 0.2));
      const ex = P.x + dx * k, ey = P.y + dy * k;
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 2 * px;
      c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(ex, ey); c.lineTo(ex + shelf * k, ey); c.stroke();
      c.fillStyle = rgba('bone', 1); c.beginPath(); c.arc(P.x, P.y, 5 * px, 0, TAU); c.fill();
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.font = font(F.mono(600), sz); c.fillStyle = rgba('bone', 1);
      c.fillText(l1, ex + 8 * px, ey - sz * 0.42);
      c.font = font(F.mono(400), sz * 0.72); c.fillStyle = rgba('ash', 1);
      c.fillText(l2, ex + 8 * px, ey + sz * 0.95);
      c.restore();
    };
    const cz = 0.19 * 1.17 * 1.05;
    callout(T.call, T.air0 - 0.3, certCentre(), 600, -900, 2900, 'RANK #1 · CERTIFIED', 'Certificate valid until the next list (6 months)', 36 / cz);
    const zs = 0.46 * 1.25;
    callout(T.call2, T.drain0 + 0.05, slotCentre(), 330, -300, 900, 'U 23–25: NO BLANKING PANEL', 'the model’s one hot spot', 32 / zs);
  }

  /** Contour labels: the isoline broken under each word; the tracer writes the word as it rides the line. */
  private drawLabels(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    c.save();
    c.globalAlpha = keep;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const isoA = prog(t, T.syl[1]! - 0.02, T.syl[1]! + 0.1);
    // plain numbered isotherms nearby
    if (isoA > 0) {
      c.font = font(F.mono(500), 11);
      for (const n of this.nums) {
        const p = n.route.at(n.s);
        c.save(); c.translate(p.x, p.y); c.rotate(p.a);
        c.fillStyle = rgba('ink', 0.95); c.fillRect(-24, -2.2, 48, 4.4);
        c.fillStyle = rgba('ash', isoA); c.fillText(n.text, 0, 4);
        c.restore();
      }
    }
    this.labels.forEach((lb, i) => {
      const w = lb.word;
      const on = i === 0 ? 1 : prog(t, w.start - 0.03, w.start + 0.02);
      if (on <= 0) return;
      const off = this.labelOffs[i]!;
      const sTr = this.simS(t) - off; // the tracer's arc length along this label
      // knockout: the isoline breaks where the label sits
      c.strokeStyle = rgba('#0E1110', 1); c.lineWidth = 3.2 * px; c.lineCap = 'butt';
      c.beginPath();
      for (let s = lb.s0 - 6; s <= lb.s1 + 6; s += 3) { const p = lb.route.at(s); if (s === lb.s0 - 6) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
      c.stroke();
      c.font = font(LABEL_F, lb.size);
      const sung = t < w.end + 0.03;
      for (const g of lb.glyphs) {
        if (g.ch === ' ') continue;
        const drawn = sTr >= g.s - g.w * 0.5 || t >= w.end;
        if (!drawn) continue;
        const p = lb.route.at(g.s);
        const tp = w.start + (w.end - w.start) * ((g.s - lb.s0) / Math.max(1, lb.s1 - lb.s0));
        const pop = 1 + 0.35 * pulse(t, tp, 0.05);
        this.glyphAt(c, g.ch, p.x, p.y, p.a, lb.size, pop, pop, this.capLabel, sung ? rgba('signal', 1) : rgba('bone', 0.95));
      }
    });
    c.restore();
  }

  /** The route behind the tracer: blue and hot at the head, cooling to a record of the path. */
  private drawTrail(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    if (keep <= 0.002) return;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (t < T.air0 + 2) {
      const sN = this.sAt(Math.min(t, T.land));
      const cool = prog(t, T.land + 0.3, T.land + 1.2);
      c.globalAlpha = keep * (1 - prog(t, T.air0 - 0.3, T.air0));
      c.strokeStyle = rgba('signal', lerp(0.95, 0.6, cool));
      c.lineWidth = Math.max(3.5, 1.6 * px);
      c.beginPath();
      let first = true;
      for (let s = S_TILES - 400; s < sN; s += 12) { const p = this.route.at(s); if (first) { c.moveTo(p.x, p.y); first = false; } else c.lineTo(p.x, p.y); }
      const pe = this.route.at(sN); c.lineTo(pe.x, pe.y);
      c.stroke();
      if (cool < 1) {
        c.strokeStyle = rgba('ember', 0.9 * (1 - cool)); c.lineWidth = Math.max(3, 1.2 * px);
        c.beginPath();
        for (let s = Math.max(S_TILES - 400, sN - 260); s < sN; s += 8) { const p = this.route.at(s); if (s <= Math.max(S_TILES - 400, sN - 260)) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
        c.lineTo(pe.x, pe.y); c.stroke();
      }
    }
    if (t > T.sim - 0.3) {
      // the sim tracer: a fading pathline of its last second
      const n = 40;
      for (let i = 0; i < n; i++) {
        const ta = t - (1.0 * (i + 1)) / n, tb = t - (1.0 * i) / n;
        if (ta < T.sim - 0.3) break;
        const a = this.simRoute.at(this.simS(ta)), bq = this.simRoute.at(this.simS(tb));
        c.strokeStyle = rgba('signal', keep * 0.9 * (1 - i / n) * (1 - prog(t, T.slotIn, T.end - 0.1)));
        c.lineWidth = Math.max(3, 1.6 * px);
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(bq.x, bq.y); c.stroke();
      }
    }
    c.restore();
  }

  private drawTracer(c: CanvasRenderingContext2D, t: number, px: number, zoom: number) {
    const tr = this.tracer(t);
    if (tr.I <= 0.002) return;
    dot2D(c, tr.x, tr.y, t, 1.25 * px * Math.min(1.6, Math.max(0.8, Math.sqrt(zoom))), tr.I, 0.35);
    const T = this.T;
    if (t < T.s0 + 0.5) burst2D(c, tr.x, tr.y, t, T.s0 + 0.02, { n: 50, speed: 700 * px, life: 0.35, seed: 3, width: 1.4 * px });
  }
}
