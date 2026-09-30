// Shaders for mate.ts: the ground behind the connector datasheet, per variant, and the UI composite.
//   1 (chatgpt): the receptacle's bore seen end-on: keying rings (with the five keyways of a real
//      keying position) and a fine coupling-thread helix, receding to a blue contact at the bottom;
//      the camera is pulled in, accelerating; on ⏎ the rings rush and the blue swallows the frame.
//   2 (gato): black, a faint pool of light and a few slow motes.
//   3 (sydney): the sheet's grid; two section-hatched housing walls close one notch per beat and slam
//      shut to black.
import { W, H } from '../engine/gl';

/** UI layer over the ground; only blue (b well above r) glows. Optional zoom blur toward a point. */
const UI_OVER = /* glsl */ `
uniform sampler2D ui; uniform float hotBoost; uniform float uiAlpha; uniform float zoomBlur; uniform vec2 zbCenter;
vec3 overUI(vec3 col, vec2 uv) {
  vec4 u = texture(ui, uv);
  if (zoomBlur > 0.0) {
    vec4 acc = u; float wsum = 1.0;
    for (int i = 1; i < 8; i++) { float k = float(i) / 7.0; vec4 s = texture(ui, mix(uv, zbCenter, k * zoomBlur)); acc += s * (1.0 - k * 0.6); wsum += 1.0 - k * 0.6; }
    u = acc / wsum;
    u.rgb /= max(u.a, 1e-3);
  }
  float hot = smoothstep(0.25, 0.7, u.b - u.r * 1.3);
  vec3 c = u.rgb * (1.0 + hotBoost * hot);
  return mix(col, c, u.a * uiAlpha);
}`;

/** Logical px, y down (the Canvas2D convention). */
const PX = /* glsl */ `
vec2 pxDown() { vec2 p = FRAG_PX; return vec2(p.x, ${H}.0 - p.y); }
/** Sheet (UI) coordinates of a screen point under the camera (cx, cy, zoom, rot). */
vec2 toSheet(vec2 s, vec4 cam) {
  vec2 d = s - vec2(${W / 2}.0, ${H / 2}.0);
  float c = cos(cam.w), sn = sin(cam.w);
  return vec2(c * d.x + sn * d.y, -sn * d.x + c * d.y) / cam.z + cam.xy;
}
/** The engineering grid (60 / 240 sheet px), hairlines of constant screen width. */
float sheetGrid(vec2 ui, float zoom) {
  vec2 gm = abs(fract(ui / 60.0 + 0.5) - 0.5) * 60.0 * zoom;
  vec2 gM = abs(fract(ui / 240.0 + 0.5) - 0.5) * 240.0 * zoom;
  return 0.35 * pxLine(min(gm.x, gm.y), 0.1, 0.9) + pxLine(min(gM.x, gM.y), 0.3, 1.2);
}`;

