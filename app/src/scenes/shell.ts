// SHELL — chorus 1, the cold open (direction A): an assembly sequence in the language of the 1995
// film's opening titles (muted grey-green, one vivid colour, hectic numerals, bone-white parts
// placed by machine) — our own imagery, none of the film's shots, and (director's note) no
// figurative body: parts, grids, measurement.
// Human = bone, and everything drawn by hand; machine = the one accent colour, and everything that
// measures, places, etches and locks.
//
// Lyrics live on the objects of this world, each line with its own in-world cursor (never a
// caption):
//   hook, pass 1  the words are built out of blocks on the engineering grid, placed asymmetrically
//                 (WE top left, APPRECIATE up the right edge, POWER along the bottom) — a coarse,
//                 misread copy; the cursor is a plotter gantry sweeping the grid as they are sung.
//   hook, pass 2  as sung, the blocks resolve into the true letterforms and a hand draws their outline.
//   "Elevate the human race,"   the hand draws a datum arc and writes the words along it (single-
//                 stroke script, the pen as cursor) while six parts fly in and lock around the datum
//                 on 8th notes.
//   "let it wake up on my face" laser-etched in stencil capitals down a rail; an aperture at the
//                 datum opens on "wake"; a raster scan sweeps the assembly on "on my face".
//   hook, again   hard-cut close-ups: each word is laser-etched into one of the parts (the camera
//                 turns to read it); then the whole assembly, the three words lighting as sung;
//                 the held "power" strobes.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { HEX } from '../engine/palette';
import { font, fitSize, glyphX, measure, textPath2D } from '../engine/type';
import { strokeText } from '../engine/stroke';
import { Lyrics, type Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, polylineLengths, pointAtLength, prog, pulse, type V2 } from '../engine/util';
import { inkLine, specimen, type Poly } from './_plate';
import { CAP, SLAB, MONO, MONO_B, BONE, CELL, clean, hexA, shellPass, dataBurst, strokeAlong, sparksAt, type Along } from './_shell';
import { enterPart, drawPart, etchWord, lockCallout, drawLink, drawDatum, drawIris, drawScan, makeEtch, toScreen, type Part, type Link, type Cam } from './_parts';

interface Cell { x: number; y: number; r: number; mis: [number, number] }
interface GridWord { text: string; ox: number; oy: number; a: number; size: number; wpx: number; cells: Cell[]; path: Path2D; polys: Poly[]; len: number }

const WIDE: Cam = { x: W / 2, y: H / 2, a: 0, z: 1 };
const D = { x: 1230, y: 560 }; // the datum the assembly locks around
const RAIL_X = 1760, RAIL_Y0 = 150, RAIL_Y1 = 940;
const ETCH_ON = [5, 3, 1]; // which part carries WE / APPRECIATE / POWER

export default class Shell extends Scene {
  L = new Layer2D();
  pass!: FSPass;
  acc: string = HEX.signal;
  hookA!: Line; hookB!: Line; elev!: Line;
  grid: GridWord[] = [];
  tElev = 0; tB = 0; tHold = 0;
  parts: Part[] = [];
  links: Link[] = [];
  tWake = 0; tScan0 = 0; tScan1 = 0;
  arc: Poly = []; arcLen = 0;
  back!: Along;
  front!: { pts: Poly; L: Float32Array; text: string; chars: { s: number; t0: number; w: number }[]; size: number; s0: number };
  machineWords = 0;
  cuts: number[] = [];

