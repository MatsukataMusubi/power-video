// world5 (mycel.ts), movement 3: the Droste. Four engraved plates, each nested in the middle of the one
// before at 1/S (loom's rectangular Droste, loom-glsl.ts), drawn as vector line work under nested canvas
// transforms so every level stays crisp: tree b's root tip -> a cortical cell with the fungus between
// the cells -> a mitochondrion -> its cristae, which are the organ's pipes (HANDOFF.pipes) on the last
// frame. Each plate carries the hook on its own object (root, cell wall, membranes), written as sung:
// every nested copy echoes the line, like loom's. The twist turns each level against the one outside it.
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { norm, type Word } from '../engine/lyrics';
import { clamp, lerp, mulberry32, smoothstep, TAU } from '../engine/util';
import { dot2D, HANDOFF } from './_power';
import {
  type P, addPoly, addCircle, spline, tube, hatchPoly, grain, wobble, resample, lengths, at, offset, PathText,
  border, plateTitle, caption, inPoly,
} from './mycel-kit';

/** Each level sits in the middle of the one before at 1/S. */
export const S = 2.8;

type M6 = [number, number, number, number, number, number];
const mul = (A: M6, B: M6): M6 => [
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
];
/** Scale s and rotation th about the frame centre. */
const about = (s: number, th: number): M6 => {
  const c = Math.cos(th) * s, n = Math.sin(th) * s;
  return [c, n, -n, c, 960 - (960 * c - 540 * n), 540 - (960 * n + 540 * c)];
};
const apply = (M: M6, x: number, y: number): P => ({ x: M[0] * x + M[2] * y + M[4], y: M[1] * x + M[3] * y + M[5] });

interface DrawO { t: number; sig: number; k: number; end: number; cur: boolean }

abstract class Plate {
  A!: PathText;
  B!: PathText;
  abstract fig: string;
  abstract sub: string;
  abstract cap: string[];
  capY = 1022;
  tagY = 92;
  constructor(protected wa: Word[], protected wb: Word[]) {}
  protected letter(pa: P[], pb: P[], max = 76) {
    const fam = F.archivo(62, 900);
    const la = lengths(pa), lb = lengths(pb);
    const size = Math.min(PathText.fit(this.wa, fam, max, la[la.length - 1]! - 40, 1.5), PathText.fit(this.wb, fam, max, lb[lb.length - 1]! - 40, 1.5));
    const wA = new PathText(this.wa, fam, size, pa, 0, 1.5);
    const wB = new PathText(this.wb, fam, size, pb, 0, 1.5);
    // centre each line on its path
    const cA = (la[la.length - 1]! - wA.lay.width) / 2, cB = (lb[lb.length - 1]! - wB.lay.width) / 2;
    this.A = new PathText(this.wa, fam, size, pa, cA, 1.5);
    this.B = new PathText(this.wb, fam, size, pb, cB, 1.5);
  }
  abstract body(c: CanvasRenderingContext2D, o: DrawO, a: number): void;
  draw(c: CanvasRenderingContext2D, o: DrawO) {
    const a = 1;
    c.lineCap = 'round'; c.lineJoin = 'round';
    this.body(c, o, a);
    // furniture
    const fa = (1 - o.end) * (o.sig < 0.12 ? 0 : 1);
    if (fa > 0.01) {
      border(c, 18, 18, 1902, 1062, fa, o.k);
      if (o.sig > 0.2) {
        plateTitle(c, 84, this.tagY, this.fig, this.sub, fa);
        caption(c, 84, this.capY, this.cap, fa);
      }
    }
  }
  /** The hook on this plate's object, written as sung; returns the pens (plate px). */
  words(c: CanvasRenderingContext2D, o: DrawO): (P | null)[] {
    const a = 1 - o.end;
    if (a <= 0.01) return [];
    const pa = this.A.draw(c, o.t, { a, guide: 0.12 });
    const pb = this.B.draw(c, o.t, { a, guide: 0.12 });
    return [pa, pb];
  }
}

