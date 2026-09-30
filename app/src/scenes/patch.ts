// DROP (the bass drop, instrumental): a wall of patch bays seen dead-on, drawn as a frontal
// elevation: jacks, indicator lamps, industrial silkscreen, bone and graphite; only the lamps are blue.
// Structure: the tail of P(doom)'s shoggoth, move for move (docs/PDOOM-STRUCTURE.md, shots 3–6):
//   HIT  the drop's first downbeat. Frame 1 is world2's last shape, one jack at HANDOFF.jack; from it
//        the whole wall lights at once while the camera is yanked back (outExpo 0.75 s, roll −0.05,
//        then a drift). The lamps cool off.
//   C    the beat before the next downbeat: hard reframe, a tilted close-up (roll 0.12) creeping in on
//        the rating plate: LOAD 0.7 kW, the value, once. Exposure, shake and zoom on the cut.
//   D    the downbeat: hard cut to the frontal long shot, centred on the one unlabelled lamp; a slow
//        push (inOutQuad) to the collapse, a push-kick on every downbeat. Twelve legend lamps switch on
//        on 8ths, then 16ths (the unlabelled one first, HUMAN IN THE LOOP → last, on the downbeat);
//        they throb on every beat; snares shake the frame. Then they go out in an accelerating
//        sequence spaced 1, 1, ½, ½, ¼, ¼, ⅛, ⅛, 1/16… beats. The unlabelled one stays on.
//   E    the last beat: CRT collapse; the last lamp (the dot) stretches into one full-width line at
//        HANDOFF.paperLine.y, the patent sheet's first line (verseA).
// Geometry: patch-wall.ts. The thread object here is the last lamp.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, lerp, ease, prog, pulse, hash, frameIdx, springStep, TAU } from '../engine/util';
import { dot2D, HANDOFF } from './_power';
import { Wall, THREAD, type Rect } from './patch-wall';

const NL = 12; // legend lamps (shoggoth's twelve eyes)
const V_REVEAL = 26000; // PU/s: the ignition front, from the hand-off jack across the wall
const Z_WIDE = 0.5;
const HOLD = 0.3; // s the wall stays fully lit after the ignition front passes
const FACE_FILL = '#1B1F1E';
const UPRIGHT_FILL = '#111413';
const PLATE_FILL = '#0C0E0E';
const HOLE_FILL = '#050606';
const LENS_OFF = '#0B0F13';

interface Cam { x: number; y: number; z: number; roll: number }

export default class Patch extends Scene {
  private L = new Layer2D();
  private comp!: FSPass;
  private wall = new Wall();
  private tS = 0; private tE = 0; private tHit = 0; private tCut = 0; private tD = 0; private tClose0 = 0; private tCollapse = 0;
  private onT: number[] = []; private offT: number[] = [];
  private downs: number[] = [];
  /** Per lamp: ignition time (the front reaching it) and cooling half-life. */
  private tr!: Float32Array; private hl!: Float32Array;
  private z0 = 1;
  private fam = { s5: F.mono(500), s6: F.mono(600), s4: F.mono(400) };

