// inst (exhibit.ts) geometry: a natural-history museum hall at night, as a white-line engraving in 3D.
// World units are metres, y up. A row of five vitrines stands along +x (fronts facing +z) in front of
// the hall's back wall; oldest tool first: a hand axe, an abacus, a punched card, a chip, and an empty
// case. Every line is built once here (world coordinates), with a kind, the case it belongs to, an
// optional outward normal (back-facing lines are culled) and, per case light, how much that light
// reaches it (so a frame only sums the lights that are on).
import { clamp, hash } from '../engine/util';

export type V3 = [number, number, number];

/** Cases in the row, their spacing and the vitrine's dimensions. */
export const NC = 5;
export const SP = 2.4;
export const PA = 0.36; // plinth / hood half width and half depth
export const PH = 1.0; // plinth top
export const HT = 1.62; // hood top = the light attic's underside
export const AT = 1.72; // attic top
export const LAMP_Y = 1.6;
export const CONE_T = 0.44; // tan of the case lamps' half-angle
export const WALL_Z = -3.2;
export const HALL = { x0: -5.0, x1: (NC - 1) * SP + 5.0, z1: 10.0, y1: 7.5 };
export const caseX = (i: number) => i * SP;
export const lampP = (i: number): V3 => [caseX(i), LAMP_Y, 0];
/** The empty case's acrylic riser (a cube) and the vacancy on top of it: the cladogram's root. */
export const RISER = 0.1;
export const VACANCY: V3 = [caseX(NC - 1), PH + RISER, 0];
/** The label plate on each plinth's front face: centre height, half sizes (metres). */
export const LABEL = { v: 0.72, hw: 0.3, hh: 0.17, z: PA + 0.004 };

export const KIND = { STRUCT: 0, GLASS: 1, OBJ: 2, FINE: 3, ARCH: 4, MOUNT: 5, LABEL: 6 } as const;
export const KIND_GAIN = [0.62, 0.62, 0.95, 0.7, 0.55, 0.5, 0.75];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A rigid placement: rotate about x (tilt back, rad), then about y (yaw), then translate. */
export function placer(at: V3, tilt = 0, yaw = 0) {
  const ct = Math.cos(tilt), st = Math.sin(tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const rot = (p: V3): V3 => {
    // tilt back about x: +y leans toward -z
    const y = p[1] * ct + p[2] * st, z = -p[1] * st + p[2] * ct;
    return [p[0] * cy + z * sy, y, -p[0] * sy + z * cy];
  };
  return { p: (q: V3): V3 => add(rot(q), at), n: (q: V3): V3 => rot(q) };
}
type Place = ReturnType<typeof placer>;

export class Geo {
  private P: number[] = []; private Nm: number[] = []; private Kd: number[] = []; private Cs: number[] = [];
  private Wd: number[] = []; private Al: number[] = [];
  // finalised
  p!: Float32Array; n!: Float32Array; k!: Uint8Array; c!: Int8Array; w!: Float32Array; a!: Float32Array;
  /** light coefficient of each segment for each case light (NC per segment) */
  g!: Float32Array;
  count = 0;

  seg(a: V3, b: V3, kind: number, cs: number, width: number, alpha = 1, n: V3 | null = null) {
    this.P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    this.Nm.push(...(n ?? [0, 0, 0]));
    this.Kd.push(kind); this.Cs.push(cs); this.Wd.push(width); this.Al.push(alpha);
  }
  /** A straight line cut into pieces (so lighting and occlusion vary along it). */
  line(a: V3, b: V3, kind: number, cs: number, width: number, alpha = 1, step = 0.1, n: V3 | null = null) {
    const m = Math.max(1, Math.ceil(len(sub(b, a)) / step));
    for (let i = 0; i < m; i++) this.seg(add(a, scl(sub(b, a), i / m)), add(a, scl(sub(b, a), (i + 1) / m)), kind, cs, width, alpha, n);
  }
  poly(pts: V3[], kind: number, cs: number, width: number, alpha = 1, closed = false, n: ((i: number) => V3 | null) | V3 | null = null) {
    const m = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < m; i++) {
      const nn = typeof n === 'function' ? n(i) : n;
      this.seg(pts[i]!, pts[(i + 1) % pts.length]!, kind, cs, width, alpha, nn);
    }
  }
  /** Box edges (12), each subdivided. */
  box(min: V3, max: V3, kind: number, cs: number, width: number, alpha = 1, step = 0.1) {
    const c = (i: number): V3 => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [i, j] of E) this.line(c(i!), c(j!), kind, cs, width, alpha, step);
  }

  finalize() {
    this.count = this.Kd.length;
    this.p = Float32Array.from(this.P); this.n = Float32Array.from(this.Nm);
    this.k = Uint8Array.from(this.Kd); this.c = Int8Array.from(this.Cs);
    this.w = Float32Array.from(this.Wd); this.a = Float32Array.from(this.Al);
    this.g = new Float32Array(this.count * NC);
    for (let s = 0; s < this.count; s++) {
      const o = s * 6;
      const m: V3 = [(this.p[o]! + this.p[o + 3]!) / 2, (this.p[o + 1]! + this.p[o + 4]!) / 2, (this.p[o + 2]! + this.p[o + 5]!) / 2];
      for (let j = 0; j < NC; j++) this.g[s * NC + j] = lightCoef(m, this.k[s]!, this.c[s]!, j);
    }
    this.P = []; this.Nm = []; this.Kd = []; this.Cs = []; this.Wd = []; this.Al = [];
  }
}

