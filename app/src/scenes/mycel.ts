// WORLD5 (chorus 5, the final chorus, loud): the mycorrhizal network. Structure: P(doom)'s loom, move
// for move (docs/PDOOM-STRUCTURE.md); the imagery is ours (docs/PLATES.md 16): a botanical engraving of
// tree roots and one fungus trading sugar for minerals underground; the blue is the exchange.
//  1 (loom 1-2) "When others state, our greats will cooperate": hook 4's hairline is the parent hypha.
//    The camera rides its tip (the dot) as it grows through the soil, one node per sung word, the word
//    lettered along it; at every node the foraging branches not taken sprout dimly above and below and
//    fork into the dark, some ending on the grain they found (P, N, Zn...). It snaps out a notch per
//    phrase; tree a's root comes into view ahead.
//  2 (loom 3, the pull-back) hard cut on beat 2 into the hook's first repeat: a reframe along tree a's
//    root, where the hypha lands on "cooperate". The hook is lettered along the root toward the trunk
//    (the dot writes it); the camera steps back a notch per beat, then pulls back to the whole plate:
//    the forest floor in plan, nine trees, one fungus. On the second POWER the whole network lights at
//    once (the maximal hit), with loom's settle.
//  3 (loom 6-8, the Droste) hard cut into the hook's second repeat: a plate nested in itself, one level
//    per beat: tree b's root tip -> a cortical cell -> a mitochondrion -> its cristae. The hook is
//    lettered on each level's object (every nested copy echoes it). On the last POWER the nest twists into
//    a spiral and shows every level at once; it untwists on the next beat and dives three levels, landing
//    on the cristae lined up as the organ's 23 pipes (HANDOFF.pipes), preach's first frame.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { type Line } from '../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse } from '../engine/util';
import { dot2D } from './_power';
import { type Cam, camApply, toScreen, at } from './mycel-kit';
import { HyphaTree, Network, Y0, strandAt } from './mycel-world';
import { Droste } from './mycel-droste';

/** The 2D layer over the frame: straight alpha in, premultiplied over; only the blue glows. */
const UI = /* glsl */ `
uniform sampler2D tex; uniform float hot;
void main() {
  vec4 s = texture(tex, vUv);
  float h = smoothstep(0.25, 0.7, s.b - s.r * 1.3);
  fragColor = vec4(s.rgb * (1.0 + hot * h) * s.a, s.a);
}`;

/**
 * The soil, in plan: graphite ground, engraved grains (outline + hatch on the side away from the light)
 * and a stipple of fines, procedurally in world space under the same camera as the canvas.
 */
