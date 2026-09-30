// world2 ①: the single-line diagram. The busbar hook2 collapsed into is the first frame; generator bays
// drop from it on the first 8th (IEC symbols: disconnector, circuit breaker, two-winding transformer,
// generator), and each sung word, set on the bar above its bay, closes that bay's breaker. The last
// breaker is the release: the line bays close and the bus throws power off the top of the frame; then
// the camera dives into the last generator's tilde, which match-cuts to ②'s waveform.
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { Lyrics, type Word } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse, TAU } from '../engine/util';
import { HANDOFF, dot2D } from './_power';
import { type Cam, type Timing, applyCam, w2s, camAt, upper } from './grid-kit';

export const SLD = {
  busY: HANDOFF.bus.y, busW: HANDOFF.bus.w,
  pitch: 330,
  yDisc0: 526, yDisc1: 566, // disconnector: fixed contact (top) → pivot
  yCb0: 598, yCb1: 654, // circuit breaker: fixed contact with the × (top) → pivot
  yT1: 718, yT2: 756, rT: 26, // transformer windings
  yG: 866, rG: 58, // generator
  tilW: 56, tilA: 16.8, tilDy: 22, // the tilde (one sine period; amplitude/period = ②'s A/P)
  lineCb0: 386, lineCb1: 442, // line bays (upward): breaker, fixed contact on top
};
export const bayX = (i: number, n: number) => W / 2 + (i - (n - 1) / 2) * SLD.pitch;
export const tildeC = (i: number, n: number) => ({ x: bayX(i, n), y: SLD.yG + SLD.tilDy });
/** Zoom at the cut: the tilde spans 1120 px, one period of ②'s trace at its first frame. */
export const ZEND = 1120 / SLD.tilW;

const WORD_F = F.archivo(75, 900), WORD_S = 64;
const MONO = F.mono(500);

function lineBays(n: number) {
  if (n >= 3) return [(bayX(0, n) + bayX(1, n)) / 2, (bayX(n - 2, n) + bayX(n - 1, n)) / 2];
  return [bayX(0, n) - SLD.pitch / 2, bayX(n - 1, n) + SLD.pitch / 2];
}

/** ① camera: a step in (×1.075) and an alternating lean per sung word, then the release punch and the dive. */
export function camA(T: Timing, t: number): Cam {
  const n = T.w1.length;
  const leans = [-0.022, 0.016, -0.012, 0.009, -0.006, 0.004];
  let z = 1, r = 0, x = W / 2, y = H / 2, px = W / 2, py = H / 2, pr = 0;
  T.w1.forEach((w, i) => {
    const k = ease.outExpo(clamp((t - w.start) / 0.2));
    const tx = lerp(W / 2, bayX(i, n), 0.3), ty = H / 2 + 34 + 8 * i, tr = leans[i % leans.length]!;
    if (k > 0) { z *= Math.pow(1.075, k); x += k * (tx - px); y += k * (ty - py); r += k * (tr - pr); }
    px = tx; py = ty; pr = tr;
  });
  // the bays drop on the first 8th: the camera moves in on the diagram with them
  const tG = T.s0 + T.beat / 2;
  const g = ease.outExpo(prog(t, tG, tG + 0.35));
  z *= (1 + 0.14 * g) * (1 + 0.015 * prog(t, T.s0, T.tImpA));
  y += 46 * g;
  const steps: Cam = { x, y, z, r };
  if (t < T.tImpA) return steps;
  const tc = tildeC(n - 1, n);
  const tD0 = lerp(T.tImpA, T.cutB, 0.3);
  const z1 = steps.z * (1 + 0.12 * ease.outExpo(prog(t, T.tImpA, T.tImpA + 0.3)));
  const zz = Math.exp(lerp(Math.log(z1), Math.log(ZEND), prog(t, tD0, T.cutB, ease.inCubic)));
  const k = prog(t, T.tImpA, T.cutB - 0.05, ease.inOutCubic);
  const s0 = w2s(steps, tc.x, tc.y);
  return camAt(tc.x, tc.y, lerp(s0.x, W / 2, k), lerp(s0.y, H / 2, k), zz, lerp(steps.r, 0, k));
}

/** Dive progress (0 before the dive; 1 at the cut): everything but the last tilde dims. */
export const diveA = (T: Timing, t: number) => prog(t, lerp(T.tImpA, T.cutB, 0.3), T.cutB - 0.02);

