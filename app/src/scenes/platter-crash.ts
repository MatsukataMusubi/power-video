// bridgeB movement 4 (dense's askew, move for move): "If you're not back, back, back on your drive".
// Closer: the outer tracks of the platter and the head on its arm. The head writes the song along its
// track (the platter turns under it as the words are written: the head is the cursor); the tracks around
// it carry the earlier lines. The whole frame rolls one step on every kick and beat, each step caught by a
// spring. On each "back" the head slaps the platter (sparks, a scratch ring the platter drags round), the
// third is the crash, the plate's one maximal hit: the slider digs in, a gouge ploughs through the track
// and the words on it, debris sprays off along the turn, the dot sputters. "On your" is written crooked by
// the dying head. On the last beat the roll whips back past level to HANDOFF.roll and holds into the cut:
// prompt2 opens rolled by the same angle and glides straight.
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, type TextLayout } from '../engine/type';
import { type Line, type Word, norm } from '../engine/lyrics';
import type { PostOverrides } from '../engine/scene';
import { ease, frameIdx, hash, lerp, prog, pulse, smoothstep, TAU } from '../engine/util';
import { dot2D, burst2D, HANDOFF } from './_power';
import { type Cam, type DiscState, PIVOT, CAP, RP, polar, headAt, drawArm, applyCam, w2s, stepped, lay, xAt, runRing } from './platter-kit';
import { ROLL_IN } from './platter-map';

