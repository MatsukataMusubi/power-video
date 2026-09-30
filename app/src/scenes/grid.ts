// WORLD2 (chorus 2 after the hook): the power grid in four movements. Structure: P(doom)'s ascent,
// move for move (docs/PDOOM-STRUCTURE.md): four short movements, each a new material, joined by a
// match cut, a paper-to-black flip and a collapse-to-point white flash; each steps up per word and
// releases on one impact; cuts on the beat. Idea: "cooperate": in one synchronous grid every
// generator turns at the same frequency or it is tripped off; cooperation as physics.
//   ① the single-line diagram grows from hook2's line (the busbar); each sung word closes a breaker;
//     the last one releases, and the camera dives into that generator's tilde (grid-sld.ts)
//   ② match cut: the tilde is the bus waveform on bone chart paper; four generators' traces step into
//     phase notch by notch; on the lock they are one line, the blue sync point (grid-chart.ts)
//   ③ the paper goes black; the network lights up at night around the dot, word by word; it collapses
//     into the dot with a white flash (grid-net.ts)
//   ④ the meter's register: the hook's repeat lands on the wheels, one word per wheel; the tenths wheel
//     stops on 7 (0.7 kWh); its window closes to the patch bay's first jack (grid-meter.ts)
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { norm, type Line } from '../engine/lyrics';
import { noise1, prog, pulse } from '../engine/util';
import { type Timing, makeGround, setGround, camAt, w2s } from './grid-kit';
import { camA, diveA, drawA } from './grid-sld';
import { Chart, CH } from './grid-chart';
import { Net } from './grid-net';
import { Meter } from './grid-meter';

type Mv = 'A' | 'B' | 'C' | 'D';

export default class Grid extends Scene {
  L = new Layer2D();
  lb = new LineBatch(30000, { blend: 'add' });
  ground!: FSPass;
  T!: Timing;
  chart!: Chart;
  net!: Net;
  meter!: Meter;

  override init() {
    const { lyrics: ly, audio: au, start: s0, end: e0 } = this.ctx;
    const b0 = Math.floor(au.beatAt(s0 + 0.01));
    const beat = au.timeOfBeat(b0 + 1) - au.timeOfBeat(b0);
    const snap = (t: number, tol = 0.1) => { const b = au.nearestBeat(t); return Math.abs(b - t) <= tol ? b : t; };
    // the two lines in the window: the chorus line after the hook, then the hook's repeat
    const ls = ly.lines.filter((l) => l.start >= s0 - 0.3 && l.start < e0 - 0.3);
    const l1: Line | undefined = ls[0];
    const l2: Line | undefined = ls.slice(1).find((l) => /appreciate/i.test(l.text)) ?? ls[1];
    if (!l1 || !l2 || l1.words.length < 2 || l2.words.length < 2) throw new Error('world2: expected two lines in the window');
    // line 1 splits at its middle: ① the first half (breakers), ② the second (notches, the last word locks)
    const mid = (l1.start + l1.end) / 2;
    let iB = l1.words.findIndex((w) => w.start >= mid);
    if (iB <= 0) iB = Math.ceil(l1.words.length / 2);
    const w1 = l1.words.slice(0, iB), w2 = l1.words.slice(iB);
    const cutB = snap(w2[0]!.start);
    const last = w2[w2.length - 1]!;
    let tLock = snap(last.start + 0.45 * (last.end - last.start), 0.2);
    if (tLock < last.start + 0.08) tLock = last.start + 0.2;
    const notches = w2.slice(0, -1).map((w) => w.start);
    notches.push(last.start);
    if (tLock - last.start > 0.22) notches.push(last.start + (tLock - last.start) / 2);
    const nts = notches.filter((x) => x > cutB - 0.05 && x < tLock - 0.05);
    // line 2 splits at its second "we": ③ the first half, ④ the rest (one word per wheel)
    const cutC = snap(l2.words[0]!.start);
    let iD = l2.words.findIndex((w, i) => i > 0 && norm(w.w) === 'we');
    if (iD <= 0) iD = Math.min(3, l2.words.length - 1);
    const w3 = l2.words.slice(0, iD), w4 = l2.words.slice(iD);
    const cutD = snap(w4[0]!.start);
    let tR = au.timeOfBeat(Math.ceil(au.beatAt(tLock + 0.4)));
    if (tR > cutC - 0.3) tR = cutC;
    this.T = {
      s0, e0, beat, w1, w2, w3, w4, cutB, cutC, cutD,
      tImpA: w1[w1.length - 1]!.start,
      notches: nts, tLock, tR,
      tLockD: snap(w4[w4.length - 1]!.start, 0.06),
    };
    this.ground = makeGround(this.L.texture);
    this.chart = new Chart(this.T);
    this.net = new Net(this.T);
    this.meter = new Meter(this.T);
  }

  movement(t: number): Mv {
    const T = this.T;
    return t < T.cutB ? 'A' : t < T.cutC ? 'B' : t < T.cutD ? 'C' : 'D';
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    switch (this.movement(f.t)) {
      case 'A': return this.renderA(f, out);
      case 'B': return this.renderB(f, out);
      case 'C': return this.renderC(f, out);
      default: return this.renderD(f, out);
    }
  }

  private shake(t: number, amp: number, ax = 1, ay = 0.75): [number, number] {
    return amp > 0.05 ? [noise1(t * 60, 11) * amp * ax, noise1(t * 60, 12) * amp * ay] : [0, 0];
  }

