// world2 ③: the paper goes black and a whole transmission network lights up at night around the sync
// point, drawn as a map: 400 kV corridors (double lines with their tower ticks) radiating from the
// dot, 220 kV ties between them, power stations (circle and tilde) and towns on spurs. The camera
// pulls back across the bar as the energised front runs out, one jump per sung word; the line is set
// along the corridor running east from the dot and lit by the front along it (the cursor). On every
// beat a ring of light leaves the dot; the map turns one click per word. The last 0.2 s it all
// collapses into the dot, with a white flash, into ④.
import { W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, lerp, mulberry32, prog, TAU } from '../engine/util';
import { dot2D } from './_power';
import { type Timing, upper } from './grid-kit';

/** kind: 0 substation, 1 power station, 2 town. */
interface Node { r: number; a: number; kind: 0 | 1 | 2; h: number }
interface Edge { a: number; b: number; hv: boolean; h: number }

const NC = 8;
const RAD = [130, 290, 470, 670, 890, 1130, 1390, 1680, 2000];
const A_LINE = -0.17; // the lyric corridor's bearing (rad, clockwise from east)
const TXT_F = F.archivo(62, 900), TXT_S = 50, TXT_R0 = 58;
const TXT_CLEAR = 4; // the lyric corridor has no substations under the text

export class Net {
  nodes: Node[] = [{ r: 0, a: 0, kind: 0, h: 0 }];
  edges: Edge[] = [];
  constructor(public T: Timing) {
    const rnd = mulberry32(5150);
    const corr: number[][] = [];
    for (let k = 0; k < NC; k++) {
      const a0 = A_LINE + (k * TAU) / NC + (k ? (rnd() - 0.5) * 0.4 : 0);
      const bend = k ? (rnd() - 0.5) * 0.5 : 0;
      const ids: number[] = [];
      RAD.forEach((R, j) => {
        if (k === 0 && j < TXT_CLEAR) { ids.push(-1); return; }
        const r = R * (1 + (k ? (rnd() - 0.5) * 0.3 : 0));
        const a = a0 + bend * Math.pow(r / 1000, 1.3) + (k ? (rnd() - 0.5) * 0.06 : 0);
        ids.push(this.add({ r, a, kind: 0, h: rnd() }));
      });
      corr.push(ids);
      // along the corridor, from the dot
      let prev = 0;
      for (const id of ids) { if (id < 0) continue; this.edges.push({ a: prev, b: id, hv: true, h: rnd() }); prev = id; }
      // a fork further out: a second corridor splits off and runs on to the edge of the map
      const jf = 2 + Math.floor(rnd() * 3);
      const from = ids[jf]!;
      if (from >= 0) {
        const side = rnd() < 0.5 ? -1 : 1;
        let p2 = from;
        const a1 = this.nodes[from]!.a;
        for (let j = jf + 1; j < RAD.length; j++) {
          const r = RAD[j]! * (1 + (rnd() - 0.5) * 0.3);
          const id = this.add({ r, a: a1 + side * (0.2 + 0.12 * (j - jf)) * (700 / r) + (rnd() - 0.5) * 0.05, kind: 0, h: rnd() });
          this.edges.push({ a: p2, b: id, hv: j - jf < 3 || rnd() < 0.5, h: rnd() });
          p2 = id;
        }
      }
    }
    // 220 kV ties between neighbouring corridors, diagonals, and spurs to stations and towns
    for (let k = 0; k < NC; k++) {
      const A = corr[k]!, B = corr[(k + 1) % NC]!;
      for (let j = 1; j < RAD.length; j++) {
        const a = A[j]!;
        if (a < 0 || rnd() > 0.5) continue;
        const b = B[Math.min(RAD.length - 1, Math.max(1, j + (rnd() < 0.5 ? 0 : rnd() < 0.5 ? -1 : 1)))]!;
        if (b >= 0) this.edges.push({ a, b, hv: rnd() < 0.2, h: rnd() });
      }
      A.forEach((id, j) => {
        if (id < 0 || j < 1) return;
        const nd = this.nodes[id]!;
        const q = rnd();
        if (q < 0.3) {
          const s = this.add({ r: nd.r + 60 + 70 * rnd(), a: nd.a + (rnd() < 0.5 ? -1 : 1) * (0.08 + 0.1 * rnd()), kind: 1, h: rnd() });
          this.edges.push({ a: id, b: s, hv: false, h: rnd() });
        } else if (q < 0.62) {
          const side = rnd() < 0.5 ? -1 : 1;
          let last = id;
          for (let m = 0; m < 3; m++) {
            const tn = this.add({ r: nd.r + (rnd() - 0.3) * 50, a: nd.a + side * (0.05 + 0.035 * m) * (900 / Math.max(300, nd.r)), kind: 2, h: rnd() });
            this.edges.push({ a: last, b: tn, hv: false, h: rnd() });
            last = tn;
          }
        }
      });
    }
  }
  private add(n: Node) { this.nodes.push(n); return this.nodes.length - 1; }

