// preach (organ.ts), Canvas2D: everything with a face or a word on it, drawn over the GL pipes in the
// organ's world px through the camera: the case woodwork (engraved bone lines on graphite), the
// console with its two stop jambs (drawknobs: a turned head with a porcelain face engraved with the
// stop's name; a pulled knob comes toward the viewer and shows its shank), the hymn board (cards
// slotted by hand onto seven ledges: the value's number, its unit, the sung line letter by letter,
// the slot being filled marked in blue), the two manuals and the blower's plate.
import { W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Word } from '../engine/lyrics';
import { clamp, ease, hash, lerp, TAU } from '../engine/util';
import {
  CX, FLAT, IMPOST, CORNICE, PEDAL, SIDE, MIXT, UPPER, CROWN, CONSOLE, BOARD, ROW, rowY, JAMB, KNOB_R, VP,
  MANUALS, BLOWER, knobs, type Knob,
} from './organ-geo';

export interface Cam { x: number; y: number; z: number; r: number }
type C2 = CanvasRenderingContext2D;

export function applyCam(c: C2, cam: Cam) {
  c.translate(W / 2, H / 2);
  c.rotate(cam.r);
  c.scale(cam.z, cam.z);
  c.translate(-cam.x, -cam.y);
}
export function w2s(cam: Cam, x: number, y: number) {
  const dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z;
  const cs = Math.cos(cam.r), sn = Math.sin(cam.r);
  return { x: W / 2 + cs * dx - sn * dy, y: H / 2 + sn * dx + cs * dy };
}
/** The camera's view in world px (with the roll's corners) plus a margin. */
export function viewRect(cam: Cam, m = 40) {
  const cs = Math.abs(Math.cos(cam.r)), sn = Math.abs(Math.sin(cam.r));
  const hx = ((W / 2) * cs + (H / 2) * sn) / cam.z + m, hy = ((W / 2) * sn + (H / 2) * cs) / cam.z + m;
  return { x0: cam.x - hx, x1: cam.x + hx, y0: cam.y - hy, y1: cam.y + hy };
}
type View = ReturnType<typeof viewRect>;
const vis = (v: View, x0: number, y0: number, x1: number, y1: number) => x1 > v.x0 && x0 < v.x1 && y1 > v.y0 && y0 < v.y1;

// palette (sRGB for Canvas2D): graphite woods, bone lines, the one blue
const WOOD = '#15181A';
const WOOD2 = '#101314';
const DARK = '#07090A';
const CARD = '#DCD6CA';
const INK = '#0D0E0F';
const BLUE = '#2F5BFF';

// ------------------------------------------------------------------ engraving helpers
/** Parallel hatch lines inside a rect (world px), clipped. `a` bone alpha. */
function hatchRect(c: C2, x0: number, y0: number, x1: number, y1: number, step: number, a: number, lw: number, dir: 'h' | 'v' | 'd' = 'h') {
  c.save();
  c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  c.beginPath();
  if (dir === 'h') for (let y = y0 + step / 2; y < y1; y += step) { c.moveTo(x0, y); c.lineTo(x1, y); }
  else if (dir === 'v') for (let x = x0 + step / 2; x < x1; x += step) { c.moveTo(x, y0); c.lineTo(x, y1); }
  else { const hgt = y1 - y0; for (let x = x0 - hgt; x < x1; x += step) { c.moveTo(x, y1); c.lineTo(x + hgt, y0); } }
  c.strokeStyle = rgba('bone', a); c.lineWidth = lw; c.stroke();
  c.restore();
}
/** A horizontal moulding: a band with fillets (lines) and a hatched cove. Profile values are y offsets. */
function moulding(c: C2, x0: number, x1: number, y0: number, y1: number, px: number, strong = 1) {
  const h = y1 - y0;
  c.fillStyle = WOOD; c.fillRect(x0, y0, x1 - x0, h);
  // the cove in shadow: a close hatch in the lower half
  hatchRect(c, x0, y0 + h * 0.45, x1, y0 + h * 0.8, Math.max(2.2, 2.2 * px), 0.16 * strong, Math.max(0.6 * px, 0.5));
  c.beginPath();
  for (const k of [0, 0.12, 0.3, 0.45, 0.8, 1]) { const y = y0 + h * k; c.moveTo(x0, y); c.lineTo(x1, y); }
  c.strokeStyle = rgba('bone', 0.5 * strong); c.lineWidth = Math.max(1.0 * px, 0.8); c.stroke();
  c.beginPath(); c.moveTo(x0, y0 + h * 0.12 + 1.2); c.lineTo(x1, y0 + h * 0.12 + 1.2);
  c.strokeStyle = rgba('bone', 0.22 * strong); c.lineWidth = Math.max(0.8 * px, 0.6); c.stroke();
}
/** A vertical post: fill, outline, the lit face hatched on its left. */
function post(c: C2, x0: number, x1: number, y0: number, y1: number, px: number) {
  c.fillStyle = WOOD; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  hatchRect(c, x0 + (x1 - x0) * 0.55, y0, x1, y1, Math.max(2.4, 2.4 * px), 0.14, Math.max(0.6 * px, 0.5), 'v');
  c.beginPath();
  c.moveTo(x0, y0); c.lineTo(x0, y1); c.moveTo(x1, y0); c.lineTo(x1, y1);
  c.moveTo(x0 + 5, y0); c.lineTo(x0 + 5, y1);
  c.strokeStyle = rgba('bone', 0.45); c.lineWidth = Math.max(1.0 * px, 0.8); c.stroke();
}

