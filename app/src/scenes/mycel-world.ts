// world5 (mycel.ts), movements 1-2: the forest floor in plan, soil removed, as a botanical engraving.
//  - HyphaTree: loom's completion tree (loom-tree.ts) as a fungal hypha. Hook 4's hairline is the parent
//    hypha; its tip (the dot) grows right, one node per sung word, the word lettered along it; at every
//    node the foraging branches not taken sprout above and below, fork into the dark, and some end on the
//    mineral grain they found (P, N, Zn...). The chosen path ends on a root of tree a.
//  - Network: the whole plate. Trees in plan (trunk sections with growth rings), their engraved roots,
//    and one fungus linking them all (hairline strands and cords). The hook is lettered along tree a's
//    root, from the contact to the trunk; the plate's furniture carries the fine print.
// World px, y down. The hypha's line sits exactly on hook 4's exit (HANDOFF.hypha).
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { Lyrics, type Word } from '../engine/lyrics';
import { clamp, ease, hash, lerp, mulberry32, prog, smoothstep, TAU } from '../engine/util';
import { HANDOFF } from './_power';
import {
  type P, addPoly, addCircle, at, lengths, spline, wobble, tube, resample, offset, grain, hatchPoly, PathText,
  border, plateTitle, caption, scaleBar, specimen,
} from './mycel-kit';

export const Y0 = HANDOFF.hypha.y;
export const X0 = HANDOFF.hypha.x;

// ================================================================== the hypha tree (movement 1)
const NUTRIENTS = ['P', 'N', 'Zn', 'K', 'H₂O', 'Cu', 'Fe', 'Mg', 'Ca', 'Mn', 'S', 'B', 'N', 'P'];
/** Per node: how far its branches reach, how many labelled / unlabelled, their lanes. */
const REACH = [600, 540, 470, 410, 350, 290, 230];
const NALT = [4, 3, 4, 3, 4, 3, 3];
const NWISP = [6, 5, 5, 4, 5, 4, 3];

interface Branch {
  pts: P[]; L: number[]; label: string; depth: number;
  t0: number; dur: number; node: number; kids: Branch[]; w: number; found: P[] | null; foundH: Path2D | null;
}

export class HyphaTree {
  nodes: number[] = [];
  tokX: number[] = [];
  tokW: number[] = [];
  tokSize = 104;
  fam = F.serif(600, true);
  branches: Branch[] = [];
  flatB: Branch[] = [];
  /** The contact: where the chosen hypha meets tree a's root. */
  xEnd = 0;
  septa: number[] = [];

  constructor(public words: Word[]) {
    let x = X0;
    words.forEach((w) => {
      this.nodes.push(x);
      const tw = measure(w.w, this.fam, this.tokSize);
      this.tokX.push(x + 18);
      this.tokW.push(tw);
      x += 18 + tw + 34;
    });
    this.xEnd = x + 30;
    this.nodes.push(this.xEnd);
    for (let s = -400 + 21; s < this.xEnd; s += 44 + 10 * hash(s, 2)) this.septa.push(s);
    // the branches not taken
    words.forEach((w, i) => {
      const nx = this.nodes[i]!;
      const nA = NALT[i % NALT.length]!, nW = NWISP[i % NWISP.length]!;
      const R = REACH[i % REACH.length]!;
      for (let k = 0; k < nA + nW; k++) {
        const wisp = k >= nA;
        const up = (k + i) % 2 === 0;
        const lane = wisp ? 0.35 + 0.65 * hash(i, k, 3) : 0.3 + 0.7 * ((Math.floor(k / 2) + 1) / Math.ceil(nA / 2));
        const off = (up ? -1 : 1) * lerp(110, 560, lane) * (0.85 + 0.3 * hash(i, k, 7));
        const reach = R * (wisp ? 0.45 + 0.4 * hash(i, k, 4) : 0.75 + 0.25 * hash(i, k, 5));
        const end = { x: nx + reach, y: Y0 + off };
        const label = wisp ? '' : NUTRIENTS[(i * 3 + k * 5) % NUTRIENTS.length]!;
        const b = this.branch({ x: nx, y: Y0 }, end, 1, w.start + 0.035 * k + (wisp ? 0.05 : 0), wisp ? 0.22 + 0.0003 * Math.abs(off) : 0.18 + 0.00026 * Math.abs(off), i, label, i * 97 + k * 13);
        if (label) {
          const r = 15 + 6 * hash(i, k, 9), gx = end.x + r + 5;
          b.found = grain(gx, end.y, r, i * 31 + k);
          b.foundH = new Path2D();
          hatchPoly(b.found, 0.9, 3.2, (x, y) => smoothstep(-0.2, 0.7, ((x - gx) * 0.55 + (y - end.y) * 0.83) / r), [0.3], [b.foundH]);
        }
        this.grow(b, 2, i * 57 + k * 11);
        this.branches.push(b);
      }
    });
    const flat = (l: Branch[]) => { for (const b of l) { this.flatB.push(b); flat(b.kids); } };
    flat(this.branches);
  }