/** How much case light j reaches a line of a given kind at world point m (1 = in the lamp's pool). */
function lightCoef(m: V3, kind: number, cs: number, j: number): number {
  const L = lampP(j);
  const inHood = Math.abs(m[0] - caseX(j)) < PA + 0.01 && Math.abs(m[2]) < PA + 0.01 && m[1] > PH - 0.01 && m[1] < HT + 0.01;
  if (cs === j) {
    if (kind === KIND.OBJ || kind === KIND.FINE || kind === KIND.MOUNT) {
      const h = Math.max(0.02, L[1] - m[1]);
      const r = Math.hypot(m[0] - L[0], m[2] - L[2]);
      const R = h * CONE_T;
      const cone = clamp((R * 1.35 - r) / (R * 0.7));
      return 0.3 + 0.7 * cone;
    }
    if (kind === KIND.GLASS) return 0.14 + 0.62 * Math.exp(-len(sub(m, L)) / 0.32);
    if (kind === KIND.LABEL) return 0.85;
    if (kind === KIND.STRUCT) {
      if (m[1] >= HT - 0.01) return 0.3 + 0.35 * Math.exp(-Math.hypot(m[0] - L[0], m[2] - L[2]) / 0.2); // the attic, around the lamp
      if (m[1] >= PH - 0.01) return 0.42; // the plinth's top edge, at the pool's rim
      return 0.05 + 0.2 * Math.pow(clamp(m[1] / PH), 2); // the plinth below the glass
    }
  }
  if (inHood) return 0.0;
  // spill through the glass onto everything else (falls off with distance from the hood's centre)
  const d = len(sub(m, [caseX(j), 1.3, 0]));
  const k = kind === KIND.ARCH ? 0.5 : 0.35;
  return k / (1 + (d / 1.15) ** 2);
}