// ------------------------------------------------------------------ the case
export function drawCase(c: C2, v: View, z: number) {
  const px = 1 / z;
  // impost: the ledge every pipe stands on
  if (vis(v, -300, IMPOST.y0, 2 * CX + 300, IMPOST.y1)) moulding(c, -262, 2 * CX + 262, IMPOST.y0, IMPOST.y1, px, 1.1);
  // pedal towers: a cornice and a stepped cap with a ball finial; a corbel under the impost
  for (const cx of [PEDAL.cxL, PEDAL.cxR]) {
    const hw = PEDAL.rad + 34;
    if (vis(v, cx - hw - 20, -330, cx + hw + 20, -150)) {
      moulding(c, cx - hw, cx + hw, -214, -168, px, 1.05);
      moulding(c, cx - hw + 26, cx + hw - 26, -238, -214, px, 0.8);
      // the cap: a flattened dome, engraved with meridians
      c.save();
      c.beginPath(); c.ellipse(cx, -238, hw - 40, 56, 0, Math.PI, TAU); c.closePath();
      c.fillStyle = WOOD2; c.fill();
      c.clip();
      c.beginPath();
      for (let k = -6; k <= 6; k++) { const xx = cx + (hw - 40) * Math.sin((k / 7) * 1.4); c.moveTo(xx, -238); c.quadraticCurveTo(cx + (xx - cx) * 0.6, -280, cx, -296); }
      c.strokeStyle = rgba('bone', 0.2); c.lineWidth = Math.max(0.7 * px, 0.6); c.stroke();
      c.restore();
      c.beginPath(); c.ellipse(cx, -238, hw - 40, 56, 0, Math.PI, TAU);
      c.strokeStyle = rgba('bone', 0.5); c.lineWidth = Math.max(1.1 * px, 0.8); c.stroke();
      c.beginPath(); c.arc(cx, -306, 11, 0, TAU); c.fillStyle = WOOD; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(cx, -295); c.lineTo(cx, -292); c.stroke();
    }
  }
  // posts between the compartments
  const posts: [number, number, number, number][] = [
    [64, 94, -168, IMPOST.y0], [2 * CX - 94, 2 * CX - 64, -168, IMPOST.y0],
    [316, 346, CROWN.y1, IMPOST.y0], [2 * CX - 346, 2 * CX - 316, CROWN.y1, IMPOST.y0],
  ];
  for (const [x0, x1, y0, y1] of posts) if (vis(v, x0, y0, x1, y1)) post(c, x0, x1, y0, y1, px);
  // side compartments: the cornice over the trumpets, the one over the mixtures, the mixture shelves
  for (const s of [0, 1]) {
    const x0 = s === 0 ? 64 : 2 * CX - 346, x1 = s === 0 ? 346 : 2 * CX - 64;
    if (vis(v, x0, 100, x1, 380)) {
      moulding(c, x0, x1, 340, 362, px, 0.9);
      moulding(c, x0 - 10, x1 + 10, MIXT.top - 30, MIXT.top, px, 0.9);
      c.beginPath();
      for (const sy of MIXT.shelf) { c.moveTo(SIDE.x0 - 4 + (s ? 2 * CX - SIDE.x1 - SIDE.x0 : 0), sy + 1); c.lineTo(SIDE.x1 + 4 + (s ? 2 * CX - SIDE.x1 - SIDE.x0 : 0), sy + 1); }
      c.strokeStyle = rgba('bone', 0.4); c.lineWidth = Math.max(1.4 * px, 1); c.stroke();
    }
    // a pointed gable over each side compartment
    if (vis(v, x0, -60, x1, MIXT.top)) {
      const mx = (x0 + x1) / 2, yb = MIXT.top - 30;
      c.beginPath(); c.moveTo(x0 - 10, yb); c.lineTo(mx, yb - 92); c.lineTo(x1 + 10, yb); c.closePath();
      c.fillStyle = WOOD2; c.fill();
      c.strokeStyle = rgba('bone', 0.45); c.lineWidth = Math.max(1 * px, 0.8); c.stroke();
      c.beginPath(); c.moveTo(x0 + 16, yb - 6); c.lineTo(mx, yb - 78); c.lineTo(x1 - 16, yb - 6);
      c.strokeStyle = rgba('bone', 0.22); c.stroke();
      // a trefoil-less roundel in the gable
      c.beginPath(); c.arc(mx, yb - 34, 17, 0, TAU); c.moveTo(mx + 10, yb - 34); c.arc(mx, yb - 34, 10, 0, TAU);
      c.strokeStyle = rgba('bone', 0.35); c.stroke();
    }
  }
  // central cornice with its pipe shades (a row of pointed arches over the flat's pipe tops)
  if (vis(v, 300, CORNICE.y0 - 10, 1620, CORNICE.y1 + 40)) {
    moulding(c, 300, 2 * CX - 300, CORNICE.y0, CORNICE.y1, px, 1.05);
    c.beginPath();
    const y0 = CORNICE.y1, drop = 30;
    for (let i = 0; i <= FLAT.n; i++) {
      const x = FLAT.x0 + FLAT.pitch * i;
      if (i < FLAT.n) {
        const xm = x + FLAT.pitch / 2;
        c.moveTo(x, y0 + drop);
        c.quadraticCurveTo(x + 2, y0 + 8, xm, y0 + 2);
        c.quadraticCurveTo(x + FLAT.pitch - 2, y0 + 8, x + FLAT.pitch, y0 + drop);
      }
    }
    c.strokeStyle = rgba('bone', 0.42); c.lineWidth = Math.max(1 * px, 0.8); c.stroke();
    // pendants between the arches
    c.beginPath();
    for (let i = 1; i < FLAT.n; i++) { const x = FLAT.x0 + FLAT.pitch * i; c.moveTo(x + 3.5, y0 + drop + 4); c.arc(x, y0 + drop + 4, 3.5, 0, TAU); }
    c.fillStyle = WOOD; c.fill(); c.stroke();
  }
  // upper case: crown cornice and a segmental pediment
  if (vis(v, CROWN.x0 - 20, -260, CROWN.x1 + 20, CROWN.y1)) {
    moulding(c, CROWN.x0, CROWN.x1, CROWN.y0, CROWN.y1, px, 1.1);
    const hw = (CROWN.x1 - CROWN.x0) / 2 - 20, h = 64;
    const R = (hw * hw + h * h) / (2 * h);
    const cy = CROWN.y0 + R - h;
    const a0 = Math.asin(hw / R);
    for (const [dR, a, lw] of [[0, 0.5, 1.2], [14, 0.25, 0.9], [22, 0.4, 1.0]] as const) {
      c.beginPath(); c.arc(CX, cy, R - dR, -Math.PI / 2 - a0, -Math.PI / 2 + a0);
      c.strokeStyle = rgba('bone', a); c.lineWidth = Math.max(lw * px, 0.7); c.stroke();
    }
    c.save();
    c.beginPath(); c.arc(CX, cy, R, -Math.PI / 2 - a0, -Math.PI / 2 + a0); c.arc(CX, cy, R - 22, -Math.PI / 2 + a0, -Math.PI / 2 - a0, true); c.closePath();
    c.clip();
    hatchRect(c, CROWN.x0, CROWN.y0 - h - 4, CROWN.x1, CROWN.y0, Math.max(2.6, 2.6 * px), 0.12, Math.max(0.6 * px, 0.5), 'v');
    c.restore();
    c.beginPath(); c.moveTo(CROWN.x0 + 20, CROWN.y0); c.lineTo(CROWN.x1 - 20, CROWN.y0);
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = Math.max(1.2 * px, 0.8); c.stroke();
  }
  // the upper flat's own ledge
  if (vis(v, UPPER.x0 - 40, UPPER.toe - 6, UPPER.x1 + 40, CORNICE.y0)) {
    c.beginPath(); c.moveTo(UPPER.x0 - 30, UPPER.toe + 1); c.lineTo(UPPER.x1 + 30, UPPER.toe + 1);
    c.strokeStyle = rgba('bone', 0.45); c.lineWidth = Math.max(1.4 * px, 1); c.stroke();
  }
}

