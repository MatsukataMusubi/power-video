// world2 ④: an electricity meter's register after the white flash. The counter wheels are spinning;
// each sung word of the hook's repeat lands on one wheel (a thunk, the word printed on its drum), the
// camera tracking the landings; the blue tenths wheel ticks one step per word and stops on 7 with the
// last one: 0.7 kWh, 700 W for an hour (hook2's value). Then the camera centres the tenths wheel, the
// meter goes dark and its window closes to a small round aperture: the patch bay's first jack.
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse, TAU } from '../engine/util';
import { HANDOFF } from './_power';
import { type Cam, type Timing, applyCam, camAt, w2s, upper } from './grid-kit';

const WF = F.archivo(62, 900), WS = 104, CAPH = WS * 0.686;
const WIN_H = 150, GAP = 34, TEN_W = 108, DOT_GAP = 44, PAD = 60;
const CELL = 11; // word wheels: 0–9 and the word
const SPIN = 13; // cells per second while spinning

interface Wheel { x: number; w: number; label: string; t: number; p0: number }

export class Meter {
  wheels: Wheel[] = [];
  ten = { x: 0, w: TEN_W };
  kwhX = 0;
  /** The whole register: its centre and the zoom that fits it (the lock's framing). */
  midX = 0; fitZ = 1;
  constructor(public T: Timing) {
    const ws = T.w4;
    const widths = ws.map((w) => measure(upper(w.w), WF, WS) + PAD);
    const total = widths.reduce((a, b) => a + b, 0) + GAP * (ws.length - 1) + DOT_GAP + TEN_W + 150;
    let x = -total / 2;
    ws.forEach((w, i) => {
      const wd = widths[i]!;
      this.wheels.push({ x: x + wd / 2, w: wd, label: upper(w.w), t: Math.max(w.start, T.cutD + 0.03), p0: 3.7 * i + 1.3 });
      x += wd + GAP;
    });
    x += DOT_GAP - GAP;
    this.ten.x = x + TEN_W / 2;
    this.kwhX = x + TEN_W + 26;
    const left = this.wheels[0]!.x - this.wheels[0]!.w / 2 - 70, right = this.kwhX + 150;
    this.midX = (left + right) / 2;
    this.fitZ = Math.min(1.2, 1800 / (right - left));
  }

  /** Word wheel i's drum position (cells; the word sits at 10 mod 11): spinning, then a thunk onto its word. */
  pos(i: number, t: number) {
    const wh = this.wheels[i]!;
    const spin = (tt: number) => wh.p0 + SPIN * (tt - this.T.cutD);
    if (t < wh.t) return spin(t);
    const pl = spin(wh.t);
    const land = Math.ceil((pl + 1.4 - 10) / CELL) * CELL + 10;
    return lerp(pl, land, ease.outBack(clamp((t - wh.t) / 0.14), 1.6));
  }
  /** The tenths wheel: 3 on arrival, one tick per word, 7 on the last. */
  tenPos(t: number) {
    let p = 3;
    for (const wh of this.wheels) p += ease.outBack(clamp((t - wh.t) / 0.1), 1.4);
    return p;
  }

  focusX(t: number) {
    const T = this.T, n = this.wheels.length;
    let x = this.wheels[0]!.x;
    for (let i = 1; i < n - 1; i++) x = lerp(x, this.wheels[i]!.x, ease.outExpo(clamp((t - this.wheels[i]!.t) / 0.2)));
    x = lerp(x, this.midX, ease.outExpo(clamp((t - T.tLockD) / 0.12)));
    return lerp(x, this.ten.x, ease.outExpo(clamp((t - (T.tLockD + 0.2)) / 0.14)));
  }

  cam(t: number): Cam {
    const T = this.T, n = this.wheels.length;
    let z = lerp(2.6, 2.3, ease.outExpo(prog(t, T.cutD, T.cutD + 0.25)));
    for (let i = 1; i < n - 1; i++) z = lerp(z, lerp(2.3, 1.5, i / Math.max(1, n - 2)), ease.outExpo(clamp((t - this.wheels[i]!.t) / 0.2)));
    z *= 1 - 0.05 * prog(t, this.wheels[Math.min(1, n - 1)]!.t + 0.2, T.tLockD, ease.inOutQuad);
    z = lerp(z, this.fitZ, ease.outExpo(clamp((t - T.tLockD) / 0.12)));
    z = lerp(z, 1.55, ease.outExpo(clamp((t - (T.tLockD + 0.2)) / 0.14)));
    z *= 1 + 0.03 * pulse(t, T.tLockD, 0.08);
    return camAt(this.focusX(t), 0, W / 2, H / 2, z, 0);
  }