  /** Map scale: the camera pulls back across the bar (network px → screen px). */
  scale(t: number) {
    const T = this.T;
    return Math.exp(lerp(Math.log(2.5), Math.log(0.72), ease.outCubic(prog(t, T.cutC, T.cutD - 0.25))));
  }

  /** How far out the network is energised (network px): creeping out, and one jump per sung word. */
  front(t: number) {
    const T = this.T, ws = T.w3, n = ws.length;
    let R = 1900 * Math.pow(prog(t, T.cutC, T.cutD - 0.3), 1.6);
    ws.forEach((w, k) => { R = Math.max(R, 2100 * Math.pow((k + 1) / n, 2.6) * ease.outExpo(clamp((t - w.start) / (k === n - 1 ? 0.45 : 0.3)))); });
    return R;
  }

  draw(lb: LineBatch, c: CanvasRenderingContext2D, t: number, P: { x: number; y: number }, beatPhase: number) {
    const T = this.T;
    const ws = T.w3;
    const collapse = prog(t, T.cutD - 0.2, T.cutD, ease.inCubic);
    const draw = prog(t, T.cutC + 0.02, T.cutC + 0.34, ease.outCubic);
    let rot = 0;
    for (const w of ws) rot += 0.045 * ease.outExpo(clamp((t - w.start) / 0.25));
    const s = this.scale(t) * (1 - collapse);
    const Rf = this.front(t);
    const pos = (i: number) => { const nd = this.nodes[i]!; return { x: P.x + Math.cos(nd.a + rot) * nd.r * s, y: P.y + Math.sin(nd.a + rot) * nd.r * s }; };
    const sc = (col: readonly number[], k: number): [number, number, number] => [col[0]! * k, col[1]! * k, col[2]! * k];
    const DIM_HV = sc(LIN.bone, 0.085), DIM_LV = sc(LIN.bone, 0.05);
    const SIG = LIN.signal, EMB = LIN.ember;
    const ringR = 30 + 1500 * ease.outQuad(clamp(beatPhase * 1.15));
    const ringA = (1 - clamp(beatPhase * 1.15)) * prog(t, T.cutC, T.cutC + 0.05) * (1 - collapse);
    const onScreen = (p: { x: number; y: number }, m = 60) => p.x > -m && p.x < W + m && p.y > -m && p.y < H + m;

    const line = (ax: number, ay: number, bx: number, by: number, w: number, col: [number, number, number], hv: boolean) => {
      if (!hv) { lb.seg2(ax, ay, bx, by, w, col, 1); return; }
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, o = 1.4 + 0.6 * Math.min(1, s), nx = (-dy / L) * o, ny = (dx / L) * o;
      lb.seg2(ax + nx, ay + ny, bx + nx, by + ny, w, col, 1);
      lb.seg2(ax - nx, ay - ny, bx - nx, by - ny, w, col, 1);
    };

    for (const e of this.edges) {
      const na = this.nodes[e.a]!, nb = this.nodes[e.b]!;
      const pa = pos(e.a), pb = pos(e.b);
      if (!onScreen(pa, 300) && !onScreen(pb, 300)) continue;
      const vis = clamp(draw * 1.3 - e.h * 0.3);
      if (vis <= 0) continue;
      const [pi, po, ri, ro] = na.r <= nb.r ? [pa, pb, na.r, nb.r] : [pb, pa, nb.r, na.r];
      // the map, unlit: drawn in from the outer end
      line(po.x, po.y, lerp(po.x, pi.x, vis), lerp(po.y, pi.y, vis), e.hv ? 1 : 0.9, e.hv ? DIM_HV : DIM_LV, e.hv);
      const f = ro - ri < 1 ? (Rf >= ro ? 1 : 0) : clamp((Rf - ri) / (ro - ri));
      if (f <= 0) continue;
      const qx = lerp(pi.x, po.x, f), qy = lerp(pi.y, po.y, f);
      line(pi.x, pi.y, qx, qy, e.hv ? 1.25 : 1, e.hv ? sc(SIG, 1.15) : sc(SIG, 0.55), e.hv);
      if (f < 1) {
        const f0 = Math.max(0, f - 60 / Math.max(1, (ro - ri) * s));
        lb.seg2(lerp(pi.x, po.x, f0), lerp(pi.y, po.y, f0), qx, qy, e.hv ? 3 : 2, sc(EMB, 2.2), 1);
      }
      if (e.hv) {
        // tower ticks
        const dx = qx - pi.x, dy = qy - pi.y, L = Math.hypot(dx, dy);
        const nx = -dy / (L || 1), ny = dx / (L || 1), tl = 4 + 2 * Math.min(1, s);
        const step = Math.max(16, 30 * Math.min(1.4, s));
        for (let d = step / 2; d < L; d += step) {
          const x = pi.x + (dx * d) / L, y = pi.y + (dy * d) / L;
          lb.seg2(x - nx * tl, y - ny * tl, x + nx * tl, y + ny * tl, 0.9, sc(LIN.bone, 0.3), 1);
        }
      }
      // the beat's ring of light crossing this line
      if (ringA > 0.02 && ro * s > ringR && ri * s < ringR) {
        const k = clamp((ringR / s - ri) / Math.max(1, ro - ri));
        if (k <= f) {
          const k0 = Math.max(0, k - 34 / Math.max(1, (ro - ri) * s));
          lb.seg2(lerp(pi.x, po.x, k0), lerp(pi.y, po.y, k0), lerp(pi.x, po.x, k), lerp(pi.y, po.y, k), e.hv ? 2.6 : 1.8, sc(EMB, 1.7 * ringA), 1);
        }
      }
    }

    // ---- the lyric corridor: energised out to the sung text; its head is the cursor
    const th = A_LINE + rot;
    const dir = { x: Math.cos(th), y: Math.sin(th) };
    const words = ws.map((w) => upper(w.w));
    const gap = measure(' ', TXT_F, TXT_S) * 1.5;
    const starts: number[] = [];
    let acc = TXT_R0;
    for (const s0 of words) { starts.push(acc); acc += measure(s0, TXT_F, TXT_S) + gap; }
    let cur = 0;
    ws.forEach((w, k) => { const p = Lyrics.wordProgress(w, t); if (p > 0) cur = starts[k]! + measure(words[k]!, TXT_F, TXT_S) * p; });
    const rClear = RAD[TXT_CLEAR]!;
    const lit = Math.min(Math.max(cur, Math.min(Rf, rClear)), rClear);
    line(P.x, P.y, P.x + dir.x * rClear * s, P.y + dir.y * rClear * s, 1, DIM_HV, true);
    if (lit > 0) line(P.x, P.y, P.x + dir.x * lit * s, P.y + dir.y * lit * s, 1.3, sc(SIG, 1.2), true);
    if (cur > 0 && cur < acc) lb.seg2(P.x + dir.x * Math.max(0, cur - 50) * s, P.y + dir.y * Math.max(0, cur - 50) * s, P.x + dir.x * cur * s, P.y + dir.y * cur * s, 3.2, sc(EMB, 2.6), 1);

    // ---- nodes (Canvas): substations as squares, power stations as circles with the tilde, towns
    c.save();
    c.lineWidth = 1.3;
    for (let i = 1; i < this.nodes.length; i++) {
      const nd = this.nodes[i]!;
      const p = pos(i);
      if (!onScreen(p)) continue;
      const vis = clamp(draw * 1.3 - nd.h * 0.3);
      if (vis <= 0) continue;
      const on = nd.r <= Rf;
      const q = Math.max(1.2, 3.6 * Math.min(1.3, s));
      if (nd.kind === 1) {
        const R = q * 2.3;
        c.strokeStyle = rgba('bone', (on ? 0.9 : 0.2) * vis);
        c.beginPath(); c.arc(p.x, p.y, R, 0, TAU); c.stroke();
        c.beginPath();
        for (let k = 0; k <= 12; k++) { const u = -R * 0.6 + (R * 1.2 * k) / 12; const y = p.y - R * 0.28 * Math.sin((TAU * k) / 12); if (k) c.lineTo(p.x + u, y); else c.moveTo(p.x + u, y); }
        c.stroke();
      } else if (nd.kind === 2) {
        c.fillStyle = rgba('bone', (on ? 0.75 : 0.14) * vis);
        c.fillRect(p.x - q * 0.45, p.y - q * 0.45, q * 0.9, q * 0.9);
      } else {
        c.fillStyle = rgba('bone', (on ? 0.95 : 0.2) * vis);
        c.fillRect(p.x - q, p.y - q, 2 * q, 2 * q);
      }
    }
    // ---- the line, set along the corridor
    c.translate(P.x, P.y);
    c.rotate(th);
    c.scale(s, s);
    c.font = font(TXT_F, TXT_S);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    ws.forEach((w, k) => {
      const p = Lyrics.wordProgress(w, t);
      const ghost = prog(t, T.cutC + 0.05 + 0.05 * k, T.cutC + 0.3 + 0.05 * k);
      c.fillStyle = p <= 0 ? rgba('bone', 0.2 * ghost) : p < 1 ? rgba('signal', 1) : rgba('bone', 0.95);
      c.fillText(words[k]!, starts[k]!, -12);
    });
    c.restore();

    // ---- the dot at the centre (the sync point, now the grid's)
    const kick = Math.pow(1 - clamp(beatPhase), 6);
    dot2D(c, P.x, P.y, t, (1.5 + 0.5 * kick + 2.5 * collapse) * (1 - 0.3 * collapse), 1, 0.35 * (1 - collapse));
  }
}