function tildePath(c: CanvasRenderingContext2D, x: number, y: number) {
  const { tilW: w, tilA: a } = SLD;
  c.beginPath();
  for (let s = 0; s <= 48; s++) {
    const u = -w / 2 + (w * s) / 48;
    const yy = y + a * Math.sin((TAU * u) / w);
    if (s) c.lineTo(x + u, yy); else c.moveTo(x + u, yy);
  }
}

/** The word's karaoke state: 0 ghost, (0,1) being sung, 1 done. */
function drawWord(c: CanvasRenderingContext2D, w: Word, x: number, base: number, t: number, ghost: number) {
  const s = upper(w.w);
  const wd = measure(s, WORD_F, WORD_S);
  const p = Lyrics.wordProgress(w, t);
  c.font = font(WORD_F, WORD_S);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  const x0 = x - wd / 2;
  if (p <= 0) { c.fillStyle = rgba('bone', 0.2 * ghost); c.fillText(s, x0, base); return; }
  if (p >= 1) { c.fillStyle = rgba('bone', 0.94); c.fillText(s, x0, base); return; }
  c.fillStyle = rgba('bone', 0.2 * ghost); c.fillText(s, x0, base);
  c.save();
  c.beginPath(); c.rect(x0 - 4, base - WORD_S, wd * Math.min(1, 0.15 + p) + 4, WORD_S * 1.4); c.clip();
  c.fillStyle = rgba('signal', 1); c.fillText(s, x0, base);
  c.restore();
}

