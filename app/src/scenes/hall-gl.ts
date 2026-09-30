// verseB (hall.ts): the sheet shader. Everything regular in the plan is procedural, so it stays crisp
// at any zoom and costs nothing to repeat across the hall: the drafting ground, the walls, the floor
// tiles, the perforated tiles of the cold aisles, the rack rows (outline, front edge, status LEDs), the
// cold air switching on tile by tile, and the plan's own airflow simulation (mesh refined at the rack
// faces, temperature wash, isotherms every 2 °C, streaks advected by the flow field). A 2D camera
// (pan, roll, zoom, a keystone tilt for depth) with true multi-tap motion blur over the camera path,
// as in P(doom)'s leftturn. A world-space overlay canvas (letters, labels, the certificate, the tracer)
// is sampled through the same camera, so it shares the keystone and the blur; only its blue glows.
import * as THREE from 'three';
import { FSPass, SCALE } from '../engine/gl';
import { HALL, PERIOD, HOT, ISO_STEP } from './hall-plan';

export interface Cam { x: number; y: number; rot: number; zoom: number }

/**
 * A world-space overlay: a canvas holding the flat camera view (before the keystone) at S texels per
 * logical screen px, drawn every frame with the camera's affine transform.
 */
export class WorldLayer {
  static S = 1.1 * SCALE;
  cv = document.createElement('canvas');
  c: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  cam: Cam = { x: 0, y: 0, rot: 0, zoom: 1 };
  constructor(public w = 2880 * SCALE, public h = 1620 * SCALE) {
    this.cv.width = w; this.cv.height = h;
    this.c = this.cv.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.flipY = false;
  }
  begin(cam: Cam) {
    const c = this.c;
    this.cam = { ...cam };
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.setLineDash([]);
    c.clearRect(0, 0, this.w, this.h);
    this.world();
  }
  /** World transform (x right, y down, world units). */
  world() {
    const { x, y, rot, zoom } = this.cam, S = WorldLayer.S;
    const k = S * zoom, cs = Math.cos(rot) * k, sn = Math.sin(rot) * k;
    this.c.setTransform(cs, sn, -sn, cs, this.w / 2 - (cs * x - sn * y), this.h / 2 - (sn * x + cs * y));
  }
  /** World units per logical screen px. */
  get px() { return 1 / this.cam.zoom; }
  /** World-space bounds covered by the canvas (axis-aligned, with a margin). */
  bounds(margin = 0) {
    const { x, y, rot, zoom } = this.cam, S = WorldLayer.S;
    const hw = this.w / (2 * S * zoom), hh = this.h / (2 * S * zoom);
    const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
    const ex = c * hw + s * hh + margin, ey = s * hw + c * hh + margin;
    return { x0: x - ex, x1: x + ex, y0: y - ey, y1: y + ey };
  }
  upload() { this.tex.needsUpdate = true; return this.tex; }
}

const f1 = (v: number) => v.toFixed(1);

export const HALL_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform sampler2D uOv;
uniform vec4 uCamA, uCamB;      // (x, y, rot, zoom) at t and at t - shutter
uniform float uTaps, uK;
uniform vec2 uKd;               // keystone: screen direction that comes nearer (d = 1 + K dot(s, uKd))
uniform float uT, uRevealY, uDim, uHaze, uGrid;
uniform float uLedX;            // rows E/F: status LEDs lit where the rack centre is west of this
uniform float uAirX0;           // air: first tile's west edge (cold aisle 3); tiles lit at uAirT[i]
uniform float uAirT[20];
uniform float uAirFront;         // air: x of the front (streaks run behind it); < -1e4 = off
uniform vec2 uSimO;             // simulation: origin of the reveal
uniform vec4 uSimR;             // radii of mesh, isotherms, streaks, wash
uniform float uSim;             // 0..1 overall (plan -> simulation)
uniform vec4 uOvCam; uniform vec2 uOvSize; uniform float uOvS, uHot;
const float RW0 = ${f1(HALL.RW0)}, RW1 = ${f1(HALL.RW1)}, RE0 = ${f1(HALL.RE0)}, RE1 = ${f1(HALL.RE1)};
const float PY0 = ${f1(HALL.K0 * PERIOD - 480)}, PY1 = ${f1(HALL.K1 * PERIOD + 480)};
const float HX0 = ${f1(HALL.X0)}, HX1 = ${f1(HALL.X1)}, HY0 = ${f1(HALL.Y0)}, HY1 = ${f1(HALL.Y1)};
const vec2 HOT = vec2(${f1(HOT.x)}, ${f1(HOT.y)});
const float ISO = ${f1(ISO_STEP)};

