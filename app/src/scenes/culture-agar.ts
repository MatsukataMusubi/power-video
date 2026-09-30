// world4 (culture.ts), part 1: the petri dish. World units are millimetres, z up, the agar at z = 0,
// the dish centred on the origin (a 90 mm plate). Three things live here:
//  - the colony split tree: the founder colony divides on 8ths (1 -> 64), P(doom)'s paperclip split
//    tree with colonies (each split duplicates a group and slides the copy to its half's centroid);
//  - the lettering textures: the lyric grown on the agar as colonies (agar art). R = letter mask
//    (blurred, read as a distance field), G = when the growth front reaches that pixel (0..1 over the
//    texture's time range), B = clearance (no colony may sit on or next to a letter);
//  - the ray-cast shader: colonies as engraved domes on a hashed lattice (plus the 64 CPU colonies
//    of the split tree), the agar, the dish's rim and wall, the lid coming down, the lamp (the dot).
import * as THREE from 'three';
import { SS_TAP_GLSL } from '../engine/gl';
import type { Word } from '../engine/lyrics';
import { F, font, layout } from '../engine/type';
import { hash, lerp, type V2 } from '../engine/util';

export const AG = {
  /** lattice cell (colony spacing) */
  CELL: 2.2,
  /** agar radius (inside the wall), outer wall radius, wall top, table under the dish */
  RD: 43, RO: 44.2, WTOP: 11, TZ: -3,
  /** the founder colony: where the dot lands (the frame centre at the plate's first frame) */
  C0: { x: 0.37, y: -15.3 } as V2,
  LEVELS: 6,
};
export const N_ITEMS = 1 << AG.LEVELS;

// ------------------------------------------------------------------ the split tree
export interface Tree {
  /** centroid of group g at level L (L = 0..LEVELS, g < 2^L) */
  cent: V2[][];
  /** each item's final position (its cell's centre plus a jitter) and radius */
  fin: V2[];
  rad: number[];
  /** cells within rcut of C0 belong to the tree; the shader's lattice skips them */
  rcut: number;
}

export function splitTree(): Tree {
  const { CELL, C0, LEVELS } = AG;
  const n = N_ITEMS;
  const cand: { x: number; y: number; d: number }[] = [];
  const R = Math.ceil(Math.sqrt(n)) + 4;
  const ci = Math.floor(C0.x / CELL), cj = Math.floor(C0.y / CELL);
  for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
    const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL;
    cand.push({ x, y, d: Math.hypot(x - C0.x, y - C0.y) });
  }
  cand.sort((a, b) => a.d - b.d);
  const cells = cand.slice(0, n);
  const rcut = (cand[n - 1]!.d + cand[n]!.d) / 2;
  const groups: { x: number; y: number }[][][] = [[cells]];
  for (let L = 0; L < LEVELS; L++) {
    const next: { x: number; y: number }[][] = new Array(1 << (L + 1));
    for (let g = 0; g < 1 << L; g++) {
      const cs = groups[L]![g]!;
      const xs = cs.map((c) => c.x), ys = cs.map((c) => c.y);
      const ex = Math.max(...xs) - Math.min(...xs), ey = Math.max(...ys) - Math.min(...ys);
      const ax = ex > ey + 0.01 || (Math.abs(ex - ey) <= 0.01 && hash(L, g, 3) < 0.5) ? 'x' : 'y';
      const s = [...cs].sort((a, b) => (ax === 'x' ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x));
      const h = s.length / 2;
      const flip = hash(L, g, 11) < 0.5;
      next[g] = flip ? s.slice(h) : s.slice(0, h);
      next[g + (1 << L)] = flip ? s.slice(0, h) : s.slice(h);
    }
    groups.push(next);
  }
  const mean = (cs: { x: number; y: number }[]) => ({ x: cs.reduce((a, c) => a + c.x, 0) / cs.length, y: cs.reduce((a, c) => a + c.y, 0) / cs.length });
  const cent = groups.map((lv, L) => lv.map((cs, g) => {
    const m = mean(cs);
    if (L === 0 || L === LEVELS) return m;
    const j = CELL * 0.3 * Math.sqrt(cs.length) * 0.35;
    return { x: m.x + (hash(L, g, 21) - 0.5) * j, y: m.y + (hash(L, g, 22) - 0.5) * j };
  }));
  const fin: V2[] = [], rad: number[] = [];
  for (let k = 0; k < n; k++) {
    const c = cent[LEVELS]![k]!;
    const r = lerp(0.42, 0.95, hash(k, 5) ** 1.5);
    const jm = Math.max(0, CELL / 2 - r - 0.08);
    fin.push({ x: c.x + (hash(k, 6) - 0.5) * 2 * jm, y: c.y + (hash(k, 7) - 0.5) * 2 * jm });
    rad.push(r);
  }
  return { cent, fin, rad, rcut };
}

