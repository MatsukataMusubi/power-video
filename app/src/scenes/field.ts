// FIELD — chorus 2 (direction A): an exploded assembly of nothing in particular.
//   the hook        each sung word is a part (plate / bar / ring / block) flying in and locking into
//                   a scattered constellation; the word is laser-etched into it as sung; the camera
//                   whips to each. Locked parts get related by dimension lines with readouts.
//   "When … cooperate"  a bent rail is fitted between two rings; the line is laser-etched along it.
//   the hook again  more parts, further out; the camera eases back through the held "power".
//   the drop        (the bass enters for the first time) cut wide to the whole constellation as the
//                   accent surges through the dimension network; then one framing per bar, cut on
//                   the downbeat, every kick sending a pulse along every line.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, type FSPass } from '../engine/gl';
import { font, glyphX, measure } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, polylineLengths, pointAtLength, prog, pulse, type V2 } from '../engine/util';
import { MONO_B, clean, hexA, shellPass, dataBurst, sparksAt } from './_shell';
import { camAt, enterPart, drawPart, etchWord, lockCallout, drawLink, drawDatum, makeEtch, toScreen, type Part, type Key, type Link, type Kind } from './_parts';

const KINDS: Kind[] = ['plate', 'bar', 'block', 'ring', 'plate', 'block', 'ring', 'ring', 'bar', 'plate', 'block', 'plate', 'bar', 'block', 'plate'];
const RAIL_TXT = 58;

export default class Field extends Scene {
  L = new Layer2D();
  pass!: FSPass;
  acc = '#2F5BFF';
  parts: Part[] = [];
  links: Link[] = [];
  keys: Key[] = [];
  lineA!: Line; lineB!: Line; lineC!: Line;
  tDrop = 0; tRail = 0;
  rail!: { pts: V2[]; L: Float32Array; text: string; chars: { s: number; t0: number; w: number }[]; words: Word[] };
  kicks: number[] = [];
  cuts: number[] = [];
  datum = { x: 0, y: 0 };