  override init() {
    const { audio: au } = this.ctx;
    this.tS = this.ctx.start; this.tE = this.ctx.end;
    // the drop lands on the plate's first downbeat; frame 1 still shows the hand-off jack alone
    this.tHit = this.tS + 1 / 60;
    // D: the first downbeat after the hit has settled; C: the beat before it
    this.tD = au.downbeats.find((d) => d > this.tS + 1.0) ?? this.tS + 2.2;
    this.tCut = au.timeOfBeat(Math.round(au.beatAt(this.tD)) - 1);
    // collapse on the last beat before the end; the lamps go out over the 4 beats before it
    const bC = Math.round(au.beatAt(this.tE)) - 1;
    this.tCollapse = au.timeOfBeat(bC);
    this.tClose0 = au.timeOfBeat(bC - 4);
    this.downs = au.downbeats.filter((d) => d >= this.tD - 0.01 && d < this.tCollapse);
    // lamps on: 8ths from the cut, then 16ths (shoggoth's rule: 5 on 8ths, then 16ths)
    const openOrder = [THREAD, 9, 0, 11, 5, 7, 1, 10, 6, 8, 4, 2];
    let b = Math.round(au.beatAt(this.tD) * 2) / 2;
    this.onT = new Array(NL).fill(0);
    openOrder.forEach((li, i) => { this.onT[li] = au.timeOfBeat(b); b += i < 5 ? 0.5 : 0.25; });
    // accelerating close, the outermost first; the unlabelled lamp's "close" is the collapse itself
    const offs = [0, 1, 2, 2.5, 3, 3.25, 3.5, 3.625, 3.75, 3.8125, 3.875, 4];
    const closeOrder = [0, 6, 11, 7, 1, 5, 8, 10, 4, 9, 2, THREAD];
    this.offT = new Array(NL).fill(0);
    closeOrder.forEach((li, k) => (this.offT[li] = au.timeOfBeat(bC - 4 + offs[k]!)));

    const w = this.wall;
    const n = w.lamps.length;
    this.tr = new Float32Array(n); this.hl = new Float32Array(n);
    const J = w.handJack;
    for (let i = 0; i < n; i++) {
      const l = w.lamps[i]!;
      const d = Math.hypot(l.x - J.x, l.y - J.y);
      this.tr[i] = this.tHit + d / V_REVEAL + 0.012 * hash(i, 3);
      this.hl[i] = 0.16 + 0.34 * hash(i, 5) ** 2;
    }
    this.z0 = HANDOFF.jack.r / J.r;
    this.comp = new FSPass(COMP, {
      tex: { value: this.L.texture }, squash: { value: 1 }, flatK: { value: 0 }, bodyK: { value: 1 },
      lineX: { value: W / 2 }, lineHalf: { value: 0 }, lineY: { value: HANDOFF.paperLine.y }, hot: { value: 2.2 }, gain: { value: 1 },
    });
  }

  // ------------------------------------------------------------------ camera
  private camAt(t: number): Cam {
    const w = this.wall;
    const J = w.handJack;
    if (t < this.tHit) return { x: J.x, y: J.y, z: this.z0, roll: 0 };
    if (t < this.tCut) {
      // yanked back from the jack to the wall; then a slow drift
      const k = ease.outExpo(prog(t, this.tHit, this.tHit + 0.75));
      const drift = prog(t, this.tHit + 0.5, this.tCut);
      const zw = Z_WIDE * (1 + 0.05 * drift);
      const cw = { x: -40 + 60 * drift, y: 170 - 20 * drift };
      return {
        x: lerp(J.x, cw.x, k), y: lerp(J.y, cw.y, k),
        z: Math.exp(lerp(Math.log(this.z0), Math.log(zw), k)),
        roll: -0.05 * k + 0.012 * drift,
      };
    }
    if (t < this.tD) {
      // C: a tilted close-up on the rating plate, creeping in
      const k = prog(t, this.tCut, this.tD, ease.outCubic);
      return { x: w.rating.x - 40 + 30 * k, y: w.rating.y + 6, z: lerp(2.35, 2.6, k), roll: 0.12 };
    }
    // D: frontal, centred on the unlabelled lamp; slow push to the collapse, a kick on each downbeat
    const tt = Math.min(t, this.tCollapse);
    const k = prog(tt, this.tD, this.tCollapse, ease.inOutQuad);
    let z = lerp(1.0, 1.24, k);
    const db = this.downs.filter((d) => d <= tt).pop();
    if (db != null) z *= 1 + 0.035 * pulse(tt, db, 0.12);
    return { x: w.threadLamp.x, y: w.threadLamp.y, z, roll: 0.006 * Math.sin((tt - this.tD) * 0.9) };
  }

  // ------------------------------------------------------------------ lamps
  /** Ignition from the hit: white-hot as the front passes, then cooling (0 before it arrives). */
  private hitI(i: number, t: number) {
    const tr = this.tr[i]!;
    if (t < tr) return 0;
    const hold = tr + HOLD;
    return t < hold ? 1 : pulse(t, hold, this.hl[i]!);
  }

  /** A legend lamp in D: switches on (spring overshoot), holds, switches off (a short filament tail). */
  private legendI(li: number, t: number) {
    const o = this.onT[li]!, c = this.offT[li]!;
    if (t < o) return 0;
    let k = clamp(springStep(t - o, 3.4, 0.42), 0, 1.15);
    if (li !== THREAD && t >= c) k *= Math.pow(0.5, (t - c) / 0.03) * (1 - ease.inCubic(clamp((t - c) / 0.12)));
    return k;
  }

  private beatThrob(t: number) {
    const au = this.ctx.audio;
    return pulse(t, au.timeOfBeat(Math.floor(au.beatAt(t) + 1e-4)), 0.16);
  }