  private branch(a: P, e: P, depth: number, t0: number, dur: number, node: number, label: string, seed: number): Branch {
    // depth 1 leaves its node vertically (clearing the lettering), then turns along; deeper forks run on
    const vert = depth === 1;
    const c1 = vert ? { x: a.x, y: a.y + Math.sign(e.y - a.y) * Math.min(Math.abs(e.y - a.y) * 0.5, 150) } : { x: lerp(a.x, e.x, 0.5), y: a.y };
    const c2 = vert ? { x: a.x + (e.x - a.x) * 0.2, y: e.y } : { x: lerp(a.x, e.x, 0.5), y: e.y };
    const raw: P[] = [];
    const n = depth === 1 ? 30 : 12;
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      raw.push({ x: v * v * v * a.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u * u * u * e.x, y: v * v * v * a.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u * u * u * e.y });
    }
    const pts = wobble(raw, depth === 1 ? 5 : 2.5, depth === 1 ? 110 : 40, seed);
    return { pts, L: lengths(pts), label, depth, t0, dur, node, kids: [], w: depth === 1 ? (label ? 2.2 : 1.3) : depth === 2 ? 1.1 : 0.85, found: null, foundH: null };
  }

  /** Hyphal forks: fewer, finer, dimmer and later with depth. */
  private grow(b: Branch, depth: number, seed: number) {
    if (depth > 4) return;
    if (depth === 4 && !b.found && hash(seed, 11) < 0.5) return;
    const n = depth === 2 ? 2 + Math.floor(hash(seed, 1) * 1.6) : 2;
    const e = b.pts[b.pts.length - 1]!;
    const spread = depth === 2 ? 46 : depth === 3 ? 26 : 13;
    for (let k = 0; k < n; k++) {
      const s = seed * 13 + k * 5 + depth;
      const dy = (n === 1 ? 0 : (k / (n - 1) - 0.5) * 2) * spread * (0.7 + 0.6 * hash(s, 2));
      const dx = depth === 2 ? 50 + 30 * hash(s, 3) : depth === 3 ? 38 + 30 * hash(s, 4) : 24 + 20 * hash(s, 5);
      const sx = b.found ? Math.max(...b.found.map((p) => p.x)) + 12 + measure(b.label, F.serif(600), 38) + 14 : e.x + 2;
      const kid = this.branch({ x: sx, y: e.y }, { x: sx + dx, y: e.y + dy }, depth, b.t0 + b.dur * 0.8 + 0.05 * hash(s, 8), 0.14 + 0.07 * depth, b.node, '', s);
      this.grow(kid, depth + 1, s);
      b.kids.push(kid);
    }
  }

  /** The tip's world x at time t: it runs under each word while it is sung, then on to the contact. */
  tipX(t: number): number {
    const ws = this.words;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i]!;
      if (t < w.start) return this.nodes[i]!;
      if (t <= w.end) return lerp(this.nodes[i]!, this.nodes[i + 1]!, Lyrics.wordProgress(w, t));
    }
    return this.xEnd;
  }

  /** The foraging branches (in world space; the canvas transform is the camera). */
  drawBranches(c: CanvasRenderingContext2D, t: number, z: number, A = 1) {
    const ws = this.words;
    const px = 1 / z;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const b of this.flatB) {
      const k = prog(t, b.t0, b.t0 + b.dur, ease.outCubic);
      if (k <= 0) continue;
      const w = ws[b.node]!;
      const passed = prog(t, w.end, w.end + 0.3);
      const dim = lerp(1, b.depth === 1 ? 0.55 : 0.62, passed);
      const base = b.depth === 1 ? (b.label ? 0.62 : 0.26) : b.depth === 2 ? 0.34 : b.depth === 3 ? 0.23 : 0.15;
      c.strokeStyle = rgba('bone', base * dim * A);
      c.lineWidth = Math.max(0.75 * px, b.w);
      const tot = b.L[b.L.length - 1]!, s = tot * k;
      c.beginPath();
      c.moveTo(b.pts[0]!.x, b.pts[0]!.y);
      let i = 1;
      for (; i < b.pts.length && b.L[i]! <= s; i++) c.lineTo(b.pts[i]!.x, b.pts[i]!.y);
      const q = at(b.pts, b.L, s);
      c.lineTo(q.x, q.y);
      c.stroke();
      // the hyphal tip: a rounded end, and the grain it found
      if (k > 0.97) {
        const lk = prog(t, b.t0 + b.dur * 0.95, b.t0 + b.dur * 0.95 + 0.12);
        c.fillStyle = rgba('bone', (b.depth === 1 ? 0.8 : 0.4) * dim * A * lk);
        c.beginPath(); c.arc(q.x, q.y, b.depth === 1 ? (b.label ? 3.4 : 2.2) : 1.5, 0, TAU); c.fill();
        if (b.found) {
          const gp = new Path2D(); addPoly(gp, b.found);
          c.fillStyle = rgba('ink', 0.9 * A * lk); c.fill(gp);
          c.strokeStyle = rgba('bone', 0.4 * dim * A * lk); c.lineWidth = Math.max(0.7 * px, 1); c.stroke(b.foundH!);
          c.strokeStyle = rgba('bone', 0.75 * dim * A * lk); c.lineWidth = Math.max(0.8 * px, 1.4); c.stroke(gp);
          c.font = font(F.serif(600), 38);
          c.textBaseline = 'middle';
          c.fillStyle = rgba('bone', 0.85 * dim * A * lk);
          const gx = Math.max(...b.found.map((p) => p.x));
          c.fillText(b.label, gx + 12, q.y + 2);
        }
      }
    }
  }

  /** The chosen hypha's walls and septa (bone), the lettering written by the tip. */
  drawTrunk(c: CanvasRenderingContext2D, t: number, z: number, t0: number, A = 1) {
    const tip = this.tipX(t);
    const px = 1 / z;
    // hook 4's hairline splits into the two walls of a tube in the first frames
    const open = prog(t, t0 + 0.04, t0 + 0.34, ease.inOutCubic);
    const hw = lerp(0.5, 3.4, open);
    c.strokeStyle = rgba('bone', 0.88 * A * smoothstep(0, 0.35, open));
    c.lineWidth = Math.max(0.9 * px, 1.5);
    const x0 = -900;
    c.beginPath();
    c.moveTo(x0, Y0 - hw); c.lineTo(tip, Y0 - hw);
    c.moveTo(x0, Y0 + hw); c.lineTo(tip, Y0 + hw);
    c.stroke();
    // the rounded growing end
    c.beginPath(); c.arc(tip, Y0, hw, -Math.PI / 2, Math.PI / 2); c.stroke();
    if (open > 0.02) {
      c.strokeStyle = rgba('bone', 0.55 * open * A); c.lineWidth = Math.max(0.7 * px, 1);
      c.beginPath();
      for (const s of this.septa) if (s < tip - 24) { c.moveTo(s, Y0 - hw); c.lineTo(s, Y0 + hw); }
      c.stroke();
    }
    // nodes: a small fork knot where each word starts
    this.words.forEach((w, i) => {
      if (t < w.start - 0.02) return;
      const nx = this.nodes[i]!;
      c.fillStyle = rgba('bone', 0.95 * A);
      c.beginPath(); c.arc(nx, Y0, 5.2, 0, TAU); c.fill();
      c.fillStyle = rgba('ink', A);
      c.beginPath(); c.arc(nx, Y0, 2.3, 0, TAU); c.fill();
    });
  }

  /** The line, written by the tip glyph by glyph: blue while sung, cooling to bone. */
  drawWords(c: CanvasRenderingContext2D, t: number, A = 1) {
    const tip = this.tipX(t);
    c.textBaseline = 'alphabetic';
    this.words.forEach((w, i) => {
      if (t < w.start) return;
      const x = this.tokX[i]!;
      const cool = prog(t, w.end, w.end + 0.3);
      c.save();
      c.beginPath();
      // an italic wipe: the clip leans with the letters
      const r = Math.max(0, tip - x + 6), sl = 0.2 * 130;
      c.moveTo(x - 30, Y0 + 20); c.lineTo(x - 30 + sl, Y0 - 150); c.lineTo(x + r + sl, Y0 - 150); c.lineTo(x + r, Y0 + 20); c.closePath();
      c.clip();
      c.font = font(this.fam, this.tokSize);
      c.fillStyle = cool >= 1 ? rgba('bone', 0.95 * A) : mix('signal', 'bone', cool, A);
      c.fillText(w.w, x, Y0 - 30);
      c.restore();
    });
  }
}