// ================================================================== the vitrines
export function buildCases(G: Geo) {
  for (let i = 0; i < NC; i++) {
    const x = caseX(i);
    // plinth, with its recessed kick at the floor
    G.box([x - PA, 0.07, -PA], [x + PA, PH, PA], KIND.STRUCT, i, 1.2);
    const kr = PA - 0.03;
    G.box([x - kr, 0, -kr], [x + kr, 0.07, kr], KIND.STRUCT, i, 1.0, 0.8);
    // the glass hood (edges), a hairline inside each edge for the glass's thickness
    G.box([x - PA, PH, -PA], [x + PA, HT, PA], KIND.GLASS, i, 1.0);
    // the light attic
    G.box([x - PA, HT, -PA], [x + PA, AT, PA], KIND.STRUCT, i, 1.1);
    // the lamp fixture: a short can under the attic
    const ring = (y: number, r: number, n = 12): V3[] => Array.from({ length: n }, (_, k) => [x + r * Math.cos((k / n) * Math.PI * 2), y, r * Math.sin((k / n) * Math.PI * 2)] as V3);
    G.poly(ring(HT - 0.002, 0.03), KIND.STRUCT, i, 1.0, 1, true);
    G.poly(ring(LAMP_Y + 0.004, 0.024), KIND.STRUCT, i, 1.0, 1, true);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      G.seg([x + 0.03 * Math.cos(a), HT - 0.002, 0.03 * Math.sin(a)], [x + 0.024 * Math.cos(a), LAMP_Y + 0.004, 0.024 * Math.sin(a)], KIND.STRUCT, i, 0.9);
    }
    // glints on the glass: two parallel strokes near a corner of each pane (seen from its outside only)
    const gl = (o: V3, u: V3, n: V3) => {
      for (const [off, l] of [[0, 0.16], [0.035, 0.09]] as const) {
        const a = add(o, scl([u[0] * 0.7, -0.7, u[2] * 0.7], off));
        G.line(a, add(a, scl([u[0] * 0.7, -0.7, u[2] * 0.7], l)), KIND.GLASS, i, 0.9, 0.6, 0.05, n);
      }
    };
    gl([x - PA + 0.08, HT - 0.07, PA], [1, 0, 0], [0, 0, 1]);
    gl([x + PA, HT - 0.09, PA - 0.1], [0, 0, -1], [1, 0, 0]);
    gl([x - PA, HT - 0.09, -PA + 0.1], [0, 0, 1], [-1, 0, 0]);
    gl([x + PA - 0.08, HT - 0.07, -PA], [-1, 0, 0], [0, 0, -1]);
    // the label plate on the plinth's front face
    const { v, hw, hh, z } = LABEL;
    G.poly([[x - hw, v - hh, z], [x + hw, v - hh, z], [x + hw, v + hh, z], [x - hw, v + hh, z]], KIND.LABEL, i, 1.0, 0.9, true, [0, 0, 1]);
    // the service hatch on the back, and its lock
    const bz = -PA - 0.002;
    G.poly([[x - 0.22, 0.2, bz], [x + 0.22, 0.2, bz], [x + 0.22, 0.78, bz], [x - 0.22, 0.78, bz]], KIND.STRUCT, i, 0.9, 0.8, true, [0, 0, -1]);
    G.poly(Array.from({ length: 10 }, (_, k) => [x + 0.16 + 0.012 * Math.cos((k / 10) * Math.PI * 2), 0.5 + 0.012 * Math.sin((k / 10) * Math.PI * 2), bz] as V3), KIND.FINE, i, 0.8, 0.8, true, [0, 0, -1]);
  }
}

// ================================================================== the hall
export function buildHall(G: Geo) {
  const z = WALL_Z + 0.01, n: V3 = [0, 0, 1];
  const x0 = HALL.x0, x1 = HALL.x1;
  const L = (a: V3, b: V3, w = 1.0, al = 1) => G.line(a, b, KIND.ARCH, -1, w, al, 0.3, n);
  // skirting, dado rail (double), a string course at the springing, the cornice (double)
  L([x0, 0.16, z], [x1, 0.16, z]);
  L([x0, 1.05, z], [x1, 1.05, z]); L([x0, 1.11, z], [x1, 1.11, z], 0.8, 0.7);
  L([x0, 5.9, z], [x1, 5.9, z]); L([x0, 6.05, z], [x1, 6.05, z], 0.8, 0.7);
  // pilasters between arched bays; each bay centred on case 0, 2, 4
  const pil = [-2.4, 2.4, 7.2, 12.0];
  for (const px of pil) {
    for (const dx of [-0.28, 0.28]) L([px + dx, 0.16, z], [px + dx, 5.9, z]);
    L([px - 0.36, 3.2, z], [px + 0.36, 3.2, z]); // capital
    L([px - 0.36, 3.32, z], [px + 0.36, 3.32, z], 0.8, 0.7);
    L([px - 0.34, 0.16, z], [px - 0.34, 0.5, z], 0.8, 0.7); L([px + 0.34, 0.16, z], [px + 0.34, 0.5, z], 0.8, 0.7); // plinth block
    L([px - 0.34, 0.5, z], [px + 0.34, 0.5, z], 0.8, 0.7);
  }
  for (let b = 0; b + 1 < pil.length; b++) {
    const a = pil[b]! + 0.36, c = pil[b + 1]! - 0.36, cx = (a + c) / 2, r = (c - a) / 2;
    for (const [rr, al] of [[r, 1], [r - 0.14, 0.7]] as const) {
      const pts: V3[] = [];
      for (let k = 0; k <= 28; k++) { const t = Math.PI * (k / 28); pts.push([cx - rr * Math.cos(t), 3.32 + rr * Math.sin(t), z]); }
      G.poly(pts, KIND.ARCH, -1, al === 1 ? 1.0 : 0.8, al, false, n);
    }
    // a tall blind window in each bay (the museum at night: nothing behind it)
    const wx = 0.9;
    L([cx - wx, 1.6, z], [cx - wx, 4.2, z], 0.8, 0.6); L([cx + wx, 1.6, z], [cx + wx, 4.2, z], 0.8, 0.6);
    L([cx - wx, 1.6, z], [cx + wx, 1.6, z], 0.8, 0.6);
    const pts: V3[] = [];
    for (let k = 0; k <= 16; k++) { const t = Math.PI * (k / 16); pts.push([cx - wx * Math.cos(t), 4.2 + wx * Math.sin(t), z]); }
    G.poly(pts, KIND.ARCH, -1, 0.8, 0.6, false, n);
    L([cx, 1.6, z], [cx, 4.2 + wx, z], 0.7, 0.45);
  }
}