vec3 ground(vec2 fp) {
  float yy = fp.y / uRes.y;
  return mix(toLinear(vec3(0.036, 0.042, 0.042)), toLinear(vec3(0.070, 0.080, 0.078)), yy);
}

vec2 toWorld(vec2 fp, vec4 cam, out float zl) {
  vec2 s = vec2(fp.x, uRes.y - fp.y) - 0.5 * uRes;   // centred, y down (logical px)
  float d = 1.0 + uK * dot(s, uKd);
  vec2 f = s / d / cam.w;
  zl = cam.w * d;
  float c = cos(cam.z), sn = sin(cam.z);
  return cam.xy + vec2(c * f.x + sn * f.y, -sn * f.x + c * f.y);
}

// ---- the airflow (mirrors hall-plan.ts)
float rowMask(vec2 w) {
  float inW = smoothstep(RW0 - 300.0, RW0 + 60.0, w.x) * (1.0 - smoothstep(RW1 - 60.0, RW1 + 300.0, w.x));
  float inE = smoothstep(RE0 - 300.0, RE0 + 60.0, w.x) * (1.0 - smoothstep(RE1 - 60.0, RE1 + 300.0, w.x));
  return max(inW, inE) * smoothstep(PY0 - 200.0, PY0 + 100.0, w.y) * (1.0 - smoothstep(PY1 - 100.0, PY1 + 200.0, w.y));
}
float tempAt(vec2 w) {
  float yl = w.y - 960.0 * floor(w.y / 960.0 + 0.5);
  float a = abs(yl);
  float dEnd = min(abs(w.x - RW1), abs(w.x - RE0));
  float warm = 4.5 * exp(-dEnd / 520.0);
  float ac = min(a, 120.0);
  float t1 = 18.0 + warm + 5.5 * (ac * ac) / 14400.0;
  float T = t1 + (35.0 - t1) * smoothstep(120.0, 360.0, a) + 3.0 * smoothstep(360.0, 480.0, a);
  T += (1.3 * sin(w.x * 0.0061 + 1.7 * sin(w.y * 0.0043 + w.x * 0.0011)) + 0.7 * sin(w.y * 0.009 - w.x * 0.0027 + 2.0)) * (0.45 + 0.55 * smoothstep(90.0, 200.0, a));
  float room = 27.0 + 1.2 * sin(w.x * 0.0017 + w.y * 0.0023) + 0.8 * sin(w.y * 0.0051 - 1.0);
  T = mix(room, T, rowMask(w));
  vec2 d = w - HOT;
  T += 9.0 * exp(-dot(d, d) / (190.0 * 190.0));
  return T;
}
vec2 velAt(vec2 w) {
  float yl = w.y - 960.0 * floor(w.y / 960.0 + 0.5);
  float a = abs(yl), sg = yl < 0.0 ? -1.0 : 1.0;
  float row = rowMask(w);
  float across = a < 120.0 ? a / 120.0 : (a < 360.0 ? 1.0 : (480.0 - a) / 120.0);
  float west = w.x < 0.5 * (RW1 + RE0) ? -1.0 : 1.0;
  float hotA = smoothstep(360.0, 420.0, a), coldA = 1.0 - smoothstep(60.0, 120.0, a);
  vec2 v = vec2(hotA * west * 95.0 - coldA * west * 20.0, sg * 80.0 * across) * row;
  v += (1.0 - row) * vec2(west * 70.0, 30.0 * sin(w.x * 0.004 + w.y * 0.001));
  v += 12.0 * vec2(sin(w.y * 0.011 + 1.3 * sin(w.x * 0.007)), cos(w.x * 0.012 - 0.7 + 1.1 * sin(w.y * 0.006)));
  vec2 d = w - HOT; float r2 = dot(d, d);
  v += vec2(-d.y, d.x) * 0.9 * exp(-r2 / (220.0 * 220.0)) + d * 0.5 * exp(-r2 / (160.0 * 160.0));
  return v;
}

