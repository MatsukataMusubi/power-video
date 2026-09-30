// DOCK — the pre-chorus template (direction A): "What will it take to make you capitulate?"
// Two halves of a huge connector close in one step per beat: the human half (bone, outlined by hand,
// with sockets) and the machine half (graphite, accent pins). The line lives on them:
//   "what will it take"  handwritten on the human half (single-stroke script, the pen as cursor);
//   "TO MAKE YOU"        laser-etched on the machine half, letter by letter;
//   "CAPITULATE?"        split across the two mating faces — readable only when they slam together
//                        on the word; its sweep crosses the seam as it is sung.
// n escalates across the song: 1 (pre 2) the pins miss the sockets, the halves jam apart and the
// word stays broken; 2 (pre 4) a half-lock; 3 (pre 5) a full lock, the word whole.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { font, fitSize, glyphX, measure } from '../engine/type';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, prog, pulse } from '../engine/util';
import { inkLine, type Poly } from './_plate';
import { CAP, SLAB, MONO, MONO_B, BONE, clean, hexA, shellPass, dataBurst, sparksAt } from './_shell';
import type { FSPass } from '../engine/gl';

const HALF_W = 760, HALF_H = 560, TOP = 250;
const PIN_L = 70, PIN_H = 34;
const PINS = [70, 140, 210, 280]; // pin/socket rows, from the top of the halves
const SEAM = W / 2;
const MIS = { 1: 34, 2: 12, 3: 0 } as Record<number, number>; // vertical misregistration of the machine half
const GAP = { 1: PIN_L, 2: PIN_L * 0.5, 3: 0 } as Record<number, number>; // what is left between the faces

export default class Dock extends Scene {
  L = new Layer2D();
  pass!: FSPass;
  acc = '#2F5BFF';
  n = 1;
  line!: Line;
  human: Word[] = []; machine: Word[] = []; cap!: Word;
  tLock = 0;
  steps: { t: number; g: number }[] = [];
  hand!: { st: StrokeText; times: [number, number][] };
  stencil!: { text: string; chars: { x: number; t0: number; w: number }[] };
  word!: { left: string; right: string; size: number; xk: number; wpx: number };
  outline: Poly[] = []; outlineLen = 0;