  // ------------------------------------------------------------------ render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, audio: au } = this.ctx;
    const t = f.t;
    const cam = this.camAt(t);
    const inD = t >= this.tD && t < this.tCollapse;

    // CRT collapse
    const cK = prog(t, this.tCollapse, this.tCollapse + 0.3);
    const squash = t < this.tCollapse ? 1 : Math.max(0.0025, 1 - ease.outQuart(cK) * 0.9975);

    this.draw(t, cam);
    this.L.upload();

    const u = this.comp.u;
    u.squash!.value = squash;
    u.flatK!.value = t < this.tCollapse ? 0 : prog(t, this.tCollapse + 0.06, this.tCollapse + 0.24, ease.outCubic);
    u.bodyK!.value = (1 + 1.5 * cK) * (1 - prog(t, this.tCollapse + 0.18, this.tCollapse + 0.3));
    // the last lamp stretches sideways into the line
    const lampSX = W / 2; // the push keeps the unlabelled lamp at the frame centre
    u.lineX!.value = lampSX;
    u.lineHalf!.value = t < this.tCollapse ? 0 : lerp(14, W * 0.62, prog(t, this.tCollapse + 0.02, this.tCollapse + 0.22, ease.inOutCubic));
    const hitK = t >= this.tHit ? pulse(t, this.tHit, 0.1) : 0;
    u.hot!.value = 2.2;
    u.gain!.value = 1 + 1.2 * hitK;
    this.comp.render(renderer, out);

