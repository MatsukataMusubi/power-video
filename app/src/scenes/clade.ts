// OUTRO V (the Neanderthal lines): a cladogram of the genus Homo, one drafted sheet. Structure: P(doom)'s
// leftturn, move for move (docs/PDOOM-STRUCTURE.md): one continuous sheet with no hard cut, a chase camera
// behind the thread object (the pen, the growing branch tip), three whips (true multi-tap motion blur)
// dividing it into blocks, a crane-out reveal with a deadpan callout, energy rising from stamps on the beats
// to per-syllable punches, one landing hit, and a drain to one shape handed to the next plate.
// Imagery (docs/PLATES.md #19): a time-calibrated tree whose Neanderthal branch joins the human one again.
//  A  The exhibit's last light is the tree's root. The sheet spreads out of it; the pen runs the backbone
//     (the sapiens lineage) and the tree grows with it, a side lineage dropping off at every node.
//  W1 On "Neanderthal" the pen swerves up the split onto the Neanderthal branch (whip pan, roll kick) and
//     plots the word along it; the Denisovans drop off it; the extinct tips are stamped † on the 8ths.
//     On "to" it turns down (a 90° roll whip) and draws the reticulation back to the human line, plotting
//     the rest of the line along it; the camera cranes out with a quarter turn back to north-up, the tree
//     completes itself to the present, the pen lands on the human line: a loop. NOT A TREE, filed.
//     "evolution," is plotted in the wide, in capitals the size of the tree, under the human line.
//  W2 Whip to DETAIL A, the reticulation at 10⁶:1: a short sequence bar, the gene it carried. On "kill"
//     the pen strikes it through, a punch per word; STATUS: PURGED.
//  W3 Whip back to the human line: "biology is superficial" plotted along it toward the present, its age
//     stamped under the pen on the beats, a punch per syllable. On "intelligence" the camera snaps onto a
//     new node near the present and the plotter draws a new branch in blue, out of the grammar of the rest
//     (straight, rising), one step per syllable; on "artificial" it lunges across the present line and
//     lands: the maximal hit. Everything drains but its tip, alone at the frame centre (HANDOFF.summit).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog, pulse, TAU } from '../engine/util';
import { dot2D, burst2D, HANDOFF } from './_power';
import { WorldLayer, makeCladePass, type Cam } from './clade-gl';
import { ROOT, NS, RET, ROW, NEW_NODE, NEW_ANG, NEW_DIR, DET, ageAt, ageLabel, type P } from './clade-tree';
import { Lettering, plotLettering, drawSheet, drawDetail, drawTree, inBox } from './clade-draw';

// ------------------------------------------------------------------ camera helpers
function mixCam(a: Cam, b: Cam, k: number): Cam {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rot: lerp(a.rot, b.rot, k), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)) };
}
function toScreen(c: Cam, x: number, y: number) {
  const dx = (x - c.x) * c.zoom, dy = (y - c.y) * c.zoom, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
  return { x: W / 2 + cs * dx - sn * dy, y: H / 2 + sn * dx + cs * dy };
}
/** The camera that puts world point P at screen point s with zoom z and roll r. */
function camAnchor(Px: number, Py: number, sx: number, sy: number, z: number, r: number): Cam {
  const dx = (sx - W / 2) / z, dy = (sy - H / 2) / z, cs = Math.cos(r), sn = Math.sin(r);
  return { x: Px - (cs * dx + sn * dy), y: Py - (-sn * dx + cs * dy), rot: r, zoom: z };
}
/** Blend two poses keeping world point P on a straight screen path. */
function mixAnchored(a: Cam, b: Cam, k: number, P: P): Cam {
  const z = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)), r = lerp(a.rot, b.rot, k);
  const sa = toScreen(a, P.x, P.y), sb = toScreen(b, P.x, P.y);
  return camAnchor(P.x, P.y, lerp(sa.x, sb.x, k), lerp(sa.y, sb.y, k), z, r);
}
/** Chase: the pen at screen (W/2 - lead, H/2 + up). */
function chaseCam(p: P, rot: number, zoom: number, lead: number, up: number): Cam {
  return camAnchor(p.x, p.y, W / 2 - lead, H / 2 + up, zoom, rot);
}

/** Vowel-group syllable count (a trailing silent e dropped): only the rhythm of the punches depends on it. */
function syllables(w: string) {
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  const g = s.match(/[aeiouy]+/g)?.length ?? 1;
  return Math.max(1, g - (s.length > 3 && /[^aeiouy]e$/.test(s) ? 1 : 0));
}

export default class Clade extends Scene {
  ov = new WorldLayer();
  pass = makeCladePass(this.ov);
  L!: { N: Lettering; R: Lettering; E: Lettering; K: Lettering; B: Lettering; I: Lettering };
  off = { N: 0, R: 0, E: 0, B: 0, I: 0 };
  T = {
    s0: 0, end: 0, l1: null as unknown as Line, l2: null as unknown as Line, l3: null as unknown as Line, l4: null as unknown as Line,
    hop0: 0, hop1: 0, to: 0, crane0: 0, db1: 0, land: 0, sweep0: 0, sweep1: 0,
    evo: 0, snare: 0, whip2: 0, kill: 0, kw: [] as number[], gene: 0, whip3: 0, bio: 0, beatsC: [] as number[], sup: [] as number[],
    int: 0, isW: [] as Word[], intSyl: [] as number[], art: 0, dim0: 0, drain0: 0, beatsA: [] as number[],
  };
  stepsI: [number, number, number][] = [];
  tipS = 0;