  // ------------------------------------------------------------------ ① the single-line diagram
  renderA(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = this.T, t = f.t;
    const cam = camA(T, t);
    const L = this.L; L.clear();
    drawA(L.ctx, T, t, cam);
    L.upload();
    const dive = diveA(T, t);
    const tG = T.s0 + T.beat / 2;
    // frame 1 is hook2's last frame: ink ground, the plain blue line; the drafting ground comes up with the bays
    const up = prog(t, tG - 0.05, tG + 0.3);
    setGround(this.ground, cam, { darkGrid: up * (1 - dive), hot: 1.2 * up, black: Math.max(1 - up, dive * 0.6) });
    this.ground.render(this.ctx.renderer, out);
    let sh = 0;
    for (const w of T.w1.slice(0, -1)) sh = Math.max(sh, 4 * pulse(t, w.start, 0.05));
    sh = Math.max(sh, 12 * pulse(t, T.tImpA, 0.07));
    const still = t < T.w1[0]!.start - 0.1; // the hand-off frame stays exactly where hook2 left the line
    return {
      bloom: 0.6 + 0.1 * up, bloomThreshold: 1.0, bloomKnee: 0.2 + 0.1 * up, vignette: 0.45, grain: 0.05,
      ca: still ? 0.5 : 1.0 + 2.5 * dive, shake: still ? [0, 0] : this.shake(t, sh),
    };
  }

  // ------------------------------------------------------------------ ② the chart recorder
  renderB(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = this.T, t = f.t;
    const cam = this.chart.cam(t);
    const L = this.L; L.clear();
    this.chart.draw(L.ctx, t, cam);
    L.upload();
    setGround(this.ground, cam, { paper: 1, hot: 0.5, cell: [CH.cell, CH.cell, CH.cell * 5, CH.cell * 3], strip: CH.strip });
    this.ground.render(this.ctx.renderer, out);
    const hit = t >= T.tLock ? Math.exp(-(t - T.tLock) / 0.12) : 0;
    const punch = this.chart.punch(t);
    return {
      paper: 1, bloom: 0.55, bloomThreshold: 1.0, bloomKnee: 0.3, vignette: 0.3, grain: 0.05,
      shake: [Math.sin(t * 97) * 30 * hit + noise1(t * 60, 3) * 5 * punch, Math.cos(t * 83) * 22 * hit + noise1(t * 60, 4) * 4 * punch],
      flash: 0.3 * pulse(t, T.cutB, 0.04) + 0.2 * pulse(t, T.tLock, 0.05),
      ca: 1.0 + 7 * hit, zoom: 1 + 0.06 * hit,
    };
  }

  // ------------------------------------------------------------------ ③ the network at night
  renderC(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = this.T, t = f.t;
    const cam = this.chart.cam(t);
    const dark = prog(t, T.cutC, T.cutC + 0.12);
    const L = this.L; L.clear();
    const c = L.ctx;
    this.chart.draw(c, t, cam, dark, 1 - 0.85 * prog(t, T.cutC + 0.08, T.cutC + 0.4), 0);
    // the dot sits where the chart left it; the network is drawn around it in screen space
    const P = w2s(cam, this.chart.u(T.tLock), 0);
    const lb = this.lb; lb.clear();
    this.net.draw(lb, c, t, P, f.beatPhase);
    L.upload();
    setGround(this.ground, cam, { paper: 1 - dark, hot: 0.9, cell: [CH.cell, CH.cell, CH.cell * 5, CH.cell * 3], strip: CH.strip });
    this.ground.render(this.ctx.renderer, out);
    lb.render(this.ctx.renderer, out);
    const collapse = prog(t, T.cutD - 0.2, T.cutD);
    const bp = pulse(t, this.ctx.audio.timeOfBeat(Math.floor(this.ctx.audio.beatAt(t))), 0.1);
    return {
      paper: 1 - dark, bloom: 0.85, bloomThreshold: 0.95, bloomKnee: 0.4, vignette: 0.45, grain: 0.055,
      zoom: 1 + 0.02 * bp, ca: 1.2 + 2 * collapse,
      flash: 0.9 * pulse(t, T.cutD - 0.03, 0.05) * prog(t, T.cutD - 0.1, T.cutD),
    };
  }

  // ------------------------------------------------------------------ ④ the meter
  renderD(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = this.T, t = f.t;
    const cam = this.meter.cam(t);
    const L = this.L; L.clear();
    this.meter.draw(L.ctx, t, cam);
    L.upload();
    setGround(this.ground, camAt(0, 0, 960, 540, 1), { black: 1, hot: 0.9 });
    this.ground.render(this.ctx.renderer, out);
    const sh = pulse(t, T.tLockD, 0.07);
    let land = 0;
    for (const wh of this.meter.wheels.slice(0, -1)) land = Math.max(land, pulse(t, wh.t, 0.05));
    const end = t >= T.tLockD + 0.3;
    return {
      bloom: 0.7, bloomThreshold: 1.0, bloomKnee: 0.3, vignette: end ? 0.3 : 0.5, grain: 0.05,
      shake: end ? [0, 0] : [Math.sin(t * 90) * 18 * sh + noise1(t * 60, 5) * 5 * land, Math.cos(t * 70) * 12 * sh + noise1(t * 60, 6) * 4 * land],
      ca: end ? 0.5 : 1.2 + 3 * sh, zoom: end ? 1 : 1 + 0.02 * land,
      flash: 0.07 * sh + 0.3 * pulse(t, T.cutD, 0.035),
    };
  }
}