/** Radius a colony keeps while its group is still large (level L = splits done). */
const LEVEL_R = [1.35, 1.28, 1.18, 1.08, 0.98, 0.9, 0.9];

/**
 * The tree's colonies at time t: (x, y, a, h) and (heat, -, -, -). `e[l]` = progress of split l (0..1),
 * `born[l]` = the time split l starts, `inflate` = the founder's inflation (0..1, may overshoot).
 */
export function treeItems(T: Tree, e: number[], born: number[], t: number, inflate: number, seedHeat: number, out: Float32Array, outH: Float32Array) {
  const n = N_ITEMS;
  for (let k = 0; k < n; k++) {
    const hb = k === 0 ? -1 : 31 - Math.clz32(k); // split at which item k is born
    if (hb >= 0 && t < born[hb]!) { out[k * 4 + 2] = 0; continue; }
    let x = T.cent[0]![0]!.x, y = T.cent[0]![0]!.y;
    let lv = 0; // continuous level
    for (let l = 0; l < AG.LEVELS; l++) {
      const a = T.cent[l]![k % (1 << l)]!, b = l + 1 === AG.LEVELS ? T.fin[k]! : T.cent[l + 1]![k % (1 << (l + 1))]!;
      x += (b.x - a.x) * e[l]!; y += (b.y - a.y) * e[l]!;
      lv += e[l]!;
    }
    const li = Math.min(AG.LEVELS - 1, Math.floor(lv));
    let r = lerp(LEVEL_R[li]!, LEVEL_R[li + 1]!, lv - li);
    if (lv >= AG.LEVELS - 1) r = lerp(r, T.rad[k]!, Math.min(1, lv - (AG.LEVELS - 1)));
    // binary fission: while two daughters separate they are pinched, then round out
    let heat = 0;
    for (let l = 0; l < AG.LEVELS; l++) {
      if (e[l]! > 0 && e[l]! < 1) r *= 0.78 + 0.22 * e[l]!;
      if (l === hb && t >= born[l]!) heat = Math.max(heat, Math.max(0, Math.exp(-(t - born[l]!) / 0.06) - 0.05) / 0.95);
    }
    if (k === 0) { r *= inflate; heat = Math.max(heat, seedHeat); }
    const h = r * (0.36 + 0.12 * hash(k, 9));
    out.set([x, y, r, h], k * 4);
    outH[k * 4] = heat;
  }
}

// ------------------------------------------------------------------ lettering
export interface Lettering {
  tex: THREE.CanvasTexture;
  /** world rect x0, y0, x1, y1 */
  rect: [number, number, number, number];
  /** time range of the G channel */
  tr: [number, number];
  /** blur radius, world mm (the distance-field edge width) */
  blur: number;
  /** the growth front at time t (world), for the cursor */
  front(t: number): { x: number; y: number; on: boolean };
}

interface GlyphT { t0: number; t1: number }
/** Per-character growth times of a word: the front crosses glyph j of n during its share of the word. */
function charTimes(w: Word): GlyphT[] {
  const ch = Array.from(w.w);
  const d = Math.max(0.06, w.end - w.start);
  return ch.map((_, j) => ({ t0: w.start + (j / ch.length) * d, t1: w.start + ((j + 1) / ch.length) * d }));
}

function makeCanvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  return { cv, c };
}