// ------------------------------------------------------------------ fig. 17: the root tip
class RootPlate extends Plate {
  fig = 'FIG. 17';
  sub = 'ROOT TIP OF TREE b, IN ITS FUNGAL SHEATH · ×12';
  cap = ['Fig. 17. — m, the mantle: the fungus wrapped round the root; h, its hyphae, out in the soil for the', 'tree. Root hairs: not needed.'];
  outline: P[] = [];
  heavy = new Path2D(); line = new Path2D(); hair = new Path2D(); mantle = new Path2D(); hyph = new Path2D();
  felt = [new Path2D(), new Path2D(), new Path2D()];
  xc = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  hatch = [new Path2D(), new Path2D(), new Path2D()];
  soil = new Path2D(); soilH = new Path2D(); stip = new Path2D(); cap2 = new Path2D();
  constructor(wa: Word[], wb: Word[]) {
    super(wa, wb);
    const rnd = mulberry32(1717);
    const cl = spline([{ x: -120, y: 548 }, { x: 300, y: 536 }, { x: 760, y: 546 }, { x: 1180, y: 538 }, { x: 1440, y: 542 }], 20);
    const R = (u: number) => lerp(740, 640, Math.pow(u, 1.6));
    const tb = tube(cl, R);
    this.outline = tb.outline;
    addPoly(this.heavy, tb.outline);
    const inner = tube(cl, (u) => R(u) - 44);
    addPoly(this.line, inner.outline);
    // the mantle: the whole root is felted with short hyphae, denser at the rim and in the shadow below
    const Lc = lengths(cl), totC = Lc[Lc.length - 1]!;
    for (let i = 0; i < 7000; i++) {
      const u = rnd();
      const q = at(cl, Lc, totC * u);
      const v = rnd() * 2 - 1; // across: -1 top .. 1 bottom
      const rim = Math.abs(v);
      const keep = 0.18 + 0.5 * Math.pow(rim, 3) + 0.35 * smoothstep(0.1, 1, v);
      if (rnd() > keep) continue;
      const hw = (R(u) / 2 - 3) * v;
      const x = q.x - Math.sin(q.a) * hw, y = q.y + Math.cos(q.a) * hw;
      const a = q.a + (rnd() - 0.5) * 2.6, l = 6 + rnd() * 10;
      const b = v > 0.35 ? (rnd() < 0.5 ? 2 : 1) : rim > 0.8 ? 1 : 0;
      const P2 = this.felt[b]!;
      P2.moveTo(x, y); P2.quadraticCurveTo(x + Math.cos(a + 0.9) * l * 0.6, y + Math.sin(a + 0.9) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    // round the cap too
    const tipC = cl[cl.length - 1]!;
    for (let i = 0; i < 260; i++) {
      const a = -Math.PI / 2 + rnd() * Math.PI, r = R(1) / 2 - 4 - rnd() * 38;
      const x = tipC.x + Math.cos(a) * r, y = tipC.y + Math.sin(a) * r;
      const b = rnd() * TAU, l = 5 + rnd() * 9;
      this.mantle.moveTo(x, y); this.mantle.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l);
    }
    // the form: a few long striations along the root, and shade lines in its lower third
    for (let k = 0; k < 9; k++) {
      const v = -0.8 + (k / 8) * 1.6;
      const st = offset(cl.slice(0, Math.floor(cl.length * (0.92 - 0.1 * Math.abs(v)))), (i) => (R(i / (cl.length - 1)) / 2 - 20) * v);
      addPoly(this.hatch[0]!, wobble(st, 2, 140, k + 5), false);
    }
    for (let sPos = 30; sPos < totC - 60; sPos += 11) {
      const u = sPos / totC;
      const q = at(cl, Lc, sPos);
      const hw = R(u) / 2 - 24;
      const nx = -Math.sin(q.a), ny = Math.cos(q.a), tx = Math.cos(q.a), ty = Math.sin(q.a);
      // an arc across the root (bowed toward the tip), its weight growing into the shadow below; the
      // weight steps fall at a different height on each arc, so the swelling reads continuous
      let pen = -1;
      const jit = (rnd() - 0.5) * 0.22;
      for (let j = 0; j <= 30; j++) {
        const v = -1 + (j / 30) * 2;
        const bow = 70 * Math.sqrt(Math.max(0, 1 - v * v));
        const x = q.x + nx * hw * v + tx * bow, y = q.y + ny * hw * v + ty * bow;
        const d = 0.08 + 0.92 * smoothstep(-0.55, 1, v) + 0.2 * smoothstep(-0.8, -1, v) + jit;
        const b = d > 0.8 ? 3 : d > 0.55 ? 2 : d > 0.3 ? 1 : d > 0.16 ? 0 : -1;
        if (b !== pen) { if (b >= 0) this.xc[b]!.moveTo(x, y); pen = b; } else if (b >= 0) this.xc[b]!.lineTo(x, y);
      }
    }
    // root cap: layered cap cells at the tip, sloughed cells drifting off
    for (let k = 1; k <= 5; k++) {
      const r = R(1) / 2 - 44 - k * 30;
      this.hair.moveTo(tipC.x + Math.cos(-1.2) * r, tipC.y + Math.sin(-1.2) * r);
      this.hair.arc(tipC.x, tipC.y, r, -1.2, 1.2);
    }
    for (let k = 0; k < 9; k++) {
      const a = -0.9 + 1.8 * rnd(), r = R(1) / 2 + 20 + rnd() * 60;
      addCircle(this.cap2, tipC.x + Math.cos(a) * r, tipC.y + Math.sin(a) * r, 6 + rnd() * 7);
    }
    // the hyphae out in the soil (the fungus's reach), branching, from the mantle
    const L = lengths(cl), tot = L[L.length - 1]!;
    for (let i = 0; i < 90; i++) {
      let x: number, y: number, a: number;
      if (i < 70) {
        const u = rnd();
        const q = at(cl, L, tot * u);
        const side = rnd() < 0.5 ? -1 : 1;
        const hw = R(u) / 2;
        x = q.x - Math.sin(q.a) * hw * side; y = q.y + Math.cos(q.a) * hw * side;
        a = q.a + side * Math.PI / 2 + (rnd() - 0.5) * 1.3;
      } else {
        a = -1.1 + 2.2 * rnd();
        x = tipC.x + Math.cos(a) * R(1) / 2; y = tipC.y + Math.sin(a) * R(1) / 2;
      }
      this.branchy(x, y, a, 70 + rnd() * 200, 2, rnd);
    }
    // soil grains around (not on the root)
    for (let i = 0; i < 220; i++) {
      const x = -40 + rnd() * 2000, y = -40 + rnd() * 1160;
      if (inPoly(this.outline, x, y) || Math.hypot(x - tipC.x, y - tipC.y) < R(1) / 2 + 30) continue;
      const r = 7 + Math.pow(rnd(), 2) * 34;
      const g = grain(x, y, r, i * 7 + 3);
      addPoly(this.soil, g);
      hatchPoly(g, 0.9, 3.4, (px, py) => smoothstep(-0.1, 0.8, ((px - x) * 0.55 + (py - y) * 0.83) / r), [0.3], [this.soilH]);
    }
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * 1920, y = rnd() * 1080;
      if (inPoly(this.outline, x, y)) continue;
      addCircle(this.stip, x, y, 0.8 + rnd() * 0.9);
    }
    // the hook: along the root's upper and lower bands (on the root)
    const la = spline([{ x: 150, y: 312 }, { x: 700, y: 305 }, { x: 1250, y: 312 }, { x: 1560, y: 332 }], 24);
    const lb = spline([{ x: 150, y: 848 }, { x: 700, y: 840 }, { x: 1250, y: 846 }, { x: 1560, y: 820 }], 24);
    this.letter(la, lb, 80);
  }
  private branchy(x: number, y: number, a: number, len: number, depth: number, rnd: () => number) {
    const pts: P[] = [{ x, y }];
    let cx = x, cy = y, ca = a;
    const n = Math.max(3, Math.round(len / 14));
    for (let i = 0; i < n; i++) { ca += (rnd() - 0.5) * 0.35; cx += Math.cos(ca) * 14; cy += Math.sin(ca) * 14; pts.push({ x: cx, y: cy }); }
    addPoly(this.hyph, pts, false);
    addCircle(this.hyph, cx, cy, 1.6);
    if (depth > 0 && len > 60) {
      const k = Math.floor(n * (0.4 + 0.4 * rnd()));
      const p = pts[k]!;
      this.branchy(p.x, p.y, ca + (rnd() < 0.5 ? -0.8 : 0.8), len * 0.5, depth - 1, rnd);
    }
  }
  body(c: CanvasRenderingContext2D, o: DrawO) {
    const k = o.k;
    c.fillStyle = rgba('bone', 0.2); c.fill(this.stip);
    c.strokeStyle = rgba('bone', 0.26); c.lineWidth = 1.1 * k; c.stroke(this.soil);
    if (o.sig > 0.3) { c.strokeStyle = rgba('bone', 0.14); c.lineWidth = 0.8 * k; c.stroke(this.soilH); }
    c.strokeStyle = rgba('bone', 0.4); c.lineWidth = 1 * k; c.stroke(this.hyph);
    c.fillStyle = rgba('ink', 0.97); c.fill(this.heavy);
    const hw = [0.6, 0.95, 1.35];
    if (o.sig > 0.2) this.hatch.forEach((h, i) => { c.strokeStyle = rgba('bone', 0.2 + 0.1 * i); c.lineWidth = hw[i]! * k; c.stroke(h); });
    if (o.sig > 0.15) {
      const xa = [0.14, 0.22, 0.3, 0.38], xw = [0.5, 0.8, 1.15, 1.6];
      this.xc.forEach((h, i) => { c.strokeStyle = rgba('bone', xa[i]!); c.lineWidth = xw[i]! * k; c.stroke(h); });
    }
    const fa = [0.22, 0.4, 0.55];
    if (o.sig > 0.15) this.felt.forEach((p, i) => { c.strokeStyle = rgba('bone', fa[i]!); c.lineWidth = 0.9 * k; c.stroke(p); });
    c.strokeStyle = rgba('bone', 0.42); c.lineWidth = 0.9 * k; c.stroke(this.mantle);
    c.strokeStyle = rgba('bone', 0.35); c.lineWidth = 0.9 * k; c.stroke(this.hair); c.stroke(this.cap2);
    c.strokeStyle = rgba('bone', 0.62); c.lineWidth = 1.3 * k; c.stroke(this.line);
    c.strokeStyle = rgba('bone', 0.92); c.lineWidth = 2.4 * k; c.stroke(this.heavy);
    // plate letters
    if (o.sig > 0.25) {
      c.font = font(F.serif(400, true), 34); c.fillStyle = rgba('bone', 0.66); c.textBaseline = 'alphabetic';
      c.fillText('m', 1640, 245); c.fillText('h', 1760, 150); c.fillText('h', 420, 1005);
    }
  }
}

