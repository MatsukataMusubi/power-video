// preach (organ.ts), GL: the pipes as instanced quads, each shaded as an engraved metal pipe (bone
// lines on graphite, the lines following the cylinder so they crowd toward its edges), and the wind
// inside them as the one blue: it fills a sounding pipe from the mouth (or a reed's boot) up, a
// standing wave brightest mid-length, pushed by every kick. Trumpets en chamade are seen bell-on:
// concentric rings into a throat that glows when they speak. Plus the ground pass behind them.
import * as THREE from 'three';
import { FSPass } from '../engine/gl';
import { GLSL_COMMON } from '../engine/glsl/common';
import { type Pipe } from './organ-geo';

export const NRANK = 8;

const VS = /* glsl */ `
precision highp float;
in vec3 position;
in vec4 iA;               // cx, top, toe, w
in vec4 iB;               // mouth (flue) / boot top (reed), type, rank, depth (1 = front)
uniform vec4 cam;         // centre x, y (world px), zoom, roll
uniform vec2 res;
out vec2 vW;
flat out vec4 vA; flat out vec4 vB;
void main() {
  vec2 lo, hi;
  float pad = 3.0 / max(cam.z, 0.2);
  if (iB.y > 1.5) { float r = iA.w * 0.5 + pad; lo = iA.xy - r; hi = iA.xy + r; }
  else { lo = vec2(iA.x - iA.w * 0.5 - pad, iA.y - pad); hi = vec2(iA.x + iA.w * 0.5 + pad, iA.z + pad); }
  vec2 w = mix(lo, hi, position.xy);
  vW = w; vA = iA; vB = iB;
  vec2 d = (w - cam.xy) * cam.z;
  float c = cos(cam.w), s = sin(cam.w);
  vec2 sp = vec2(c * d.x - s * d.y, s * d.x + c * d.y) + res * 0.5;
  gl_Position = vec4(sp.x / res.x * 2.0 - 1.0, 1.0 - sp.y / res.y * 2.0, 0.0, 1.0);
}`;