// ------------------------------------------------------------------ the console body, jambs, manuals, blower
export function drawConsoleBody(c: C2, v: View, z: number, t: number, blowerLamp: number) {
  const px = 1 / z;
  if (!vis(v, -260, CONSOLE.y0, 2 * CX + 260, CONSOLE.y1 + 60)) return;
  // the case's lower storey, full width: raised panels under the towers, a plinth
  const LX0 = -248, LX1 = 2 * CX + 248;
  c.fillStyle = '#0E1112'; c.fillRect(LX0, CONSOLE.y0, LX1 - LX0, CONSOLE.y1 - CONSOLE.y0);
  hatchRect(c, LX0, CONSOLE.y0, LX1, CONSOLE.y1, Math.max(3.4, 3.2 * px), 0.04, Math.max(0.6 * px, 0.5), 'h');
  c.strokeStyle = rgba('bone', 0.4); c.lineWidth = Math.max(1 * px, 0.8);
  c.strokeRect(LX0, CONSOLE.y0, LX1 - LX0, CONSOLE.y1 - CONSOLE.y0);
  for (const [x0, x1] of [[LX0 + 22, CONSOLE.x0 - 22], [CONSOLE.x1 + 22, LX1 - 22]] as const) {
    for (const [y0, y1] of [[CONSOLE.y0 + 30, 1290], [1320, CONSOLE.y1 - 30]] as const) {
      if (!vis(v, x0, y0, x1, y1)) continue;
      c.fillStyle = WOOD; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      // the bevel: lit top-left, hatched bottom-right
      const b = 16;
      c.save();
      c.beginPath(); c.moveTo(x1, y0); c.lineTo(x1 - b, y0 + b); c.lineTo(x1 - b, y1 - b); c.lineTo(x0 + b, y1 - b); c.lineTo(x0, y1); c.lineTo(x1, y1); c.closePath(); c.clip();
      hatchRect(c, x0, y0, x1, y1, Math.max(2.2, 2.2 * px), 0.18, Math.max(0.6 * px, 0.5), 'd');
      c.restore();
      c.beginPath();
      c.rect(x0, y0, x1 - x0, y1 - y0); c.rect(x0 + b, y0 + b, x1 - x0 - 2 * b, y1 - y0 - 2 * b);
      c.moveTo(x0, y0); c.lineTo(x0 + b, y0 + b); c.moveTo(x1, y0); c.lineTo(x1 - b, y0 + b);
      c.moveTo(x0, y1); c.lineTo(x0 + b, y1 - b); c.moveTo(x1, y1); c.lineTo(x1 - b, y1 - b);
      c.strokeStyle = rgba('bone', 0.42); c.lineWidth = Math.max(px, 0.8); c.stroke();
    }
  }
  moulding(c, LX0 - 14, LX1 + 14, CONSOLE.y1, CONSOLE.y1 + 26, px, 0.9);
  c.fillStyle = WOOD2; c.fillRect(CONSOLE.x0, CONSOLE.y0, CONSOLE.x1 - CONSOLE.x0, CONSOLE.y1 - CONSOLE.y0);
  hatchRect(c, CONSOLE.x0, CONSOLE.y0, CONSOLE.x1, CONSOLE.y1, Math.max(3.2, 3 * px), 0.045, Math.max(0.6 * px, 0.5), 'h');
  c.strokeStyle = rgba('bone', 0.4); c.lineWidth = Math.max(1 * px, 0.8);
  c.strokeRect(CONSOLE.x0, CONSOLE.y0, CONSOLE.x1 - CONSOLE.x0, CONSOLE.y1 - CONSOLE.y0);
  c.strokeStyle = rgba('bone', 0.18);
  c.strokeRect(CONSOLE.x0 + 8, CONSOLE.y0 + 8, CONSOLE.x1 - CONSOLE.x0 - 16, CONSOLE.y1 - CONSOLE.y0 - 16);
  // jamb panels
  for (const j of [JAMB.l, JAMB.r]) {
    if (!vis(v, j.x0, JAMB.y0, j.x1, JAMB.y1)) continue;
    c.fillStyle = WOOD; c.fillRect(j.x0, JAMB.y0, j.x1 - j.x0, JAMB.y1 - JAMB.y0);
    hatchRect(c, j.x0, JAMB.y0, j.x1, JAMB.y1, Math.max(2.6, 2.6 * px), 0.05, Math.max(0.5 * px, 0.45), 'v');
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = Math.max(1.1 * px, 0.8);
    c.strokeRect(j.x0, JAMB.y0, j.x1 - j.x0, JAMB.y1 - JAMB.y0);
    c.strokeStyle = rgba('bone', 0.22);
    c.strokeRect(j.x0 + 7, JAMB.y0 + 7, j.x1 - j.x0 - 14, JAMB.y1 - JAMB.y0 - 14);
    // the division label, engraved at the head of the jamb
    c.font = font(F.mono(500), 9.5); c.letterSpacing = '2.2px'; c.textAlign = 'center';
    c.fillStyle = rgba('bone', 0.62);
    c.fillText(j === JAMB.l ? 'GREAT · PEDAL' : 'SWELL · SOLO', (j.x0 + j.x1) / 2, JAMB.y0 + 24);
    c.letterSpacing = '0px';
  }
  // manuals
  drawManuals(c, v, px);
  // the blower's plate, left of the manuals
  const B = BLOWER;
  if (vis(v, B.x, B.y, B.x + B.w, B.y + B.h)) {
    c.fillStyle = '#1C2021'; c.fillRect(B.x, B.y, B.w, B.h);
    c.strokeStyle = rgba('bone', 0.55); c.lineWidth = Math.max(1 * px, 0.8); c.strokeRect(B.x, B.y, B.w, B.h);
    c.strokeStyle = rgba('bone', 0.2); c.strokeRect(B.x + 4, B.y + 4, B.w - 8, B.h - 8);
    for (const [sx, sy] of [[B.x + 9, B.y + 9], [B.x + B.w - 9, B.y + 9], [B.x + 9, B.y + B.h - 9], [B.x + B.w - 9, B.y + B.h - 9]]) {
      c.beginPath(); c.arc(sx!, sy!, 2.6, 0, TAU); c.moveTo(sx! - 2, sy!); c.lineTo(sx! + 2, sy!);
      c.strokeStyle = rgba('bone', 0.45); c.stroke();
    }
    c.textAlign = 'left';
    c.font = font(F.mono(600), 14); c.letterSpacing = '3px'; c.fillStyle = rgba('bone', 0.85);
    c.fillText('BLOWER', B.x + 20, B.y + 30);
    c.letterSpacing = '0px';
    c.font = font(F.mono(400), 10.5); c.fillStyle = rgba('bone', 0.62);
    c.fillText('Do not switch off', B.x + 20, B.y + 52);
    c.fillText('during the sermon.', B.x + 20, B.y + 67);
    // the switch (on) and its pilot lamp
    const sx = B.x + B.w - 52, sy = B.y + 42;
    c.beginPath(); c.arc(sx, sy, 13, 0, TAU); c.fillStyle = DARK; c.fill();
    c.strokeStyle = rgba('bone', 0.5); c.stroke();
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 5, sy - 17); c.lineWidth = Math.max(3, 3 * px); c.strokeStyle = rgba('bone', 0.8); c.stroke();
    c.lineWidth = Math.max(1 * px, 0.8);
    c.font = font(F.mono(500), 8); c.fillStyle = rgba('bone', 0.5); c.textAlign = 'center';
    c.fillText('ON', sx + 7, sy - 22);
    const lx = B.x + B.w - 20, ly = B.y + 42;
    c.beginPath(); c.arc(lx, ly, 6.5, 0, TAU); c.fillStyle = DARK; c.fill(); c.strokeStyle = rgba('bone', 0.5); c.stroke();
    c.beginPath(); c.arc(lx, ly, 4.2, 0, TAU); c.fillStyle = rgba('signal', clamp(blowerLamp)); c.fill();
    void t;
  }
}