  override init() {
    const { lyrics, params, start, end, audio } = this.ctx;
    this.n = Number(params.n ?? 1);
    if (params.accent) this.acc = String(params.accent);
    this.pass = shellPass(this.L.texture, this.acc);
    this.line = lyrics.linesIn(start - 0.2, end).find((l) => /capitulate/i.test(l.text)) ?? lyrics.linesIn(start, end)[0]!;
    const ws = this.line.words;
    this.cap = ws[ws.length - 1]!;
    let iTo = ws.findIndex((w, i) => i > 0 && /^(to|soon|as)$/i.test(clean(w.w)));
    if (iTo < 0) iTo = Math.max(1, Math.round((ws.length - 1) * 0.55));
    this.human = ws.slice(0, iTo);
    this.machine = ws.slice(iTo, ws.length - 1);
    this.tLock = this.cap.start;

    // the approach: one step per beat from the plate's start to the lock
    const b0 = Math.ceil(audio.beatAt(start + 0.01)), b1 = Math.floor(audio.beatAt(this.tLock - 0.05));
    const n = Math.max(1, b1 - b0 + 1);
    this.steps = [{ t: start - 1, g: 430 }];
    for (let b = b0; b <= b1; b++) this.steps.push({ t: audio.timeOfBeat(b), g: 430 * (1 - (b - b0 + 1) / (n + 1)) });
    this.steps.push({ t: this.tLock, g: GAP[this.n]! / 2 });

    // the handwriting (human half) and the stencil (machine half)
    const hText = this.human.map((w) => clean(w.w).toLowerCase()).join(' ');
    const st = strokeText(hText, 'hscript', 66);
    const times: [number, number][] = [];
    this.human.forEach((w, wi) => {
      const s = clean(w.w).toLowerCase();
      for (let i = 0; i < s.length; i++) times.push([w.start + ((w.end - w.start) * i) / s.length, w.start + ((w.end - w.start) * (i + 1)) / s.length]);
      if (wi < this.human.length - 1) times.push([w.end, w.end]);
    });
    this.hand = { st, times };
    const mWords = this.machine.map((w) => clean(w.w).toUpperCase());
    const mText = mWords.join(' ');
    const chars: { x: number; t0: number; w: number }[] = [];
    let ci = 0;
    this.machine.forEach((w, wi) => {
      const s = mWords[wi]!;
      for (let i = 0; i < s.length; i++) chars.push({ x: glyphX(mText, ci + i, MONO_B, 46), t0: w.start + ((w.end - w.start) * 0.7 * i) / s.length, w: wi });
      ci += s.length + 1;
    });
    this.stencil = { text: mText.replace(/ /g, ''), chars };

    // CAPITULATE?, split where its kerned width is halved
    const text = clean(this.cap.w).toUpperCase() + '?';
    const size = Math.min(300, fitSize(text, SLAB, 1300));
    const wpx = measure(text, SLAB, size);
    let k = 1;
    for (let i = 1; i < text.length; i++) if (Math.abs(glyphX(text, i, SLAB, size) - wpx / 2) < Math.abs(glyphX(text, k, SLAB, size) - wpx / 2)) k = i;
    this.word = { left: text.slice(0, k), right: text.slice(k), size, xk: glyphX(text, k, SLAB, size), wpx };

    // the human half's outline with its sockets, for the hand (in half-local coordinates, x = 0 at the face)
    const o: Poly = [{ x: -HALF_W, y: 0 }, { x: 0, y: 0 }];
    for (const py of PINS) o.push({ x: 0, y: py - PIN_H / 2 - 2 }, { x: -PIN_L - 4, y: py - PIN_H / 2 - 2 }, { x: -PIN_L - 4, y: py + PIN_H / 2 + 2 }, { x: 0, y: py + PIN_H / 2 + 2 });
    o.push({ x: 0, y: HALF_H }, { x: -HALF_W, y: HALF_H }, { x: -HALF_W, y: 0 });
    const dense: Poly = [];
    for (let i = 1; i < o.length; i++) {
      const a = o[i - 1]!, b = o[i]!, m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
      for (let j = 0; j < m; j++) dense.push({ x: a.x + ((b.x - a.x) * j) / m, y: a.y + ((b.y - a.y) * j) / m });
    }
    dense.push(o[o.length - 1]!);
    this.outline = [dense];
    this.outlineLen = dense.reduce((s, q, i) => (i ? s + Math.hypot(q.x - dense[i - 1]!.x, q.y - dense[i - 1]!.y) : 0), 0);
  }

  /** Half the gap between the faces at t: stepped on the beats, each step a hard 70 ms slide. */
  private gapHalf(t: number): number {
    let g = this.steps[0]!.g;
    for (let i = 1; i < this.steps.length; i++) {
      const s = this.steps[i]!;
      if (t < s.t) break;
      g = this.steps[i - 1]!.g + (s.g - this.steps[i - 1]!.g) * ease.outExpo(clamp((t - s.t) / 0.07));
    }
    // n=1: the pins hit the face and the halves rebound, jammed
    if (this.n === 1 && t >= this.tLock) g += 11 * pulse(t, this.tLock + 0.03, 0.09);
    return g;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer } = this.ctx;
    const c = this.L.ctx;
    this.L.clear();
    const g = this.gapHalf(t);
    const hx = SEAM - g; // the human face
    const mx = SEAM + g; // the machine face
    const dy = t >= this.tLock ? MIS[this.n]! : MIS[this.n]! * 1.6;
    const lock = t >= this.tLock ? pulse(t, this.tLock, 0.08) : 0;

    c.save();
    c.translate(W / 2, H / 2); c.rotate(-0.05); c.scale(1 + 0.06 * prog(t, this.ctx.start, this.ctx.end), 1 + 0.06 * prog(t, this.ctx.start, this.ctx.end)); c.translate(-W / 2, -H / 2);
    this.drawMachine(c, t, mx, TOP + dy);
    this.drawHuman(c, t, hx, TOP);
    this.drawWord(c, t, hx, mx, dy);
    if (t >= this.tLock && t < this.tLock + 0.35 && this.n < 3) {
      // the pins scrape the face
      for (const py of PINS) sparksAt(c, { x: mx - PIN_L + 4, y: TOP + dy + py + (py % 2 ? 6 : -6) }, t, 3, 26, this.acc);
    }
    if (t >= this.tLock && t < this.tLock + 0.7) this.callout(c, t, hx, mx);
    c.restore();