export const SHADERS: Record<number, string> = {
  1: /* glsl */ `
uniform float t, camZ, glow, rot, rush, wave, beat, reveal, blue, disc;
uniform vec2 vp, dotPx;
${UI_OVER}
${PX}
float hairlines(float v, float wpx) {
  float fw = max(fwidth(v), 1e-5) * PX_SCALE;
  float sp = 1.0 / fw;
  float d = abs(fract(v + 0.5) - 0.5) * sp * PX_SCALE;
  float l = pxLine(d, wpx * 0.5 - 0.6, wpx * 0.5 + 0.6);
  float avg = min(1.0, wpx / sp) * 0.8;
  return mix(avg, l, smoothstep(2.2, 4.5, sp));
}
void main() {
  vec2 s = pxDown();
  vec2 p = (FRAG_PX - vec2(${W / 2}.0, ${H / 2}.0)) / ${H}.0;
  vec2 q = rot2(rot) * (p - vp);
  float r = length(q);
  float a = atan(q.x, q.y);                       // 0 = up
  // keyways (keying position A: master at 0°, minors at 105°, 140°, 215°, 265°)
  float key = 0.0, kd = 1e3;
  for (int i = 0; i < 5; i++) {
    float ak = i == 0 ? 0.0 : i == 1 ? 1.8326 : i == 2 ? 2.4435 : i == 3 ? 3.7525 : 4.6251;
    float w = i == 0 ? 0.085 : 0.055;
    float da = abs(mod(a - ak + PI, TAU) - PI);
    key = max(key, 1.0 - smoothstep(w - 0.003, w + 0.003, da));
    kd = min(kd, abs(da - w));
  }
  float R = r / (1.0 + 0.05 * key);             // the groove is cut deeper: its rings step outward
  float z = 0.5 / max(R, 1e-4);
  float wz = mix(14.0, 0.2, sat(wave / 1.1));      // a contraction wave travelling at the camera
  float wv = exp(-pow(z - wz, 2.0) * 0.5) * (1.0 - smoothstep(1.1, 1.6, wave));
  z *= 1.0 - 0.14 * wv;
  float u = z * 2.3 + camZ;
  float fog = exp(-z * 0.14) * smoothstep(0.012, 0.05, r);
  float major = hairlines(u, 1.2 + 0.8 * step(3.0, mod(floor(u + 0.5), 4.0)));
  float helix = hairlines(u * 3.0 + a / TAU, 0.6) * (1.0 - key);
  float edge = pxLine(kd * r * ${H}.0, 0.2, 1.0) * smoothstep(0.03, 0.12, r) * (1.0 - smoothstep(0.35, 0.8, r));
  // centre lines through the bore (dash-dot along the radius)
  float cl = min(abs(q.x), abs(q.y)) * ${H}.0;
  float ph = fract(r * 7.0 - camZ * 0.3);
  float dashDot = max(step(ph, 0.62), step(0.74, ph) * step(ph, 0.8));
  float centre = pxLine(cl, 0.2, 1.0) * dashDot * smoothstep(0.06, 0.2, r);
  float mask = 1.0 - smoothstep(reveal - 140.0, reveal, distance(s, dotPx));
  vec3 col = toLinear(vec3(0.047, 0.055, 0.055)) * (1.15 - 0.5 * sat(r));
  vec3 ink = C_BONE * (0.26 * major + 0.07 * helix + 0.12 * edge) * fog * (1.0 + 0.6 * beat + 1.2 * wv);
  col += (ink + C_BONE * 0.07 * centre) * mask;
  // speed streaks on the rush
  col += C_BONE * 0.28 * rush * rush * hatch(a / TAU * 110.0, 0.16) * smoothstep(0.08, 0.5, r) * mask;
  // the contact at the bottom of the bore: the one blue
  float g = exp(-r * mix(16.0, 1.6, sat(rush * rush))) * glow;
  col = mix(col, col * 0.35, smoothstep(0.2, 0.0, r) * 0.6);
  col += (C_SIGNAL * g * 1.4 + C_EMBER * 0.25 * g * g) * mask;
  col = overUI(col, vUv);
  // the blue swallows the frame: a disc from the bore's centre, then flat
  float dr = length((s - dotPx) / ${H}.0);
  float din = (1.0 - smoothstep(disc - 0.004, disc + 0.004, dr)) * step(0.001, disc);
  col += C_EMBER * 0.6 * pxLine(abs(dr - disc) * ${H}.0, 1.0, 2.5) * step(0.001, disc) * (1.0 - blue);
  col = mix(col, C_SIGNAL, din);
  col = mix(col, C_SIGNAL, blue);
  fragColor = vec4(col, 1.0);
}`,
  2: /* glsl */ `
uniform float t, glow, beat;
${UI_OVER}
void main() {
  vec2 p = (vUv - 0.5) * vec2(${W / H}, 1.0);
  vec3 col = C_INK;
  col += C_ASH * 0.03 * glow * exp(-dot(p * vec2(0.8, 1.6), p * vec2(0.8, 1.6)) * 4.0);
  vec2 g = p * 18.0 + vec2(0.0, -t * 0.12);
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 h = hash22(id);
  vec2 o = (h - 0.5) * 0.7 + 0.08 * vec2(sin(t * 0.3 + h.x * 6.0), cos(t * 0.23 + h.y * 6.0));
  float d = length(f - o);
  float on = step(0.88, hash12(id + 7.0));
  col += C_BONE * on * 0.14 * smoothstep(0.035, 0.0, d) * glow;
  col = overUI(col, vUv);
  fragColor = vec4(col, 1.0);
}`,
  3: /* glsl */ `
uniform float t, gap, wallCy, shut, light, beat, reveal, notch;
uniform vec4 cam;
uniform vec2 dotPx;
${UI_OVER}
${PX}
void main() {
  vec2 s = pxDown();
  float y = s.y / ${H}.0;
  vec3 col = mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.094, 0.106, 0.102)), y);
  float mask = 1.0 - smoothstep(reveal - 140.0, reveal, distance(s, dotPx));
  col += toLinear(vec3(0.16, 0.18, 0.17)) * 0.3 * sheetGrid(toSheet(s, cam), cam.z) * mask;
  col = overUI(col, vUv);
  // the housing walls: inner edges with ratchet teeth, one notch per beat
  float pitch = 26.0, depth = 9.0 * (1.0 - shut);
  float saw = fract((s.x - ${W / 2}.0) / pitch);
  float eTop = wallCy - gap + depth * (1.0 - saw);
  float eBot = wallCy + gap - depth * saw;
  float inTop = aaFill(s.y - eTop);
  float inBot = aaFill(eBot - s.y);
  float wall = max(inTop, inBot);
  // cast shadow on the sheet
  float sh = (1.0 - smoothstep(0.0, 46.0, s.y - eTop)) * step(eTop, s.y) + (1.0 - smoothstep(0.0, 46.0, eBot - s.y)) * step(s.y, eBot);
  col *= 1.0 - 0.55 * sat(sh) * (1.0 - wall);
  // section hatch (45°), bone on dark graphite; the edge a heavier line
  float hl = hatch((s.x + s.y) / 12.0, 0.16);
  float ed = min(abs(s.y - eTop), abs(s.y - eBot));
  float edge = pxLine(ed, 1.0, 2.2);
  vec3 wc = toLinear(vec3(0.07, 0.08, 0.078)) + C_BONE * (0.13 * hl + 0.45 * edge) * (1.0 + 0.8 * light);
  wc += C_SIGNAL * 0.5 * edge * notch;
  wc *= 1.0 - shut;
  col = mix(col, wc, wall);
  col = mix(col, C_INK, step(0.999, shut));
  fragColor = vec4(col, 1.0);
}`,
};