function drawManuals(c: C2, v: View, px: number) {
  const M = MANUALS;
  if (!vis(v, M.x0 - 60, M.y[0]! - 10, M.x1 + 60, M.y[1]! + M.h + 10)) return;
  const nN = 36, kw = (M.x1 - M.x0) / nN;
  // key cheeks
  for (const x of [M.x0 - 40, M.x1]) { c.fillStyle = WOOD; c.fillRect(x, M.y[0]! - 14, 40, M.y[1]! + M.h - M.y[0]! + 20); c.strokeStyle = rgba('bone', 0.4); c.lineWidth = Math.max(px, 0.8); c.strokeRect(x, M.y[0]! - 14, 40, M.y[1]! + M.h - M.y[0]! + 20); }
  for (const y of M.y) {
    // key slip behind
    c.fillStyle = DARK; c.fillRect(M.x0, y - 12, M.x1 - M.x0, 12);
    c.strokeStyle = rgba('bone', 0.3); c.lineWidth = Math.max(px, 0.8); c.strokeRect(M.x0, y - 12, M.x1 - M.x0, 12);
    // naturals
    c.fillStyle = 'rgba(214,208,196,0.86)';
    c.fillRect(M.x0, y, M.x1 - M.x0, M.h);
    c.beginPath();
    for (let i = 0; i <= nN; i++) { const x = M.x0 + i * kw; c.moveTo(x, y); c.lineTo(x, y + M.h); }
    c.moveTo(M.x0, y + M.h - 6); c.lineTo(M.x1, y + M.h - 6);
    c.strokeStyle = rgba('ink', 0.75); c.lineWidth = Math.max(1.1 * px, 0.8); c.stroke();
    // sharps
    c.fillStyle = INK;
    for (let i = 0; i < nN - 1; i++) {
      const n = i % 7;
      if (n === 2 || n === 6) continue;
      const x = M.x0 + (i + 1) * kw - kw * 0.3;
      c.fillRect(x, y, kw * 0.6, M.h * 0.6);
    }
    c.beginPath();
    for (let i = 0; i < nN - 1; i++) {
      const n = i % 7;
      if (n === 2 || n === 6) continue;
      const x = M.x0 + (i + 1) * kw - kw * 0.3;
      c.moveTo(x + 2.5, y + 2); c.lineTo(x + 2.5, y + M.h * 0.6 - 3);
    }
    c.strokeStyle = rgba('bone', 0.3); c.lineWidth = Math.max(0.8 * px, 0.6); c.stroke();
  }
}

