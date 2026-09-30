// world2 ②: bone chart-recorder paper. The bus waveform (blue) and the four generators' (ink) are
// written by a row of pens as the paper runs; each sung word is one notch: every unit's phase steps
// closer to the bus's and swings (a damped power swing). On the lock all five traces are one line:
// the sync point, a blue dot, is the plate's maximal hit (and the thread object). The recorder's
// printhead stamps the words at their notches. After a wide reframe the fine print types beside the dot.
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, frameIdx, lerp, prog, pulse, springStep, TAU } from '../engine/util';
import { dot2D, burst2D } from './_power';
import { type Cam, type Timing, applyCam, w2s, camAt, upper } from './grid-kit';
import { SLD, ZEND } from './grid-sld';

/** Paper geometry (world px, y down, the axis at y = 0): one cycle per P, amplitude A (A/P = the tilde's). */
export const CH = { P: 240, A: 72, strip: 300, cell: 24 };
const PH0 = [1.25, -0.95, 0.62, -1.5];
const SLIP = [0.35, -0.28, 0.22, -0.4];
const FINE = '50.000 Hz ± 0.2 · ALL UNITS IN SYNC';
const Z0 = (ZEND * SLD.tilW) / CH.P; // zoom at the cut: one period = 1120 px
const ZF = 1.45, ZR = 0.95;
const PEN = { x: 1330, y: 590 };
const WORD_F = F.archivo(87.5, 700), WORD_S = 34;
const STAMP_F = F.archivo(62, 900), STAMP_S = 104;

export class Chart {
  v: number;
  constructor(public T: Timing) { this.v = CH.P / T.beat; }
  /** Pen position (paper u) at time t; the paper coordinate written at time tau. */
  u(t: number) { return this.v * (t - this.T.cutB); }
  tau(u: number) { return this.T.cutB + u / this.v; }

  /** Fraction of each unit's phase error left at writing time tau (1 → 0 at the lock). */
  g(tau: number) {
    const N = this.T.notches, n = N.length;
    let g = 1;
    for (let k = 0; k < n; k++) g -= (1 / (n + 1)) * springStep(tau - N[k]!, 6.5, 0.5);
    return g * (1 - ease.outExpo(clamp((tau - this.T.tLock) / 0.05)));
  }
  phase(i: number, tau: number) {
    const n0 = this.T.notches[0] ?? this.T.tLock;
    return PH0[i]! * this.g(tau) + (tau < n0 ? SLIP[i]! * (tau - n0) : 0);
  }
  /** Trace i (−1 = the bus) at paper u. */
  y(i: number, u: number) {
    const ph = i < 0 ? 0 : this.phase(i, this.tau(u));
    return -CH.A * Math.sin((TAU * u) / CH.P + ph);
  }

  punch(t: number) {
    let p = 0;
    for (const tn of this.T.notches) p = Math.max(p, pulse(t, tn, 0.08));
    return p;
  }

  /** The dot's screen position under the chase camera at the lock (the post-lock camera pins it there). */
  private lockScreen() {
    const T = this.T;
    const k = camAt(this.u(T.tLock - 0.035), 0, PEN.x, PEN.y, ZF, 0);
    return w2s(k, this.u(T.tLock), 0);
  }

  cam(t: number): Cam {
    const T = this.T;
    const uL = this.u(T.tLock);
    if (t < T.tLock) {
      const e = ease.outExpo(prog(t, T.cutB, T.cutB + 0.3));
      const z = Math.exp(lerp(Math.log(Z0), Math.log(ZF), e)) * (1 + 0.025 * this.punch(t));
      return camAt(this.u(t - 0.035 * e), 0, lerp(1520, PEN.x, e), lerp(540, PEN.y, e), z, 0);
    }
    if (t < T.tR) {
      const s = this.lockScreen();
      return camAt(uL, 0, s.x, s.y, ZF * (1 + 0.16 * ease.outExpo(prog(t, T.tLock, T.tLock + 0.3))), 0);
    }
    // hard reframe on the beat: wide, the braid's history to the left, the dot, the pen running on
    const sR = { x: 1000, y: 560 };
    const zR = ZR * (1 + 0.05 * prog(t, T.tR, T.cutC, ease.inOutQuad));
    if (t < T.cutC) return camAt(uL, 0, sR.x, sR.y, zR, 0);
    // ③: pan the dot to the centre, +10%
    const k = prog(t, T.cutC, (T.w3[0]?.start ?? T.cutC) + 0.25, ease.inOutCubic);
    return camAt(uL, 0, lerp(sR.x, W / 2, k), lerp(sR.y, H / 2, k), zR * (1 + 0.1 * k), 0);
  }

