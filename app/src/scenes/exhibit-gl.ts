// inst (exhibit.ts): the hall's solid surfaces as a white-line engraving, one fullscreen pass.
// Every pixel casts its camera ray against the floor, the walls, the five plinths and the five light
// attics (analytic boxes, so they occlude the floor and each other correctly) and shades what it hits
// with parallel white lines whose width is the light there (black ground, lines cut where it is lit).
// The case lamps light the floor in a ring around each plinth (spill through the glass), a pool on the
// plinth top under the object, and a faint engraved haze in each hood: the beam, the only glow (blue).
import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import { NC, SP, PA, PH, HT, AT, LAMP_Y, CONE_T, WALL_Z, HALL, LABEL, lampP } from './exhibit-geo';

const f = (x: number) => x.toFixed(4);

const FRAG = /* glsl */ `
uniform vec3 camPos, camR, camU, camF;
uniform float focal;
uniform vec4 lamp[${NC}];     // xyz lamp, w = intensity
uniform float coneT[${NC}];   // tan(half-angle) per lamp (the empty case's iris closes it)
uniform float labL[${NC}];    // label light per case
uniform float amb, beamK, gain;

const float SPC = ${f(SP)}, PA = ${f(PA)}, PH = ${f(PH)}, HT = ${f(HT)}, AT = ${f(AT)}, LY = ${f(LAMP_Y)};
const float WZ = ${f(WALL_Z)}, X0 = ${f(HALL.x0)}, X1 = ${f(HALL.x1)}, Z1 = ${f(HALL.z1)}, Y1 = ${f(HALL.y1)};
const float CONE0 = ${f(CONE_T)};
const vec4 LAB = vec4(0.0, ${f(LABEL.v)}, ${f(LABEL.hw)}, ${f(LABEL.hh)});

float cx(int i) { return float(i) * SPC; }

void boxHit(vec3 ro, vec3 ird, vec3 rdS, vec3 bmin, vec3 bmax, int id, inout float tB, inout vec3 nB, inout int what) {
  vec3 t0 = (bmin - ro) * ird, t1 = (bmax - ro) * ird;
  vec3 tn3 = min(t0, t1), tf3 = max(t0, t1);
  float tn = max(max(tn3.x, tn3.y), tn3.z), tf = min(min(tf3.x, tf3.y), tf3.z);
  if (tn < tf && tn > 0.0 && tn < tB) {
    tB = tn; what = id;
    nB = tn == tn3.x ? vec3(-rdS.x, 0.0, 0.0) : tn == tn3.y ? vec3(0.0, -rdS.y, 0.0) : vec3(0.0, 0.0, -rdS.z);
  }
}

// light spilled through the glass onto things outside the hoods (walls, plinth sides)
float spill(vec3 p) {
  float s = 0.0;
  for (int i = 0; i < ${NC}; i++) {
    float L = lamp[i].w * min(1.0, coneT[i] / CONE0);
    if (L <= 0.0) continue;
    vec3 d = p - vec3(cx(i), 1.3, 0.0);
    s += L * 0.3 / (1.0 + dot(d, d) / 0.9);
  }
  return s;
}
// on the floor: a ring round each plinth (the plinth shadows the floor right under the glass)
float floorPool(vec2 q) {
  float s = 0.0;
  for (int i = 0; i < ${NC}; i++) {
    float L = lamp[i].w * min(1.0, coneT[i] / CONE0);
    if (L <= 0.0) continue;
    vec2 e = max(abs(q - vec2(cx(i), 0.0)) - PA, 0.0);
    float d = length(e);
    float ring = exp(-pow((d - 0.34) / 0.28, 2.0)) * 0.34 + exp(-d * d / 1.0) * 0.06;
    s += L * ring * smoothstep(0.0, 0.14, d);
  }
  return s;
}

void main() {
  vec2 px = FRAG_PX;
  vec3 rd = normalize(camF * focal + camR * (px.x - ${f(W / 2)}) + camU * (px.y - ${f(H / 2)}));
  rd += vec3(1e-6);
  vec3 ro = camPos;
  vec3 ird = 1.0 / rd, rdS = sign(rd);
  float tB = 1e9; vec3 nB = vec3(0.0, 1.0, 0.0); int what = 0;
  // the room: floor, ceiling, walls
  if (rd.y < 0.0) { float t = -ro.y / rd.y; if (t < tB) { tB = t; nB = vec3(0.0, 1.0, 0.0); what = 1; } }
  if (rd.y > 0.0) { float t = (Y1 - ro.y) / rd.y; if (t < tB) { tB = t; what = 5; } }
  if (rd.z < 0.0) { float t = (WZ - ro.z) / rd.z; if (t < tB) { tB = t; nB = vec3(0.0, 0.0, 1.0); what = 2; } }
  if (rd.z > 0.0) { float t = (Z1 - ro.z) / rd.z; if (t < tB) { tB = t; nB = vec3(0.0, 0.0, -1.0); what = 3; } }
  if (rd.x < 0.0) { float t = (X0 - ro.x) / rd.x; if (t < tB) { tB = t; nB = vec3(1.0, 0.0, 0.0); what = 3; } }
  if (rd.x > 0.0) { float t = (X1 - ro.x) / rd.x; if (t < tB) { tB = t; nB = vec3(-1.0, 0.0, 0.0); what = 3; } }
  // plinths (10 + i) and attics (20 + i)
  for (int i = 0; i < ${NC}; i++) {
    float x = cx(i);
    boxHit(ro, ird, rdS, vec3(x - PA, 0.0, -PA), vec3(x + PA, PH, PA), 10 + i, tB, nB, what);
    boxHit(ro, ird, rdS, vec3(x - PA, HT, -PA), vec3(x + PA, AT, PA), 20 + i, tB, nB, what);
  }
  vec3 p = ro + rd * tB;
  int ci = what >= 20 ? what - 20 : what >= 10 ? what - 10 : 0;
  float xc = cx(ci);

  // pick the engraving: lines along coordinate u, their width = the light there (up to wmax)
  float u = 0.0, lit = 0.0, inkK = 0.0, wmax = 0.4, panel = 0.0, joint = 0.0;
  if (what == 1) {
    lit = amb * 0.15 + floorPool(p.xz);
    u = p.z * 34.0;
    inkK = 0.27; wmax = 0.26;
    vec2 g = abs(fract(p.xz / 1.2 + 0.5) - 0.5) * 1.2;
    float dj = min(g.x, g.y);
    joint = pxLine(dj / max(fwidth(dj), 1e-5), 0.3, 1.2) * clamp(lit * 1.2, 0.0, 1.0);
  } else if (what == 2 || what == 3) {
    lit = amb * 0.2 + spill(p) * 0.24;
    u = (what == 2 ? p.x : p.x + p.z) * 26.0;
    inkK = 0.16; wmax = 0.24;
  } else if (what >= 10 && what < 20) {
    vec3 q = p - vec3(xc, 0.0, 0.0);
    float L = lamp[ci].w;
    if (nB.y > 0.5) {
      // the plinth top inside the hood: the lamp's pool
      float R = (LY - PH) * coneT[ci];
      float r = length(q.xz);
      lit = amb * 0.3 + L * (0.03 + 0.8 * smoothstep(R * 1.05, R * 0.45, r));
      u = r * 150.0; // the pool engraved in rings
      inkK = 0.42; wmax = 0.45;
    } else {
      lit = amb * 0.3 + spill(p) * 0.1 + L * 0.1 * smoothstep(0.72, 1.0, p.y) * min(1.0, coneT[ci] / CONE0);
      u = p.y * 95.0;
      inkK = 0.24; wmax = 0.3;
      // the label: a flat lit card, no hatching under the type
      if (nB.z > 0.5 && abs(q.x - LAB.x) < LAB.z && abs(p.y - LAB.y) < LAB.w) { panel = labL[ci] * 0.05; lit = 0.0; }
    }
  } else if (what >= 20) {
    vec3 q = p - vec3(xc, 0.0, 0.0);
    float L = lamp[ci].w;
    if (nB.y < -0.5) { lit = L * 0.5 * exp(-dot(q.xz, q.xz) / 0.012); u = q.x * 110.0; }
    else { lit = amb * 0.3 + spill(p) * 0.08; u = p.y * 110.0; }
    inkK = 0.3; wmax = 0.34;
  }
  // white lines: none in the dark (hatch() keeps a hairline at zero), thicker where it is lit
  float ink = hatch(u, clamp(lit * 1.2, 0.0, wmax)) * smoothstep(0.006, 0.1, lit);
  float fade = exp(-max(tB - 5.0, 0.0) / 7.0);
  vec3 col = C_BONE * (inkK * ink + 0.3 * joint) * fade + C_BONE * panel;

  // beams: a billboard through each lamp's axis, facing the camera; horizontal engraved lines
  for (int i = 0; i < ${NC}; i++) {
    float L = lamp[i].w;
    if (L <= 0.0) continue;
    vec3 lp = lamp[i].xyz;
    vec3 nb = vec3(ro.x - lp.x, 0.0, ro.z - lp.z);
    float ln = max(length(nb), 1e-4); nb /= ln;
    float den = dot(rd, nb);
    float tb = dot(lp - ro, nb) / (abs(den) < 1e-5 ? 1e-5 : den);
    vec3 q = ro + rd * tb;
    float h = lp.y - q.y, hMax = lp.y - PH;
    vec3 side = vec3(-nb.z, 0.0, nb.x);
    float r = abs(dot(q - lp, side));
    float Rb = h * coneT[i] + 0.003;
    float x = r / Rb;
    float m = (tb > 0.0 && tb < tB && h > 0.0 && h < hMax && x < 1.0) ? 1.0 : 0.0;
    float dens = m * sqrt(max(1.0 - x * x, 0.0)) * smoothstep(0.0, 0.08, h) * smoothstep(0.0, 0.06, hMax - h) * mix(0.25, 1.0, pow(clamp(h / hMax, 0.0, 1.0), 1.5));
    float lines = hatch(q.y * 170.0, dens * 0.22) * smoothstep(0.0, 0.1, dens);
    // a narrowing beam concentrates its light
    float conc = clamp(CONE0 / max(coneT[i], 0.02), 1.0, 4.0);
    col += mix(C_SIGNAL, C_EMBER, 0.25) * L * beamK * conc * (0.55 * lines + 0.022 * dens);
  }
  fragColor = vec4(col * gain, 1.0);
}`;

