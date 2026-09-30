// Geometry for the drop plate (patch.ts): a wall of 19-inch racks full of patch bays, drawn as a
// frontal elevation. Panel units (PU): 1 PU = 1 px at the frontal long shot's zoom 1. Origin: the
// main rack's centre line; y = 0 is the top of the annunciator (the legend-lamp panel), y grows down.
// Built once in init(); patch.ts draws it with culling.
import { hash } from '../engine/util';

export const U = 150; // one rack unit
export const FACE = 1700; // panel face, ears included
export const PITCH = 1760; // rack to rack (the 60 PU between faces is the rack upright)
export const U_TOP = -10, U_BOT = 10;

export type RectKind = 'face' | 'strip' | 'plate' | 'slot' | 'upright' | 'hole' | 'switch' | 'rating';
export interface Rect { x: number; y: number; w: number; h: number; r: number; kind: RectKind }
export interface Circ { x: number; y: number; r: number }
export interface Jack { x: number; y: number; r: number; hole: number }
export interface Lamp { x: number; y: number; r: number; pilot: boolean; seed: number }
export interface Txt { x: number; y: number; s: string; size: number; wt: number; align: CanvasTextAlign; a: number; track: number }
export interface Seg { x0: number; y0: number; x1: number; y1: number; a: number }
/** An annunciator cell: legend plate, pilot lamp, jack. */
export interface Legend { lines: string[]; plate: Rect; lamp: number; x: number; y: number }

/** The twelve legends: row 0 (seven cells), then row 1 (five; its end cells are blanked off). Cell 3,
 * on the rack's centre line, is left blank: HUMAN IN THE LOOP → points at it. */
export const LEGENDS: string[][] = [
  ['MAINS'], ['PHASE', 'LOCKED'], ['HUMAN IN', 'THE LOOP'], [], ['ASK FIRST'], ['BOTH KEYS', 'REQUIRED'], ['SHARED', 'LOAD'],
  ['HANDSHAKE', 'OK'], ['FAULT:', 'MUTUAL'], ['TRUST', 'BOTH WAYS'], ['OK TO', 'MERGE'], ['SPARE'],
];
export const THREAD = 3; // the unlabelled cell: the last lamp

const pad = (n: number, w = 3) => String(n).padStart(w, '0');

export class Wall {
  rects: Rect[] = [];
  jacks: Jack[] = [];
  lamps: Lamp[] = [];
  screws: Circ[] = [];
  txt: Txt[] = [];
  segs: Seg[] = [];
  legends: Legend[] = [];
  /** The unlabelled cell's jack (world2's last window) and lamp (the thread). */
  handJack = { x: 0, y: 0, r: 9.5, hole: 4.6 };
  threadLamp = { x: 0, y: 0 };
  /** Centre of the rating plate (LOAD 0.7 kW). */
  rating = { x: 0, y: 0 };
  /** The one patch cord (HUMAN → MACHINE): plug centres and its tag. */
  cord = { ax: 0, ay: 0, bx: 0, by: 0 };
  private nPanel = 0;

  constructor() {
    for (let k = -2; k <= 2; k++) {
      this.upright(k * PITCH - PITCH / 2);
      if (k === 0) this.mainRack();
      else this.otherRack(k);
    }
    this.upright(2 * PITCH + PITCH / 2);
  }

  // ------------------------------------------------------------------ racks
  private mainRack() {
    const seq: [number, string][] = [
      [-10, 'duct'], [-9, 'tt'], [-8, 'patch'], [-6, 'field'], [-4, 'patch'], [-2, 'patchCord'],
      [0, 'ann'], [2, 'patch'], [4, 'rating'], [5, 'vent'], [6, 'patch'], [8, 'tt'], [9, 'duct'],
    ];
    for (const [u, kind] of seq) this.panel(0, u, kind);
  }