// ================================================================== the exhibits
/** Case 0: an Acheulean hand axe, drawn the way lithics are illustrated: outline, flake-scar ridges, ripples. */
export function buildHandAxe(G: Geo, cs: number) {
  const Lh = 0.24, Wm = 0.072, T = 0.026;
  const pl = placer([caseX(cs), PH + 0.075 + Lh / 2, 0.02], 0, 0.28);
  const w = (v: number) => Wm * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(clamp(v), 0.72))), 0.85);
  const zE = (v: number, side: number) => 0.0035 * Math.sin(v * 41 + side * 1.3) + 0.0018 * Math.sin(v * 97 + side * 2.1);
  const thick = (s: number, v: number) => T * Math.pow(w(v) / Wm, 0.75) * Math.pow(Math.max(0, 1 - s * s), 0.55);
  interface Scar { side: number; v0: number; as: number; av: number; dep: number }
  // flake scars: roughly round, fanning in from the edge to the midline, where the two sides' scars
  // meet in a wavy ridge (the arête); each face its own set
  const scars: Scar[][] = [[], []];
  const rid = (f: number, v: number) => 0.12 * Math.sin(v * 13 + f * 2) + 0.06 * Math.sin(v * 29 + f); // ridge offset (s units)
  for (let f = 0; f < 2; f++) {
    for (const side of [-1, 1]) {
      let v = 0.03 + 0.05 * hash(f, side, 1);
      for (let k = 0; v < 0.95; k++) {
        const wv = Math.max(0.3, w(Math.min(0.97, v + 0.05)) / Wm);
        const av = (0.07 + 0.045 * hash(f, side, k, 2)) * (0.6 + 0.4 * wv);
        const v0 = v + av;
        // reach the ridge (the other side's scars start there)
        const as = clamp(1 - side * rid(f, v0) + 0.05 * (hash(f, side, k, 3) - 0.5), 0.35, 1.3);
        scars[f]!.push({ side, v0, as, av, dep: 0.004 + 0.003 * hash(f, side, k, 4) });
        v += av * (1.45 + 0.35 * hash(f, side, k, 5));
      }
    }
  }
  const scarDepth = (f: number, s: number, v: number) => {
    let d = 0;
    for (const sc of scars[f]!) {
      const qs = (s - sc.side) / sc.as, qv = (v - sc.v0) / sc.av;
      const q = qs * qs + qv * qv;
      if (q < 1) d = Math.max(d, sc.dep * (1 - q));
    }
    return d;
  };
  const surf = (f: number, s: number, v: number): V3 => {
    const fs = f === 0 ? 1 : -1;
    const side = s >= 0 ? 1 : -1;
    const z = zE(v, side) * s * s + fs * Math.max(0.0015, thick(s, v) - scarDepth(f, s, v));
    return [s * w(v), (v - 0.5) * Lh, z];
  };
  const nAt = (f: number, s: number, v: number): V3 => nrm([s * 0.8, (v - 0.5) * 0.4, f === 0 ? 1 : -1]);
  const curve = (f: number, sv: [number, number][], kind: number, al: number, wd: number) => {
    let pts: V3[] = [], ns: V3[] = [];
    const flush = () => { if (pts.length > 1) G.poly(pts.map((q) => pl.p(q)), kind, cs, wd, al, false, (i) => ns[i] ?? null); pts = []; ns = []; };
    for (const [s, v] of sv) {
      if (Math.abs(s) > 0.985 || v < 0.012 || v > 0.985) { flush(); continue; }
      pts.push(surf(f, s, v)); ns.push(pl.n(nAt(f, s, v)));
    }
    flush();
  };
  // outline: the edge, both sides, sinuous
  for (const side of [-1, 1]) {
    const pts: V3[] = [];
    for (let k = 0; k <= 44; k++) { const v = k / 44; pts.push(pl.p([side * w(v), (v - 0.5) * Lh, zE(v, side)])); }
    G.poly(pts, KIND.OBJ, cs, 1.4, 1);
  }
  for (let f = 0; f < 2; f++) {
    // the ridge
    curve(f, Array.from({ length: 40 }, (_, k) => { const v = 0.08 + (0.86 * k) / 39; return [rid(f, v), v] as [number, number]; }), KIND.OBJ, 0.9, 1.1);
    // each scar: its boundary (clipped at the ridge) and three ripples round the point of percussion
    for (const sc of scars[f]!) {
      for (const [rho, kind, al, wd] of [[1, KIND.OBJ, 0.9, 1.05], [0.72, KIND.FINE, 0.55, 0.8], [0.48, KIND.FINE, 0.45, 0.75], [0.26, KIND.FINE, 0.38, 0.7]] as const) {
        const sv: [number, number][] = [];
        for (let k = 0; k <= 16; k++) {
          const th = -Math.PI / 2 + (Math.PI * k) / 16;
          const s = sc.side * (1 - sc.as * rho * Math.cos(th)), v = sc.v0 + sc.av * rho * Math.sin(th);
          sv.push(sc.side * (s - rid(f, v)) < -0.01 ? [9, v] : [s, v]); // past the ridge: break the line
        }
        curve(f, sv, kind, al, wd);
      }
    }
  }
  // the mount: a clear rod from a small base to a cradle under the butt
  const x = caseX(cs), mz = 0.02;
  G.box([x - 0.07, PH, mz - 0.05], [x + 0.07, PH + 0.012, mz + 0.05], KIND.MOUNT, cs, 0.9, 0.9, 0.05);
  for (const dx of [-0.006, 0.006]) G.line([x + dx, PH + 0.012, mz], [x + dx, PH + 0.08, mz], KIND.MOUNT, cs, 0.9, 0.9, 0.03);
  G.line([x - 0.03, PH + 0.08, mz], [x + 0.03, PH + 0.08, mz], KIND.MOUNT, cs, 0.9, 0.9, 0.03);
  for (const dx of [-0.03, 0.03]) G.line([x + dx, PH + 0.08, mz], [x + dx * 1.3, PH + 0.1, mz], KIND.MOUNT, cs, 0.9, 0.9, 0.03);
}