const SOIL = /* glsl */ `
uniform vec2 camC; uniform float camZ, camR, soil, lift, inkK;
vec2 hash2(vec2 p) { return hash22(p); }
float grains(vec2 p, float g, float dens, float seed, float pxw, out float shade) {
  vec2 cell = floor(p / g);
  float ink = 0.0; shade = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(float(i), float(j));
    if (hash12(c * 1.37 + seed) > dens) continue;
    vec2 h = hash2(c + seed);
    vec2 fp = (c + 0.22 + 0.56 * h) * g;
    float rad = g * (0.08 + 0.2 * hash12(c + seed + 3.1));
    vec2 d = p - fp;
    float ang = atan(d.y, d.x);
    float wob = 1.0 + 0.15 * sin(ang * 3.0 + h.x * 6.28) + 0.08 * sin(ang * 5.0 + h.y * 6.28) + 0.05 * sin(ang * 8.0 + h.x * 17.0);
    float rr = rad * wob;
    float sd = length(d) - rr;
    ink = max(ink, pxLine(abs(sd) / pxw, 0.35, 1.25));
    if (sd < 0.0) shade = max(shade, smoothstep(0.05, 0.85, dot(d / rr, vec2(0.55, 0.83))));
  }
  return ink;
}
void main() {
  vec2 s = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  vec2 d = (s - vec2(960.0, 540.0)) / camZ;
  float c = cos(-camR), sn = sin(-camR);
  vec2 p = camC + vec2(d.x * c - d.y * sn, d.x * sn + d.y * c);
  float pxw = 1.0 / camZ;
  float y = s.y / 1080.0;
  vec3 col = mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.085, 0.096, 0.093)), y);
  float sh1, sh2;
  float g1 = grains(p, 96.0, 0.3, 1.0, pxw, sh1);
  float g2 = grains(p, 38.0, 0.2, 7.0, pxw, sh2) * smoothstep(5.0, 11.0, 38.0 * camZ);
  float hl = hatch((p.x * 0.6 - p.y * 0.8) / max(5.0, 3.2 * pxw), 0.35) * max(sh1, sh2 * 0.8);
  // fines: a sparse stipple
  vec2 fc = floor(p / 15.0);
  vec2 fo = (fc + 0.5 + 0.35 * (hash22(fc + 9.0) - 0.5)) * 15.0;
  float st = step(hash12(fc + 4.0), 0.16) * pxLine(length(p - fo) / pxw, 0.2, 1.0) * smoothstep(4.0, 8.0, 15.0 * camZ);
  float ink = max(max(g1 * 0.14, g2 * 0.1), max(hl * 0.07, st * 0.12)) * soil;
  col = mix(C_INK, mix(col, C_BONE, ink), inkK) * lift;
  fragColor = vec4(col, 1.0);
}`;

interface Tm {
  s0: number; e0: number; beat: number;
  L1: Line; H1: Line; H2: Line;
  n1: number; n2: number; w1: number;
  c1: number; contact: number; m1: number; m2: number; pb: number; hit: number;
  c2: number; twist: number; untwist: number;
}

export default class Mycel extends Scene {
  ui = new FSPass(UI, { tex: { value: null }, hot: { value: 0.9 } }, { blending: THREE.CustomBlending, transparent: true });
  ground = new FSPass(SOIL, { camC: { value: new THREE.Vector2() }, camZ: { value: 1 }, camR: { value: 0 }, soil: { value: 1 }, lift: { value: 1 }, inkK: { value: 1 } });
  black = new FSPass(`void main(){ fragColor = vec4(C_INK, 1.0); }`);
  L = new Layer2D();
  glow = new LineBatch(40000, { blend: 'add' });
  T!: Tm;
  hy!: HyphaTree;
  net!: Network;
  dro!: Droste;

  override init() {
    const { lyrics: ly, audio: au, start: s0, end: e0 } = this.ctx;
    const um = this.ui.mat;
    um.blendSrc = THREE.OneFactor; um.blendDst = THREE.OneMinusSrcAlphaFactor; um.blendEquation = THREE.AddEquation;
    um.blendSrcAlpha = THREE.OneFactor; um.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    // the three lines by position: the chorus line after hook 4, then the hook's two repeats
    const ls = ly.lines.filter((l) => l.start >= s0 - 0.3 && l.start < e0 - 0.3);
    const L1 = ls.find((l) => /cooperate/i.test(l.text)) ?? ls.find((l) => !/appreciate/i.test(l.text)) ?? ls[0];
    const hooks = ls.filter((l) => l !== L1 && /appreciate/i.test(l.text));
    const H1 = hooks[0], H2 = hooks[1];
    if (!L1 || !H1 || !H2) throw new Error('world5: expected a line and two hook repeats in the window');
    const cutAt = (l: Line) => au.timeOfBeat(Math.floor(au.beatAt(l.words[0]!.start + 0.02)));
    const b0 = Math.round(au.beatAt(s0));
    const B = (k: number) => au.timeOfBeat(b0 + k);
    const beat = B(1) - B(0);
    const c1 = cutAt(H1), c2 = cutAt(H2);
    const bc1 = Math.round(au.beatAt(c1));
    const lastH1 = H1.words[H1.words.length - 1]!, lastH2 = H2.words[H2.words.length - 1]!;
    const hit = au.nearestBeat(lastH1.start);
    const twist = Math.min(au.nearestBeat(lastH2.start), e0 - 2 * beat + 0.01);
    this.T = {
      s0, e0, beat, L1, H1, H2,
      w1: L1.words[0]!.start,
      n1: Math.min(B(2), c1 - 0.6), n2: Math.min(B(4), c1 - 0.5),
      c1, contact: L1.words[L1.words.length - 1]!.end,
      m1: au.timeOfBeat(bc1 + 2), m2: au.timeOfBeat(bc1 + 3), pb: hit - beat, hit,
      c2, twist, untwist: au.timeOfBeat(Math.round(au.beatAt(twist)) + 1),
    };
    this.hy = new HyphaTree(L1.words);
    this.net = new Network(this.hy, H1.words);
    this.dro = new Droste(H2.words);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, T = this.T;
    if (t < T.c2) return this.renderWorld(f, out);
    return this.renderDroste(f, out);
  }