float lineAt(float d, float zl, float wpx) {
  // d in world units; a line of wpx logical px; thinner than 0.8 px fades by alpha
  float w = max(wpx, 0.8);
  return pxLine(d * zl, w * 0.5 - 0.5, w * 0.5 + 0.5) * min(1.0, wpx / 0.8);
}

// streaks: one particle per cell, respawned every life, advected along the flow; (coverage, cold side)
vec2 streakLayer(vec2 w, float zl, float G, float seed, float wpx, float len) {
  vec2 cid = floor(w / G);
  float cov = 0.0, coldW = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cid + vec2(float(i), float(j));
    vec2 h = hash22(c + seed);
    float life = 1.1 + 0.6 * h.y;
    float ph = fract(uT / life + h.x);
    vec2 p0 = (c + 0.15 + 0.7 * hash22(c * 1.37 + 3.1 + seed)) * G;
    vec2 v = velAt(p0);
    vec2 p = p0 + v * (ph * life) * (0.42 * G / 64.0);
    vec2 q = p - v * 0.26 * len * (G / 64.0);
    float dd = sdSegment(w, q, p);
    float k = sin(3.14159 * ph);
    float s = lineAt(dd, zl, wpx) * k * smoothstep(0.0, 0.3, dot(v, v) / 900.0);
    if (s > cov) { cov = s; coldW = step(0.0, 25.0 - tempAt(p0)); }
  }
  return vec2(cov, coldW);
}
vec2 streaks(vec2 w, float zl) {
  vec2 a = streakLayer(w, zl, 64.0, 19.7, 1.3, 1.0);
  float fineK = smoothstep(18.0, 40.0, 26.0 * zl);
  if (fineK > 0.0) {
    vec2 b = streakLayer(w, zl, 26.0, 41.3, 1.1, 1.0);
    b.x *= fineK * 0.55;
    if (b.x > a.x) a = b;
  }
  return a;
}

