// verseA (patent.ts) GL passes, ported from P(doom)'s bureau (bdbad53 bureau.ts): the procedural
// paper that composites the channel-coded ink layer (R = typewriter ink, G = printed/drawn ink,
// B = the blue), rubber-stamp texture inside the two stamps, directional motion blur for the whip,
// and the tear pass that rips the rendered page in two. Ours adds the only light on the page: the dot
// (the leader's end point on Fig. 1) and, for the first frames, the drop's line still hot.
import * as THREE from 'three';
import { FSPass } from '../engine/gl';

const PAPER_FRAG = /* glsl */ `
uniform sampler2D inkTex;
uniform vec3 camA; uniform vec3 camB;     // screen px (y down) -> page px
uniform vec2 blurV;                        // motion blur (screen px)
uniform vec4 st0; uniform vec4 st0b;       // stamp 0 (blue): centre.xy, half.xy | angle, strength, seed, -
uniform vec4 st1; uniform vec4 st1b;       // stamp 1 (ink)
uniform float zoom;
uniform vec4 dotP;                         // the dot: screen x, y (px, y down), radius (px), intensity
uniform vec3 hotL;                         // the relay line: screen y (px, y down), glow, half-length (px)

float fibres(vec2 p, float cs) {
  float acc = 0.0;
  vec2 cell = floor(p / cs);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(float(i), float(j));
    vec2 h = hash22(c);
    vec2 o = (c + h) * cs;
    float a = hash12(c + 7.1) * TAU;
    float L = cs * (0.3 + 1.1 * hash12(c + 3.3));
    vec2 d = vec2(cos(a), sin(a));
    float dist = sdSegment(p, o - d * L * 0.5, o + d * L * 0.5);
    float s = hash12(c + 9.9) - 0.5;
    acc += s * (1.0 - smoothstep(0.25, 0.9 + 0.4 / zoom, dist));
  }
  return acc;
}

float stampMask(vec2 p, vec4 s, vec4 sb) {
  if (sb.y <= 0.0) return 0.0;
  vec2 q = rot2(-sb.x) * (p - s.xy);
  vec2 d = abs(q) - s.zw;
  return (d.x < 0.0 && d.y < 0.0) ? 1.0 : 0.0;
}
// rubber-stamp ink: voids, mottling, heavier near shape edges
float stampInk(vec2 p, float cov, float edge, float seed, float strength) {
  float n = snoise(p * 0.07 + seed) * 0.45 + snoise(p * 0.23 + seed * 2.0) * 0.35 + snoise(p * 0.9 - seed) * 0.2;
  float press = smoothstep(-0.9, 0.3, snoise(p * 0.0045 + seed * 3.0));
  float voids = smoothstep(-0.58, -0.36, n + (strength - 1.0) * 0.8 + 0.25 * press);
  float mott = 0.72 + 0.28 * press;
  return sat(cov * voids * mott * 1.25 + edge * 0.5);
}

void main() {
  vec2 sp = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  vec2 pp = vec2(dot(camA, vec3(sp, 1.0)), dot(camB, vec3(sp, 1.0)));

  // ---- paper
  float cloud = fbm(pp * 0.0021, 4);
  float mid = snoise(pp * 0.018);
  float fib = fibres(pp, 22.0) + 0.6 * fibres(pp * 1.7 + 31.0, 22.0);
  float speck = step(0.99965, hash12(floor(pp * 0.5))) * (1.0 - smoothstep(1.8, 2.6, zoom)); // not magnified into squares
  vec3 paper = C_BONE * (0.965 + 0.028 * cloud + 0.008 * mid + 0.05 * fib);
  paper *= 1.0 - speck * 0.35;
  paper *= 0.97 + 0.03 * (1.0 - vUv.y * 0.6 - vUv.x * 0.4);   // gentle raking light

  // ---- inks (with optional motion blur along blurV)
  vec4 ink = vec4(0.0);
  float bl = length(blurV);
  if (bl > 1.0) {
    const int N = 32;
    float j = hash12(sp);
    for (int i = 0; i < N; i++) {
      float k = (float(i) + j) / float(N) - 0.5;
      ink += texture(inkTex, vUv + vec2(blurV.x, -blurV.y) * k / vec2(1920.0, 1080.0));
    }
    ink /= float(N);
  } else ink = texture(inkTex, vUv);

  float sm0 = stampMask(pp, st0, st0b), sm1 = stampMask(pp, st1, st1b);
  float edgeB = 0.0, edgeG = 0.0;
  if (sm0 + sm1 > 0.0) {
    vec2 px = vec2(3.0) / vec2(1920.0, 1080.0);
    vec4 blur4 = (texture(inkTex, vUv + vec2(px.x, 0.0)) + texture(inkTex, vUv - vec2(px.x, 0.0)) + texture(inkTex, vUv + vec2(0.0, px.y)) + texture(inkTex, vUv - vec2(0.0, px.y))) * 0.25;
    edgeB = sat((ink.b - blur4.b) * 2.0);
    edgeG = sat((ink.g - blur4.g) * 2.0);
  }
  float dType = ink.r * (0.86 + 0.14 * smoothstep(-0.5, 0.6, snoise(pp * 0.35))) * (1.0 - 0.18 * sat(fib * 4.0));
  float dPrint = ink.g;
  float dBlue = ink.b * (0.92 + 0.08 * snoise(pp * 0.25));
  if (sm0 > 0.0) dBlue = stampInk(pp, ink.b, edgeB, st0b.z, st0b.y);
  if (sm1 > 0.0) dPrint = stampInk(pp, ink.g, edgeG, st1b.z, st1b.y) * 0.94;

  // Beer-Lambert overprint: transmission^density
  vec3 col = paper;
  vec3 tBlue = clamp(C_SIGNAL / C_BONE, 0.004, 1.0);
  vec3 tInk = clamp(vec3(0.012, 0.012, 0.013) / C_BONE, 0.004, 1.0);
  vec3 tType = clamp(vec3(0.02, 0.019, 0.021) / C_BONE, 0.004, 1.0);
  col *= pow(tBlue, vec3(sat(dBlue)));
  col *= pow(tInk, vec3(sat(dPrint)));
  col *= pow(tType, vec3(sat(dType)));

  // slight vignette on the sheet
  vec2 dc = vUv - 0.5;
  col *= 1.0 - 0.14 * pow(length(dc * vec2(1.0, 0.85)) * 1.5, 2.6);

  // ---- the only light on the page: the dot, and (first frames) the drop's line still hot
  if (dotP.w > 0.0) {
    float d = length(sp - dotP.xy), R = max(dotP.z, 1.0);
    col += C_SIGNAL * dotP.w * (1.6 * exp(-d * d / (R * R * 1.2)) + 0.3 * exp(-d / (R * 2.2)));
    col += C_EMBER * dotP.w * 3.0 * exp(-d * d / (R * R * 0.14));
  }
  if (hotL.y > 0.0) {
    float dy = abs(sp.y - hotL.x);
    float xin = 1.0 - smoothstep(hotL.z - 60.0, hotL.z, abs(sp.x - 960.0));
    col += (C_SIGNAL * 1.1 * exp(-dy * dy / 5.0) + C_SIGNAL * 0.08 * exp(-dy / 9.0) + C_EMBER * 0.35 * exp(-dy * dy / 0.6)) * hotL.y * xin;
  }
  fragColor = vec4(col, 1.0);
}`;

