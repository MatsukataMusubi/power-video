// verseB (hall.ts): the drawing. One sheet, world units (1 u = 5 mm, y down, north up): a data-hall
// floor plan. Rack rows run east–west in pairs around cold aisles (period 960 u = two 600 mm × 1200 mm
// rack rows, a 1200 mm cold aisle and a 1200 mm hot aisle); a cross aisle splits the hall into a west
// and an east block; CRAH units stand along the west and east walls. Row ends facing the cross aisle
// are drawn as developed elevations laid flat in the aisle (their "up" points east), the way interior
// elevations are folded into a plan. One of them, row J's end cabinet, carries the certificate.
// This module holds the geometry, the tracer's route, the airflow fields that the simulation draws
// (mirrored exactly in GLSL, hall-gl.ts) and isoline tracing for the contour labels.
import { clamp, lerp } from '../engine/util';

export const TILE = 120;
export const PERIOD = 960;

export const HALL = {
  RW0: -2760, RW1: 0, // west block of rows (x)
  RE0: 840, RE1: 3720, // east block
  K0: -2, K1: 3, // row pairs: cold aisle centres at y = 960 k
  X0: -3720, X1: 4680, Y0: -2760, Y1: 3720, // inner faces of the walls
  LX0: -2400, // the first lettered tile of cold aisle 3
  XC: 360, R: 240, // the swerve: corner start, radius (the lane runs south at x = XC + R)
};
export const ROWS = 'ABCDEFGHIJKL';
/** Cold aisle numbers (pair k → aisle k + 3), the tracer's aisle is 3 (rows E/F). */
export const aisleNo = (k: number) => k - HALL.K0 + 1;

/** Row-end cabinet of row J (pair 2, south row), developed flat into the cross aisle, up = east. */
export const PANEL = { x0: HALL.RW1, yc: 2 * PERIOD + 240, w: 240, h: 400 };
/** Panel drawing coords (px right = south, py down = west, origin top-left) → world. */
export function panelToWorld(px: number, py: number, p = PANEL) {
  return { x: p.x0 + p.h - py, y: p.yc - p.w / 2 + px };
}
/** Canvas transform for drawing in panel coords (inside a world transform). */
export function panelTransform(c: CanvasRenderingContext2D, p = PANEL) {
  c.transform(0, 1, -1, 0, p.x0 + p.h, p.yc - p.w / 2);
}
/** Certificate on the door (panel coords) and its rank box; the empty 3U slot (the hand-off). */
export const CERT = { x: 20, y: 40, w: 200, h: 136, rank: { x: 102, y: 70, w: 82, h: 30 } };
export const SLOT_ASPECT = 36 / 132;
export const SLOT = { x: 135, y: 300 - 90 * SLOT_ASPECT, w: 90, h: 90 * SLOT_ASPECT };
export const slotCentre = () => panelToWorld(SLOT.x + SLOT.w / 2, SLOT.y + SLOT.h / 2);
export const certCentre = () => panelToWorld(CERT.x + CERT.w / 2, CERT.y + CERT.h / 2);
export const rankCentre = () => panelToWorld(CERT.x + CERT.rank.x + CERT.rank.w / 2, CERT.y + CERT.rank.y + CERT.rank.h / 2);
/** The simulation's hot spot: the missing blanking panel (the slot), where hot air leaks through. */
export const HOT = (() => { const s = slotCentre(); return { x: s.x - 60, y: s.y }; })();

// ------------------------------------------------------------------ the route
export interface PathPt { x: number; y: number; a: number }
export class Route {
  pts: { x: number; y: number }[] = [];
  L: number[] = [];
  constructor(pts: { x: number; y: number }[]) {
    this.pts = pts;
    let s = 0;
    this.L = pts.map((p, i) => (i ? (s += Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y)) : 0));
  }
  get length() { return this.L[this.L.length - 1]!; }
  at(s: number): PathPt {
    const L = this.L, n = L.length;
    s = clamp(s, 0, L[n - 1]!);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m]! < s) lo = m; else hi = m; }
    const a = this.pts[lo]!, b = this.pts[hi]!, seg = L[hi]! - L[lo]!;
    const u = seg > 0 ? (s - L[lo]!) / seg : 0;
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), a: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  /** Arc length of the point nearest (x, y) (brute force; init only). */
  nearest(x: number, y: number) {
    let best = 0, bd = Infinity;
    this.pts.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = this.L[i]!; } });
    return best;
  }
}

/** The tracer's route: east along cold aisle 3, a right-hand swerve into the cross aisle, south down the lane, onto the rank box. */
export function makeRoute() {
  const { XC, R } = HALL;
  const pts: { x: number; y: number }[] = [];
  for (let x = HALL.RW0 - 120; x < XC; x += 20) pts.push({ x, y: 0 });
  for (let i = 0; i <= 40; i++) { const th = -Math.PI / 2 + (i / 40) * (Math.PI / 2); pts.push({ x: XC + R * Math.cos(th), y: R + R * Math.sin(th) }); }
  const p0 = { x: XC + R, y: R }, p3 = rankCentre();
  const p1 = { x: p0.x, y: p0.y + 900 }, p2 = { x: p3.x + 330, y: p3.y - 360 };
  for (let i = 1; i <= 120; i++) {
    const u = i / 120, v = 1 - u;
    pts.push({
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    });
  }
  return new Route(pts);
}
/** Arc length where the lettered tiles start (x = LX0) and where the corner starts. */
export const S_TILES = HALL.LX0 - (HALL.RW0 - 120);
export const S_CORNER = HALL.XC - (HALL.RW0 - 120);
export const S_LANE = S_CORNER + (Math.PI / 2) * HALL.R;