// ------------------------------------------------------------------ fig. 18: the cell
class CellPlate extends Plate {
  fig = 'FIG. 18';
  sub = 'CORTICAL CELL, WITH THE HARTIG NET · ×600';
  cap = ['Fig. 18. — The fungus between the cells (the Hartig net). Sugar out, phosphorus in.'];
  override capY = 1040;
  heavy = new Path2D(); line = new Path2D(); hair = new Path2D(); dots = new Path2D(); dotsF = new Path2D();
  hatch = [new Path2D(), new Path2D(), new Path2D()];
  net = new Path2D(); netCore: P[][] = [];
  mitos = new Path2D(); mitoIn = new Path2D();
  cellO: P[] = [];
  constructor(wa: Word[], wb: Word[]) {
    super(wa, wb);
    const rnd = mulberry32(1818);
    const rr = (x0: number, y0: number, x1: number, y1: number, r: number, n = 18) => {
      const pts: P[] = [];
      const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); } };
      corner(x1 - r, y0 + r, -Math.PI / 2); corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI);
      return wobble(resample([...pts, pts[0]!], 10), 3, 160, Math.floor(x0 + y0));
    };
    // the central cell and its wall
    const C0 = rr(190, 150, 1730, 930, 110);
    this.cellO = C0;
    addPoly(this.heavy, C0);
    const Ci = rr(212, 172, 1708, 908, 92);
    addPoly(this.line, Ci);
    // the wall's thickness, hatched
    hatchPoly([...C0, ...Ci.slice().reverse()], 0.8, 3.2, () => 0.5, [0.3], [this.hatch[0]!]);
    // neighbours: partial cells round it, separated by the Hartig net
    const nb: [number, number, number, number][] = [
      [-200, -300, 560, 118], [600, -300, 1300, 118], [1340, -300, 2200, 118],
      [-200, 962, 700, 1500], [740, 962, 1500, 1500], [1540, 962, 2200, 1500],
      [-400, 150, 158, 930], [1762, 150, 2400, 930],
    ];
    for (const [x0, y0, x1, y1] of nb) {
      const o = rr(x0, y0, x1, y1, 100);
      addPoly(this.heavy, o);
      const i2 = rr(x0 + 22, y0 + 22, x1 - 22, y1 - 22, 80);
      addPoly(this.line, i2);
      hatchPoly(i2, 0.45, 5.5, (x, y) => 0.25 + 0.25 * Math.sin(x * 0.01 + y * 0.013), [0.3], [this.hatch[1]!]);
    }
    // the Hartig net: hyphae running in the gaps between the walls (their cores carry the exchange)
    const gapPaths: P[][] = [
      [{ x: -20, y: 134 }, { x: 600, y: 131 }, { x: 1300, y: 136 }, { x: 1940, y: 133 }],
      [{ x: -20, y: 946 }, { x: 720, y: 949 }, { x: 1500, y: 944 }, { x: 1940, y: 947 }],
      [{ x: 174, y: -20 }, { x: 172, y: 540 }, { x: 175, y: 1100 }],
      [{ x: 1746, y: -20 }, { x: 1748, y: 540 }, { x: 1745, y: 1100 }],
    ];
    for (const g of gapPaths) {
      const sp = wobble(spline(g, 30), 7, 150, Math.floor(g[0]!.x * 3 + g[0]!.y));
      for (const off of [-6, 6]) {
        const w = wobble(offset(sp, off), 2.4, 60, Math.floor(g[0]!.x + g[0]!.y));
        addPoly(this.net, w, false);
      }
      // septa across the hypha
      const L = lengths(sp), tot = L[L.length - 1]!;
      for (let s = 20; s < tot; s += 38 + rnd() * 16) {
        const q = at(sp, L, s);
        const nx = -Math.sin(q.a), ny = Math.cos(q.a);
        this.net.moveTo(q.x - nx * 6, q.y - ny * 6); this.net.lineTo(q.x + nx * 6, q.y + ny * 6);
      }
      this.netCore.push(sp);
    }
    // inside: nucleus (left), amyloplasts (right), mitochondria and ER in the cytoplasm
    const nx = 420, ny = 560, nr = 120;
    const env = (r: number) => { const p: P[] = []; for (let i = 0; i < 120; i++) { const a = (i / 120) * TAU; p.push({ x: nx + Math.cos(a) * r * (1 + 0.03 * Math.sin(a * 3)), y: ny + Math.sin(a) * r * 1.08 * (1 + 0.03 * Math.sin(a * 2 + 1)) }); } return p; };
    addPoly(this.line, env(nr)); addPoly(this.line, env(nr - 7));
    hatchPoly(env(nr - 9), 0.52, 4.2, (x, y) => 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(y * 0.06) * 2)) + 0.25 * smoothstep(0, 1, (y - ny) / nr), [0.3, 0.55, 0.8], this.hatch);
    addCircle(this.line, nx + 18, ny - 12, 30);
    hatchPoly(env(30).map((p) => ({ x: p.x - nx + nx + 18, y: p.y - ny + ny - 12 })).map((p) => ({ x: nx + 18 + (p.x - nx - 18) * 0.22 / 0.25, y: p.y })), -0.6, 2.8, () => 0.7, [0.3], [this.hatch[2]!]);
    // amyloplasts: starch grains, concentric
    for (const [x, y, r] of [[1470, 420, 46], [1560, 610, 52], [1420, 760, 38], [1640, 330, 30]] as [number, number, number][]) {
      for (let k = 0; k < 5; k++) { this.hair.moveTo(x + r * (1 - k * 0.18) + 4 * k, y); this.hair.ellipse(x + 4 * k, y, r * (1 - k * 0.18), r * 0.8 * (1 - k * 0.18), 0.3, 0, TAU); }
      this.line.moveTo(x + r + 6, y); this.line.ellipse(x, y, r + 6, r * 0.8 + 6, 0.3, 0, TAU);
    }
    // mitochondria (bone), in the cytoplasm
    for (const [x, y, a] of [[330, 250, 0.2], [880, 250, -0.1], [1160, 830, 0.15], [300, 820, -0.4], [1600, 870, 0.1], [1280, 245, 0.05], [560, 830, 0.3]] as [number, number, number][]) {
      const L = 70, w = 15;
      const pts: P[] = [];
      for (let i = 0; i < 40; i++) { const t = (i / 40) * TAU; const u = Math.cos(t) * L / 2, v = Math.sin(t) * w; pts.push({ x: x + u * Math.cos(a) - v * Math.sin(a), y: y + u * Math.sin(a) + v * Math.cos(a) }); }
      addPoly(this.mitos, pts);
      for (let k = -2; k <= 2; k++) {
        const u = k * 11, v0 = (k % 2 ? -1 : 1) * w * 0.9, v1 = v0 * 0.1;
        this.mitoIn.moveTo(x + u * Math.cos(a) - v0 * Math.sin(a), y + u * Math.sin(a) + v0 * Math.cos(a));
        this.mitoIn.lineTo(x + u * Math.cos(a) - v1 * Math.sin(a), y + u * Math.sin(a) + v1 * Math.cos(a));
      }
    }
    // the tonoplast (the vacuole's membrane) round the middle, and ER strands along the wall
    addPoly(this.hair, rr(560, 320, 1360, 760, 130));
    for (let k = 0; k < 4; k++) {
      const y = 350 + k * 120;
      const pts = wobble(resample([{ x: 250, y: lerp(200, 880, k / 3) }, { x: 380, y: lerp(210, 860, k / 3) + 20 }], 10), 6, 40, k + 3);
      addPoly(this.hair, pts, false);
      void y;
    }
    // ribosomes and granules in the cytoplasm band (not in the vacuole)
    const vac = rr(560, 320, 1360, 760, 130);
    for (let i = 0; i < 1300; i++) {
      const x = 215 + rnd() * 1490, y = 175 + rnd() * 730;
      if (inPoly(vac, x, y) || !inPoly(Ci, x, y) || Math.hypot(x - nx, (y - ny) / 1.08) < nr + 6) continue;
      addCircle(rnd() < 0.7 ? this.dotsF : this.dots, x, y, 0.9 + rnd() * 0.8);
    }
    // the hook: along the wall, inside the cell
    const la = spline([{ x: 250, y: 290 }, { x: 960, y: 284 }, { x: 1670, y: 290 }], 30);
    const lb = spline([{ x: 250, y: 872 }, { x: 960, y: 866 }, { x: 1670, y: 872 }], 30);
    this.letter(la, lb, 74);
  }
  body(c: CanvasRenderingContext2D, o: DrawO) {
    const k = o.k;
    c.fillStyle = rgba('bone', 0.26); c.fill(this.dotsF);
    c.fillStyle = rgba('bone', 0.5); c.fill(this.dots);
    const hw = [0.6, 0.9, 1.25];
    if (o.sig > 0.2) this.hatch.forEach((h, i) => { c.strokeStyle = rgba('bone', 0.24 + 0.1 * i); c.lineWidth = hw[i]! * k; c.stroke(h); });
    c.strokeStyle = rgba('bone', 0.4); c.lineWidth = 0.9 * k; c.stroke(this.hair);
    c.strokeStyle = rgba('bone', 0.7); c.lineWidth = 1.2 * k; c.stroke(this.mitos);
    c.strokeStyle = rgba('bone', 0.45); c.lineWidth = 0.9 * k; c.stroke(this.mitoIn);
    c.strokeStyle = rgba('bone', 0.65); c.lineWidth = 1.2 * k; c.stroke(this.line);
    c.strokeStyle = rgba('bone', 0.92); c.lineWidth = 2.2 * k; c.stroke(this.heavy);
    // the Hartig net's cores: the exchange (blue)
    c.strokeStyle = rgba('signal', 0.85); c.lineWidth = 2.2 * k;
    c.beginPath(); for (const p of this.netCore) addPoly(c as unknown as Path2D, p, false); c.stroke();
    c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1 * k; c.stroke(this.net);
    if (o.sig > 0.25) {
      c.font = font(F.serif(400, true), 32); c.fillStyle = rgba('bone', 0.66); c.textBaseline = 'alphabetic';
      c.fillText('n', 400, 425); c.fillText('a', 1500, 355); c.fillText('hn', 60, 118); c.fillText('v', 1330, 700);
    }
  }
}