const TEAR_FRAG = /* glsl */ `
uniform sampler2D page;
uniform vec3 inv0a; uniform vec3 inv0b;   // piece 0: screen -> original screen
uniform vec3 inv1a; uniform vec3 inv1b;
uniform float tear;        // 0 = intact
uniform float tipY;        // how far down the rip has propagated (original px)
uniform vec2 shade;        // per-piece light multiplier
uniform float blackout;

float tearX(float y) {
  return 1000.0 + (y - 540.0) * -0.26 + 52.0 * snoise(vec2(y * 0.0032, 3.1)) + 16.0 * snoise(vec2(y * 0.017, 7.7)) + 4.0 * snoise(vec2(y * 0.07, 1.3));
}
vec4 piece(vec2 sp, vec3 ia, vec3 ib, float side, float sh) {
  vec2 q = vec2(dot(ia, vec3(sp, 1.0)), dot(ib, vec3(sp, 1.0)));
  if (q.x < -2.0 || q.x > 1922.0 || q.y < -2.0 || q.y > 1082.0) return vec4(0.0);
  float torn = q.y < tipY ? 1.0 : 0.0;
  float d = (q.x - tearX(q.y)) * side;
  float fuzz = 1.6 * snoise(vec2(q.y * 0.45, side * 5.0)) + 1.2 * snoise(vec2(q.y * 1.7, side * 9.0));
  fuzz += 5.0 * pow(sat(snoise(vec2(q.y * 0.9, side * 13.0))), 6.0);
  float edge = d + fuzz * torn;
  float inside = torn > 0.5 ? smoothstep(-0.7, 0.7, edge) : 1.0;
  float bx = min(min(q.x, 1920.0 - q.x), min(q.y, 1080.0 - q.y));
  inside *= smoothstep(-0.7, 0.7, bx);
  if (inside <= 0.0 || (torn < 0.5 && d < 0.0)) return vec4(0.0);
  vec3 c = texture(page, vec2(q.x / 1920.0, 1.0 - q.y / 1080.0)).rgb * sh;
  float bw = (side > 0.0 ? 5.5 : 2.2) * (0.6 + 0.8 * sat(0.5 + 0.5 * snoise(vec2(q.y * 0.05, side))));
  float band = (1.0 - smoothstep(0.0, bw, edge)) * torn;
  c = mix(c, C_BONE * 1.03, band * 0.9);
  c *= 1.0 - 0.12 * (1.0 - smoothstep(bw, bw + 5.0, edge)) * torn;
  return vec4(c, inside);
}
void main() {
  vec2 sp = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  if (tear <= 0.0) { fragColor = vec4(texture(page, vUv).rgb * (1.0 - blackout), 1.0); return; }
  vec3 col = C_INK * 0.4;
  vec4 a = piece(sp, inv0a, inv0b, -1.0, shade.x);
  col = mix(col, a.rgb, a.a);
  vec4 b = piece(sp, inv1a, inv1b, 1.0, shade.y);
  col = mix(col, b.rgb, b.a);
  fragColor = vec4(col * (1.0 - blackout), 1.0);
}`;

export function paperPass() {
  return new FSPass(PAPER_FRAG, {
    inkTex: { value: null }, camA: { value: new THREE.Vector3() }, camB: { value: new THREE.Vector3() },
    blurV: { value: new THREE.Vector2() }, zoom: { value: 1 },
    st0: { value: new THREE.Vector4() }, st0b: { value: new THREE.Vector4() },
    st1: { value: new THREE.Vector4() }, st1b: { value: new THREE.Vector4() },
    dotP: { value: new THREE.Vector4() }, hotL: { value: new THREE.Vector3() },
  });
}

export function tearPass() {
  return new FSPass(TEAR_FRAG, {
    page: { value: null }, inv0a: { value: new THREE.Vector3(1, 0, 0) }, inv0b: { value: new THREE.Vector3(0, 1, 0) },
    inv1a: { value: new THREE.Vector3(1, 0, 0) }, inv1b: { value: new THREE.Vector3(0, 1, 0) },
    tear: { value: 0 }, tipY: { value: 0 }, shade: { value: new THREE.Vector2(1, 1) }, blackout: { value: 0 },
  });
}