/** Case 1: a suanpan (2 beads over the beam, 5 under), 11 rods, set to 20. */
export function buildAbacus(G: Geo, cs: number) {
  const Wf = 0.42, Hf = 0.25, D = 0.036, bar = 0.018;
  const tilt = 0.2;
  const pl = placer([caseX(cs), PH + 0.035 + (Hf / 2) * Math.cos(tilt), 0.02], tilt, -0.22);
  const P = (x: number, y: number, z: number) => pl.p([x, y, z]);
  const hw = Wf / 2, hh = Hf / 2;
  // frame: front and back faces (outer and inner rectangles), depth edges at the outer corners
  for (const z of [D / 2, -D / 2]) {
    const n = pl.n([0, 0, z > 0 ? 1 : -1]);
    G.poly([P(-hw, -hh, z), P(hw, -hh, z), P(hw, hh, z), P(-hw, hh, z)].map((q) => q), KIND.OBJ, cs, 1.3, 1, true, null);
    G.poly([P(-hw + bar, -hh + bar, z), P(hw - bar, -hh + bar, z), P(hw - bar, hh - bar, z), P(-hw + bar, hh - bar, z)], KIND.OBJ, cs, 1.0, 0.85, true, n);
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) G.line(P(sx * hw, sy * hh, D / 2), P(sx * hw, sy * hh, -D / 2), KIND.OBJ, cs, 1.2, 1, 0.05);
  // the beam
  const beamY = hh - bar - 0.062, bt = 0.012;
  for (const y of [beamY + bt / 2, beamY - bt / 2]) G.line(P(-hw + bar, y, D / 2), P(hw - bar, y, D / 2), KIND.OBJ, cs, 1.0, 0.9, 0.05, pl.n([0, 0, 1]));
  // wood grain on the frame's front: a few engraved strokes along each bar
  for (let k = 0; k < 3; k++) {
    const o = bar * (0.25 + 0.25 * k);
    G.line(P(-hw + 0.02, -hh + o, D / 2), P(hw - 0.02, -hh + o, D / 2), KIND.FINE, cs, 0.7, 0.35, 0.04, pl.n([0, 0, 1]));
    G.line(P(-hw + 0.02, hh - o, D / 2), P(hw - 0.02, hh - o, D / 2), KIND.FINE, cs, 0.7, 0.35, 0.04, pl.n([0, 0, 1]));
  }
  // rods and bicone beads
  const nR = 11, inner = Wf - 2 * bar, pitch = inner / nR;
  const digits = '00000000020'; // the value on the rods, left to right
  const rb = pitch * 0.47, hb = 0.0105; // bead radius, half height
  const yTop = hh - bar, yBot = -hh + bar;
  for (let r = 0; r < nR; r++) {
    const x = -hw + bar + pitch * (r + 0.5);
    const d = +digits[r]!;
    const up = d >= 5 ? 1 : 0, lo = d % 5;
    const beads: number[] = [];
    // upper deck: 2 beads; the counted one rests on the beam
    for (let b = 0; b < 2; b++) {
      const atBeam = b < up;
      beads.push(atBeam ? beamY + bt / 2 + hb + b * 2 * hb : yTop - hb - (1 - b) * 2 * hb);
    }
    // lower deck: 5 beads; counted ones pushed up to the beam
    for (let b = 0; b < 5; b++) beads.push(b < lo ? beamY - bt / 2 - hb - b * 2 * hb : yBot + hb + (4 - b) * 2 * hb);
    // rod pieces between beads
    const stops = [yBot, ...beads.flatMap((y) => [y - hb, y + hb]), yTop].sort((a, b2) => a - b2);
    for (let k = 0; k + 1 < stops.length; k += 2) {
      const a = stops[k]!, b = stops[k + 1]!;
      if (b - a > 0.002 && !(a < beamY + bt / 2 && b > beamY - bt / 2 && b - a < bt + 0.001)) G.seg(P(x, a, 0), P(x, b, 0), KIND.OBJ, cs, 0.9, 0.8);
    }
    for (const y of beads) {
      // equator ring and generatrices: engraved facets
      const ring: V3[] = [], nn: V3[] = [];
      const n = 12;
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; ring.push(P(x + rb * Math.cos(a), y, rb * Math.sin(a))); nn.push(pl.n([Math.cos(a), 0, Math.sin(a)])); }
      G.poly(ring, KIND.OBJ, cs, 1.0, 0.95, true, (i) => nn[i]!);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        const e = P(x + rb * Math.cos(a), y, rb * Math.sin(a));
        const nt = pl.n([Math.cos(a), 0.6, Math.sin(a)]), nb = pl.n([Math.cos(a), -0.6, Math.sin(a)]);
        G.seg(e, P(x, y + hb, 0), KIND.FINE, cs, 0.8, 0.7, nt);
        G.seg(e, P(x, y - hb, 0), KIND.FINE, cs, 0.8, 0.7, nb);
      }
    }
  }
  // the easel: two clear legs behind
  const x0 = caseX(cs);
  for (const dx of [-0.12, 0.12]) G.line([x0 + dx, PH, -0.1], P(dx, hh * 0.3, -D / 2), KIND.MOUNT, cs, 0.8, 0.8, 0.05);
  G.box([x0 - 0.2, PH, -0.03], [x0 + 0.2, PH + 0.012, 0.07], KIND.MOUNT, cs, 0.8, 0.8, 0.06);
}

