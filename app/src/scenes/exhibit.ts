// inst — EXHIBIT (the instrumental: drums, no bass, no voice). Structure: P(doom)'s ilya.ts, shot for
// shot (docs/PDOOM-STRUCTURE.md); imagery: a natural-history museum hall at night, a white-line
// engraving in 3D (docs/PLATES.md #18). A row of vitrines holds tools, oldest first: a hand axe, an
// abacus, a punched card, a chip; the last case is empty. Each label gives the object, the date and,
// in this plate's idiom, its power: 0 W, 0 W, 0 W, 700 W, — W.
//
//  1  (ilya 1) Frame 1 is preach's last shape: one point of light at HANDOFF.spot. It is the lamp of
//     case 1, seen from behind: its light opens down over the hand axe; a slow orbit.
//  2  (ilya 2, the HIT) The beat before bar 2: a whip-orbit round the case's far side to a front
//     three-quarter view down the row, landing on the downbeat, where the abacus case thunks on
//     (7 px shake: the plate's one maximal hit).
//  3–4 (ilya 3–4) One slow move along the row, decelerating; the next case lights on each consecutive
//     downbeat (the punched card, the chip), each hit smaller. The chip draws: as its light comes on
//     the other cases brown out and recover. The last bar is a slow push to the chip's label (700 W),
//     the dark end of the row beyond it.
//  5  (ilya 5) The downbeat of bar 5: every light goes out. A beat of true black.
//  6  (ilya 6) Locked-off wide on the empty case, dead front, an imperceptible dolly: on the snare its
//     light thunks on (flicker, via frameIdx) over nothing: EXHIBIT PENDING · lender: —, power — W.
//  7  (ilya 7) On the snare two beats before the cut, the lamp's iris closes: the pool shrinks to a
//     seam of light from the lamp to the vacancy; the case goes dark with it.
//  8  (ilya 8) On the last kick the seam collapses into the vacancy (inQuart), which is the frame's
//     centre: one point on black, HANDOFF.clade, where outroV's cladogram takes root.
// Every time comes from the beat grid and the drum onsets (init). Palette: ink/graphite, bone, and the
// blue (the lamps and their beams, the only light that glows).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, ot } from '../engine/type';
import { clamp, ease, lerp, prog, pulse, hash, noise1, frameIdx, smoothstep, TAU } from '../engine/util';
import { dot2D, HANDOFF } from './_power';
import {
  type V3, Geo, NC, PA, PH, HT, AT, LAMP_Y, CONE_T, LABEL, VACANCY, KIND, KIND_GAIN, caseX, lampP,
  buildCases, buildHall, buildHandAxe, buildAbacus, buildCard, buildChip, buildEmpty,
} from './exhibit-geo';
import { HallPass } from './exhibit-gl';

type RGB = [number, number, number];
const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vsc = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnorm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

interface Cam { p: V3; R: V3; U: V3; F: V3; f: number }
/** Anchor framing: world point A at screen (sx, sy), camera d metres away along its view axis. */
interface Par { A: V3; sx: number; sy: number; d: number; yaw: number; pitch: number; roll: number; f: number }
const parArr = (P: Par) => [P.A[0], P.A[1], P.A[2], P.sx, P.sy, P.d, P.yaw, P.pitch, P.roll, P.f];
const arrPar = (a: number[]): Par => ({ A: [a[0]!, a[1]!, a[2]!], sx: a[3]!, sy: a[4]!, d: a[5]!, yaw: a[6]!, pitch: a[7]!, roll: a[8]!, f: a[9]! });
const lerpPar = (a: Par, b: Par, k: number): Par => arrPar(parArr(a).map((x, i) => lerp(x, parArr(b)[i]!, k)));
/** Catmull-Rom through key framings, u in [0, n-1]. */
function splinePar(K: Par[], u: number): Par {
  const n = K.length;
  const i = clamp(Math.floor(u), 0, n - 2), t = clamp(u - i, 0, 1);
  const P = (j: number) => parArr(K[clamp(j, 0, n - 1)]!);
  const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
  const t2 = t * t, t3 = t2 * t;
  return arrPar(p1.map((_, c) => 0.5 * (2 * p1[c]! + (-p0[c]! + p2[c]!) * t + (2 * p0[c]! - 5 * p1[c]! + 4 * p2[c]! - p3[c]!) * t2 + (-p0[c]! + 3 * p1[c]! - 3 * p2[c]! + p3[c]!) * t3)));
}
function camOf(P: Par): Cam {
  const cp = Math.cos(P.pitch);
  const Fw: V3 = [-Math.sin(P.yaw) * cp, -Math.sin(P.pitch), -Math.cos(P.yaw) * cp];
  const R0 = vnorm([-Fw[2], 0, Fw[0]]);
  const U0 = vcross(R0, Fw);
  const c = Math.cos(P.roll), s = Math.sin(P.roll);
  const R = vadd(vsc(R0, c), vsc(U0, s)), U = vsub(vsc(U0, c), vsc(R0, s));
  const xc = ((P.sx - W / 2) * P.d) / P.f, yc = ((H / 2 - P.sy) * P.d) / P.f;
  const p = vsub(vsub(vsub(P.A, vsc(R, xc)), vsc(U, yc)), vsc(Fw, P.d));
  return { p, R, U, F: Fw, f: P.f };
}