  // ================================================================== 1-2: the forest floor
  private cam1(t: number): Cam {
    const T = this.T;
    const tip = this.hy.tipX(t);
    const zf = keys(t, [[T.s0, 1], [T.n1 - 0.02, 1, ease.linear], [T.n1 + 0.26, 0.8, ease.outExpo], [T.n2 - 0.02, 0.8, ease.linear], [T.n2 + 0.26, 0.64, ease.outExpo]]);
    // ride the tip (it sits right of centre so the words it writes read behind it)
    const follow = prog(t, T.s0 + 0.04, T.w1 + 0.08, ease.inOutCubic);
    const x = lerp(W / 2, tip - 160 / zf, follow);
    const y = lerp(H / 2, Y0 - 150 / zf, prog(t, T.s0 + 0.04, T.n1, ease.inOutCubic));
    return { x, y, z: zf * (1 + 0.012 * prog(t, T.s0, T.c1)), r: 0 };
  }

  private cam2(t: number): Cam {
    const T = this.T, N = this.net;
    const LP = N.letterPath, LL = N.letterL;
    const dir = Math.atan2(N.TA.y - N.P.y, N.TA.x - N.P.x);
    // the close framing follows the writing head along the root
    const pen = this.penS(t);
    const q = at(LP, LL, Math.max(260, pen + 120));
    const zc = keys(t, [[T.c1, 0.96], [T.m1 - 0.02, 0.96, ease.linear], [T.m1 + 0.26, 0.76, ease.outExpo], [T.m2 - 0.02, 0.76, ease.linear], [T.m2 + 0.26, 0.6, ease.outExpo]]);
    const rc = keys(t, [[T.c1, -dir], [T.m2 - 0.02, -dir, ease.linear], [T.m2 + 0.4, -dir * 0.45, (x) => ease.outBack(x, 1.4)]]);
    // then the whole plate, settling on the hit
    const Pl = N.plate;
    const zW = (W / (Pl.x1 - Pl.x0)) * 0.955;
    const k = prog(t, T.pb - 0.02, T.pb + 0.44, ease.inOutCubic);
    const settle = 1 + 0.035 * prog(t, T.hit - 0.02, T.hit + 0.3, ease.outExpo) + 0.012 * prog(t, T.hit + 0.3, T.c2);
    return {
      x: lerp(q.x, (Pl.x0 + Pl.x1) / 2, k), y: lerp(q.y + 40, (Pl.y0 + Pl.y1) / 2, k),
      z: Math.exp(lerp(Math.log(zc), Math.log(zW), k)) * settle, r: lerp(rc, 0, k),
    };
  }