// ------------------------------------------------------------------ drawknobs
// A knob is a turned wooden head (with a porcelain face) on a shank, drawn in a perspective seen from
// the console's centre (VP): a point `d` px in front of the jamb is pushed away from VP and scaled up,
// so the side of the head (and, when the stop is drawn, the shank) shows on the side facing VP.
const KAPPA = 0.00082, SCALE_D = 0.0042;
const HEAD_T = 16;          // head thickness
const DRAW = 46;            // how far a drawn stop comes out
function proj(k: Knob, d: number) {
  return { x: k.x + (k.x - VP.x) * d * KAPPA, y: k.y + (k.y - VP.y) * d * KAPPA, s: 1 + d * SCALE_D };
}
/** The knob's face (front of the head) for an extension e (0 = in, 1 = drawn). */
export function knobHead(k: Knob, e: number) {
  return proj(k, DRAW * e + HEAD_T);
}
/** A solid of revolution's side between two circles along the pull axis: the hull of both. */
function hull(c: C2, a: { x: number; y: number }, ra: number, b: { x: number; y: number }, rb: number) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
  c.beginPath();
  if (L < 0.01) { c.arc(b.x, b.y, Math.max(ra, rb), 0, TAU); return; }
  const th = Math.atan2(dy, dx);
  const s = clamp((ra - rb) / L, -0.99, 0.99), g = Math.acos(s);
  c.arc(a.x, a.y, ra, th + g, th - g + TAU);
  c.arc(b.x, b.y, rb, th - g, th + g);
  c.closePath();
}