function mix(a: string, b: string, k: number, alpha: number) {
  const pa = rgba(a).match(/\d+/g)!.map(Number), pb = rgba(b).match(/\d+/g)!.map(Number);
  return `rgba(${[0, 1, 2].map((i) => Math.round(pa[i]! + (pb[i]! - pa[i]!) * k)).join(',')},${alpha})`;
}

// ================================================================== the network (movement 2)
interface Tree { id: string; x: number; y: number; r: number; seed: number; nRoots: number; age: number }
interface Root { pts: P[]; w0: number; w1: number; tips: P[]; tree: string }
export interface Strand { pts: P[]; L: number[]; cord: boolean; delay: number; seed: number }

export class Network {
  trees: Tree[] = [];
  roots: Root[] = [];
  rootA!: Root;
  /** Engraving groups (world px). */
  fill = new Path2D();
  outline = new Path2D();
  hatch = new Path2D();
  bark = new Path2D();
  tipsP = new Path2D();
  trunkFill = new Path2D();
  groups: { body: Path2D; hatch: Path2D; bark: Path2D }[] = [];
  rings = new Path2D();
  ringsHeavy = new Path2D();
  strands: Strand[] = [];
  plate = { x0: 0, y0: 0, x1: 0, y1: 0 };
  P!: P; // the contact
  TA!: P;
  lettering!: PathText;
  letterPath: P[] = [];
  /** Tree a's root from the contact to the trunk (the exchange runs along it). */
  rootPath: P[] = [];
  rootL: number[] = [];
  letterL: number[] = [];