/** Per-frame multipliers after a lamp is switched on (60 fps frames): a relay's stutter, a tube's thunk. */
const ON = [1.3, 0.3, 1.15, 0.72, 1.06];
const THUNK = [1.25, 1.25, 0.12, 0.55, 0.9, 0.3, 1.08, 1.0];
function switchOn(t: number, t0: number, pat: number[]) {
  if (t < t0) return 0;
  const i = frameIdx(t) - frameIdx(t0);
  return i >= 0 && i < pat.length ? pat[i]! : 1;
}

// ------------------------------------------------------------------ labels
interface LabelText { title: string; tail?: string; sub: string; power: string; acc: string }
const LABELS: LabelText[] = [
  { title: 'HAND AXE', sub: 'Flint. Acheulean, c. 500,000 BCE', power: '0 W · K −∞', acc: 'Acc. no. 0001 · please do not touch' },
  { title: 'ABACUS (SUANPAN)', sub: 'Wood, brass. China, c. 1600', power: '0 W · K −∞', acc: 'Acc. no. 0002 · beads as found' },
  { title: 'PUNCHED CARD', sub: 'Card stock. 80 columns, 1928', power: '0 W · K −∞', acc: 'Acc. no. 0003 · reader not included' },
  { title: 'CHIP', sub: 'Silicon, copper. 2024', power: '700 W · K −0.32', acc: 'Acc. no. 0004 · 1 of 100,000; the rest in use' },
  { title: 'EXHIBIT PENDING', tail: ' · lender: —', sub: 'Date: —. Material: —.', power: '— W · K —', acc: 'Acc. no. 0005 · space reserved' },
];
/** Stencil on case 1's light attic, seen from behind in shot 1. */
const STENCIL = 'CASE 01 · LAMP 20 W · DO NOT OPEN';
const S_PX = 100; // canvas px per em for plane glyphs
interface PGlyph { ch: string; fam: string; u: number; v: number; em: number; role: 0 | 1 | 2 } // 0 text, 1 dim, 2 value
interface PRun { cs: number; O: V3; ux: V3; up: V3; nrm: V3; glyphs: PGlyph[] }

export default class Exhibit extends Scene {
  private hall = new HallPass();
  private ink = new LineBatch(40000, { blend: 'max' });
  private glow = new LineBatch(6000, { blend: 'add' });
  private L = new Layer2D();
  private G = new Geo();
  private runs: PRun[] = [];

  // ---- times (song s), from the beat grid and the drum onsets (init)
  private tS = 0; private tE = 0;
  private tWhip = 0; private tHit: number[] = [];
  private tDark = 0; private tSpot = 0; private tIris = 0; private tSeam = 0; private tCol = 0;
  private K1!: Par; private KT: Par[] = [];

  // ---- per-frame
  private boxes: [V3, V3][] = [];
  private bb = new Float32Array(10 * 5);
  private near = 0.05;