    // post: one maximal hit (the ignition), a smaller hit on the C cut, beat/snare in D
    const beatP = inD ? pulse(t, au.timeOfBeat(Math.floor(au.beatAt(t) + 1e-4)), 0.1) : 0;
    const cutK = t >= this.tCut ? pulse(t, this.tCut, 0.06) : 0;
    const dK = t >= this.tD ? pulse(t, this.tD, 0.06) : 0;
    const snare = inD ? au.hit('snare', t, 0.07) : 0;
    const sh = 11 * hitK + 5 * cutK + 3 * dK + 1.5 * beatP + 2.5 * snare;
    const o: PostOverrides = {
      bloom: 0.75 + 0.4 * hitK, bloomThreshold: 0.82, bloomRadius: 0.7,
      shake: [Math.sin(t * 93) * sh, Math.cos(t * 71) * sh],
      zoom: 1 + 0.05 * hitK + 0.015 * beatP + 0.03 * cutK + 0.008 * snare,
      ca: 0.6 + 2.5 * hitK + 1.5 * cK,
      exposure: 1 + 0.15 * hitK + 0.6 * cutK,
      vignette: 0.42, grain: 0.05, halation: 0.2,
    };
    if (t >= this.tCollapse) { o.shake = [0, 0]; o.zoom = 1; }
    if (t < this.tHit) { o.shake = [0, 0]; o.zoom = 1; o.ca = 0.6; }
    return o;
  }

  // ------------------------------------------------------------------ drawing
  private draw(t: number, cam: Cam) {
    const L = this.L; L.clear();
    const c = L.ctx;
    const w = this.wall;
    const z = cam.z, px = 1 / z;
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(cam.roll);
    c.scale(z, z);
    c.translate(-cam.x, -cam.y);
    // the view in PU (with the roll's corners), plus a margin
    const cs = Math.abs(Math.cos(cam.roll)), sn = Math.abs(Math.sin(cam.roll));
    const hx = ((W / 2) * cs + (H / 2) * sn) / z + 40, hy = ((W / 2) * sn + (H / 2) * cs) / z + 40;
    const vx0 = cam.x - hx, vx1 = cam.x + hx, vy0 = cam.y - hy, vy1 = cam.y + hy;
    const visR = (r: Rect) => r.x < vx1 && r.x + r.w > vx0 && r.y < vy1 && r.y + r.h > vy0;
    const visP = (x: number, y: number, m: number) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    const J = w.handJack;
    if (t >= this.tHit) {
      // ---- the wall (static line drawing)
      const byKind = (kind: Rect['kind'], fill: string | null, stroke: string | null, lw = 1) => {
        c.beginPath();
        let any = false;
        for (const r of w.rects) {
          if (r.kind !== kind || !visR(r)) continue;
          any = true;
          if (r.r > 0 && r.w * z > 6) c.roundRect(r.x, r.y, r.w, r.h, r.r);
          else c.rect(r.x, r.y, r.w, r.h);
        }
        if (!any) return;
        if (fill) { c.fillStyle = fill; c.fill(); }
        if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw * px; c.stroke(); }
      };
      byKind('upright', UPRIGHT_FILL, rgba('bone', 0.16));
      byKind('hole', HOLE_FILL, null);
      byKind('face', FACE_FILL, rgba('bone', 0.34), 1.1);
      byKind('strip', '#2A2F2D', rgba('bone', 0.22));
      byKind('slot', HOLE_FILL, rgba('bone', 0.22));
      byKind('switch', '#0E1010', rgba('bone', 0.5));
      byKind('plate', PLATE_FILL, rgba('bone', 0.42));
      byKind('rating', '#23282A', rgba('bone', 0.55), 1.2);

      // screws and bezels
      c.beginPath();
      for (const s of w.screws) if (visP(s.x, s.y, s.r)) { c.moveTo(s.x + s.r, s.y); c.arc(s.x, s.y, s.r, 0, TAU); }
      c.strokeStyle = rgba('bone', 0.32); c.lineWidth = px; c.stroke();
      // jacks: the nut, the bushing, the hole
      c.beginPath();
      for (const j of w.jacks) if (visP(j.x, j.y, j.r)) { c.moveTo(j.x + j.r, j.y); c.arc(j.x, j.y, j.r, 0, TAU); }
      c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 1.1 * px; c.stroke();
      c.beginPath();
      for (const j of w.jacks) if (visP(j.x, j.y, j.r) && j.r * z > 3) { c.moveTo(j.x + j.r * 0.72, j.y); c.arc(j.x, j.y, j.r * 0.72, 0, TAU); }
      c.strokeStyle = rgba('bone', 0.22); c.stroke();
      c.beginPath();
      for (const j of w.jacks) if (visP(j.x, j.y, j.r)) { c.moveTo(j.x + j.hole, j.y); c.arc(j.x, j.y, j.hole, 0, TAU); }
      c.fillStyle = HOLE_FILL; c.fill();
      // lamp lenses (off)
      c.beginPath();
      for (const l of w.lamps) if (visP(l.x, l.y, l.r)) { c.moveTo(l.x + l.r, l.y); c.arc(l.x, l.y, l.r, 0, TAU); }
      c.fillStyle = LENS_OFF; c.fill();
      c.strokeStyle = rgba('bone', 0.3); c.lineWidth = px; c.stroke();
      // printed lines (arrows)
      c.beginPath();
      for (const s of w.segs) if (visP(s.x0, s.y0, 20)) { c.moveTo(s.x0, s.y0); c.lineTo(s.x1, s.y1); }
      c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1.3 * px; c.stroke();

      this.drawText(c, t, z, visP);
      this.drawLegends(c, t, z, false);
      this.drawCord(c, z);

      // ---- the ignition front: the wall appears where it has passed
      const rev = (t - this.tHit) * V_REVEAL;
      if (rev < 4200) {
        c.save();
        c.globalCompositeOperation = 'destination-in';
        const g = c.createRadialGradient(J.x, J.y, 0, J.x, J.y, Math.max(1, rev));
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.8, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(vx0 - 200, vy0 - 200, vx1 - vx0 + 400, vy1 - vy0 + 400);
        c.restore();
      }
    }
    // the hand-off jack itself is always there (it is world2's last window)
    c.beginPath(); c.arc(J.x, J.y, J.r, 0, TAU);
    c.fillStyle = FACE_FILL; c.fill();
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.4 * px; c.stroke();
    c.beginPath(); c.arc(J.x, J.y, J.r * 0.72, 0, TAU); c.strokeStyle = rgba('bone', 0.35); c.lineWidth = px; c.stroke();
    c.beginPath(); c.arc(J.x, J.y, J.hole, 0, TAU); c.fillStyle = HOLE_FILL; c.fill();

    if (t >= this.tHit) {
      this.drawLit(c, t, z, visP);
      this.drawLegends(c, t, z, true);
    }
    c.restore();
  }

  private drawText(c: CanvasRenderingContext2D, t: number, z: number, visP: (x: number, y: number, m: number) => boolean) {
    const w = this.wall;
    c.textBaseline = 'alphabetic';
    let lastFont = '';
    for (const s of w.txt) {
      if (s.size * z < 4.2 || !visP(s.x, s.y, 200)) continue;
      const fam = s.wt >= 600 ? this.fam.s6 : s.wt >= 500 ? this.fam.s5 : this.fam.s4;
      const fnt = font(fam, s.size);
      if (fnt !== lastFont) { c.font = fnt; lastFont = fnt; }
      c.letterSpacing = `${s.track}px`;
      c.textAlign = s.align;
      c.fillStyle = rgba('bone', s.a * clamp((s.size * z - 4.2) / 2.5));
      c.fillText(s.s, s.x, s.y);
    }
    c.letterSpacing = '0px';
    c.textAlign = 'left';
  }

  /** Legend plates: dim silkscreen; lit (bright, a flicker as it comes on) while their lamp is on. */
  private drawLegends(c: CanvasRenderingContext2D, t: number, z: number, lit: boolean) {
    const w = this.wall;
    c.save();
    c.textAlign = 'center';
    c.font = font(this.fam.s6, 13);
    c.letterSpacing = '1.2px';
    w.legends.forEach((lg, li) => {
      if (!lg.lines.length) return;
      const I = t >= this.tD ? this.legendI(li, t) : 0;
      if (lit && I <= 0.02) return;
      let a = lit ? clamp(I) : 0.5;
      if (lit) {
        const age = t - this.onT[li]!;
        if (age < 0.12 && hash(frameIdx(t), li, 7) < 0.4) a *= 0.35;
      }
      const cy = lg.plate.y + lg.plate.h / 2;
      if (lit) {
        // the backlit plate
        const p = lg.plate;
        c.fillStyle = rgba('blood', 0.42 * clamp(a));
        c.beginPath(); c.roundRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3, 2); c.fill();
      }
      c.fillStyle = rgba('bone', a);
      if (lg.lines.length === 1) c.fillText(lg.lines[0]!, lg.x, cy + 4.5);
      else { c.fillText(lg.lines[0]!, lg.x, cy - 3); c.fillText(lg.lines[1]!, lg.x, cy + 13); }
    });
    c.restore();
  }

  /** The one patched cord (HUMAN 008 → MACHINE 013), hanging in front of the panel, with its tag. */
  private drawCord(c: CanvasRenderingContext2D, z: number) {
    const k = this.wall.cord;
    if (!k.ax && !k.bx) return;
    const px = 1 / z;
    const p = (s: number) => {
      const m = 1 - s;
      const x = m * m * m * k.ax + 3 * m * m * s * k.ax + 3 * m * s * s * k.bx + s * s * s * k.bx;
      const y = m * m * m * k.ay + 3 * m * m * s * (k.ay + 170) + 3 * m * s * s * (k.by + 120) + s * s * s * k.by;
      return { x, y };
    };
    c.save();
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i <= 40; i++) { const q = p(i / 40); if (i) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); }
    c.strokeStyle = rgba('bone', 0.75); c.lineWidth = 9; c.stroke();
    c.strokeStyle = '#131615'; c.lineWidth = Math.max(0.5, 9 - 2.4 * px); c.stroke();
    // plugs: the sleeve cap over the jack
    for (const [x, y] of [[k.ax, k.ay], [k.bx, k.by]] as const) {
      c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fillStyle = '#161A19'; c.fill();
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1.2 * px; c.stroke();
      c.beginPath(); c.arc(x, y, 7, 0, TAU); c.strokeStyle = rgba('bone', 0.4); c.lineWidth = px; c.stroke();
    }
    // the tag, tied on with a string
    const a = p(0.3);
    const tx = a.x + 6, ty = a.y + 26;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(tx, ty); c.strokeStyle = rgba('bone', 0.6); c.lineWidth = px; c.stroke();
    c.translate(tx, ty); c.rotate(-0.05);
    c.fillStyle = rgba('bone', 0.92);
    c.beginPath(); c.roundRect(-9, 0, 160, 28, 2); c.fill();
    c.beginPath(); c.arc(0, 14, 3.2, 0, TAU); c.fillStyle = '#131615'; c.fill();
    c.fillStyle = rgba('ink', 0.95);
    c.font = font(this.fam.s6, 13); c.letterSpacing = '0.6px'; c.textAlign = 'left';
    c.fillText('DO NOT UNPATCH', 9, 19);
    c.letterSpacing = '0px';
    c.restore();
  }

  /** Lit lamps: the ignition (every lamp, bucketed fills) and the legend lamps in D (the dot). */
  private drawLit(c: CanvasRenderingContext2D, t: number, z: number, visP: (x: number, y: number, m: number) => boolean) {
    const w = this.wall;
    const NB = 10;
    const buckets: number[][] = Array.from({ length: NB }, () => []);
    const hot: number[] = [];
    if (t < this.tD) {
      for (let i = 0; i < w.lamps.length; i++) {
        const l = w.lamps[i]!;
        if (!visP(l.x, l.y, l.r)) continue;
        const I = this.hitI(i, t);
        if (I < 0.03) continue;
        buckets[Math.min(NB - 1, Math.floor(I * NB))]!.push(i);
        if (I > 0.55) hot.push(i);
      }
    }
    for (let b = 0; b < NB; b++) {
      const list = buckets[b]!;
      if (!list.length) continue;
      const I = (b + 0.5) / NB;
      c.beginPath();
      for (const i of list) { const l = w.lamps[i]!; const r = l.r * (l.pilot ? 1 : 1.05); c.moveTo(l.x + r, l.y); c.arc(l.x, l.y, r, 0, TAU); }
      c.fillStyle = rgba('signal', 0.25 + 0.75 * I);
      c.fill();
    }
    if (hot.length) {
      c.beginPath();
      for (const i of hot) { const l = w.lamps[i]!; const r = l.r * 0.55; c.moveTo(l.x + r, l.y); c.arc(l.x, l.y, r, 0, TAU); }
      c.fillStyle = rgba('ember', 0.9);
      c.fill();
    }
    // pilot lamps glow as the dot while the ignition is hot
    if (t < this.tD) {
      w.legends.forEach((lg) => {
        const I = this.hitI(lg.lamp, t);
        if (I > 0.05 && visP(lg.x, lg.y, 40)) dot2D(c, lg.x, lg.y, t, 1.2 * I, I, 0);
      });
      return;
    }
    // D: the twelve legend lamps
    const throb = t < this.tCollapse ? this.beatThrob(t) : 0;
    w.legends.forEach((lg, li) => {
      let I = this.legendI(li, t);
      if (I <= 0.01) return;
      const flare = t >= this.onT[li]! ? pulse(t, this.onT[li]!, 0.1) : 0;
      I *= 1 + 0.35 * throb;
      const l = w.lamps[lg.lamp]!;
      c.beginPath(); c.arc(l.x, l.y, l.r, 0, TAU);
      c.fillStyle = rgba('signal', clamp(0.35 + 0.65 * I) * clamp(I * 4)); c.fill();
      const thread = li === THREAD;
      let s = 0.95 + 0.25 * throb + 1.1 * flare;
      let a = Math.min(1.2, I + 0.6 * flare);
      if (thread && t >= this.tCollapse) {
        // the last lamp becomes the line: its dot flares and hands over to the composite's line
        const e = prog(t, this.tCollapse, this.tCollapse + 0.3);
        s *= 1 + 0.8 * e;
        a *= 1 - ease.inCubic(e);
      }
      dot2D(c, l.x, l.y, t, s, a, thread ? 0.35 : 0);
    });
  }
}

