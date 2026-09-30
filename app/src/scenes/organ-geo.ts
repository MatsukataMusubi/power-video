// preach (organ.ts): the organ's geometry, as one engraved front elevation in world px. The camera's
// identity maps world to screen, and at identity the central flat's 23 pipes sit exactly on
// HANDOFF.pipes (world5's last frame: the cristae lined up as pipes). Everything else is placed around
// that flat, symmetric about x = 960:
//   pedal towers (Double Open Diapason 32′) · side flats (Trumpet 8′, conical reeds) with the Mixture IV
//   clusters above them · the central flat (Principal 8′) with the upper flat (Octave 4′) above it ·
//   a row of trumpets en chamade (Tuba Mirabilis 8′) across the impost, seen bell-on · below the impost
//   the console: two stop jambs of drawknobs flanking the hymn board, two manuals, the blower plate.
import { W } from '../engine/gl';
import { HANDOFF } from './_power';

export const CX = W / 2;
const P = HANDOFF.pipes;

/** Pipe kinds (the shader's `type`). */
export const OPEN = 0, REED = 1, BELL = 2;

/** One pipe. Flue/reed: centre x, top y, toe y, body width, mouth y (flue) / boot top (reed). Bell: centre (cx, top), width = diameter. */
export interface Pipe { cx: number; top: number; toe: number; w: number; mouth: number; type: number; rank: number; depth: number }

/** Ranks (one per bar) in pull order. `pipes` are filled below. */
export const RANKS = [
  'Principal 8′', 'Octave 4′', 'Mixture IV', 'Trumpet 8′', 'Double Open Diapason 32′', 'Tuba Mirabilis 8′', 'Vox Machina 8′',
] as const;

export const FLAT = { x0: P.x0, x1: P.x1, top: P.top, toe: P.bot, n: P.n, pitch: (P.x1 - P.x0) / P.n };
export const IMPOST = { y0: P.bot, y1: P.bot + 33 };
export const CORNICE = { y0: 184, y1: 228 };
export const PEDAL = { cxL: -78, cxR: 2 * CX + 78, rad: 118, top: -150, mouth: 668 };
export const SIDE = { x0: 98, x1: 314, top0: 470, top1: 384, boot: 858 };
export const MIXT = { shelf: [336, 290, 244, 198], top: 150 };
export const UPPER = { x0: 350, x1: 1570, toe: 180, mouth: 138, n: 31 };
export const CROWN = { y0: -118, y1: -74, x0: 300, x1: 1620 };
export const BELLS = { y: 890, n: 11, x0: 420, x1: 1500, d: 62 };

export const pipes: Pipe[] = [];
const add = (p: Omit<Pipe, 'depth'> & { depth?: number }) => pipes.push({ ...p, depth: p.depth ?? 1 });

// ---- pedal towers: 7 pipes on a half-round in plan, back pipes first (they are hidden behind the front ones)
for (const cx of [PEDAL.cxL, PEDAL.cxR]) {
  const th = [-72, -48, -24, 0, 24, 48, 72].map((d) => (d * Math.PI) / 180);
  const order = th.map((a, i) => ({ a, i })).sort((u, v) => Math.cos(u.a) - Math.cos(v.a));
  for (const { a } of order) {
    const k = Math.abs(a) / (72 * Math.PI / 180);
    add({ cx: cx + PEDAL.rad * Math.sin(a), top: PEDAL.top + 70 * k * k, toe: IMPOST.y0, w: 46, mouth: PEDAL.mouth + 8 * k, type: OPEN, rank: 4, depth: 0.35 + 0.65 * Math.cos(a) });
  }
}
// ---- side flats: conical reeds, rising toward the towers
for (const side of [0, 1]) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n; // 0 = outer … 1 = inner
    const x = side === 0 ? SIDE.x0 + (SIDE.x1 - SIDE.x0) * u : 2 * CX - (SIDE.x0 + (SIDE.x1 - SIDE.x0) * u);
    add({ cx: x, top: SIDE.top1 + (SIDE.top0 - SIDE.top1) * u, toe: IMPOST.y0, w: 27, mouth: SIDE.boot, type: REED, rank: 3 });
  }
}
// ---- Mixture IV: four little shelves of tiny pipes above each side flat (a many-rank chorus in one stop)
for (const side of [0, 1]) {
  MIXT.shelf.forEach((sy, r) => {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5 + (r % 2) * 0.25 - 0.125) / n;
      const x0 = SIDE.x0 + 8, x1 = SIDE.x1 - 8;
      const x = side === 0 ? x0 + (x1 - x0) * u : 2 * CX - (x0 + (x1 - x0) * u);
      const len = 36 - r * 2 + 6 * Math.abs(Math.sin(i * 1.7 + r));
      add({ cx: x, top: sy - len, toe: sy, w: 13, mouth: sy - len * 0.34, type: OPEN, rank: 2 });
    }
  });
}
// ---- upper flat (Octave 4′): a mitre, longest in the middle
for (let i = 0; i < UPPER.n; i++) {
  const x = UPPER.x0 + ((UPPER.x1 - UPPER.x0) * (i + 0.5)) / UPPER.n;
  const k = Math.abs(i - (UPPER.n - 1) / 2) / ((UPPER.n - 1) / 2);
  add({ cx: x, top: -44 + 96 * Math.pow(k, 1.25), toe: UPPER.toe, w: 27, mouth: UPPER.mouth, type: OPEN, rank: 1 });
}
// ---- the central flat (Principal 8′): the hand-off. 23 equal pipes spanning HANDOFF.pipes, mouths in a line
export const FLAT_W = FLAT.pitch * 0.62; // world5's cristae are 0.6 pitch wide
export const FLAT_MOUTH = Math.round(FLAT.top + 0.72 * (FLAT.toe - FLAT.top));
for (let i = 0; i < FLAT.n; i++) {
  add({ cx: FLAT.x0 + FLAT.pitch * (i + 0.5), top: FLAT.top, toe: FLAT.toe, w: FLAT_W, mouth: FLAT_MOUTH, type: OPEN, rank: 0 });
}
/** The centre pipe of the flat (x = 960): the dot rides its wind. */
export const CENTRE_PIPE = pipes.length - 1 - (FLAT.n - 1) / 2;
// ---- trumpets en chamade across the impost, bell-on
for (let i = 0; i < BELLS.n; i++) {
  const k = Math.abs(i - (BELLS.n - 1) / 2) / ((BELLS.n - 1) / 2);
  add({ cx: BELLS.x0 + ((BELLS.x1 - BELLS.x0) * i) / (BELLS.n - 1), top: BELLS.y - 6 * k, toe: 0, w: BELLS.d * (1 - 0.16 * k), mouth: 0, type: BELL, rank: 5 });
}