export function drawA(c: CanvasRenderingContext2D, T: Timing, t: number, cam: Cam) {
  const n = T.w1.length;
  const S = SLD;
  const tG = T.s0 + T.beat / 2; // the bays drop on the first 8th
  const dive = diveA(T, t);
  const rest = Math.pow(1 - dive, 3); // perceptual: the blend is linear, a few % of bone still reads on black
  const hx = 1 / cam.z; // one screen px in world units
  const bone = (a: number) => rgba('bone', a * rest);
  c.save();
  applyCam(c, cam);
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // ---- line bays (upward, to the network): closed on the release; power runs off the top
  const lb = lineBays(n);
  const upK = ease.outExpo(prog(t, tG + 0.08, tG + 0.36));
  const lineClose = ease.outExpo(prog(t, T.tImpA + 0.03, T.tImpA + 0.1));
  const upFront = ease.inQuad(prog(t, T.tImpA + 0.06, T.tImpA + 0.3));
  lb.forEach((x, j) => {
    if (upK <= 0) return;
    const top = lerp(S.busY, -400, upK);
    c.strokeStyle = bone(0.75); c.lineWidth = 2;
    c.beginPath(); c.moveTo(x, S.busY); c.lineTo(x, Math.max(top, S.lineCb1)); c.stroke();
    if (top < S.lineCb0) { c.beginPath(); c.moveTo(x, S.lineCb0); c.lineTo(x, top); c.stroke(); }
    if (top < S.lineCb0 - 6) {
      // breaker (open until the release): × on the fixed contact, blade from the pivot
      const th = 0.5 * (1 - lineClose), L = S.lineCb1 - S.lineCb0;
      c.strokeStyle = lineClose > 0.5 ? rgba('signal', rest) : bone(0.85); c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(x, S.lineCb1); c.lineTo(x - L * Math.sin(th) * (j ? -1 : 1), S.lineCb1 - L * Math.cos(th)); c.stroke();
      c.strokeStyle = bone(0.85); c.lineWidth = 1.6;
      const q = 6; c.beginPath(); c.moveTo(x - q, S.lineCb0 - q); c.lineTo(x + q, S.lineCb0 + q); c.moveTo(x + q, S.lineCb0 - q); c.lineTo(x - q, S.lineCb0 + q); c.stroke();
      c.font = font(MONO, 13); c.fillStyle = rgba('ash', 0.8 * rest); c.textAlign = 'left';
      c.fillText(`-Q${n + j + 1}`, x + 14, (S.lineCb0 + S.lineCb1) / 2 + 4);
      c.fillText(j ? '400 kV LINE  → EAST' : '400 kV LINE  → NORTH', x + 14, 250);
      // arrowhead: the line leaves the sheet
      c.strokeStyle = bone(0.7); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x - 7, 214); c.lineTo(x, 200); c.lineTo(x + 7, 214); c.stroke();
    }
    if (upFront > 0) {
      c.strokeStyle = rgba('signal', rest); c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(x, S.busY); c.lineTo(x, lerp(S.busY, -500, upFront)); c.stroke();
    }
  });

  // ---- the busbar (the handoff line: 3 px, full width)
  c.fillStyle = rgba('signal', 1);
  c.fillRect(-6000, S.busY - S.busW / 2, 14000, S.busW);
  // release: a surge runs out along the bus both ways
  if (t >= T.tImpA) {
    const e = t - T.tImpA, bx = bayX(n - 1, n);
    const a = Math.exp(-e / 0.18) * rest;
    for (const dir of [-1, 1]) {
      const d = 2600 * e;
      const g = c.createLinearGradient(bx + dir * d, 0, bx + dir * (d - 260), 0);
      g.addColorStop(0, `rgba(235,240,255,${a})`); g.addColorStop(0.3, rgba('signal', a)); g.addColorStop(1, rgba('signal', 0));
      c.fillStyle = g;
      c.fillRect(Math.min(bx + dir * d, bx + dir * (d - 260)), S.busY - 4, 260, 8);
    }
  }
  c.font = font(MONO, 13); c.fillStyle = rgba('ash', 0.75 * rest * prog(t, tG, tG + 0.2)); c.textAlign = 'left';
  c.fillText('BUS A · 400 kV · 50 Hz', bayX(0, n) - SLD.pitch * 0.62 - 150, S.busY + 22);

  // ---- generator bays
  for (let i = 0; i < n; i++) {
    const x = bayX(i, n), w = T.w1[i]!;
    const tg = tG + 0.035 * i;
    const gk = ease.outExpo(prog(t, tg, tg + 0.22));
    if (gk <= 0) continue;
    const bot = lerp(S.busY, S.yG + S.rG, gk);
    const tc = w.start; // the word closes the breaker
    const close = ease.outExpo(prog(t, tc, tc + 0.07));
    const front = ease.outCubic(prog(t, tc + 0.02, tc + 0.16)); // energisation runs down the bay
    const live = front >= 1;
    const last = i === n - 1;
    const segs: [number, number][] = [[S.busY, S.yDisc0], [S.yDisc1, S.yCb0], [S.yCb1, S.yT1 - S.rT], [S.yT2 + S.rT, S.yG - S.rG]];
    c.lineWidth = 2;
    for (const [a, b] of segs) {
      if (a >= bot) continue;
      c.strokeStyle = bone(0.82);
      c.beginPath(); c.moveTo(x, a); c.lineTo(x, Math.min(b, bot)); c.stroke();
      const fy = lerp(S.busY, S.yG - S.rG, front);
      if (front > 0 && fy > a) {
        c.strokeStyle = rgba('signal', rest); c.lineWidth = 2.6;
        c.beginPath(); c.moveTo(x, a); c.lineTo(x, Math.min(b, fy, bot)); c.stroke();
        c.lineWidth = 2;
      }
    }
    // junction on the bus
    c.fillStyle = close > 0.5 ? rgba('signal', 1) : bone(0.9);
    c.beginPath(); c.arc(x, S.busY, 4.5, 0, TAU); c.fill();
    const vis = (y: number) => (bot > y ? 1 : 0);
    // disconnector (closed): blade + the bar at the fixed contact
    if (vis(S.yDisc1)) {
      c.strokeStyle = front > 0.3 ? rgba('signal', rest) : bone(0.85); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, S.yDisc1); c.lineTo(x, S.yDisc0); c.stroke();
      c.strokeStyle = bone(0.85); c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(x - 8, S.yDisc0); c.lineTo(x + 8, S.yDisc0); c.stroke();
      c.fillStyle = bone(0.85); c.beginPath(); c.arc(x, S.yDisc1, 2.6, 0, TAU); c.fill();
    }
    // circuit breaker: the × on the fixed contact, the blade swings shut in 70 ms on the word
    if (vis(S.yCb1)) {
      const L = S.yCb1 - S.yCb0, th = 0.52 * (1 - close);
      c.strokeStyle = close > 0.6 ? rgba('signal', rest) : bone(0.95); c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(x, S.yCb1); c.lineTo(x - L * Math.sin(th), S.yCb1 - L * Math.cos(th)); c.stroke();
      c.strokeStyle = bone(0.9); c.lineWidth = 1.8;
      const q = 6.5; c.beginPath(); c.moveTo(x - q, S.yCb0 - q); c.lineTo(x + q, S.yCb0 + q); c.moveTo(x + q, S.yCb0 - q); c.lineTo(x - q, S.yCb0 + q); c.stroke();
      c.fillStyle = bone(0.9); c.beginPath(); c.arc(x, S.yCb1, 3, 0, TAU); c.fill();
      c.font = font(MONO, 13); c.fillStyle = rgba('ash', 0.8 * rest); c.textAlign = 'left';
      c.fillText(`-Q${i + 1}`, x + 16, (S.yCb0 + S.yCb1) / 2 + 5);
      // leader-line readout as it locks (gone within half a second)
      const ro = prog(t, tc, tc + 0.04) * (1 - prog(t, tc + 0.38, tc + 0.46));
      if (ro > 0) {
        c.strokeStyle = rgba('signal', ro * rest); c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x + 10, S.yCb0 + 4); c.lineTo(x + 34, S.yCb0 - 22); c.lineTo(x + 150, S.yCb0 - 22); c.stroke();
        c.fillStyle = rgba('signal', ro * rest); c.font = font(F.mono(600), 14);
        c.fillText('CLOSED', x + 38, S.yCb0 - 28);
      }
    }
    // step-up transformer
    if (vis(S.yT2 + S.rT)) {
      c.strokeStyle = live ? rgba('signal', rest) : bone(0.85); c.lineWidth = 2;
      c.beginPath(); c.arc(x, S.yT1, S.rT, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x, S.yT2, S.rT, 0, TAU); c.stroke();
      c.font = font(MONO, 13); c.fillStyle = rgba('ash', 0.8 * rest); c.textAlign = 'left';
      c.fillText(`-T${i + 1}  21/400 kV`, x + S.rT + 12, (S.yT1 + S.yT2) / 2 + 5);
    }
    // generator: circle, G, and the tilde (bone while it runs on its own; blue once on the bus)
    if (vis(S.yG + S.rG - 1)) {
      c.strokeStyle = bone(0.9); c.lineWidth = 2.2;
      c.beginPath(); c.arc(x, S.yG, S.rG, 0, TAU); c.stroke();
      c.fillStyle = bone(0.92); c.font = font(F.archivo(100, 700), 32); c.textAlign = 'center';
      c.fillText('G', x, S.yG + 1);
      c.font = font(MONO, 13); c.fillStyle = rgba('ash', 0.8 * rest); c.textAlign = 'left';
      c.fillText(`-G${i + 1}  21 kV · 3000 rpm`, x + S.rG + 12, S.yG + 5);
      if (!(last && dive > 0)) {
        tildePath(c, x, S.yG + S.tilDy);
        c.strokeStyle = live ? rgba('signal', rest) : bone(0.9 * rest); c.lineWidth = 2.6;
        c.stroke();
      }
    }
    // the word, set on the bar above its bay
    const ghost = prog(t, tG + 0.1 + 0.04 * i, tG + 0.25 + 0.04 * i);
    if (ghost > 0) drawWord(c, w, x, S.busY - 20, t, ghost * rest);
  }

  // ---- the last tilde: the dive target, turning white-hot
  if (dive > 0) {
    const tc = tildeC(n - 1, n);
    const wS = lerp(2.6 * cam.z, 7, dive); // screen px
    tildePath(c, tc.x, tc.y);
    c.strokeStyle = rgba('signal', 1); c.lineWidth = wS * hx;
    c.stroke();
    c.strokeStyle = `rgba(214,224,255,${dive})`; c.lineWidth = wS * 0.38 * hx;
    c.stroke();
  }
  c.restore();

  // ---- the cursor: the dot rides the bus from bay to bay (70 ms slides)
  let xd = bayX(0, n), kd = 0;
  T.w1.forEach((w, i) => { if (t >= w.start - 0.07) { xd = lerp(xd, bayX(i, n), ease.outExpo(clamp((t - (w.start - 0.07)) / 0.07))); kd = w.start; } });
  const on = prog(t, T.w1[0]!.start - 0.14, T.w1[0]!.start) * rest;
  if (on > 0) {
    const p = w2s(cam, xd, SLD.busY);
    dot2D(c, p.x, p.y, t, (0.7 + 0.9 * pulse(t, kd, 0.08)) * Math.min(1.6, cam.z), on, 0.35);
  }
}