// ------------------------------------------------------------------ the mitochondrion (fig. 19) and its cristae (fig. 20)
const PI = HANDOFF.pipes;
const PITCH = (PI.x1 - PI.x0) / PI.n;
/** How much of a fold's height its junction (the pipe's foot) takes. */
const FOOT = 0.28;

/** A crista as an organ pipe: a tube with a rounded top, a narrowing foot into the boundary membrane. */
function pipe(xc: number, top: number, bot: number, w: number, lean = 0, o: { foot?: number; flat?: number; flare?: number } = {}): P[] {
  const hw = w / 2, ch = hw * (1 - (o.flat ?? 0));
  const long = o.foot !== undefined;
  const foot = long ? bot - (bot - top) * o.foot! : bot - Math.min(90, (bot - top) * 0.13);
  const neck = long ? 1.6 : hw * 0.34, flare = o.flare ?? 6;
  const L: P[] = [], R: P[] = [];
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const y = lerp(top + ch, bot, i / n);
    // the crista junction: a long cone to a narrow neck (an organ pipe's foot), flaring into the membrane
    const k = long ? clamp((y - foot) / (bot - foot)) : smoothstep(foot - 30, bot - 8, y);
    const h = lerp(hw, neck, k) + flare * smoothstep(bot - 14, bot, y);
    const dx = lean * (1 - (y - top) / (bot - top));
    L.push({ x: xc - h + dx, y }); R.push({ x: xc + h + dx, y });
  }
  const cap: P[] = [];
  for (let i = 1; i < 16; i++) { const a = Math.PI + (i / 16) * Math.PI; cap.push({ x: xc + lean + Math.cos(a) * hw, y: top + ch + Math.sin(a) * ch }); }
  return [...L.slice().reverse(), ...cap, ...R];
}