export class HallPass {
  pass: FSPass;
  constructor() {
    this.pass = new FSPass(FRAG, {
      camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() }, camU: { value: new THREE.Vector3() }, camF: { value: new THREE.Vector3() },
      focal: { value: 1100 },
      lamp: { value: Array.from({ length: NC }, (_, i) => new THREE.Vector4(...lampP(i), 0)) },
      coneT: { value: new Array(NC).fill(CONE_T) },
      labL: { value: new Array(NC).fill(0) },
      amb: { value: 0 }, beamK: { value: 1 }, gain: { value: 1 },
    });
  }
  set(cam: { p: number[]; R: number[]; U: number[]; F: number[]; f: number }, L: number[], cone: number[], lab: number[], amb: number, beamK = 1, gain = 1) {
    const u = this.pass.u;
    (u.camPos!.value as THREE.Vector3).set(cam.p[0]!, cam.p[1]!, cam.p[2]!);
    (u.camR!.value as THREE.Vector3).set(cam.R[0]!, cam.R[1]!, cam.R[2]!);
    (u.camU!.value as THREE.Vector3).set(cam.U[0]!, cam.U[1]!, cam.U[2]!);
    (u.camF!.value as THREE.Vector3).set(cam.F[0]!, cam.F[1]!, cam.F[2]!);
    u.focal!.value = cam.f;
    const lv = u.lamp!.value as THREE.Vector4[];
    for (let i = 0; i < NC; i++) lv[i]!.w = L[i]!;
    u.coneT!.value = cone.slice();
    u.labL!.value = lab.slice();
    u.amb!.value = amb; u.beamK!.value = beamK; u.gain!.value = gain;
  }
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget) { this.pass.render(renderer, out); }
}