  constructor(public hypha: HyphaTree, hook: Word[]) {
    const xE = hypha.xEnd;
    this.P = { x: xE, y: Y0 };
    this.TA = { x: xE + 1260, y: Y0 + 400 };
    this.trees = [
      { id: 'a', x: this.TA.x, y: this.TA.y, r: 150, seed: 11, nRoots: 8, age: 180 },
      { id: 'b', x: 1340, y: 1590, r: 128, seed: 23, nRoots: 8, age: 150 },
      { id: 'c', x: -560, y: 250, r: 104, seed: 37, nRoots: 7, age: 120 },
      { id: 'd', x: 1160, y: -390, r: 246, seed: 41, nRoots: 10, age: 400 },
      { id: 'e', x: xE + 380, y: -360, r: 94, seed: 53, nRoots: 7, age: 90 },
      { id: 'f', x: 190, y: 1470, r: 78, seed: 67, nRoots: 6, age: 60 },
      { id: 'g', x: xE + 330, y: 1560, r: 104, seed: 71, nRoots: 7, age: 110 },
      { id: 'h', x: -720, y: 1310, r: 66, seed: 83, nRoots: 6, age: 40 },
      { id: 'i', x: xE + 1560, y: -330, r: 70, seed: 97, nRoots: 6, age: 45 },
    ];
    const bx0 = -1180, bx1 = xE + 2020;
    const bw = bx1 - bx0, bh = (bw * 9) / 16;
    const cy = 600;
    this.plate = { x0: bx0, y0: cy - bh / 2, x1: bx1, y1: cy + bh / 2 };
    this.build();
    // the hook, lettered along tree a's root from the contact toward the trunk (above the root)
    const rp = this.rootA.pts.slice().reverse();
    this.rootPath = rp; this.rootL = lengths(rp);
    const up = offset(rp, (i) => lerp(this.rootA.w1, this.rootA.w0, i / (rp.length - 1)) / 2 + 16);
    this.letterPath = resample(up, 6);
    this.letterL = lengths(this.letterPath);
    const len = this.letterL[this.letterL.length - 1]!;
    const fam = F.archivo(62, 900);
    const size = PathText.fit(hook, fam, 84, len - 150, 2);
    this.lettering = new PathText(hook, fam, size, this.letterPath, 60, 2);
  }