  /** Arc position of the writing head along the lettering path (0 before the first word). */
  private penS(t: number) {
    const lt = this.net.lettering;
    let s = 0;
    lt.words.forEach((w, wi) => {
      const [g0, g1] = lt.ranges[wi]!;
      const n = g1 - g0;
      const p = clamp((t - w.start) / Math.max(1e-3, w.end - w.start));
      if (p <= 0) return;
      const i = Math.min(n - 1, Math.floor(p * n));
      const g = lt.glyphs[g0 + i]!;
      s = g.s - g.w / 2 + g.w * (p * n - i);
    });
    return s;
  }

  private renderWorld(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const T = this.T, t = f.t;
    const m2 = t >= T.c1;
    const cam = m2 ? this.cam2(t) : this.cam1(t);
    // ---- ground
    const g = this.ground.u;
    (g.camC!.value as THREE.Vector2).set(cam.x, cam.y);
    g.camZ!.value = cam.z; g.camR!.value = cam.r;
    g.soil!.value = prog(t, T.s0 + 0.02, T.s0 + 0.4) * (m2 ? lerp(0.9, 0.65, prog(t, T.pb, T.hit)) : 0.75);
    const lit = t >= T.hit ? pulse(t, T.hit, 0.1) : 0;
    g.lift!.value = 1;
    g.inkK!.value = prog(t, T.s0 + 0.03, T.s0 + 0.35, ease.inOutQuad); // hook 4's ink, then the soil's graphite
    this.ground.render(renderer, out);

    // ---- glow (additive, HDR): the hypha's streaming core, the root's exchange, the lit network
    const lb = this.glow; lb.clear();
    const S = (x: number, y: number) => toScreen(cam, x, y);
    const sig = LIN.signal, bone = LIN.bone;
    const tip = this.hy.tipX(t);
    const k0 = 1 - prog(t, T.s0, T.s0 + 0.14); // hook 4's white-hot line, cooling
    {
      // the chosen hypha: blue core, hottest at the tip
      const x0 = -900, n = 70;
      for (let i = 0; i < n; i++) {
        const xa = lerp(x0, tip, i / n), xb = lerp(x0, tip, (i + 1) / n);
        const hot = Math.exp(-(tip - xb) / 180);
        const I = (0.55 + 2.2 * hot) * prog(t, T.s0 + 0.03, T.s0 + 0.2) + (t >= T.hit - 0.01 ? 2.4 * pulse(t, T.hit, 0.13) + 0.4 : 0);
        const a = S(xa, Y0), b = S(xb, Y0);
        lb.seg2(a.x, a.y, b.x, b.y, Math.max(1.2, 2.2 * cam.z), [sig[0] * I + hot * 0.25, sig[1] * I + hot * 0.3, sig[2] * I], 1);
      }
      if (k0 > 0) {
        // hook 4's exit: a full-width bone hairline, a faint blue one above it (both hot on the cut)
        const a = S(-2000, Y0), b = S(5000, Y0);
        lb.seg2(a.x, a.y, b.x, b.y, 2, [bone[0] * 2.2 * k0, bone[1] * 2.2 * k0, bone[2] * 2.2 * k0], 1);
        // and its dot's white-hot core
        const d0 = S(tip, Y0 - 1);
        lb.seg2(d0.x - 0.2, d0.y, d0.x + 0.2, d0.y, 7, [2.2 * k0, 2.3 * k0, 2.6 * k0], 1);
        lb.seg2(a.x, a.y - 3, b.x, b.y - 3, 1, [sig[0] * 1.5 * k0, sig[1] * 1.5 * k0, sig[2] * 1.5 * k0], 1);
      }
    }
    // the network's strands: dim bone hairlines; lit blue at once on the hit, then the exchange runs
    const N = this.net;
    const netA = m2 ? lerp(0.14, 0.24, prog(t, T.pb, T.hit)) : 0.05 * prog(t, T.s0 + 0.2, T.n1) + 0.07 * prog(t, T.n2 - 0.1, T.n2 + 0.3);
    const litK = t >= T.hit - 0.01 ? 1.7 * pulse(t, T.hit, 0.13) + 0.42 : 0;
    const pre = 0;
    for (const s of N.strands) {
      const w = s.cord ? 1.9 : 1.0;
      const I = litK + pre * s.delay;
      const pts = s.pts;
      let a = S(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) {
        const b = S(pts[i]!.x, pts[i]!.y);
        if (I > 0.01) lb.seg2(a.x, a.y, b.x, b.y, Math.max(1, w * cam.z * 1.4), [sig[0] * I, sig[1] * I, sig[2] * I], 1);
        else lb.seg2(a.x, a.y, b.x, b.y, Math.max(0.8, w * cam.z), [bone[0] * netA, bone[1] * netA, bone[2] * netA], 1);
        a = b;
      }
      // after the hit: the exchange keeps running, a pulse per strand
      if (t > T.hit) {
        const u = ((t - T.hit) * (380 / s.L[s.L.length - 1]!) + s.delay) % 1;
        for (let j = 0; j < 4; j++) {
          const p = strandAt(s, u - j * 0.012), q = strandAt(s, u - (j + 1) * 0.012);
          const sp = S(p.x, p.y), sq = S(q.x, q.y);
          const I2 = 3 * (1 - j / 4);
          lb.seg2(sp.x, sp.y, sq.x, sq.y, Math.max(1.4, 3 * cam.z), [sig[0] * I2 + 0.2, sig[1] * I2 + 0.2, sig[2] * I2], 1);
        }
      }
    }
    lb.render(renderer, out);

    // ---- the engraving
    const L = this.L; L.clear();
    const c = L.ctx;
    camApply(c, cam);
    const worldA = m2 ? 1 : 0.3 * prog(t, T.s0 + 0.1, T.n1) + 0.3 * prog(t, T.n2 - 0.1, T.n2 + 0.3);
    N.drawRoots(c, cam.z, worldA);
    this.hy.drawBranches(c, t, cam.z, m2 ? lerp(1, 0.6, prog(t, T.pb, T.hit)) : 1);
    this.hy.drawTrunk(c, t, cam.z, T.s0);
    this.hy.drawWords(c, t);
    // the hook along tree a's root
    let pen: { x: number; y: number } | null = null;
    if (m2) {
      // tree a's root carries the exchange behind the writing head (blue, on the root)
      const ps = this.penS(t);
      if (ps > 1) {
        const RP = N.rootPath, RL = N.rootL;
        const n = 36;
        c.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const sa = (ps * i) / n, sb = (ps * (i + 1)) / n;
          const pa = at(RP, RL, sa), pb = at(RP, RL, sb);
          const I = 0.35 + 0.65 * Math.exp(-(ps - sb) / 180);
          c.strokeStyle = rgba('signal', I);
          c.lineWidth = 3.2 + 3 * (sb / RL[RL.length - 1]!);
          c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
        }
      }
      pen = N.lettering.draw(c, t, { guide: 0.1 });
    }
    N.drawFurniture(c, cam.z, m2 ? 1 : worldA, m2 ? prog(t, T.pb, T.hit) : 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // the dot: the hypha's tip; on the root, the writing head
    const tipS = S(tip, Y0);
    let dp = { x: tipS.x, y: tipS.y - k0 }, ds = lerp(0.9, 0.8, prog(t, T.s0, T.s0 + 0.3)) * (0.6 + 0.4 * cam.z);
    if (m2 && t >= T.contact && pen) { const q = S(pen.x, pen.y); dp = { x: q.x, y: q.y - 4 }; }
    else if (m2 && t >= T.contact) { const q0 = at(N.letterPath, N.letterL, 60); const q = S(q0.x, q0.y); dp = { x: q.x, y: q.y }; }
    if (m2) ds = (0.55 + 0.45 * cam.z) * (1 + 1.2 * pulse(t, T.contact, 0.08) + 1.4 * lit);
    dot2D(c, dp.x, dp.y, t, ds, 1, 0.35);
    this.ui.u.tex!.value = L.upload();
    this.ui.u.hot!.value = 0.9 + 1.3 * k0; // hook 4's exit ran white-hot
    this.ui.render(renderer, out);

    // ---- post: hook 4's look on frame 1, then ours; the maximal hit
    const k1 = prog(t, T.s0, T.s0 + 0.3);
    const db = this.ctx.audio.downbeats.find((d) => t >= d && t < d + 0.3);
    let shake: [number, number] = [0, 0];
    if (lit > 0.02) shake = [noise1(t * 60, 1) * 9 * lit, noise1(t * 60, 2) * 9 * lit];
    return {
      bloom: lerp(0.6, 0.7, k1) + 0.35 * lit, bloomThreshold: 1.0, bloomKnee: lerp(0.2, 0.3, k1), bloomRadius: lerp(0.55, 0.7, k1) - 0.25 * (t >= T.hit ? prog(t, T.hit - 0.05, T.hit) : 0),
      halation: 0.2, ca: lerp(0.5, 0.8, k1) + 1.2 * lit, vignette: lerp(0.4, 0.45, k1), grain: lerp(0.055, 0.06, k1), hud: 0,
      flash: (db !== undefined && db > T.s0 + 0.1 ? 0.01 * Math.pow(0.5, (t - db) / 0.06) : 0),
      zoom: 1 + 0.01 * f.a.kick * (t > T.s0 + 0.2 ? 1 : 0) + 0.02 * lit, exposure: 1 + 0.03 * lit, shake,
    };
  }