  override init() {
    const { lyrics, params, start, end, audio } = this.ctx;
    if (params.accent) this.acc = String(params.accent);
    this.pass = shellPass(this.L.texture, this.acc);
    const lines = lyrics.linesIn(start - 0.2, end);
    const hooks = lines.filter((l) => /appreciate/i.test(l.text));
    this.lineA = hooks[0]!;
    this.lineC = hooks[hooks.length - 1]!;
    this.lineB = lines.find((l) => l.start > this.lineA.start && l.start < this.lineC.start && !/appreciate/i.test(l.text)) ?? lines[1]!;
    this.tDrop = audio.downbeats.find((d) => d >= this.lineC.end - 0.05) ?? end;
    this.tRail = this.lineB.words[0]!.start - 0.05;
    const eighth = 60 / audio.bpm / 2;

    // the parts: one per hook word, plus the two rings the rail is fitted between; positions along a
    // loose serpentine through the world (so the camera wanders), jittered, on three parallax planes
    const plan: { tLock: number; word?: Word }[] = [
      ...this.lineA.words.map((w) => ({ tLock: w.start, word: w })),
      { tLock: this.lineB.words[0]!.start - eighth },
      { tLock: this.lineB.words[0]!.start - eighth / 2 },
      ...this.lineC.words.map((w) => ({ tLock: w.start, word: w })),
    ];
    const cols = 4, cw = 900, rh = 760;
    this.parts = plan.map((p, i) => {
      const row = Math.floor(i / cols), col = row % 2 ? cols - 1 - (i % cols) : i % cols;
      const jx = (hash(i, 1) - 0.5) * 360, jy = (hash(i, 2) - 0.5) * 300;
      const kind = i === 6 || i === 7 ? 'ring' : KINDS[i % KINDS.length]!;
      const big = kind === 'ring' ? 260 : kind === 'bar' ? 520 : 400;
      const part: Part = {
        id: `P-${String(i + 1).padStart(2, '0')}`, kind,
        x: col * cw + jx, y: row * rh + jy, ang: kind === 'ring' ? 0 : (hash(i, 3) - 0.5) * 0.9,
        w: big, h: kind === 'ring' ? big : kind === 'bar' ? 92 : 200 + hash(i, 4) * 80,
        pf: [0.86, 1, 1.12][i % 3]!, tLock: p.tLock, dir: hash(i, 5) * Math.PI * 2,
      };
      if (p.word) part.etch = makeEtch(clean(p.word.w).toUpperCase(), kind === 'bar' ? 420 : part.w - 70, kind === 'bar' ? 60 : 110, p.word);
      return part;
    });
    // the two rings sit apart, level, with room for the rail
    const r0 = this.parts[6]!, r1 = this.parts[7]!;
    r1.x = r0.x + 1180; r1.y = r0.y + 40; r0.pf = r1.pf = 1;
    this.datum = { x: this.parts[0]!.x, y: this.parts[0]!.y };

    // dimension lines: consecutive parts, and a few cross links
    for (let i = 0; i + 1 < this.parts.length; i++) if (!(i === 6)) this.links.push(this.mkLink(i, i + 1));
    for (const [a, b] of [[0, 3], [2, 5], [8, 11], [10, 13], [1, 9]]) if (b! < this.parts.length) this.links.push(this.mkLink(a!, b!));

    // the rail between the rings: a bent bar; the line etched along it
    const bez = (p0: V2, p1: V2, p2: V2, p3: V2) => {
      const out: V2[] = [];
      for (let k = 0; k <= 100; k++) {
        const u = k / 100, m = 1 - u;
        out.push({ x: m * m * m * p0.x + 3 * m * m * u * p1.x + 3 * m * u * u * p2.x + u * u * u * p3.x, y: m * m * m * p0.y + 3 * m * m * u * p1.y + 3 * m * u * u * p2.y + u * u * u * p3.y });
      }
      return out;
    };
    const pts = bez({ x: r0.x + 130, y: r0.y }, { x: r0.x + 420, y: r0.y - 260 }, { x: r1.x - 420, y: r1.y + 260 }, { x: r1.x - 130, y: r1.y });
    const words = this.lineB.words.map((w) => clean(w.w).toUpperCase());
    const text = words.join(' ');
    const L = polylineLengths(pts);
    const off = Math.max(30, (L[L.length - 1]! - measure(text, MONO_B, RAIL_TXT)) / 2);
    const chars: { s: number; t0: number; w: number }[] = [];
    let ci = 0;
    this.lineB.words.forEach((w, wi) => {
      const s = words[wi]!;
      for (let i = 0; i < s.length; i++) chars.push({ s: off + glyphX(text, ci + i, MONO_B, RAIL_TXT), t0: w.start + ((w.end - w.start) * 0.7 * i) / s.length, w: wi });
      ci += s.length + 1;
    });
    this.rail = { pts, L, text: text.replace(/ /g, ''), chars, words: this.lineB.words };

    // the camera
    const cam = (p: Part, z: number, a: number) => ({ x: p.x, y: p.y, a: p.ang * 0.5 + a, z });
    this.keys.push({ t: start - 1, dur: 0, ...cam(this.parts[0]!, 1.15, 0.05) });
    this.parts.forEach((p, i) => {
      if (!p.etch) return;
      this.keys.push({ t: p.tLock - 0.1, dur: 0.12, ...cam(p, i >= 8 ? 1.0 : 1.15, (i % 2 ? -1 : 1) * 0.06) });
      if (i === 5) this.keys.push({ t: this.tRail, dur: 0.35, x: (r0.x + r1.x) / 2, y: (r0.y + r1.y) / 2 - 40, a: 0.03, z: 0.66 });
    });
    const last = this.parts[this.parts.length - 1]!;
    this.keys.push({ t: last.tLock + 0.15, dur: Math.max(0.2, this.tDrop - last.tLock - 0.2), x: last.x - 300, y: last.y - 200, a: 0.02, z: 0.72 });
    // the drop: fit everything, then a framing per bar
    const xs = this.parts.map((p) => p.x), ys = this.parts.map((p) => p.y);
    const bx0 = Math.min(...xs) - 380, bx1 = Math.max(...xs) + 380, by0 = Math.min(...ys) - 320, by1 = Math.max(...ys) + 320;
    const wide = { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2, a: 0, z: Math.min(W / (bx1 - bx0), H / (by1 - by0)) };
    const bar = (4 * 60) / audio.bpm;
    const frames = [
      wide,
      { x: r0.x + 300, y: r0.y, a: -0.14, z: 0.62 },
      { x: this.parts[10]!.x, y: this.parts[10]!.y, a: 0.2, z: 0.95 },
      { ...wide, a: 0.05, z: wide.z * 1.15 },
    ];
    frames.forEach((fr, k) => {
      const t0 = this.tDrop + k * bar;
      if (t0 < end) { this.keys.push({ t: t0, dur: 0, ...fr }); this.keys.push({ t: t0 + 0.01, dur: bar - 0.02, ...fr, z: fr.z * 1.06 }); this.cuts.push(t0); }
    });
    this.cuts.push(start, this.tRail);
    this.kicks = audio.events('kick', this.tDrop - 0.01, end).map(([t]) => t);
  }

  private mkLink(a: number, b: number): Link {
    const A = this.parts[a]!, B = this.parts[b]!;
    return { a, b, label: `${(Math.hypot(A.x - B.x, A.y - B.y) / 4).toFixed(1)}` };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer } = this.ctx;
    const c = this.L.ctx;
    this.L.clear();
    const drop = t >= this.tDrop;
    const cam = camAt(this.keys, t);