export function drawKnob(c: C2, k: Knob, e: number, lit: number, px: number) {
  const R = KNOB_R;
  const lw = Math.max(px, 0.8);
  // the bushing in the jamb
  c.beginPath(); c.arc(k.x, k.y, R + 5, 0, TAU); c.fillStyle = DARK; c.fill();
  c.strokeStyle = rgba('bone', 0.3); c.lineWidth = lw; c.stroke();
  const d0 = DRAW * e;                                   // the head's back
  const back = proj(k, d0), front = proj(k, d0 + HEAD_T);
  if (e > 0.02) {
    // its shadow on the jamb
    c.beginPath(); c.ellipse(front.x + 10 * e, front.y + 12 * e, R * front.s, R * front.s * 0.94, 0, 0, TAU);
    c.fillStyle = `rgba(0,0,0,${0.5 * clamp(e)})`; c.fill();
    // the collar at the jamb: the stop is on, the wind is let into its rank
    if (lit > 0.01) {
      c.beginPath(); c.arc(k.x, k.y, R * 0.55, 0, TAU);
      c.strokeStyle = rgba('signal', clamp(lit)); c.lineWidth = Math.max(4, 3 * px); c.stroke();
      c.lineWidth = lw;
    }
    // the shank
    const rs = R * 0.34;
    hull(c, k, rs, back, rs * back.s);
    c.fillStyle = '#2B3032'; c.fill();
    c.strokeStyle = rgba('bone', 0.55); c.stroke();
    c.beginPath();
    for (const f of [0.25, 0.5, 0.75]) { const q = proj(k, d0 * f); c.moveTo(q.x + rs * q.s, q.y); c.arc(q.x, q.y, rs * q.s, 0, TAU); }
    c.strokeStyle = rgba('bone', 0.14); c.stroke();
  }
  // the head's turned side, with two grooves
  hull(c, back, R * back.s, front, R * front.s);
  c.fillStyle = '#1F2425'; c.fill();
  c.strokeStyle = rgba('bone', 0.5); c.lineWidth = lw; c.stroke();
  c.beginPath();
  for (const f of [0.35, 0.65]) { const q = proj(k, d0 + HEAD_T * f); c.moveTo(q.x + R * q.s, q.y); c.arc(q.x, q.y, R * q.s, 0, TAU); }
  c.strokeStyle = rgba('bone', 0.2); c.stroke();
  // the face: a wooden rim, the porcelain inset
  const h = front, Rh = R * h.s;
  c.beginPath(); c.arc(h.x, h.y, Rh, 0, TAU); c.fillStyle = '#191C1D'; c.fill();
  c.strokeStyle = rgba('bone', 0.66); c.lineWidth = Math.max(1.1 * px, 0.8); c.stroke();
  c.beginPath(); c.arc(h.x, h.y, Rh * 0.9, Math.PI * 0.95, Math.PI * 1.75);
  c.strokeStyle = rgba('bone', 0.3); c.stroke();
  const Rf = Rh * 0.79;
  c.beginPath(); c.arc(h.x, h.y, Rf, 0, TAU); c.fillStyle = CARD; c.fill();
  c.strokeStyle = rgba('ink', 0.6); c.stroke();
  // engraved name
  c.fillStyle = INK; c.textAlign = 'center';
  const lines = k.name;
  const fam = F.serif(600, true);
  let sz = 10.4 * h.s;
  for (const l of lines) sz = Math.min(sz, (Rf * 1.62) / Math.max(1, measure(l, fam, 1)));
  const lh = sz * 1.02;
  const n = lines.length + (k.pitch ? 1 : 0);
  let y = h.y - ((n - 1) * lh) / 2 + sz * 0.32;
  c.font = font(fam, sz);
  for (const l of lines) { c.fillText(l, h.x, y); y += lh; }
  if (k.pitch) { c.font = font(F.serif(600), sz * 1.08); c.fillText(k.pitch, h.x, y + sz * 0.05); }
}