  override init() {
    const { lyrics, params, start, end, audio } = this.ctx;
    if (params.accent) this.acc = String(params.accent);
    this.pass = shellPass(this.L.texture, this.acc);
    const lines = lyrics.linesIn(start - 0.2, end);
    const hooks = lines.filter((l) => /appreciate/i.test(l.text));
    this.elev = lines.find((l) => /elevate/i.test(l.text))!;
    this.hookA = hooks[0]!;
    this.hookB = hooks.find((l) => l.start > this.elev.start)!;
    this.tElev = this.elev.words[0]!.start - 0.03;
    this.tB = audio.downbeats.reduce((b, d) => (Math.abs(d - this.hookB.start) < Math.abs(b - this.hookB.start) ? d : b), this.hookB.start);
    const lastPower = this.hookB.words[this.hookB.words.length - 1]!;
    this.tHold = lastPower.start;

    // hook A: three words on the grid, asymmetric
    const sWE = Math.min(600, fitSize('WE', SLAB, 760));
    const sAP = fitSize('APPRECIATE', SLAB, 840);
    const sPO = Math.min(fitSize('POWER', SLAB, 1300), 330 / CAP);
    this.grid = [
      this.gridWord('WE', 150, 150 + sWE * CAP, 0, sWE),
      this.gridWord('APPRECIATE', 1790, 1000, -Math.PI / 2, sAP),
      this.gridWord('POWER', 150, 1000, 0, sPO),
    ];

    // the assembly: six parts lock around the datum on 8th notes from the first beat after "Elevate"
    const ws = this.elev.words;
    const first = audio.timeOfBeat(Math.ceil(audio.beatAt(ws[0]!.start + 0.05)));
    const eighth = 60 / audio.bpm / 2;
    const spec: [Part['kind'], number, number, number, number, number][] = [
      ['block', 0, 0, 0, 220, 160],
      ['plate', -250, -230, -0.35, 300, 170],
      ['plate', 250, -240, 0.3, 270, 200],
      ['bar', 330, 70, 1.25, 430, 70],
      ['ring', -290, 190, 0, 230, 230],
      ['plate', 70, 310, -0.12, 360, 150],
    ];
    this.parts = spec.map(([kind, dx, dy, ang, w, h], i) => ({
      id: `P-${String(i + 1).padStart(2, '0')}`, kind, x: D.x + dx, y: D.y + dy, ang, w, h, pf: 1,
      tLock: first + i * eighth, dir: Math.atan2(dy, dx) || -Math.PI / 2,
    }));
    for (const [a, b] of [[0, 1], [0, 3], [1, 4], [2, 3], [4, 5], [0, 5]]) {
      const A = this.parts[a!]!, B = this.parts[b!]!;
      this.links.push({ a: a!, b: b!, label: (Math.hypot(A.x - B.x, A.y - B.y) / 4).toFixed(1) });
    }
    const find = (re: RegExp) => ws.find((w) => re.test(clean(w.w)));
    this.tWake = find(/^wake$/i)?.start ?? ws[ws.length - 3]!.start;
    this.tScan0 = find(/^on$/i)?.start ?? this.tWake + 0.3;
    this.tScan1 = ws[ws.length - 1]!.end;

    // the lyric: the first half handwritten along a datum arc the hand draws, the second etched down a rail
    const split = Math.max(1, ws.findIndex((w) => /^let$/i.test(clean(w.w))));
    const humanWords = ws.slice(0, split), machineWords = ws.slice(split);
    this.machineWords = machineWords.length;
    {
      for (let k = 0; k <= 220; k++) { // lower-left → upper-left around the datum: the text reads upward
        const th = 2.25 + (4.05 - 2.25) * (k / 220);
        this.arc.push({ x: D.x + Math.cos(th) * 470, y: D.y + Math.sin(th) * 470 });
      }
      this.arcLen = this.arc.reduce((s, q, i) => (i ? s + Math.hypot(q.x - this.arc[i - 1]!.x, q.y - this.arc[i - 1]!.y) : 0), 0);
      const text = humanWords.map((w) => clean(w.w).toLowerCase()).join(' ');
      const st = strokeText(text, 'hscript', 62);
      const charTimes: [number, number][] = [];
      humanWords.forEach((w, wi) => {
        const s = clean(w.w).toLowerCase();
        for (let i = 0; i < s.length; i++) charTimes.push([w.start + ((w.end - w.start) * i) / s.length, w.start + ((w.end - w.start) * (i + 1)) / s.length]);
        if (wi < humanWords.length - 1) charTimes.push([w.end, w.end]);
      });
      this.back = { pts: this.arc, L: polylineLengths(this.arc), st, charTimes, s0: Math.max(20, (this.arcLen - st.width) / 2) };
    }
    {
      const words = machineWords.map((w) => clean(w.w).toUpperCase());
      const text = words.join(' ');
      const size = 30;
      const chars: { s: number; t0: number; w: number }[] = [];
      let ci = 0;
      machineWords.forEach((w, wi) => {
        const s = words[wi]!;
        for (let i = 0; i < s.length; i++) chars.push({ s: glyphX(text, ci + i, MONO_B, size), t0: w.start + ((w.end - w.start) * 0.7 * i) / s.length, w: wi });
        ci += s.length + 1;
      });
      const pts: Poly = [];
      for (let y = RAIL_Y0; y <= RAIL_Y1; y += 8) pts.push({ x: RAIL_X + 34, y });
      this.front = { pts, L: polylineLengths(pts), text: text.replace(/ /g, ''), chars, size, s0: Math.max(20, (RAIL_Y1 - RAIL_Y0 - measure(text, MONO_B, size)) / 2) };
    }

    // the final hook, etched into three of the parts
    ['WE', 'APPRECIATE', 'POWER'].forEach((text, k) => {
      const p = this.parts[ETCH_ON[k]!]!;
      p.etch = makeEtch(text, p.kind === 'bar' ? p.w - 90 : p.w - 60, p.kind === 'bar' ? p.h * 0.7 : p.h * 0.6, this.hookB.words[k]);
    });
    const hw = this.hookB.words;
    this.cuts = [this.tElev, this.tB, hw[1]!.start, hw[2]!.start, hw[3]!.start];
  }