    // the surge through the network at the drop, then a pulse along every line per kick
    const N = this.links.length;
    const linkState = (k: number): { surge: number; lit: number } => {
      if (!drop) return { surge: -1, lit: 0 };
      let lit = 0.12, surge = -1;
      const tk0 = this.tDrop + (k / N) * 0.45;
      if (t >= tk0 && t < tk0 + 0.3) { surge = (t - tk0) / 0.3; lit = 1; }
      for (const tk of this.kicks) {
        if (tk > t) break;
        const u = (t - tk) / 0.28;
        if (u < 1) { surge = u; lit = Math.max(lit, 1 - u); }
      }
      return { surge, lit };
    };
    const partGlow = (i: number) => {
      if (!drop) return 0;
      let g = 0.08;
      this.links.forEach((l, k) => { if (l.b === i) { const s = linkState(k); if (s.surge > 0.85) g = Math.max(g, (s.surge - 0.85) / 0.15); } });
      return clamp(g);
    };

    let lock = 0;
    drawDatum(c, cam, this.datum.x, this.datum.y, drop ? 0.5 : 0.8, this.acc);
    this.links.forEach((l, k) => { const s = linkState(k); drawLink(c, cam, this.parts, l, t, this.acc, s.surge, s.lit); });
    this.drawRail(c, cam, t);
    this.parts.forEach((p, i) => {
      c.save();
      enterPart(c, cam, p);
      lock = Math.max(lock, drawPart(c, p, t, this.acc, partGlow(i)));
      if (p.etch && t >= p.tLock) {
        const w = p.etch.word!;
        const pr = Lyrics.wordProgress(w, t);
        const lit = drop ? 0.25 + 0.75 * partGlow(i) : t < w.end + 0.06 ? pr : 0;
        etchWord(c, p.etch, t, pr, lit, this.acc, !drop);
      }
      c.restore();
      if (!drop) lockCallout(c, cam, p, t, this.acc);
    });

    for (const tc of this.cuts) if (t >= tc && t < tc + 0.12) dataBurst(c, t, tc, this.acc);

    this.pass.u.glitch!.value = clamp(0.3 * f.a.snare + 0.35 * lock + (drop ? 0.8 * pulse(t, this.tDrop, 0.12) : 0));
    this.pass.u.seed!.value = frameIdx(t) % 991;
    this.pass.u.invert!.value = 0;
    this.L.upload();
    this.pass.render(renderer, out);
    const fi = frameIdx(t);
    return {
      bloom: drop ? 0.75 : 0.7, bloomThreshold: 0.9, bloomKnee: 0.3, halation: 0.08, vignette: 0.45, grain: 0.06, ca: 0.6 + 2.5 * f.a.snare, hud: 0,
      zoom: 1 + (drop ? 0.05 : 0.03) * f.a.kick + 0.05 * lock + (drop ? 0.08 * pulse(t, this.tDrop, 0.15) : 0),
      shake: [lock * 10 * (hash(fi, 1) - 0.5), lock * 10 * (hash(fi, 2) - 0.5)],
    };
  }

  /** The rail between the rings (fitted over 0.3 s from tRail), and the line etched along it. */
  private drawRail(c: CanvasRenderingContext2D, cam: import('./_parts').Cam, t: number) {
    if (t < this.tRail) return;
    const grow = prog(t, this.tRail, this.tRail + 0.3, ease.outExpo);
    const pts = this.rail.pts.map((q) => toScreen(cam, q.x, q.y));
    const n = Math.max(2, Math.floor(pts.length * grow));
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.slice(0, n).forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
    c.strokeStyle = 'rgba(40,44,43,0.9)'; c.lineWidth = 96 * cam.z; c.stroke();
    c.strokeStyle = '#D6D2CA'; c.lineWidth = 88 * cam.z; c.stroke();
    c.strokeStyle = hexA(this.acc, 0.6); c.lineWidth = 2 * cam.z; c.stroke();
    c.restore();
    if (grow < 1) return;
    const rt = this.rail;
    const cur = rt.words.findIndex((w) => t >= w.start && t < w.end);
    const sL = polylineLengths(pts);
    const scale = sL[sL.length - 1]! / rt.L[rt.L.length - 1]!;
    c.save();
    c.font = font(MONO_B, RAIL_TXT * cam.z);
    let laser: V2 | null = null;
    rt.chars.forEach((chr, i) => {
      const p = pointAtLength(pts, sL, chr.s * scale);
      const lit = t >= chr.t0;
      c.save();
      c.translate(p.x, p.y); c.rotate(p.angle);
      c.fillStyle = lit ? (chr.w === cur ? hexA(this.acc, 1) : '#2A2E2D') : 'rgba(40,44,43,0.14)';
      c.fillText(rt.text[i]!, 0, RAIL_TXT * 0.36 * cam.z);
      c.restore();
      if (lit && t < chr.t0 + 0.08) laser = { x: p.x, y: p.y };
    });
    if (laser) sparksAt(c, laser, t, 5, 18, this.acc);
    c.restore();
  }
}