  /** The drum in a window: cells rolled past a cylinder; ghosts while spinning. */
  private drum(c: CanvasRenderingContext2D, x: number, w: number, pos: number, cells: number, label: (m: number) => string, face: 'bone' | 'blue', hot: boolean, blur: number) {
    const h = WIN_H;
    const R = (h * cells) / TAU / 1.05;
    const dth = TAU / cells;
    c.save();
    c.beginPath(); c.rect(x - w / 2, -h / 2, w, h); c.clip();
    // face: a lit cylinder
    const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
    if (face === 'bone') {
      g.addColorStop(0, '#2a2825'); g.addColorStop(0.2, '#bdb8ae'); g.addColorStop(0.5, '#efeae0'); g.addColorStop(0.8, '#bdb8ae'); g.addColorStop(1, '#2a2825');
    } else {
      g.addColorStop(0, '#07112e'); g.addColorStop(0.22, '#1f45d8'); g.addColorStop(0.5, '#2f5bff'); g.addColorStop(0.78, '#1f45d8'); g.addColorStop(1, '#07112e');
    }
    c.fillStyle = g; c.fillRect(x - w / 2, -h / 2, w, h);
    c.font = font(WF, WS);
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    const copies = blur > 0.05 ? 3 : 1;
    for (let q = 0; q < copies; q++) {
      const pp = pos + (copies > 1 ? (q - 1) * 0.16 * blur : 0);
      const j0 = Math.floor(pp) - 1;
      for (let j = j0; j <= j0 + 3; j++) {
        const th = (j - pp) * dth;
        if (Math.abs(th) > 1.25) continue;
        const cs = Math.cos(th), y = R * Math.sin(th);
        const m = ((j % cells) + cells) % cells;
        c.save();
        c.translate(x, y);
        c.scale(1, cs);
        const ink = face === 'blue' ? 'rgba(8,10,20,' : hot ? 'rgba(47,91,255,' : 'rgba(12,12,13,';
        c.fillStyle = `${ink}${(copies > 1 ? 0.42 : 0.95) * Math.min(1, cs * 1.4)})`;
        c.fillText(label(m), 0, CAPH / 2);
        c.restore();
      }
    }
    // engraved latitude lines toward the drum's edges, and the window's lip shadows
    c.strokeStyle = 'rgba(10,10,11,0.35)'; c.lineWidth = 1;
    for (let k = 0; k < 7; k++) { const yy = h / 2 - 3 - k * k * 0.9; c.beginPath(); c.moveTo(x - w / 2, yy); c.lineTo(x + w / 2, yy); c.moveTo(x - w / 2, -yy); c.lineTo(x + w / 2, -yy); c.stroke(); }
    const sh = c.createLinearGradient(0, -h / 2, 0, -h / 2 + 26);
    sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh; c.fillRect(x - w / 2, -h / 2, w, 26);
    c.restore();
    // bevel
    c.strokeStyle = 'rgba(8,8,9,0.95)'; c.lineWidth = 7;
    c.strokeRect(x - w / 2 - 3.5, -h / 2 - 3.5, w + 7, h + 7);
    c.strokeStyle = rgba('ash', 0.55); c.lineWidth = 1.2;
    c.strokeRect(x - w / 2 - 7.5, -h / 2 - 7.5, w + 15, h + 15);
  }