class MitoPlate extends Plate {
  fig = 'FIG. 19';
  sub = 'MITOCHONDRION, IN SECTION · ×24,000';
  cap = ['Fig. 19. — The folds of the inner membrane (cristae) carry the turbines: ATP synthase, a rotary motor, 3 ATP a turn.'];
  override capY = 1030;
  outer: P[] = []; inner: P[] = [];
  heavy = new Path2D(); line = new Path2D(); cris = new Path2D(); crisFill = new Path2D(); stip = new Path2D(); knobs = new Path2D();
  hatch = [new Path2D(), new Path2D()];
  dna = new Path2D();
  constructor(wa: Word[], wb: Word[]) {
    super(wa, wb);
    const rnd = mulberry32(1919);
    const bean = (ins: number, n = 220) => {
      const pts: P[] = [];
      const cx = 960, cy = 548, a = 830 - ins, b = 290 - ins;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * TAU;
        const ct = Math.cos(t), st = Math.sin(t);
        // a superellipse (stadium-ish) with a slight bend
        const x = cx + a * Math.sign(ct) * Math.pow(Math.abs(ct), 0.55);
        const y = cy + b * Math.sign(st) * Math.pow(Math.abs(st), 0.8) - 26 * (1 - Math.pow((x - cx) / 830, 2));
        pts.push({ x, y });
      }
      return pts;
    };
    this.outer = bean(0); this.inner = bean(18);
    addPoly(this.heavy, this.outer);
    addPoly(this.line, this.inner);
    // intermembrane space: stipple
    for (let i = 0; i < 1600; i++) {
      const x = 120 + rnd() * 1680, y = 240 + rnd() * 620;
      if (!inPoly(this.outer, x, y) || inPoly(this.inner, x, y)) continue;
      addCircle(this.stip, x, y, 0.5 + rnd() * 0.5);
    }
    // cristae: pipes from the lower inner membrane, the row continuing the cristae of fig. 20
    // where a vertical line at x crosses the inner membrane (top and bottom)
    const cross = (x: number) => {
      const ys: number[] = [];
      const pl = this.inner;
      for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) {
        const a = pl[i]!, b = pl[j]!;
        if ((a.x > x) !== (b.x > x)) ys.push(a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y));
      }
      return ys.length ? { top: Math.min(...ys), bot: Math.max(...ys) } : { top: 548, bot: 548 };
    };
    const yBot = (x: number) => cross(x).bot, yTop = (x: number) => cross(x).top;
    const pitch = 34;
    for (let x = 200; x < 1730; x += pitch) {
      const xc = x + (rnd() - 0.5) * 4;
      const bot = yBot(xc), top = yTop(xc) + 30;
      if (bot - top < 80) continue;
      const pp = pipe(xc, top, bot + 2, 17, 0);
      addPoly(this.cris, pp);
      addPoly(this.crisFill, pp);
      // turbines on the ridge
      for (let k = 0; k < 3; k++) {
        const a = Math.PI + 0.45 + (k / 2) * (Math.PI - 0.9);
        const bx = xc + Math.cos(a) * 9.5, by = top + 8.5 + Math.sin(a) * 9.5;
        const ex = xc + Math.cos(a) * 15, ey = top + 8.5 + Math.sin(a) * 15;
        this.knobs.moveTo(bx, by); this.knobs.lineTo(ex, ey); addCircle(this.knobs, ex + Math.cos(a) * 2.2, ey + Math.sin(a) * 2.2, 2.2);
      }
    }
    // matrix: engraved light, denser toward the rim
    hatchPoly(this.inner, 0, 5.6, (x, y) => {
      const r = Math.hypot((x - 960) / 820, (y - 548) / 280);
      return 0.95 - 0.8 * smoothstep(0.0, 1.0, r);
    }, [0.28, 0.66], this.hatch, 1.2);
    // its own genome, a little ring; granules
    for (const [x, y] of [[420, 420], [1500, 690]] as [number, number][]) {
      for (let i = 0; i <= 50; i++) { const a = (i / 50) * TAU, r = 16 + 3 * Math.sin(a * 5); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.8; if (i === 0) this.dna.moveTo(px, py); else this.dna.lineTo(px, py); }
    }
    // the hook: above and below the organelle
    const top = this.outer.filter((p) => p.y < 548 && p.x > 200 && p.x < 1720).sort((a, b) => a.x - b.x);
    const bot = this.outer.filter((p) => p.y > 548 && p.x > 200 && p.x < 1720).sort((a, b) => a.x - b.x);
    this.letter(resample(offset(top, 26), 8), resample(offset(bot, -84), 8), 74);
  }
  body(c: CanvasRenderingContext2D, o: DrawO) {
    const k = o.k;
    c.save();
    // the matrix glows: the dot's light
    c.save();
    c.beginPath(); addPoly(c as unknown as Path2D, this.inner); c.clip();
    // the matrix holds the dot's light: a soft glow at the heart, engraved in blue
    const g = c.createRadialGradient(960, 548, 0, 960, 548, 760);
    g.addColorStop(0, rgba('signal', 0.3));
    g.addColorStop(0.45, rgba('signal', 0.11));
    g.addColorStop(1, rgba('signal', 0));
    c.fillStyle = g; c.fillRect(100, 200, 1720, 700);
    c.strokeStyle = rgba('signal', 0.3); c.lineWidth = 0.8 * k; c.stroke(this.hatch[0]!);
    c.strokeStyle = rgba('signal', 0.58); c.lineWidth = 1.2 * k; c.stroke(this.hatch[1]!);
    c.fillStyle = rgba('ink', 0.97); c.fill(this.crisFill);
    c.strokeStyle = rgba('ember', 0.8); c.lineWidth = 1 * k; c.stroke(this.dna);
    c.strokeStyle = rgba('ember', 0.75); c.lineWidth = 1 * k; c.stroke(this.knobs);
    c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.6 * k; c.stroke(this.cris);
    c.restore();
    c.fillStyle = rgba('bone', 0.35); c.fill(this.stip);
    c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1.6 * k; c.stroke(this.line);
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 2.6 * k; c.stroke(this.heavy);
    c.restore();
  }
}

