// WORLD4 (chorus 4, the quiet chorus): the culture, and the reveal. Structure: P(doom)'s paperclips ->
// fuse, move for move (docs/PDOOM-STRUCTURE.md); the imagery is ours (docs/PLATES.md 13).
//  A  (paperclips 1-3) a petri dish seen from above. The blue dot (hook 3's last light) drops onto a
//     bone agar plate; the agar is revealed by the ripple. The seed inflates into the founder colony on
//     the downbeat and the colonies divide on every 8th, 1 -> 64 (binary fission; the split tree of
//     paperclips.ts). The first half-line grows as a colony legend arching over the culture: the growth
//     front, hot blue, is the cursor. The lawn floods the plate; the camera pulls back to the whole dish.
//  B  (paperclips 5) crane from overhead to a low glide over the agar: colonies as a landscape of engraved
//     domes (ray-cast). The dot leaves its colony and runs ahead as the lamp, growing the second half-line
//     on the agar as road markings, one word per row.
//  C  (paperclips 6-8) the lid comes down one step per beat; the hook's repeat is pressed onto the label
//     taped round the dish wall at the horizon, a word per press, squeezed with the slot; everything
//     outside the slot goes dark; one line is left, the dot at its centre.
//  D  (fuse: the macro cut, the push along the revealed object, the inhale) hard cut: the dot, magnified,
//     is an organelle with a double membrane and cristae. The camera pulls back (the maximal hit, landing
//     on the downbeat): it sits in a textbook cell section, one mitochondrion among others, the only one
//     lit. Two billion years ago a bacterium got into another cell, was not digested, stayed, and became
//     its power plant. The hook's second half is engraved along its callout; "power" lands on the name.
//     In the last half beat the camera inhales into the dot, which lands on the connector's pin 1.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H, SS_TAP } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, layout, type TextLayout } from '../engine/type';
import { Lyrics, norm, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, keys, lerp, noise1, prog, pulse, smoothstep, type Key } from '../engine/util';
import { dot2D, burst2D, HANDOFF } from './_power';
import { AG, N_ITEMS, FRAG_AGAR, splitTree, treeItems, arcLettering, roadLettering, type Tree, type Lettering } from './culture-agar';
import { CellPlate, HERO, type PlateCam } from './culture-cell';

const FOV = 32;
const FOCAL = H / 2 / Math.tan((FOV * Math.PI) / 360);

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
interface Cam { pos: V3; R: V3; U: V3; F: V3 }
function lookCam(pos: V3, fwd: V3, roll = 0): Cam {
  const Fw = nrm(fwd);
  let R = cross(Fw, [0, 0, 1]);
  if (Math.hypot(...R) < 1e-4) R = [1, 0, 0];
  R = nrm(R);
  const U = cross(R, Fw);
  const c = Math.cos(roll), s = Math.sin(roll);
  return { pos, R: [R[0] * c + U[0] * s, R[1] * c + U[1] * s, R[2] * c + U[2] * s], U: [U[0] * c - R[0] * s, U[1] * c - R[1] * s, U[2] * c - R[2] * s], F: Fw };
}
function project(c: Cam, p: V3) {
  const d = sub(p, c.pos);
  const z = dot(d, c.F);
  return { x: W / 2 + (FOCAL * dot(d, c.R)) / z, y: H / 2 - (FOCAL * dot(d, c.U)) / z, z };
}

/** The 2D layer over the frame: straight alpha in, premultiplied over; only the blue glows. */
const UI = /* glsl */ `
uniform sampler2D tex; uniform float hot;
void main() {
  vec4 s = texture(tex, vUv);
  float h = smoothstep(0.25, 0.7, s.b - s.r * 1.3);
  fragColor = vec4(s.rgb * (1.0 + hot * h) * s.a, s.a);
}`;
/** The reveal's ground: prompt3's graphite (its first frame is ours, minus the plate). */
const GROUND = /* glsl */ `
uniform float k;
void main() {
  float y = 1.0 - vUv.y;
  vec3 col = mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.094, 0.106, 0.102)), y);
  col = mix(C_INK, col, k);
  fragColor = vec4(col, 1.0);
}`;