// ------------------------------------------------------------------ the airflow (mirrored in hall-gl.ts)
const ss = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const PAIR_Y0 = HALL.K0 * PERIOD - 480, PAIR_Y1 = HALL.K1 * PERIOD + 480;

/** Where rows exist (x): 1 inside either block, fading over a few hundred units past the ends. */
export function rowMask(x: number, y: number) {
  const inW = ss(HALL.RW0 - 300, HALL.RW0 + 60, x) * (1 - ss(HALL.RW1 - 60, HALL.RW1 + 300, x));
  const inE = ss(HALL.RE0 - 300, HALL.RE0 + 60, x) * (1 - ss(HALL.RE1 - 60, HALL.RE1 + 300, x));
  return Math.max(inW, inE) * ss(PAIR_Y0 - 200, PAIR_Y0 + 100, y) * (1 - ss(PAIR_Y1 - 100, PAIR_Y1 + 200, y));
}

/** Air temperature (°C) at mid-rack height: cold aisles 18 °C, hot aisles ~38 °C, recirculation at the row ends, the leak at the slot. */
export function tempAt(x: number, y: number) {
  const yl = y - PERIOD * Math.floor(y / PERIOD + 0.5);
  const a = Math.abs(yl);
  const dEnd = Math.min(Math.abs(x - HALL.RW1), Math.abs(x - HALL.RE0));
  const warm = 4.5 * Math.exp(-dEnd / 520);
  const ac = Math.min(a, 120);
  const t1 = 18 + warm + 5.5 * (ac * ac) / 14400;
  let T = t1 + (35 - t1) * ss(120, 360, a) + 3 * ss(360, 480, a);
  const wav = 1.3 * Math.sin(x * 0.0061 + 1.7 * Math.sin(y * 0.0043 + x * 0.0011)) + 0.7 * Math.sin(y * 0.009 - x * 0.0027 + 2.0);
  T += wav * (0.45 + 0.55 * ss(90, 200, a));
  const room = 27 + 1.2 * Math.sin(x * 0.0017 + y * 0.0023) + 0.8 * Math.sin(y * 0.0051 - 1.0);
  T = lerp(room, T, rowMask(x, y));
  const dx = x - HOT.x, dy = y - HOT.y;
  T += 9 * Math.exp(-(dx * dx + dy * dy) / (190 * 190));
  return T;
}

export const ISO_STEP = 2; // °C between isolines

/** Numerical gradient of the temperature. */
export function tempGrad(x: number, y: number, h = 1.5) {
  return { x: (tempAt(x + h, y) - tempAt(x - h, y)) / (2 * h), y: (tempAt(x, y + h) - tempAt(x, y - h)) / (2 * h) };
}

/**
 * Trace the isoline T = T0 from near (x, y), marching in the direction whose x component is `dir`
 * (predictor step along the tangent, Newton correction back onto the line). Returns points every `step`.
 */
export function traceIso(T0: number, x: number, y: number, len: number, dir = 1, step = 3) {
  const snap = (p: { x: number; y: number }) => {
    for (let k = 0; k < 4; k++) {
      const g = tempGrad(p.x, p.y), gg = g.x * g.x + g.y * g.y;
      if (gg < 1e-10) break;
      const e = tempAt(p.x, p.y) - T0;
      p.x -= (e * g.x) / gg; p.y -= (e * g.y) / gg;
    }
    return p;
  };
  const p = snap({ x, y });
  const out = [{ x: p.x, y: p.y }];
  let d = 0;
  while (d < len) {
    const g = tempGrad(p.x, p.y);
    let tx = -g.y, ty = g.x;
    const n = Math.hypot(tx, ty) || 1;
    tx /= n; ty /= n;
    if (tx * dir < 0) { tx = -tx; ty = -ty; }
    p.x += tx * step; p.y += ty * step;
    snap(p);
    out.push({ x: p.x, y: p.y });
    d += step;
  }
  return out;
}

/** Where along x (at fixed x) the isoline T0 crosses, searching y in [y0, y1] (bisection on the first bracket). */
export function isoY(T0: number, x: number, y0: number, y1: number) {
  const n = 200;
  let pa = y0, fa = tempAt(x, y0) - T0;
  for (let i = 1; i <= n; i++) {
    const yb = lerp(y0, y1, i / n), fb = tempAt(x, yb) - T0;
    if (fa * fb <= 0) {
      let lo = pa, hi = yb, flo = fa;
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2, fm = tempAt(x, m) - T0; if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; } }
      return (lo + hi) / 2;
    }
    pa = yb; fa = fb;
  }
  return (y0 + y1) / 2;
}