function finish(cv: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Draw glyphs (already positioned by `place`) into a lettering texture: R/G fill (the G ramp runs
 * across each glyph with its growth time), blurred into a distance field; B = the dilated clearance.
 */
function paint(
  cw: number, ch: number, blurPx: number, clearPx: number,
  glyphs: { ch: string; fam: string; size: number; w: number; g0: number; g1: number; xf: DOMMatrix2DInit }[],
) {
  const A = makeCanvas(cw, ch);
  for (const g of glyphs) {
    const c = A.c;
    c.save();
    c.setTransform(g.xf);
    c.font = font(g.fam, g.size);
    c.textBaseline = 'alphabetic';
    const gr = c.createLinearGradient(0, 0, Math.max(1, g.w), 0);
    gr.addColorStop(0, `rgb(255,${Math.round(g.g0 * 255)},0)`);
    gr.addColorStop(1, `rgb(255,${Math.round(g.g1 * 255)},0)`);
    c.fillStyle = gr;
    c.fillText(g.ch, 0, 0);
    c.restore();
  }
  const B = makeCanvas(cw, ch);
  B.c.filter = `blur(${blurPx}px)`;
  B.c.drawImage(A.cv, 0, 0);
  B.c.filter = 'none';
  // clearance (B channel), added on top
  B.c.globalCompositeOperation = 'lighter';
  B.c.filter = `blur(${Math.round(clearPx * 0.5)}px)`;
  for (const g of glyphs) {
    const c = B.c;
    c.save();
    c.setTransform(g.xf);
    c.font = font(g.fam, g.size);
    c.fillStyle = 'rgb(0,0,255)'; c.strokeStyle = 'rgb(0,0,255)';
    c.lineWidth = clearPx * 2; c.lineJoin = 'round';
    c.fillText(g.ch, 0, 0); c.strokeText(g.ch, 0, 0);
    c.restore();
  }
  B.c.filter = 'none';
  B.c.globalCompositeOperation = 'source-over';
  return B.cv;
}

/**
 * The first half-line on an arc over the founder colony (a specimen's legend), reading clockwise over
 * the top; the growth front sweeps it glyph by glyph as it is sung.
 */
export function arcLettering(renderer: THREE.WebGLRenderer, words: Word[], c0: V2, rBase: number, cap: number): Lettering {
  const half = rBase + cap * 2.2;
  const rect: [number, number, number, number] = [c0.x - half, c0.y - half, c0.x + half, c0.y + half];
  const px = 2048, S = px / (2 * half);
  const fam = F.archivo(100, 900);
  const size = (cap / 0.686) * S;
  const text = words.map((w) => w.w.toUpperCase()).join(' ');
  const lay = layout(text, fam, size, size * 0.05);
  // times per char (spaces take the time of the gap)
  const times: GlyphT[] = [];
  words.forEach((w, i) => { if (i) times.push({ t0: words[i - 1]!.end, t1: w.start }); times.push(...charTimes(w)); });
  const tr: [number, number] = [words[0]!.start - 0.05, words[words.length - 1]!.end + 0.05];
  const code = (t: number) => (t - tr[0]) / (tr[1] - tr[0]);
  const R = rBase * S;
  // the span is capped at 150 degrees: past that the glyphs shrink to fit
  const span0 = lay.width / R, span = Math.min(span0, (150 * Math.PI) / 180);
  const k = span / span0;
  const cx = (c0.x - rect[0]) * S, cy = (rect[3] - c0.y) * S;
  const glyphs = lay.glyphs.map((g, i) => {
    const s = (g.x + g.w / 2) * k;
    const a = -Math.PI / 2 - span / 2 + s / R;
    const m = new DOMMatrix().translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R).rotate(((a + Math.PI / 2) * 180) / Math.PI).scale(k).translate(-g.w / 2, 0);
    const tt = times[i] ?? times[times.length - 1]!;
    return { ch: g.ch, fam, size, w: g.w, g0: code(tt.t0), g1: code(tt.t1), xf: m, a, tt };
  });
  const cv = paint(px, px, Math.max(2, Math.round(0.07 * S)), Math.round(0.55 * S), glyphs.filter((g) => g.ch !== ' '));
  const front = (t: number) => {
    let a = glyphs[0]!.a - 0.02;
    for (const g of glyphs) if (t >= g.tt.t0) a = g.a + ((g.w * k) / R) * (Math.min(1, (t - g.tt.t0) / Math.max(1e-3, g.tt.t1 - g.tt.t0)) - 0.5);
    const rr = rBase + cap * 0.5;
    return { x: c0.x + Math.cos(a) * rr, y: c0.y - Math.sin(a) * rr, on: t >= tr[0] && t <= tr[1] };
  };
  return { tex: finish(cv, renderer), rect, tr, blur: 0.07, front };
}

/**
 * The second half-line as road markings: one word per row, stacked along +y (the glide's direction),
 * each letter stretched along y so it reads from the low camera.
 */