vec3 shade(vec2 w, float zl, vec2 fp) {
  vec3 g0 = ground(fp);
  vec3 col = g0;
  float rev = smoothstep(uRevealY - 60.0, uRevealY + 60.0, w.y);
  float inHall = step(HX0, w.x) * step(w.x, HX1) * step(HY0, w.y) * step(w.y, HY1);

  // sheet: drafting grid (outside the hall)
  vec2 dmin = abs(fract(w / 60.0 + 0.5) - 0.5) * 60.0, dmaj = abs(fract(w / 240.0 + 0.5) - 0.5) * 240.0;
  float gmin = max(lineAt(dmin.x, zl, 1.0), lineAt(dmin.y, zl, 1.0)) * smoothstep(2.0, 6.0, 60.0 * zl);
  float gmaj = max(lineAt(dmaj.x, zl, 1.2), lineAt(dmaj.y, zl, 1.2));
  col = mix(col, toLinear(vec3(0.17, 0.19, 0.18)), (0.08 * gmin + 0.2 * gmaj) * (1.0 - inHall) * uGrid);

  // the hall floor, a hair lighter than the sheet; the walls as poché between two lines
  col = mix(col, toLinear(vec3(0.058, 0.066, 0.065)), inHall * 0.9);
  float dIn = max(max(HX0 - w.x, w.x - HX1), max(HY0 - w.y, w.y - HY1));   // >0 outside the inner face
  float wall = step(0.0, dIn) * step(dIn, 60.0);
  col = mix(col, C_GRAPHITE * 0.35, wall * 0.8);
  col = mix(col, C_BONE * 0.6, max(lineAt(abs(dIn), zl, 2.0), lineAt(abs(dIn - 60.0), zl, 1.4)));

  // floor tiles (600 mm) everywhere in the hall
  vec2 tl = abs(fract(w / 120.0 + 0.5) - 0.5) * 120.0;
  float tileL = max(lineAt(tl.x, zl, 1.0), lineAt(tl.y, zl, 1.0)) * smoothstep(3.0, 9.0, 120.0 * zl);
  float yl = w.y - 960.0 * floor(w.y / 960.0 + 0.5);
  float a = abs(yl);
  float inPairs = step(PY0, w.y) * step(w.y, PY1);
  float blkW = step(RW0, w.x) * step(w.x, RW1), blkE = step(RE0, w.x) * step(w.x, RE1);
  float inBlk = max(blkW, blkE) * inPairs;
  float rackBand = inBlk * step(120.0, a) * step(a, 360.0);
  col = mix(col, toLinear(vec3(0.17, 0.19, 0.18)), 0.32 * tileL * inHall * (1.0 - rackBand));

  // perforated tiles in the cold aisles: a grid of holes, kept off the tile edges
  float coldAisle = inBlk * step(a, 120.0);
  vec2 tp = mod(w, 120.0);
  float edge = step(9.0, min(min(tp.x, tp.y), min(120.0 - tp.x, 120.0 - tp.y)));
  vec2 hq = (fract(w / 12.0) - 0.5) * 12.0;
  float hole = (1.0 - smoothstep(2.1 - 0.7 / zl, 2.1 + 0.7 / zl, length(hq))) * edge * coldAisle;
  float lod = smoothstep(3.5, 8.0, 12.0 * zl);
  // the air switching on, tile by tile (cold aisle 3, west block)
  float air = 0.0;
  if (abs(w.y) < 120.0 && w.x > uAirX0) {
    int ti = int(floor((w.x - uAirX0) / 120.0));
    if (ti < 20) {
      float ta = uAirT[ti];
      float age = uT - ta;
      if (age >= 0.0) air = 0.55 + 0.45 * exp(-age / 0.22) + 0.9 * exp(-age / 0.06);
    }
  }
  vec3 holeCol = mix(toLinear(vec3(0.20, 0.22, 0.21)), C_SIGNAL * 2.4, sat(air));
  col = mix(col, C_SIGNAL * 0.5, 0.07 * sat(air) * coldAisle * edge);
  col = mix(col, holeCol, hole * mix(0.55 * lod, 1.0, sat(air) * max(lod, 0.35)));
  // the air leaving the lit tiles for the rack intakes (the model's streaks, before the model)
  if (uAirFront > -1e4 && uSim == 0.0) {
    if (abs(w.y) < 420.0 && w.x > uAirX0 - 60.0 && w.x < uAirFront + 90.0) {
      vec2 st = streakLayer(w, zl, 34.0, 7.7, 1.5, 2.2);
      float m = smoothstep(uAirFront + 90.0, uAirFront - 30.0, w.x) * (1.0 - smoothstep(300.0, 400.0, abs(w.y)));
      col = mix(col, C_SIGNAL * 2.4, st.x * m);
    }
  }

  // rack rows: dark bodies, bone outlines, a heavier front edge on the cold aisle, a status LED
  float rackLine = 0.0, rackFront = 0.0, rackIn = 0.0, rackHat = 0.0, led = 0.0, lit = 0.0, ledGlow = 0.0;
  if (rackBand > 0.0) {
    float bx = blkW > 0.0 ? RW0 : RE0;
    float xr = w.x - bx, fx = mod(xr, 120.0);
    float dEdge = min(min(fx, 120.0 - fx), min(a - 120.0, 360.0 - a));
    col = mix(col, toLinear(vec3(0.030, 0.034, 0.034)), 0.85);
    rackLine = lineAt(dEdge, zl, 1.1);
    rackFront = lineAt(abs(a - 120.0), zl, 2.2);
    rackIn = lineAt(abs(a - 132.0), zl, 0.9) * smoothstep(4.0, 12.0, 120.0 * zl);
    float hb = step(330.0, a) * step(a, 356.0);
    float hat = abs(fract((w.x + w.y) / 14.0) - 0.5) * 14.0;
    rackHat = hb * lineAt(hat, zl, 0.9) * smoothstep(5.0, 14.0, 120.0 * zl);
    // status LED at the front, near the rack's west side
    float rc = bx + (floor(xr / 120.0) + 0.5) * 120.0;
    vec2 lp = vec2(rc - 38.0, sign(yl) * 146.0);
    float dl = length(vec2(w.x, yl) - lp);
    float pair = floor(w.y / 960.0 + 0.5);
    lit = (pair == 0.0 && blkW > 0.0 && rc < uLedX) ? 1.0 : 0.0;
    float ledLod = smoothstep(3.0, 8.0, 120.0 * zl);
    led = (1.0 - smoothstep(3.5 - 0.6 / zl, 3.5 + 0.6 / zl, dl)) * ledLod;
    ledGlow = lit * exp(-dl / 7.0) * ledLod;
  }

  // ---- the simulation: the plan becomes its own CFD model
  if (uSim > 0.0) {
    float r = length(w - uSimO);
    float mMesh = smoothstep(uSimR.x, uSimR.x - 260.0, r);
    float mIso = smoothstep(uSimR.y, uSimR.y - 260.0, r);
    float mStr = smoothstep(uSimR.z, uSimR.z - 260.0, r);
    float mWash = smoothstep(uSimR.w, uSimR.w - 400.0, r);
    float T = tempAt(w);
    float inH = inHall;
    // wash: cold air tinted blue, hot air faintly bone
    float cold = smoothstep(26.0, 18.0, T), hot = smoothstep(29.0, 38.0, T);
    col = mix(col, C_SIGNAL * 0.55, 0.085 * cold * mWash * inH);
    col = mix(col, C_BONE * 0.35, 0.03 * hot * mWash * inH);
    // mesh: 150 mm quads, refined to 37.5 mm at the rack faces, coarse inside the racks (porous blocks)
    vec2 mq = abs(fract(w / 30.0 + 0.5) - 0.5) * 30.0;
    float fine = abs(fract(yl / 7.5 + 0.5) - 0.5) * 7.5;
    float nearFace = min(abs(a - 120.0), abs(a - 360.0)) * inBlk;
    float my = (inBlk > 0.0 && nearFace < 30.0) ? min(mq.y, fine) : mq.y;
    vec2 cq = abs(fract(w / 60.0 + 0.5) - 0.5) * 60.0;
    float mx = rackBand > 0.0 ? cq.x : mq.x;
    my = rackBand > 0.0 ? min(cq.y, fine) : my;
    float mesh = max(lineAt(mx, zl, 0.8), lineAt(my, zl, 0.8)) * smoothstep(6.0, 14.0, 30.0 * zl);
    float meshWide = max(lineAt(tl.x, zl, 0.9), lineAt(tl.y, zl, 0.9)) * (1.0 - smoothstep(6.0, 14.0, 30.0 * zl));
    float frM = exp(-abs(r - uSimR.x) / 90.0) * step(0.0, uSimR.x), frI = exp(-abs(r - uSimR.y) / 90.0) * step(0.0, uSimR.y);
    col = mix(col, mix(toLinear(vec3(0.24, 0.27, 0.26)), C_BONE * 0.8, frM), max(0.5 * mesh, 0.14 * meshWide) * max(mMesh, frM) * inH);
    // isotherms every 2 °C, every 10 °C heavier
    float fT = T / ISO;
    float fw = max(fwidth(fT), 1e-5);
    float di = abs(fract(fT + 0.5) - 0.5) / fw;                 // physical px
    float idx = step(abs(mod(floor(fT + 0.5), 5.0)), 0.5);
    float spacing = 1.0 / (fw * PX_SCALE);                        // logical px between isotherms
    float isoLod = mix(sat((spacing - 5.0) / 12.0), 0.55 + 0.45 * sat((spacing - 3.0) / 8.0), idx);
    float iso = pxLine(di, mix(0.3, 0.6, idx), mix(1.2, 1.6, idx)) * isoLod;
    vec3 isoCol = mix(C_BONE * 0.4, C_BONE * 0.62, idx);
    col = mix(col, mix(isoCol, C_BONE, frI), iso * max(mIso, frI) * inH);
    // streaks
    vec2 st = streaks(w, zl);
    vec3 sCol = mix(C_BONE * 0.42, C_SIGNAL * 2.2, st.y);
    float sLod = mix(smoothstep(10.0, 40.0, 64.0 * zl), 1.0, 0.5 * st.y);
    col = mix(col, sCol, st.x * mStr * inH * 0.85 * sLod);
  }

  if (rackBand > 0.0) {
    float simK = uSim > 0.0 ? 0.62 : 1.0;
    col = mix(col, C_BONE * 0.42 * simK, rackLine);
    col = mix(col, C_BONE * 0.68 * simK, rackFront);
    col = mix(col, C_BONE * 0.22, rackIn * simK);
    col = mix(col, C_BONE * 0.16, rackHat * simK);
    col = mix(col, mix(C_GRAPHITE * 0.6, C_SIGNAL * 3.0, lit), led);
    col += C_SIGNAL * 0.5 * ledGlow;
  }
  col = mix(g0, col, rev);
  col = mix(g0, col, uDim);

  // the overlay (letters, labels, the certificate, the tracer), drawn in the flat camera view of uOvCam
  {
    vec2 d = w - uOvCam.xy;
    float c = cos(uOvCam.z), s = sin(uOvCam.z);
    vec2 f = vec2(c * d.x - s * d.y, s * d.x + c * d.y) * uOvCam.w;
    vec2 ouv = (f * uOvS + 0.5 * uOvSize) / uOvSize;
    if (ouv.x > 0.0 && ouv.x < 1.0 && ouv.y > 0.0 && ouv.y < 1.0) {
      vec4 o = texture(uOv, ouv);
      float h = smoothstep(0.25, 0.7, o.b - o.r * 1.3);
      col = mix(col, o.rgb * (1.0 + uHot * h), o.a * rev);
    }
  }
  return col;
}

