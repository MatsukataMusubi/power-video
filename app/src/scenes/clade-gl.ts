// outroV (clade.ts): the sheet shader. The drafting ground and its grid are procedural (crisp at any zoom);
// everything drawn (the tree, the lettering, the pen) lives in a world-space overlay canvas redrawn every
// frame in the flat camera view and sampled through the full camera: a 2D camera (pan, roll, zoom, a
// keystone tilt for depth) with true multi-tap motion blur over the camera path, as in P(doom)'s leftturn.
// Only the overlay's blue glows (boosted here, above the bloom threshold).
import * as THREE from 'three';
import { FSPass, SCALE } from '../engine/gl';

export interface Cam { x: number; y: number; rot: number; zoom: number }

/** A world-space overlay: the flat camera view (before the keystone) at S texels per logical px. */
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
export type Box = ReturnType<WorldLayer['bounds']>;

export const CLADE_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform sampler2D uOv;
uniform vec4 uCamA, uCamB;      // (x, y, rot, zoom) at t and at t - shutter
uniform float uTaps, uK;
uniform vec2 uKd;               // keystone: screen direction that comes nearer
uniform float uT, uDim, uHaze, uGrid, uHot;
uniform vec3 uRev;              // reveal: world origin, radius
uniform vec4 uOvCam; uniform vec2 uOvSize; uniform float uOvS;

vec3 ground(vec2 fp) {
  float yy = fp.y / uRes.y;
  return mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.090, 0.104, 0.100)), yy);
}

vec2 toWorld(vec2 fp, vec4 cam, out float zl) {
  vec2 s = vec2(fp.x, uRes.y - fp.y) - 0.5 * uRes;   // centred, y down (logical px)
  float d = 1.0 + uK * dot(s, uKd);
  vec2 f = s / d / cam.w;
  zl = cam.w * d;
  float c = cos(cam.z), sn = sin(cam.z);
  return cam.xy + vec2(c * f.x + sn * f.y, -sn * f.x + c * f.y);
}

float lineAt(float d, float zl, float wpx) {
  float w = max(wpx, 0.8);
  return pxLine(d * zl * PX_SCALE, w * 0.5 - 0.5, w * 0.5 + 0.5) * min(1.0, wpx / 0.8);
}

vec3 shade(vec2 w, float zl, vec2 fp, out float rev) {
  vec3 g0 = ground(fp);
  // the sheet spreads out of the root (the exhibit's last light) on the first frames
  float r = length(w - uRev.xy);
  rev = 1.0 - smoothstep(uRev.z - 260.0, uRev.z + 40.0, r);
  vec3 col = g0;
  // drafting grid, 60 / 240 units
  vec2 dmin = abs(fract(w / 60.0 + 0.5) - 0.5) * 60.0, dmaj = abs(fract(w / 240.0 + 0.5) - 0.5) * 240.0;
  float gmin = max(lineAt(dmin.x, zl, 1.0), lineAt(dmin.y, zl, 1.0)) * smoothstep(2.5, 7.0, 60.0 * zl);
  float gmaj = max(lineAt(dmaj.x, zl, 1.1), lineAt(dmaj.y, zl, 1.1));
  col = mix(col, toLinear(vec3(0.17, 0.19, 0.18)), (0.07 * gmin + 0.17 * gmaj) * uGrid);
  // the reveal's leading edge: a faint graphite ring
  float edge = exp(-pow((r - uRev.z) / 70.0, 2.0)) * step(uRev.z, 4000.0);
  col += toLinear(vec3(0.10, 0.12, 0.12)) * 0.5 * edge;
  col *= rev;
  col *= uDim;

  // the overlay (tree, lettering, pen), drawn in the flat camera view of uOvCam
  vec2 d = w - uOvCam.xy;
  float c = cos(uOvCam.z), s = sin(uOvCam.z);
  vec2 f = vec2(c * d.x - s * d.y, s * d.x + c * d.y) * uOvCam.w;
  vec2 ouv = (f * uOvS + 0.5 * uOvSize) / uOvSize;
  if (ouv.x > 0.0 && ouv.x < 1.0 && ouv.y > 0.0 && ouv.y < 1.0) {
    vec4 o = texture(uOv, ouv);
    // (sRGB texture: sampled linear) blue-ness in display terms decides what may glow
    vec3 sr = toSRGB(o.rgb);
    float h = smoothstep(0.2, 0.6, sr.b - sr.r * 1.25);
    col = mix(col, o.rgb * (1.0 + uHot * h), o.a);
  }
  return col;
}

void main() {
  int taps = int(uTaps);
  vec3 acc = vec3(0.0);
  vec2 fp = FRAG_PX;
  float rv = 0.0;
  for (int i = 0; i < 16; i++) {
    if (i >= taps) break;
    float k = taps > 1 ? float(i) / float(taps - 1) : 0.0;
    vec4 cam = mix(uCamA, uCamB, k);
    float zl, rev;
    vec2 w = toWorld(fp, cam, zl);
    acc += shade(w, zl, fp, rev);
    rv += rev;
  }
  vec3 col = acc / float(max(taps, 1));
  rv /= float(max(taps, 1));
  // depth haze toward the far side
  vec2 s = vec2(fp.x, uRes.y - fp.y) - 0.5 * uRes;
  float far = -dot(s, uKd) / (0.5 * uRes.y);
  col = mix(col, ground(fp) * rv * uDim, smoothstep(0.35, 1.25, far) * uHaze);
  fragColor = vec4(col, 1.0);
}`;

export function makeCladePass(ov: WorldLayer) {
  return new FSPass(CLADE_FRAG, {
    uRes: { value: new THREE.Vector2(1920, 1080) }, uOv: { value: ov.tex },
    uCamA: { value: new THREE.Vector4(0, 0, 0, 1) }, uCamB: { value: new THREE.Vector4(0, 0, 0, 1) },
    uTaps: { value: 1 }, uK: { value: 0 }, uKd: { value: new THREE.Vector2(0, 1) },
    uT: { value: 0 }, uDim: { value: 1 }, uHaze: { value: 0 }, uGrid: { value: 1 }, uHot: { value: 0.6 },
    uRev: { value: new THREE.Vector3(0, 0, 1e5) },
    uOvCam: { value: new THREE.Vector4(0, 0, 0, 1) }, uOvSize: { value: new THREE.Vector2(ov.w, ov.h) }, uOvS: { value: WorldLayer.S },
  });
}