export function roadLettering(renderer: THREE.WebGLRenderer, words: Word[], xMid: number, y0: number, y1: number, capY: number, stretch: number): Lettering & { rows: { y: number; x0: number; x1: number }[] } {
  const n = words.length;
  const pitch = Math.min(capY * 1.45, (y1 - y0) / Math.max(1, n));
  const cy = Math.min(capY, pitch / 1.3);
  const fam = F.archivo(100, 900);
  const capX = cy / stretch;
  const em = capX / 0.686;
  // measure the widest word to size the rect
  const lays = words.map((w) => layout(w.w.toUpperCase().replace(/[,.?!]/g, ''), fam, 100, 4));
  const wMax = Math.max(...lays.map((l) => l.width)) * (em / 100);
  const pad = 2;
  const rect: [number, number, number, number] = [xMid - wMax / 2 - pad, y0 - pad, xMid + wMax / 2 + pad, y0 + pitch * n + pad];
  const S = 1536 / (rect[2] - rect[0]);
  const ch = Math.min(4096, Math.ceil((rect[3] - rect[1]) * S));
  const Sy = ch / (rect[3] - rect[1]);
  const tr: [number, number] = [words[0]!.start - 0.05, words[n - 1]!.end + 0.05];
  const code = (t: number) => (t - tr[0]) / (tr[1] - tr[0]);
  const rows: { y: number; x0: number; x1: number }[] = [];
  const glyphs: { ch: string; fam: string; size: number; w: number; g0: number; g1: number; xf: DOMMatrix2DInit }[] = [];
  const size = em * S;
  const rowG: { x0: number; x1: number; tt: GlyphT }[][] = [];
  words.forEach((w, r) => {
    const txt = w.w.toUpperCase().replace(/[,.?!]/g, '');
    const lay = layout(txt, fam, size, size * 0.04);
    const base = y0 + r * pitch; // world y of the baseline
    const X0 = (xMid - rect[0]) * S - lay.width / 2, Y = (rect[3] - base) * Sy;
    const ts = charTimes({ ...w, w: txt } as Word);
    rowG.push([]);
    lay.glyphs.forEach((g, i) => {
      const tt = ts[i] ?? ts[ts.length - 1]!;
      const m = new DOMMatrix().translate(X0 + g.x, Y).scale(1, (stretch * Sy) / S);
      glyphs.push({ ch: g.ch, fam, size, w: g.w, g0: code(tt.t0), g1: code(tt.t1), xf: m });
      rowG[r]!.push({ x0: rect[0] + (X0 + g.x) / S, x1: rect[0] + (X0 + g.x + g.w) / S, tt });
    });
    rows.push({ y: base + cy / 2, x0: rect[0] + X0 / S, x1: rect[0] + (X0 + lay.width) / S });
  });
  const cv = paint(1536, ch, Math.max(2, Math.round(0.08 * S)), Math.round(0.9 * S), glyphs);
  const front = (t: number) => {
    let x = rows[0]!.x0, y = rows[0]!.y;
    rowG.forEach((gs, r) => {
      for (const g of gs) if (t >= g.tt.t0) { x = lerp(g.x0, g.x1, Math.min(1, (t - g.tt.t0) / Math.max(1e-3, g.tt.t1 - g.tt.t0))); y = rows[r]!.y; }
    });
    return { x, y, on: t >= tr[0] && t <= tr[1] };
  };
  return { tex: finish(cv, renderer), rect, tr, blur: 0.08, front, rows };
}