void main() {
  int taps = int(uTaps);
  vec3 acc = vec3(0.0);
  vec2 fp = FRAG_PX;
  for (int i = 0; i < 16; i++) {
    if (i >= taps) break;
    float k = taps > 1 ? float(i) / float(taps - 1) : 0.0;
    vec4 cam = mix(uCamA, uCamB, k);
    float zl;
    vec2 w = toWorld(fp, cam, zl);
    acc += shade(w, zl, fp);
  }
  vec3 col = acc / float(max(taps, 1));
  // depth haze toward the far side
  vec2 s = vec2(fp.x, uRes.y - fp.y) - 0.5 * uRes;
  float far = -dot(s, uKd) / (0.5 * uRes.y);
  col = mix(col, ground(fp), smoothstep(0.35, 1.25, far) * uHaze);
  fragColor = vec4(col, 1.0);
}`;

export function makeHallPass(ov: WorldLayer) {
  return new FSPass(HALL_FRAG, {
    uRes: { value: new THREE.Vector2(1920, 1080) }, uOv: { value: ov.tex },
    uCamA: { value: new THREE.Vector4(0, 0, 0, 1) }, uCamB: { value: new THREE.Vector4(0, 0, 0, 1) },
    uTaps: { value: 1 }, uK: { value: 0 }, uKd: { value: new THREE.Vector2(0, 1) },
    uT: { value: 0 }, uRevealY: { value: -1e5 }, uDim: { value: 1 }, uHaze: { value: 0 }, uGrid: { value: 1 },
    uLedX: { value: -1e5 }, uAirX0: { value: 0 }, uAirFront: { value: -1e5 }, uAirT: { value: new Array(20).fill(1e5) },
    uSimO: { value: new THREE.Vector2() }, uSimR: { value: new THREE.Vector4(-1, -1, -1, -1) }, uSim: { value: 0 },
    uOvCam: { value: new THREE.Vector4(0, 0, 0, 1) }, uOvSize: { value: new THREE.Vector2(ov.w, ov.h) }, uOvS: { value: WorldLayer.S }, uHot: { value: 0.5 },
  });
}
