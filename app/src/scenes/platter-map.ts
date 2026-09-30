// bridgeB movement 3 (dense's GPU floor, move for move): "Come on, you're not even alive". The match cut
// lands on one sector, close up (the bits inside it); the camera cranes up with an exponential zoom and an
// unroll to the whole platter drawn as its sector map, the zoned rings of sectors (used, free, being read).
// The words are spelled by the sectors themselves, one band of rings per phrase, lit as sung; the write
// front is the blue cursor. On every beat a read ring runs out from the spindle and the frame punches 2%;
// on every kick the arm seeks. The drive's label on the casting carries the value (≈ 7 W) and the fine
// print. A dutch roll in on the last beat hands the angle to movement 4.
import * as THREE from 'three';
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import type { PostOverrides } from '../engine/scene';
import { ease, lerp, prog, pulse, smoothstep, TAU } from '../engine/util';
import { dot2D } from './_power';
import { type Cam, type DiscState, RP, R_OUT, NR, RING, CELL, NS_MAX, HUB, PIVOT, CAP, polar, headAt, drawArm, applyCam, w2s, camAt, stepped } from './platter-kit';

/** The roll (rad, clockwise) movement 3 hands to movement 4. */
export const ROLL_IN = 0.07;
const DIVE_ROLL = -0.35;
const Z_END = 0.06; // the whole platter: RP -> 540 px
const VIEW = { x: 2167, y: -583 }; // the platter a little left of centre, the label on the casting at right
const BANDS = [{ r0: 3, r1: 29 }, { r0: 37, r1: 63 }, { r0: 71, r1: 97 }];
const up = (w: string) => w.replace(/[,.?!“”"]/g, '').toUpperCase();
const ringR = (i: number) => R_OUT - (i + 0.5) * RING;

export class SectorMap {
  mask: THREE.DataTexture;
  words: Word[];
  band: number[] = []; // band of each word
  focus = { x: 0, y: -7800 };
  zStart = 1.4;
  c3: number; c4: number; kicks: number[]; beats: number[];
  bandR: number[] = [];

  constructor(L3: Line, c3: number, c4: number, kicks: number[], beats: number[]) {
    this.c3 = c3; this.c4 = c4; this.kicks = kicks.filter((k) => k > c3 + 0.1 && k < c4 - 0.02); this.beats = beats;
    this.words = L3.words.slice(0, 8);
    const n = this.words.length;
    // bands: the last word alone on the inner band, the two before it in the middle, the rest outside
    this.band = this.words.map((_, i) => (i === n - 1 ? 2 : i >= n - 3 ? 1 : 0));
    if (n <= 2) this.band = this.words.map((_, i) => i);
    this.bandR = BANDS.map((b) => ringR((b.r0 + b.r1) / 2));
    // ---- the mask, drawn per band in arc-length cells, then resampled onto each ring's sectors
    const MW = NS_MAX;
    const cv = document.createElement('canvas');
    cv.width = MW; cv.height = NR;
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    const hit = new Int16Array(MW * NR).fill(-1); // word index
    const uu = new Float32Array(MW * NR);
    BANDS.forEach((b, bi) => {
      const ws = this.words.map((w, i) => ({ w, i })).filter((x) => this.band[x.i] === bi);
      if (!ws.length) return;
      const texts = ws.map((x) => up(x.w.w));
      const line = texts.join(' ');
      const fam = F.archivo(bi === 0 ? 87.5 : 100, 900);
      const capR = b.r1 - b.r0;
      let size = capR / CAP;
      c.font = font(fam, size);
      const maxW = (2 * (bi === 2 ? 1.25 : 1.36) * this.bandR[bi]!) / CELL;
      let mw = c.measureText(line).width;
      if (mw > maxW) { size *= maxW / mw; c.font = font(fam, size); mw = c.measureText(line).width; }
      const x0 = Math.round(MW / 2 - mw / 2);
      const base = b.r1;
      let pre = '';
      ws.forEach((x, k) => {
        const wx = x0 + c.measureText(pre).width;
        const ww = c.measureText(texts[k]!).width;
        pre += texts[k]! + ' ';
        c.clearRect(0, 0, MW, NR);
        c.fillStyle = '#fff';
        c.fillText(texts[k]!, wx, base);
        const im = c.getImageData(0, 0, MW, NR).data;
        for (let y = b.r0 - 4; y < Math.min(NR, b.r1 + 8); y++) for (let xx = 0; xx < MW; xx++) {
          if (im[(y * MW + xx) * 4 + 3]! > 110) { hit[y * MW + xx] = x.i; uu[y * MW + xx] = (xx + 0.5 - wx) / Math.max(1, ww); }
        }
      });
    });
    // resample: ring i, sector j -> the band's arc-length cell
    const bandOfRing = (i: number) => BANDS.findIndex((b) => i >= b.r0 - 4 && i < b.r1 + 8);
    const data = new Uint8Array(NS_MAX * NR * 4);
    let fBest = 1e9;
    for (let i = 0; i < NR; i++) {
      const bi = bandOfRing(i);
      if (bi < 0) continue;
      const rc = ringR(i), ns = Math.floor((TAU * rc) / RING);
      for (let j = 0; j < ns; j++) {
        let a = ((j + 0.5) / ns) * TAU;
        if (a > Math.PI) a -= TAU;
        const xx = Math.floor((a * this.bandR[bi]!) / CELL + MW / 2);
        if (xx < 0 || xx >= MW) continue;
        const wi = hit[i * MW + xx]!;
        if (wi < 0) continue;
        const o = (i * NS_MAX + j) * 4;
        data[o] = 255; data[o + 1] = Math.round(Math.max(0, Math.min(1, uu[i * MW + xx]!)) * 255); data[o + 2] = Math.round((wi / 8) * 255); data[o + 3] = 255;
        // the match cut's cell: the first word's leftmost lit sector on the band's middle ring
        if (wi === 0 && i === Math.round((BANDS[0]!.r0 + BANDS[0]!.r1) / 2) && a < fBest) { fBest = a; this.focus = polar(rc, a + 1.5 * CELL / rc); }
      }
    }
    this.mask = new THREE.DataTexture(data, NS_MAX, NR, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.mask.magFilter = THREE.NearestFilter; this.mask.minFilter = THREE.NearestFilter;
    this.mask.needsUpdate = true;
  }

  /** The dive ends with a letter stem `stemPx` wide on screen; the first frame shows a stem of that width. */
  setEntry(stemPx: number) {
    this.zStart = Math.max(0.6, Math.min(3, stemPx / (4.5 * CELL)));
  }

  private lastBeats(t: number, n = 4) {
    const k = this.beats.filter((b) => b <= t).slice(-n);
    while (k.length < n) k.unshift(-99);
    return k;
  }

  cam(t: number): Cam {
    const t0 = this.c3;
    const k = prog(t, t0 + 0.04, t0 + 0.8, ease.outCubic);
    let z = Math.exp(lerp(Math.log(this.zStart), Math.log(Z_END), k));
    const settle = prog(t, t0 + 0.9, this.c4, ease.linear);
    z *= 1 + 0.035 * settle;
    const bk = this.lastBeats(t);
    z *= 1 + pulse(t, bk[3]!, 0.07) * 0.02;
    let r = lerp(DIVE_ROLL, 0, ease.outCubic(k)) + 0.03 * settle;
    const lastB = this.beats.filter((b) => b < this.c4 - 0.05).pop() ?? this.c4 - 0.55;
    r += prog(t, lastB, this.c4, ease.inCubic) * (ROLL_IN - 0.03);
    // the entry cell stays on screen through the pull-out: it slides from the centre to where the
    // final framing puts it
    const end = { x: VIEW.x, y: VIEW.y, z: Z_END, r: 0 };
    const fe = w2s(end, this.focus.x, this.focus.y);
    const fk = ease.inOutCubic(k);
    const cam = camAt(this.focus.x, this.focus.y, lerp(W / 2, fe.x, fk), lerp(H / 2, fe.y, fk), z, r);
    // the last word: a snap push-in onto its band (outExpo), then a slow creep until the cut
    const wl = this.words[this.words.length - 1]!;
    const k2 = ease.outExpo(prog(t, wl.start, wl.start + 0.4)) * (this.words.length > 1 ? 1 : 0);
    if (k2 <= 0) return cam;
    const tgt = { x: 250, y: -this.bandR[2]! + 950 };
    const z2 = cam.z * lerp(1, 1.85, k2) * (1 + 0.04 * prog(t, wl.start + 0.4, this.c4));
    return { x: lerp(cam.x, tgt.x, k2), y: lerp(cam.y, tgt.y, k2), z: z2, r: cam.r };
  }

  /** The actuator: the band being written, plus a seek excursion on every kick. */
  private head(t: number) {
    let bi = 0;
    for (let i = 0; i < this.words.length; i++) if (t >= this.words[i]!.start - 0.05) bi = this.band[i]!;
    // radius steps between bands (70 ms seeks with overshoot), a twitch on each kick
    const keys: [number, number][] = [[this.c3 - 1, this.bandR[this.band[0] ?? 0]!]];
    for (let i = 1; i < this.words.length; i++) {
      if (this.band[i] !== this.band[i - 1]) keys.push([this.words[i]!.start - 0.05, this.bandR[this.band[i]!]!]);
    }
    let r = stepped(t, keys, 5.5, 0.32);
    this.kicks.forEach((k, i) => { if (t >= k) r += (i % 2 ? 1 : -1) * 9 * RING * Math.exp(-(t - k) / 0.07) * Math.cos((t - k) * 40); });
    void bi;
    return headAt(r);
  }

  draw(c: CanvasRenderingContext2D, t: number): { disc: DiscState; post: PostOverrides } {
    const cam = this.cam(t);
    const px = 1 / cam.z;
    c.save();
    applyCam(c, cam);
    // the spindle and its clamp
    const view = cam.z < 0.5;
    if (view) {
      c.beginPath(); c.arc(0, 0, HUB, 0, TAU); c.fillStyle = '#161A19'; c.fill();
      c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 1.2 * px; c.stroke();
      c.beginPath(); c.arc(0, 0, HUB * 0.82, 0, TAU); c.strokeStyle = rgba('bone', 0.22); c.lineWidth = px; c.stroke();
      for (let i = 0; i < 6; i++) {
        const P = polar(HUB * 0.62, (i / 6) * TAU + 0.2);
        c.beginPath(); c.arc(P.x, P.y, 170, 0, TAU); c.fillStyle = '#0E1110'; c.fill(); c.strokeStyle = rgba('bone', 0.45); c.stroke();
        c.beginPath(); c.moveTo(P.x - 90, P.y); c.lineTo(P.x + 90, P.y); c.moveTo(P.x, P.y - 90); c.lineTo(P.x, P.y + 90); c.strokeStyle = rgba('bone', 0.3); c.stroke();
      }
      c.beginPath(); c.arc(0, 0, 600, 0, TAU); c.fillStyle = '#1E2322'; c.fill(); c.strokeStyle = rgba('bone', 0.4); c.stroke();
      c.beginPath(); c.arc(0, 0, 220, 0, TAU); c.fillStyle = '#070808'; c.fill();
      this.drawLabel(c, t, px);
      this.drawRamp(c, px);
    }
    // the arm and the head
    const hd = this.head(t);
    const ang = Math.atan2(PIVOT.y - hd.y, PIVOT.x - hd.x);
    const seekK = this.kicks.reduce((m, k) => Math.max(m, pulse(t, k, 0.05)), 0);
    drawArm(c, hd.x, hd.y, ang, px, { hot: 1, slam: 0.3 * seekK });
    c.restore();
    const hs = w2s(cam, hd.x, hd.y);
    dot2D(c, hs.x, hs.y, t, (0.55 + 0.4 * seekK) * Math.min(1.6, Math.max(0.5, cam.z * 9)), 1, 0.35);

    // ---- the disc: the sector map
    const bk = this.lastBeats(t);
    const prog8 = this.words.map((w) => Lyrics.wordProgress(w, t));
    const ghost8 = this.words.map((w) => smoothstep(w.start - 0.5, w.start, t));
    const detail = smoothstep(0.35, 1.1, cam.z);
    const lit = 1 + pulse(t, this.words[this.words.length - 1]!.start, 0.1) * 0.25;
    const disc: DiscState = {
      cam, t, map: 1, detail, lit, prog: prog8, ghost: ghost8, beats: bk,
      pitch: RING, phase: R_OUT, groove: 0.4, sheen: 0.9, sheenA: 0.62, wedge: 0.35, data: 0, cast: 1,
    };
    const wl = this.words[this.words.length - 1]!;
    const post: PostOverrides = { hud: 0, bloom: 0.58, bloomThreshold: 0.95, bloomKnee: 0.25, vignette: 0.45, ca: 1.2 + 1.5 * pulse(t, this.c3, 0.08) + 1.2 * pulse(t, wl.start, 0.06), grain: 0.05, halation: 0.12 };
    return { disc, post };
  }

  /** The load/unload ramp at the platter's edge (where the head parks). */
  private drawRamp(c: CanvasRenderingContext2D, px: number) {
    const P = headAt(RP + 420);
    c.save();
    c.translate(P.x, P.y); c.rotate(Math.atan2(PIVOT.y - P.y, PIVOT.x - P.x) + Math.PI / 2);
    c.beginPath(); c.roundRect(-380, -900, 760, 1500, 120); c.fillStyle = '#131716'; c.fill();
    c.strokeStyle = rgba('bone', 0.35); c.lineWidth = px; c.stroke();
    c.restore();
  }

  /** The drive's label on the casting: the value, once, and the fine print. */
  private drawLabel(c: CanvasRenderingContext2D, t: number, px: number) {
    const x = 9900, y = -7350, w = 5300;
    c.save();
    c.translate(x, y);
    const s = w / 380; // label units: 380 x 247
    c.scale(s, s);
    c.beginPath(); c.roundRect(0, 0, 380, 247, 6); c.fillStyle = '#23282A'; c.fill();
    c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 1.2 * px / s; c.stroke();
    c.fillStyle = rgba('bone', 0.9);
    c.font = font(F.mono(600), 13); c.letterSpacing = '2px';
    c.fillText('HDD-1 · 3.5″ · 7,200 RPM', 18, 30);
    c.font = font(F.mono(400), 11); c.letterSpacing = '1px'; c.fillStyle = rgba('bone', 0.6);
    c.fillText('+12 V ⎓ 0.58 A   +5 V ⎓ 0.12 A', 18, 50);
    c.fillStyle = rgba('bone', 0.3); c.fillRect(18, 62, 344, 1);
    c.font = font(F.mono(500), 46); c.letterSpacing = '0px'; c.fillStyle = rgba('bone', 0.96);
    c.fillText('≈ 7 W', 18, 116);
    c.font = font(F.mono(500), 24); c.fillStyle = rgba('bone', 0.7); c.fillText('K −0.52', 190, 114);
    c.font = font(F.mono(400), 10.5); c.letterSpacing = '0.6px'; c.fillStyle = rgba('bone', 0.62);
    c.fillText('fly height: 3 nm · MTBF: 1,000,000 h (claimed)', 18, 150);
    c.fillText('warranty void if opened (opened)', 18, 168);
    c.fillText('back up regularly', 18, 186);
    // a barcode (seeded), and the serial
    let bx = 18;
    for (let i = 0; i < 46; i++) { const bw = 1 + ((i * 7) % 3); if ((i * 13) % 5 !== 0) c.fillRect(bx, 202, bw, 24); bx += bw + 1.6; }
    c.font = font(F.mono(400), 10); c.fillStyle = rgba('bone', 0.5);
    c.fillText('S/N WAP-2018-0412', 220, 222);
    c.letterSpacing = '0px';
    c.restore();
    void t;
  }
}
