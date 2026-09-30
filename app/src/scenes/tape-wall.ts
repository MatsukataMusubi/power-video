// bridgeA (tape.ts) — the library wall: an endless grid of LTO cartridge slots drawn procedurally on
// one plane per wall (slots, recessed cartridges with parallax, barcode labels with real Code 39 bars,
// frame uprights, the rating plate), plus the label GLSL shared with the one cartridge that is a real
// mesh (the one that swings out of alignment). Units: 1 = 100 mm. Wall plane z = 0, facing +z (the
// aisle); x right, y up; row r sits at y = -r·RY, column c at colX(c).
import * as THREE from 'three';
import { GLSL_COMMON } from '../engine/glsl/common';
import { SCALE } from '../engine/scale';
import { F, font } from '../engine/type';

// ------------------------------------------------------------------ geometry (100 mm units)
export const CX = 1.1; // column pitch
export const POSTW = 0.34; // frame upright between bays
export const BAYN = 5; // columns per bay
export const BAYW = BAYN * CX + POSTW;
export const RY = 0.31; // row pitch (one shelf)
export const SW = 1.04; // slot opening (HANDOFF.slot is 132 × 36 px: the same proportion)
export const SH = (SW * 36) / 132;
export const CW = 1.02, CHT = 0.215, CD = 1.054; // LTO cartridge: 102 × 21.5 × 105.4 mm
export const CY0 = -SH / 2 + 0.004 + CHT / 2; // cartridge centre in the slot (it rests on the floor)
export const DR = 0.012; // cartridge face recessed behind the wall face
export const DH = 1.08; // slot depth
export const LW = 0.78, LH = 0.165; // barcode label
export const BX0 = -0.37, BW = 0.0925, BY0 = -0.006, BY1 = 0.0755; // the 8 character boxes
export const BAR_X0 = -0.345, BAR_X1 = 0.345, BAR_Y0 = -0.0745, BAR_Y1 = -0.018; // the bars
export const AISLE = 11.5; // the opposite wall
export const colX = (c: number) => Math.floor(c / BAYN) * BAYW + (c - BAYN * Math.floor(c / BAYN)) * CX;
export const rowY = (r: number) => -r * RY;
/** Label centre (world) of slot (r, c), on the recessed cartridge face. */
export const labelAt = (r: number, c: number): [number, number, number] => [colX(c), rowY(r) + CY0, -DR];
/** Label-local x of the front of a word of n boxes at progress p (dir ±1). */
export const frontX = (n: number, p: number, dir: number) => (dir > 0 ? BX0 + p * n * BW : BX0 + (1 - p) * n * BW);

// ------------------------------------------------------------------ glyphs
export const GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ’-.&?!/ ';
export const G_SPACE = GLYPHS.indexOf(' ');
export const G_ZERO = 0;
export const glyphIndex = (ch: string) => {
  const c = ch === "'" ? '’' : ch.toUpperCase();
  const i = GLYPHS.indexOf(c);
  return i >= 0 ? i : GLYPHS.indexOf('?');
};
const GC = 8, GR = 6; // atlas grid
const GCAP = 0.62; // cap height as a fraction of the cell
export const CAP_BOX = 0.05; // character cap height in a label box (world)

/** Code 39 (1 = wide), elements bar/space alternating, 3 of 9 wide. */
const C39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001', '5': '100110000', '6': '001110000',
  '7': '000100101', '8': '100100100', '9': '001100100', A: '100001001', B: '001001001', C: '101001000', D: '000011001',
  E: '100011000', F: '001011000', G: '000001101', H: '100001100', I: '001001100', J: '000011100', K: '100000011',
  L: '001000011', M: '101000010', N: '000010011', O: '100010010', P: '001010010', Q: '000000111', R: '100000110',
  S: '001000110', T: '000010110', U: '110000001', V: '011000001', W: '111000000', X: '010010001', Y: '110010000',
  Z: '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '/': '010100010', '*': '010010100',
};
const c39For = (ch: string) => {
  const k = ch === '’' ? '-' : ch in C39 ? ch : ' ';
  return parseInt(C39[k]!, 2);
};
const C39_TABLE = Array.from(GLYPHS).map(c39For);

