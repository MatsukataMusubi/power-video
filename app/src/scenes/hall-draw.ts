// verseB (hall.ts): what the overlay draws in world units on top of the procedural plan: the labels a
// plan carries (rows, racks, aisles, CRAH units, containment doors, the title block and the corner
// annotation), the row-end cabinets developed flat into the cross aisle, and row J's cabinet with the
// certificate on its door and the empty 3U slot. The certificate and the rubber stamp are rendered once
// at init into canvases and blitted.
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { hash, mulberry32, TAU } from '../engine/util';
import { HALL, PERIOD, TILE, ROWS, PANEL, CERT, SLOT, panelTransform, aisleNo } from './hall-plan';

export type Box = { x0: number; x1: number; y0: number; y1: number };
const inBox = (b: Box, x0: number, y0: number, x1: number, y1: number) => x1 >= b.x0 && x0 <= b.x1 && y1 >= b.y0 && y0 <= b.y1;
const INK = '#141615';

// ------------------------------------------------------------------ pre-rendered pieces
/** The ranking certificate on paper (cert coords × k). */
export function makeCertificate(k = 9): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CERT.w * k; cv.height = CERT.h * k;
  const c = cv.getContext('2d')!;
  c.scale(k, k);
  const W = CERT.w, H = CERT.h;
  c.fillStyle = '#D6D0C3'; c.fillRect(0, 0, W, H);
  // paper tooth
  const rnd = mulberry32(11);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(90,80,60,${0.03 + 0.04 * rnd()})`; c.fillRect(rnd() * W, rnd() * H, 0.5, 0.5); }
  c.strokeStyle = INK; c.lineWidth = 1.1; c.strokeRect(4, 4, W - 8, H - 8);
  c.lineWidth = 0.35; c.strokeRect(6.5, 6.5, W - 13, H - 13);
  // guilloche band: three phase-shifted sine strands around the border
  c.lineWidth = 0.22;
  for (let j = 0; j < 3; j++) {
    c.beginPath();
    const per = (u: number) => 1.1 * Math.sin(u * 1.6 + (j * TAU) / 3);
    for (let u = 0; u <= W - 18; u += 0.6) { const x = 9 + u, y = 9.5 + per(u); if (u === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    for (let u = 0; u <= H - 19; u += 0.6) c.lineTo(W - 9.5 + per(u + 300), 9 + u);
    for (let u = 0; u <= W - 18; u += 0.6) c.lineTo(W - 9 - u, H - 9.5 + per(u + 600));
    for (let u = 0; u <= H - 19; u += 0.6) c.lineTo(9.5 + per(u + 900), H - 9 - u);
    c.stroke();
  }
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = font(F.serif(600), 19); c.letterSpacing = '2.2px';
  c.fillText('CERTIFICATE', W / 2 + 1, 34);
  c.letterSpacing = '0px';
  c.font = font(F.serif(400, true), 9); c.fillText('of rank on the list of June', W / 2, 45);
  c.font = font(F.mono(400), 4.4);
  c.fillText('This certifies that the system installed in', W / 2, 51);
  c.font = font(F.mono(600), 5);
  c.fillText('DATA HALL 3 · ROWS A–L · 564 RACKS', W / 2, 58);
  // seal: a scalloped disc with a ring of text
  const sx = 44, sy = 88, sr = 18;
  c.beginPath();
  for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU, r = sr + 1.2 * Math.cos(a * 24); const x = sx + r * Math.cos(a), y = sy + r * Math.sin(a); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
  c.lineWidth = 0.5; c.stroke();
  c.beginPath(); c.arc(sx, sy, sr - 4, 0, TAU); c.lineWidth = 0.3; c.stroke();
  c.beginPath(); c.arc(sx, sy, sr - 9.5, 0, TAU); c.stroke();
  c.font = font(F.mono(500), 3.4);
  const ring = 'THE LIST · MEASURED · RANKED · ';
  for (let i = 0; i < ring.length; i++) {
    const a = -Math.PI / 2 + (i / ring.length) * TAU;
    c.save(); c.translate(sx + Math.cos(a) * (sr - 6.8), sy + Math.sin(a) * (sr - 6.8)); c.rotate(a + Math.PI / 2); c.fillText(ring[i]!, 0, 1.2); c.restore();
  }
  c.font = font(F.serif(600), 9); c.fillText('No.', sx, sy + 3);
  // rank field (the stamp lands here)
  const r = CERT.rank;
  c.lineWidth = 0.45; c.strokeRect(r.x, r.y, r.w, r.h);
  c.font = font(F.mono(500), 4.2); c.textAlign = 'left';
  c.fillText('RANK', r.x, r.y - 2.2);
  c.fillText('CATEGORY', r.x + 34, r.y - 2.2);
  c.lineWidth = 0.25; c.beginPath(); c.moveTo(r.x + 32, r.y); c.lineTo(r.x + 32, r.y + r.h); c.stroke();
  // signature lines
  c.lineWidth = 0.3;
  for (const [x0, lab] of [[76, 'for the list'], [130, 'witness']] as const) {
    c.beginPath(); c.moveTo(x0, 111); c.lineTo(x0 + 44, 111); c.stroke();
    c.font = font(F.mono(400), 3.4); c.textAlign = 'left'; c.fillText(lab, x0, 115.5);
  }
  c.beginPath();
  for (let u = 0; u <= 1; u += 0.02) { const x = 80 + 34 * u, y = 108 - 3 * Math.sin(u * 9) * (1 - u) - 1.5 * u; if (u) c.lineTo(x, y); else c.moveTo(x, y); }
  c.lineWidth = 0.4; c.stroke();
  c.font = font(F.mono(400), 3.3); c.textAlign = 'center';
  c.fillText('Valid until the next list.', W / 2, 123.5);
  return cv;
}

/** The rubber stamp: the sung word over RANK #1, blue ink, worn (stamp coords × k). */
export const STAMP = { w: 92, h: 46 };
export function makeStamp(word: string, k = 11): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = STAMP.w * k; cv.height = STAMP.h * k;
  const c = cv.getContext('2d')!;
  c.scale(k, k);
  const W = STAMP.w, H = STAMP.h;
  c.strokeStyle = rgba('signal', 1); c.fillStyle = rgba('signal', 1);
  const rr = (x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.stroke(); };
  c.lineWidth = 2.2; rr(1.5, 1.5, W - 3, H - 3, 3.5);
  c.lineWidth = 0.8; rr(4.6, 4.6, W - 9.2, H - 9.2, 2);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = font(F.mono(700), 8.6); c.letterSpacing = '2.6px';
  c.fillText(word, W / 2 + 1.3, 15.8);
  c.letterSpacing = '0px';
  c.lineWidth = 0.7; c.beginPath(); c.moveTo(9, 19.5); c.lineTo(W - 9, 19.5); c.stroke();
  let fs = 22;
  c.font = font(F.archivo(87.5, 900), fs);
  const mw = c.measureText('RANK #1').width;
  if (mw > W - 16) { fs *= (W - 16) / mw; c.font = font(F.archivo(87.5, 900), fs); }
  c.fillText('RANK #1', W / 2, 39.5);
  // wear: ink skips (worn rubber), deterministic
  c.globalCompositeOperation = 'destination-out';
  const rnd = mulberry32(5);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W, y = rnd() * H, s = 0.15 + 0.6 * rnd() ** 3;
    c.fillStyle = `rgba(0,0,0,${0.5 + 0.5 * rnd()})`;
    c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
  }
  for (let i = 0; i < 5; i++) {
    const y = rnd() * H, x0 = rnd() * W;
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x0, y, 6 + 18 * rnd(), 0.35);
  }
  c.globalCompositeOperation = 'source-over';
  return cv;
}

// ------------------------------------------------------------------ the plan's labels
export function rowName(k: number, south: boolean) { return ROWS[2 * (k - HALL.K0) + (south ? 1 : 0)] ?? '?'; }

/** Walls' furniture and the labels of the plan: CRAH units, row and aisle names, rack ids, containment doors. */
export function drawPlan(c: CanvasRenderingContext2D, b: Box, px: number, zoom: number, a: number, doorsOpen: number) {
  if (a <= 0.002) return;
  c.save();
  c.globalAlpha = a;
  c.textBaseline = 'alphabetic';
  // CRAH units along the west and east walls, one per hot aisle
  for (const side of [0, 1]) {
    const xw = side ? HALL.X1 - 420 : HALL.X0 + 60;
    for (let k = HALL.K0 - 1; k <= HALL.K1; k++) {
      const yc = k * PERIOD + 480;
      if (yc - 240 < HALL.Y0 || yc + 240 > HALL.Y1) continue;
      if (!inBox(b, xw, yc - 240, xw + 360, yc + 240)) continue;
      c.fillStyle = rgba('ink2', 0.9); c.fillRect(xw, yc - 230, 360, 460);
      c.strokeStyle = rgba('bone', 0.62); c.lineWidth = Math.max(2, 1.4 * px); c.strokeRect(xw, yc - 230, 360, 460);
      c.lineWidth = Math.max(1.2, 1 * px);
      for (const dy of [-110, 110]) {
        const cx = xw + 180, cy = yc + dy;
        c.beginPath(); c.arc(cx, cy, 88, 0, TAU); c.stroke();
        for (let i = 0; i < 5; i++) { const an = (i / 5) * TAU + 0.3; c.beginPath(); c.moveTo(cx, cy); c.quadraticCurveTo(cx + 60 * Math.cos(an + 0.5), cy + 60 * Math.sin(an + 0.5), cx + 84 * Math.cos(an), cy + 84 * Math.sin(an)); c.stroke(); }
      }
      if (zoom > 0.12) {
        c.fillStyle = rgba('ash', 0.9); c.font = font(F.mono(500), 34); c.textAlign = 'center';
        const n = (k - HALL.K0 + 2) + side * 10;
        c.save(); c.translate(side ? xw - 40 : xw + 400, yc); c.rotate(-Math.PI / 2); c.fillText(`CRAH-${String(n).padStart(2, '0')}`, 0, 12); c.restore();
      }
    }
  }
  // rows: names at the outer ends; rack ids when close enough to read
  for (let k = HALL.K0; k <= HALL.K1; k++) {
    for (const south of [false, true]) {
      const y0 = k * PERIOD + (south ? 120 : -360), y1 = y0 + 240, yc = y0 + 120;
      const name = rowName(k, south);
      c.fillStyle = rgba('bone', 0.85); c.font = font(F.mono(600), 58); c.textAlign = 'right';
      if (inBox(b, HALL.RW0 - 420, y0, HALL.RW0, y1)) c.fillText(`ROW ${name}`, HALL.RW0 - 36, yc + 20);
      c.textAlign = 'left';
      if (inBox(b, HALL.RE1, y0, HALL.RE1 + 420, y1)) c.fillText(`ROW ${name}`, HALL.RE1 + 36, yc + 20);
      if (zoom > 0.42) {
        c.font = font(F.mono(500), 19); c.fillStyle = rgba('ash', Math.min(1, (zoom - 0.42) * 5) * 0.85); c.textAlign = 'center';
        const back = south ? y1 - 22 : y0 + 36;
        for (const [x0, x1, off] of [[HALL.RW0, HALL.RW1, 0], [HALL.RE0, HALL.RE1, 30]] as const) {
          const n = Math.round((x1 - x0) / TILE);
          for (let i = 0; i < n; i++) {
            const xc = x0 + (i + 0.5) * TILE;
            if (xc < b.x0 - 60 || xc > b.x1 + 60 || back < b.y0 - 40 || back > b.y1 + 40) continue;
            c.fillText(`${name}${String(i + 1 + off).padStart(2, '0')}`, xc, back);
          }
        }
      }
    }
    // aisles
    const yc = k * PERIOD;
    c.textAlign = 'left';
    if (inBox(b, HALL.RW0, yc - 60, HALL.RW0 + 500, yc + 120)) {
      c.font = font(F.mono(500), 30); c.fillStyle = rgba('ash', 0.9);
      c.fillText(`COLD AISLE ${aisleNo(k)}`, HALL.RW0 + 22, yc + 102);
    }
    if (k < HALL.K1 && inBox(b, HALL.RW0, yc + 420, HALL.RW0 + 700, yc + 540)) {
      c.font = font(F.mono(500), 30); c.fillStyle = rgba('graphite', 1);
      c.fillText('HOT AISLE · CONTAINED', HALL.RW0 + 22, yc + 491);
    }
    // cold-aisle containment doors at both ends of each block
    c.strokeStyle = rgba('bone', 0.7); c.lineWidth = Math.max(2, 1.6 * px);
    for (const [xd, dir] of [[HALL.RW0, -1], [HALL.RW1, 1], [HALL.RE0, -1], [HALL.RE1, 1]] as const) {
      if (!inBox(b, xd - 140, yc - 130, xd + 140, yc + 130)) continue;
      const open = xd === HALL.RW1 && k === 0 ? doorsOpen : 0;
      for (const s of [-1, 1]) {
        // a leaf hinged at the aisle's edge; closed it spans half the aisle, open it swings out of the block
        const hy = yc + s * 120;
        const an = (open * Math.PI) / 2;
        const ex = xd + dir * Math.sin(an) * 118, ey = hy - s * Math.cos(an) * 118;
        c.beginPath(); c.moveTo(xd, hy); c.lineTo(ex, ey); c.stroke();
        const th0 = Math.atan2(-s, 0), th1 = Math.atan2(0, dir);
        let dl = th1 - th0;
        while (dl > Math.PI) dl -= TAU;
        while (dl <= -Math.PI) dl += TAU;
        c.save(); c.setLineDash([6 * px, 6 * px]); c.lineWidth = Math.max(1, 0.8 * px); c.strokeStyle = rgba('ash', 0.55);
        c.beginPath(); c.arc(xd, hy, 118, th0, th1, dl < 0); c.stroke(); c.restore();
      }
    }
  }
  c.restore();
}

/** Sheet furniture: border, title block, the corner annotation (the value), the CFD legend. */
export function drawSheet(c: CanvasRenderingContext2D, b: Box, px: number, a: number, legend: number) {
  if (a <= 0.002) return;
  c.save();
  c.globalAlpha = a;
  c.textBaseline = 'alphabetic';
  const X0 = HALL.X0 - 420, X1 = HALL.X1 + 420, Y0 = HALL.Y0 - 420, Y1 = HALL.Y1 + 900;
  c.strokeStyle = rgba('bone', 0.5); c.lineWidth = Math.max(2, 1.5 * px);
  c.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  c.lineWidth = Math.max(1, 0.8 * px); c.strokeRect(X0 + 40, Y0 + 40, X1 - X0 - 80, Y1 - Y0 - 80);
  // column grid bubbles along the top
  c.font = font(F.mono(600), 44); c.textAlign = 'center';
  for (let i = 0; i <= 6; i++) {
    const x = HALL.X0 + ((HALL.X1 - HALL.X0) * i) / 6;
    if (!inBox(b, x - 80, Y0, x + 80, HALL.Y0)) continue;
    c.strokeStyle = rgba('ash', 0.7); c.beginPath(); c.arc(x, HALL.Y0 - 240, 52, 0, TAU); c.stroke();
    c.setLineDash([40, 12, 6, 12]); c.beginPath(); c.moveTo(x, HALL.Y0 - 188); c.lineTo(x, HALL.Y0 - 20); c.stroke(); c.setLineDash([]);
    c.fillStyle = rgba('ash', 0.9); c.fillText(String(i + 1), x, HALL.Y0 - 225);
  }
  // title block, bottom right
  const tx = HALL.X1 - 2000, ty = HALL.Y1 + 200;
  if (inBox(b, tx, ty, tx + 2400, ty + 640)) {
    c.strokeStyle = rgba('bone', 0.75); c.lineWidth = Math.max(2, 1.5 * px); c.strokeRect(tx, ty, 2400, 600);
    c.lineWidth = Math.max(1, 0.8 * px);
    for (const y of [150, 300, 450]) { c.beginPath(); c.moveTo(tx, ty + y); c.lineTo(tx + 2400, ty + y); c.stroke(); }
    c.beginPath(); c.moveTo(tx + 1200, ty + 150); c.lineTo(tx + 1200, ty + 600); c.stroke();
    c.textAlign = 'left';
    c.font = font(F.mono(600), 76); c.fillStyle = rgba('bone', 0.95); c.fillText('DATA HALL 3 — FLOOR PLAN', tx + 40, ty + 104);
    const cells: [string, string, number, number][] = [
      ['DRAWN', 'PLANT DESIGN', 0, 150], ['CHECKED', 'BY SIMULATION', 1200, 150],
      ['SCALE', '1:100', 0, 300], ['REV', 'B · AS SIMULATED', 1200, 300],
      ['SHEET', '1 OF 1', 0, 450], ['STATUS', 'IN SERVICE', 1200, 450],
    ];
    for (const [k, v, x, y] of cells) {
      c.font = font(F.mono(500), 30); c.fillStyle = rgba('graphite', 1); c.fillText(k, tx + x + 40, ty + y + 46);
      c.font = font(F.mono(500), 52); c.fillStyle = rgba('bone', 0.9); c.fillText(v, tx + x + 40, ty + y + 118);
    }
  }
  // the corner annotation: the value, once
  const ax = HALL.X0 + 540, ay = HALL.Y1 - 340;
  if (inBox(b, ax, ay, ax + 2100, ay + 320)) {
    c.strokeStyle = rgba('bone', 0.8); c.lineWidth = Math.max(2, 1.4 * px);
    c.strokeRect(ax, ay, 2020, 300);
    c.textAlign = 'left';
    c.font = font(F.mono(500), 44); c.fillStyle = rgba('ash', 1); c.fillText('SITE DESIGN LOAD', ax + 44, ay + 72);
    c.font = font(F.mono(700), 186); c.fillStyle = rgba('bone', 0.96); c.fillText('IT LOAD 150 MW', ax + 34, ay + 252);
    c.font = font(F.mono(500), 44); c.fillStyle = rgba('ash', 1); c.textAlign = 'right'; c.fillText('KARDASHEV 0.22', ax + 1980, ay + 72); c.textAlign = 'left';
  }
  // the simulation's legend, filed in the south strip of the east block
  if (legend > 0.002) {
    const lx = HALL.RE0 + 120, ly = HALL.Y1 - 330;
    if (inBox(b, lx, ly, lx + 3000, ly + 320)) {
      c.globalAlpha = a * legend;
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = Math.max(2, 1.4 * px); c.strokeRect(lx, ly, 2860, 290);
      c.textAlign = 'left';
      c.font = font(F.mono(600), 60); c.fillStyle = rgba('bone', 0.95); c.fillText('AIRFLOW MODEL · AIR TEMPERATURE AT 1.2 m', lx + 40, ly + 100);
      c.font = font(F.mono(400), 44); c.fillStyle = rgba('ash', 1); c.fillText('isotherms every 2 °C · streaks: 1 s of flow', lx + 40, ly + 170);
      c.font = font(F.mono(400, true), 44); c.fillText('Solved on the machine in this room.', lx + 40, ly + 240);
    }
  }
  c.restore();
}

// ------------------------------------------------------------------ the row-end cabinets
/** The cabinets at the east ends of the west block's rows, developed flat into the cross aisle (up = east). */
export function drawPanels(c: CanvasRenderingContext2D, b: Box, px: number, a: number, cert: HTMLCanvasElement, o: { certA: number; zoom: number }) {
  c.save();
  c.textBaseline = 'alphabetic';
  for (let k = HALL.K0; k <= HALL.K1; k++) {
    for (const south of [false, true]) {
      const yc = k * PERIOD + (south ? 240 : -240);
      if (!inBox(b, PANEL.x0 - 40, yc - 140, PANEL.x0 + PANEL.h + 40, yc + 140)) continue;
      const isJ = k === 2 && south;
      const al = a;
      if (al <= 0.002) continue;
      c.save();
      panelTransform(c, { ...PANEL, yc });
      c.globalAlpha = al;
      drawCabinet(c, rowName(k, south), px, isJ, o.zoom);
      if (isJ && o.certA > 0.002) {
        c.globalAlpha = al * o.certA;
        // hanging wire and hook
        c.strokeStyle = rgba('bone', 0.8); c.lineWidth = Math.max(0.6, 0.9 * px);
        c.beginPath(); c.moveTo(CERT.x + 34, CERT.y + 2); c.lineTo(120, 20); c.lineTo(CERT.x + CERT.w - 34, CERT.y + 2); c.stroke();
        c.fillStyle = rgba('bone', 0.9); c.beginPath(); c.arc(120, 20, 2.2, 0, TAU); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(CERT.x + 3, CERT.y + 4, CERT.w, CERT.h);
        c.drawImage(cert, CERT.x, CERT.y, CERT.w, CERT.h);
      }
      c.restore();
    }
  }
  c.restore();
}

/** One cabinet front: frame, plinth, two 19-inch bays behind a perforated door, a row sign; row J shows its slots. */
function drawCabinet(c: CanvasRenderingContext2D, name: string, px: number, open: boolean, zoom: number) {
  const W = PANEL.w, H = PANEL.h;
  c.fillStyle = rgba('ink2', 0.92); c.fillRect(0, 0, W, H);
  c.strokeStyle = rgba('bone', 0.78); c.lineWidth = Math.max(1.2, 1.5 * px); c.strokeRect(0, 0, W, H);
  c.lineWidth = Math.max(0.6, 0.8 * px);
  c.strokeStyle = rgba('bone', 0.4);
  c.strokeRect(0, 0, W, 12); c.strokeRect(0, H - 16, W, 16); // top cap, plinth
  // the fold line (the row end) and its note
  c.save(); c.strokeStyle = rgba('ash', 0.7); c.setLineDash([22, 6, 3, 6]);
  c.beginPath(); c.moveTo(-40, H); c.lineTo(W + 40, H); c.stroke(); c.restore();
  // bays
  const bays = [[15, 105], [135, 225]] as const;
  for (const [x0, x1] of bays) {
    c.strokeStyle = rgba('bone', 0.45); c.strokeRect(x0, 22, x1 - x0, H - 50);
    if (open && zoom > 0.35) {
      // 42 U, servers as slabs with a status LED; one 3U gap has no blanking panel
      for (let u = 0; u < 42; u++) {
        const y = 24 + u * ((H - 54) / 42);
        const h = (H - 54) / 42;
        const inSlot = x0 === SLOT.x && y + h > SLOT.y + 0.5 && y < SLOT.y + SLOT.h - 0.5;
        if (inSlot) continue;
        c.strokeStyle = rgba('bone', 0.2); c.strokeRect(x0 + 3, y + 0.6, x1 - x0 - 6, h - 1.2);
        c.fillStyle = hash(u, x0) < 0.7 ? rgba('signal', 0.8) : rgba('graphite', 0.8);
        c.fillRect(x1 - 9, y + h / 2 - 1, 2.4, 2);
      }
    }
  }
  // perforated door: a light dot screen over the bays
  if (zoom > 0.6) {
    c.fillStyle = rgba('bone', 0.12);
    for (let y = 26; y < H - 30; y += 7) for (let x = 10; x < W - 10; x += 7) c.fillRect(x, y, 1.1, 1.1);
  }
  // handle
  c.strokeStyle = rgba('bone', 0.7); c.lineWidth = Math.max(0.8, 1 * px); c.strokeRect(W - 9, H / 2 - 24, 4, 48);
  // row sign
  if (!open) {
    c.fillStyle = rgba('ink', 0.95); c.fillRect(40, 30, W - 80, 58);
    c.strokeStyle = rgba('bone', 0.6); c.strokeRect(40, 30, W - 80, 58);
    c.fillStyle = rgba('bone', 0.92); c.font = font(F.archivo(100, 700), 40); c.textAlign = 'center';
    c.fillText(`ROW ${name}`, W / 2, 74);
  }
}

/** The empty 3U slot: a thin bone outline (the hand-off to the tape library). */
export function drawSlot(c: CanvasRenderingContext2D, px: number, a: number, dash: number) {
  if (a <= 0.002) return;
  c.save();
  panelTransform(c);
  c.globalAlpha = a;
  c.strokeStyle = rgba('bone', 0.92);
  c.lineWidth = 1.5 * px;
  if (dash > 0.01) c.setLineDash([5 * dash + 0.001, 3.5 * dash]);
  c.strokeRect(SLOT.x, SLOT.y, SLOT.w, SLOT.h);
  c.restore();
}