  override init() {
    const { lyrics: ly, audio: au, start: s0, end } = this.ctx;
    const T = this.T;
    T.s0 = s0; T.end = end;
    const beatAfter = (t: number) => au.timeOfBeat(Math.ceil(au.beatAt(t) - 1e-6));
    const downAfter = (t: number) => au.downbeats.find((d) => d >= t - 1e-6) ?? beatAfter(t);
    // the four lines, by position in the window (the whisper draft is not proofread yet)
    const ls = ly.lines.filter((l) => l.start >= s0 - 0.3 && l.start < end - 0.25);
    if (ls.length < 4) throw new Error(`outroV: expected four lines in the window, found ${ls.length}`);
    [T.l1, T.l2, T.l3, T.l4] = ls as [Line, Line, Line, Line];
    const w1 = T.l1.words, w2 = T.l2.words, w3 = T.l3.words, w4 = T.l4.words;
    const last = <X,>(a: X[]) => a[a.length - 1]!;
    // syllables snapped to vocal onsets near their even split
    const syl = (w: Word, n = syllables(w.w)) => {
      const vo = au.events('vocal', w.start + 0.05, w.end + 0.02).map((e) => e[0]);
      const out = [w.start];
      for (let k = 1; k < n; k++) {
        const g = w.start + (k * (w.end - w.start)) / n;
        const near = vo.filter((v) => Math.abs(v - g) < 0.11).sort((a, b) => Math.abs(a - g) - Math.abs(b - g))[0];
        out.push(Math.max(out[k - 1]! + 0.1, near ?? g));
      }
      return out;
    };

    // block A: the split, the Neanderthal branch, the reticulation
    T.hop0 = w1[0]!.start;
    T.hop1 = T.hop0 + 0.13;
    T.to = (w1[1] ?? w1[0]!).start;
    T.crane0 = last(w1).start;
    T.land = T.l1.end;
    T.db1 = downAfter(T.crane0 + 0.35);
    T.sweep0 = T.crane0 + 0.12; T.sweep1 = Math.min(T.db1 - 0.1, T.land + 0.1);
    T.beatsA = [];
    for (let b = Math.ceil(au.beatAt(T.hop1)); au.timeOfBeat(b) < T.crane0; b++) T.beatsA.push(au.timeOfBeat(b));
    // block B: "evolution," in the wide, then the gene
    T.evo = w2[0]!.start;
    T.kill = (w2[1] ?? w2[0]!).start;
    T.kw = w2.slice(1).map((w) => w.start);
    T.gene = last(w2).start;
    T.snare = au.events('snare', T.evo + 0.15, T.kill - 0.35)[0]?.[0] ?? beatAfter(T.evo + 0.3);
    T.whip2 = T.kill - 0.24;
    // block C: the human line, the new branch
    T.bio = w3[0]!.start;
    T.whip3 = Math.max(T.l2.end - 0.03, T.bio - 0.2);
    T.sup = syl(last(w3));
    T.beatsC = [];
    for (let b = Math.ceil(au.beatAt(T.bio + 0.1)); au.timeOfBeat(b) < T.sup[0]! - 0.06; b++) T.beatsC.push(au.timeOfBeat(b));
    T.int = w4[0]!.start;
    T.intSyl = syl(w4[0]!);
    T.isW = w4.slice(1, -1);
    T.art = last(w4).start;
    T.dim0 = T.isW[0]?.start ?? T.art - 0.1;
    T.drain0 = end - 0.1;

    // the lettering, fitted to the branches
    const fit = (words: Word[], avail: number, max: number, tMin?: number) => {
      const probe = new Lettering(words, 100);
      return new Lettering(words, Math.min(max, (100 * avail) / probe.width), tMin);
    };
    const lenN = RET.x - NS.x, lenR = RET.y1 - RET.y0;
    const N = fit([w1[0]!], lenN - 90, 165, T.hop1 - 0.05);
    const R = fit(w1.slice(1), lenR - 80, 165, T.to + 0.02);
    const E = fit([w2[0]!], NEW_NODE.x - RET.x - 160, 420, T.land + 0.02);
    const K = fit(w2.slice(1), DET.gx1 - DET.gx0 + 20, 140, T.kill - 0.03);
    const B = fit(w3, NEW_NODE.x - RET.x - 310, 165, T.bio - 0.05);
    const I = new Lettering(w4, Math.min(N.size, B.size));
    this.L = { N, R, E, K, B, I };
    this.off = { N: lenN - 40 - N.width, R: lenR - 24 - R.width, E: 70, B: 210, I: 70 };
    // the new branch grows in steps: one per syllable of the first word, one per middle word, then the lunge
    const st: [number, number, number][] = [];
    const n0 = I.wr[0]![1];
    T.intSyl.forEach((ts, k) => st.push([ts, Math.round((n0 * (k + 1)) / T.intSyl.length), 0.07]));
    T.isW.forEach((w, k) => st.push([w.start, I.wr[k + 1]![1], 0.07]));
    st.push([T.art, I.n, 0.12]);
    this.stepsI = st;
    this.tipS = this.off.I + I.width + 80;
  }