    if (t < this.ctx.start + 0.12) dataBurst(c, t, this.ctx.start, this.acc);
    if (t >= this.tLock && t < this.tLock + 0.12) dataBurst(c, t, this.tLock, this.acc);

    this.pass.u.glitch!.value = clamp(0.9 * lock + 0.3 * f.a.snare);
    this.pass.u.seed!.value = frameIdx(t) % 991;
    this.pass.u.invert!.value = 0;
    this.L.upload();
    this.pass.render(renderer, out);
    const fi = frameIdx(t), beatHit = f.a.kick;
    return {
      bloom: 0.7, bloomThreshold: 0.9, bloomKnee: 0.3, halation: 0.08, vignette: 0.45, grain: 0.06, ca: 0.6 + 2.5 * f.a.snare, hud: 0,
      zoom: 1 + 0.035 * beatHit + 0.07 * lock,
      shake: [lock * 16 * (hash(fi, 1) - 0.5), lock * 16 * (hash(fi, 2) - 0.5)],
    };
  }

  private drawHuman(c: CanvasRenderingContext2D, t: number, face: number, top: number) {
    c.save();
    c.translate(face, top);
    // the bone half, with its sockets cut into the face
    const sh = c.createLinearGradient(-HALF_W, 0, 0, HALF_H);
    sh.addColorStop(0, '#BDB9B0'); sh.addColorStop(0.6, '#DCD9D1'); sh.addColorStop(1, BONE);
    c.fillStyle = sh;
    c.fillRect(-HALF_W, 0, HALF_W, HALF_H);
    c.fillStyle = '#1A1D1C';
    for (const py of PINS) c.fillRect(-PIN_L - 4, py - PIN_H / 2 - 2, PIN_L + 4, PIN_H + 4);
    // its outline, by hand (drawn in the first half-second, then boiling)
    const p = prog(t, this.ctx.start - 0.05, this.ctx.start + 0.35, ease.outCubic);
    inkLine(c, this.outline, this.outlineLen, p, t, { seed: 71, width: 2.6, wobble: 2, color: 'ink', alpha: 0.9 });
    // "what will it take", written by the pen as sung
    c.translate(-HALF_W + 90, 200);
    const len = writtenLength(this.hand.st, this.hand.times, t);
    c.strokeStyle = 'rgba(27,30,29,0.12)'; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
    drawStrokeText(c, this.hand.st, this.hand.st.total);
    c.strokeStyle = 'rgba(27,30,29,0.92)'; c.lineWidth = 2.8;
    const head = drawStrokeText(c, this.hand.st, len);
    if (head && len < this.hand.st.total && len > 0) { c.fillStyle = '#1B1E1D'; c.beginPath(); c.arc(head.x, head.y, 4, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  private drawMachine(c: CanvasRenderingContext2D, t: number, face: number, top: number) {
    c.save();
    c.translate(face, top);
    // graphite body, a bevel, bolts, the accent hairline on the face
    const sh = c.createLinearGradient(0, 0, HALF_W, HALF_H);
    sh.addColorStop(0, '#3A403E'); sh.addColorStop(1, '#1F2322');
    c.fillStyle = sh;
    c.fillRect(0, 0, HALF_W, HALF_H);
    c.fillStyle = 'rgba(232,230,223,0.18)'; c.fillRect(0, 0, HALF_W, 3);
    c.fillStyle = hexA(this.acc, 0.9); c.fillRect(0, 0, 3, HALF_H);
    c.fillStyle = 'rgba(232,230,223,0.35)';
    for (const [bx, by] of [[40, 40], [HALF_W - 40, 40], [40, HALF_H - 40], [HALF_W - 40, HALF_H - 40]] as [number, number][]) { c.beginPath(); c.arc(bx, by, 6, 0, Math.PI * 2); c.fill(); }
    c.font = font(MONO, 13); c.fillText('MX-02  MATING FACE A', 40, HALF_H - 60);
    // the pins
    for (const py of PINS) {
      c.fillStyle = hexA(this.acc, 1);
      c.fillRect(-PIN_L, py - PIN_H / 2, PIN_L, PIN_H);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fillRect(-PIN_L, py - PIN_H / 2, PIN_L, 3);
    }
    // "TO MAKE YOU", laser-etched letter by letter
    c.translate(130, 200);
    c.font = font(MONO_B, 46);
    const cur = this.machine.findIndex((w) => t >= w.start && t < w.end);
    let laser: { x: number; y: number } | null = null;
    this.stencil.chars.forEach((ch, i) => {
      const lit = t >= ch.t0;
      c.fillStyle = lit ? (ch.w === cur ? hexA(this.acc, 1) : BONE) : 'rgba(232,230,223,0.1)';
      c.fillText(this.stencil.text[i]!, ch.x, 0);
      if (lit && t < ch.t0 + 0.08) laser = { x: ch.x + 12, y: -14 };
    });
    if (laser) sparksAt(c, laser, t, 4, 16, this.acc);
    c.restore();
  }

  /** CAPITULATE?, the left part on the human half, the right part on the machine half (offset by
   * the misregistration); the sung sweep crosses the seam. */
  private drawWord(c: CanvasRenderingContext2D, t: number, hx: number, mx: number, dy: number) {
    const wd = this.word;
    const base = TOP + 500;
    const p = Lyrics.wordProgress(this.cap, t);
    const sx = p * wd.wpx; // the sweep, in word coordinates
    if (t < this.tLock - 0.01) return; // the word only exists once the two faces meet
    const born = pulse(t, this.tLock, 0.1); // stamped by the impact: it flashes in the accent
    c.save();
    c.font = font(SLAB, wd.size);
    // left part (on bone): unsung = a faint cut, sung = ink
    c.save();
    c.beginPath(); c.rect(hx - HALF_W, TOP, HALF_W, HALF_H); c.clip();
    const lx = hx - wd.xk;
    c.fillStyle = born > 0.05 ? hexA(this.acc, born) : 'rgba(40,44,43,0.16)'; c.fillText(wd.left, lx, base);
    if (sx > 0) { c.beginPath(); c.rect(lx - 10, base - wd.size, Math.min(sx, wd.xk) + 10, wd.size * 1.3); c.clip(); c.fillStyle = '#1B1E1D'; c.fillText(wd.left, lx, base); }
    c.restore();
    // right part (on graphite): unsung = faint, sung = bone
    c.save();
    c.beginPath(); c.rect(mx, TOP + dy, HALF_W, HALF_H); c.clip();
    c.fillStyle = born > 0.05 ? hexA(this.acc, born) : 'rgba(232,230,223,0.1)'; c.fillText(wd.right, mx, base + dy);
    if (sx > wd.xk) { c.beginPath(); c.rect(mx, base + dy - wd.size, sx - wd.xk, wd.size * 1.3); c.clip(); c.fillStyle = BONE; c.fillText(wd.right, mx, base + dy); }
    c.restore();
    // the sweep front: an accent bar riding across both halves
    if (p > 0 && p < 1) {
      const fx = sx < wd.xk ? lx + sx : mx + (sx - wd.xk), fy = sx < wd.xk ? 0 : dy;
      c.fillStyle = hexA(this.acc, 1);
      c.fillRect(fx - 2, base - wd.size * CAP - 20 + fy, 4, wd.size * CAP + 40);
    }
    c.restore();
  }

  private callout(c: CanvasRenderingContext2D, t: number, hx: number, mx: number) {
    const a = 1 - clamp((t - this.tLock - 0.45) / 0.25);
    const x = (hx + mx) / 2, y = TOP - 40;
    c.save();
    c.strokeStyle = hexA(this.acc, 0.8 * a); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, TOP); c.lineTo(x, y); c.lineTo(x + 40, y); c.stroke();
    c.font = font(MONO, 14); c.fillStyle = hexA(this.acc, a);
    const msg = this.n === 1 ? `MATE FAIL   PIN OFFSET +${(MIS[1]! / 100).toFixed(2)}   RETRY` : this.n === 2 ? 'MATE 50%   SEATING' : 'MATED   4/4 PINS';
    c.fillText(msg, x + 48, y + 5);
    c.restore();
  }
}