  private build() {
    // roots: radiating, wobbling, tapering; tree a's root toward the contact is placed by hand
    for (const tr of this.trees) {
      const rnd = mulberry32(tr.seed);
      const a0 = rnd() * TAU;
      for (let k = 0; k < tr.nRoots; k++) {
        const ang = a0 + (k / tr.nRoots) * TAU + (rnd() - 0.5) * 0.5;
        const len = tr.r * (3.2 + 2.6 * rnd());
        this.roots.push(this.makeRoot(tr, ang, len, tr.r * (0.42 + 0.14 * rnd()), tr.seed * 7 + k));
      }
      if (tr.id === 'a') {
        const ang = Math.atan2(this.P.y - tr.y, this.P.x - tr.x);
        const len = Math.hypot(this.P.x - tr.x, this.P.y - tr.y) - tr.r * 0.9;
        this.rootA = this.makeRoot(tr, ang, len, tr.r * 0.62, 5, this.P);
        this.roots.push(this.rootA);
      }
      if (tr.id === 'c') {
        // the root the hypha came from (its tip is off the first frame, to the left)
        const tip = { x: -250, y: Y0 };
        const ang = Math.atan2(tip.y - tr.y, tip.x - tr.x);
        this.roots.push(this.makeRoot(tr, ang, Math.hypot(tip.x - tr.x, tip.y - tr.y) - tr.r * 0.9, tr.r * 0.5, 9, tip));
      }
    }
    for (const r of this.roots) this.engraveRoot(r);
    for (const tr of this.trees) this.engraveTrunk(tr);
    this.buildStrands();
  }