  // ------------------------------------------------------------------ the pen
  /** Char progress on the new branch: quantised steps (lag > 0: the camera's softer follow). */
  charI(t: number, lag = 0) {
    let c = 0, prev = 0;
    for (const [ts, target, d] of this.stepsI) {
      c += (target - prev) * (lag > 0 && d < 0.1 ? ease.outCubic(prog(t, ts, ts + lag)) : ease.outExpo(prog(t, ts, ts + d)));
      prev = target;
    }
    return c;
  }
  /** Where the pen is. */
  pen(t: number): P & { a: number } {
    const T = this.T, L = this.L, o = this.off;
    if (t < T.hop0) {
      const u = prog(t, T.s0, T.hop0);
      return { x: lerp(ROOT.x, NS.x, Math.pow(u, 1.7)), y: 0, a: 0 };
    }
    if (t < T.hop1) return { x: NS.x, y: ROW.N * ease.outCubic(prog(t, T.hop0, T.hop1)), a: -Math.PI / 2 };
    if (t < T.to) return { x: NS.x + o.N * prog(t, T.hop1 - 0.03, T.hop1 + 0.05) + L.N.xAt(L.N.charAt(t)), y: ROW.N, a: 0 };
    if (t < T.land + 0.001) {
      const ys = ROW.N + o.R * prog(t, T.to, T.to + 0.06) + L.R.xAt(L.R.charAt(t));
      return { x: RET.x, y: Math.min(0, ys + 24 * prog(t, T.land - 0.05, T.land)), a: Math.PI / 2 };
    }
    if (t < T.whip2) return { x: RET.x + o.E * prog(t, T.evo - 0.04, T.evo + 0.04) + L.E.xAt(L.E.charAt(t)), y: 0, a: 0 };
    if (t < T.whip3) {
      const x = DET.gx0 - 40 + 40 * prog(t, T.whip2, T.kill) + L.K.xAt(L.K.charAt(t)) + 60 * prog(t, this.T.l2.end, this.T.l2.end + 0.08);
      return { x, y: DET.bandY, a: 0 };
    }
    if (t < T.int - 0.02) {
      const xb = RET.x + o.B * prog(t, T.bio - 0.05, T.bio + 0.05) + L.B.xAt(L.B.charAt(t));
      return { x: lerp(xb, NEW_NODE.x, ease.inOutCubic(prog(t, T.l3.end, T.int - 0.02))), y: 0, a: 0 };
    }
    const s = this.sNew(t);
    return { x: NEW_NODE.x + NEW_DIR.x * s, y: NEW_NODE.y + NEW_DIR.y * s, a: -NEW_ANG };
  }
  /** Arc length of the pen along the new branch. */
  sNew(t: number, lag = 0) {
    const T = this.T;
    return this.off.I * prog(t, T.int - 0.02, T.int + 0.04) + this.L.I.xAt(this.charI(t, lag)) + 80 * ease.outExpo(prog(t, T.art, T.art + 0.12));
  }
  tip(): P { return { x: NEW_NODE.x + NEW_DIR.x * this.tipS, y: NEW_NODE.y + NEW_DIR.y * this.tipS }; }