  private otherRack(k: number) {
    const kinds: [string, number, number][] = [['patch', 2, 0.36], ['tt', 1, 0.2], ['field', 2, 0.14], ['vent', 1, 0.15], ['duct', 1, 0.15]];
    let u = U_TOP, i = 0;
    while (u < U_BOT) {
      let r = hash(k, i, 41), pick = kinds[0]!;
      for (const kd of kinds) { if (r < kd[2]) { pick = kd; break; } r -= kd[2]; }
      if (u + pick[1] > U_BOT) pick = kinds[1]!;
      this.panel(k, u, pick[0]);
      u += pick[1]; i++;
    }
  }

  private upright(x: number) {
    const y0 = U_TOP * U - 40, y1 = U_BOT * U + 40;
    this.rects.push({ x: x - 30, y: y0, w: 60, h: y1 - y0, r: 0, kind: 'upright' });
    for (let u = U_TOP; u < U_BOT; u++) for (const s of [-1, 1]) {
      for (const f of [0.18, 0.5, 0.82]) this.rects.push({ x: x + s * 15 - 3.5, y: u * U + U * f - 3.5, w: 7, h: 7, r: 0, kind: 'hole' });
    }
  }

  private face(cx: number, y0: number, nU: number, id: string) {
    const h = nU * U;
    this.rects.push({ x: cx - FACE / 2, y: y0 + 1, w: FACE, h: h - 2, r: 3, kind: 'face' });
    for (const s of [-1, 1]) for (const f of nU === 1 ? [0.5] : [0.25, 0.75]) this.screws.push({ x: cx + s * 815, y: y0 + h * f, r: 6.5 });
    this.txt.push({ x: cx + 815, y: y0 + (nU === 1 ? 26 : 30), s: id, size: 8, wt: 500, align: 'center', a: 0.5, track: 1 });
  }

  private panel(k: number, u: number, kind: string) {
    const cx = k * PITCH, y0 = u * U;
    const id = `R${k + 3}·${pad(++this.nPanel, 2)}`;
    if (kind === 'patch' || kind === 'patchCord') this.patch(cx, y0, id, kind === 'patchCord');
    else if (kind === 'tt') this.tt(cx, y0, id);
    else if (kind === 'field') this.field(cx, y0, id);
    else if (kind === 'vent') this.vent(cx, y0, id);
    else if (kind === 'duct') this.duct(cx, y0, id);
    else if (kind === 'ann') this.annunciator(cx, y0);
    else if (kind === 'rating') this.ratingPanel(cx, y0, id);
  }

  /** 2U: two rows of 24 jacks, an LED over each, a designation strip over each row. HUMAN over MACHINE, normalled. */
  private patch(cx: number, y0: number, id: string, cord: boolean) {
    this.face(cx, y0, 2, id);
    const n0 = 1 + ((this.nPanel * 24) % 960);
    for (let r = 0; r < 2; r++) {
      const ry = y0 + r * 130;
      this.rects.push({ x: cx - 720, y: ry + 44, w: 1440, h: 19, r: 1, kind: 'strip' });
      for (let c = 0; c < 24; c++) {
        const x = cx - 690 + 60 * c;
        this.txt.push({ x, y: ry + 57, s: pad(n0 + c), size: 9, wt: 500, align: 'center', a: 0.78, track: 0 });
        this.lamps.push({ x, y: ry + 82, r: 3.8, pilot: false, seed: this.lamps.length });
        this.jacks.push({ x, y: ry + 114, r: 10, hole: 4.8 });
      }
      this.txt.push({ x: cx - 842, y: ry + 86, s: r === 0 ? 'HUMAN' : 'MACHINE', size: 8.5, wt: 600, align: 'left', a: 0.7, track: 0.5 });
    }
    // normalled: a little arrow from the HUMAN row down to the MACHINE row, in the left ear
    const ax = cx - 790;
    this.segs.push({ x0: ax, y0: y0 + 124, x1: ax, y1: y0 + 226, a: 0.45 });
    this.segs.push({ x0: ax - 4, y0: y0 + 218, x1: ax, y1: y0 + 226, a: 0.45 }, { x0: ax + 4, y0: y0 + 218, x1: ax, y1: y0 + 226, a: 0.45 });
    this.txt.push({ x: cx - 842, y: y0 + 176, s: 'NORM', size: 7, wt: 500, align: 'left', a: 0.5, track: 0.5 });
    if (cord) {
      // the one patched cord, HUMAN 008 → MACHINE 013 (drawn by patch.ts), and nothing else patched
      this.cord = { ax: cx - 690 + 60 * 7, ay: y0 + 114, bx: cx - 690 + 60 * 12, by: y0 + 244 };
    }
  }