const COMP = /* glsl */ `
uniform sampler2D tex; uniform float squash, flatK, bodyK, lineX, lineHalf, lineY, hot, gain;
void main() {
  vec2 px = FRAG_PX;                       // logical px, y up
  float yc = 1080.0 - lineY;
  // CRT collapse: the frame squeezes vertically onto the line
  float sy = (px.y - yc) / max(squash, 1e-4) + yc;
  bool inside = sy >= 0.0 && sy <= 1080.0;
  vec4 s = inside ? texture(tex, vec2(vUv.x, sy / 1080.0)) : vec4(0.0);
  float yy = sy / 1080.0;
  vec3 ground = mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.090, 0.104, 0.100)), yy);
  if (!inside) ground = C_INK;
  // only the blue glows
  float h = smoothstep(0.25, 0.7, s.b - s.r * 1.3);
  vec3 col = mix(ground, s.rgb * (1.0 + hot * h * gain) * bodyK, s.a);
  // the line: the last lamp stretched to full width
  float dy = abs(px.y - yc);
  float dx = abs(px.x - lineX);
  float xin = 1.0 - smoothstep(lineHalf - 40.0, lineHalf + 2.0, dx);
  col += (C_SIGNAL * 2.2 * exp(-dy * dy / 3.0) + C_SIGNAL * 0.35 * exp(-dy / 10.0) + C_EMBER * 1.4 * exp(-dy * dy / 0.6)) * flatK * xin;
  fragColor = vec4(col, 1.0);
}`;