export function drawKnobs(c: C2, v: View, z: number, pull: ArrayLike<number>, lit: ArrayLike<number>) {
  const px = 1 / z;
  // in knobs first, drawn ones over them (they stand proud)
  const order = knobs.map((k, i) => i).sort((a, b) => (pull[a]! > 0.01 ? 1 : 0) - (pull[b]! > 0.01 ? 1 : 0));
  for (const i of order) {
    const k = knobs[i]!;
    if (!vis(v, k.x - 60, k.y - 60, k.x + 60, k.y + 60)) continue;
    drawKnob(c, k, pull[i]!, lit[i]!, px);
  }
}

// ------------------------------------------------------------------ the hymn board
export interface Card { ch: string; x: number; w: number; t: number; kind: 0 | 1 | 2; word: number }
export interface Row { k: number; cards: Card[]; words: Word[]; tNum: number; done: number }

const LET_F = F.archivo(75, 900), NUM_F = F.archivo(62, 900);

/** Lay out one row: [value digits][unit] [the line, one card per letter]; times per card. */
export function layoutRow(k: number, value: string, words: Word[], tNum: number): Row {
  const [num, unit] = value.split(' ') as [string, string];
  const cards: Card[] = [];
  const numRight = BOARD.x0 + 128;
  // value digits, right-aligned so the column reads 1, 2, 4 … 64
  const digs = [...num];
  let x = numRight - digs.length * ROW.numW - (digs.length - 1) * ROW.gap;
  for (const d of digs) { cards.push({ ch: d, x, w: ROW.numW, t: tNum, kind: 0, word: -1 }); x += ROW.numW + ROW.gap; }
  x = numRight + 10;
  for (const u of unit) { cards.push({ ch: u, x, w: ROW.cardW * 0.92, t: tNum + 0.035, kind: 1, word: -1 }); x += ROW.cardW * 0.92 + ROW.gap; }
  x += 30;
  const x0 = x;
  words.forEach((w, wi) => {
    const letters = [...w.w.toUpperCase().replace(/[^A-Z0-9’']/g, '')];
    const n = letters.length;
    const dur = Math.max(0.06, (w.end - w.start) * 0.9);
    letters.forEach((ch, i) => {
      cards.push({ ch, x, w: ROW.cardW, t: w.start + (dur * i) / Math.max(1, n), kind: 2, word: wi });
      x += ROW.cardW + ROW.gap;
    });
    x += ROW.wordGap - ROW.gap;
  });
  // fit: the line must stay inside the board (a longer proofread line compresses its letters)
  const room = BOARD.x1 - 26 - x0, used = x - ROW.wordGap - x0;
  if (used > room) {
    const s = room / used;
    for (const cd of cards) if (cd.kind === 2) { cd.x = x0 + (cd.x - x0) * s; cd.w *= s; }
  }
  const last = cards[cards.length - 1];
  return { k, cards, words, tNum, done: last ? last.t + 0.08 : tNum };
}

/** Card arrival: dropped into the slot from above in ~70 ms, a small bounce on the ledge. */
function drop(t: number, t0: number) {
  if (t < t0) return -1;
  const u = clamp((t - t0) / 0.07);
  return ease.outBack(u, 2.2);
}

export interface BoardState {
  t: number; z: number; rows: Row[]; slam: number; rattle: number; seed: number;
  /** the row whose cursor is live (-1: none) */
  live: number;
}

export function drawBoard(c: C2, v: View, s: BoardState) {
  const px = 1 / s.z;
  const B = BOARD;
  if (!vis(v, B.x0 - 20, B.y0 - 20, B.x1 + 20, B.y1 + 20)) return;
  c.save();
  c.translate(0, s.slam);
  // the board: a segmental crest, a moulded frame, dark wood with an engraved grain
  const hw = (B.x1 - B.x0) / 2, h = B.crest - B.y0;
  const R = (hw * hw + h * h) / (2 * h), cy = B.y0 + R, a0 = Math.asin(hw / R);
  const outline = (inset: number) => {
    c.beginPath();
    c.moveTo(B.x0 + inset, B.y1 - inset);
    c.lineTo(B.x0 + inset, B.crest + inset * 0.5);
    c.arc(CX, cy + inset, R, -Math.PI / 2 - a0 * (1 - inset / hw), -Math.PI / 2 + a0 * (1 - inset / hw));
    c.lineTo(B.x1 - inset, B.y1 - inset);
    c.closePath();
  };
  outline(0); c.fillStyle = '#121516'; c.fill();
  c.save(); outline(0); c.clip();
  c.beginPath();
  for (let y = B.y0 + 4; y < B.y1; y += Math.max(5.5, 4 * px)) {
    const ph = hash(Math.round(y), 3) * TAU;
    c.moveTo(B.x0, y);
    for (let x = B.x0; x <= B.x1; x += 60) c.lineTo(x, y + 1.6 * Math.sin(x * 0.011 + ph) + 0.8 * Math.sin(x * 0.037 + ph * 2));
  }
  c.strokeStyle = rgba('bone', 0.05); c.lineWidth = Math.max(0.6 * px, 0.5); c.stroke();
  c.restore();
  outline(0); c.strokeStyle = rgba('bone', 0.6); c.lineWidth = Math.max(1.3 * px, 0.9); c.stroke();
  outline(9); c.strokeStyle = rgba('bone', 0.22); c.lineWidth = Math.max(px, 0.7); c.stroke();
  outline(15); c.strokeStyle = rgba('bone', 0.4); c.stroke();
  // the carved head
  c.textAlign = 'center';
  c.font = font(F.serif(600), 38); c.letterSpacing = '14px'; c.fillStyle = rgba('bone', 0.8);
  c.fillText('HYMNS', CX + 7, B.y0 + 70);
  c.letterSpacing = '0px';
  c.beginPath(); c.moveTo(CX - 150, B.y0 + 84); c.lineTo(CX + 150, B.y0 + 84);
  c.strokeStyle = rgba('bone', 0.35); c.lineWidth = Math.max(px, 0.7); c.stroke();
  // ledges
  for (let k = 0; k < 7; k++) {
    const y = rowY(k);
    c.fillStyle = DARK; c.fillRect(B.x0 + 18, y, B.x1 - B.x0 - 36, 7);
    c.beginPath(); c.moveTo(B.x0 + 18, y); c.lineTo(B.x1 - 18, y);
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = Math.max(1.1 * px, 0.8); c.stroke();
    c.beginPath(); c.moveTo(B.x0 + 18, y + 7); c.lineTo(B.x1 - 18, y + 7);
    c.strokeStyle = rgba('bone', 0.16); c.stroke();
  }
  // cards
  for (const row of s.rows) drawRow(c, row, s, px);
  c.restore();
}

function drawRow(c: C2, row: Row, s: BoardState, px: number) {
  const t = s.t, base = rowY(row.k);
  const live = s.live === row.k;
  // the cursor: the next empty slot, bracketed in blue on the ledge
  if (live) {
    const next = row.cards.find((cd) => cd.t > t);
    if (next && t < row.done) {
      const x0 = next.x - 3, x1 = next.x + next.w + 3, h = ROW.cardH;
      const bl = 0.75 + 0.25 * Math.sin(t * 40);
      c.strokeStyle = rgba('signal', bl); c.lineWidth = Math.max(2.4, 2 * px);
      c.beginPath();
      c.moveTo(x0, base - h * 0.35); c.lineTo(x0, base - 1); c.lineTo(x1, base - 1); c.lineTo(x1, base - h * 0.35);
      c.stroke();
      c.fillStyle = rgba('signal', 0.12 * bl); c.fillRect(x0, base - h, x1 - x0, h);
    }
  }
  for (const cd of row.cards) {
    const e = drop(t, cd.t);
    if (e < 0) continue;
    const h = ROW.cardH;
    const jit = s.rattle * (hash(cd.x, row.k, s.seed) - 0.5);
    const y1 = base - (1 - e) * h * 0.95 + jit;
    const y0 = y1 - h;
    const fresh = clamp(1 - (t - cd.t) / 0.1);
    // the card
    c.fillStyle = CARD; c.fillRect(cd.x, y0, cd.w, h);
    c.strokeStyle = 'rgba(12,13,14,0.7)'; c.lineWidth = Math.max(px, 0.7); c.strokeRect(cd.x, y0, cd.w, h);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(cd.x, y1 - 4, cd.w, 4);
    // its character: the sung word in the blue, the rest ink
    let col = INK;
    if (cd.kind === 2) {
      const w = row.words[cd.word]!;
      if (t >= w.start && t < w.end + 0.06) col = BLUE;
    } else if (t < cd.t + 0.25) col = BLUE;
    c.fillStyle = col;
    c.textAlign = 'center';
    if (cd.kind === 0) { c.font = font(NUM_F, 46); c.fillText(cd.ch, cd.x + cd.w / 2, y1 - 9); }
    else { c.font = font(LET_F, 34 * Math.min(1, cd.w / ROW.cardW)); c.fillText(cd.ch, cd.x + cd.w / 2, y1 - 13); }
    if (fresh > 0) { c.fillStyle = `rgba(255,255,255,${0.35 * fresh})`; c.fillRect(cd.x, y0, cd.w, h); }
  }
}

// ------------------------------------------------------------------ the wind drawn into the dot (exit)
export function drawStreaks(c: C2, pts: { x: number; y: number }[], dot: { x: number; y: number }, k: number, px: number) {
  if (k <= 0 || k >= 1) return;
  c.save();
  c.lineCap = 'round';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const d = 0.25 * hash(i, 41);
    const u = clamp((k - d) / (1 - d));
    if (u <= 0 || u >= 1) continue;
    const a = ease.inCubic(u), b = ease.inCubic(Math.max(0, u - 0.18));
    const x0 = lerp(p.x, dot.x, b), y0 = lerp(p.y, dot.y, b), x1 = lerp(p.x, dot.x, a), y1 = lerp(p.y, dot.y, a);
    c.strokeStyle = rgba('signal', 0.85 * (1 - u * 0.3));
    c.lineWidth = Math.max(1.6 * px, 2.2 * (1 - u) * px + 0.6 * px);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  c.restore();
}