  /** dark: 0 paper … 1 black (③'s flip: ink lines become faint light); a: overall opacity. */
  draw(c: CanvasRenderingContext2D, t: number, cam: Cam, dark = 0, a = 1, ta = a) {
    const T = this.T;
    const hx = 1 / cam.z;
    const uPen = this.u(t);
    const uLock = this.u(T.tLock);
    const inkA = (al: number) => (dark > 0 ? `rgba(${Math.round(lerp(10, 205, dark))},${Math.round(lerp(10, 200, dark))},${Math.round(lerp(11, 190, dark))},${al * a * lerp(1, 0.32, dark)})` : rgba('ink', al * a));
    const x0 = cam.x - W / 2 / cam.z - 30, x1 = Math.min(cam.x + W / 2 / cam.z + 30, uPen);
    c.save();
    applyCam(c, cam);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // ---- printed header in the top margin, every 1440 u
    c.font = font(F.mono(500), 15);
    c.textAlign = 'left';
    c.fillStyle = inkA(0.55);
    for (let k = Math.floor(x0 / 1440) - 1; k <= Math.ceil((x0 + W / cam.z) / 1440); k++) {
      c.fillText('BUS A 400 kV · G1–G4 21 kV · 50 Hz · 1 div = 2 ms · 5 CH', k * 1440 + 30, -CH.strip - 12);
    }
    // cycle ticks and counts along the bottom margin
    c.fillStyle = inkA(0.45);
    c.font = font(F.mono(400), 13);
    for (let k = Math.floor(x0 / CH.P); k <= Math.ceil(x1 / CH.P); k++) {
      const x = k * CH.P;
      c.fillRect(x - 0.6 * hx, CH.strip, 1.2 * hx, 12);
      if (k % 2 === 0) c.fillText(`${(1200 + k).toLocaleString('en-US')}`, x + 4, CH.strip + 24);
    }

    // ---- notch marks: a tick in the top margin, a dashed line down through the braid, the word
    const words = T.w2;
    T.notches.forEach((tn, k) => {
      if (t < tn) return;
      const un = this.u(tn);
      c.strokeStyle = inkA(0.55); c.lineWidth = 1.2 * hx;
      c.beginPath(); c.moveTo(un, -CH.strip); c.lineTo(un, -CH.strip + 16); c.stroke();
      c.setLineDash([5 * hx, 5 * hx]);
      c.strokeStyle = inkA(0.3);
      c.beginPath(); c.moveTo(un, -CH.strip + 18); c.lineTo(un, CH.A + 24); c.stroke();
      c.setLineDash([]);
      const w = words[k];
      if (w && k < words.length - 1) {
        const s = upper(w.w);
        const p = Lyrics.wordProgress(w, t);
        const y = -CH.strip + 38 + (k % 3) * 34;
        const sc = 1 + 0.3 * Math.exp(-(t - tn) / 0.04);
        c.save();
        c.translate(un + 6, y);
        c.scale(sc, sc);
        c.font = font(WORD_F, WORD_S);
        c.fillStyle = p < 1 && dark < 0.5 ? rgba('signal', ta) : inkA(0.92 * ta / Math.max(1e-3, a));
        c.fillText(s, 0, 0);
        c.restore();
      }
    });

    // ---- traces: four units in ink, the bus in blue, written up to the pen (at the match cut only the
    // bus: the units' traces come up during the reveal)
    const step = Math.max(1.2, 2.2 * hx);
    const rev = prog(t, T.cutB, T.cutB + 0.3);
    const unitA = prog(t, T.cutB + 0.03, T.cutB + 0.16);
    if (x1 > x0) {
      for (let i = 0; i < 4 && unitA > 0; i++) {
        c.beginPath();
        for (let u = x0; u <= x1 + step * 0.5; u += step) {
          const uu = Math.min(u, x1), y = this.y(i, uu);
          if (u === x0) c.moveTo(uu, y); else c.lineTo(uu, y);
        }
        c.strokeStyle = inkA(0.8 * unitA); c.lineWidth = 1.8 * hx;
        c.stroke();
      }
      c.beginPath();
      for (let u = x0; u <= x1 + step * 0.5; u += step) {
        const uu = Math.min(u, x1), y = this.y(-1, uu);
        if (u === x0) c.moveTo(uu, y); else c.lineTo(uu, y);
      }
      c.strokeStyle = rgba('signal', a * (1 - 0.3 * dark)); c.lineWidth = lerp(7, 3, ease.outCubic(rev)) * hx;
      c.stroke();
    }

    // ---- the pens: a carriage hairline across the strip, five tips on their traces
    if (uPen > x0 - 50 && uPen < x0 + W / cam.z + 100) {
      c.strokeStyle = inkA(0.4); c.lineWidth = 1 * hx;
      c.beginPath(); c.moveTo(uPen, -CH.strip); c.lineTo(uPen, CH.strip); c.stroke();
      // pen labels while the traces are still apart
      const spread = clamp((this.g(this.tau(uPen)) - 0.3) / 0.4);
      c.font = font(F.mono(600), 13 * hx);
      c.textBaseline = 'middle';
      for (let i = -1; i < 4; i++) {
        const y = this.y(i, uPen), s = 9 * hx;
        const al = i < 0 ? 1 : unitA;
        c.fillStyle = i < 0 ? rgba('signal', a) : inkA(0.9 * al);
        c.beginPath(); c.moveTo(uPen, y); c.lineTo(uPen + 2.2 * s, y - s); c.lineTo(uPen + 2.2 * s, y + s); c.closePath(); c.fill();
        if (spread * al > 0.01) { c.fillStyle = i < 0 ? rgba('signal', spread * a) : inkA(0.7 * spread * al); c.fillText(i < 0 ? 'BUS' : `G${i + 1}`, uPen + 2.2 * s + 8 * hx, y); }
      }
      c.textBaseline = 'alphabetic';
    }

    // ---- COOPERATE: a faint guide ahead of the pen while it is sung; stamped on the lock
    const lw = words[words.length - 1];
    if (lw && t >= lw.start - 0.05) {
      const s = upper(lw.w);
      const wd = measure(s, STAMP_F, STAMP_S);
      const p = Lyrics.wordProgress(lw, t);
      const stamped = t >= T.tLock;
      const sc = stamped ? 1 + 0.25 * Math.exp(-(t - T.tLock) / 0.05) : 1;
      const base = -CH.A - 26;
      c.save();
      c.translate(uLock, base);
      c.scale(sc, sc);
      c.font = font(STAMP_F, STAMP_S);
      c.textAlign = 'left';
      c.fillStyle = stamped ? inkA(0.94 * ta / Math.max(1e-3, a)) : inkA(0.14 * ta / Math.max(1e-3, a));
      c.fillText(s, -wd / 2, 0);
      if (p > 0 && p < 1 && dark < 0.5) {
        c.save();
        c.beginPath(); c.rect(-wd / 2 - 4, -STAMP_S, wd * p + 4, STAMP_S * 1.3); c.clip();
        c.fillStyle = rgba('signal', a); c.fillText(s, -wd / 2, 0);
        c.restore();
      }
      c.restore();
    }

    // ---- the sync line and the fine print (after the reframe)
    if (t >= T.tLock) {
      const la = (0.55 + 0.45 * Math.exp(-(t - T.tLock) / 0.2)) * a;
      c.strokeStyle = rgba('signal', la); c.lineWidth = 1.4 * hx;
      c.beginPath(); c.moveTo(uLock, -CH.strip); c.lineTo(uLock, CH.strip); c.stroke();
    }
    if (t >= T.tR) {
      const n = Math.floor(FINE.length * prog(t, T.tR + 0.04, T.tR + 0.55));
      const fx = uLock + 40, fy = CH.A + 96;
      c.strokeStyle = inkA(0.7); c.lineWidth = 1.2 * hx;
      c.beginPath(); c.moveTo(uLock + 10, 10); c.lineTo(fx - 6, fy - 14); c.lineTo(fx + 640, fy - 14); c.stroke();
      c.font = font(F.mono(600), 30);
      c.fillStyle = inkA(0.92 * ta / Math.max(1e-3, a));
      c.fillText(FINE.slice(0, n), fx, fy + 22);
      if (n < FINE.length && frameIdx(t) % 16 < 9) c.fillRect(fx + measure(FINE.slice(0, n), F.mono(600), 30) + 3, fy, 16, 30);
    }
    c.restore();

    // ---- the dot: the sync point (screen space)
    if (t >= T.tLock) {
      const p = w2s(cam, uLock, 0);
      burst2D(c, p.x, p.y, t, T.tLock, { n: 110, speed: 1500, life: 0.5, seed: 21 });
      dot2D(c, p.x, p.y, t, (1.2 + 1.8 * pulse(t, T.tLock, 0.1)) * Math.min(1.4, cam.z * 1.3), a, 0.35);
    }
  }
}