const FS = /* glsl */ `
precision highp float; precision highp int;
in vec2 vW; flat in vec4 vA; flat in vec4 vB;
out vec4 fragColor;
${GLSL_COMMON}
uniform float rankI[${NRANK}];     // wind level (0 = silent)
uniform float rankH[${NRANK}];     // how far the wind has risen up the pipe (0..1)
uniform float rankF[${NRANK}];     // ignition flash
uniform float rankShow[${NRANK}];  // drawn at all
uniform vec3 reveal;               // world centre, radius (< 0: everything shown)
uniform float push;                // the kick pushing the wind
uniform float t;
uniform float drain;               // exit: the wind leaves the pipes (0..1)
uniform float dim;                 // exit: the metal goes dark (0..1)
uniform float lineK;               // engraving line spacing (world px)
uniform float lodK;                // wanted / actual on-screen line spacing (> 1: thin the lines out)
uniform float engr0;               // the flat's engraving strength (frame 1: world5's outlined tubes; it comes up with the wind)

const vec3 METAL = vec3(0.010, 0.012, 0.012);
const vec3 BONEL = vec3(0.74, 0.71, 0.64);

/** hatch() with a level of detail: every other line drops out (blended) when lines crowd on screen. */
float hatchL(float u, float lw) {
  float L = max(0.0, log2(max(lodK, 1e-3)));
  float i = floor(L), f = L - i;
  return mix(hatch(u / exp2(i), lw), hatch(u / exp2(i + 1.0), lw), f);
}

vec3 windCol(float I, float sw, float F) {
  return C_SIGNAL * I * sw * 0.95 + C_EMBER * F * 0.7;
}

void main() {
  float type = vB.y;
  int rk = int(vB.z + 0.5);
  float show = rankShow[rk];
  if (show <= 0.0) discard;
  float I = rankI[rk], Hh = rankH[rk], F = rankF[rk];
  float gain = 1.0 + push;
  float px = max(fwidth(vW.x), 1e-4);           // world px per physical px
  vec3 col; float cov;

  if (type > 1.5) {
    // ---------------- trumpet en chamade, seen bell-on
    float R = vA.w * 0.5;
    vec2 p = vW - vA.xy;
    float r = length(p) / R;
    cov = sat(0.5 - (length(p) - R) / px);
    if (cov <= 0.0) discard;
    vec2 dir = p / max(length(p), 1e-4);
    // the flared rim, lit from the upper left, engraved in rings; inside, the dark funnel with a few
    // receding rings (offset down: the trumpets tilt up a little) to the throat
    float rim = smoothstep(0.8, 0.84, r);
    float litRim = sat(0.5 + 0.5 * dot(dir, normalize(vec2(-0.6, -0.8))));
    float ringsRim = hatchL(r * R / (lineK * 0.8), 0.08 + 0.6 * pow(litRim, 1.6));
    vec2 q = p / R;
    float ringsIn = 0.0;
    for (int i = 0; i < 3; i++) {
      float rr = i == 0 ? 0.6 : i == 1 ? 0.4 : 0.24;
      float dd = abs(length(q - vec2(0.0, 0.1 * (0.8 - rr))) - rr) * R / px;
      ringsIn = max(ringsIn, (0.25 + 0.15 * float(2 - i)) * pxLine(dd, 0.4, 1.1));
    }
    float ink = mix(ringsIn, ringsRim, rim);
    ink = max(ink, 0.85 * pxLine(abs(r - 1.0) * R / px, 0.5, 1.3));
    ink = max(ink, 0.6 * pxLine(abs(r - 0.82) * R / px, 0.4, 1.2));
    // wind: the throat glows toward the viewer
    float throat = exp(-pow(r / 0.2, 2.0)) * 1.8 + exp(-pow(r / 0.55, 2.0)) * 0.45;
    vec3 wind = (C_SIGNAL * (throat * 1.4) * gain + C_EMBER * exp(-pow(r / 0.09, 2.0)) * 1.6) * I * (1.0 - drain);
    wind += C_EMBER * F * exp(-pow(r / 0.35, 2.0)) * 1.2;
    vec3 gap = METAL * (0.5 + 1.5 * rim) + wind * (1.0 - rim * 0.85);
    col = mix(gap, BONEL * mix(0.55, 1.0, sat(I)), ink * (1.0 - 0.35 * (1.0 - rim) * sat(I)));
  } else {
    // ---------------- flue (open metal) or reed (conical resonator on a boot)
    float cx = vA.x, top = vA.y, toe = vA.z, w = vA.w, r = w * 0.5, mY = vB.x;
    float y = vW.y, xr = vW.x - cx;
    bool reed = type > 0.5;
    float hw;
    if (!reed) {
      hw = y <= mY ? r : mix(r, r * 0.3, sat((y - mY) / (toe - mY)));
    } else {
      if (y <= mY) hw = r * mix(1.0, 0.2, sat((y - top) / (mY - top)));
      else { float b = sat((y - mY) / (toe - mY)); hw = r * (b < 0.55 ? 0.34 : mix(0.34, 0.12, (b - 0.55) / 0.45)); }
    }
    float dSide = abs(xr) - hw;
    float d = max(dSide, max(top - y, y - toe));
    cov = sat(0.5 - d / px);
    if (cov <= 0.0) discard;
    float s = clamp(xr / hw, -1.0, 1.0);
    float nz = sqrt(max(0.0, 1.0 - s * s));
    float lam = sat(-0.62 * s + 0.78 * nz);                       // light from the upper left
    float spec = exp(-pow((s + 0.42) / 0.16, 2.0));
    // parallel lines (converging only along a cone), their width following the light: white-line engraving
    float u = s * r / lineK;
    float lw = 0.04 + 0.5 * pow(lam, 2.6) + 0.55 * spec;
    float ink = hatchL(u, lw) * (rk == 0 ? engr0 : 1.0);
    float leafInk = hatch(y / (lineK * 0.8), 0.22 + 0.25 * lam);  // (outside the branch: it takes derivatives)
    // the open top seen from below: the far rim is the silhouette, the near rim a curve under it
    float rimY = top + 0.075 * w * nz;
    bool inTop = y < rimY;
    // wind
    float v, filled, sw;
    if (!reed) {
      v = (mY - y) / max(mY - top, 1.0);
      sw = 0.5 + 0.5 * sin(PI * sat(v));
    } else {
      v = (mY - y) / max(mY - top, 1.0);
      sw = 0.55 + 0.45 * cos(1.5708 * sat(v));
    }
    float Hd = Hh * (1.0 - drain);
    filled = y > mY ? (1.0 - drain) : smoothstep(Hd + 0.015, Hd - 0.015, v);
    float pushV = push * (0.55 + 0.45 * sat(1.0 - v));
    // the wind is a column inside the pipe: the metal's edges stay dark
    float core = smoothstep(1.0, 0.35, abs(s));
    vec3 wind = windCol(I * filled * (1.0 + pushV) * core, sw, F * filled * core);
    vec3 gap = METAL * (0.7 + 0.9 * lam) + wind;
    if (!reed) {
      // mouth: an arched slot above the languid; the flattened upper lip (a pointed leaf) above it
      float mw = 0.6, mh = 0.15 * w;
      float yU = mY - mh - 0.06 * w * (1.0 - (s / mw) * (s / mw));
      bool inMouth = abs(s) < mw && y > yU && y < mY;
      float leafH = 0.95 * w;
      float lk = (mY - mh - y) / leafH;
      bool inLeaf = lk > 0.0 && lk < 1.0 && abs(s) < mw * (1.0 - lk);
      if (inLeaf) ink = leafInk;
      float leafEdge = (lk > 0.0 && lk < 1.0) ? abs(abs(s) - mw * (1.0 - lk)) * hw / px : 1e3;
      ink = max(ink, 0.8 * pxLine(leafEdge, 0.4, 1.2));
      if (inMouth) {
        float lip = exp(-pow((mY - y) / (0.35 * mh), 2.0));
        gap = METAL * 0.3 + (C_SIGNAL * 1.7 * gain + C_EMBER * (0.7 * lip + 0.2)) * I * (1.0 - drain) + C_EMBER * F * 1.2;
        ink = 0.0;
      }
      ink = max(ink, pxLine(abs(y - (mY + 0.04 * w * nz)) / px, 0.5, 1.2) * step(abs(s), 0.98));
      ink = max(ink, 0.9 * pxLine(abs(y - yU) / px, 0.4, 1.1) * step(abs(s), mw));
    } else {
      ink = max(ink, 0.9 * pxLine(abs(y - (mY + 0.03 * w * nz * 0.34)) / px, 0.5, 1.2));
      // the reed's wind leaves at the bell: the rim flares on each push
    }
    if (inTop) { gap = METAL * 0.4 + wind * 1.4 * (1.0 - drain); ink = 0.0; }
    ink = max(ink, pxLine(abs(y - rimY) / px, 0.5, 1.2) * step(abs(s), 0.99));
    // silhouette: brighter on the lit side
    float sil = rk == 0 ? mix(0.85, 0.18 + 0.42 * step(s, 0.0), engr0) : 0.18 + 0.42 * step(s, 0.0);
    ink = max(ink, sil * pxLine(abs(dSide) / px, 0.5, 1.2));
    // a silent rank is a dim engraving; a speaking one is lit by its own wind
    float litK = rk == 0 ? 1.0 : mix(0.5, 1.0, sat(I));
    col = mix(gap, BONEL * (0.85 + 0.15 * lam) * litK, ink);
  }
  col *= mix(0.38, 1.0, vB.w) * (1.0 - dim);
  float a = cov;
  if (reveal.z >= 0.0 && rk != 0) a *= smoothstep(reveal.z, reveal.z - 80.0, length(vW - reveal.xy));
  a *= show;
  fragColor = vec4(col * a, a);
}`;