class CristaePlate extends Plate {
  fig = 'FIG. 20';
  sub = 'CRISTAE, THE FOLDS OF THE INNER MEMBRANE · ×150,000';
  cap = ['Fig. 20. — Twenty-three folds, in a row.'];
  override capY = 1052;
  override tagY = 62;
  pipes: P[][] = [];
  extra: { pts: P[]; a: number }[] = [];
  mem = new Path2D(); memIn = new Path2D();
  hatch = [new Path2D(), new Path2D()];
  light = [new Path2D(), new Path2D()];
  lip = new Path2D(); shade = new Path2D(); mouth = new Path2D();
  w = 0;
  knobs = new Path2D();
  constructor(wa: Word[], wb: Word[]) {
    super(wa, wb);
    const rnd = mulberry32(2020);
    // the matrix between the folds: engraved light, brightest in the middle of the row
    hatchPoly([{ x: 0, y: 194 }, { x: 1920, y: 194 }, { x: 1920, y: PI.bot - 2 }, { x: 0, y: PI.bot - 2 }], Math.PI / 2, 5.2, (x, y) => {
      const r = Math.hypot((x - 960) / 900, (y - 583) / 520);
      return 0.95 - 0.8 * smoothstep(0.1, 1.05, r) + 0.08 * Math.sin(y * 0.02 + x * 0.004);
    }, [0.3, 0.62], this.light, 1.5);
    const w = PITCH * 0.66;
    this.w = w;
    for (let i = -3; i < PI.n + 3; i++) {
      const xc = PI.x0 + (i + 0.5) * PITCH;
      const pp = pipe(xc, PI.top, PI.bot, w, 0, { foot: FOOT, flare: 4 });
      if (i < 0 || i >= PI.n) { this.extra.push({ pts: pp, a: i < 0 ? [0.12, 0.25, 0.45][i + 3]! : [0.45, 0.25, 0.12][i - PI.n]! }); continue; }
      this.pipes.push(pp);
      // shade inside the tube (its lumen), heavier on the right
      hatchPoly(pp, Math.PI / 2 + 0.02, 3.6, (x) => smoothstep(xc - w * 0.1, xc + w * 0.45, x) * 0.9 + 0.12, [0.3, 0.7], this.hatch, 1.5);
      // the lip where the fold narrows into its junction
      const fy = PI.bot - (PI.bot - PI.top) * FOOT;
      this.lip.moveTo(xc - w / 2, fy); this.lip.lineTo(xc + w / 2, fy);
      // the last beat: the folds take the organ's cylinder shading and mouths
      for (let x = xc - w / 2 + 2.5; x < xc + w / 2 - 1; x += 3.1) { this.shade.moveTo(x, PI.top + w / 2); this.shade.lineTo(x, fy - 2); }
      this.mouth.moveTo(xc - 7, fy - 3); this.mouth.lineTo(xc, fy - 34); this.mouth.lineTo(xc + 7, fy - 3); this.mouth.closePath();
      // turbines along the ridge and the upper walls
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + 0.25 + (k / 6) * (Math.PI - 0.5);
        const r0 = w / 2 + 1, r1 = w / 2 + 9;
        const cx = xc, cy = PI.top + w / 2;
        this.knobs.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        this.knobs.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        addCircle(this.knobs, cx + Math.cos(a) * (r1 + 3.4), cy + Math.sin(a) * (r1 + 3.4), 3.4);
      }
      void rnd;
    }
    // the boundary membranes above and below (the pipes' feet open into the lower one)
    const ln = (y: number, amp: number, s: number) => wobble(resample([{ x: -20, y }, { x: 1940, y }], 20), amp, 380, s);
    addPoly(this.mem, ln(172, 4, 1), false); addPoly(this.memIn, ln(192, 4, 2), false);
    addPoly(this.memIn, ln(PI.bot + 1, 2, 3), false); addPoly(this.mem, ln(PI.bot + 24, 3, 4), false);
    const la = resample([{ x: 170, y: 132 }, { x: 1750, y: 132 }], 10);
    const lb = resample([{ x: 170, y: 1016 }, { x: 1750, y: 1016 }], 10);
    this.letter(la, lb, 64);
  }
  body(c: CanvasRenderingContext2D, o: DrawO) {
    const k = o.k;
    const e = o.end;
    // the matrix between the folds: blue, going out at the very end (preach opens dark)
    const glow = 1 - smoothstep(0.2, 0.95, e);
    if (glow > 0.01) {
      const g = c.createRadialGradient(960, 583, 0, 960, 583, 900);
      g.addColorStop(0, rgba('signal', 0.4 * glow));
      g.addColorStop(0.45, rgba('signal', 0.15 * glow));
      g.addColorStop(1, rgba('signal', 0));
      c.fillStyle = g; c.fillRect(0, 192, 1920, PI.bot - 192);
      c.strokeStyle = rgba('signal', 0.42 * glow); c.lineWidth = 0.9 * k; c.stroke(this.light[0]!);
      c.strokeStyle = rgba('signal', 0.8 * glow); c.lineWidth = 1.3 * k; c.stroke(this.light[1]!);
    }
    for (const ex of this.extra) {
      const a = ex.a * (1 - e);
      if (a < 0.01) continue;
      c.fillStyle = rgba('ink', 0.95 * a / 0.45); c.beginPath(); addPoly(c as unknown as Path2D, ex.pts); c.fill();
      c.strokeStyle = rgba('bone', a); c.lineWidth = 1.8 * k; c.stroke();
    }
    // the folds, their rounded ridges flattening into pipe tops as the dive lands
    const flat = smoothstep(0.1, 0.9, e);
    const pipes = flat > 0.001 ? this.pipes.map((_, i) => pipe(PI.x0 + (i + 0.5) * PITCH, PI.top, PI.bot, this.w, 0, { foot: FOOT, flare: 4 * (1 - flat), flat })) : this.pipes;
    const body = new Path2D(); for (const p of pipes) addPoly(body, p);
    c.fillStyle = rgba('ink', 0.97); c.fill(body);
    if (o.sig > 0.2) { c.strokeStyle = rgba('bone', 0.3); c.lineWidth = 0.9 * k; c.stroke(this.hatch[0]!); c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1.3 * k; c.stroke(this.hatch[1]!); }
    if (e > 0.01) {
      c.fillStyle = rgba('bone', 0.2 * e); c.fill(body);
      c.strokeStyle = rgba('bone', 0.34 * e); c.lineWidth = 1 * k; c.stroke(this.shade);
      c.fillStyle = rgba('bone', 0.35 * e); c.fill(this.mouth);
      c.strokeStyle = rgba('bone', 0.7 * e); c.lineWidth = 1.1 * k; c.stroke(this.mouth);
    }
    c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 1.2 * k; c.stroke(this.lip);
    c.strokeStyle = rgba('ember', 0.8 * glow); c.lineWidth = 1.2 * k; c.stroke(this.knobs);
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 2.4 * k; c.stroke(body);
    const ma = 1 - e;
    c.strokeStyle = rgba('bone', 0.85 * ma); c.lineWidth = 2.2 * k; c.stroke(this.mem);
    c.strokeStyle = rgba('bone', 0.6 * ma); c.lineWidth = 1.4 * k; c.stroke(this.memIn);
  }
}