/** Hollerith punches for a letter: [zone row, digit row] as indices 0..11 (rows 12, 11, 0, 1..9). */
function hollerith(ch: string): number[] {
  const c = ch.toUpperCase();
  const row = (d: number) => d + 2; // digit rows 1..9 -> 3..11; row 0 -> 2
  if (c >= 'A' && c <= 'I') return [0, row(c.charCodeAt(0) - 64)];
  if (c >= 'J' && c <= 'R') return [1, row(c.charCodeAt(0) - 73)];
  if (c >= 'S' && c <= 'Z') return [2, row(c.charCodeAt(0) - 81)];
  if (c >= '0' && c <= '9') return [c === '0' ? 2 : row(+c)];
  return [];
}

/** Case 2: an 80-column punched card on an easel (enlarged 1.6×); the punches spell the hook. */
export function buildCard(G: Geo, cs: number) {
  const k = 1.6 * 0.0254; // metres per card inch
  const Wc = 7.375 * k, Hc = 3.25 * k;
  const tilt = 0.32;
  const pl = placer([caseX(cs), PH + 0.045 + (Hc / 2) * Math.cos(tilt), 0.03], tilt, -0.12);
  const n = pl.n([0, 0, 1]);
  const P = (x: number, y: number) => pl.p([x - Wc / 2, Hc / 2 - y, 0]); // card inches from the top-left
  const cut = 0.25 * k;
  // outline with the cut corner (upper left), slightly rounded corners elsewhere
  G.poly([P(cut, 0), P(Wc, 0), P(Wc, Hc), P(0, Hc), P(0, cut * 1.6)], KIND.OBJ, cs, 1.3, 1, true);
  const colX = (c: number) => (0.251 + 0.087 * c) * k;
  const rowY = (r: number) => (0.25 + 0.25 * r) * k;
  const hw = 0.0275 * k, hh = 0.0625 * k;
  const text = 'WE APPRECIATE POWER';
  const punched = new Set<string>();
  for (let c = 0; c < text.length; c++) for (const r of hollerith(text[c]!)) punched.add(`${c},${r}`);
  for (const key of punched) {
    const [c, r] = key.split(',').map(Number) as [number, number];
    const x = colX(c), y = rowY(r);
    G.poly([P(x - hw, y - hh), P(x + hw, y - hh), P(x + hw, y + hh), P(x - hw, y + hh)], KIND.OBJ, cs, 0.9, 0.95, true);
  }
  // the printed digits of rows 0..9: tiny dashes in every column not punched
  for (let r = 2; r < 12; r++) {
    for (let c = 0; c < 80; c++) {
      if (punched.has(`${c},${r}`)) continue;
      const x = colX(c), y = rowY(r);
      G.seg(P(x, y - hh * 0.4), P(x, y + hh * 0.4), KIND.FINE, cs, 0.7, 0.32, n);
    }
  }
  // the column-number print lines under rows 0 and 9
  for (const y of [rowY(2) + 0.1 * k, rowY(11) + 0.1 * k]) G.line(P(colX(0) - hw, y), P(colX(79) + hw, y), KIND.FINE, cs, 0.6, 0.25, 0.04, n);
  // easel: a ledge and a back leg
  const x0 = caseX(cs);
  G.box([x0 - Wc * 0.42, PH, -0.02], [x0 + Wc * 0.42, PH + 0.02, 0.07], KIND.MOUNT, cs, 0.8, 0.8, 0.06);
  G.line([x0, PH, -0.12], P(Wc / 2, Hc * 0.35), KIND.MOUNT, cs, 0.8, 0.8, 0.05);
}