export class PipeMesh {
  mesh: THREE.Mesh;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat: THREE.RawShaderMaterial;
  constructor(list: Pipe[]) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    const A = new Float32Array(list.length * 4), B = new Float32Array(list.length * 4);
    list.forEach((p, i) => {
      A.set([p.cx, p.top, p.toe, p.w], i * 4);
      B.set([p.mouth, p.type, p.rank, p.depth], i * 4);
    });
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
    g.instanceCount = list.length;
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: {
        cam: { value: new THREE.Vector4(960, 540, 1, 0) }, res: { value: new THREE.Vector2(1920, 1080) },
        rankI: { value: new Array(NRANK).fill(0) }, rankH: { value: new Array(NRANK).fill(0) },
        rankF: { value: new Array(NRANK).fill(0) }, rankShow: { value: new Array(NRANK).fill(1) },
        reveal: { value: new THREE.Vector3(0, 0, -1) }, push: { value: 0 }, t: { value: 0 },
        drain: { value: 0 }, dim: { value: 0 }, lineK: { value: 4.6 }, lodK: { value: 1 }, engr0: { value: 1 },
      },
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  get u() { return this.mat.uniforms; }
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(out);
    renderer.render(this.scene, this.cam);
  }
}

/** The ground: graphite, darker inside the case's pipe recesses, with a faint engraved hatch there. */
export function groundPass() {
  return new FSPass(/* glsl */ `
uniform vec4 cam; uniform vec3 reveal; uniform float dim; uniform vec4 recess[6]; uniform float lineK;
vec2 toWorld(vec2 sp) {
  vec2 d = sp - vec2(960.0, 540.0);
  float c = cos(-cam.w), s = sin(-cam.w);
  d = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  return d / cam.z + cam.xy;
}
void main() {
  vec2 sp = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  vec2 w = toWorld(sp);
  float yy = sp.y / 1080.0;
  vec3 g = mix(toLinear(vec3(0.052, 0.060, 0.059)), toLinear(vec3(0.078, 0.090, 0.087)), yy);
  // inside the case: darker recesses behind the pipes, engraved with a close horizontal hatch
  float inR = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 r = recess[i];
    vec2 q = abs(w - r.xy) - r.zw;
    inR = max(inR, 1.0 - smoothstep(-2.0, 2.0, max(q.x, q.y)));
  }
  float rv = reveal.z < 0.0 ? 1.0 : smoothstep(reveal.z, reveal.z - 120.0, length(w - reveal.xy));
  float h = hatch(w.y / (lineK * 0.85), 0.16) * 0.05;
  vec3 recessCol = toLinear(vec3(0.024, 0.028, 0.028)) + vec3(h);
  g = mix(g, recessCol, inR * rv);
  fragColor = vec4(g * (1.0 - dim), 1.0);
}`, {
    cam: { value: new THREE.Vector4(960, 540, 1, 0) }, reveal: { value: new THREE.Vector3(0, 0, -1) }, dim: { value: 0 },
    recess: { value: Array.from({ length: 6 }, () => new THREE.Vector4(-1e5, -1e5, 0, 0)) }, lineK: { value: 4.6 },
  });
}
