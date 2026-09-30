// outroV (clade.ts): what is drawn on the sheet. The lyric is plotted in single-stroke capitals (Hershey
// Sans, the plotter's own lettering) along the branches, written as the pen passes under each glyph; the
// printed layer (taxon names, axis, title block) is set in Cormorant italic and Plex Mono.
import { rgba } from '../engine/palette';
import { F, font, smart } from '../engine/type';
import type { Word } from '../engine/lyrics';
import { strokeText, type StrokeText } from '../engine/stroke';
import { clamp, ease, hash, lerp, prog, pulse, TAU } from '../engine/util';
import type { Box } from './clade-gl';
import { A, X, AXIS, PRESENT, DET, SHEET, TITLE, ROOT, TAXA, SAP_RANGE, type Taxon } from './clade-tree';

export const clean = (s: string) => smart(s).replace(/[“”"…]/g, '').toUpperCase();
export const inBox = (b: Box, x0: number, y0: number, x1: number, y1: number) => x1 >= b.x0 && x0 <= b.x1 && y1 >= b.y0 && y0 <= b.y1;

// ------------------------------------------------------------------ plotter lettering
/** A lyric line (or part of one) as plotter lettering, timed to its words. */
export class Lettering {
  st: StrokeText;
  text: string;
  /** Char boundaries along the baseline (n + 1). */
  b: number[] = [];
  /** Ink extents per char. */
  ink: [number, number][] = [];
  /** (time, chars written) keyframes. */
  keys: [number, number][] = [];
  /** Char range of each word. */
  wr: [number, number][] = [];
  constructor(public words: Word[], public size: number, tMin = -1e9, public fontName: 'sans' = 'sans') {
    this.text = words.map((w) => clean(w.w)).join(' ');
    this.st = strokeText(this.text, fontName, size);
    const n = Array.from(this.text).length;
    for (let i = 0; i <= n; i++) this.b.push(i === 0 ? 0 : i === n ? this.st.width : strokeText(Array.from(this.text).slice(0, i).join(''), fontName, size).width);
    for (let i = 0; i < n; i++) this.ink.push([Infinity, -Infinity]);
    this.st.strokes.forEach((s, k) => {
      const e = this.ink[this.st.charOf[k]!]!;
      for (const p of s) { e[0] = Math.min(e[0], p.x); e[1] = Math.max(e[1], p.x); }
    });
    this.ink.forEach((e, i) => { if (e[0] === Infinity) { e[0] = this.b[i]!; e[1] = this.b[i]!; } });
    // keys: each word's chars across its sung time; the space to the next word crossed in the gap
    let c = 0, tPrev = tMin;
    words.forEach((w, i) => {
      const len = Array.from(clean(w.w)).length;
      if (i > 0) c += 1;
      const a = Math.max(w.start, tPrev + 0.03), bt = Math.max(w.end, a + 0.06);
      this.keys.push([a, c], [bt, c + len]);
      this.wr.push([c, c + len]);
      c += len; tPrev = bt;
    });
  }
  get width() { return this.st.width; }
  get n() { return this.b.length - 1; }
  /** Chars written at t (float). */
  charAt(t: number) {
    const ks = this.keys;
    if (t <= ks[0]![0]) return 0;
    for (let i = 1; i < ks.length; i++) {
      const [tb, vb] = ks[i]!, [ta, va] = ks[i - 1]!;
      if (t <= tb) return lerp(va, vb, (t - ta) / Math.max(1e-6, tb - ta));
    }
    return ks[ks.length - 1]![1];
  }
  /** Baseline x at char progress c. */
  xAt(c: number) {
    const n = this.n;
    if (c <= 0) return 0;
    if (c >= n) return this.b[n]!;
    const i = Math.floor(c);
    return lerp(this.b[i]!, this.b[i + 1]!, c - i);
  }
  /** Written stroke length when the pen is at baseline x. */
  lenAt(x: number) {
    const st = this.st;
    let best = -1;
    for (let i = 0; i < this.ink.length; i++) { const e = this.ink[i]!; if (e[1] > e[0] && e[0] <= x) best = i; }
    if (best < 0) return 0;
    const e = this.ink[best]!, r = st.charRange[best]!;
    return r[0] + clamp((x - e[0]) / Math.max(1e-3, e[1] - e[0])) * (r[1] - r[0]);
  }
  /** Stroke length at the start of word k. */
  wordLen(k: number) { const r = this.wr[k]; return r ? this.st.charRange[Math.min(r[0], this.st.charRange.length - 1)]![0] : this.st.total; }
  wordEndLen(k: number) { const r = this.wr[k]; return r ? this.st.charRange[Math.max(0, r[1] - 1)]![1] : this.st.total; }
  /** Index of the word being sung at t (or -1). */
  hotWord(t: number, hold = 0.08) {
    for (let i = this.words.length - 1; i >= 0; i--) { const w = this.words[i]!; if (t >= w.start - 0.02) return t < w.end + hold ? i : -1; }
    return -1;
  }
}

/** Draw stroke length [a, b) of a StrokeText as one path (context already transformed). */
export function strokeRange(c: CanvasRenderingContext2D, st: StrokeText, a: number, b: number) {
  if (b <= a) return;
  c.beginPath();
  for (let i = 0; i < st.strokes.length; i++) {
    const s0 = st.startLen[i]!, pts = st.strokes[i]!, L = st.lens[i]!;
    const sEnd = s0 + (L[L.length - 1] ?? 0);
    if (sEnd <= a) continue;
    if (s0 >= b) break;
    const from = Math.max(0, a - s0), to = Math.min(sEnd - s0, b - s0);
    let started = false;
    for (let j = 1; j < pts.length; j++) {
      const la = L[j - 1]!, lb = L[j]!;
      if (lb <= from) continue;
      if (la >= to) break;
      const p = pts[j - 1]!, q = pts[j]!;
      const u0 = Math.max(0, (from - la) / Math.max(1e-6, lb - la)), u1 = Math.min(1, (to - la) / Math.max(1e-6, lb - la));
      if (!started) { c.moveTo(p.x + (q.x - p.x) * u0, p.y + (q.y - p.y) * u0); started = true; }
      c.lineTo(p.x + (q.x - p.x) * u1, p.y + (q.y - p.y) * u1);
    }
  }
  c.stroke();
}

/**
 * Plot a lettering along a straight rail: origin o, direction angle ang, text starting `off` along the
 * rail, sitting `gap` on the left of the direction of travel (negative: on the right, hanging). Written up
 * to baseline x `penX`; the word being sung in blue, the rest bone.
 */
export function plotLettering(c: CanvasRenderingContext2D, L: Lettering, o: { x: number; y: number }, ang: number, off: number, gap: number, penX: number, t: number, px: number, a = 1, opts: { hold?: number; lw?: number; bone?: number; hotAll?: boolean } = {}) {
  const len = L.lenAt(penX);
  if (len <= 0 || a <= 0.002) return;
  c.save();
  c.translate(o.x, o.y); c.rotate(ang);
  const cap = L.size * 0.68;
  c.translate(off, gap >= 0 ? -gap : -gap + cap);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.lineWidth = Math.max(opts.lw ?? L.size / 21, 1.3 * px);
  const hw = L.hotWord(t, opts.hold);
  const h0 = opts.hotAll ? 0 : hw >= 0 ? L.wordLen(hw) : len, h1 = opts.hotAll ? len : hw >= 0 ? Math.min(len, L.wordEndLen(hw)) : len;
  c.strokeStyle = rgba('bone', (opts.bone ?? 0.95) * a);
  strokeRange(c, L.st, 0, Math.min(len, h0));
  if (h1 < len) strokeRange(c, L.st, h1, len);
  if (h1 > h0) { c.strokeStyle = rgba('signal', a); strokeRange(c, L.st, h0, h1); }
  c.restore();
}

// ------------------------------------------------------------------ the printed sheet
/** Frame, time axis, the present, the title block and the empty DETAIL A frame. */
export function drawSheet(c: CanvasRenderingContext2D, b: Box, px: number, a: number) {
  if (a <= 0.002) return;
  c.save();
  c.globalAlpha = a;
  c.textBaseline = 'alphabetic';
  const lw = (w: number) => Math.max(w, w * 0.5 * px);
  // sheet border
  c.strokeStyle = rgba('bone', 0.4); c.lineWidth = lw(2.4);
  c.strokeRect(SHEET.x0, SHEET.y0, SHEET.x1 - SHEET.x0, SHEET.y1 - SHEET.y0);
  c.lineWidth = lw(1.2); c.strokeRect(SHEET.x0 + 50, SHEET.y0 + 50, SHEET.x1 - SHEET.x0 - 100, SHEET.y1 - SHEET.y0 - 100);
  // time axis (log): decades labelled, 2..9 minor ticks
  if (inBox(b, AXIS.x0 - 200, AXIS.y - 100, AXIS.x1 + 200, AXIS.y + 260)) {
    c.strokeStyle = rgba('bone', 0.75); c.lineWidth = lw(2.4);
    c.beginPath(); c.moveTo(AXIS.x0, AXIS.y); c.lineTo(AXIS.x1, AXIS.y); c.stroke();
    c.lineWidth = lw(1.4);
    c.beginPath();
    for (let e = -4; e <= 0; e++) for (let m = 2; m <= 9; m++) {
      const ma = m * Math.pow(10, e);
      if (ma > 3) continue;
      const x = X(ma);
      c.moveTo(x, AXIS.y); c.lineTo(x, AXIS.y + 18);
    }
    c.stroke();
    c.lineWidth = lw(2.2);
    const major: [number, string][] = [[1, '1 Ma'], [0.1, '100 ka'], [0.01, '10 ka'], [0.001, '1 ka'], [0.0001, '100 yr'], [0, '0']];
    c.font = font(F.mono(500), 40); c.fillStyle = rgba('ash', 1); c.textAlign = 'center';
    c.beginPath();
    for (const [ma] of major) { const x = X(ma); c.moveTo(x, AXIS.y); c.lineTo(x, AXIS.y + 36); }
    c.stroke();
    for (const [ma, s] of major) c.fillText(s, X(ma), AXIS.y + 90);
    c.font = font(F.mono(500), 30); c.fillStyle = rgba('graphite', 1); c.textAlign = 'left';
    c.fillText('TIME BEFORE PRESENT · LOG SCALE', AXIS.x0, AXIS.y - 28);
  }
  // age lines through the tree (the chronogram's background), labelled along the top
  c.lineWidth = lw(1.6);
  const ages: [number, string][] = [[1, '1 Ma'], [0.1, '100 ka'], [0.0117, '11.7 ka'], [0.01, '10 ka'], [0.001, '1 ka'], [0.0001, '100 yr']];
  for (const [ma, s] of ages) {
    const x = X(ma);
    if (x < b.x0 - 100 || x > b.x1 + 100) continue;
    const holo = ma === 0.0117;
    c.strokeStyle = rgba(holo ? 'ash' : 'graphite', holo ? 0.6 : 0.85);
    c.setLineDash(holo ? [40, 14, 6, 14] : [10, 14]);
    c.beginPath(); c.moveTo(x, -1760); c.lineTo(x, AXIS.y - 20); c.stroke();
    c.setLineDash([]);
    c.font = font(F.mono(500), 34); c.fillStyle = rgba(holo ? 'ash' : 'graphite', 1); c.textAlign = 'center';
    c.fillText(holo ? 'HOLOCENE ▸' : s, holo ? x + 110 : x, -1790);
  }
  c.strokeStyle = rgba('graphite', 0.35); c.lineWidth = lw(1);
  c.setLineDash([3, 22]);
  c.beginPath();
  for (let e = -4; e <= 0; e++) for (let m = 2; m <= 9; m++) {
    const ma = m * Math.pow(10, e);
    if (ma > 3) continue;
    const x = X(ma);
    if (x < b.x0 || x > b.x1) continue;
    c.moveTo(x, -1700); c.lineTo(x, AXIS.y - 20);
  }
  c.stroke();
  c.setLineDash([]);
  // stratigraphic stages (ICS), under the axis
  if (inBox(b, AXIS.x0, AXIS.y + 120, AXIS.x1, AXIS.y + 330)) {
    const st: [number, number, string, string][] = [[2.58, 1.8, 'GELASIAN', 'GEL.'], [1.8, 0.774, 'CALABRIAN', 'CAL.'], [0.774, 0.129, 'CHIBANIAN', 'CHIB.'], [0.129, 0.0117, 'UPPER PLEISTOCENE', 'UPPER'], [0.0117, 0, 'HOLOCENE', 'HOL.']];
    const y0 = AXIS.y + 130, h = 70;
    c.strokeStyle = rgba('bone', 0.55); c.lineWidth = lw(1.4);
    c.font = font(F.mono(500), 30); c.textAlign = 'center';
    for (const [a0, a1, name, abbr] of st) {
      const x0 = X(a0), x1 = X(a1);
      c.strokeRect(x0, y0, x1 - x0, h);
      const label = c.measureText(name).width < x1 - x0 - 30 ? name : abbr;
      c.fillStyle = rgba('ash', 0.9); c.fillText(label, (x0 + x1) / 2, y0 + 47);
    }
    c.strokeRect(X(2.58), y0 + h, X(0.0117) - X(2.58), h);
    c.fillStyle = rgba('graphite', 1); c.fillText('PLEISTOCENE', (X(2.58) + X(0.0117)) / 2, y0 + h + 47);
  }
  // the present
  c.strokeStyle = rgba('ash', 0.6); c.lineWidth = lw(1.8);
  c.setLineDash([26, 18]);
  c.beginPath(); c.moveTo(PRESENT.x, PRESENT.y0); c.lineTo(PRESENT.x, PRESENT.y1); c.stroke();
  c.setLineDash([]);
  c.font = font(F.mono(600), 40); c.fillStyle = rgba('ash', 0.9); c.textAlign = 'center';
  c.fillText('PRESENT', PRESENT.x, PRESENT.y0 - 30);
  c.font = font(F.mono(500), 26); c.fillStyle = rgba('ash', 0.8);
  c.fillText('humanity · Kardashev ≈ 0.73', PRESENT.x, PRESENT.y0 - 84);
  // title block
  const T = TITLE;
  if (inBox(b, T.x, T.y, T.x + T.w, T.y + T.h)) {
    c.strokeStyle = rgba('bone', 0.7); c.lineWidth = lw(2); c.strokeRect(T.x, T.y, T.w, T.h);
    c.lineWidth = lw(1);
    for (const y of [150, 270, 390]) { c.beginPath(); c.moveTo(T.x, T.y + y); c.lineTo(T.x + T.w, T.y + y); c.stroke(); }
    c.beginPath(); c.moveTo(T.x + T.w / 2, T.y + 270); c.lineTo(T.x + T.w / 2, T.y + T.h); c.stroke();
    c.textAlign = 'left';
    c.font = font(F.mono(600), 70); c.fillStyle = rgba('bone', 0.95); c.fillText('FIG. 1 — GENUS HOMO', T.x + 40, T.y + 100);
    c.font = font(F.serif(400, true), 50); c.fillStyle = rgba('ash', 1);
    c.fillText('Branch lengths approximate. One branch pending.', T.x + 40, T.y + 228);
    const cells: [string, string, number, number][] = [['EXTANT TAXA', '1', 0, 270], ['OUTGROUP', '—', T.w / 2, 270], ['DRAWN', 'FROM THE RECORD', 0, 390], ['SHEET', '1 OF 1', T.w / 2, 390]];
    for (const [k, v, x, y] of cells) {
      c.font = font(F.mono(500), 26); c.fillStyle = rgba('graphite', 1); c.fillText(k, T.x + x + 40, T.y + y + 36);
      c.font = font(F.mono(500), 40); c.fillStyle = rgba('bone', 0.9); c.fillText(v, T.x + x + 40, T.y + y + 90);
    }
  }
  // the root's note
  if (inBox(b, ROOT.x - 500, ROOT.y - 200, ROOT.x + 200, ROOT.y + 200)) {
    c.font = font(F.mono(500), 30); c.fillStyle = rgba('ash', 0.9); c.textAlign = 'right';
    c.fillText('ROOT · ~2.8 Ma', ROOT.x - 34, ROOT.y + 10);
  }
  c.restore();
}

/** DETAIL A: the reticulation edge at a scale where it has a sequence; the gene on it (a short bar of bases). */
export function drawDetail(c: CanvasRenderingContext2D, b: Box, px: number, a: number, strikeX: number, t: number, tKill: number, tGene: number) {
  if (a <= 0.002 || !inBox(b, DET.x0, DET.y0, DET.x1, DET.y1)) return;
  const lw = (w: number) => Math.max(w, w * 0.5 * px);
  c.save();
  c.globalAlpha = a;
  c.textBaseline = 'alphabetic';
  c.strokeStyle = rgba('bone', 0.6); c.lineWidth = lw(2);
  // detail frame with cut corners (a drafting detail boundary)
  const k = 40;
  c.beginPath();
  c.moveTo(DET.x0 + k, DET.y0); c.lineTo(DET.x1 - k, DET.y0); c.lineTo(DET.x1, DET.y0 + k); c.lineTo(DET.x1, DET.y1 - k);
  c.lineTo(DET.x1 - k, DET.y1); c.lineTo(DET.x0 + k, DET.y1); c.lineTo(DET.x0, DET.y1 - k); c.lineTo(DET.x0, DET.y0 + k); c.closePath();
  c.stroke();
  c.textAlign = 'left';
  c.font = font(F.mono(600), 48); c.fillStyle = rgba('bone', 0.95); c.fillText('DETAIL A', DET.x0 + 60, DET.y0 + 84);
  c.font = font(F.mono(400), 32); c.fillStyle = rgba('ash', 1); c.fillText('THE EDGE AT SCALE 10⁶ : 1', DET.x0 + 330, DET.y0 + 84);
  // the band: the edge, magnified, with its bases as ticks
  const y0 = DET.bandY - DET.bandH / 2, y1 = DET.bandY + DET.bandH / 2;
  c.strokeStyle = rgba('bone', 0.8); c.lineWidth = lw(2.2);
  c.beginPath(); c.moveTo(DET.bx0, y0); c.lineTo(DET.bx1, y0); c.moveTo(DET.bx0, y1); c.lineTo(DET.bx1, y1); c.stroke();
  // break marks at both ends (the edge continues)
  for (const x of [DET.bx0, DET.bx1]) {
    c.beginPath(); c.moveTo(x - 14, y0 - 22); c.lineTo(x + 14, y1 + 22); c.stroke();
  }
  c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = lw(1.2);
  c.beginPath();
  for (let x = DET.bx0 + 30; x < DET.bx1 - 20; x += 20) { if (x > DET.gx0 - 10 && x < DET.gx1 + 10) continue; c.moveTo(x, y0 + 12); c.lineTo(x, y1 - 12); }
  c.stroke();
  // the gene: a short sequence bar, one cell per base
  const n = Math.round((DET.gx1 - DET.gx0) / 60), cw = (DET.gx1 - DET.gx0) / n;
  const B = 'ACGT';
  c.font = font(F.mono(600), 50); c.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const x = DET.gx0 + i * cw;
    const dead = x + cw * 0.5 < strikeX;
    c.fillStyle = dead ? rgba('#161a19', 1) : rgba('#2c3230', 1);
    c.fillRect(x + 3, y0 + 6, cw - 6, DET.bandH - 12);
    c.fillStyle = dead ? rgba('graphite', 0.8) : rgba('bone', 0.95);
    c.fillText(B[Math.floor(hash(i, 71) * 4)]!, x + cw / 2, DET.bandY + 18);
  }
  c.strokeStyle = rgba('bone', 0.95); c.lineWidth = lw(3);
  c.strokeRect(DET.gx0, y0 + 2, DET.gx1 - DET.gx0, DET.bandH - 4);
  // labels: what it is, and what happened to it
  c.textAlign = 'left';
  c.font = font(F.serif(400, true), 50); c.fillStyle = rgba('ash', 1);
  c.fillText('N-derived segment · locus 7q31', DET.gx0, y1 + 78);
  const pa = prog(t, tGene, tGene + 0.04);
  if (pa > 0) {
    const s = 1 + 0.45 * pulse(t, tGene, 0.05);
    c.save(); c.translate(DET.gx0, y1 + 150); c.scale(s, s);
    c.textAlign = 'left'; c.font = font(F.mono(600), 46); c.fillStyle = rgba(t < tGene + 0.35 ? 'signal' : 'bone', pa);
    c.fillText('STATUS: PURGED', 0, 0);
    c.restore();
  }
  // the strike: the pen's line through the bar, slightly off level like a hand's, hot at the head
  if (strikeX > DET.gx0 - 40 && t >= tKill - 0.02) {
    const x0 = DET.gx0 - 40, x1 = Math.min(strikeX, DET.gx1 + 40);
    const yA = DET.bandY + 10, yB = DET.bandY - 14;
    const yAt = (x: number) => lerp(yA, yB, (x - x0) / (DET.gx1 + 40 - x0));
    c.lineCap = 'round';
    c.strokeStyle = rgba('bone', 1); c.lineWidth = lw(15);
    c.beginPath(); c.moveTo(x0, yAt(x0)); c.lineTo(x1, yAt(x1)); c.stroke();
    const xh = Math.max(x0, x1 - 320);
    const g = c.createLinearGradient(xh, 0, x1, 0);
    g.addColorStop(0, rgba('signal', 0)); g.addColorStop(1, rgba('signal', 1));
    c.strokeStyle = g; c.lineWidth = lw(17);
    c.beginPath(); c.moveTo(xh, yAt(xh)); c.lineTo(x1, yAt(x1)); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ the tree
export interface TreeState {
  front: number;          // how far (x) the time front has drawn the tree
  /** Time the front passes x (for the 70 ms drops and the stamps). */
  passAt: (x: number) => number;
  stampAt: (x: number) => number; // the † stamp time for a tip at x (on the grid)
  t: number;
}

/** A taxon label (italic) with its range underneath, popping on its stamp. */
function taxonLabel(c: CanvasRenderingContext2D, tx: Taxon, t: number, tStamp: number) {
  const pa = prog(t, tStamp - 0.01, tStamp + 0.03);
  if (pa <= 0) return;
  const s = 1 + 0.35 * pulse(t, tStamp, 0.05);
  const right = !tx.labelAbove;
  const x = right ? tx.x1 + 30 : tx.x1 - 24, y = right ? tx.row + 20 : tx.row - 30;
  c.save();
  c.translate(x, y); c.scale(s, s);
  c.textAlign = right ? 'left' : 'right';
  c.font = font(F.serif(400, true), 60); c.fillStyle = rgba('bone', 0.95 * pa);
  const name = tx.extinct ? `${tx.name} †` : tx.name;
  c.fillText(name, 0, 0);
  c.font = font(F.mono(400), 28); c.fillStyle = rgba(t < tStamp + 0.3 ? 'signal' : 'graphite', pa);
  c.fillText(tx.range, right ? 4 : -4, right ? 44 : -62);
  c.restore();
}

/** A fossil range: a hatched bar along the lineage (the thin line elsewhere is inferred). */
function rangeBar(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, px: number) {
  if (x1 <= x0 + 2) return;
  const h = 15;
  c.save();
  c.fillStyle = rgba('#101413', 1);
  c.fillRect(x0, y - h, x1 - x0, 2 * h);
  c.beginPath(); c.rect(x0, y - h, x1 - x0, 2 * h); c.clip();
  c.strokeStyle = rgba('ash', 0.75); c.lineWidth = Math.max(1.6, 0.9 * px);
  c.beginPath();
  for (let x = Math.floor(x0 / 22) * 22 - 40; x < x1 + 40; x += 22) { c.moveTo(x, y + h); c.lineTo(x + 2 * h, y - h); }
  c.stroke();
  c.restore();
  c.strokeStyle = rgba('bone', 0.9); c.lineWidth = Math.max(2.2, 1.1 * px);
  c.strokeRect(x0, y - h, x1 - x0, 2 * h);
}

export function drawTree(c: CanvasRenderingContext2D, b: Box, px: number, s: TreeState, a: number) {
  if (a <= 0.002) return;
  const { front, t } = s;
  const lw = (w: number) => Math.max(w, w * 0.45 * px);
  c.save();
  c.globalAlpha = a;
  c.lineCap = 'butt';
  c.textBaseline = 'alphabetic';
  // fossil ranges first (under the lines' nodes), grown with the front
  if (front > SAP_RANGE[0]) rangeBar(c, SAP_RANGE[0], Math.min(front, SAP_RANGE[1]), 0, px);
  for (const tx of TAXA) {
    if (!tx.fossil || front < tx.fossil[0]) continue;
    const tp = s.passAt(tx.x0);
    if (t < tp + 0.07) continue;
    rangeBar(c, tx.fossil[0], Math.min(front, tx.fossil[1]), tx.row, px);
  }
  // the backbone (the sapiens lineage from the root)
  c.strokeStyle = rgba('bone', 0.95); c.lineWidth = lw(5);
  const bx = Math.min(front, 0);
  if (bx > ROOT.x) { c.beginPath(); c.moveTo(ROOT.x, 0); c.lineTo(bx, 0); c.stroke(); }
  // the root node
  c.fillStyle = rgba('bone', 1);
  c.beginPath(); c.arc(ROOT.x, 0, 11, 0, TAU); c.fill();
  // lineages
  for (const tx of TAXA) {
    if (front < tx.x0) continue;
    const tp = s.passAt(tx.x0);
    const drop = ease.outExpo(prog(t, tp, tp + 0.07));
    const yc = lerp(tx.parentY, tx.row, drop);
    c.strokeStyle = rgba('bone', 0.9); c.lineWidth = lw(3.4);
    c.beginPath(); c.moveTo(tx.x0, tx.parentY); c.lineTo(tx.x0, yc); c.stroke();
    if (drop >= 1) {
      const xe = Math.min(front, tx.x1);
      c.lineWidth = lw(tx.key === 'N' ? 4.4 : 3.8);
      c.beginPath(); c.moveTo(tx.x0, tx.row); c.lineTo(xe, tx.row); c.stroke();
      if (front < tx.x1) {
        c.fillStyle = rgba('bone', 0.9);
        c.beginPath(); c.arc(xe, tx.row, 7, 0, TAU); c.fill();
      } else {
        // tip: a short end bar, the stamp
        const ts = s.stampAt(tx.x1);
        if (t >= ts) {
          const k = 1 + 0.6 * pulse(t, ts, 0.05);
          c.strokeStyle = rgba(t < ts + 0.25 ? 'signal' : 'bone', 0.95); c.lineWidth = lw(3.4);
          c.beginPath(); c.moveTo(tx.x1, tx.row - 16 * k); c.lineTo(tx.x1, tx.row + 16 * k); c.stroke();
        }
        if (inBox(b, tx.x1 - 900, tx.row - 150, tx.x1 + 1100, tx.row + 120)) taxonLabel(c, tx, t, ts);
      }
    }
    // the node on the parent, and its age
    c.fillStyle = rgba('bone', 1);
    c.beginPath(); c.arc(tx.x0, tx.parentY, 10, 0, TAU); c.fill();
    if (tx.nodeAge && inBox(b, tx.x0 - 200, tx.parentY - 100, tx.x0 + 200, tx.parentY + 100)) {
      c.font = font(F.mono(500), 28); c.fillStyle = rgba('graphite', 1); c.textAlign = 'right';
      c.fillText(tx.nodeAge, tx.x0 - 18, tx.parentY + (tx.row > tx.parentY ? -18 : 44));
    }
  }
  // the sapiens tip, when the front reaches the present
  if (front >= 0) {
    const ts = s.passAt(0);
    const sap: Taxon = { key: 'S', name: 'Homo sapiens', range: '0.3 Ma – present', row: 0, x0: 0, x1: 0, parentY: 0, extinct: false };
    c.fillStyle = rgba('bone', 1);
    c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill();
    if (inBox(b, -200, -150, 1300, 150)) taxonLabel(c, sap, t, ts);
  }
  c.restore();
}

export { A };