  /** 1U bantam bay: two rows of 48 small jacks. */
  private tt(cx: number, y0: number, id: string) {
    this.face(cx, y0, 1, id);
    for (let r = 0; r < 2; r++) {
      const ry = y0 + 52 + r * 56;
      this.rects.push({ x: cx - 722, y: ry - 30, w: 1444, h: 12, r: 1, kind: 'strip' });
      for (let c = 0; c < 48; c++) this.jacks.push({ x: cx - 705 + 30 * c, y: ry, r: 6.5, hole: 3 });
      this.txt.push({ x: cx - 842, y: ry + 3, s: r === 0 ? 'H' : 'M', size: 8.5, wt: 600, align: 'left', a: 0.7, track: 0 });
    }
  }

  /** 2U lamp field: 4 × 24 indicator lamps in bezels, numbered. */
  private field(cx: number, y0: number, id: string) {
    this.face(cx, y0, 2, id);
    this.txt.push({ x: cx - 842, y: y0 + 40, s: 'STATUS', size: 8.5, wt: 600, align: 'left', a: 0.7, track: 0.5 });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 24; c++) {
      const x = cx - 690 + 60 * c, y = y0 + 52 + r * 64;
      this.screws.push({ x, y, r: 9 }); // the bezel ring
      this.lamps.push({ x, y, r: 5.2, pilot: false, seed: this.lamps.length });
      if (c % 4 === 0) this.txt.push({ x, y: y + 26, s: pad(r * 24 + c, 2), size: 7, wt: 500, align: 'center', a: 0.55, track: 0 });
    }
  }

  /** 1U blank with vent slots. */
  private vent(cx: number, y0: number, id: string) {
    this.face(cx, y0, 1, id);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 26; c++) this.rects.push({ x: cx - 676 + c * 52, y: y0 + 46 + r * 44, w: 40, h: 12, r: 6, kind: 'slot' });
  }

  /** 1U cable manager: a row of finger openings. */
  private duct(cx: number, y0: number, id: string) {
    this.face(cx, y0, 1, id);
    for (let c = 0; c < 12; c++) this.rects.push({ x: cx - 688 + c * 118, y: y0 + 28, w: 86, h: 94, r: 14, kind: 'slot' });
  }

  /** 2U annunciator: two rows of seven cells (legend plate, pilot lamp, jack); two cells blanked off. */
  private annunciator(cx: number, y0: number) {
    this.face(cx, y0, 2, 'AN-01');
    let li = 0;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) {
      const x = cx - 630 + 210 * c, ry = y0 + r * 150;
      if (r === 1 && (c === 0 || c === 6)) {
        // blanking cover: no lamp fitted
        this.rects.push({ x: x - 60, y: ry + 34, w: 120, h: 96, r: 4, kind: 'switch' });
        this.screws.push({ x, y: ry + 46, r: 4 }, { x, y: ry + 118, r: 4 });
        continue;
      }
      const plate: Rect = { x: x - 86, y: ry + 14, w: 172, h: 46, r: 3, kind: 'plate' };
      this.rects.push(plate);
      this.screws.push({ x, y: ry + 90, r: 23 }); // lamp bezel
      const lamp = this.lamps.length;
      this.lamps.push({ x, y: ry + 90, r: 15, pilot: true, seed: lamp });
      this.jacks.push({ x, y: ry + 130, r: 9.5, hole: 4.6 });
      this.legends.push({ lines: LEGENDS[li]!, plate, lamp, x, y: ry + 90 });
      if (li === THREAD) { this.handJack = { x, y: ry + 130, r: 9.5, hole: 4.6 }; this.threadLamp = { x, y: ry + 90 }; }
      li++;
    }
    // HUMAN IN THE LOOP →: the arrow is printed on the panel, across to the blank plate
    const a0 = cx - 630 + 210 * 2 + 91, a1 = cx - 630 + 210 * 3 - 92, ay = y0 + 37;
    this.segs.push({ x0: a0, y0: ay, x1: a1, y1: ay, a: 0.85 });
    this.segs.push({ x0: a1 - 7, y0: ay - 4.5, x1: a1, y1: ay, a: 0.85 }, { x0: a1 - 7, y0: ay + 4.5, x1: a1, y1: ay, a: 0.85 });
    this.txt.push({ x: cx - 842, y: y0 + 40, s: 'LEGEND', size: 8.5, wt: 600, align: 'left', a: 0.7, track: 0.5 });
  }

  /** 1U power panel: mains switch, fuse, vents and the rating plate. */
  private ratingPanel(cx: number, y0: number, id: string) {
    this.face(cx, y0, 1, id);
    this.rects.push({ x: cx - 712, y: y0 + 40, w: 44, h: 72, r: 4, kind: 'switch' });
    this.txt.push({ x: cx - 690, y: y0 + 30, s: 'MAINS', size: 8.5, wt: 600, align: 'center', a: 0.75, track: 0.5 });
    this.txt.push({ x: cx - 690, y: y0 + 62, s: 'I', size: 11, wt: 600, align: 'center', a: 0.75, track: 0 });
    this.txt.push({ x: cx - 690, y: y0 + 102, s: 'O', size: 11, wt: 600, align: 'center', a: 0.75, track: 0 });
    this.screws.push({ x: cx - 590, y: y0 + 76, r: 16 }, { x: cx - 590, y: y0 + 76, r: 9 });
    this.txt.push({ x: cx - 590, y: y0 + 116, s: 'F1 · T4A', size: 8, wt: 500, align: 'center', a: 0.65, track: 0 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) this.rects.push({ x: cx - 470 + c * 52, y: y0 + 36 + r * 30, w: 40, h: 10, r: 5, kind: 'slot' });
    const px = cx + 250, py = y0 + 18, pw = 460, ph = 114;
    this.rects.push({ x: px, y: py, w: pw, h: ph, r: 4, kind: 'rating' });
    for (const [sx, sy] of [[px + 12, py + 12], [px + pw - 12, py + 12], [px + 12, py + ph - 12], [px + pw - 12, py + ph - 12]] as const) this.screws.push({ x: sx, y: sy, r: 4 });
    this.rating = { x: px + pw / 2, y: py + ph / 2 };
    for (const l of RATING_LINES) this.txt.push({ x: px + l.dx, y: py + l.dy, s: l.s, size: l.size, wt: l.wt, align: l.align ?? 'left', a: l.a, track: l.track });
  }
}

/** The rating plate's engraving, from the plate's top-left corner. The value, once: LOAD 40 kW (one AI rack), Kardashev −0.14. */
const RATING_LINES: { s: string; dx: number; dy: number; size: number; wt: number; a: number; track: number; align?: CanvasTextAlign }[] = [
  { s: 'PATCH SYSTEM  PS-1', dx: 28, dy: 34, size: 11, wt: 600, a: 0.8, track: 1 },
  { s: '230 V ~ 50 Hz', dx: 28, dy: 52, size: 11, wt: 500, a: 0.8, track: 0.5 },
  { s: 'LOAD 40 kW', dx: 26, dy: 96, size: 36, wt: 600, a: 1, track: 0 },
  { s: 'KARDASHEV −0.14 · ONE AI RACK', dx: 28, dy: 118, size: 11, wt: 500, a: 0.8, track: 0.5 },
  { s: 'SER. 0000001', dx: 432, dy: 34, size: 9, wt: 500, a: 0.6, track: 0.5, align: 'right' },
];