interface T {
  s0: number; e0: number; beat: number;
  wA: Word[]; wB: Word[]; hA: Word[]; hB: Word[];
  tContact: number; tInfl: number; splits: number[]; tFill: number; tWide0: number;
  tTilt0: number; tTilt1: number; tLaunch: number; tRoadEnd: number;
  slams: number[]; d0: number; tCut: number; tLand: number; tInh: number;
}

export default class Culture extends Scene {
  agar = new FSPass(FRAG_AGAR, {
    camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() }, camF: { value: new THREE.Vector3() },
    focal: { value: FOCAL }, res: { value: new THREE.Vector2(W, H) }, time: { value: 0 }, ssTap: SS_TAP,
    items: { value: Array.from({ length: N_ITEMS }, () => new THREE.Vector4()) },
    itemH: { value: Array.from({ length: N_ITEMS }, () => new THREE.Vector4()) },
    clusB: { value: new THREE.Vector4() }, clus: { value: new THREE.Vector3() },
    fillT: { value: -1 }, fillRate: { value: 0.0075 }, revealR: { value: 0 }, lidZ: { value: 1000 }, keyI: { value: 1 }, fogK: { value: 0 },
    slitK: { value: 0 }, slitH: { value: 100 }, horizonY: { value: 0 }, lampI: { value: 0 }, topK: { value: 1 }, dim: { value: 1 },
    lampPos: { value: new THREE.Vector3() }, keyDir: { value: new THREE.Vector3() },
    texA: { value: null }, rectA: { value: new THREE.Vector4() }, timeA: { value: new THREE.Vector3() },
    texB: { value: null }, rectB: { value: new THREE.Vector4() }, timeB: { value: new THREE.Vector3() },
  });
  ui = new FSPass(UI, { tex: { value: null }, hot: { value: 0.9 } }, { blending: THREE.CustomBlending, transparent: true });
  ground = new FSPass(GROUND, { k: { value: 1 } });
  L = new Layer2D();
  T!: T;
  tree!: Tree;
  itemBuf = new Float32Array(N_ITEMS * 4);
  itemHBuf = new Float32Array(N_ITEMS * 4);
  lettA!: Lettering;
  lettB!: Lettering & { rows: { y: number; x0: number; x1: number }[] };
  plate!: CellPlate;
  tapeLay!: TextLayout;
  tapeText = '';
  tapeFam = F.archivo(62, 900);

  override init() {
    const { lyrics: ly, audio: au, start: s0, end: e0, renderer } = this.ctx;
    const um = this.ui.mat;
    um.blendSrc = THREE.OneFactor; um.blendDst = THREE.OneMinusSrcAlphaFactor; um.blendEquation = THREE.AddEquation;
    um.blendSrcAlpha = THREE.OneFactor; um.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    // the two lines in the window, by position: the chorus line after hook 3, then the hook's repeat
    const ls = ly.lines.filter((l) => l.start >= s0 - 0.3 && l.start < e0 - 0.3);
    const L1: Line | undefined = ls.find((l) => !/appreciate/i.test(l.text)) ?? ls[0];
    const L2: Line | undefined = ls.find((l) => l !== L1 && /appreciate/i.test(l.text)) ?? ls[1];
    if (!L1 || !L2 || L1.words.length < 2 || L2.words.length < 2) throw new Error('world4: expected two lines in the window');
    // line 1 splits at its longest breath (the comma): the legend, then the road
    let iB = 1, gap = -1;
    for (let i = 1; i < L1.words.length; i++) { const g = L1.words[i]!.start - L1.words[i - 1]!.end; if (g > gap) { gap = g; iB = i; } }
    const wA = L1.words.slice(0, iB), wB = L1.words.slice(iB);
    // the hook's repeat splits at its second "we": the label, then the callout (words sung after the cut are dropped)
    const w2 = L2.words.filter((w) => w.start < e0 - 0.1);
    let iW = w2.findIndex((w, i) => i > 0 && norm(w.w) === 'we');
    if (iW <= 0) iW = Math.ceil(w2.length / 2);
    const hA = w2.slice(0, iW), hB = w2.slice(iW);

    const b0 = Math.round(au.beatAt(s0));
    const beat = au.timeOfBeat(b0 + 1) - au.timeOfBeat(b0);
    const tContact = clamp(wA[0]!.start, s0 + 0.04, s0 + 0.12);
    const bInfl = Math.ceil(au.beatAt(tContact + 0.15) - 1e-3);
    const tInfl = au.timeOfBeat(bInfl);
    const splits = Array.from({ length: AG.LEVELS }, (_, k) => au.timeOfBeat(bInfl + 1 + 0.5 * k));
    const tTilt0 = au.timeOfBeat(bInfl + 4);
    const tLand = au.timeOfBeat(Math.floor(au.beatAt(hB[0]?.start ?? e0 - beat * 4) + 0.1));
    const tCut = Math.max(tLand - beat, (hA[hA.length - 1]?.end ?? tLand - beat) - 0.05);
    const slams: number[] = [];
    for (let b = Math.round(au.beatAt(hA[0]!.start)); au.timeOfBeat(b) < tCut - 0.3 && slams.length < 4; b++) slams.push(au.timeOfBeat(b));
    if (!slams.length) slams.push(tCut - beat);
    this.T = {
      s0, e0, beat, wA, wB, hA, hB, tContact, tInfl, splits, tFill: splits[AG.LEVELS - 1]! + 0.1,
      tWide0: Math.min(wB[0]!.start - 0.1, splits[AG.LEVELS - 1]! - 0.1),
      tTilt0, tTilt1: tTilt0 + 0.95, tLaunch: wB[0]!.start - 0.2, tRoadEnd: wB[wB.length - 1]!.end,
      slams, d0: slams[0]! - 0.3, tCut, tLand, tInh: e0 - beat / 2,
    };

    this.tree = splitTree();
    this.lettA = arcLettering(renderer, wA, AG.C0, 12.6, 1.75);
    this.lettB = roadLettering(renderer, wB, 0, 2, 27, 4.6, 3.3);
    const u = this.agar.u;
    const setLett = (tex: string, rect: string, time: string, l: Lettering) => {
      u[tex]!.value = l.tex;
      (u[rect]!.value as THREE.Vector4).set(...l.rect);
      (u[time]!.value as THREE.Vector3).set(l.tr[0], l.tr[1], l.blur);
    };
    setLett('texA', 'rectA', 'timeA', this.lettA);
    setLett('texB', 'rectB', 'timeB', this.lettB);
    (u.clus!.value as THREE.Vector3).set(AG.C0.x, AG.C0.y, this.tree.rcut);
    (u.clusB!.value as THREE.Vector4).set(AG.C0.x, AG.C0.y, this.tree.rcut + 2.5, 0);

    this.plate = new CellPlate(hB);
    this.tapeText = hA.map((w) => w.w.toUpperCase().replace(/[,.?!]$/, '')).join(' ');
    this.tapeLay = layout(this.tapeText, this.tapeFam, 200, -2);
  }

  // ------------------------------------------------------------------ the dish: timing helpers
  private splitE(t: number) { return this.T.splits.map((s) => prog(t, s, s + 0.3, ease.outExpo)); }
  private inflate(t: number) {
    const T = this.T;
    const seed = t >= T.tContact ? 0.2 : 0;
    return seed + (1 - seed) * prog(t, T.tInfl, T.tInfl + 0.42, (x) => ease.outBack(x, 2.2));
  }
  /** The lid's height (mm; 1000 = off): one slam per beat, then the close. */
  private lid(t: number) {
    const T = this.T;
    if (t < T.slams[0]! - 0.02) return 1000;
    const hs = [4.4, 2.5, 1.45, 1.05];
    const ks: Key[] = [[T.slams[0]! - 0.02, 40]];
    T.slams.forEach((s, i) => {
      if (i > 0) ks.push([s, hs[i - 1]! * 0.94, ease.linear]);
      ks.push([s + 0.17, hs[i]!, ease.outExpo]);
    });
    const hl = hs[T.slams.length - 1]!;
    ks.push([Math.max(T.slams[T.slams.length - 1]! + 0.2, T.tCut - 0.14), hl * 0.8, ease.linear], [T.tCut, 0.22, ease.inQuad]);
    return keys(t, ks);
  }

  /** Top-down framing: frame height (mm) and centre. */
  private topFrame(t: number) {
    const T = this.T, C = AG.C0;
    const k0 = prog(t, T.tContact, T.tContact + 0.5, ease.outCubic);
    let hf = lerp(20, 27, k0), cy = lerp(C.y, C.y + 5.8, k0), cx = C.x;
    const HF = [27, 27.6, 28.6, 29.8, 31.2, 32.6, 34];
    const CY = [5.8, 5.4, 4.8, 4.2, 3.6, 3.0, 2.4];
    T.splits.forEach((s, l) => {
      const k = prog(t, s - 0.2, s + 0.2, ease.inOutCubic);
      hf += (HF[l + 1]! - HF[l]!) * k; cy += (CY[l + 1]! - CY[l]!) * k;
    });
    // the whole dish (and the road's first word) before the crane
    const kw = prog(t, T.tWide0, T.tTilt0, ease.inOutCubic);
    hf = Math.exp(lerp(Math.log(hf), Math.log(98), kw));
    cx = lerp(cx, 0, kw); cy = lerp(cy, 1.5, kw);
    // a slow breath, and the split pulses
    for (const s of T.splits) hf *= 1 + 0.018 * Math.sin(Math.PI * prog(t, s - 0.06, s + 0.26));
    return { hf, cx, cy };
  }

  /** Where the road's cursor is aimed: row by row with the words. */
  private roadY(t: number) {
    const rows = this.lettB.rows, wB = this.T.wB;
    const ks: Key[] = [[this.T.tTilt0 - 0.4, rows[0]!.y - 1, ease.inOutQuad]];
    wB.forEach((w, i) => ks.push([w.start + 0.05, rows[Math.min(i, rows.length - 1)]!.y + 0.8, ease.inOutQuad]));
    // past the last word the glide carries on over it, toward the wall, into the first press
    ks.push([this.T.slams[0]!, rows[rows.length - 1]!.y + 12.5, ease.inOutQuad], [this.T.tCut, rows[rows.length - 1]!.y + 13.5, ease.linear]);
    return keys(t, ks);
  }

  camera(t: number): Cam {
    const T = this.T;
    const drift = noise1(t * 0.6, 3) * 0.012;
    const top = this.topFrame(Math.min(t, T.tTilt0));
    const h = top.hf / 2 / Math.tan((FOV * Math.PI) / 360);
    if (t < T.tTilt0) {
      const roll = lerp(-0.035, 0.03, prog(t, T.s0, T.tTilt0, ease.inOutQuad)) + drift;
      return lookCam([top.cx, top.cy, h], [0, 0.0001, -1], roll);
    }
    // the crane: from overhead, swinging down around a target that glides north over the road
    const k = prog(t, T.tTilt0, T.tTilt1, ease.inOutCubic);
    const el = lerp(Math.PI / 2 - 0.0001, 0.3, k);
    const dist = Math.exp(lerp(Math.log(h), Math.log(12.5), ease.inOutQuad(k)));
    const ty = lerp(top.cy, this.roadY(t), smoothstep(0, 0.7, k));
    const target: V3 = [lerp(top.cx, 0, k) + Math.sin((t - T.tTilt0) * 1.1) * 0.6 * k, ty, 0];
    let pos: V3 = [target[0], target[1] - dist * Math.cos(el), dist * Math.sin(el)];
    let fwd = nrm(sub(target, pos));
    let roll = lerp(0.03, 0, k) + drift + Math.sin(t * 1.3) * 0.012 * k;
    // the lid: level the camera and hold it in the middle of the shrinking slot
    const kd = prog(t, T.d0 - 0.25, T.d0 + 0.2, ease.inOutCubic);
    if (kd > 0) {
      const lid = this.lid(t);
      const zc = lid < 900 ? Math.min(pos[2], lid / 2) : pos[2];
      pos = [pos[0] * (1 - kd), pos[1], lerp(pos[2], Math.min(pos[2], zc, 2.6), kd)];
      fwd = nrm([fwd[0] * (1 - kd), lerp(fwd[1], 1, kd), fwd[2] * (1 - kd)]);
      roll *= 1 - kd;
    }
    return lookCam(pos, fwd, roll);
  }

  /** The dot's world position in the dish (the founder's heart, then the road's growth front, then the wall). */
  private dotWorld(t: number, cam: Cam, lid: number): V3 {
    const T = this.T;
    const e = this.splitE(t);
    treeItems(this.tree, e, T.splits, t, this.inflate(t), 0, this.itemBuf, this.itemHBuf);
    const home: V3 = [this.itemBuf[0]!, this.itemBuf[1]!, 0.2 + this.itemBuf[3]! * 0.6];
    if (t < T.tLaunch) return home;
    const f = this.lettB.front(t);
    const run: V3 = [f.x + 0.15, f.y, 0.4];
    const k = prog(t, T.tLaunch, T.tLaunch + 0.26, ease.inOutCubic);
    let p: V3 = [lerp(home[0], run[0], k), lerp(home[1], run[1], k), lerp(home[2], run[2], k) + 0.8 * Math.sin(Math.PI * k)];
    // then ahead to the wall, riding the label's pressed words
    const kt = prog(t, T.tRoadEnd + 0.05, T.slams[0]! - 0.02, ease.inOutCubic);
    if (kt > 0) {
      const D = this.wallDist(cam);
      const tc = this.tapeCursor(t, cam, lid < 900 ? lid : 6, D);
      const d = D - 0.5;
      const sx = (tc.x - W / 2) / FOCAL * d, sy = (H / 2 - tc.y) / FOCAL * d;
      const w: V3 = [cam.pos[0] + cam.F[0] * d + cam.R[0] * sx + cam.U[0] * sy, cam.pos[1] + cam.F[1] * d + cam.R[1] * sx + cam.U[1] * sy, cam.pos[2] + cam.F[2] * d + cam.R[2] * sx + cam.U[2] * sy];
      p = [lerp(p[0], w[0], kt), lerp(p[1], w[1], kt), lerp(p[2], w[2], kt)];
    }
    return p;
  }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    return f.t < this.T.tCut ? this.renderDish(f, out) : this.renderCell(f, out);
  }

  private renderDish(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = this.T, t = f.t;
    const { renderer } = this.ctx;
    const cam = this.camera(t);
    const lid = this.lid(t);
    const u = this.agar.u;
    (u.camPos!.value as THREE.Vector3).set(...cam.pos);
    (u.camR!.value as THREE.Vector3).set(...cam.R);
    (u.camU!.value as THREE.Vector3).set(...cam.U);
    (u.camF!.value as THREE.Vector3).set(...cam.F);
    u.time!.value = t;
    // the colonies of the split tree
    const e = this.splitE(t);
    const seedHeat = t >= T.tContact ? 1 - prog(t, T.tInfl, T.tInfl + 0.55, ease.outQuad) : 0;
    treeItems(this.tree, e, T.splits, t, t >= T.tContact ? this.inflate(t) : 0, seedHeat, this.itemBuf, this.itemHBuf);
    const it = u.items!.value as THREE.Vector4[], ih = u.itemH!.value as THREE.Vector4[];
    for (let k = 0; k < N_ITEMS; k++) { it[k]!.fromArray(this.itemBuf, k * 4); ih[k]!.fromArray(this.itemHBuf, k * 4); }
    u.fillT!.value = t >= T.tFill ? t - T.tFill : -1;
    u.revealR!.value = t < T.tContact ? 0 : 0.8 + 62 * prog(t, T.tContact, T.tContact + 1.3, ease.outCubic);
    const kc = prog(t, T.tTilt0, T.tTilt1, ease.inOutCubic);
    u.topK!.value = 1 - kc;
    (u.keyDir!.value as THREE.Vector3).set(...nrm([lerp(-0.5, 0.35, kc), lerp(0.62, -0.55, kc), lerp(0.7, 0.62, kc)]));
    u.lidZ!.value = lid;
    u.fogK!.value = lerp(0, 0.03, kc);
    const dw = this.dotWorld(t, cam, lid);
    // restore the items (dotWorld reuses the buffer)
    treeItems(this.tree, e, T.splits, t, t >= T.tContact ? this.inflate(t) : 0, seedHeat, this.itemBuf, this.itemHBuf);
    (u.lampPos!.value as THREE.Vector3).set(...dw);
    // the lamp: the dot's light; it brightens a little on the snare (the quiet chorus's light drums)
    u.lampI!.value = t < T.tContact ? 0 : lerp(0.25, 1, prog(t, T.tLaunch, T.tLaunch + 0.3)) * (1 + 0.35 * f.a.snare);
    const closed = lid < 900 ? clamp((lid - 0.3) / 5) : 1;
    u.keyI!.value = lerp(0.35, 1, closed);
    // the final close
    const last = T.slams[T.slams.length - 1]!;
    const slitK = prog(t, last + 0.14, T.tCut - 0.02, ease.inOutCubic);
    const D = this.wallDist(cam);
    u.slitK!.value = slitK;
    u.slitH!.value = lid < 900 ? Math.max((FOCAL * Math.max(lid / 2 - 0.1, 0.01)) / D, 0.6) : 300;
    u.horizonY!.value = (FOCAL * cam.F[2]) / Math.hypot(cam.F[0], cam.F[1]);
    this.agar.render(renderer, out);

    // ---- 2D: the dot, the burst at contact, the label on the wall
    const L = this.L; L.clear();
    const c = L.ctx;
    this.drawTape(c, t, cam, lid, D);
    const dp = this.dotScreen(t, cam, dw, lid, D);
    if (t < T.tContact + 0.4) burst2D(c, dp.x, dp.y, t, T.tContact, { n: 46, speed: 520, life: 0.4, width: 1.4, seed: 13 });
    dot2D(c, dp.x, dp.y, t, dp.s, dp.i, 0.35);
    this.ui.u.tex!.value = L.upload();
    this.ui.u.hot!.value = 0.9;
    this.ui.render(renderer, out);

    // ---- post: hook 3's look on frame 1, then ours; a small jolt per press
    let shake: [number, number] = [0, 0];
    T.slams.forEach((s, i) => {
      const p = t - s;
      if (p > 0 && p < 0.35) {
        const a = [7, 5, 4, 3][i]! * Math.exp(-p * 16);
        shake = [shake[0] + a * Math.sin(p * 90), shake[1] + a * Math.cos(p * 71)];
      }
    });
    const k1 = prog(t, T.s0, T.tContact + 0.2);
    return {
      bloom: lerp(0.6, 0.65, k1), bloomThreshold: 1.0, bloomKnee: lerp(0.2, 0.3, k1), bloomRadius: lerp(0.55, 0.7, k1),
      halation: 0.2, ca: lerp(0.5, 0.8, k1), vignette: lerp(0.4, 0.45, k1), grain: lerp(0.07, 0.06, k1), shake, hud: 0,
    };
  }

  /** Distance from the camera to the dish wall straight ahead (the label's plane). */
  private wallDist(cam: Cam) {
    const x = cam.pos[0];
    return Math.max(1, Math.sqrt(AG.RD * AG.RD - x * x) - cam.pos[1]);
  }

  /** The dot on screen: its size, brightness and place for each phase of the dish. */
  private dotScreen(t: number, cam: Cam, dw: V3, lid: number, D: number) {
    const T = this.T;
    // before contact: hook 3's dot, falling onto the agar
    if (t < T.tContact) {
      const k = prog(t, T.s0, T.tContact, ease.inQuad);
      return { x: W / 2, y: H / 2, s: lerp(0.9, 0.62, k), i: 1 };
    }
    const p = project(cam, dw);
    const zS = clamp(8 / Math.max(p.z, 0.5), 0.35, 1.3);
    let s = t < T.tLaunch ? lerp(0.62, 0.5, prog(t, T.tContact, T.tInfl)) * (1 + 0.5 * pulse(t, T.tInfl, 0.08)) : lerp(0.5, zS, prog(t, T.tLaunch, T.tLaunch + 0.3));
    let x = p.x, y = p.y;
    // from the end of the road to the label: the dot runs ahead to the wall, then rides the pressed words
    const tape = this.tapeCursor(t, cam, lid, D);
    const kt = prog(t, T.tRoadEnd + 0.05, T.slams[0]! - 0.02, ease.inOutCubic);
    if (kt > 0 && tape) { x = lerp(x, tape.x, kt); y = lerp(y, tape.y, kt); s = lerp(s, 0.75, kt); }
    // the close: to the centre of the last line
    const kz = prog(t, (T.hA[T.hA.length - 1]?.end ?? T.tCut - 0.4) - 0.05, T.tCut - 0.08, ease.inOutCubic);
    if (kz > 0) { x = lerp(x, W / 2, kz); y = lerp(y, H / 2, kz); s = lerp(s, 0.9, kz); }
    return { x, y, s, i: 1 };
  }

  /** The label's band on screen (the far wall, between the agar and the lid). */
  private tapeBand(cam: Cam, lid: number, D: number) {
    const zBot = 0.25, zTop = Math.min(4.8, (lid < 900 ? lid : AG.WTOP) - 0.28);
    const wy = cam.pos[1] + D;
    const a = project(cam, [cam.pos[0], wy, zTop]), b = project(cam, [cam.pos[0], wy, zBot]);
    return { top: a.y, bot: b.y };
  }
  private tapeGeom(band: { top: number; bot: number }) {
    const h = band.bot - band.top;
    const capH = Math.max(0.5, h * 0.56);
    const sx = (W - 250) / this.tapeLay.width, sy = capH / (200 * 0.686);
    const x0 = W / 2 - (this.tapeLay.width * sx) / 2;
    const base = (band.top + band.bot) / 2 + capH / 2;
    return { h, capH, sx, sy, x0, base };
  }
  private tapeCursor(t: number, cam: Cam, lid: number, D: number) {
    const T = this.T;
    const band = this.tapeBand(cam, lid < 900 ? lid : 6, D);
    const g = this.tapeGeom(band);
    let x = g.x0 - 18;
    let gi = 0;
    for (const w of T.hA) {
      const txt = w.w.toUpperCase().replace(/[,.?!]$/, '');
      const start = this.tapeText.indexOf(txt, gi);
      const p = Lyrics.wordProgress(w, t);
      const n = txt.length;
      if (p > 0) {
        const k = Math.min(n, p * n);
        const i = Math.min(n - 1, Math.floor(k));
        const gl = this.tapeLay.glyphs[start + i]!;
        x = g.x0 + (gl.x + gl.w * (k - i)) * g.sx;
      }
      gi = start + n;
    }
    return { x, y: (band.top + band.bot) / 2 };
  }

  /** The label taped round the dish wall: the hook's repeat pressed onto it, a word per press. */
  private drawTape(c: CanvasRenderingContext2D, t: number, cam: Cam, lid: number, D: number) {
    const T = this.T;
    const vis = prog(t, T.d0 - 0.3, T.d0 + 0.1);
    if (vis <= 0) return;
    const band = this.tapeBand(cam, lid, D);
    if (band.bot < -50 || band.top > H + 50) return;
    const g = this.tapeGeom(band);
    c.save();
    c.globalAlpha = vis;
    if (g.h < 2.2) {
      // squeezed into one line
      const y = (band.top + band.bot) / 2;
      c.fillStyle = rgba('bone', 0.85);
      c.fillRect(0, y - 0.9, W, 1.8);
      c.fillStyle = rgba('signal', 0.6);
      c.fillRect(W * 0.2, y - 0.5, W * 0.6, 1);
      c.restore();
      return;
    }
    // the tape: grey paper in the dim light, ruled edges
    c.fillStyle = rgba('ink', 1);
    c.fillRect(0, band.top, W, g.h);
    c.fillStyle = rgba('bone', 0.4);
    c.fillRect(0, band.top, W, g.h);
    c.fillStyle = rgba('bone', 0.55);
    c.fillRect(0, band.top, W, 1.2); c.fillRect(0, band.bot - 1.2, W, 1.2);
    // the fine print, while there is room for it
    if (g.h > 110) {
      const fs = clamp(g.h * 0.042, 11, 21);
      c.font = font(F.mono(500), fs);
      c.fillStyle = rgba('ink', 0.82);
      c.letterSpacing = `${fs * 0.12}px`;
      const yT = band.top + fs * 1.5, yB = band.bot - fs * 0.8;
      c.fillText('DO NOT OPEN · strain: unknown · host: consenting', g.x0, yT);
      c.textAlign = 'right';
      c.fillText('PLATE 13', W - g.x0, yT);
      c.fillText('INCUBATE INVERTED · 37 °C', W - g.x0, yB);
      c.textAlign = 'left';
      c.fillText('90 mm · agar', g.x0, yB);
      c.letterSpacing = '0px';
    }
    // the hook: pressed as sung (unsung: a faint impression; the word being pressed: blue; pressed: ink)
    c.save();
    c.translate(g.x0, g.base);
    c.scale(g.sx, g.sy);
    c.font = font(this.tapeFam, 200);
    let gi = 0;
    for (const w of T.hA) {
      const txt = w.w.toUpperCase().replace(/[,.?!]$/, '');
      const start = this.tapeText.indexOf(txt, gi);
      const p = Lyrics.wordProgress(w, t);
      for (let i = 0; i < txt.length; i++) {
        const gl = this.tapeLay.glyphs[start + i]!;
        const k = clamp(p * txt.length - i);
        c.fillStyle = k <= 0 ? rgba('ink', 0.16) : p < 1 ? rgba('signal', 1) : rgba('ink', 0.9);
        c.fillText(gl.ch, gl.x, 0);
      }
      gi = start + txt.length;
    }
    c.restore();
    c.restore();
  }

  // ------------------------------------------------------------------ the reveal
  private plateCam(t: number): PlateCam {
    const T = this.T;
    const Zm = 11.5, Z1 = 0.97;
    const u = prog(t, T.tCut + 0.08, T.tLand, ease.inOutCubic);
    // the pull-back: the hero stays under the lens, then settles where the plate puts it
    const fin: PlateCam = { x: 960, y: 540, z: Z1, r: 0 };
    const hf = CellPlate.toScreen(fin, HERO.cx, HERO.cy);
    let z = Math.exp(lerp(Math.log(Zm), Math.log(Z1), u));
    let r = lerp(HERO.a, 0, u);
    let sx = lerp(W / 2, hf.x, u), sy = lerp(H / 2, hf.y, u);
    // after the landing: a slow push along the organelle
    const kp = prog(t, T.tLand, T.tInh, ease.inOutQuad);
    z *= 1 + 0.06 * kp;
    sx = lerp(sx, W / 2, 0.12 * kp); sy = lerp(sy, H / 2, 0.12 * kp);
    // the inhale: an accelerating push into the dot, landing it on the pin
    const ki = prog(t, T.tInh, T.e0, ease.inCubic);
    const land = prog(t, T.tInh, T.e0 - 0.03, ease.inOutCubic);
    z *= 1 + 0.45 * ki;
    sx = lerp(sx, HANDOFF.pin.x, land); sy = lerp(sy, HANDOFF.pin.y, land);
    // camera centre from the hero's screen position
    const c = Math.cos(r), s = Math.sin(r);
    const dx = (sx - W / 2) / z, dy = (sy - H / 2) / z;
    return { x: HERO.cx - (dx * c - dy * s), y: HERO.cy - (dx * s + dy * c), z, r };
  }

  private renderCell(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = this.T, t = f.t;
    const { renderer } = this.ctx;
    this.ground.u.k!.value = 1;
    this.ground.render(renderer, out);
    const cam = this.plateCam(t);
    const L = this.L; L.clear();
    const c = L.ctx;
    const fade = 1 - smoothstep(T.tInh + 0.02, T.e0 - 0.06, t);
    const lastB = T.hB[T.hB.length - 1];
    const lead = prog(t, T.tLand - 0.12, (lastB?.end ?? T.tInh) - 0.02);
    this.plate.draw(c, t, cam, {
      a: fade, hero: fade, glow: lerp(1, 0.85, prog(t, T.tCut, T.tLand)) * fade,
      lead,
      label: lastB ? prog(t, lastB.start - 0.04, lastB.start + 0.25) : 0,
      spec: lastB ? prog(t, lastB.start + 0.12, lastB.start + 0.45) : 0,
      words: T.hB,
      dot: 1,
      dotScale: lerp(lerp(1.3, 0.85, prog(t, T.tCut, T.tLand, ease.outCubic)), 0.55, prog(t, T.tInh, T.e0 - 1 / 60, ease.inOutCubic)),
      // the organelle's double membrane fades into the dot's faint double ring
      ring: 0.35 * prog(t, T.tInh, T.e0 - 0.05),
    });
    this.ui.u.tex!.value = L.upload();
    this.ui.u.hot!.value = lerp(0.9, 0.45, prog(t, T.tInh, T.e0));
    this.ui.render(renderer, out);
    // the pull-back is the hit: a breath of exposure as it lands
    const land = pulse(t, T.tLand, 0.12);
    const kEnd = prog(t, T.tInh, T.e0 - 0.03);
    return {
      bloom: lerp(0.7 + 0.15 * land, 0.7, kEnd), bloomThreshold: 1.0, bloomKnee: lerp(0.3, 0.25, kEnd), bloomRadius: 0.7,
      halation: 0.2, ca: lerp(0.8, 1.0, kEnd), vignette: lerp(0.4, 0.45, kEnd), grain: lerp(0.06, 0.055, kEnd),
      exposure: 1 + 0.06 * land, hud: 0,
      shake: [0, 0],
    };
  }
}