  override init() {
    const { audio: au, start, end } = this.ctx;
    this.tS = start; this.tE = end;
    const downAfter = (t: number) => au.downbeats.find((d) => d > t + 0.1) ?? t + 2.222;
    const beatOf = (t: number) => Math.round(au.beatAt(t));
    const snareNear = (t: number, tol = 0.09) => {
      const e = au.events('snare', t - tol, t + tol);
      return e.length ? e.reduce((b, x) => (Math.abs(x[0] - t) < Math.abs(b[0] - t) ? x : b))[0] : t;
    };
    // hits on three consecutive downbeats (bars 2, 3, 4), the whip on the beat before the first
    const d2 = downAfter(start), d3 = downAfter(d2), d4 = downAfter(d3);
    this.tHit = [d2, d3, d4];
    this.tWhip = au.timeOfBeat(beatOf(d2) - 1);
    // true black on the next downbeat; the empty case's lamp thunks on with the snare a beat later
    this.tDark = downAfter(d4);
    this.tSpot = snareNear(au.timeOfBeat(beatOf(this.tDark) + 1));
    // the iris closes from the snare two beats before the cut to the beat before it; the seam
    // collapses from the last kick before the cut
    const bEnd = beatOf(end);
    this.tIris = snareNear(au.timeOfBeat(bEnd - 2));
    this.tSeam = au.timeOfBeat(bEnd - 1);
    const ks = au.events('kick', this.tSeam + 0.12, end - 0.06);
    this.tCol = ks.length ? ks[ks.length - 1]![0] : au.timeOfBeat(bEnd - 0.5);

    // ---- world
    const G = this.G;
    buildHall(G);
    buildCases(G);
    buildHandAxe(G, 0); buildAbacus(G, 1); buildCard(G, 2); buildChip(G, 3); buildEmpty(G, 4);
    G.finalize();
    for (let i = 0; i < NC; i++) {
      const x = caseX(i);
      this.boxes.push([[x - PA + 0.004, 0.004, -PA + 0.004], [x + PA - 0.004, PH - 0.004, PA - 0.004]]);
      this.boxes.push([[x - PA + 0.004, HT + 0.004, -PA + 0.004], [x + PA - 0.004, AT - 0.004, PA - 0.004]]);
    }
    this.buildLabels();

    // ---- key framings (the move along the row)
    const l0 = lampP(0);
    this.K1 = { A: l0, sx: 1010, sy: HANDOFF.spot.y, d: 1.36, yaw: Math.PI + 0.3, pitch: -0.05, roll: 0, f: 1150 };
    this.KT = [
      { A: [0.55, 1.18, 0.06], sx: 880, sy: 560, d: 2.55, yaw: TAU - 0.8, pitch: 0.14, roll: -0.012, f: 1150 },
      { A: [2.75, 1.15, 0.1], sx: 900, sy: 560, d: 2.35, yaw: TAU - 0.72, pitch: 0.13, roll: -0.008, f: 1150 },
      { A: [4.95, 1.12, 0.12], sx: 910, sy: 555, d: 2.15, yaw: TAU - 0.64, pitch: 0.12, roll: -0.004, f: 1150 },
      { A: [6.95, 1.0, 0.3], sx: 930, sy: 540, d: 1.55, yaw: TAU - 0.46, pitch: 0.1, roll: 0, f: 1150 },
    ];
  }

  private capOf(fam: string, fallback: number) {
    try {
      const f = ot(fam) as unknown as { unitsPerEm: number; tables: { os2?: { sCapHeight?: number } } };
      const c = f.tables.os2?.sCapHeight;
      return c ? c / f.unitsPerEm : fallback;
    } catch { return fallback; }
  }

  private buildLabels() {
    const serifB = F.serif(600), serifI = F.serif(400, true), serifR = F.serif(400), mono = F.mono(400), monoB = F.mono(600);
    const capS = this.capOf(serifB, 0.63), capM = this.capOf(mono, 0.698);
    const run = (text: string, fam: string, cap: number, capR: number, u0: number, v: number, role: 0 | 1 | 2, tr = 0): { glyphs: PGlyph[]; w: number } => {
      const em = cap / capR;
      const lay = layout(text, fam, S_PX, tr * S_PX);
      return { glyphs: lay.glyphs.map((g) => ({ ch: g.ch, fam, u: u0 + (g.x / S_PX) * em, v, em, role })), w: (lay.width / S_PX) * em };
    };
    const u0 = -LABEL.hw + 0.036;
    LABELS.forEach((lb, cs) => {
      const gl: PGlyph[] = [];
      // the title (and its tail) fitted to the plate
      const avail = 2 * LABEL.hw - 0.072;
      const w0 = run(lb.title, serifB, 0.04, capS, 0, 0, 0, 0.06).w + (lb.tail ? run(lb.tail, serifR, 0.04, capS, 0, 0, 0).w + 0.004 : 0);
      const cap = 0.04 * Math.min(1, avail / w0);
      const t = run(lb.title, serifB, cap, capS, u0, 0.092, 0, 0.06);
      gl.push(...t.glyphs);
      if (lb.tail) gl.push(...run(lb.tail, serifR, cap, capS, u0 + t.w + 0.004 * (cap / 0.04), 0.092, 0).glyphs);
      gl.push(...run(lb.sub, serifI, 0.024, capS, u0, 0.047, 1).glyphs);
      gl.push(...run('POWER', mono, 0.0135, capM, u0, -0.012, 1, 0.12).glyphs);
      // the value, then its Kardashev index in a smaller size on the same baseline
      const [pw, pk] = lb.power.split(' · ') as [string, string | undefined];
      const pr = run(pw, monoB, 0.05, capM, u0 - 0.003, -0.083, 2);
      gl.push(...pr.glyphs);
      if (pk) gl.push(...run(pk, mono, 0.022, capM, u0 + pr.w + 0.012, -0.083, 2).glyphs);
      gl.push(...run(lb.acc, mono, 0.0135, capM, u0, -0.133, 1).glyphs);
      this.runs.push({ cs, O: [caseX(cs), LABEL.v, LABEL.z + 0.001], ux: [1, 0, 0], up: [0, 1, 0], nrm: [0, 0, 1], glyphs: gl });
    });
    // the stencil on case 1's attic, read from behind (x runs toward -x)
    const st = run(STENCIL, F.mono(500), 0.017, capM, 0, -0.0085, 1, 0.08);
    st.glyphs.forEach((g) => (g.u -= st.w / 2));
    this.runs.push({ cs: 0, O: [caseX(0), (HT + AT) / 2, -PA - 0.003], ux: [-1, 0, 0], up: [0, 1, 0], nrm: [0, 0, -1], glyphs: st.glyphs });
  }