/** Case 3: an accelerator package on a clear stand: substrate, die with its tile floorplan, six HBM stacks. */
export function buildChip(G: Geo, cs: number) {
  const S = 0.22, th = 0.01;
  const tilt = 0.95;
  const pl = placer([caseX(cs), PH + 0.06 + (S / 2) * Math.sin(Math.PI / 2 - tilt) * 0.9, 0.04], tilt, 0.18);
  const P = (x: number, y: number, z: number) => pl.p([x, y, z]);
  const up = pl.n([0, 0, 1]);
  const h = S / 2;
  // substrate
  for (const z of [0, -th]) G.poly([P(-h, -h, z), P(h, -h, z), P(h, h, z), P(-h, h, z)], KIND.OBJ, cs, 1.3, 1, true, z === 0 ? null : pl.n([0, 0, -1]));
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) G.seg(P(sx * h, sy * h, 0), P(sx * h, sy * h, -th), KIND.OBJ, cs, 1.1, 1);
  // die, raised
  const dw = 0.045, dh = 0.055, dz = 0.004;
  G.poly([P(-dw, -dh, dz), P(dw, -dh, dz), P(dw, dh, dz), P(-dw, dh, dz)], KIND.OBJ, cs, 1.2, 1, true);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) G.seg(P(sx * dw, sy * dh, dz), P(sx * dw, sy * dh, 0), KIND.OBJ, cs, 1.0, 1);
  // floorplan: 8 x 12 tiles, an I/O strip each side
  const nx = 8, ny = 12, m = 0.005;
  for (let i = 1; i < nx; i++) { const x = -dw + m + ((2 * dw - 2 * m) * i) / nx; G.line(P(x, -dh + m, dz), P(x, dh - m, dz), KIND.FINE, cs, 0.7, 0.55, 0.02, up); }
  for (let j = 0; j <= ny; j++) { const y = -dh + m + ((2 * dh - 2 * m) * j) / ny; G.line(P(-dw + m, y, dz), P(dw - m, y, dz), KIND.FINE, cs, 0.7, 0.55, 0.02, up); }
  for (const x of [-dw + m, dw - m]) G.line(P(x, -dh + m, dz), P(x, dh - m, dz), KIND.FINE, cs, 0.7, 0.55, 0.02, up);
  // HBM stacks, three per side, each with its layers on the outer face
  const hw = 0.016, hh2 = 0.017, hz = 0.0045;
  for (const sx of [-1, 1]) {
    for (let j = -1; j <= 1; j++) {
      const cx = sx * (dw + 0.008 + hw), cy = j * (2 * hh2 + 0.003);
      G.poly([P(cx - hw, cy - hh2, hz), P(cx + hw, cy - hh2, hz), P(cx + hw, cy + hh2, hz), P(cx - hw, cy + hh2, hz)], KIND.OBJ, cs, 1.0, 0.95, true);
      const ox = cx + sx * hw;
      for (let l = 1; l <= 4; l++) G.seg(P(ox, cy - hh2, (hz * l) / 5), P(ox, cy + hh2, (hz * l) / 5), KIND.FINE, cs, 0.6, 0.5, pl.n([sx, 0, 0.3]));
      G.seg(P(ox, cy - hh2, hz), P(ox, cy - hh2, 0), KIND.FINE, cs, 0.7, 0.6);
      G.seg(P(ox, cy + hh2, hz), P(ox, cy + hh2, 0), KIND.FINE, cs, 0.7, 0.6);
    }
  }
  // passives in rows along two edges, and the stiffener ring
  for (const sy of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const x = -h + 0.025 + i * ((S - 0.05) / 13), y = sy * (h - 0.016);
      G.poly([P(x - 0.003, y - 0.0015, 0.001), P(x + 0.003, y - 0.0015, 0.001), P(x + 0.003, y + 0.0015, 0.001), P(x - 0.003, y + 0.0015, 0.001)], KIND.FINE, cs, 0.6, 0.55, true, up);
    }
  }
  const r2 = h - 0.006;
  G.poly([P(-r2, -r2, 0.0015), P(r2, -r2, 0.0015), P(r2, r2, 0.0015), P(-r2, r2, 0.0015)], KIND.FINE, cs, 0.7, 0.45, true, up);
  // the stand: a clear wedge under it
  const x0 = caseX(cs);
  G.line(P(-h * 0.7, -h, -th), [x0 - h * 0.7 * Math.cos(0.18), PH, 0.04 + h * 0.7 * Math.sin(0.18)], KIND.MOUNT, cs, 0.8, 0.8, 0.04);
  G.line(P(h * 0.7, -h, -th), [x0 + h * 0.7 * Math.cos(0.18), PH, 0.04 - h * 0.7 * Math.sin(0.18)], KIND.MOUNT, cs, 0.8, 0.8, 0.04);
  G.line(P(-h * 0.7, h * 0.4, -th), [x0 - h * 0.7 * Math.cos(0.18) - 0.1 * Math.sin(0.18), PH, -0.06], KIND.MOUNT, cs, 0.8, 0.7, 0.04);
  G.line(P(h * 0.7, h * 0.4, -th), [x0 + h * 0.7 * Math.cos(0.18) - 0.1 * Math.sin(0.18), PH, -0.06], KIND.MOUNT, cs, 0.8, 0.7, 0.04);
}

/** Case 4: nothing on a clear riser. */
export function buildEmpty(G: Geo, cs: number) {
  const x = caseX(cs), r = RISER / 2, e = 0.006;
  G.box([x - r, PH, -r], [x + r, PH + RISER, r], KIND.MOUNT, cs, 1.0, 0.95, 0.025);
  G.box([x - r + e, PH + e, -r + e], [x + r - e, PH + RISER - e, r - e], KIND.MOUNT, cs, 0.7, 0.45, 0.025);
}