  /** The time front: how far the tree has grown. */
  front(t: number) {
    const T = this.T;
    if (t < T.hop0) return this.pen(t).x;
    if (t < T.hop1) return NS.x;
    if (t < T.to) return this.pen(t).x;
    if (t < T.sweep0) return RET.x;
    return lerp(RET.x, 2, ease.inOutCubic(prog(t, T.sweep0, T.sweep1)));
  }
  passAt(x: number) {
    let lo = this.T.s0 - 0.1, hi = this.T.sweep1 + 0.05;
    if (this.front(hi) < x) return 1e9;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (this.front(m) < x) lo = m; else hi = m; }
    return hi;
  }
  /** Stamps land on the next 8th after the front passes. */
  stampAt(x: number) {
    const au = this.ctx.audio, tp = this.passAt(x);
    return au.timeOfBeat(Math.ceil(au.beatAt(tp) * 2 - 1e-6) / 2);
  }

  // ------------------------------------------------------------------ camera
  camRun(t: number): Cam {
    const T = this.T, u = ease.inOutQuad(prog(t, T.s0, T.hop0));
    const z = keys(t, [[T.s0, 0.8], [T.hop0, 0.95, ease.inOutQuad]]);
    return chaseCam(this.pen(t), -0.03 * u, z, 190 * u, 170 * u);
  }
  rotN(t: number) { return 0.02 * prog(t, this.T.hop1, this.T.to); }
  camN(t: number): Cam {
    const T = this.T;
    let z = 0.84;
    for (const b of T.beatsA) z *= 1 + 0.03 * pulse(t, b, 0.09);
    return chaseCam(this.pen(t), this.rotN(t), z, -190, -170);
  }
  camRet(t: number): Cam {
    const T = this.T;
    const k = ease.inOutCubic(prog(t, T.to - 0.02, T.to + 0.26));
    const rot = lerp(this.rotN(T.to), -Math.PI / 2, k);
    let z = keys(t, [[T.to, 0.84], [T.to + 0.13, 1.0, ease.outCubic], [T.to + 0.32, 0.92, ease.inOutQuad]]);
    for (const b of T.beatsA) if (b > T.to) z *= 1 + 0.03 * pulse(t, b, 0.09);
    return chaseCam(this.pen(t), rot, z, -190, lerp(-170, 40, k));
  }
  camWide(t: number): Cam {
    const T = this.T;
    const drift = prog(t, T.db1, T.whip2, ease.inOutQuad);
    const snap = ease.outExpo(prog(t, T.snare, T.snare + 0.22));
    const z = 0.33 * (1 + 0.035 * drift) * (1 + 0.05 * pulse(t, T.db1, 0.1)) * (1 + 0.17 * snap);
    const rot = -0.012 * drift + 0.03 * ease.outBack(prog(t, T.snare, T.snare + 0.3));
    return { x: -1990 + 440 * snap + 40 * drift, y: -110 + 110 * snap, rot, zoom: z };
  }
  camDet(t: number): Cam {
    const T = this.T;
    let z = 1.18;
    const kw = T.kw;
    const gains = [0.16, 0.08, 0.18];
    kw.forEach((k, i) => { z *= 1 + (gains[Math.min(i, 2)] ?? 0.1) * ease.outExpo(prog(t, k, k + 0.14)); });
    const rot = 0.035 * ease.outBack(prog(t, kw[0]!, kw[0]! + 0.25)) - 0.05 * ease.outBack(prog(t, T.gene, T.gene + 0.25));
    return chaseCam(this.pen(t), rot, z, -150, 40);
  }
  camBio(t: number): Cam {
    const T = this.T;
    let z = 0.96;
    T.beatsC.forEach((b, i) => { z *= 1 + (i % 2 ? 0.06 : 0.05) * ease.outExpo(prog(t, b, b + 0.2)) * (1 - 0.6 * prog(t, b + 0.2, b + 0.5)); });
    let rot = 0.018;
    T.sup.slice(1).forEach((s, i) => {
      z *= 1 + 0.07 * ease.outExpo(prog(t, s, s + 0.14));
      rot += (i % 2 ? -0.03 : 0.03) * ease.outBack(prog(t, s, s + 0.25));
    });
    return chaseCam(this.pen(t), rot, z, -200, 70);
  }
  camNew(t: number): Cam {
    const T = this.T;
    let z = 1.0;
    T.intSyl.slice(1).forEach((s, i) => { z *= 1 + (0.07 + 0.01 * i) * ease.outExpo(prog(t, s, s + 0.14)); });
    for (const w of T.isW) z *= 1 + 0.05 * ease.outExpo(prog(t, w.start, w.start + 0.12));
    let rot = NEW_ANG;
    T.intSyl.slice(1).forEach((s, i) => { rot += (i % 2 ? 0.03 : -0.03) * ease.outBack(prog(t, s, s + 0.25)); });
    const sc = this.sNew(t, 0.26);
    return chaseCam({ x: NEW_NODE.x + NEW_DIR.x * sc, y: NEW_NODE.y + NEW_DIR.y * sc }, rot, z, -400, 70);
  }
  camLand(t: number): Cam {
    const T = this.T, tp = this.tip();
    const pre = this.camNew(T.art);
    const s0 = toScreen(pre, tp.x, tp.y);
    const k = ease.outExpo(prog(t, T.art, T.art + 0.2));
    let z = lerp(pre.zoom, 1.25, k) * (1 + 0.32 * ease.outExpo(prog(t, T.art + 0.1, T.art + 0.4))) * (1 + 0.06 * prog(t, T.art + 0.4, T.end));
    const rot = lerp(pre.rot, NEW_ANG, k) + 0.05 * ease.outBack(prog(t, T.art + 0.1, T.art + 0.35)) * (1 - prog(t, T.end - 0.12, T.end - 0.04));
    z = Math.max(z, 0.1);
    return camAnchor(tp.x, tp.y, lerp(s0.x, HANDOFF.summit.x, k), lerp(s0.y, HANDOFF.summit.y, k), z, rot);
  }

  camAt(t: number): Cam {
    const T = this.T;
    if (t < T.hop0 - 0.02) return this.camRun(t);
    if (t < T.hop1 + 0.12) {
      const k = ease.inOutCubic(prog(t, T.hop0 - 0.02, T.hop1 + 0.12));
      const c = mixAnchored(this.camRun(t), this.camN(t), k, this.pen(t));
      c.zoom *= 1 - 0.3 * Math.sin(Math.PI * k);
      c.rot += -0.16 * Math.sin(Math.PI * k);
      return c;
    }
    if (t < T.to - 0.02) return this.camN(t);
    if (t < T.crane0) return this.camRet(t);
    if (t < T.whip2) {
      const k = 1 - Math.pow(1 - prog(t, T.crane0, T.db1 + 0.05), 3.2);
      return mixAnchored(this.camRet(t), this.camWide(t), k, this.pen(Math.min(t, T.land)));
    }
    if (t < T.kill) {
      const k = ease.inOutCubic(prog(t, T.whip2, T.kill));
      const c = mixCam(this.camWide(t), this.camDet(t), k);
      c.zoom *= 1 - 0.45 * Math.sin(Math.PI * k);
      return c;
    }
    if (t < T.whip3) return this.camDet(t);
    if (t < T.bio) {
      const k = ease.inOutCubic(prog(t, T.whip3, T.bio));
      const c = mixCam(this.camDet(T.whip3 - 1e-3), this.camBio(t), k);
      c.zoom *= 1 - 0.4 * Math.sin(Math.PI * k);
      return c;
    }
    if (t < T.int - 0.03) return this.camBio(t);
    if (t < T.art) {
      const k = ease.outExpo(prog(t, T.int - 0.03, T.int + 0.2));
      return mixAnchored(this.camBio(Math.min(t, T.int - 0.03)), this.camNew(t), k, this.pen(t));
    }
    return this.camLand(t);
  }

  kAt(t: number) {
    const T = this.T;
    return keys(t, [[T.s0, 0.00026], [T.crane0, 0.00028], [T.db1, 0.0001, ease.inOutCubic], [T.whip2, 0.0001], [T.kill, 0.0002, ease.inOutCubic], [T.bio, 0.00026, ease.inOutCubic], [T.art, 0.00022], [T.end - 0.1, 0, ease.inOutCubic]]);
  }
  whipAt(t: number) {
    const T = this.T;
    return Math.max(
      prog(t, T.hop0 - 0.03, T.hop0 + 0.02) * (1 - prog(t, T.hop1 + 0.05, T.hop1 + 0.15)),
      prog(t, T.to - 0.03, T.to + 0.02) * (1 - prog(t, T.to + 0.2, T.to + 0.32)),
      prog(t, T.crane0, T.crane0 + 0.05) * (1 - prog(t, T.crane0 + 0.25, T.db1)),
      prog(t, T.whip2 - 0.02, T.whip2 + 0.03) * (1 - prog(t, T.kill - 0.03, T.kill + 0.05)),
      prog(t, T.whip3 - 0.02, T.whip3 + 0.03) * (1 - prog(t, T.bio - 0.03, T.bio + 0.05)),
      prog(t, T.int - 0.05, T.int) * (1 - prog(t, T.int + 0.1, T.int + 0.2)),
      prog(t, T.art - 0.02, T.art) * (1 - prog(t, T.art + 0.14, T.art + 0.24)),
    );
  }

  // ------------------------------------------------------------------ render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const T = this.T, t = f.t;
    const cam = this.camAt(t);
    const whip = this.whipAt(t);
    const shutter = lerp(1 / 300, 1 / 80, whip);
    const camB = this.camAt(t - shutter);
    const u = this.pass.u;
    (u.uCamA!.value as THREE.Vector4).set(cam.x, cam.y, cam.rot, cam.zoom);
    (u.uCamB!.value as THREE.Vector4).set(camB.x, camB.y, camB.rot, camB.zoom);
    let motion = 0;
    for (const [sx, sy] of [[-900, -500], [900, 500], [900, -500], [-900, 500]] as const) {
      const cs = Math.cos(cam.rot), sn = Math.sin(cam.rot);
      const wx = cam.x + (cs * sx + sn * sy) / cam.zoom, wy = cam.y + (-sn * sx + cs * sy) / cam.zoom;
      const a = toScreen(cam, wx, wy), b = toScreen(camB, wx, wy);
      motion = Math.max(motion, Math.hypot(a.x - b.x, a.y - b.y));
    }
    u.uTaps!.value = clamp(Math.ceil(motion / 3), 1, 16);
    u.uK!.value = this.kAt(t);
    u.uT!.value = t;
    // the sheet spreads out of the root
    const R = 2600 * ease.outCubic(prog(t, T.s0 + 0.012, T.s0 + 0.34)) + 14000 * prog(t, T.s0 + 0.34, T.s0 + 1.4);
    (u.uRev!.value as THREE.Vector3).set(ROOT.x, ROOT.y, R);
    u.uHaze!.value = keys(t, [[T.s0, 0.45], [T.crane0, 0.45], [T.db1, 0.12], [T.whip2, 0.12], [T.kill, 0.3], [T.bio, 0.4], [T.art, 0.3], [T.end - 0.1, 0]]);
    // the drain: the sheet dims under the new branch from "is", then everything but the tip goes
    const dim = 1 - 0.55 * prog(t, T.dim0, T.art + 0.05, ease.inOutQuad);
    const drain = prog(t, T.drain0, T.end - 0.02, ease.inOutQuad);
    const keep = dim * (1 - drain);
    u.uDim!.value = keep;
    u.uGrid!.value = 1;
    u.uHot!.value = 0.6 + 0.7 * pulse(t, T.art + 0.1, 0.1) + 0.4 * pulse(t, T.land, 0.1);

    // ---- the overlay
    const L = this.ov;
    L.begin(cam);
    const c = L.c, px = L.px;
    const b = L.bounds(300);
    const sheetA = keep * prog(t, T.s0, T.s0 + 0.2);
    c.save();
    if (R < 12000) { c.beginPath(); c.arc(ROOT.x, ROOT.y, Math.max(1, R), 0, TAU); c.clip(); }
    drawSheet(c, b, px, sheetA);
    c.restore();
    const front = this.front(t);
    drawTree(c, b, px, { front, t, passAt: (x) => this.passAt(x), stampAt: (x) => this.stampAt(x) }, keep);
    this.drawReticulation(c, t, px, keep);
    this.drawLyricsA(c, t, px, keep);
    this.drawWideNotes(c, t, px, keep, b);
    const pen = this.pen(t);
    drawDetail(c, b, px, keep, t >= T.whip2 && t < T.whip3 ? pen.x : t >= T.whip3 ? DET.gx1 + 40 : -1e9, t, T.kill, T.gene);
    if (t >= T.kill - 0.1) plotLettering(c, this.L.K, { x: DET.gx0, y: DET.bandY - DET.bandH / 2 }, 0, 0, 34, t < T.whip3 ? pen.x - DET.gx0 : 1e9, t, px, keep);
    this.drawBlockC(c, t, px, keep);
    this.drawNewBranch(c, t, px, dim, drain);
    this.drawTrail(c, t, px, keep);
    this.drawPen(c, t, px, cam.zoom);
    L.upload();
    (u.uOvCam!.value as THREE.Vector4).set(cam.x, cam.y, cam.rot, cam.zoom);
    this.pass.render(renderer, out);

    // ---- post: one maximal hit (the landing), whip kicks, small punches on the beats, words and syllables
    const hop = pulse(t, T.hop0 + 0.06, 0.08), roll = pulse(t, T.to + 0.1, 0.08), land = pulse(t, T.land, 0.07);
    const art = pulse(t, T.art + 0.1, 0.08);
    let beat = 0;
    for (const bt of [...T.beatsA, ...T.beatsC]) beat = Math.max(beat, pulse(t, bt, 0.06));
    let word = 0;
    for (const k of T.kw) word = Math.max(word, pulse(t, k, 0.06));
    let syl = 0;
    for (const s of [...T.sup.slice(1), ...T.intSyl]) syl = Math.max(syl, pulse(t, s, 0.06));
    const whips = Math.max(pulse(t, T.kill, 0.07), pulse(t, T.bio, 0.07), pulse(t, T.db1, 0.07));
    const sh = 8 * hop + 6 * roll + 7 * land + 2 * beat + 6 * word + 4 * syl + 5 * whips + 16 * art;
    const fin = t > T.end - 0.1;
    return {
      bloom: 0.6, bloomThreshold: 1.0, bloomKnee: 0.35, bloomRadius: 0.65,
      vignette: lerp(0.45, 0.58, drain), grain: 0.055, halation: 0.18,
      exposure: fin ? 1 : 1 + 0.08 * art,
      shake: fin ? [0, 0] : [Math.sin(t * 93) * sh, Math.cos(t * 71) * sh * 0.8],
      ca: fin ? 0.6 : 1.2 + 4 * hop + 5 * whip + 3 * art,
      zoom: fin ? 1 : 1 + 0.03 * hop + 0.05 * art + 0.012 * syl,
    };
  }

  // ------------------------------------------------------------------ overlay pieces
  /** The reticulation: drawn by the pen from the Neanderthal line down to the human line; an arrowhead on landing. */
  private drawReticulation(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    if (t < T.to - 0.01 || keep <= 0.002) return;
    const y1 = t < T.land ? this.pen(t).y : 0;
    c.save();
    c.globalAlpha = keep;
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = Math.max(4, 1.6 * px); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(RET.x, RET.y0); c.lineTo(RET.x, Math.min(y1, -30)); c.stroke();
    // the corner on the Neanderthal line
    c.fillStyle = rgba('bone', 1);
    c.beginPath(); c.arc(RET.x, RET.y0, 10, 0, TAU); c.fill();
    if (t >= T.land) {
      const k = 1 + 0.5 * pulse(t, T.land, 0.05);
      c.beginPath(); c.moveTo(RET.x, -2); c.lineTo(RET.x - 22 * k, -58 * k); c.lineTo(RET.x + 22 * k, -58 * k); c.closePath();
      c.fillStyle = rgba(t < T.land + 0.3 ? 'signal' : 'bone', 1); c.fill();
      // the shock ring off the landing
      const e = t - T.land;
      if (e < 0.6) {
        const rr = 40 * (1 + 7 * ease.outCubic(prog(e, 0, 0.5)));
        c.strokeStyle = rgba('signal', 0.85 * (1 - prog(e, 0.05, 0.55))); c.lineWidth = Math.max(3, 2.2 * px);
        c.beginPath(); c.arc(RET.x, 0, rr, 0, TAU); c.stroke();
      }
      // inheritance proportion, as network diagrams mark a hybrid edge
      const ga = prog(t, T.land + 0.02, T.land + 0.08);
      c.font = font(F.mono(500), 44); c.textAlign = 'right'; c.fillStyle = rgba('ash', ga);
      c.fillText('γ ≈ 0.02', RET.x - 40, -120);
    }
    c.restore();
  }

  /** Block A's lyric: the first word along the Neanderthal line, the rest down the reticulation. */
  private drawLyricsA(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T, L = this.L, o = this.off;
    if (t < T.hop1 - 0.05) return;
    const p = this.pen(t);
    const nX = t < T.to ? p.x - NS.x - o.N : 1e9;
    plotLettering(c, L.N, { x: NS.x, y: ROW.N }, 0, o.N, 30, nX, t, px, keep);
    if (t >= T.to) {
      const rX = t < T.land ? p.y - RET.y0 - o.R : 1e9;
      plotLettering(c, L.R, { x: RET.x, y: RET.y0 }, Math.PI / 2, o.R, 30, rX, t, px, keep);
    }
    // "evolution," under the human line, the size of the tree, plotted in the wide; then a background label
    if (t >= T.evo - 0.05) {
      const eX = t < T.whip2 ? p.x - RET.x - o.E : 1e9;
      const a = keep * (t < T.whip3 ? 1 : lerp(1, 0.05, prog(t, T.whip3, T.bio + 0.3)) * lerp(1, 0.3, prog(t, T.int - 0.1, T.int + 0.2)));
      plotLettering(c, L.E, { x: RET.x, y: 0 }, 0, o.E, -150, eX, t, px, a, { lw: L.E.size / 24, hold: 0.1, bone: t < T.whip3 ? 0.95 : 0.8 });
    }
  }

  /** In the wide: the detail marker on the reticulation and the callout. */
  private drawWideNotes(c: CanvasRenderingContext2D, t: number, px: number, keep: number, b: ReturnType<WorldLayer['bounds']>) {
    const T = this.T;
    const ma = keep * prog(t, T.crane0 + 0.3, T.crane0 + 0.36);
    if (ma > 0.002) {
      const C = DET.circle;
      const s = 1 + 0.4 * pulse(t, T.crane0 + 0.3, 0.05);
      c.save();
      c.globalAlpha = ma;
      c.strokeStyle = rgba('bone', 0.85); c.lineWidth = Math.max(2.4, 1.3 * px);
      c.setLineDash([24, 14]);
      c.beginPath(); c.arc(C.x, C.y, C.r * s, 0, TAU); c.stroke();
      c.setLineDash([]);
      c.font = font(F.mono(700), 72); c.fillStyle = rgba('bone', 1); c.textAlign = 'right';
      c.fillText('A', C.x - C.r - 20, C.y + 26);
      c.restore();
    }
    // the callout, filed as the wide lands: what the drawing is, deadpan
    const ca = keep * prog(t, T.db1 - 0.01, T.db1 + 0.04) * (1 - prog(t, T.whip2 + 0.05, T.whip2 + 0.15));
    if (ca > 0.002 && inBox(b, -3200, -1300, -300, -200)) {
      const k = ease.outExpo(prog(t, T.db1, T.db1 + 0.2));
      // anchored on the reticulation in the gap after its first word, out to the right before it turns up
      const LR = this.L.R, gap = LR.wr[0]![1];
      const ex = RET.x + 4, ey = RET.y0 + this.off.R + (LR.xAt(gap) + LR.xAt(gap + 1)) / 2;
      const kx = ex + 190 * k, lx = kx + 260 * k, ly = lerp(ey, -900, k);
      c.save();
      c.globalAlpha = ca;
      c.strokeStyle = rgba('bone', 0.9); c.lineWidth = Math.max(2.4, 1.5 * px);
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(kx, ey); c.lineTo(lx, ly); c.lineTo(lx + 1640 * k, ly); c.stroke();
      c.fillStyle = rgba('bone', 1); c.beginPath(); c.arc(ex, ey, 11, 0, TAU); c.fill();
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.font = font(F.mono(600), 150); c.fillStyle = rgba('bone', 1);
      c.fillText('NOT A TREE', lx + 24, ly - 46);
      c.font = font(F.mono(400), 80); c.fillStyle = rgba('ash', 1);
      c.fillText('introgression: yes · outgroup: —', lx + 24, ly + 104);
      c.restore();
    }
  }

  /** Block C: the human line's lettering and the age stamped under the pen on the beats. */
  private drawBlockC(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    if (t < T.bio - 0.25) return;
    const bX = t < T.int - 0.02 ? this.pen(t).x - RET.x - this.off.B : 1e9;
    plotLettering(c, this.L.B, { x: RET.x, y: 0 }, 0, this.off.B, 32, bX, t, px, keep);
    c.save();
    c.globalAlpha = keep;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    for (const bt of T.beatsC) {
      if (t < bt) continue;
      const x = this.pen(bt).x, e = t - bt;
      const s = 1 + 0.5 * pulse(t, bt, 0.05);
      const hot = e < 0.3;
      c.strokeStyle = rgba(hot ? 'signal' : 'ash', 1); c.lineWidth = Math.max(3.2, 1.5 * px);
      c.beginPath(); c.moveTo(x, 22); c.lineTo(x, 22 + 44 * s); c.stroke();
      c.font = font(F.mono(600), 40 * s); c.fillStyle = rgba(hot ? 'signal' : 'ash', 1);
      c.fillText(ageLabel(ageAt(x)), x, 118);
    }
    c.restore();
  }

  /** The new branch: blue, straight, rising out of the human line; its lettering; the landing. */
  private drawNewBranch(c: CanvasRenderingContext2D, t: number, px: number, dim: number, drain: number) {
    const T = this.T;
    if (t < T.int - 0.03) return;
    const keepB = 1 - drain;
    const s = this.sNew(t);
    const pe = { x: NEW_NODE.x + NEW_DIR.x * s, y: NEW_NODE.y + NEW_DIR.y * s };
    c.save();
    c.globalAlpha = keepB;
    // the node on the human line, and its age
    const na = prog(t, T.int - 0.03, T.int + 0.02);
    const ns = 1 + 0.6 * pulse(t, T.int, 0.05);
    c.fillStyle = rgba('signal', na);
    c.beginPath(); c.arc(NEW_NODE.x, NEW_NODE.y, 13 * ns, 0, TAU); c.fill();
    c.font = font(F.mono(500), 36); c.textAlign = 'center'; c.fillStyle = rgba('ash', na * dim);
    c.fillText('≈ 80 yr', NEW_NODE.x, NEW_NODE.y + 70);
    // the branch
    c.lineCap = 'round';
    c.strokeStyle = rgba('signal', 1); c.lineWidth = Math.max(8, 2.6 * px);
    c.beginPath(); c.moveTo(NEW_NODE.x, NEW_NODE.y); c.lineTo(pe.x, pe.y); c.stroke();
    c.restore();
    plotLettering(c, this.L.I, NEW_NODE, -NEW_ANG, this.off.I, 34, s - this.off.I, t, px, keepB, { hold: 0.3 });
    // the landing: the terminal node, a shock ring, the burst, its label
    const e = t - (T.art + 0.1);
    if (e >= 0) {
      const tp = this.tip();
      c.save();
      c.globalAlpha = keepB;
      const k = 1 + 0.8 * pulse(e, 0, 0.05);
      c.strokeStyle = rgba('signal', 1); c.lineWidth = Math.max(4, 2 * px);
      c.beginPath(); c.moveTo(tp.x - NEW_DIR.y * 30 * k, tp.y + NEW_DIR.x * 30 * k); c.lineTo(tp.x + NEW_DIR.y * 30 * k, tp.y - NEW_DIR.x * 30 * k); c.stroke();
      if (e < 0.6) {
        const rr = 40 * (1 + 8 * ease.outCubic(prog(e, 0, 0.45)));
        c.strokeStyle = rgba('signal', 0.9 * (1 - prog(e, 0.03, 0.45))); c.lineWidth = Math.max(3, 2.4 * px);
        c.beginPath(); c.arc(tp.x, tp.y, rr, 0, TAU); c.stroke();
      }
      c.translate(tp.x, tp.y); c.rotate(-NEW_ANG);
      c.font = font(F.serif(400, true), 58); c.textAlign = 'left'; c.fillStyle = rgba('bone', prog(e, 0, 0.04));
      c.fillText('gen. et sp. indet.', 50, 20);
      c.restore();
      c.save(); c.globalAlpha = keepB;
      burst2D(c, tp.x, tp.y, t, T.art + 0.1, { n: 70, speed: 1600 * px, life: 0.14, seed: 23, width: 2 * px });
      c.restore();
    }
  }

  /** The pen's recent path, blue and hot at the head. */
  private drawTrail(c: CanvasRenderingContext2D, t: number, px: number, keep: number) {
    const T = this.T;
    if (keep <= 0.002 || t > T.int - 0.05) return;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    const n = 26, dt = 0.011;
    let prev = this.pen(t);
    for (let i = 1; i <= n; i++) {
      const tt = t - i * dt;
      if (tt < T.s0) break;
      const p = this.pen(tt);
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > 420) break;
      const k = 1 - i / n;
      c.strokeStyle = rgba('signal', keep * 0.95 * k);
      c.lineWidth = Math.max(5, 2 * px) * (0.6 + 0.4 * k);
      c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke();
      prev = p;
    }
    c.restore();
  }

  private drawPen(c: CanvasRenderingContext2D, t: number, px: number, zoom: number) {
    const T = this.T;
    const p = t >= T.art + 0.12 ? this.tip() : this.pen(t);
    const land = pulse(t, T.art + 0.1, 0.1);
    const sc = 1.25 * px * Math.min(1.6, Math.max(0.8, Math.sqrt(zoom))) * (1 + 0.5 * land);
    dot2D(c, p.x, p.y, t, sc, 1, 0.35);
    if (t < T.s0 + 0.5) burst2D(c, p.x, p.y, t, T.s0 + 0.02, { n: 50, speed: 700 * px, life: 0.35, seed: 3, width: 1.4 * px });
  }
}