  // ================================================================== 3: the Droste
  private renderDroste(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const T = this.T, t = f.t;
    this.black.render(renderer, out);
    const L = this.L; L.clear();
    const c = L.ctx;
    const au = this.ctx.audio;
    // the hole opens; one level per beat; the twist on the last POWER shows every level at once; it
    // untwists on the next beat and dives to the bottom, braking into it exactly on the cut
    const open = prog(t, T.c2, T.c2 + 0.4, ease.outExpo);
    const bt = Math.max(0, au.beatAt(t) - au.beatAt(T.c2) - 1);
    const stepped = Math.min(2, Math.floor(bt) + ease.inOutQuart(bt - Math.floor(bt)));
    const creep = 0.18 * prog(t, T.c2 + 3 * T.beat, T.twist);
    const tw = prog(t, T.twist - 0.05, T.twist + 0.07, ease.inOutCubic) * (1 - prog(t, T.untwist - 0.04, T.untwist + 0.16, ease.inOutCubic));
    const zTw = lerp(stepped + creep, 0.55, prog(t, T.twist - 0.05, T.twist + 0.2, ease.outExpo));
    const dive = prog(t, T.untwist, T.e0, ease.inOutCubic);
    const z = t < T.twist - 0.05 ? stepped + creep : t < T.untwist ? zTw : lerp(zTw, this.dro.levels.length - 1, dive);
    const end = prog(t, T.e0 - 0.3, T.e0 - 1 / 60);
    this.dro.draw(c, t, { z, open, twist: 0.42 * tw, end });
    this.ui.u.tex!.value = L.upload();
    this.ui.u.hot!.value = lerp(0.9, 0.4, end);
    this.ui.render(renderer, out);
    const twk = Math.exp(-Math.abs(t - T.twist) / 0.05);
    return {
      bloom: 0.7, bloomThreshold: 1.0, bloomKnee: 0.3, bloomRadius: 0.7, halation: 0.2, vignette: 0.45, grain: 0.06, hud: 0,
      ca: 0.8 + 1.6 * twk, flash: 0.006 * twk,
      zoom: 1 + 0.012 * f.a.kick * (1 - dive) + 0.025 * twk,
    };
  }
}