  private makeRoot(tr: Tree, ang: number, len: number, w0: number, seed: number, end?: P): Root {
    const rnd = mulberry32(seed);
    const s = { x: tr.x + Math.cos(ang) * tr.r * 0.9, y: tr.y + Math.sin(ang) * tr.r * 0.9 };
    const e = end ?? { x: tr.x + Math.cos(ang) * (tr.r + len), y: tr.y + Math.sin(ang) * (tr.r + len) };
    const cp: P[] = [];
    const n = 5;
    const nx = -(e.y - s.y) / len, ny = (e.x - s.x) / len;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const off = i === 0 || i === n ? 0 : (rnd() - 0.5) * len * 0.16 * Math.sin(Math.PI * u) * (end ? 0.5 : 1);
      cp.push({ x: lerp(s.x, e.x, u) + nx * off, y: lerp(s.y, e.y, u) + ny * off });
    }
    const pts = spline(cp, 10);
    const tips: P[] = [e];
    // one or two laterals
    const nl = end ? 2 : 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < nl; k++) {
      const L = lengths(pts);
      const q = at(pts, L, L[L.length - 1]! * (0.35 + 0.35 * rnd()));
      const side = rnd() < 0.5 ? -1 : 1;
      if (end && side < 0) continue; // keep the lettered side of tree a's root clear
      const la = q.a + side * (0.6 + 0.5 * rnd());
      const ll = len * (0.25 + 0.2 * rnd());
      const le = { x: q.x + Math.cos(la) * ll, y: q.y + Math.sin(la) * ll };
      const lp = spline([{ x: q.x, y: q.y }, { x: lerp(q.x, le.x, 0.5) + (rnd() - 0.5) * 30, y: lerp(q.y, le.y, 0.5) + (rnd() - 0.5) * 30 }, le], 10);
      const lr: Root = { pts: lp, w0: w0 * 0.28, w1: 5, tips: [le], tree: tr.id };
      this.roots.push(lr);
    }
    return { pts, w0, w1: end ? 10 : 7, tips, tree: tr.id };
  }

  private engraveRoot(r: Root) {
    const { outline, A, B } = tube(r.pts, (u) => lerp(r.w0, r.w1, Math.pow(u, 0.7)));
    // each root is drawn whole (fill, shade, bark, outline) in order, laterals before their parent,
    // so a parent covers where its laterals leave it
    const g = { body: new Path2D(), hatch: new Path2D(), bark: new Path2D() };
    this.groups.push(g);
    addPoly(g.body, outline);
    const hatchP = this.hatch, barkP = this.bark;
    this.hatch = g.hatch; this.bark = g.bark;
    // shade: short strokes in from the lower-right edge (light from the upper left)
    const N = r.pts.length;
    for (let i = 1; i < N - 1; i++) {
      const a = A[i]!, b = B[i]!;
      const nx = b.x - a.x, ny = b.y - a.y; // across the root, A -> B
      const lit = (nx * 0.55 + ny * 0.83) > 0 ? b : a; // the edge facing away from the light
      const other = lit === b ? a : b;
      const w = Math.hypot(nx, ny);
      if (w < 6) continue;
      const k = 0.38 + 0.12 * Math.sin(i * 1.7);
      this.hatch.moveTo(lit.x, lit.y);
      this.hatch.lineTo(lerp(lit.x, other.x, k), lerp(lit.y, other.y, k));
    }
    // bark: two broken lines along the root
    for (const f of [-0.22, 0.2]) {
      const inner = offset(r.pts, (i) => lerp(r.w0, r.w1, Math.pow(i / (N - 1), 0.7)) * f);
      let pen = false;
      for (let i = 0; i < inner.length - 3; i++) {
        const on = Math.sin(i * 0.9 + f * 40) > -0.3;
        if (on && !pen) { this.bark.moveTo(inner[i]!.x, inner[i]!.y); pen = true; } else if (on) this.bark.lineTo(inner[i]!.x, inner[i]!.y); else pen = false;
      }
    }
    this.hatch = hatchP; this.bark = barkP;
    // mycorrhizal tips: short forked clubs round each root end (the fungal sheath)
    for (const tp of r.tips) {
      const rnd = mulberry32(Math.round(tp.x * 7 + tp.y * 3));
      for (let k = 0; k < 5; k++) {
        const a = rnd() * TAU, l = 14 + 16 * rnd();
        const bx = tp.x + Math.cos(a) * 6, by = tp.y + Math.sin(a) * 6;
        const ex = bx + Math.cos(a) * l, ey = by + Math.sin(a) * l;
        this.tipsP.moveTo(bx, by); this.tipsP.lineTo(ex, ey);
        for (const s of [-0.45, 0.45]) { this.tipsP.moveTo(ex, ey); this.tipsP.lineTo(ex + Math.cos(a + s) * 8, ey + Math.sin(a + s) * 8); }
        addCircle(this.tipsP, ex, ey, 2.2);
      }
    }
  }

  private engraveTrunk(tr: Tree) {
    const rnd = mulberry32(tr.seed * 3 + 1);
    const ringPts = (rr: number, amp: number, seed: number) => {
      const pts: P[] = [];
      const r2 = mulberry32(seed);
      const ph = [r2() * TAU, r2() * TAU, r2() * TAU];
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU;
        const k = 1 + amp * (Math.sin(a * 2 + ph[0]!) * 0.5 + Math.sin(a * 3 + ph[1]!) * 0.3 + Math.sin(a * 5 + ph[2]!) * 0.2);
        pts.push({ x: tr.x + Math.cos(a) * rr * k, y: tr.y + Math.sin(a) * rr * k });
      }
      return pts;
    };
    addPoly(this.trunkFill, ringPts(tr.r * 1.08, 0.04, tr.seed));
    addPoly(this.ringsHeavy, ringPts(tr.r * 1.08, 0.04, tr.seed));
    addPoly(this.ringsHeavy, ringPts(tr.r * 0.97, 0.04, tr.seed));
    // bark between the two outer lines: radial ticks
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * TAU + rnd() * 0.05;
      this.bark.moveTo(tr.x + Math.cos(a) * tr.r * 0.98, tr.y + Math.sin(a) * tr.r * 0.98);
      this.bark.lineTo(tr.x + Math.cos(a) * tr.r * 1.06, tr.y + Math.sin(a) * tr.r * 1.06);
    }
    // growth rings (their count reads the age, roughly)
    const n = Math.max(5, Math.round(tr.age / 22));
    for (let k = 1; k <= n; k++) {
      const rr = tr.r * 0.92 * Math.pow(k / (n + 0.6), 0.85);
      addPoly(this.rings, ringPts(rr, 0.035 + 0.02 * (k / n), tr.seed + k * 7));
    }
    // two radial checks (cracks)
    for (let k = 0; k < 2; k++) {
      const a = rnd() * TAU;
      this.rings.moveTo(tr.x + Math.cos(a) * tr.r * 0.08, tr.y + Math.sin(a) * tr.r * 0.08);
      this.rings.lineTo(tr.x + Math.cos(a + 0.05) * tr.r * 0.55, tr.y + Math.sin(a + 0.05) * tr.r * 0.55);
    }
  }

  private buildStrands() {
    // one fungus: strands between root tips of different trees (and the hypha of movement 1)
    const tips: { p: P; tree: string }[] = [];
    for (const r of this.roots) for (const p of r.tips) tips.push({ p, tree: r.tree });
    const rnd = mulberry32(2024);
    const pairs = new Set<string>();
    for (let i = 0; i < tips.length; i++) {
      // each tip links to its 2-3 nearest tips of other trees
      const a = tips[i]!;
      const cand = tips.map((b, j) => ({ j, d: Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y), b })).filter((q) => q.b.tree !== a.tree && q.d < 1500).sort((x, y) => x.d - y.d);
      const n = 1 + Math.floor(rnd() * 1.7);
      for (const q of cand.slice(0, n)) {
        const key = i < q.j ? `${i}-${q.j}` : `${q.j}-${i}`;
        if (pairs.has(key)) continue;
        pairs.add(key);
        this.addStrand(a.p, q.b.p, rnd() < 0.2, Math.floor(rnd() * 1e6));
      }
    }
  }

  private addStrand(a: P, b: P, cord: boolean, seed: number) {
    const r = mulberry32(seed);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(d > 1)) return;
    const nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    const bend = (r() - 0.5) * d * 0.3;
    const cp = [a, { x: lerp(a.x, b.x, 0.33) + nx * bend * 0.8, y: lerp(a.y, b.y, 0.33) + ny * bend * 0.8 }, { x: lerp(a.x, b.x, 0.66) + nx * bend, y: lerp(a.y, b.y, 0.66) + ny * bend }, b];
    const pts = wobble(resample(spline(cp, 12), 10), cord ? 4 : 6, cord ? 300 : 210, seed);
    // mid-strand the fungus branches: a few short side hyphae
    const L = lengths(pts);
    this.strands.push({ pts, L, cord, delay: r(), seed });
    const ns = cord ? 0 : Math.floor(r() * 2.2);
    for (let k = 0; k < ns; k++) {
      const q = at(pts, L, L[L.length - 1]! * (0.2 + 0.6 * r()));
      const la = q.a + (r() < 0.5 ? -1 : 1) * (0.5 + 0.6 * r());
      const ll = 70 + 110 * r();
      const e = { x: q.x + Math.cos(la) * ll, y: q.y + Math.sin(la) * ll };
      const m = { x: lerp(q.x, e.x, 0.5) + Math.cos(q.a) * ll * 0.25, y: lerp(q.y, e.y, 0.5) + Math.sin(q.a) * ll * 0.25 };
      const sp = resample(spline([{ x: q.x, y: q.y }, m, e], 10), 10);
      this.strands.push({ pts: sp, L: lengths(sp), cord: false, delay: r(), seed: seed + k + 1 });
    }
  }

  /** Engraved roots and trunks (world space). `k` = line-width factor for the zoom. */
  drawRoots(c: CanvasRenderingContext2D, z: number, A = 1) {
    const k = Math.pow(z, -0.55);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const fill = rgba('ink', 0.94 * A), hs = rgba('bone', 0.3 * A), bs = rgba('bone', 0.2 * A), os = rgba('bone', 0.8 * A);
    for (const g of this.groups) {
      c.fillStyle = fill; c.fill(g.body);
      c.strokeStyle = hs; c.lineWidth = 0.9 * k; c.stroke(g.hatch);
      c.strokeStyle = bs; c.lineWidth = 0.8 * k; c.stroke(g.bark);
      c.strokeStyle = os; c.lineWidth = 1.5 * k; c.stroke(g.body);
    }
    c.strokeStyle = rgba('bone', 0.38 * A); c.lineWidth = 0.9 * k; c.stroke(this.tipsP);
    c.fillStyle = fill; c.fill(this.trunkFill);
    c.strokeStyle = rgba('bone', 0.36 * A); c.lineWidth = 0.8 * k; c.stroke(this.rings);
    c.strokeStyle = rgba('bone', 0.9 * A); c.lineWidth = 2.2 * k; c.stroke(this.ringsHeavy);
  }

  /** Tree letters (engraved italics), the plate's border, title, caption and labels. */
  drawFurniture(c: CanvasRenderingContext2D, z: number, A = 1, lab = 1) {
    const k = Math.pow(z, -0.55);
    c.textBaseline = 'alphabetic';
    c.font = font(F.serif(400, true), 64);
    c.fillStyle = rgba('bone', 0.7 * A);
    for (const tr of this.trees) c.fillText(tr.id, tr.x + tr.r * 0.78, tr.y - tr.r * 0.86);
    const P = this.plate;
    if (lab <= 0) return;
    const a = A * lab;
    const s = 2.7; // furniture drawn at the plate's scale (it is read at the wide framing)
    border(c, P.x0 + 40, P.y0 + 40, P.x1 - 40, P.y1 - 40, a, k * 2.2);
    c.save();
    c.translate(P.x0 + 150, P.y0 + 190); c.scale(s, s);
    plateTitle(c, 0, 0, 'PL. XVI', 'MYCORRHIZAL NETWORK, IN PLAN · SOIL REMOVED', a);
    c.restore();
    c.save();
    c.translate(P.x0 + 150, P.y1 - 230); c.scale(s, s);
    caption(c, 0, 0, [
      'Fig. 16. — Forest floor, a–i, trees; the fine lines, one fungus. Roots give it sugar; it gives them',
      'phosphorus, nitrogen, water. No single tree owns the network.',
    ], a);
    c.restore();
    c.save();
    c.translate(P.x1 - 820, P.y1 - 470); c.scale(s, s);
    specimen(c, 0, 0, 250, ['SPECIMEN 16·a', '1 fungus · 9 trees', 'owner: none', 'fee: up to 20 % of the sugar'], a, 1 / s);
    c.restore();
    c.save();
    c.translate(P.x0 + 150, P.y1 - 380); c.scale(s, s);
    scaleBar(c, 0, 0, 120, '1 m', a, 1 / s);
    c.restore();
    // a north arrow (it is a map)
    c.save();
    c.translate(P.x1 - 260, P.y0 + 260);
    c.strokeStyle = rgba('bone', 0.55 * a); c.lineWidth = 3 * k;
    c.beginPath(); c.moveTo(0, 90); c.lineTo(0, -90); c.moveTo(-26, -40); c.lineTo(0, -90); c.lineTo(26, -40); c.stroke();
    c.font = font(F.serif(600), 60); c.fillStyle = rgba('bone', 0.6 * a); c.textAlign = 'center';
    c.fillText('N', 0, -120);
    c.textAlign = 'left';
    c.restore();
  }
}

/** A point along a strand at arc fraction u. */
export function strandAt(s: Strand, u: number) { return at(s.pts, s.L, s.L[s.L.length - 1]! * clamp(u)); }