// ------------------------------------------------------------------ the nest
export class Droste {
  levels: Plate[];
  constructor(words: Word[]) {
    // the hook splits at its second "we": one half on each side of the object
    let iW = words.findIndex((w, i) => i > 0 && norm(w.w) === 'we');
    if (iW <= 0) iW = Math.ceil(words.length / 2);
    const wa = words.slice(0, iW), wb = words.slice(iW);
    this.levels = [new RootPlate(wa, wb), new CellPlate(wa, wb), new MitoPlate(wa, wb), new CristaePlate(wa, wb)];
  }

  /**
   * z: continuous level (0 = the root tip full frame; levels.length-1 = the cristae, the bottom).
   * open: the first hole opening (0..1). twist: extra turn of each level against its parent (rad).
   * end: the last frames (furniture and blue go; the pipes stay).
   */
  draw(c: CanvasRenderingContext2D, t: number, o: { z: number; open: number; twist: number; end: number }) {
    const N = this.levels.length;
    const z = clamp(o.z, 0, N - 1);
    const L0 = Math.min(N - 1, Math.floor(z)), f = z - L0;
    // the level in front: magnified S^f about the centre, the camera turning with the zoom
    let M: M6 = about(Math.pow(S, f), -f * o.twist);
    const pens: { p: P; s: number }[] = [];
    c.save();
    for (let k = L0; k < N; k++) {
      if (k > L0) {
        const s = k === 1 ? 1 / lerp(40, S, o.open) : 1 / S;
        M = mul(M, about(s, o.twist));
      }
      const sig = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
      if (sig * 1920 < 14) break;
      c.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      if (k > L0) {
        c.beginPath(); c.rect(0, 0, 1920, 1080); c.clip();
        c.fillStyle = rgba('ink', 1); c.fillRect(0, 0, 1920, 1080);
      }
      const plate = this.levels[k]!;
      const d: DrawO = { t, sig, k: Math.pow(sig, -0.5), end: k === N - 1 ? o.end : 0, cur: k === L0 };
      plate.draw(c, d);
      if (sig > 0.08) for (const p of plate.words(c, d)) if (p) pens.push({ p: apply(M, p.x, p.y), s: sig });
    }
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    // the writing heads: the dot, at every level
    for (const q of pens) dot2D(c, q.p.x, q.p.y - 6 * q.s, t, 0.35 + 0.5 * Math.min(1, q.s), 1, 0.35);
  }
}