const R4 = 7600; // the track's baseline radius
const SIZE = 560; // type size (world)
const CAPW = SIZE * CAP;
const PITCH = CAPW * 1.36;
const Z0 = 0.2;
const HEAD_S = { x: 1400, y: 560 }; // where the head sits on screen (unrolled frame)
const up = (w: string) => w.replace(/[“”"]/g, '').toUpperCase();

interface Tok { w: Word; i0: number; i1: number }

export class Crash {
  t0: number; end: number;
  beats: number[]; kicks: number[];
  text: string; toks: Tok[] = [];
  lay: TextLayout;
  fam = F.archivo(87.5, 900);
  head: { x: number; y: number };
  aHead: number;
  backs: number[] = [];
  bW: number;
  rollK: [number, number][];
  steps: number[] = [];
  side: { l: TextLayout; r: number; phase: number }[] = [];
  L4: Line;

  constructor(L3: Line, L4: Line, t0: number, end: number, kicks: number[], beats: number[]) {
    this.t0 = t0; this.end = end; this.L4 = L4;
    this.beats = beats.filter((b) => b >= t0 - 0.01 && b < end - 0.02);
    this.kicks = kicks.filter((k) => k > t0 + 0.05 && k < end - 0.05);
    // the track: the previous line (its last word is still being held at the cut) and this one
    const words = [...L3.words, ...L4.words];
    let s = '';
    words.forEach((w, i) => {
      if (i === L3.words.length) s += '  ';
      else if (i) s += ' ';
      const u = up(w.w);
      this.toks.push({ w, i0: s.length, i1: s.length + u.length });
      s += u;
    });
    this.text = s;
    this.lay = lay(s, this.fam, SIZE, -0.01 * SIZE);
    this.head = headAt(R4 + CAPW * 0.5);
    this.aHead = Math.atan2(this.head.x, -this.head.y);
    // the three backs (by content, else by position), the whip on the last beat
    let bs = L4.words.filter((w) => norm(w.w) === 'back');
    if (bs.length < 3) bs = L4.words.slice(3, 6);
    const hitOf = (x: number) => this.kicks.find((k) => k >= x - 0.07 && k <= x + 0.15) ?? this.beats.find((b) => b >= x - 0.07) ?? x;
    this.backs = bs.slice(0, 3).map((w) => hitOf(w.start));
    this.bW = this.beats[this.beats.length - 1] ?? end - 0.55;
    if (this.bW <= (this.backs[2] ?? 0) + 0.1) this.bW = end - 0.55;
    // roll steps: every kick and beat between the cut and the whip; the backs step harder
    const ev = [...this.beats, ...this.kicks].filter((x) => x > t0 + 0.05 && x < this.bW - 0.05).sort((a, b) => a - b);
    const merged: number[] = [];
    for (const x of ev) {
      const near = this.backs.find((b) => Math.abs(b - x) < 0.12);
      const v = near ?? x;
      if (!merged.some((m) => Math.abs(m - v) < 0.12)) merged.push(v);
    }
    for (const b of this.backs) if (!merged.some((m) => Math.abs(m - b) < 0.01)) merged.push(b);
    merged.sort((a, b) => a - b);
    this.steps = merged;
    let r = ROLL_IN;
    this.rollK = [[t0, ROLL_IN]];
    for (const x of merged) {
      const bi = this.backs.findIndex((b) => Math.abs(b - x) < 0.01);
      r += bi === 0 ? 0.045 : bi === 1 ? 0.055 : bi === 2 ? 0.075 : 0.03;
      this.rollK.push([x, r]);
    }
    this.rollK.push([this.bW, HANDOFF.roll]);
    // the neighbouring tracks: earlier data (copies of the line before), dim
    const ghostTxt = L3.words.map((w) => up(w.w)).join(' ') + ' · ';
    for (const k of [1, -1, -2, -3]) {
      const l = lay(ghostTxt.repeat(4), this.fam, SIZE, -0.01 * SIZE);
      this.side.push({ l, r: R4 + k * PITCH, phase: -hash(k, 3) * 6000 - 2500 });
    }
  }

  // -------------------------------------------------------------- time
  /** Characters written by t (the spaces between words count once the next word starts). */
  private front(t: number) {
    let n = 0;
    for (const k of this.toks) {
      const w = k.w, len = k.i1 - k.i0;
      if (t <= w.start) return n;
      n = k.i0;
      if (t >= w.end) { n = k.i1; continue; }
      return k.i0 + (len * (t - w.start)) / Math.max(1e-3, w.end - w.start);
    }
    return n;
  }
  /** Platter rotation: the written front stays under the head (plus a jolt on every kick). */
  rot(t: number) {
    const s = xAt(this.lay, this.front(t));
    let r = this.aHead - s / R4;
    for (const k of this.kicks) if (t >= k) r -= 0.006 * Math.exp(-(t - k) / 0.08) * Math.sin((t - k) * 40);
    return r;
  }
  roll(t: number) {
    const r = stepped(t, this.rollK, 3.0, 0.42);
    // lands exactly on the hand-off angle for the cut
    const k = smoothstep(this.end - 0.2, this.end - 0.04, t);
    return lerp(r, HANDOFF.roll, k);
  }
  private hit(t: number) {
    let h = 0;
    for (const k of this.kicks) h = Math.max(h, pulse(t, k, 0.05) * 0.25);
    this.backs.forEach((b, i) => { h = Math.max(h, pulse(t, b, i === 2 ? 0.09 : 0.06) * (i === 2 ? 1 : i === 1 ? 0.6 : 0.45)); });
    h = Math.max(h, pulse(t, this.bW, 0.06) * 0.55);
    return h;
  }
  cam(t: number): Cam {
    const roll = this.roll(t);
    const land = 0.05 * (1 - ease.outExpo(prog(t, this.t0, this.t0 + 0.35)));
    const z = Z0 * (1 - 0.35 * Math.max(0, roll - ROLL_IN)) * (1 + land + 0.06 * ease.inOutCubic(prog(t, this.bW, this.end)));
    const base = { x: this.head.x - (HEAD_S.x - W / 2) / z, y: this.head.y - (HEAD_S.y - H / 2) / z };
    return { x: base.x, y: base.y, z, r: roll };
  }

  // -------------------------------------------------------------- draw
  draw(c: CanvasRenderingContext2D, t: number): { disc: DiscState; post: PostOverrides } {
    const cam = this.cam(t);
    const hit = this.hit(t);
    const fr = frameIdx(t);
    const settled = t >= this.end - 0.08;
    const shake: [number, number] = settled ? [0, 0] : [(hash(fr, 1) - 0.5) * 30 * hit, (hash(fr, 2) - 0.5) * 20 * hit];
    const rot = this.rot(t);
    const [b1, b2, b3] = this.backs as [number, number, number];

    // stroboscopic trail of the whip (under everything)
    if (t > this.bW && t < this.bW + 0.3) {
      for (let e = 4; e >= 1; e--) {
        const te = t - e * 0.028;
        if (te < this.bW - 0.01) continue;
        c.save();
        applyCam(c, this.cam(te));
        c.globalAlpha = 0.12 * (1 - e / 5);
        c.font = font(this.fam, SIZE);
        c.fillStyle = e % 2 ? rgba('signal') : rgba('bone');
        const a0 = this.rot(te);
        runRing(c, this.lay, R4, a0, Math.max(0, this.front(te) - 14), this.front(te), [this.aHead - 1.2, this.aHead + 0.1]);
        c.restore();
      }
    }

    c.save();
    c.translate(shake[0], shake[1]);
    applyCam(c, cam);
    const px = 1 / cam.z;
    const win: [number, number] = [this.aHead - 1.35, this.aHead + 0.75];
    // the neighbouring tracks
    c.font = font(this.fam, SIZE);
    for (const sd of this.side) {
      c.fillStyle = rgba('graphite', sd.r > R4 ? 0.3 : 0.42);
      runRing(c, sd.l, sd.r, rot + sd.phase / sd.r, 0, 999, win);
    }
    // the track: written (bone), being written (signal), ahead (a faint guide)
    const n = this.front(t);
    const cur = this.toks.find((k) => t >= k.w.start && t < k.w.end + 0.05);
    const dmg = (i: number) => this.damage(i, t);
    c.fillStyle = rgba('bone', 0.17);
    this.ring(c, rot, n, 999, win, dmg, t);
    c.fillStyle = rgba('bone', 0.96);
    this.ring(c, rot, 0, cur ? Math.min(n, cur.i0) : n, win, dmg, t);
    if (cur && n > cur.i0) { c.fillStyle = rgba('signal'); this.ring(c, rot, cur.i0, n, win, dmg, t); }

    // the scratches: each back leaves a ring the platter drags round; the third is the gouge
    this.drawScratch(c, t, rot, px);
    // the impact: shock rings run out over the platter from the head (the crash: two, wide)
    this.drawImpact(c, t, px);
    // debris and sparks
    this.drawDebris(c, t, px);
    // the arm
    const slam = this.backs.reduce((m, b, i) => Math.max(m, pulse(t, b, 0.07) * (i === 2 ? 1.6 : 0.8)), 0) + (t > b3 ? 0.35 + 0.1 * Math.sin(t * 90) : 0);
    const ang = Math.atan2(PIVOT.y - this.head.y, PIVOT.x - this.head.x);
    const armJolt = this.backs.reduce((m, b, i) => m + (t >= b ? (i === 2 ? 0.012 : 0.006) * Math.exp(-(t - b) / 0.08) * Math.sin((t - b) * 60) : 0), 0);
    drawArm(c, this.head.x, this.head.y, ang + armJolt, px, { slam, hot: t < b3 ? 1 : 0.4 + 0.6 * hash(fr, 5) });
    this.drawRim(c, px);
    c.restore();

    // the dot: bright while writing; after the crash it sputters
    const hs = w2s(cam, this.head.x, this.head.y);
    const sx = hs.x + shake[0], sy = hs.y + shake[1];
    let I = 1, S = 1;
    this.backs.forEach((b, i) => { S += (i === 2 ? 2.2 : 0.9) * pulse(t, b, 0.07); });
    if (t > b3) I = 0.25 + 0.75 * (hash(fr, 9) > 0.45 ? 1 : 0.2) * (1 - 0.5 * prog(t, b3, this.end));
    dot2D(c, sx, sy, t, 0.9 * S, I, 0.35);
    this.backs.forEach((b, i) => burst2D(c, sx, sy, t, b, { n: i === 2 ? 160 : 40 + 25 * i, speed: i === 2 ? 1900 : 900, life: i === 2 ? 0.55 : 0.3, seed: 11 + i, width: i === 2 ? 2.4 : 1.6 }));

    const disc: DiscState = {
      cam: { ...cam, x: cam.x - shake[0] / cam.z, y: cam.y - shake[1] / cam.z }, t, rot,
      pitch: PITCH, phase: R4 + CAPW * 0.5 + PITCH * 0.5, groove: 0.8, sheen: 1.0, sheenA: 0.5,
      wedge: 1, data: 1, cast: 1, exp: 1 + 0.3 * pulse(t, b3, 0.08),
    };
    // the shake is in-scene (the canvas and the disc); post shake stays 0 so the last frame is exact
    const post: PostOverrides = {
      hud: 0, bloom: 0.6 + 0.5 * pulse(t, b3, 0.12), bloomThreshold: 1.0, halation: 0.12, vignette: 0.45,
      ca: settled ? 1.0 : 1.1 + 2.6 * hit, grain: 0.05,
      flash: t >= b3 ? ([0.26, 0.08][fr - frameIdx(b3)] ?? 0) : 0,
      exposure: 1 + 0.2 * pulse(t, b3, 0.06),
    };
    void b1; void b2;
    return { disc, post };
  }

  /** The track's glyphs [from, to), each placed by the damage the crash did to it; glyphs the gouge ran
   *  through are torn along it (the two halves sheared apart). */
  private ring(c: CanvasRenderingContext2D, rot: number, from: number, to: number, win: [number, number], dmg: (i: number) => { dy: number; da: number }, t = 0) {
    const gs = this.lay.glyphs;
    const b3 = this.backs[2]!;
    const gA = t > b3 ? this.aHead - this.rot(b3) + rot : 9, gB = this.aHead;
    const yG = -CAPW * 0.51; // the gouge's height above the baseline
    for (let i = Math.max(0, Math.floor(from)); i < gs.length && i < to; i++) {
      const g = gs[i]!;
      if (g.ch === ' ') continue;
      const a = rot + g.x / R4;
      if (a < win[0] || a > win[1]) continue;
      const d = dmg(i);
      const P = polar(R4 + d.dy, a);
      c.save();
      c.translate(P.x, P.y); c.rotate(a + d.da);
      const lo = from - i, hi = to - i;
      const part = lo > 0 || hi < 1;
      if (part) {
        c.beginPath();
        const x0 = lo <= 0 ? -SIZE : lo * g.w, x1 = hi >= 1 ? g.w + SIZE : hi * g.w;
        c.rect(x0, -SIZE * 1.3, x1 - x0, SIZE * 1.8); c.clip();
      }
      const torn = a + g.w / R4 > gA && a < gB;
      if (!torn) c.fillText(g.ch, 0, 0);
      else {
        const sh = (0.08 + 0.1 * hash(i, 31)) * CAPW;
        for (const s of [-1, 1]) {
          c.save();
          c.beginPath();
          if (s < 0) c.rect(-SIZE, -SIZE * 1.3, g.w + 2 * SIZE, SIZE * 1.3 + yG - 10);
          else c.rect(-SIZE, yG + 10, g.w + 2 * SIZE, SIZE);
          c.clip();
          c.translate(s * sh * 0.5, s * 14);
          c.rotate(s * 0.03 * (hash(i, 33) - 0.5));
          c.fillText(g.ch, 0, 0);
          c.restore();
        }
      }
      c.restore();
    }
  }

  /** Glyphs written at or after a slap are knocked off the track (the crash: badly, and they stay crooked). */
  private damage(i: number, t: number) {
    const [b1, b2, b3] = this.backs as [number, number, number];
    const tok = this.toks.find((k) => i >= k.i0 && i < k.i1);
    const tw = tok ? tok.w.start + ((i - tok.i0 + 0.5) / Math.max(1, tok.i1 - tok.i0)) * (tok.w.end - tok.w.start) : 0;
    let dy = 0, da = 0;
    const kick = (tb: number, amp: number, seed: number) => {
      if (tw < tb - 0.02) return;
      const age = Math.max(0, t - tb);
      const ring = Math.exp(-age / 0.12) * Math.cos(age * 38);
      const k = tw - tb < 0.35 ? 1 : 0.35;
      dy += (hash(i, seed) - 0.5) * amp * CAPW * k * (0.7 + 0.5 * ring);
      da += (hash(i, seed + 1) - 0.5) * amp * 0.7 * k;
    };
    if (t >= b1) kick(b1, 0.12, 3);
    if (t >= b2) kick(b2, 0.2, 5);
    if (t >= b3) kick(b3, 0.8, 7);
    // glyphs near the crash point get flung up as it happens, then fall back crooked
    if (t >= b3 && tw < b3 && tw > b3 - 0.6) {
      const age = t - b3;
      dy += (hash(i, 17) - 0.3) * CAPW * 0.5 * Math.exp(-age / 0.15);
      da += (hash(i, 19) - 0.5) * 0.35 * Math.exp(-age / 0.2) + (hash(i, 21) - 0.5) * 0.12;
    }
    return { dy, da };
  }

  private drawScratch(c: CanvasRenderingContext2D, t: number, rot: number, px: number) {
    this.backs.forEach((b, i) => {
      if (t < b) return;
      const aStart = this.aHead - this.rot(b) + rot; // the slap point, dragged round by the platter
      const aEnd = this.aHead;
      if (aEnd - aStart < 0.0005 && i < 2) return;
      const r = R4 + CAPW * (0.45 + 0.06 * (i - 1));
      const age = t - b;
      c.save();
      c.lineCap = 'round';
      if (i < 2) {
        c.strokeStyle = rgba('bone', 0.55); c.lineWidth = (1.4 + 1.2 * i) * px;
        c.beginPath(); c.arc(0, 0, r, aStart - Math.PI / 2, aEnd - Math.PI / 2); c.stroke();
        c.strokeStyle = rgba('signal', 0.9 * Math.exp(-age / 0.25)); c.lineWidth = (3 + 2 * i) * px;
        c.stroke();
      } else {
        // the gouge: a dark trench with bright torn edges and a hot core that cools
        const wT = 12 * px + CAPW * 0.05;
        c.strokeStyle = 'rgba(4,5,5,0.95)'; c.lineWidth = wT;
        c.beginPath(); c.arc(0, 0, r, aStart - Math.PI / 2 - 0.004, aEnd - Math.PI / 2); c.stroke();
        for (const s of [-1, 1]) {
          c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1.6 * px;
          c.beginPath();
          for (let k = 0; k <= 60; k++) {
            const a = lerp(aStart, aEnd, k / 60);
            const jag = (hash(k, s, 3) - 0.5) * 10 * px;
            const P = polar(r + s * (wT / 2 + jag), a);
            if (k) c.lineTo(P.x, P.y); else c.moveTo(P.x, P.y);
          }
          c.stroke();
        }
        const hot = Math.exp(-age / 0.35);
        c.strokeStyle = rgba('ember', 0.95 * hot); c.lineWidth = 4 * px;
        c.beginPath(); c.arc(0, 0, r, Math.max(aStart, aEnd - 0.25) - Math.PI / 2, aEnd - Math.PI / 2); c.stroke();
        c.strokeStyle = rgba('signal', 0.9 * (0.4 + 0.6 * hot)); c.lineWidth = 9 * px;
        c.beginPath(); c.arc(0, 0, r, Math.max(aStart, aEnd - 0.08) - Math.PI / 2, aEnd - Math.PI / 2); c.stroke();
      }
      c.restore();
    });
  }

  private drawImpact(c: CanvasRenderingContext2D, t: number, px: number) {
    const H0 = this.head;
    c.save();
    this.backs.forEach((b, i) => {
      const age = t - b;
      const life = i === 2 ? 0.45 : 0.22;
      if (age < 0 || age > life) return;
      const k = 1 - age / life;
      const reach = i === 2 ? 5200 : 1400 + 500 * i;
      const rr = 120 + reach * ease.outCubic(age / life);
      c.strokeStyle = rgba('bone', 0.6 * k * k); c.lineWidth = (i === 2 ? 3 : 1.5) * px;
      c.beginPath(); c.arc(H0.x, H0.y, rr, 0, TAU); c.stroke();
      if (i === 2) {
        c.strokeStyle = rgba('signal', 0.6 * k * k); c.lineWidth = 5 * px * k + 1.5 * px;
        c.beginPath(); c.arc(H0.x, H0.y, rr * 0.62, 0, TAU); c.stroke();
      }
    });
    c.restore();
  }

  /** Flakes of coating torn off by the crash, streaming off the head along the turn (world, above the disc). */
  private drawDebris(c: CanvasRenderingContext2D, t: number, px: number) {
    const b3 = this.backs[2]!;
    if (t < b3) return;
    const H0 = this.head;
    // tangent at the head, the way the platter carries things (counter-clockwise: to the left at the top)
    const ta = this.aHead - Math.PI;
    const tx = Math.cos(ta), ty = Math.sin(ta);
    const N = 220;
    c.save();
    c.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      // birth: a heavy burst at the crash, then a trickle while the head keeps ploughing
      const tb = i < 110 ? b3 + 0.04 * hash(i, 1) : b3 + (this.end - b3) * ((i - 110) / (N - 110)) + 0.01 * hash(i, 2);
      const age = t - tb;
      const life = 0.35 + 0.5 * hash(i, 3);
      if (age < 0 || age > life) continue;
      const sp = (i < 110 ? 5200 : 2400) * (0.25 + hash(i, 4));
      const spread = (hash(i, 5) - 0.5) * (i < 110 ? 2.2 : 0.8);
      const dx = tx * Math.cos(spread) - ty * Math.sin(spread), dy = tx * Math.sin(spread) + ty * Math.cos(spread);
      const drag = 1 - Math.exp(-age * 3.5);
      const d = (sp / 3.5) * drag;
      const x = H0.x + dx * d, y = H0.y + dy * d;
      const k = 1 - age / life;
      const len = (60 + 180 * hash(i, 6)) * k;
      const blue = hash(i, 7) < 0.3;
      c.strokeStyle = blue ? rgba(k > 0.6 ? 'ember' : 'signal', Math.min(1, k * 1.3)) : rgba(hash(i, 8) < 0.5 ? 'bone' : 'ash', 0.8 * k);
      c.lineWidth = (blue ? 2.2 : 1.6 + 2 * hash(i, 9)) * px;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx * len, y - dy * len); c.stroke();
    }
    c.restore();
  }

  /** The platter's edge and the recess wall (a hairline), in world. */
  private drawRim(c: CanvasRenderingContext2D, px: number) {
    c.save();
    c.strokeStyle = rgba('bone', 0.3); c.lineWidth = px;
    c.beginPath(); c.arc(0, 0, RP + 900, 0, TAU); c.stroke();
    c.restore();
  }
}