export function makeGlyphAtlas(): THREE.CanvasTexture {
  const GS = 160 * SCALE;
  const cv = document.createElement('canvas');
  cv.width = GC * GS; cv.height = GR * GS;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const fam = F.mono(700);
  const fs = (GCAP * GS) / 0.698; // Plex Mono cap height 0.698 em
  c.font = font(fam, fs);
  c.fillStyle = '#fff';
  c.textBaseline = 'alphabetic';
  Array.from(GLYPHS).forEach((ch, i) => {
    if (ch === ' ') return;
    const x = (i % GC) * GS, y = Math.floor(i / GC) * GS;
    const w = c.measureText(ch).width;
    c.fillText(ch, x + (GS - w) / 2, y + GS / 2 + (GCAP * GS) / 2);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

// ------------------------------------------------------------------ specials (the lyric's labels)
/** Label kinds for specData. */
export const K_LYRIC = 1, K_ECHO = 2;
/** Grid cell kinds for specGrid.g. */
export const G_HOLE = 1, G_PLATE = 2, G_CUT = 3;
export const SPEC_MAX = 64;
export const GRID = { c0: -4, r0: -6, nc: 18, nr: 48 };

export interface LabelState { prog: number; flash: number; done: number; act: number; pre: number; dir: number }

/** Per-label data (glyphs + karaoke state) and the slot grid, as float textures read by the shaders. */
export class Specials {
  data = new Float32Array(SPEC_MAX * 4 * 4);
  grid = new Float32Array(GRID.nc * GRID.nr * 4);
  dataTex: THREE.DataTexture;
  gridTex: THREE.DataTexture;
  n = 0;
  constructor() {
    this.dataTex = new THREE.DataTexture(this.data, 4, SPEC_MAX, THREE.RGBAFormat, THREE.FloatType);
    this.gridTex = new THREE.DataTexture(this.grid, GRID.nc, GRID.nr, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [this.dataTex, this.gridTex]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; }
  }
  private cell(r: number, c: number) {
    const i = c - GRID.c0, j = r - GRID.r0;
    if (i < 0 || j < 0 || i >= GRID.nc || j >= GRID.nr) throw new Error(`tape: slot (${r}, ${c}) outside the special grid`);
    return (j * GRID.nc + i) * 4;
  }
  /** A label with these 8 glyphs at slot (r, c); returns its id. */
  add(r: number, c: number, glyphs: number[], nWord: number, kind: number): number {
    const id = this.n++;
    const o = id * 16;
    for (let k = 0; k < 8; k++) this.data[o + k] = glyphs[k] ?? G_SPACE;
    this.data[o + 8] = nWord; this.data[o + 9] = kind; this.data[o + 10] = 1; this.data[o + 11] = 0;
    const g = this.cell(r, c);
    this.grid[g] = id + 1;
    this.gridTex.needsUpdate = true; this.dataTex.needsUpdate = true;
    return id;
  }
  mark(r: number, c: number, kind: number) { this.grid[this.cell(r, c) + 1] = kind; this.gridTex.needsUpdate = true; }
  set(id: number, s: LabelState) {
    const o = id * 16;
    this.data[o + 10] = s.dir; this.data[o + 11] = s.pre;
    this.data[o + 12] = s.prog; this.data[o + 13] = s.flash; this.data[o + 14] = s.done; this.data[o + 15] = s.act;
  }
  upload() { this.dataTex.needsUpdate = true; }
}

/** Label glyphs for a word: the word, zero-padded to the six-character VOLSER, then the media ID L9 (LTO-9). */
export function volser(word: string): { glyphs: number[]; n: number } {
  const chars = Array.from(word.toUpperCase().replace(/'/g, '’'));
  const n = Math.min(8, chars.length);
  const out: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (i < n) out.push(glyphIndex(chars[i]!));
    else if (i < 6) out.push(G_ZERO);
    else out.push(glyphIndex(i === 6 ? 'L' : '9'));
  }
  return { glyphs: out, n };
}

// ------------------------------------------------------------------ GLSL
const f = (x: number) => x.toFixed(6);

/** Constants, glyph and bar helpers, the cartridge face and its label. Needs DPX/DPY set per fragment. */
export const LABEL_GLSL = /* glsl */ `
const float CX = ${f(CX)}, POSTW = ${f(POSTW)}, BAYW = ${f(BAYW)}, RY = ${f(RY)};
const float SW = ${f(SW)}, SH = ${f(SH)}, CW = ${f(CW)}, CHT = ${f(CHT)}, CY0 = ${f(CY0)};
const float DR = ${f(DR)}, DH = ${f(DH)}, LW = ${f(LW)}, LH = ${f(LH)};
const float BX0 = ${f(BX0)}, BW = ${f(BW)}, BY0 = ${f(BY0)}, BY1 = ${f(BY1)};
const float BAR_X0 = ${f(BAR_X0)}, BAR_X1 = ${f(BAR_X1)}, BAR_Y0 = ${f(BAR_Y0)}, BAR_Y1 = ${f(BAR_Y1)};
const float GCELL = ${f(CAP_BOX / GCAP)};
const float MODW = ${f((BAR_X1 - BAR_X0) / 144)}; // one narrow module
const float WIDE = 2.5;
const int C39[${C39_TABLE.length}] = int[${C39_TABLE.length}](${C39_TABLE.join(', ')});
const int C39_STAR = ${parseInt(C39['*']!, 2)};
const int G_SPACE = ${G_SPACE};

// linear palette for the wall (very dark: the drawing is in the lines)
const vec3 C_WALL = vec3(0.0105, 0.0122, 0.0118);
const vec3 C_CART = vec3(0.0060, 0.0066, 0.0068);
const vec3 C_PAPER = vec3(0.0135, 0.0146, 0.0146);
const vec3 C_HOLE = vec3(0.0022, 0.0026, 0.0026);

uniform sampler2D glyphs;
uniform sampler2D specData;

vec2 DPX, DPY; // d(wall-local)/d(screen px), set per fragment at top level

float wppDir(vec2 g) { return max(length(vec2(dot(g, DPX), dot(g, DPY))), 1e-7); }
/** A line at signed distance d (gradient direction g in wall-local), width wpx logical px or ww world. */
float lineAA(float d, vec2 g, float wpx, float ww) {
  float w = wppDir(g);
  float hw = max(ww, 0.5 * wpx * PX_SCALE * w);
  return sat((hw - abs(d)) / w + 0.5) * sat(hw / w * 1.4);
}
float boxLine(vec2 q, vec2 b, float r, float wpx, float ww) {
  vec2 e = abs(q) - b;
  vec2 g = e.x > e.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  return lineAA(sdBox(q, b - r) - r, g, wpx, ww);
}
float boxFill(vec2 q, vec2 b, float r) {
  vec2 e = abs(q) - b;
  vec2 g = e.x > e.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  float w = wppDir(g);
  return sat(0.5 - (sdBox(q, b - r) - r) / w);
}

float glyphAt(int g, vec2 p) {
  if (g == G_SPACE) return 0.0;
  vec2 cu = 0.5 + p / GCELL;
  if (cu.x < 0.0 || cu.y < 0.0 || cu.x > 1.0 || cu.y > 1.0) return 0.0;
  vec2 base = vec2(float(g % ${GC}), float(${GR - 1} - g / ${GC}));
  vec2 k = 1.0 / (GCELL * vec2(${GC}.0, ${GR}.0));
  return textureGrad(glyphs, (base + cu) / vec2(${GC}.0, ${GR}.0), DPX * k, DPY * k).r;
}

int GL[8];
/** Cumulative bar length (modules) of the symbol *GL[0..7]* from its start to u. */
float barCum(float u) {
  if (u <= 0.0) return 0.0;
  float acc = 0.0, x0 = 0.0;
  for (int k = 0; k < 10; k++) {
    int pat = (k == 0 || k == 9) ? C39_STAR : C39[clamp(GL[max(k - 1, 0)], 0, ${C39_TABLE.length - 1})];
    for (int e = 0; e < 9; e++) {
      float w = ((pat >> (8 - e)) & 1) == 1 ? WIDE : 1.0;
      if ((e & 1) == 0) acc += clamp(u - x0, 0.0, w);
      x0 += w;
      if (x0 >= u) return acc;
    }
    x0 += 1.0;
    if (x0 >= u) return acc;
  }
  return acc;
}

// label state (from specData, or ordinary)
float L_N, L_KIND, L_DIR, L_PRE, L_PROG, L_FLASH, L_DONE, L_ACT;
void loadSpec(int id) {
  vec4 a = texelFetch(specData, ivec2(0, id), 0), b = texelFetch(specData, ivec2(1, id), 0);
  vec4 c = texelFetch(specData, ivec2(2, id), 0), d = texelFetch(specData, ivec2(3, id), 0);
  GL[0] = int(a.x); GL[1] = int(a.y); GL[2] = int(a.z); GL[3] = int(a.w);
  GL[4] = int(b.x); GL[5] = int(b.y); GL[6] = int(b.z); GL[7] = int(b.w);
  L_N = c.x; L_KIND = c.y; L_DIR = c.z; L_PRE = c.w;
  L_PROG = d.x; L_FLASH = d.y; L_DONE = d.z; L_ACT = d.w;
}
/** An ordinary tape: a VOLSER from the slot's hash (two letters, four digits, L9/L8/L7), a few cleaning tapes. */
void loadOrdinary(vec2 cell) {
  float h = hash12(cell * vec2(1.0, 1.37) + 11.3);
  float hb = hash12(vec2(floor(cell.x / 5.0), floor(cell.y / 12.0)) + 3.1);
  L_N = 0.0; L_KIND = 0.0; L_DIR = 1.0; L_PRE = 0.0; L_PROG = 0.0; L_FLASH = 0.0; L_DONE = 0.0; L_ACT = 0.0;
  if (h < 0.05) { // CLN014CU
    GL[0] = 12; GL[1] = 21; GL[2] = 23;
    for (int i = 3; i < 6; i++) GL[i] = int(10.0 * hash12(cell + float(i) * 7.1));
    GL[6] = 12; GL[7] = 30;
    return;
  }
  GL[0] = 10 + int(26.0 * hb); GL[1] = 10 + int(26.0 * fract(hb * 13.7));
  for (int i = 2; i < 6; i++) GL[i] = int(10.0 * hash12(cell + float(i) * 3.3));
  GL[6] = 21;
  float m = hash12(cell + 0.5);
  GL[7] = m < 0.7 ? 9 : m < 0.9 ? 8 : 7;
}

/** The label (q label-local, world units). lod: detail level 0..1. */
vec3 labelCol(vec2 q, float lod) {
  vec3 col = C_PAPER;
  bool lyric = L_KIND > 0.5;
  float gainK = L_KIND > 1.5 ? 0.62 : 1.0;
  float pre = L_PRE;
  // the sung span (label-local x)
  float n = L_N;
  float fx = L_DIR > 0.0 ? BX0 + L_PROG * n * BW : BX0 + (1.0 - L_PROG) * n * BW;
  bool sungX = lyric && L_PROG > 0.0 && (L_DIR > 0.0 ? (q.x < fx && q.x > BX0) : (q.x > fx && q.x < BX0 + n * BW));
  float live = (1.0 - L_DONE);
  vec3 FILL = C_SIGNAL * 3.2 * gainK;

  // character boxes
  float bxr = (q.x - BX0) / BW;
  if (q.y > BY0 && q.y < BY1 && bxr >= 0.0 && bxr < 8.0) {
    int bi = int(floor(bxr));
    bool word = lyric && float(bi) < n;
    if (word && sungX) {
      float nearF = exp(-abs(q.x - fx) / 0.03);
      col = mix(col, FILL + vec3(1.2) * L_FLASH * nearF, live);
    }
    vec2 cc = vec2(BX0 + (float(bi) + 0.5) * BW, 0.5 * (BY0 + BY1));
    float g = glyphAt(GL[bi], q - cc) * smoothstep(0.05, 0.3, lod);
    vec3 cBase = C_GRAPHITE * 0.6;
    if (lyric) cBase = word ? mix(C_GRAPHITE * 0.6, C_ASH * (L_KIND > 1.5 ? 0.62 : 1.1), pre) : C_GRAPHITE * 0.55;
    vec3 cChar = (word && sungX) ? mix(C_INK * 0.15, C_BONE * 1.05 * gainK, L_DONE) : cBase;
    col = mix(col, cChar, g);
  }
  // box rules
  float rule = 0.0;
  if (q.y > BY0 - 0.004 && q.y < BY1 + 0.004 && bxr > -0.05 && bxr < 8.05) {
    float dv = (fract(bxr + 0.5) - 0.5) * BW;
    rule = max(rule, lineAA(dv, vec2(1.0, 0.0), 1.0, 0.0006) * (abs(bxr - 6.0) < 0.5 ? 1.8 : 1.0));
    rule = max(rule, lineAA(q.y - BY0, vec2(0.0, 1.0), 1.0, 0.0006));
    rule = max(rule, lineAA(q.y - BY1, vec2(0.0, 1.0), 1.0, 0.0006));
  }
  vec3 cRule = lyric ? mix(C_GRAPHITE * 0.32, C_ASH * 0.4, pre) : C_GRAPHITE * 0.3;
  if (lyric && L_DONE > 0.5) cRule = C_BONE * 0.35 * gainK;
  col = mix(col, cRule, rule * smoothstep(0.1, 0.5, lod));

  // bars (box-filtered over the pixel footprint: no moiré)
  if (q.y > BAR_Y0 && q.y < BAR_Y1 && q.x > BAR_X0 - 0.002 && q.x < BAR_X1 + 0.002) {
    float u = (q.x - BAR_X0) / MODW;
    float fw = wppDir(vec2(1.0, 0.0)) / MODW;
    float cov;
    if (fw > 3.0) cov = 0.43;
    else { float h = max(0.5 * fw, 1e-3); cov = (barCum(u + h) - barCum(u - h)) / (2.0 * h); }
    float ey = min(q.y - BAR_Y0, BAR_Y1 - q.y);
    cov *= sat(ey / wppDir(vec2(0.0, 1.0)) + 0.5);
    vec3 cBar = lyric ? mix(C_GRAPHITE * 0.55, C_ASH * 0.75, pre) : C_GRAPHITE * 0.5;
    if (sungX) {
      float trail = exp(-abs(q.x - fx) / 0.07);
      cBar = mix(mix(C_BONE * 0.6 * gainK, C_SIGNAL * 2.2 * gainK, 0.35 + 0.65 * trail), C_BONE * 0.55 * gainK, L_DONE);
    }
    col = mix(col, cBar, cov * smoothstep(0.0, 0.25, lod));
  }
  // outline
  col = mix(col, lyric ? mix(C_GRAPHITE * 0.6, C_ASH * 0.55, pre) : C_GRAPHITE * 0.55, boxLine(q, vec2(0.5 * LW, 0.5 * LH), 0.006, 1.0, 0.0008));
  // the scan line: the cursor across the label
  if (L_ACT > 0.0) {
    float sl = lineAA(q.x - fx, vec2(1.0, 0.0), 2.2, 0.0015) * step(abs(q.y), 0.5 * LH + 0.012);
    col += (C_EMBER * 2.5 + vec3(0.6)) * sl * L_ACT;
    col += C_SIGNAL * 1.2 * exp(-abs(q.x - fx) / 0.02) * step(abs(q.y), 0.5 * LH) * L_ACT;
  }
  return col;
}

/** The cartridge's rear face (c: face-local, centred), with its label. */
vec3 cartFace(vec2 c, float lod) {
  vec3 col = C_CART;
  vec2 hb = vec2(0.5 * CW, 0.5 * CHT);
  // grip ribs at both ends, the write-protect tab on the right
  float ax = abs(c.x);
  if (ax > hb.x - 0.075 && ax < hb.x - 0.012 && abs(c.y) < hb.y - 0.03) {
    float rib = lineAA((fract((ax - hb.x) / 0.011) - 0.5) * 0.011, vec2(1.0, 0.0), 0.8, 0.0006);
    col = mix(col, C_GRAPHITE * 0.28, rib * smoothstep(0.2, 0.6, lod));
  }
  col = mix(col, C_GRAPHITE * 0.35, boxLine(c - vec2(hb.x - 0.045, -0.07), vec2(0.018, 0.022), 0.004, 0.8, 0.0006) * smoothstep(0.2, 0.6, lod));
  // top edge catches a little light
  col += C_BONE * 0.03 * smoothstep(-0.01, 0.0, c.y - hb.y + 0.012);
  if (abs(c.x) < 0.5 * LW + 0.004 && abs(c.y) < 0.5 * LH + 0.004) col = labelCol(c, lod);
  col = mix(col, C_GRAPHITE * 0.7, boxLine(c, hb, 0.008, 1.0, 0.0008));
  return col;
}
`;

const WALL_VS = /* glsl */ `
precision highp float;
in vec3 position;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
out vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const WALL_FS = /* glsl */ `
precision highp float; precision highp int;
in vec3 vW;
out vec4 fragColor;
${GLSL_COMMON}
${LABEL_GLSL}
uniform sampler2D specGrid; uniform vec4 gridBox;
uniform vec3 camPos;
uniform vec2 fogP;
uniform vec3 reveal;
uniform float side, gain, heatK;
uniform vec4 plateR; uniform sampler2D plateTex; uniform float plateFlash, plateOn;
uniform vec2 focusP;

void main() {
  vec2 P = side < 0.5 ? vW.xy : vec2(-vW.x, vW.y);
  DPX = dFdx(P); DPY = dFdy(P);
  vec3 V = normalize(vW - camPos);
  float vin = side < 0.5 ? -V.z : V.z;
  vec2 vt = side < 0.5 ? V.xy : vec2(-V.x, V.y);
  vec2 o1 = vt / max(vin, 0.05);
  o1 *= min(1.0, 9.0 / max(length(o1), 1e-4));
  float dist = length(vW - camPos);
  float pitchPx = RY / (wppDir(vec2(0.0, 1.0)) * PX_SCALE);
  float lodGrid = smoothstep(2.5, 7.0, pitchPx);
  float lod = smoothstep(9.0, 40.0, pitchPx);

  // bays: columns and uprights
  float X = P.x + 0.5 * CX;
  float bay = floor(X / BAYW);
  float xb = X - bay * BAYW;
  bool post = xb >= 5.0 * CX;
  float cIn = floor(xb / CX);
  float col = bay * 5.0 + min(cIn, 4.0);
  float row = floor(-P.y / RY + 0.5);
  vec2 q = vec2(xb - cIn * CX - 0.5 * CX, P.y + row * RY);
  vec2 cellC = vec2(bay * BAYW + min(cIn, 4.0) * CX, -row * RY);

  // what lives in this slot
  int sid = -1; int gk = 0;
  if (side < 0.5 && !post) {
    ivec2 gi = ivec2(int(col - gridBox.x), int(row - gridBox.y));
    if (gi.x >= 0 && gi.y >= 0 && gi.x < int(gridBox.z) && gi.y < int(gridBox.w)) {
      vec4 gg = texelFetch(specGrid, gi, 0);
      sid = int(gg.r) - 1; gk = int(gg.g + 0.5);
    }
  }
  float hs = hash12(vec2(col, row) + side * 91.7 + 0.37);
  bool origin = side < 0.5 && col == 0.0 && row == 0.0;
  bool empty = gk == ${G_HOLE} || (sid < 0 && !origin && hs < (side > 0.5 ? 0.05 : 0.035));

  vec3 c = C_WALL;
  float lines = 0.0, linesO = 0.0; vec3 cLine = C_ASH * 0.34;
  bool plate = side < 0.5 && plateOn > 0.5 && P.x > plateR.x && P.x < plateR.z && P.y > plateR.y && P.y < plateR.w;
  if (plate) {
    vec2 pu = (P - plateR.xy) / (plateR.zw - plateR.xy);
    vec2 pc = P - 0.5 * (plateR.xy + plateR.zw), ph = 0.5 * (plateR.zw - plateR.xy);
    c = vec3(0.0165, 0.018, 0.0178);
    vec4 tx = texture(plateTex, pu);
    c = mix(c, C_BONE * 0.78, tx.r);
    c = mix(c, mix(C_BONE * 1.0, C_SIGNAL * 4.0 + vec3(0.9), plateFlash), tx.g);
    c = mix(c, C_BONE * 0.55, boxLine(pc, ph - 0.012, 0.01, 1.2, 0.0012));
    for (int i = 0; i < 4; i++) {
      vec2 sp = ph - 0.045; sp *= vec2(i % 2 == 0 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0);
      float d = length(pc - sp);
      c = mix(c, C_GRAPHITE * 0.5, lineAA(d - 0.014, vec2(1.0, 0.0), 1.0, 0.001));
      c = mix(c, C_GRAPHITE * 0.45, lineAA(dot(pc - sp, vec2(0.7071, 0.7071)), vec2(0.7071, 0.7071), 1.0, 0.001) * step(d, 0.012));
    }
  } else if (post) {
    float px = xb - 5.0 * CX - 0.5 * POSTW;
    c = C_WALL * 1.25;
    lines = max(lineAA(abs(px) - (0.5 * POSTW - 0.012), vec2(1.0, 0.0), 1.0, 0.0012), lineAA(abs(px) - 0.5 * POSTW, vec2(1.0, 0.0), 1.2, 0.0015) * 0.6);
    // perforations, one per shelf
    vec2 hq = vec2(px + 0.075, q.y);
    float hf = boxFill(hq, vec2(0.022, 0.05), 0.012);
    c = mix(c, C_HOLE, hf * lodGrid);
    lines = max(lines, boxLine(hq, vec2(0.022, 0.05), 0.012, 0.8, 0.0008) * 0.7 * lodGrid);
    // shelf numbers
    if (side < 0.5 && row >= 0.0 && row < 1000.0) {
      int r = int(row);
      int dg[3] = int[3](r / 100, (r / 10) % 10, r % 10);
      float adv = 0.034;
      for (int k = 0; k < 3; k++) {
        float gcv = glyphAt(dg[k], (vec2(px - 0.025 - float(k) * adv, q.y) ) / 0.62);
        c = mix(c, C_GRAPHITE * 0.75, gcv * lod);
      }
    }
  } else {
    bool inOpen = abs(q.x) < 0.5 * SW && abs(q.y) < 0.5 * SH;
    float dOpen = sdBox(q, vec2(0.5 * SW, 0.5 * SH));
    if (inOpen) {
      if (gk == ${G_CUT}) discard;
      // the ray into the slot: which side wall it meets first (depth s), or the face behind
      float sx = abs(o1.x) > 1e-5 ? (sign(o1.x) * 0.5 * SW - q.x) / o1.x : 1e9;
      float sy = abs(o1.y) > 1e-5 ? (sign(o1.y) * 0.5 * SH - q.y) / o1.y : 1e9;
      float sHit = min(sx, sy);
      float wallTone = sy < sx ? (o1.y < 0.0 ? 0.9 : 0.3) : 0.55;
      vec3 cSide = C_WALL * wallTone;
      if (empty || origin) {
        c = sHit < DH ? mix(cSide, C_HOLE, smoothstep(0.0, DH, sHit)) : C_HOLE * 0.8;
      } else if (sHit < DR) {
        c = cSide;
      } else {
        vec2 qc = q + o1 * DR - vec2(0.0, CY0);
        if (abs(qc.x) < 0.5 * CW && abs(qc.y) < 0.5 * CHT) {
          if (sid >= 0) loadSpec(sid); else loadOrdinary(vec2(col, row) + side * 53.0);
          c = cartFace(qc, lod);
        } else c = sHit < 0.12 ? cSide * 0.6 : C_HOLE;
      }
    }
    vec2 gO = abs(q.x) - 0.5 * SW > abs(q.y) - 0.5 * SH ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    lines = lineAA(dOpen, gO, 1.15, 0.0012);
    if (origin) linesO = lineAA(dOpen, gO, 2.1, 0.0);
  }
  // the lines fade before they alias
  lines *= mix(0.25, 1.0, lodGrid);

  // plotting out from the first slot
  float rA = 1.0, heat = 0.0;
  if (reveal.z >= 0.0) {
    float dr = length(cellC - reveal.xy);
    rA = smoothstep(reveal.z + 0.05, reveal.z - 0.35, dr);
    heat = smoothstep(1.2, 0.0, reveal.z - dr) * rA * heatK;
    // the first slot is there from frame 1: its outline and its dark opening, nothing around it
    if (origin) rA = max(rA, max(lines, (abs(q.x) < 0.5 * SW && abs(q.y) < 0.5 * SH) ? 0.45 : 0.0));
  }
  // frame 1 is verseB's last: the slot's outline in bone, 2 px, easing into the library's hairline as it plots out
  if (origin) {
    heat = 0.0;
    float k0 = smoothstep(0.5, 3.0, reveal.z < 0.0 ? 99.0 : reveal.z);
    cLine = mix(C_BONE, cLine, k0);
    lines = mix(max(lines, linesO), lines, k0);
  }
  vec3 cL = mix(cLine, C_SIGNAL * 2.4, heat);
  c = mix(c, cL, lines);
  c *= gain;

  float fogA = exp(-max(0.0, dist - fogP.x) / fogP.y);
  // frame 1: the one slot's outline alone on the ground
  float a = rA * fogA;
  fragColor = vec4(c * a, a);
}`;

export interface WallU {
  camPos: { value: THREE.Vector3 }; fogP: { value: THREE.Vector2 }; reveal: { value: THREE.Vector3 };
  side: { value: number }; gain: { value: number }; heatK: { value: number };
  plateR: { value: THREE.Vector4 }; plateTex: { value: THREE.Texture | null }; plateFlash: { value: number }; plateOn: { value: number };
  focusP: { value: THREE.Vector2 };
}

export function makeWallMaterial(glyphs: THREE.Texture, sp: Specials, side: 0 | 1) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: WALL_VS,
    fragmentShader: WALL_FS,
    uniforms: {
      glyphs: { value: glyphs }, specData: { value: sp.dataTex }, specGrid: { value: sp.gridTex },
      gridBox: { value: new THREE.Vector4(GRID.c0, GRID.r0, GRID.nc, GRID.nr) },
      camPos: { value: new THREE.Vector3() }, fogP: { value: new THREE.Vector2(4, 8) }, reveal: { value: new THREE.Vector3(0, 0, -1) },
      side: { value: side }, gain: { value: 1 }, heatK: { value: 1 },
      plateR: { value: new THREE.Vector4() }, plateTex: { value: null }, plateFlash: { value: 0 }, plateOn: { value: 0 },
      focusP: { value: new THREE.Vector2() },
    },
    transparent: true, depthTest: true, depthWrite: true, side: THREE.FrontSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

// ------------------------------------------------------------------ the loose cartridge (a real box) and its empty slot
const CART_VS = /* glsl */ `
precision highp float;
in vec3 position; in vec3 normal;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
out vec3 vL; out vec3 vN; out vec3 vW;
void main() { vL = position; vN = normal; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const CART_FS = /* glsl */ `
precision highp float; precision highp int;
in vec3 vL; in vec3 vN; in vec3 vW;
out vec4 fragColor;
${GLSL_COMMON}
${LABEL_GLSL}
uniform int sid;
uniform vec3 camPos; uniform vec2 fogP;
void main() {
  // face-local 2D coordinates: front (+z) uses x/y; the others pick their own plane
  vec3 n = normalize(vN);
  vec2 p = abs(n.z) > 0.5 ? vL.xy : abs(n.x) > 0.5 ? vL.zy : vL.xz;
  DPX = dFdx(p); DPY = dFdy(p);
  vec3 c;
  if (n.z > 0.5) {
    loadSpec(sid);
    c = cartFace(vL.xy, 1.0);
  } else {
    vec2 hb = abs(n.x) > 0.5 ? vec2(${f(CD / 2)}, ${f(CHT / 2)}) : abs(n.y) > 0.5 ? vec2(${f(CW / 2)}, ${f(CD / 2)}) : vec2(${f(CW / 2)}, ${f(CHT / 2)});
    c = C_CART * (n.y > 0.5 ? 1.6 : n.y < -0.5 ? 0.5 : 1.0);
    c = mix(c, C_GRAPHITE * 0.6, boxLine(p, hb, 0.006, 1.0, 0.0008));
    // the shell's seam
    if (abs(n.y) < 0.5) c = mix(c, C_GRAPHITE * 0.35, lineAA(p.y, vec2(0.0, 1.0), 0.8, 0.0005));
  }
  float fogA = exp(-max(0.0, length(vW - camPos) - fogP.x) / fogP.y);
  fragColor = vec4(c * fogA, 1.0);
}`;

export function makeCartMaterial(glyphs: THREE.Texture, sp: Specials, sid: number) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: CART_VS, fragmentShader: CART_FS,
    uniforms: {
      glyphs: { value: glyphs }, specData: { value: sp.dataTex }, sid: { value: sid },
      camPos: { value: new THREE.Vector3() }, fogP: { value: new THREE.Vector2(4, 8) },
    },
    depthTest: true, depthWrite: true,
  });
}

const TUNNEL_FS = /* glsl */ `
precision highp float; precision highp int;
in vec3 vL; in vec3 vN; in vec3 vW;
out vec4 fragColor;
${GLSL_COMMON}
const vec3 C_WALL = vec3(0.0105, 0.0122, 0.0118);
const vec3 C_HOLE = vec3(0.0022, 0.0026, 0.0026);
uniform vec3 camPos; uniform vec2 fogP;
void main() {
  vec3 n = normalize(vN);
  float depth = sat((${f(-DR)} - vW.z) / ${f(DH)});
  float tone = n.y < -0.5 ? 0.9 : n.y > 0.5 ? 0.3 : abs(n.z) > 0.5 ? 0.25 : 0.55; // outward normals seen from inside: floor lit, ceiling dark
  vec3 c = mix(C_WALL * tone, C_HOLE, smoothstep(0.0, 1.0, depth));
  float fogA = exp(-max(0.0, length(vW - camPos) - fogP.x) / fogP.y);
  fragColor = vec4(c * fogA, 1.0);
}`;

export function makeTunnelMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: CART_VS, fragmentShader: TUNNEL_FS,
    uniforms: { camPos: { value: new THREE.Vector3() }, fogP: { value: new THREE.Vector2(4, 8) } },
    side: THREE.BackSide, depthTest: true, depthWrite: true,
  });
}