  // ================================================================== camera
  private parAt(t: number): Par {
    if (t >= this.tSpot || t >= this.tDark) {
      // locked-off wide, dead front on the empty case: the vacancy is the frame's centre
      const k = prog(t, this.tSpot, this.tE, ease.inOutQuad);
      return { A: VACANCY, sx: W / 2, sy: H / 2, d: lerp(3.05, 2.85, k), yaw: 0, pitch: 0.12, roll: 0, f: 1400 };
    }
    if (t < this.tWhip) {
      // behind case 1, the lamp where preach left the point; a slow orbit
      const u = prog(t, this.tS, this.tWhip);
      const e = ease.inOutQuad(u);
      return { A: lampP(0), sx: lerp(HANDOFF.spot.x, this.K1.sx, e), sy: HANDOFF.spot.y, d: lerp(1.5, this.K1.d, u), yaw: Math.PI + lerp(-0.06, 0.3, e), pitch: -0.05, roll: 0, f: 1150 };
    }
    if (t < this.tHit[0]!) {
      // the whip-orbit round the far side to the front three-quarter view, landing on the downbeat
      const k = ease.inOutCubic(prog(t, this.tWhip, this.tHit[0]!));
      const P = lerpPar(this.K1, this.KT[0]!, k);
      P.d += 0.5 * Math.sin(Math.PI * k); // swing wide round the corner
      return P;
    }
    // one slow move along the row, decelerating: an ease-in off the landing, then a steady glide
    // whose key spacing shrinks (deflation); the last bar is the push to the chip's label
    const u = prog(t, this.tHit[0]!, this.tDark);
    const a = 0.12;
    const e = u < a ? (u * u) / (2 * a) : u - a / 2;
    return splinePar(this.KT, (3 * e) / (1 - a / 2));
  }

  // ================================================================== lights
  private lights(t: number) {
    const L = new Array(NC).fill(0) as number[];
    const cone = new Array(NC).fill(CONE_T) as number[];
    let phase: 'row' | 'black' | 'wide' = 'row';
    if (t < this.tDark) {
      L[0] = ease.inOutQuad(prog(t, this.tS + 1 / 60, this.tS + 0.5));
      for (let k = 0; k < 3; k++) L[k + 1] = switchOn(t, this.tHit[k]!, ON);
      // the chip draws: the other cases brown out as it comes on, and recover
      const t4 = this.tHit[2]!;
      if (t >= t4) {
        const dip = Math.min(1, (t - t4) / 0.035) * Math.exp(-Math.max(0, t - t4 - 0.035) / 0.28);
        for (let k = 0; k < 3; k++) L[k]! *= 1 - 0.62 * dip;
      }
    } else if (t < this.tSpot) {
      phase = 'black';
    } else {
      phase = 'wide';
      L[4] = switchOn(t, this.tSpot, THUNK);
      const close = prog(t, this.tIris, this.tSeam, ease.inOutCubic);
      cone[4] = CONE_T * lerp(1, 0.012, close);
    }
    const irisK = cone.map((c) => c / CONE_T);
    const sum = L.reduce((s, x, i) => s + x * irisK[i]!, 0);
    const amb = phase === 'row' ? 0.022 * sum : 0.016 * sum;
    // the house goes dark with the pool: once the seam is all the light, the room (beam included) is gone
    const house = phase === 'wide' ? 1 - prog(t, this.tSeam - 0.12, this.tCol + 0.03, ease.inQuad) : 1;
    const lab = L.map((x, i) => x * Math.pow(irisK[i]!, 0.7) * 0.95 * house);
    return { L, cone, irisK, lab, amb, phase, house };
  }