// ------------------------------------------------------------------ the console
export const CONSOLE = { x0: 86, x1: 2 * CX - 86, y0: IMPOST.y1, y1: 1656 };
export const BOARD = { x0: 402, x1: 2 * CX - 402, y0: 986, y1: 1484, crest: 1046 };
export const ROW = { y0: 1120, pitch: 58, cardH: 50, cardW: 35, numW: 40, gap: 4, wordGap: 17 };
export const rowY = (k: number) => ROW.y0 + ROW.pitch * k; // rail top (the cards stand on it)
export const JAMB = { l: { x0: 118, x1: 392 }, r: { x0: 2 * CX - 392, x1: 2 * CX - 118 }, y0: 996, y1: 1470 };
export const KNOB_R = 31;
/** Where the console's drawing is seen from: the knob shanks show toward it (a drawn perspective). */
export const VP = { x: CX, y: 1240 };
export const MANUALS = { x0: 470, x1: 2 * CX - 470, y: [1500, 1556], h: 46 };
export const BLOWER = { x: 124, y: 1490, w: 262, h: 86 }; // under the left jamb (framed by the bar-5 insert)

export interface Knob { x: number; y: number; name: string[]; pitch: string; side: 0 | 1 }
const KCOL = [72, 202];
const KROW = [1072, 1160, 1248, 1336, 1424];
/** Stop names per jamb, row by row (two per row). Left: Great and Pedal; right: Swell and Solo. */
const LEFT: [string, string][] = [
  ['Principal 8′', 'Stopped Diapason 8′'],
  ['Open Diapason 16′', 'Mixture IV'],
  ['Bourdon 16′', 'Fifteenth 2′'],
  ['Zimbelstern', 'Great to Pedal'],
  ['Tremulant', 'Double Open Diapason 32′'],
];
const RIGHT: [string, string][] = [
  ['Vox Humana 8′', 'Vox Machina 8′'],
  ['Tuba Mirabilis 8′', 'Octave 4′'],
  ['Voix Céleste 8′', 'Trumpet 8′'],
  ['Gamba 8′', 'Flute 4′'],
  ['Swell to Great', 'Tremulant'],
];
/** A stop name split for the knob face: the name on one or two lines, the pitch below. */
function splitName(s: string): { name: string[]; pitch: string } {
  const m = s.match(/^(.*?)\s+(\d+′|[IVX]+)$/);
  const name = m ? m[1]! : s, pitch = m ? m[2]! : '';
  const words = name.split(' ');
  if (words.length === 1) return { name: [name], pitch };
  if (words.length === 2) return { name: words, pitch };
  return { name: [words.slice(0, -1).join(' '), words[words.length - 1]!], pitch };
}
export const knobs: Knob[] = [];
for (const [side, rows] of [[0, LEFT], [1, RIGHT]] as const) {
  const j = side === 0 ? JAMB.l : JAMB.r;
  rows.forEach((pair, r) => pair.forEach((s, c) => {
    const { name, pitch } = splitName(s);
    knobs.push({ x: j.x0 + KCOL[c]!, y: KROW[r]!, name, pitch, side });
  }));
}
export const knobIndex = (s: string) => knobs.findIndex((k) => [...k.name, k.pitch].join(' ').replace(/\s+/g, ' ').trim() === s);
/** The knob pulled in each bar (same order as RANKS), and the one already drawn when the plate opens. */
export const PULLS = RANKS.map((s) => knobIndex(s));
export const VOX_HUMANA = knobIndex('Vox Humana 8′');