  /** A word laid on the grid: its outline (for the hand), its fill path, and the grid cells it covers. */
  private gridWord(text: string, ox: number, oy: number, a: number, size: number): GridWord {
    const wpx = measure(text, SLAB, size);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.translate(ox, oy); g.rotate(a);
    g.font = font(SLAB, size);
    g.fillStyle = '#fff';
    g.fillText(text, 0, 0);
    const data = g.getImageData(0, 0, W, H).data;
    const cells: Cell[] = [];
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let y = 0; y < H; y += CELL) {
      for (let x = 0; x < W; x += CELL) {
        let cov = 0;
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
          const px = Math.min(W - 1, x + 3 + i * 6), py = Math.min(H - 1, y + 3 + j * 6);
          cov += data[(py * W + px) * 4 + 3]! > 128 ? 1 : 0;
        }
        if (cov / 25 < 0.42) continue;
        const cx = x + CELL / 2, cy = y + CELL / 2;
        const lx = (cx - ox) * ca + (cy - oy) * sa; // along the reading axis
        const h = hash(x, y, text.length);
        const mis: [number, number] = h < 0.09 ? [(hash(x, y, 2) < 0.5 ? -1 : 1) * CELL, hash(x, y, 4) < 0.5 ? (hash(x, y, 3) < 0.5 ? -1 : 1) * CELL : 0] : [0, 0];
        cells.push({ x, y, r: clamp(lx / wpx), mis });
      }
    }
    const sp = specimen(text, SLAB, size, 0, 0);
    const polys = sp.polys.map((p) => p.map((q) => ({ x: ox + q.x * ca - q.y * sa, y: oy + q.x * sa + q.y * ca })));
    return { text, ox, oy, a, size, wpx, cells, path: textPath2D(text, SLAB, size, 0, 0), polys, len: sp.len };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer, audio } = this.ctx;
    const c = this.L.ctx;
    this.L.clear();
    let lock = 0, glitch = 0, invert = 0;

    if (t < this.tElev) {
      lock = this.drawGrid(c, t);
      glitch = 0.9 * f.a.snare + 0.4 * lock;
    } else if (t < this.tB) {
      lock = this.drawAssembly(c, t);
      glitch = 0.35 * f.a.snare;
    } else {
      lock = this.drawEtch(c, t);
      glitch = 0.12 * f.a.snare;
      if (t >= this.tHold && t < this.ctx.end - 0.04) invert = Math.floor(audio.beatAt(t) * 4) % 2;
    }
    // the numerals only flash on the cuts (the 1995 titles' language, as an event, not a HUD)
    for (const tc of this.cuts) if (t >= tc && t < tc + 0.12) dataBurst(c, t, tc, this.acc);

    this.pass.u.glitch!.value = clamp(glitch);
    this.pass.u.seed!.value = frameIdx(t) % 991;
    this.pass.u.invert!.value = invert;
    this.L.upload();
    this.pass.render(renderer, out);
    const fi = frameIdx(t);
    return {
      bloom: 0.7, bloomThreshold: 0.9, bloomKnee: 0.3, halation: 0.08, vignette: 0.45, grain: 0.06, ca: 0.6 + 2.5 * f.a.snare, hud: 0,
      zoom: 1 + 0.03 * f.a.kick + 0.045 * lock,
      shake: [lock * 10 * (hash(fi, 1) - 0.5), lock * 10 * (hash(fi, 2) - 0.5)],
    };
  }

  // ------------------------------------------------------------------ hook A: blocks on the grid

  private drawGrid(c: CanvasRenderingContext2D, t: number): number {
    const ws = this.hookA.words;
    let lock = 0;
    let gx = -1, gy = -1;
    for (let k = 0; k < 3; k++) {
      const g = this.grid[k]!, w1 = ws[k]!, w2 = ws[k + 3];
      const pre = k === 0 && w1.start - this.ctx.start < 0.5 ? 0.35 : 0.07; // frame one already holds WE
      if (t < w1.start - pre) continue;
      lock = Math.max(lock, t >= w1.start ? pulse(t, w1.start, 0.07) : 0);
      const p1 = Lyrics.wordProgress(w1, t);
      const p2 = w2 && t >= w2.start ? Lyrics.wordProgress(w2, t) : 0;
      if (w2 && t >= w2.start) lock = Math.max(lock, pulse(t, w2.start, 0.07));
      const fix = w2 ? prog(t, w2.start - 0.05, w2.start + 0.05) : 0; // pass 2 corrects the misplaced blocks
      // the blocks: cascade in along the reading axis, locking on the word; sung → bone, front → accent
      for (const cell of g.cells) {
        const tb = w1.start - pre + pre * cell.r;
        if (t < tb) continue;
        const age = t - tb;
        const gone = w2 && t >= w2.start ? clamp((p2 - cell.r) * 8) : 0; // dissolved by pass 2
        if (gone >= 1) continue;
        const s = 1 + 0.45 * (1 - ease.outExpo(clamp(age / 0.06)));
        const x = cell.x + cell.mis[0] * (1 - fix), y = cell.y + cell.mis[1] * (1 - fix);
        const front = p1 > 0 && p1 < 1 && Math.abs(cell.r - p1) < 0.05;
        const born = age < 0.07;
        c.fillStyle = front || born ? hexA(this.acc, 1) : cell.r <= p1 ? hexA(BONE, 1 - gone) : `rgba(74,80,78,${1 - gone})`;
        const sz = (CELL - 4) * s;
        c.fillRect(x + CELL / 2 - sz / 2, y + CELL / 2 - sz / 2, sz, sz);
      }
      // the gantry: the plotter head riding the sung front, rails across the whole grid
      const gp = p1 > 0 && p1 < 1 ? p1 : p2 > 0 && p2 < 1 ? p2 : -1;
      if (gp >= 0) {
        const hx = g.ox + Math.cos(g.a) * g.wpx * gp, hy = g.oy + Math.sin(g.a) * g.wpx * gp;
        const horiz = Math.abs(g.a) < 0.1;
        c.save();
        c.strokeStyle = hexA(this.acc, 0.55); c.lineWidth = 1.5;
        c.beginPath();
        if (horiz) { c.moveTo(hx, 0); c.lineTo(hx, H); gx = Math.floor(hx / CELL); }
        else { c.moveTo(0, hy); c.lineTo(W, hy); gy = Math.floor(hy / CELL); }
        c.stroke();
        const mx = horiz ? hx : g.ox - (g.size * CAP) / 2, my = horiz ? g.oy - (g.size * CAP) / 2 : hy;
        c.fillStyle = hexA(this.acc, 1); c.fillRect(mx - 9, my - 9, 18, 18);
        c.restore();
      }
      // pass 2: the true letterform, revealed behind the sweep, and the hand's outline
      if (w2 && t >= w2.start - 0.02) {
        c.save();
        c.translate(g.ox, g.oy); c.rotate(g.a);
        c.beginPath(); c.rect(-10, -g.size, (g.wpx + 20) * p2, g.size * 1.3); c.clip();
        c.fillStyle = BONE;
        c.fill(g.path);
        c.restore();
        const pd = prog(t, w2.start - 0.02, w2.start + 0.16, ease.outCubic);
        inkLine(c, g.polys, g.len, pd, t, { seed: 40 + k, width: 3, wobble: 2.4, color: 'bone', alpha: 0.95 });
        c.save();
        c.translate(g.ox, g.oy); c.rotate(g.a); c.clip(g.path); c.resetTransform();
        inkLine(c, g.polys, g.len, pd, t, { seed: 40 + k, width: 3, wobble: 2.4, color: 'ink', alpha: 0.9 });
        c.restore();
      }
    }
    // the rulers: cell indices along the top and left edges of the plotter bed
    c.save();
    c.font = font(MONO, 11);
    for (let i = 0; i < W / CELL; i += 2) {
      c.fillStyle = i === gx || i + 1 === gx ? hexA(this.acc, 1) : 'rgba(232,230,223,0.3)';
      c.fillText(String(i).padStart(2, '0'), i * CELL + 4, 118);
    }
    for (let j = 4; j < H / CELL; j += 2) {
      c.fillStyle = j === gy || j + 1 === gy ? hexA(this.acc, 1) : 'rgba(232,230,223,0.3)';
      c.fillText(String(j).padStart(2, '0'), 22, j * CELL + 12);
    }
    c.restore();
    return lock;
  }

  // ------------------------------------------------------------------ the assembly around the datum

  private drawAssembly(c: CanvasRenderingContext2D, t: number): number {
    const ws = this.elev.words;
    const iHuman = Math.max(0, ws.findIndex((w) => /^human/i.test(w.w)));
    drawDatum(c, WIDE, D.x, D.y, prog(t, ws[0]!.start, ws[0]!.end), this.acc);
    // the hand draws the datum arc over "Elevate the human", then writes along it
    const pd = prog(t, ws[0]!.start - 0.05, ws[iHuman]!.end, ease.outQuad);
    inkLine(c, [this.arc], this.arcLen, pd, t, { seed: 31, width: 2.2, wobble: 2, color: 'bone', alpha: 0.55 });
    this.drawHandwriting(c, t);
    // dimension lines and the parts
    for (const l of this.links) drawLink(c, WIDE, this.parts, l, t, this.acc);
    let lock = 0;
    for (const p of this.parts) {
      c.save(); enterPart(c, WIDE, p);
      lock = Math.max(lock, drawPart(c, p, t, this.acc));
      c.restore();
      lockCallout(c, WIDE, p, t, this.acc);
    }
    // the aperture at the datum opens on "wake"
    if (t >= this.tWake - 0.02) {
      const o = ease.outBack(clamp((t - this.tWake) / 0.12), 2.2);
      const s = toScreen(WIDE, D.x, D.y);
      c.save(); c.translate(s.x, s.y); drawIris(c, 62, clamp(o), this.acc); c.restore();
      lock = Math.max(lock, pulse(t, this.tWake, 0.07));
    }
    // the raster scan on "on my face"
    drawScan(c, D.x - 470, D.y - 400, 900, 780, prog(t, this.tScan0, this.tScan1), this.acc, t);
    this.drawRailStencil(c, t);
    return lock;
  }

  /** "elevate the human race," written by the pen along the datum arc, as sung. */
  private drawHandwriting(c: CanvasRenderingContext2D, t: number) {
    const b = this.back;
    let len = 0;
    for (let i = 0; i < b.st.charRange.length; i++) {
      const [a0, a1] = b.st.charRange[i]!, [t0, t1] = b.charTimes[i] ?? [Infinity, Infinity];
      if (t >= t1) len = a1;
      else if (t > t0) { len = a0 + (a1 - a0) * ((t - t0) / Math.max(1e-3, t1 - t0)); break; }
      else break;
    }
    strokeAlong(c, b, b.st.total, 'rgba(232,230,223,0.1)', 2); // the unwritten line waits as a faint guide
    const head = strokeAlong(c, b, len, 'rgba(232,230,223,0.95)', 2.6);
    if (head && len < b.st.total) {
      c.fillStyle = BONE;
      c.beginPath(); c.arc(head.x, head.y, 4, 0, Math.PI * 2); c.fill();
    }
  }

  /** The rail on the right, and "LET IT WAKE UP ON MY FACE" etched down it letter by letter as sung. */
  private drawRailStencil(c: CanvasRenderingContext2D, t: number) {
    const fr = this.front;
    const mw = this.elev.words.slice(this.elev.words.length - this.machineWords);
    const on = prog(t, mw[0]!.start - 0.25, mw[0]!.start - 0.05, ease.outExpo);
    if (on <= 0) return;
    c.save();
    c.translate(0, (1 - on) * -H);
    c.fillStyle = '#262B2A'; c.fillRect(RAIL_X - 14, RAIL_Y0 - 30, 28, RAIL_Y1 - RAIL_Y0 + 60);
    c.fillStyle = 'rgba(232,230,223,0.2)'; c.fillRect(RAIL_X - 14, RAIL_Y0 - 30, 28, 3);
    c.fillStyle = hexA(this.acc, 0.9); c.fillRect(RAIL_X - 1, RAIL_Y0 - 30, 2, RAIL_Y1 - RAIL_Y0 + 60);
    c.font = font(MONO, 12); c.fillStyle = 'rgba(232,230,223,0.5)';
    c.save(); c.translate(RAIL_X - 22, RAIL_Y1 + 20); c.rotate(-Math.PI / 2); c.fillText('RAIL R-01', 0, 0); c.restore();
    const cur = mw.findIndex((w) => t >= w.start && t < w.end);
    c.font = font(MONO_B, fr.size);
    let laser: V2 | null = null;
    fr.chars.forEach((ch, i) => {
      const p = pointAtLength(fr.pts, fr.L, fr.s0 + ch.s);
      const lit = t >= ch.t0;
      c.save();
      c.translate(p.x, p.y); c.rotate(p.angle);
      c.fillStyle = lit ? (ch.w === cur ? hexA(this.acc, 1) : 'rgba(232,230,223,0.95)') : 'rgba(232,230,223,0.12)';
      c.fillText(fr.text[i]!, 0, 0);
      c.restore();
      if (lit && t < ch.t0 + 0.08) laser = { x: p.x, y: p.y };
    });
    if (laser) sparksAt(c, laser, t, 5, 18, this.acc);
    c.restore();
  }

  // ------------------------------------------------------------------ the final hook, etched

  private drawEtch(c: CanvasRenderingContext2D, t: number): number {
    const ws = this.hookB.words;
    let cur = 0;
    for (let i = 0; i < ws.length; i++) if (t >= ws[i]!.start - (i === 0 ? 0.05 : 0)) cur = i;
    const lock = pulse(t, ws[cur]!.start, 0.07);
    let cam: Cam = WIDE;
    if (cur < 3) {
      // close-up: the camera turns to read the word on its part
      const p = this.parts[ETCH_ON[cur]!]!;
      const z = Math.min((W * 0.55) / p.w, (H * 0.45) / p.h, 4) * (1 + 0.05 * prog(t, ws[cur]!.start, ws[cur]!.end + 0.3));
      cam = { x: p.x, y: p.y, a: p.ang, z };
    } else {
      drawDatum(c, WIDE, D.x, D.y, 0.6, this.acc);
      drawScan(c, D.x - 470, D.y - 400, 900, 780, 1, this.acc, t);
    }
    for (const l of this.links) drawLink(c, cam, this.parts, l, t, this.acc);
    for (let k = 0; k < this.parts.length; k++) {
      const p = this.parts[k]!;
      c.save(); enterPart(c, cam, p);
      drawPart(c, p, t, this.acc);
      const e = ETCH_ON.indexOf(k);
      if (e >= 0 && p.etch) {
        const w1 = ws[e]!, w2 = ws[e + 3];
        if (t >= w1.start - 0.05) etchWord(c, p.etch, t, Lyrics.wordProgress(w1, t), w2 ? Lyrics.wordProgress(w2, t) : 0, this.acc, cur === e);
      }
      c.restore();
    }
    if (cur >= 3) { const s = toScreen(WIDE, D.x, D.y); c.save(); c.translate(s.x, s.y); drawIris(c, 62, 1, this.acc); c.restore(); }
    return lock;
  }
}