  // ================================================================== projection
  private proj(c: Cam, X: number, Y: number, Z: number): [number, number, number] | null {
    const rx = X - c.p[0], ry = Y - c.p[1], rz = Z - c.p[2];
    const z = rx * c.F[0] + ry * c.F[1] + rz * c.F[2];
    if (z < 1e-3) return null;
    const x = rx * c.R[0] + ry * c.R[1] + rz * c.R[2], y = rx * c.U[0] + ry * c.U[1] + rz * c.U[2];
    return [W / 2 + (c.f * x) / z, H / 2 - (c.f * y) / z, z];
  }
  private prepBoxes(c: Cam) {
    const bb = this.bb;
    this.boxes.forEach(([mn, mx], i) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, zmin = 1e9, behind = false;
      for (let k = 0; k < 8; k++) {
        const q = this.proj(c, k & 1 ? mx[0] : mn[0], k & 2 ? mx[1] : mn[1], k & 4 ? mx[2] : mn[2]);
        if (!q) { behind = true; continue; }
        x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); zmin = Math.min(zmin, q[2]);
      }
      if (behind) { x0 = -1e9; y0 = -1e9; x1 = 1e9; y1 = 1e9; zmin = 0; }
      bb[i * 5] = x0; bb[i * 5 + 1] = y0; bb[i * 5 + 2] = x1; bb[i * 5 + 3] = y1; bb[i * 5 + 4] = zmin;
    });
  }
  /** Is world point (X,Y,Z), at screen (sx, sy) and depth z, hidden behind a plinth or an attic? */
  private occluded(c: Cam, X: number, Y: number, Z: number, sx: number, sy: number, z: number) {
    const bb = this.bb;
    for (let i = 0; i < this.boxes.length; i++) {
      const o = i * 5;
      if (bb[o + 4]! >= z || sx < bb[o]! || sx > bb[o + 2]! || sy < bb[o + 1]! || sy > bb[o + 3]!) continue;
      const [mn, mx] = this.boxes[i]!;
      const dx = X - c.p[0], dy = Y - c.p[1], dz = Z - c.p[2];
      let tn = 0, tf = 1;
      const slab = (o0: number, d: number, a: number, b: number) => {
        if (Math.abs(d) < 1e-9) return o0 >= a && o0 <= b;
        let t0 = (a - o0) / d, t1 = (b - o0) / d;
        if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
        if (t0 > tn) tn = t0;
        if (t1 < tf) tf = t1;
        return tn <= tf;
      };
      if (slab(c.p[0], dx, mn[0], mx[0]) && slab(c.p[1], dy, mn[1], mx[1]) && slab(c.p[2], dz, mn[2], mx[2]) && tn < 0.999 && tf > 0) return true;
    }
    return false;
  }

  // ================================================================== render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const S = this.lights(t);
    const cam = camOf(this.parAt(t));
    const c = this.L.ctx;
    this.L.clear();
    this.ink.clear(); this.glow.clear();

    if (S.phase === 'black') {
      this.hall.set({ p: cam.p, R: cam.R, U: cam.U, F: cam.F, f: cam.f }, S.L, S.cone, S.lab, 0, 1, 0);
      this.hall.render(renderer, out);
      return this.post(t);
    }
    this.prepBoxes(cam);
    this.hall.set({ p: cam.p, R: cam.R, U: cam.U, F: cam.F, f: cam.f }, S.L, S.cone, S.lab, S.amb, this.beamK(t), S.house);
    this.hall.render(renderer, out);

    const Le = S.L.map((x, i) => x * S.irisK[i]! * S.house);
    this.drawLines(cam, Le, S.amb * S.house, S.phase === 'row' ? 0.03 * Math.min(1, S.L.reduce((a, b) => a + b, 0)) : 0.012 * Le[4]!);
    this.drawMotes(cam, t, S.L.map((x) => x * S.house), S.cone);
    this.drawRuns(c, cam, S.lab);
    this.drawLamps(c, cam, t, S);
    if (S.phase === 'wide') this.drawSeam(c, cam, t, S);

    this.ink.render(renderer, out);
    this.glow.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return this.post(t);
  }

  /** Beam haze gain: a touch stronger in the wide (the only light in the room). */
  private beamK(t: number) { return t >= this.tSpot ? 1.15 : 0.9; }

  private post(t: number): PostOverrides {
    const [h1, h2, h3] = this.tHit.map((h) => (t >= h ? pulse(t, h, 0.07) : 0)) as [number, number, number];
    const sh = 7 * h1 + 3 * h2;
    const thunk = t >= this.tSpot ? pulse(t, this.tSpot, 0.05) : 0;
    const endK = smoothstep(this.tCol, this.tE, t);
    return {
      bloom: 0.8 + 0.25 * endK, bloomThreshold: 0.9, bloomKnee: 0.3, halation: 0.2,
      vignette: 0.45, grain: 0.06, ca: 0.6,
      shake: [noise1(t * 70, 1) * sh, noise1(t * 67, 2) * sh],
      zoom: 1 + 0.022 * (t >= this.tHit[0]! ? pulse(t, this.tHit[0]!, 0.12) : 0) + 0.011 * (t >= this.tHit[1]! ? pulse(t, this.tHit[1]!, 0.1) : 0) + 0.005 * h3,
      flash: 0.02 * h1 + 0.008 * h2 + 0.018 * thunk,
    };
  }

  // ------------------------------------------------------------------ lines
  private drawLines(cam: Cam, Le: number[], amb: number, ghost: number) {
    const G = this.G, lb = this.ink;
    const bone = LIN.bone;
    // level of detail per case: the hood's height on screen
    const lodO: number[] = [], lodF: number[] = [];
    for (let i = 0; i < NC; i++) {
      const a = this.proj(cam, caseX(i), HT, 0), b = this.proj(cam, caseX(i), PH, 0);
      const h = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 2000;
      lodO.push(smoothstep(10, 36, h)); lodF.push(smoothstep(70, 190, h));
    }
    const P = G.p, N = G.n, Kd = G.k, Cs = G.c, Wd = G.w, Al = G.a, Gc = G.g;
    const cp = cam.p, near = this.near;
    for (let s = 0; s < G.count; s++) {
      const kind = Kd[s]!, cs = Cs[s]!;
      let b = ghost + amb * 0.5;
      const go = s * NC;
      for (let j = 0; j < NC; j++) { const l = Le[j]!; if (l > 0) b += l * Gc[go + j]!; }
      let a = Al[s]! * Math.min(0.95, b) * KIND_GAIN[kind]!;
      if (cs >= 0) {
        if (kind === KIND.FINE) a *= lodF[cs]!;
        else if (kind === KIND.OBJ || kind === KIND.MOUNT) a *= lodO[cs]!;
      }
      if (a < 0.004) continue;
      const o = s * 6;
      let ax = P[o]!, ay = P[o + 1]!, az = P[o + 2]!, bx = P[o + 3]!, by = P[o + 4]!, bz = P[o + 5]!;
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      const nx = N[s * 3]!, ny = N[s * 3 + 1]!, nz = N[s * 3 + 2]!;
      if ((nx !== 0 || ny !== 0 || nz !== 0) && nx * (cp[0] - mx) + ny * (cp[1] - my) + nz * (cp[2] - mz) < 0) continue;
      // near clip
      let da = (ax - cp[0]) * cam.F[0] + (ay - cp[1]) * cam.F[1] + (az - cp[2]) * cam.F[2];
      let db = (bx - cp[0]) * cam.F[0] + (by - cp[1]) * cam.F[1] + (bz - cp[2]) * cam.F[2];
      if (da < near && db < near) continue;
      if (da < near) { const u = (near - da) / (db - da); ax += (bx - ax) * u; ay += (by - ay) * u; az += (bz - az) * u; da = near; }
      else if (db < near) { const u = (near - db) / (da - db); bx += (ax - bx) * u; by += (ay - by) * u; bz += (az - bz) * u; db = near; }
      const pa = this.proj(cam, ax, ay, az), pb = this.proj(cam, bx, by, bz);
      if (!pa || !pb) continue;
      if ((pa[0] < -40 && pb[0] < -40) || (pa[0] > W + 40 && pb[0] > W + 40) || (pa[1] < -40 && pb[1] < -40) || (pa[1] > H + 40 && pb[1] > H + 40)) continue;
      const sx = (pa[0] + pb[0]) / 2, sy = (pa[1] + pb[1]) / 2, dz = (da + db) / 2;
      if (this.occluded(cam, mx, my, mz, sx, sy, dz)) continue;
      // lines grazing the lens thin out
      if (dz < 0.5) a *= smoothstep(0.12, 0.5, dz);
      lb.seg2(pa[0], pa[1], pb[0], pb[1], Wd[s]!, [bone[0] * a, bone[1] * a, bone[2] * a], 1);
    }
  }

  /** Dust in the beams: specks drifting down through each lit cone. */
  private drawMotes(cam: Cam, t: number, L: number[], cone: number[]) {
    for (let i = 0; i < NC; i++) {
      const Li = L[i]!;
      if (Li <= 0.01) continue;
      const lp = lampP(i);
      const dc = Math.hypot(lp[0] - cam.p[0], lp[1] - cam.p[1], lp[2] - cam.p[2]);
      if (dc > 5) continue;
      const n = 60;
      for (let k = 0; k < n; k++) {
        const hh = LAMP_Y - PH;
        const y = PH + 0.02 + ((hash(k, i, 1) * hh + t * 0.014 * (0.4 + hash(k, i, 2))) % (hh - 0.03));
        const h = LAMP_Y - y;
        const R = h * cone[i]!;
        const ang = hash(k, i, 3) * TAU + 0.3 * noise1(t * 0.2 + k, i);
        const rr = Math.sqrt(hash(k, i, 4)) * 0.3;
        const x = lp[0] + Math.cos(ang) * rr, z = lp[2] + Math.sin(ang) * rr * 0.8;
        const r = Math.hypot(x - lp[0], z - lp[2]);
        if (r > R) continue;
        const dens = Math.sqrt(1 - (r / R) ** 2) * Math.min(3, CONE_T / Math.max(cone[i]!, 0.02));
        const q = this.proj(cam, x, y, z);
        if (!q || q[2] < 0.15) continue;
        if (this.occluded(cam, x, y, z, q[0], q[1], q[2])) continue;
        const tw = 0.55 + 0.45 * Math.sin(t * (2 + 3 * hash(k, i, 5)) + k);
        const I = Li * dens * tw * 0.55;
        const size = clamp((0.0022 * cam.f) / q[2], 1.1, 5);
        this.glow.seg2(q[0], q[1], q[0] + 0.01, q[1], size, [LIN.ember[0] * I, LIN.ember[1] * I, LIN.ember[2] * I], 1);
      }
    }
  }

  // ------------------------------------------------------------------ labels
  private drawRuns(c: CanvasRenderingContext2D, cam: Cam, lab: number[]) {
    const m10 = 10;
    for (const R of this.runs) {
      const bright = R === this.runs[this.runs.length - 1] ? lab[0]! * 0.45 : lab[R.cs]!;
      if (bright < 0.01) continue;
      if (R.nrm[0] * (cam.p[0] - R.O[0]) + R.nrm[1] * (cam.p[1] - R.O[1]) + R.nrm[2] * (cam.p[2] - R.O[2]) <= 0) continue;
      const qc = this.proj(cam, R.O[0], R.O[1], R.O[2]);
      if (!qc) continue;
      if (qc[0] < -600 || qc[0] > W + 600 || qc[1] < -300 || qc[1] > H + 300) continue;
      let lastFam = '';
      for (const g of R.glyphs) {
        if (g.ch === ' ') continue;
        const m = g.em / S_PX;
        const Wp: V3 = [R.O[0] + R.ux[0] * g.u + R.up[0] * g.v, R.O[1] + R.ux[1] * g.u + R.up[1] * g.v, R.O[2] + R.ux[2] * g.u + R.up[2] * g.v];
        const p0 = this.proj(cam, Wp[0], Wp[1], Wp[2]);
        if (!p0) continue;
        const pa = this.proj(cam, Wp[0] + R.ux[0] * m * m10, Wp[1] + R.ux[1] * m * m10, Wp[2] + R.ux[2] * m * m10);
        const pb = this.proj(cam, Wp[0] - R.up[0] * m * m10, Wp[1] - R.up[1] * m * m10, Wp[2] - R.up[2] * m * m10);
        if (!pa || !pb) continue;
        const A = (pa[0] - p0[0]) / m10, B = (pa[1] - p0[1]) / m10, C = (pb[0] - p0[0]) / m10, D = (pb[1] - p0[1]) / m10;
        const px = Math.hypot(C, D) * S_PX; // em on screen
        if (px < 4) continue;
        if (this.occluded(cam, Wp[0], Wp[1], Wp[2], p0[0], p0[1], p0[2])) continue;
        if (g.fam !== lastFam) { c.font = font(g.fam, S_PX); lastFam = g.fam; }
        c.setTransform(A, B, C, D, p0[0], p0[1]);
        c.globalAlpha = clamp(bright * (g.role === 1 ? 0.78 : 1));
        c.fillStyle = g.role === 2 ? rgba('signal', 1) : rgba('bone', 0.95);
        c.fillText(g.ch, 0, 0);
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------ the lamps (the dot)
  private drawLamps(c: CanvasRenderingContext2D, cam: Cam, t: number, S: ReturnType<Exhibit['lights']>) {
    for (let i = 0; i < NC; i++) {
      const Li = S.L[i]!;
      const thread = i === 0 && t < this.tS + 0.6;
      if (Li <= 0.01 && !thread) continue;
      if (i === 4 && t >= this.tSeam) continue; // the seam carries it from here
      const lp = lampP(i);
      const q = this.proj(cam, lp[0], lp[1], lp[2]);
      if (!q) continue;
      if (this.occluded(cam, lp[0], lp[1], lp[2], q[0], q[1], q[2])) continue;
      let sc = clamp(1.05 / q[2], 0.2, 0.75);
      let I = Math.min(1.25, Li) * (0.6 + 0.4 * S.irisK[i]!);
      let ring = 0;
      if (thread) {
        // preach's point, becoming the lamp: it keeps its size and membrane for a moment, then settles
        const k = ease.inOutCubic(prog(t, this.tS + 0.05, this.tS + 0.55));
        sc = lerp(1, sc, k); I = lerp(1, Math.max(I, 0.9), k); ring = 0.35 * (1 - k);
      }
      this.glow.seg2(q[0], q[1], q[0] + 0.01, q[1], 34 * sc, [LIN.signal[0] * 0.7 * I, LIN.signal[1] * 0.7 * I, LIN.signal[2] * 0.7 * I], 0.5);
      dot2D(c, q[0], q[1], t, sc, I, ring);
    }
  }

  // ------------------------------------------------------------------ the seam, collapsing to the root
  private drawSeam(c: CanvasRenderingContext2D, cam: Cam, t: number, S: ReturnType<Exhibit['lights']>) {
    const L4 = S.L[4]!;
    const k0 = prog(t, this.tIris + 0.25, this.tSeam, ease.inCubic);
    if (k0 <= 0) return;
    const lp = lampP(4);
    const top = this.proj(cam, lp[0], lp[1], lp[2]), bot = this.proj(cam, VACANCY[0], VACANCY[1], VACANCY[2]);
    if (!top || !bot) return;
    const cx = W / 2, cy = H / 2; // bot is the frame centre by construction
    const col = prog(t, this.tCol, this.tE - 0.03, ease.inQuart);
    const y0 = lerp(top[1], cy, col), x0 = lerp(top[0], cx, col);
    const heat = (0.7 + 2.2 * col) * L4 * k0;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      const u = (i + 0.5) / n;
      const I = heat * (0.55 + 0.45 * Math.pow(u, 2));
      const ya = lerp(y0, bot[1], a), yb = lerp(y0, bot[1], b), xa = lerp(x0, bot[0], a), xb = lerp(x0, bot[0], b);
      this.glow.seg2(xa, ya, xb, yb, 2.0, [LIN.ember[0] * 1.5 * I, LIN.ember[1] * 1.5 * I, LIN.ember[2] * 1.5 * I], 1);
      this.glow.seg2(xa, ya, xb, yb, 10, [LIN.signal[0] * 0.5 * I, LIN.signal[1] * 0.5 * I, LIN.signal[2] * 0.5 * I], 0.5);
    }
    // the lamp rides down the seam into the vacancy; there it is the dot, alone
    const pk = prog(t, this.tE - 0.07, this.tE - 0.015, ease.outCubic);
    const sc = lerp(clamp(1.05 / top[2], 0.2, 0.75), 1, pk);
    this.glow.seg2(x0, y0, x0 + 0.01, y0, 34 * sc, [LIN.signal[0] * 0.7, LIN.signal[1] * 0.7, LIN.signal[2] * 0.7], 0.5 * k0);
    dot2D(c, x0, y0, t, sc, Math.max(0.8, L4) * lerp(1, 1.1, pk), 0.35 * pk);
  }
}