// ------------------------------------------------------------------ the shader
export const FRAG_AGAR = /* glsl */ `
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float focal; uniform vec2 res; uniform float time;
uniform vec4 items[${N_ITEMS}]; uniform vec4 itemH[${N_ITEMS}]; uniform vec4 clusB; uniform vec3 clus;
uniform float fillT, fillRate, revealR, lidZ, keyI, fogK, slitK, slitH, horizonY, lampI, topK, dim;
uniform vec3 lampPos, keyDir;
uniform sampler2D texA; uniform vec4 rectA; uniform vec3 timeA;
uniform sampler2D texB; uniform vec4 rectB; uniform vec3 timeB;

const float CW = ${AG.CELL.toFixed(3)};
const float RD = ${AG.RD.toFixed(2)}, RO = ${AG.RO.toFixed(2)}, WTOP = ${AG.WTOP.toFixed(2)}, TZ = ${AG.TZ.toFixed(2)}, HMAX = 1.1;

float hatchW(float u, float darkness, float fw) {
  float f = abs(fract(u) - 0.5);
  float hw = 0.5 * clamp(darkness, 0.0, 1.0);
  float aa = max(fw, 1e-3);
  float l = 1.0 - smoothstep(hw - aa, hw + aa, 0.5 - f);
  return mix(l, clamp(darkness, 0.0, 1.0), smoothstep(0.3, 0.75, fw));
}
float capH(float h) { return clamp(min(h, lidZ - 0.06), 0.004, 10.0); }
/** A colony: a spherical cap of base radius a and height h on the agar. */
float capHit(vec3 ro, vec3 rd, vec2 cc, float a, float h) {
  if (a < 0.02) return -1.0;
  float hh = capH(h);
  float Rs = (a * a + hh * hh) / (2.0 * hh);
  vec3 oc = ro - vec3(cc, hh - Rs);
  float b = dot(oc, rd);
  float c = dot(oc, oc) - Rs * Rs;
  float disc = b * b - c;
  if (disc < 0.0) return -1.0;
  float t = -b - sqrt(disc);
  if (t < 0.0 || ro.z + rd.z * t < -1e-4) return -1.0;
  return t;
}
vec3 capN(vec3 P, vec2 cc, float a, float h) {
  float hh = capH(h);
  float Rs = (a * a + hh * hh) / (2.0 * hh);
  return normalize(P - vec3(cc, hh - Rs));
}
bool inRect(vec2 p, vec4 r) { return p.x > r.x && p.y > r.y && p.x < r.z && p.y < r.w; }
vec2 rectUV(vec2 p, vec4 r) { return (p - r.xy) / (r.zw - r.xy); }
float clearAt(vec2 p) {
  float c = 0.0;
  if (inRect(p, rectA)) c = max(c, textureLod(texA, rectUV(p, rectA), 0.0).b);
  if (inRect(p, rectB)) c = max(c, textureLod(texB, rectUV(p, rectB), 0.0).b);
  return c;
}
/** The lattice colony of a cell (the flood), if any. */
bool latticeColony(vec2 cell, out vec2 cc, out float a, out float h, out float hot) {
  cc = vec2(0.0); a = 0.0; h = 0.0; hot = 0.0;
  if (fillT < 0.0) return false;
  vec2 ctr = (cell + 0.5) * CW;
  float dc = length(ctr - clus.xy);
  if (dc <= clus.z || length(ctr) > RD - 1.3) return false;
  vec3 hh = hash33(vec3(cell, 7.0));
  if (hh.x < 0.15) return false;
  float t0 = (dc - clus.z) * fillRate + hh.z * 0.07;
  float k = clamp((fillT - t0) / 0.24, 0.0, 1.0);
  if (k <= 0.0) return false;
  float g = 1.0 - pow(1.0 - k, 3.0);
  float a0 = mix(0.26, 0.9, hh.y * hh.y);
  vec2 j = hash22(cell + 3.1) - 0.5;
  cc = ctr + j * max(CW - 2.0 * a0 - 0.12, 0.0);
  a = a0 * g;
  h = a0 * (0.3 + 0.18 * hash12(cell + 9.7)) * g;
  hot = pow(1.0 - k, 2.0);
  return true;
}

struct Hit { float t; vec2 cc; float a; float h; float hot; };

/** First colony along the ray inside the slab 0 <= z <= HMAX, between t0 and t1. */
Hit colonies(vec3 ro, vec3 rd, float t0, float t1) {
  Hit best; best.t = 1e9; best.cc = vec2(0.0); best.a = 0.0; best.h = 0.0; best.hot = 0.0;
  if (t0 >= t1) return best;
  // the split tree (CPU colonies): only when the ray passes their bounding circle
  vec2 pa = ro.xy + rd.xy * t0, pb = ro.xy + rd.xy * t1;
  vec2 ab = pb - pa;
  float u = clamp(dot(clusB.xy - pa, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
  if (length(pa + ab * u - clusB.xy) < clusB.z) {
    for (int i = 0; i < ${N_ITEMS}; i++) {
      vec4 it = items[i];
      if (it.z < 0.02) continue;
      float t = capHit(ro, rd, it.xy, it.z, it.w);
      if (t > 0.0 && t < best.t) { best.t = t; best.cc = it.xy; best.a = it.z; best.h = it.w; best.hot = itemH[i].x; }
    }
  }
  if (fillT < 0.0) return best;
  // the lattice: walk the cells the ray crosses (colonies stay inside their cells)
  vec3 p0 = ro + rd * t0;
  vec2 cell = floor(p0.xy / CW);
  vec2 d = vec2(abs(rd.x) < 1e-6 ? 1e-6 : rd.x, abs(rd.y) < 1e-6 ? 1e-6 : rd.y);
  vec2 st = sign(d);
  vec2 tDel = abs(CW / d);
  vec2 tMax = ((cell + max(st, 0.0)) * CW - p0.xy) / d;
  float tc = 0.0;
  for (int i = 0; i < 44; i++) {
    vec2 cc; float a, h, hot;
    if (latticeColony(cell, cc, a, h, hot)) {
      float t = capHit(ro, rd, cc, a, h);
      if (t > 0.0 && t < best.t && clearAt(cc) < 0.08) { best.t = t; best.cc = cc; best.a = a; best.h = h; best.hot = hot; }
    }
    if (best.t < t0 + tc + 1e-3) break;
    if (tMax.x < tMax.y) { tc = tMax.x; tMax.x += tDel.x; cell.x += st.x; }
    else { tc = tMax.y; tMax.y += tDel.y; cell.y += st.y; }
    if (t0 + tc > t1 || t0 + tc > best.t) break;
  }
  return best;
}

/** The lamp: the dot's blue light, falling off with distance. */
vec3 lampAt(vec3 P, vec3 N) {
  vec3 L = lampPos - P; float d2 = dot(L, L); L *= inversesqrt(max(d2, 1e-6));
  float fall = lampI * 1.2 / (d2 * d2 * 0.6 + 1.2);
  return C_SIGNAL * max(dot(N, L), 0.0) * fall;
}

vec3 shadeColony(vec3 P, vec3 rd, Hit hc, float t) {
  vec3 N = capN(P, hc.cc, hc.a, hc.h);
  vec3 V = -rd;
  float dif = max(dot(N, keyDir), 0.0);
  float tone = keyI * (0.08 + 0.92 * pow(dif, 1.6));
  float rr = length(P.xy - hc.cc) / max(hc.a, 1e-3);
  float nR = 4.0;
  float ringPx = (hc.a / nR) * focal / t * max(abs(dot(N, V)), 0.2);
  float fw = 1.0 / max(ringPx, 0.4);
  // white-line engraving: growth rings, a little thicker where lit, never merging
  float cov = hatchW(rr * nR + 0.5, 0.08 + 0.3 * tone, fw);
  vec3 col = C_BONE * (0.12 + 0.3 * tone) + C_BONE * 0.3 * cov * (0.35 + 0.65 * tone);
  // the colony's edge (a firm outline), and a small highlight at the crown
  float edgePx = (1.0 - rr) * hc.a * focal / t;
  col += C_BONE * 0.5 * (1.0 - smoothstep(0.5, 1.6, edgePx));
  vec3 Hh = normalize(keyDir + V);
  col += C_BONE * 0.35 * smoothstep(0.7, 0.9, pow(max(dot(N, Hh), 0.0), 60.0)) * keyI;
  col += lampAt(P, N) * 1.6;
  // newborn colonies flash blue
  col = mix(col, C_SIGNAL * (1.0 + 1.6 * hc.hot) + C_EMBER * 0.6 * hc.hot * hc.hot, clamp(hc.hot, 0.0, 1.0) * 0.85);
  return col;
}

/** Lettering on the agar: (colour, coverage). */
vec4 lettering(sampler2D tex, vec4 rect, vec3 tr, vec2 p, float foot) {
  if (!inRect(p, rect)) return vec4(0.0);
  vec2 uv = rectUV(p, rect);
  float texel = (rect.z - rect.x) / float(textureSize(tex, 0).x);
  float lod = clamp(log2(max(foot / texel, 1e-3)), 0.0, 8.0);
  vec4 s = textureLod(tex, uv, lod);
  float m = s.r;
  if (m < 0.02) return vec4(0.0);
  float tg = mix(tr.x, tr.y, s.g / max(m, 1e-3));
  float n = snoise(p * 9.0) * 0.06 + snoise(p * 23.0) * 0.03;
  float w = clamp(0.5 * foot / tr.z, 0.03, 0.45);
  float fill = smoothstep(0.5 - w, 0.5 + w, m + n);
  float edge = 1.0 - smoothstep(0.0, w * 1.6 + 0.05, abs(m + n - 0.5));
  float g = smoothstep(tg - 0.02, tg + 0.16, time);
  // the bump of the grown lawn: brighter on the edge facing the light
  float e2 = tr.z * 0.8;
  float mx = textureLod(tex, rectUV(p + vec2(e2, 0.0), rect), lod).r - m;
  float my = textureLod(tex, rectUV(p + vec2(0.0, e2), rect), lod).r - m;
  vec3 N = normalize(vec3(-mx * 2.5 * g, -my * 2.5 * g, 1.0));
  float dif = max(dot(N, keyDir), 0.0);
  // grown: confluent colony lawn with a fine stipple of micro-colonies
  vec2 q = p / 0.16;
  vec2 f = fract(q) - 0.5;
  vec2 o = hash22(floor(q)) - 0.5;
  float dots = 1.0 - smoothstep(0.18, 0.34, length(f - o * 0.4));
  vec3 lawn = C_BONE * (0.2 + 0.24 * dif * keyI + 0.1 * dots) + C_BONE * 0.22 * edge;
  lawn += lampAt(vec3(p, 0.05), N) * 1.2;
  // not yet grown: the inoculation streak, a faint outline, only just before it grows (a guide)
  float gv = smoothstep(tg - 0.9, tg - 0.3, time);
  vec3 guide = C_BONE * 0.06 * edge;
  vec3 col = mix(guide, lawn, g);
  float cov = mix(edge * 0.8 * gv, fill, g);
  // the growth front: blue where the colony is growing right now
  float fr = exp(-max(time - tg, 0.0) / 0.1) * step(tg - 0.02, time);
  col = mix(col, C_SIGNAL * (1.1 + 1.4 * fr) + C_EMBER * 0.5 * fr * fr, fr * fill * 0.85);
  return vec4(col, cov);
}

vec3 shadeAgar(vec3 P, vec3 rd, float t) {
  vec3 N = vec3(0.0, 0.0, 1.0);
  float foot = t / focal / sqrt(max(abs(rd.z), 0.03));
  // engraving convention for a flat, wet surface: fine horizontal lines
  float fw = foot / 0.32;
  float lines = hatchW(P.y / 0.32 + 0.5, 0.14, fw);
  vec3 col = C_BONE * (0.014 + 0.022 * lines * keyI);
  // meniscus at the wall
  float r = length(P.xy);
  col += C_BONE * 0.4 * (1.0 - smoothstep(0.0, max(foot * 1.5, 0.05), abs(r - (RD - 0.35))));
  col += C_BONE * 0.05 * smoothstep(RD - 3.0, RD - 0.3, r);
  // the lamp: a pool, and its reflection in the wet agar
  vec3 L = lampPos - P; float d2 = dot(L, L);
  col += C_SIGNAL * lampI * 0.3 * exp(-d2 / 2.5);
  vec3 Rf = reflect(rd, N);
  float sp = pow(max(dot(Rf, normalize(L)), 0.0), 900.0) * lampI * (1.0 - topK) * exp(-d2 / 60.0);
  col += C_EMBER * sp * 0.45;
  // colony cast shadows (hatched), from the key light: nearby lattice cells
  // lettering
  vec4 la = lettering(texA, rectA, timeA, P.xy, foot);
  col = mix(col, la.rgb, la.a);
  vec4 lb = lettering(texB, rectB, timeB, P.xy, foot);
  col = mix(col, lb.rgb, lb.a);
  return col;
}

vec3 shadeLid(vec3 P, vec3 rd, float t) {
  float foot = t / focal / sqrt(max(abs(rd.z), 0.03));
  float lines = hatchW(P.y / 0.5 + 0.5, 0.1, foot / 0.5);
  vec3 col = C_INK2 * 0.45 + C_BONE * 0.01 * lines;
  // condensation on the underside
  vec2 q = P.xy / 0.3;
  vec2 f = fract(q) - 0.5;
  vec2 o = hash22(floor(q)) - 0.5;
  float r = 0.08 + 0.12 * hash12(floor(q) + 4.0);
  float drop = (1.0 - smoothstep(r - foot / 0.3, r + foot / 0.3, length(f - o * 0.5))) * step(0.8, hash12(floor(q) + 9.0));
  col += C_BONE * 0.014 * drop;
  vec3 L = lampPos - P; float d2 = dot(L, L);
  col += C_SIGNAL * lampI * 0.05 * exp(-d2 / 3.0);
  return col;
}

vec3 shadeWall(vec3 P, vec3 rd, float t) {
  float foot = t / focal;
  float a = atan(P.y, P.x) * RD;
  float lines = hatchW(a / 0.9 + 0.5, 0.06, foot / 0.9);
  vec3 col = C_INK2 * 0.4 + C_BONE * 0.01 * lines;
  col += C_BONE * 0.35 * (1.0 - smoothstep(0.0, foot * 1.5 + 0.02, abs(P.z - 0.02)));
  col += C_BONE * 0.25 * (1.0 - smoothstep(0.0, foot * 1.5 + 0.02, abs(P.z - min(WTOP, lidZ))));
  vec3 L = lampPos - P; float d2 = dot(L, L);
  col += C_SIGNAL * lampI * 0.06 * exp(-d2 / 2.0);
  return col;
}

vec3 trace(vec3 ro, vec3 rd) {
  bool inside = length(ro.xy) < RD && ro.z < WTOP;
  float tp = rd.z < -1e-6 ? -ro.z / rd.z : 1e9;
  float tW = 1e9;
  if (inside) {
    vec2 o = ro.xy, d = rd.xy;
    float A = dot(d, d), B = dot(o, d), C = dot(o, o) - RD * RD;
    if (A > 1e-10) tW = (-B + sqrt(max(B * B - A * C, 0.0))) / A;
  }
  float tl = (lidZ < 900.0 && rd.z > 1e-6 && ro.z < lidZ) ? (lidZ - ro.z) / rd.z : 1e9;
  // colonies
  float s0 = ro.z > HMAX ? (rd.z < -1e-6 ? (ro.z - HMAX) / -rd.z : 1e9) : 0.0;
  float s1 = min(min(tp, tW), min(tl, 200.0));
  Hit hc = colonies(ro, rd, s0, s1);
  vec3 col;
  float tHit;
  float dReveal = 0.0;
  if (hc.t < min(tp, min(tW, tl))) {
    tHit = hc.t;
    vec3 P = ro + rd * hc.t;
    col = shadeColony(P, rd, hc, hc.t);
    dReveal = length(P.xy - clus.xy);
  } else if (tp < min(tW, tl) && length((ro + rd * tp).xy) < RD) {
    tHit = tp;
    vec3 P = ro + rd * tp;
    // from above, the dish wall's rim hides the agar's edge
    if (!inside && rd.z < -1e-6) {
      vec3 q = ro + rd * ((ro.z - WTOP) / -rd.z);
      float rq = length(q.xy);
      if (rq > RD && rq < RO) {
        float foot = ((ro.z - WTOP) / -rd.z) / focal;
        col = C_INK2 * 0.8 + C_BONE * 0.5 * (1.0 - smoothstep(0.0, foot * 1.5, min(abs(rq - RD), abs(rq - RO))));
        return col * dim;
      }
    }
    col = shadeAgar(P, rd, tp);
    dReveal = length(P.xy - clus.xy);
  } else if (tW < tl && inside) {
    tHit = tW;
    vec3 P = ro + rd * tW;
    col = P.z < WTOP ? shadeWall(P, rd, tW) : C_INK * 0.7;
    dReveal = length(P.xy - clus.xy);
  } else if (tl < 1e8) {
    tHit = tl;
    col = shadeLid(ro + rd * tl, rd, tl);
  } else {
    // outside the dish, seen from above: the rim, then the bench with a faint millimetre grid
    tHit = 1e3;
    col = C_INK * 0.85;
    if (rd.z < -1e-6) {
      float tq = (ro.z - WTOP) / -rd.z;
      vec3 q = ro + rd * tq;
      float rq = length(q.xy);
      float foot = tq / focal;
      if (rq > RD - 0.5 && rq < RO + 0.5) {
        float e = 1.0 - smoothstep(0.0, foot * 1.5, min(abs(rq - RD), abs(rq - RO)));
        col = mix(col, C_INK2 * 0.8, step(RD, rq) * step(rq, RO)) + C_BONE * 0.5 * e;
      } else {
        float tb = (ro.z - TZ) / -rd.z;
        vec3 b = ro + rd * tb;
        float fb = tb / focal;
        vec2 g = abs(fract(b.xy / 10.0 + 0.5) - 0.5) * 10.0;
        col += C_GRAPHITE * 0.05 * (1.0 - smoothstep(0.0, fb * 1.2, min(g.x, g.y)));
        // the glass wall's foot, a soft ring
        col += C_BONE * 0.02 * exp(-abs(length(b.xy) - RO) * 1.2);
      }
      dReveal = length(q.xy - clus.xy);
    }
  }
  // the radial reveal around the landing point (before it: black)
  float rv = smoothstep(revealR, revealR - max(revealR * 0.5, 0.3), dReveal);
  col = mix(C_INK, col, rv);
  float rip = exp(-abs(dReveal - revealR) * 14.0);
  col += C_SIGNAL * 0.2 * rip * step(0.01, revealR) * (1.0 - smoothstep(8.0, 40.0, revealR));
  // depth: haze toward the far wall in the glide
  col = mix(col, C_INK * 0.9, (1.0 - exp(-tHit * fogK)));
  return col * dim;
}

void main() {
  vec2 px0 = vUv * res - 0.5 * res;
  vec3 col = vec3(0.0);
  for (int k = ssK0(); k < ssK1(); k++) {
    vec2 px = px0 + rgss(k) / PX_SCALE;
    vec3 rd = normalize(camF * focal + camR * px.x + camU * px.y);
    col += trace(camPos, rd);
  }
  col *= ssWeight();
  // the final close: everything outside the slot goes dark
  float sm = smoothstep(slitH + 24.0, slitH, abs(px0.y - horizonY));
  col *= mix(1.0, sm, slitK);
  fragColor = vec4(col, 1.0);
}`;