  draw(c: CanvasRenderingContext2D, t: number, cam: Cam) {
    const T = this.T;
    const tE = T.tLockD + 0.2;
    const out = prog(t, tE + 0.08, T.e0 - 0.1, ease.inQuad); // the meter goes dark
    const iris = prog(t, T.e0 - 0.2, T.e0 - 0.012, ease.inOutCubic);
    c.save();
    applyCam(c, cam);
    // ---- faceplate
    c.fillStyle = '#131516';
    c.fillRect(-2600, -1400, 5200, 2800);
    c.strokeStyle = 'rgba(40,44,43,0.8)'; c.lineWidth = 1;
    for (let y = -1400; y < 1400; y += 5) { c.beginPath(); c.moveTo(-2600, y); c.lineTo(2600, y + 900); c.stroke(); }
    const x0 = this.wheels[0]!.x - this.wheels[0]!.w / 2 - 70, x1 = this.kwhX + 150;
    c.fillStyle = '#0b0c0d';
    c.fillRect(x0, -WIN_H / 2 - 36, x1 - x0, WIN_H + 72);
    c.strokeStyle = rgba('ash', 0.5); c.lineWidth = 1.4;
    c.strokeRect(x0, -WIN_H / 2 - 36, x1 - x0, WIN_H + 72);
    // engraving
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.font = font(F.mono(500), 22); c.fillStyle = rgba('bone', 0.62);
    c.fillText('SINGLE-PHASE KILOWATT-HOUR METER', x0, -WIN_H / 2 - 70);
    c.textAlign = 'right';
    c.fillText('No. 0000700', x1, -WIN_H / 2 - 70);
    c.textAlign = 'left';
    c.font = font(F.mono(400), 19); c.fillStyle = rgba('ash', 0.8);
    c.fillText('230 V   10(60) A   50 Hz   375 rev/kWh   CL. 2', x0, WIN_H / 2 + 84);
    c.font = font(F.archivo(100, 700), 66); c.fillStyle = rgba('bone', 0.85);
    c.fillText('kWh', this.kwhX, CAPH / 2 - 2);
    // multipliers under the windows
    c.font = font(F.mono(500), 16); c.fillStyle = rgba('ash', 0.75); c.textAlign = 'center';
    this.wheels.forEach((wh, i) => c.fillText(`×${(10 ** (this.wheels.length - 1 - i)).toLocaleString('en-US')}`, wh.x, WIN_H / 2 + 28));
    c.fillText('×0.1', this.ten.x, WIN_H / 2 + 28);
    // decimal point
    c.fillStyle = rgba('bone', 0.9);
    c.beginPath(); c.arc(this.ten.x - TEN_W / 2 - DOT_GAP / 2, WIN_H / 2 - 16, 7, 0, TAU); c.fill();
    // the rotor disc's edge through its slot: the mark goes by once a beat
    const sx = -300, sw = 600, sy = WIN_H / 2 + 118;
    c.fillStyle = '#050606'; c.fillRect(sx, sy, sw, 30);
    c.fillStyle = 'rgba(200,196,188,0.55)'; c.fillRect(sx + 4, sy + 10, sw - 8, 10);
    const ph = ((this.T.s0 + (t - this.T.s0)) / this.T.beat) % 1;
    const mx = sx + sw - ((ph * (sw + 80)) % (sw + 80));
    c.fillStyle = '#0a0a0b'; c.fillRect(mx - 20, sy + 10, 40, 10);
    c.strokeStyle = rgba('ash', 0.5); c.lineWidth = 1.2; c.strokeRect(sx, sy, sw, 30);

    // ---- word wheels
    this.wheels.forEach((wh, i) => {
      const w = T.w4[i]!;
      const p = this.pos(i, t);
      const sung = Lyrics.wordProgress(w, t);
      const spinning = t < wh.t;
      this.drum(c, wh.x, wh.w, p, CELL, (m) => (m < 10 ? String(m) : wh.label), 'bone', sung > 0 && sung < 1 && !spinning, spinning ? 1 : 0);
    });
    c.restore();

    // ---- lights out: the meter goes dark to the bare graphite ground, all but the tenths window
    if (out > 0) { c.fillStyle = `rgba(17,20,19,${Math.min(1, out)})`; c.fillRect(0, 0, W, H); }

    // ---- the tenths wheel (blue), its window closing to the jack
    const tc = w2s(cam, this.ten.x, 0);
    const J = HANDOFF.jack;
    const ww = lerp(TEN_W * cam.z, 2 * J.r, iris), hh = lerp(WIN_H * cam.z, 2 * J.r, iris);
    const cx = lerp(tc.x, J.x, iris), cy = lerp(tc.y, J.y, iris);
    const rr = lerp(4 * cam.z, J.r, iris);
    c.save();
    c.beginPath(); c.roundRect(cx - ww / 2, cy - hh / 2, ww, hh, rr); c.clip();
    c.translate(cx, cy);
    const sc = lerp(cam.z, cam.z * 0.5, iris);
    c.scale(sc, sc);
    this.drum(c, 0, TEN_W, this.tenPos(t), 10, (m) => String(m), 'blue', false, 0);
    c.restore();
    // the lamp behind the tenths wheel goes out: the window is left a dark hole (the jack's)
    const hole = prog(t, T.e0 - 0.12, T.e0 - 0.015, ease.inQuad);
    if (hole > 0) {
      c.fillStyle = `rgba(3,4,4,${hole})`;
      c.beginPath(); c.roundRect(cx - ww / 2, cy - hh / 2, ww, hh, rr); c.fill();
      c.strokeStyle = `rgba(92,94,90,${hole})`; c.lineWidth = 1.4;
      c.beginPath(); c.arc(cx, cy, rr * 0.72, 0, TAU); c.stroke();
    }
    c.strokeStyle = rgba('bone', lerp(0.55, 0.85, iris)); c.lineWidth = lerp(1.2, 2, iris);
    const o = lerp(1, -0.5, iris);
    c.beginPath(); c.roundRect(cx - ww / 2 - o, cy - hh / 2 - o, ww + 2 * o, hh + 2 * o, rr + o); c.stroke();
  }
}
