// bridgeA — TAPE (the bridge's first four lines). Structure: P(doom)'s stack.ts, move for move
// (docs/PDOOM-STRUCTURE.md); imagery: a robotic LTO tape library in 3D (docs/PLATES.md #9).
//
// An endless wall of cartridge slots; a gantry picker (beam, carriage, gripper, barcode scanner) in
// front of it. One quantised step per beat: the gantry and the camera drop one shelf (spring with
// anticipation, landing shake). Every sung word is a cartridge's barcode label (the word as its
// six-character volume serial, zero-padded, then the media ID L9); the scanner's beam is the cursor
// and the blue dot (the thread object) rides the scan line. Words that share a beat share a shelf,
// left to right; a word held across a step is copied onto the tape below (a backup, read on).
//   A  frame 1 is verseB's rack slot (HANDOFF.slot) seen face-on: the first, empty cartridge slot.
//      The library plots out around it, the camera cranes up over the aisle while the picker drops
//      four shelves (outExpo); "And if you want to never die", a shelf per beat, a slow orbit on the
//      held notes.
//   C  line 2 ("Baby, plug in…"): cut to a high, steep angle, off-axis, closing in.
//   D  line 3 ("Come on, you're not even alive"): cut to a low, near-horizontal angle, dollying in.
//   E  the beat nearest "alive": DEAD STOP. The last step accelerates linearly and the picker halts
//      mid-air exactly on the beat (short of its shelf); cut to a flat telephoto elevation. No
//      shake, no punch: the maximal moment is the absence of motion. The ALIVE tape swings out of
//      alignment (outBack, landing on the next beat); its label is read BACKWARDS (right to left)
//      and the scan sticks two letters in. The shelf plate beside it: power at rest per cartridge,
//      0 W (the value, once). Line 4 runs on along the dead shelf (no more line feeds): the dot
//      alone hops from label to label, the frozen scanner's beam stretching after it, a flat
//      telephoto jump cut per word pair. On the last beat, back to ALIVE: the backwards read
//      finishes on the plate's last frame. Plain hard cut into bridgeB.
// Every time comes from the lyrics and the beat grid (init). Palette: ink/graphite, bone, signal.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { SCALE } from '../engine/scale';
import { clamp, lerp, ease, prog, pulse, springStep, hash, noise1, frameIdx, TAU } from '../engine/util';
import { dot2D, burst2D, HANDOFF } from './_power';
import {
  CX, RY, SW, SH, CW, CHT, CD, CY0, DR, DH, LW, LH, BAR_Y0, BAR_Y1, AISLE, colX, rowY, labelAt, frontX,
  Specials, volser, makeGlyphAtlas, makeWallMaterial, makeCartMaterial, makeTunnelMaterial,
  K_LYRIC, K_ECHO, G_HOLE, G_CUT,
} from './tape-wall';

type RGB = [number, number, number];
type V3 = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const clean = (s: string) => s.replace(/[,.?!“”"]/g, '');

interface Step { t: number; amt: number; kind: 'drop' | 'beat' | 'stop' }
/** A label carrying a word (or a copy of a held word). */
interface Lab { sid: number; w: Word; r: number; c: number; n: number; kind: number; dir: number; tOn: number }
/** One read: the dot sweeps a label from progress p0 to p1 over [t0, t1]. */
interface Read { lab: Lab; t0: number; t1: number; p0: number; p1: number }
interface Shot { t0: number; id: 'A' | 'C' | 'D' | 'E'; k: number }
interface CamP { fx: number; fy: number; yaw: number; pitch: number; dist: number; fov: number; roll: number }

const LEAD = 0.22; // fraction of a shelf the picker pre-moves before each beat
const FZ = 0.8; // how far into its last step the picker is when it dies
const HOP = 0.07; // the dot's hop between labels
const FOV0 = 34;
const D1 = (H / 2) / ((132 / SW) * Math.tan(((FOV0 / 2) * Math.PI) / 180)); // frame 1: the slot is 132 px wide

export default class Tape extends Scene {
  cam = new THREE.PerspectiveCamera(FOV0, W / H, 0.02, 400);
  bg = new FSPass(/* glsl */ `
    uniform float fade;
    void main() {
      vec2 px = FRAG_PX;
      float y = px.y / 1080.0;
      vec3 g = mix(toLinear(vec3(0.047, 0.055, 0.055)), toLinear(vec3(0.102, 0.118, 0.114)), y);
      vec2 cell = abs(fract(px / 60.0) - 0.5), major = abs(fract(px / 240.0) - 0.5);
      float gl = (1.0 - smoothstep(0.0, 0.03, 0.5 - max(cell.x, cell.y))) * 0.25
               + (1.0 - smoothstep(0.0, 0.006, 0.5 - max(major.x, major.y))) * 0.5;
      g += toLinear(vec3(0.16, 0.18, 0.17)) * gl * 0.3;
      fragColor = vec4(g * (1.0 - fade), 1.0);
    }`, { fade: { value: 0 } });
  world = new THREE.Scene();
  solids = new THREE.Scene();
  ink = new LineBatch(12000, { screen2D: false, blend: 'max', depthTest: true });
  glow = new LineBatch(2000, { screen2D: false, blend: 'add', depthTest: false });
  text = new Layer2D();
  sp = new Specials();

  private wallM!: THREE.RawShaderMaterial; private wallO!: THREE.RawShaderMaterial;
  private wall!: THREE.Mesh; private wallOpp!: THREE.Mesh;
  private cartM!: THREE.RawShaderMaterial; private cart!: THREE.Mesh;
  private tunM!: THREE.RawShaderMaterial; private tunnel!: THREE.Mesh;
  private boxes!: THREE.InstancedMesh;
  private plateTex!: THREE.CanvasTexture;

  // ---- timing
  private t0 = 0; private t1 = 0;
  private lines: Line[] = [];
  private alive!: Word;
  private steps: Step[] = [];
  private stopT = 0; private stopRow = 0;
  private rotT0 = 0; private rotT1 = 0;
  private craneEnd = 0;
  private labs: Lab[] = [];
  private aliveLab!: Lab;
  private reads: Read[] = [];
  private shots: Shot[] = [];
  private eShots: { t0: number; cx: number; w: number }[] = [];
  private tReturn = 0;
  private P1 = 0.4;
  private cutTags: { t: number; r: number; c: number }[] = [];
  private beats: number[] = [];

  override init() {
    const { lyrics: ly, audio: au, start: t0, end: t1 } = this.ctx;
    this.t0 = t0; this.t1 = t1;
    // the bridge's lines in this window, by position (line 4 awaits the proofread)
    this.lines = ly.lines.filter((l) => l.start >= t0 - 0.3 && l.start < t1 - 0.05);
    if (this.lines.length < 3) throw new Error(`bridgeA: expected four lines in the window, found ${this.lines.length}`);
    const l3 = this.lines[2]!;
    this.alive = l3.words.find((w) => /^alive/i.test(clean(w.w))) ?? l3.words[l3.words.length - 1]!;
    const words = this.lines.flatMap((l) => l.words);
    const ai = words.indexOf(this.alive);
    const pre = words.slice(0, ai), post = words.slice(ai + 1);

    // ---- steps: a shelf per beat until the dead stop on the beat nearest "alive"
    const beats = beatsIn(au, t0 - 1e-3, t1 + 1e-3);
    this.beats = beats;
    let stopT = this.alive.start, best = 0.3;
    for (const b of beats) if (Math.abs(b - this.alive.start) < best) { best = Math.abs(b - this.alive.start); stopT = b; }
    this.stopT = stopT = Math.max(stopT, t0 + 1);
    this.steps.push({ t: t0, amt: 4, kind: 'drop' });
    for (const b of beats) if (b > t0 + 0.2 && b < stopT - 0.2) this.steps.push({ t: b, amt: 1, kind: 'beat' });
    {
      // don't carry the opening word away right after it starts
      const w0 = pre[0]!;
      const i1 = this.steps.findIndex((s) => s.kind === 'beat');
      const s1 = this.steps[i1];
      if (s1 && s1.t > w0.start && (s1.t - w0.start) / Math.max(0.05, w0.end - w0.start) < 0.6) this.steps.splice(i1, 1);
    }
    this.steps.push({ t: stopT, amt: 1, kind: 'stop' });
    const rowAt = (t: number) => { let n = 0; for (const s of this.steps) if (s.t <= t && s.kind !== 'stop') n += s.amt; return n; };
    const stepTimeOf = (r: number) => { let n = 0; for (const s of this.steps) { n += s.amt; if (n >= r) return s.t; } return t1; };
    this.stopRow = rowAt(stopT - 1e-3) + 1;
    {
      const nb = beats.find((b) => b > stopT + 0.25) ?? stopT + 0.5;
      this.rotT1 = Math.min(nb, t1 - 0.05);
      this.rotT0 = Math.min(stopT + 0.12, this.rotT1 - 0.2);
    }
    this.craneEnd = Math.max(t0 + 0.22, Math.min(t0 + 0.62, pre[0]!.start + 0.1));

    // ---- words → shelves (rows) and slots (columns); a new line starts on a fresh shelf
    const rows = new Map<number, Word[]>();
    let prevRow = -1, prevLine = -1;
    for (const w of pre) {
      let r = Math.max(rowAt(w.start + 0.12), prevRow);
      if (w.line !== prevLine && (rows.get(r)?.length ?? 0) > 0) r += 1;
      r = Math.min(r, this.stopRow - 1);
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r)!.push(w);
      prevRow = r; prevLine = w.line;
    }
    const addLab = (w: Word, r: number, c: number, kind: number, dir: number, tOn: number) => {
      const v = volser(clean(w.w));
      const lab: Lab = { sid: this.sp.add(r, c, v.glyphs, v.n, kind), w, r, c, n: v.n, kind, dir, tOn };
      this.labs.push(lab);
      return lab;
    };
    const firstRow = Math.min(...rows.keys());
    let held: Lab | null = null;
    for (let r = firstRow; r < this.stopRow; r++) {
      const ws = rows.get(r);
      if (ws) { ws.forEach((w, c) => { held = addLab(w, r, c, K_LYRIC, 1, w.start); }); continue; }
      // an empty shelf while a word is still being sung: the machine copies it onto this tape
      const h = held as Lab | null;
      if (h && h.w.end > stepTimeOf(r) + 0.05) held = addLab(h.w, r, h.c, K_ECHO, 1, stepTimeOf(r));
    }
    this.aliveLab = addLab(this.alive, this.stopRow, 0, K_LYRIC, -1, this.alive.start);
    post.forEach((w, i) => addLab(w, this.stopRow, i + 1, K_LYRIC, 1, w.start));
    this.sp.mark(0, 0, G_HOLE);
    this.sp.mark(this.stopRow, 0, G_CUT);

    // ---- the reads (the dot's path): each word on its label; a held word continues on its copy
    const lyricLabs = this.labs.filter((l) => l.kind === K_LYRIC && l !== this.aliveLab && l.r < this.stopRow);
    for (const lab of lyricLabs) {
      const copies = this.labs.filter((l) => l.kind === K_ECHO && l.w === lab.w).sort((a, b) => a.r - b.r);
      let tA = lab.w.start;
      const chain = [lab, ...copies];
      chain.forEach((l, i) => {
        const tB = i + 1 < chain.length ? chain[i + 1]!.tOn : lab.w.end;
        this.reads.push({ lab: l, t0: tA, t1: Math.max(tA + 0.02, tB), p0: Lyrics.wordProgress(lab.w, tA), p1: Lyrics.wordProgress(lab.w, tB) });
        tA = tB;
      });
    }
    // ALIVE: read backwards, stuck two letters in
    this.P1 = Math.min(0.95, 2 / Math.max(2, this.aliveLab.n));
    this.reads.push({ lab: this.aliveLab, t0: this.alive.start, t1: this.alive.end, p0: 0, p1: this.P1 });
    const postLabs = this.labs.filter((l) => l.r === this.stopRow && l.c > 0);
    for (const l of postLabs) this.reads.push({ lab: l, t0: l.w.start, t1: l.w.end, p0: 0, p1: 1 });
    // the return: the beat after the last word, the read finishes on the last frame
    const lastW = post[post.length - 1] ?? this.alive;
    this.tReturn = beats.find((b) => b >= lastW.end - 0.05 && b < t1 - 0.25) ?? Math.max(lastW.end, t1 - 0.56);
    this.reads.push({ lab: this.aliveLab, t0: this.tReturn + 0.02, t1: t1 - 1 / 60, p0: this.P1, p1: 1 });
    this.reads.sort((a, b) => a.t0 - b.t0);

    // ---- camera set-ups: a new one per line; the dead stop; jump cuts along the dead shelf
    const lineRow = (li: number) => {
      const lab = this.labs.find((l) => l.kind === K_LYRIC && l.w.line === this.lines[li]?.i);
      return lab ? lab.r : -1;
    };
    this.shots.push({ t0, id: 'A', k: 0 });
    for (const [li, id] of [[1, 'C'], [2, 'D']] as const) {
      const r = lineRow(li);
      if (r < 0 || r >= this.stopRow) continue;
      const first = this.lines[li]!.words[0]!;
      const prevW = words[words.indexOf(first) - 1];
      const tc = Math.max(stepTimeOf(r), (prevW?.end ?? 0) - 0.04);
      if (tc < stopT - 0.3) { this.shots.push({ t0: tc, id, k: li }); this.cutTags.push({ t: tc, r, c: 0 }); }
    }
    // line 2 is long: a mirrored reframe on the word row nearest its middle
    {
      const c = this.shots.find((x) => x.id === 'C'), d = this.shots.find((x) => x.id === 'D');
      if (c) {
        const tEnd = d?.t0 ?? stopT;
        const mid = (c.t0 + tEnd) / 2;
        const rowsC = [...new Set(this.labs.filter((l) => l.kind === K_LYRIC && l.w.line === this.lines[1]!.i).map((l) => l.r))];
        let best: number | null = null;
        for (const r of rowsC) { const ts = stepTimeOf(r); if (ts > c.t0 + 1.2 && ts < tEnd - 1.2 && (best === null || Math.abs(ts - mid) < Math.abs(best - mid))) best = ts; }
        if (best !== null) {
          this.shots.push({ t0: best, id: 'C', k: 2 });
          this.cutTags.push({ t: best, r: rowAt(best + 1e-3), c: 0 });
          this.shots.sort((a, b) => a.t0 - b.t0);
        }
      }
    }
    this.shots.push({ t0: stopT, id: 'E', k: 0 });
    // E: the stop (ALIVE, the plate, the picker), then pairs of labels along the shelf, then ALIVE again
    this.eShots.push({ t0: stopT, cx: (colX(-1) + colX(0)) / 2 + 0.12, w: 3.3 });
    for (let i = 0; i < postLabs.length; i += 2) {
      const a = postLabs[i]!, b = postLabs[Math.min(i + 1, postLabs.length - 1)]!;
      let tc = a.w.start;
      const nb = au.nearestBeat(tc);
      if (Math.abs(nb - tc) < 0.08) tc = nb;
      const prevW = i > 0 ? postLabs[i - 1]!.w : this.alive;
      tc = Math.max(tc, prevW.end - 0.04, stopT + 0.5);
      if (tc < this.tReturn - 0.2) this.eShots.push({ t0: tc, cx: (colX(a.c) + colX(b.c)) / 2, w: 2.75 });
    }
    this.eShots.push({ t0: this.tReturn, cx: colX(0) + 0.12, w: 2.3 });

    this.build();
  }

  // ================================================================== build
  private build() {
    const glyphs = makeGlyphAtlas();
    this.plateTex = this.makePlate();
    this.wallM = makeWallMaterial(glyphs, this.sp, 0);
    this.wallO = makeWallMaterial(glyphs, this.sp, 1);
    const u = this.wallM.uniforms;
    u.plateTex!.value = this.plateTex;
    const r = this.stopRow;
    // the shelf plate: beside ALIVE, the shelf above and the one below (it clears the dead gantry's beam)
    (u.plateR!.value as THREE.Vector4).set(colX(-1) - SW / 2, rowY(r + 1) - SH / 2, colX(-1) + SW / 2, rowY(r - 1) + SH / 2);
    u.plateOn!.value = 1;
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.wallM);
    this.wallOpp = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.wallO);
    this.wallOpp.rotation.y = Math.PI;
    this.wallOpp.position.z = AISLE;
    for (const m of [this.wall, this.wallOpp]) m.frustumCulled = false;
    this.tunM = makeTunnelMaterial();
    this.tunnel = new THREE.Mesh(new THREE.BoxGeometry(SW, SH, DH), this.tunM);
    this.tunnel.position.set(colX(0), rowY(r), -DH / 2);
    this.cartM = makeCartMaterial(glyphs, this.sp, this.aliveLab.sid);
    this.cart = new THREE.Mesh(new THREE.BoxGeometry(CW, CHT, CD), this.cartM);
    this.world.add(this.wallOpp, this.wall, this.tunnel, this.cart);
    // picker bodies: dark boxes that hide the lines behind them
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.0075, 0.0085, 0.0085, THREE.LinearSRGBColorSpace) });
    this.boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 16);
    this.boxes.frustumCulled = false;
    this.solids.add(this.boxes);
  }

  /** The shelf's rating plate: R = engraving, G = the value. */
  private makePlate(): THREE.CanvasTexture {
    const PWd = SW, PHt = SH + 2 * RY; // world size
    const k = 1000 * SCALE; // canvas px per unit
    const cv = document.createElement('canvas');
    cv.width = Math.round(PWd * k); cv.height = Math.round(PHt * k);
    const c = cv.getContext('2d')!;
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'lighter';
    const mono = (w: number, cap: number) => font(F.mono(w), (cap / 0.698) * k);
    const x0 = 0.08 * k;
    let y = 0.1 * k;
    const line = (s: string, cap: number, w: number, col: string, gap = 1.75) => { y += cap * k; c.font = mono(w, cap); c.fillStyle = col; c.fillText(s, x0, y); y += cap * k * (gap - 1); };
    line('LTO-9 LIBRARY · FRAME 01', 0.026, 500, '#f00', 2.0);
    line('POWER AT REST,', 0.042, 500, '#f00', 1.45);
    line('PER CARTRIDGE', 0.042, 500, '#f00', 1.35);
    line('0 W', 0.15, 600, '#0f0', 1.25);
    line('KARDASHEV −∞', 0.034, 500, '#f00', 1.6);
    c.fillStyle = '#f00'; c.fillRect(x0, y - 0.012 * k, (PWd - 0.16) * k, Math.max(1, 0.003 * k)); y += 0.018 * k;
    line('RETENTION: FOREVER', 0.034, 500, '#f00', 1.6);
    line('LAST RESTORE TEST: NEVER', 0.034, 500, '#f00', 1.6);
    line('OFFSITE COPY: NONE', 0.034, 500, '#f00', 1.6);
    line('READS SO FAR: 0', 0.034, 500, '#f00', 1.6);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
    return t;
  }

  // ================================================================== timing
  /** Continuous shelf position of the picker (0 = the first slot's shelf). */
  private pos(t: number) {
    let p = 0;
    for (const s of this.steps) {
      const dt = t - s.t;
      if (dt <= 0) continue;
      if (s.kind === 'drop') p += s.amt * ease.outExpo(clamp(dt / 0.42));
      else if (s.kind === 'beat') p += s.amt * (LEAD + (1 - LEAD) * clamp(springStep(dt, 3.6, 0.74), 0, 1.08));
    }
    for (const s of this.steps) if (s.kind === 'beat' && t < s.t && t > s.t - 0.22) p += LEAD * ease.inQuad((t - s.t + 0.22) / 0.22);
    // the last step: a linear-accelerating fall that dies exactly on the beat, short of its shelf
    const TA = 0.3, a0 = this.stopT - TA;
    if (t > a0) p += FZ * Math.min(1, ((t - a0) / TA) ** 2);
    return p;
  }
  private landPulse(t: number) {
    let v = 0;
    for (const s of this.steps) if (s.kind !== 'stop' && t >= s.t) v = Math.max(v, pulse(t, s.t + (s.kind === 'drop' ? 0.12 : 0.07), 0.09));
    return t >= this.stopT ? 0 : v;
  }

  /** The active read at t (the latest that has begun its hop) and the one before it. */
  private readAt(t: number): { i: number; r: Read | null } {
    let i = -1;
    for (let k = 0; k < this.reads.length; k++) if (this.reads[k]!.t0 - HOP <= t) i = k;
    return { i, r: i >= 0 ? this.reads[i]! : null };
  }
  /** Progress of a read at t. */
  private readP(rd: Read, t: number) {
    if (rd.lab === this.aliveLab) return lerp(rd.p0, rd.p1, prog(t, rd.t0, rd.t1));
    return clamp(Lyrics.wordProgress(rd.lab.w, t), rd.p0, rd.p1);
  }
  /** ALIVE's backwards progress. */
  private aliveP(t: number) {
    const a = this.reads.filter((r) => r.lab === this.aliveLab);
    let p = 0;
    for (const r of a) if (t >= r.t0) p = this.readP(r, t);
    return p;
  }

  /** The label's world transform: slot position, or the loose cartridge's. */
  private labWorld(lab: Lab, x: number, y: number, t: number): V3 {
    if (lab === this.aliveLab) {
      const v = new THREE.Vector3(x, y, CD / 2 + 0.0005);
      this.cartMatrix(t);
      return v.applyMatrix4(this.cart.matrixWorld).toArray() as V3;
    }
    const L = labelAt(lab.r, lab.c);
    return [L[0] + x, L[1] + y, L[2] + 0.0005];
  }

  /** The dot (the cursor): on the scan line of the label being read, hopping between labels. */
  private dotAt(t: number): { p: V3; lab: Lab | null; reading: boolean; hopT: number } {
    const { i, r } = this.readAt(t);
    const yBar = 0.5 * (BAR_Y0 + BAR_Y1);
    const at = (rd: Read, p: number, tt: number): V3 => this.labWorld(rd.lab, frontX(rd.lab.n, p, rd.lab.dir), yBar, tt);
    if (!r) {
      const f = this.reads[0]!;
      return { p: at(f, 0, t), lab: null, reading: false, hopT: -1 };
    }
    const target = at(r, this.readP(r, Math.max(t, r.t0)), t);
    if (t < r.t0 && i > 0) {
      const pr = this.reads[i - 1]!;
      const from = at(pr, this.readP(pr, t), t);
      const k = ease.outExpo(clamp((t - (r.t0 - HOP)) / HOP));
      return { p: [lerp(from[0], target[0], k), lerp(from[1], target[1], k), lerp(from[2], target[2], k)], lab: r.lab, reading: false, hopT: r.t0 - HOP };
    }
    return { p: target, lab: r.lab, reading: t >= r.t0 && t <= r.t1 + 0.02, hopT: r.t0 - HOP };
  }

  /** Carriage x: slides (70 ms) to the column of the label being read. */
  private carriageX(t: number) {
    let x = colX(0);
    for (const rd of this.reads) {
      if (rd.t0 - HOP > t) break;
      if (rd.lab.r === this.stopRow && t >= this.stopT) continue; // the dead picker does not follow
      const xt = colX(rd.lab.c);
      x = lerp(x, xt, ease.outExpo(clamp((t - (rd.t0 - HOP)) / 0.09)));
    }
    return x;
  }
  private camX(t: number) {
    let x = colX(0);
    for (const rd of this.reads) {
      if (rd.t0 - HOP > t) break;
      if (rd.lab.r === this.stopRow) continue;
      x = lerp(x, colX(rd.lab.c), ease.outExpo(clamp((t - (rd.t0 - HOP)) / 0.22)));
    }
    return x;
  }

  private cartMatrix(t: number) {
    const k = ease.outBack(prog(t, this.rotT0, this.rotT1), 1.7);
    const s = t - this.stopT;
    const twitch = t > this.stopT ? 0.03 * Math.sin(clamp((s - 0.02) / 0.1) * Math.PI) : 0;
    const c = this.cart;
    c.position.set(colX(0) + 0.08 * k, rowY(this.stopRow) + CY0 + 0.02 * k, -DR - CD / 2 + 0.55 * k);
    c.rotation.set(0, 0.42 * k + twitch, 0.085 * k, 'YXZ');
    c.updateMatrixWorld(true);
  }

  // ================================================================== camera
  private shotAt(t: number): Shot {
    let s = this.shots[0]!;
    for (const x of this.shots) if (x.t0 <= t) s = x;
    return s;
  }
  private eShotAt(t: number) {
    let s = this.eShots[0]!, i = 0;
    this.eShots.forEach((x, k) => { if (x.t0 <= t) { s = x; i = k; } });
    return { s, i };
  }
  private camParams(t: number): CamP {
    const sh = this.shotAt(t);
    const lt = t - sh.t0;
    const p = this.pos(t);
    const fy = rowY(p) + CY0;
    const fx = this.camX(t);
    if (sh.id === 'A') {
      // opens face-on on the first slot (HANDOFF.slot), cranes up over the aisle
      const k = prog(t, this.t0 + 0.03, this.craneEnd, ease.inOutCubic);
      const orbit = prog(t, this.t0 + 0.6, (this.shots[1]?.t0 ?? this.t0 + 3) + 0.2, ease.inOutQuad);
      const A: CamP = { fx: fx + 0.05, fy, yaw: -0.5 + 0.34 * orbit, pitch: 0.84 - 0.08 * orbit, dist: 2.0 - 0.12 * orbit, fov: 38, roll: -0.04 + 0.03 * orbit };
      if (k >= 1) return A;
      const Z: CamP = { fx: 0, fy: rowY(p), yaw: 0, pitch: 0, dist: D1, fov: FOV0, roll: 0 };
      return {
        fx: lerp(Z.fx, A.fx, k), fy: lerp(Z.fy, A.fy, k), yaw: lerp(Z.yaw, A.yaw, k), pitch: lerp(Z.pitch, A.pitch, k),
        dist: Math.exp(lerp(Math.log(Z.dist), Math.log(A.dist), ease.outCubic(k))), fov: lerp(Z.fov, A.fov, k), roll: lerp(Z.roll, A.roll, k),
      };
    }
    if (sh.id === 'C' && sh.k === 2) return { fx: fx - 0.28, fy: fy - 0.02, yaw: -0.58 - 0.03 * lt, pitch: 0.7 - 0.02 * lt, dist: 2.3 - 0.12 * lt, fov: 38, roll: -0.07 };
    if (sh.id === 'C') return { fx: fx + 0.3, fy: fy - 0.02, yaw: 0.52 + 0.035 * lt, pitch: 0.74 - 0.025 * lt, dist: 2.35 - 0.13 * lt, fov: 38, roll: 0.06 };
    if (sh.id === 'D') return { fx: fx + 0.05, fy: fy + 0.03, yaw: -0.4 - 0.05 * lt, pitch: 0.08 + 0.02 * lt, dist: 2.3 - 0.18 * lt, fov: 36, roll: -0.02 };
    // E: flat telephoto elevation; a slow push per framing
    const { s, i } = this.eShotAt(t);
    const et = t - s.t0;
    const fov = 15;
    const h = (s.w * 9) / 16;
    let dist = h / (2 * Math.tan(((fov / 2) * Math.PI) / 180));
    const push = i === 0 ? 0.2 * ease.inOutCubic(clamp((et - 0.2) / 1.3)) : 0.05 * clamp(et / 1.2);
    dist *= 1 - push;
    const last = i === this.eShots.length - 1;
    return { fx: s.cx, fy: rowY(this.stopRow) + (i === 0 ? -0.2 : last ? -0.12 : 0.0), yaw: i === 0 ? 0.24 : last ? 0.2 : 0.12, pitch: 0.05, dist, fov, roll: 0 };
  }

  private setCam(t: number) {
    const P = this.camParams(t);
    const cam = this.cam;
    let sx = 0, sy = 0;
    const land = this.landPulse(t);
    if (land > 0.01) { sx = (hash(frameIdx(t), 1) - 0.5) * land * 0.03; sy = (hash(frameIdx(t), 2) - 0.5) * land * 0.03; }
    const f = new THREE.Vector3(P.fx + sx, P.fy + sy, -DR);
    cam.fov = P.fov;
    cam.position.set(f.x + Math.sin(P.yaw) * Math.cos(P.pitch) * P.dist, f.y + Math.sin(P.pitch) * P.dist, f.z + Math.cos(P.yaw) * Math.cos(P.pitch) * P.dist);
    cam.up.set(0, 1, 0);
    cam.lookAt(f);
    cam.rotateZ(P.roll);
    cam.near = Math.max(0.02, P.dist * 0.02);
    cam.far = 300;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    return P;
  }

  private proj(p: V3): [number, number] | null {
    const v = new THREE.Vector3(p[0], p[1], p[2]).project(this.cam);
    if (v.z > 1 || v.z < -1) return null;
    return [(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H];
  }

  // ================================================================== render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const stopped = t >= this.stopT;
    const P = this.setCam(t);
    const camPos = this.cam.position;
    const revealR = t <= this.t0 ? 0 : 40 * ease.outExpo(prog(t, this.t0, this.t0 + 0.7)) ** 1.7;
    const shown = t > this.t0 + 1e-4; // frame 1: the slot alone

    // ---- label states
    for (const lab of this.labs) this.sp.set(lab.sid, this.labState(lab, t));
    this.sp.upload();

    // ---- walls
    const fogNear = P.dist * 0.9, fogScale = Math.max(1.2, P.dist * 1.25);
    for (const m of [this.wallM, this.wallO, this.cartM, this.tunM]) {
      (m.uniforms.camPos!.value as THREE.Vector3).copy(camPos);
      (m.uniforms.fogP!.value as THREE.Vector2).set(fogNear, fogScale);
    }
    for (const m of [this.wallM, this.wallO]) {
      (m.uniforms.reveal!.value as THREE.Vector3).set(0, 0, revealR >= 60 ? -1 : revealR);
      m.uniforms.heatK!.value = 1;
    }
    this.wallM.uniforms.plateFlash!.value = stopped ? Math.max(pulse(t, this.stopT, 0.09), 0) * (t < this.stopT + 7 / 60 ? 1 : 0.35) * (t < this.stopT + 0.5 ? 1 : 0) : 0;
    this.wall.position.set(P.fx, P.fy, 0);
    this.wallOpp.position.set(P.fx, P.fy, AISLE);
    this.cartMatrix(t);
    this.cart.visible = this.tunnel.visible = t > this.t0 + 0.1;

    // the ground starts at verseB's level (the cut is a shape relay) and comes up with the library
    this.bg.u.fade!.value = 0.43 * (1 - prog(t, this.t0, this.t0 + 0.35, ease.outCubic));
    this.bg.render(renderer, out);
    renderer.setRenderTarget(out);
    renderer.clearDepth();
    renderer.render(this.world, this.cam);

    // ---- the picker
    const cx = this.carriageX(t);
    const gy = rowY(this.pos(t));
    const pickA = prog(t, this.t0 + 0.02, this.t0 + 0.14);
    const parts = this.pickerParts(cx, gy);
    const m4 = new THREE.Matrix4();
    let nb = 0;
    if (pickA > 0.5) for (const b of parts) {
      const [x0, x1, y0, y1, z0, z1] = b.box;
      m4.makeScale((x1 - x0) * 0.994, (y1 - y0) * 0.994, (z1 - z0) * 0.994).setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      this.boxes.setMatrixAt(nb++, m4);
    }
    this.boxes.count = nb;
    this.boxes.instanceMatrix.needsUpdate = true;
    renderer.render(this.solids, this.cam);

    const lb = this.ink; lb.clear();
    const gl = this.glow; gl.clear();
    if (shown) {
      for (const b of parts) this.boxEdges(lb, b.box, b.col, b.w, pickA * b.a);
      this.pickerDetail(lb, cx, gy, pickA);
    }
    lb.render(renderer, out, this.cam);

    // ---- the scan beam and the dot
    const dot = this.dotAt(t);
    const lens: V3 = [cx + 0.42, gy - 0.234, 0.2];
    const L = this.text; L.clear();
    const c = L.ctx;
    const beamOn = shown && t > this.t0 + 0.12;
    if (beamOn) {
      const sputter = stopped && t < (this.reads.find((r) => r.lab !== this.aliveLab && r.t0 > this.stopT)?.t0 ?? this.tReturn) - HOP && t > this.alive.end;
      const flick = sputter ? (hash(frameIdx(t), 7) < 0.35 ? 0.15 : 1) : 1;
      const bc = mul(LIN.signal, 3.2 * flick), bh = mul(LIN.signal, 0.6 * flick);
      gl.seg(lens[0], lens[1], lens[2], dot.p[0], dot.p[1], dot.p[2], 1.3, bc[0], bc[1], bc[2], 0.9);
      gl.seg(lens[0], lens[1], lens[2], dot.p[0], dot.p[1], dot.p[2], 5, bh[0], bh[1], bh[2], 0.5);
    }
    gl.render(renderer, out, this.cam);

    if (beamOn) this.drawDot(c, t, dot, stopped);
    this.drawTags(c, t);
    this.drawReadout(c, t);
    comp.draw(renderer, L.upload(), out);

    // ---- post: landings punch and shake; the dead stop is still
    const land = this.landPulse(t);
    const au = this.ctx.audio;
    let cutK = 0;
    for (const s of this.shots.slice(1)) if (s.id !== 'E' && t >= s.t0) cutK = Math.max(cutK, pulse(t, s.t0, 0.05));
    const eCut = this.eShotAt(t);
    const lineFour = stopped && eCut.i > 0;
    if (lineFour) cutK = Math.max(cutK, pulse(t, eCut.s.t0, 0.05));
    const beatK = lineFour ? pulse(t, au.timeOfBeat(Math.floor(au.beatAt(t))), 0.07) : 0;
    const dropK = pulse(t, this.t0 + 0.01, 0.06) * (t > this.t0 ? 1 : 0);
    const sh = stopped ? 0 : 7 * land + 9 * dropK;
    return {
      bloom: 0.62, bloomThreshold: 0.92, bloomKnee: 0.4, halation: 0.22, vignette: 0.42, grain: 0.055,
      exposure: 1 + 0.5 * dropK,
      ca: stopped ? 0.7 : 1.0 + 1.6 * land,
      shake: [noise1(t * 60, 1) * sh, noise1(t * 60, 2) * sh],
      zoom: 1 + (stopped ? 0.012 * cutK + 0.014 * beatK : 0.016 * land + 0.01 * cutK),
    };
  }

  private labState(lab: Lab, t: number) {
    const w = lab.w;
    const dot = this.readAt(t).r;
    const act = dot && dot.lab === lab && t >= dot.t0 - 0.02 && (t <= dot.t1 + 0.06 || lab === this.aliveLab) ? 1 : 0;
    if (lab === this.aliveLab) {
      const p = this.aliveP(t);
      const stuck = t > this.alive.end && t < this.tReturn;
      return { prog: p, flash: pulse(t, this.alive.start, 0.08) * 1.4 + (t >= this.tReturn ? 0.6 * pulse(t, this.tReturn, 0.1) : 0), done: 0, act: act * (stuck ? (hash(frameIdx(t), 3) < 0.4 ? 0.2 : 0.9) : 1), pre: prog(t, w.start - 0.5, w.start - 0.05), dir: -1 };
    }
    const p = Lyrics.wordProgress(w, t);
    if (lab.kind === K_ECHO) {
      return { prog: t >= lab.tOn - 0.02 ? p : 0, flash: pulse(t, lab.tOn, 0.06), done: t >= w.end + 0.03 ? 1 : 0, act, pre: prog(t, lab.tOn - 0.3, lab.tOn), dir: 1 };
    }
    return { prog: p, flash: pulse(t, w.start, 0.07) * 1.4, done: t >= w.end + 0.03 ? 1 : 0, act, pre: prog(t, w.start - 0.5, w.start - 0.05), dir: 1 };
  }

  // ------------------------------------------------------------------ the picker
  private pickerParts(cx: number, gy: number) {
    const bone = mul(LIN.bone, 0.8), dim = mul(LIN.bone, 0.45);
    type B = { box: [number, number, number, number, number, number]; col: RGB; w: number; a: number };
    // it hangs below the shelf it serves, so it never stands between the camera and the label
    const P: B[] = [
      // the gantry beam, across the whole wall
      { box: [cx - 30, cx + 30, gy - 0.62, gy - 0.52, 0.34, 0.48], col: dim, w: 1.1, a: 1 },
      // carriage riding it
      { box: [cx - 0.3, cx + 0.3, gy - 0.68, gy - 0.36, 0.28, 0.58], col: bone, w: 1.4, a: 1 },
      // wrist, and the gripper: an open fork under the slot (cross bar, two arms), a finger up each end
      { box: [cx - 0.16, cx + 0.16, gy - 0.36, gy - 0.235, 0.26, 0.36], col: bone, w: 1.1, a: 1 },
      { box: [cx - 0.6, cx + 0.6, gy - 0.235, gy - 0.2, 0.26, 0.32], col: bone, w: 1.2, a: 1 },
      { box: [cx - 0.6, cx - 0.56, gy - 0.235, gy - 0.2, 0.07, 0.26], col: bone, w: 1.1, a: 1 },
      { box: [cx + 0.56, cx + 0.6, gy - 0.235, gy - 0.2, 0.07, 0.26], col: bone, w: 1.1, a: 1 },
      { box: [cx - 0.6, cx - 0.575, gy - 0.2, gy + 0.17, 0.07, 0.15], col: bone, w: 1.0, a: 1 },
      { box: [cx + 0.575, cx + 0.6, gy - 0.2, gy + 0.17, 0.07, 0.15], col: bone, w: 1.0, a: 1 },
      // the barcode scanner, on the jaw
      { box: [cx + 0.34, cx + 0.5, gy - 0.34, gy - 0.235, 0.12, 0.3], col: bone, w: 1.1, a: 1 },
    ];
    return P;
  }
  private boxEdges(lb: LineBatch, b: [number, number, number, number, number, number], col: RGB, w: number, a: number) {
    const [x0, x1, y0, y1, z0, z1] = b;
    const X = [x0, x1], Y = [y0, y1], Z = [z0, z1];
    const s = (p: V3, q: V3) => {
      const dz = Math.hypot((p[0] + q[0]) / 2 - this.cam.position.x, (p[1] + q[1]) / 2 - this.cam.position.y, (p[2] + q[2]) / 2 - this.cam.position.z);
      const fk = Math.exp(-Math.max(0, dz - 6) / 10);
      lb.seg(p[0], p[1], p[2], q[0], q[1], q[2], w, col[0], col[1], col[2], a * fk);
    };
    for (const y of Y) for (const z of Z) s([x0, y, z], [x1, y, z]);
    for (const x of X) for (const z of Z) s([x, y0, z], [x, y1, z]);
    for (const x of X) for (const y of Y) s([x, y, z0], [x, y, z1]);
  }
  private pickerDetail(lb: LineBatch, cx: number, gy: number, a: number) {
    const dim = mul(LIN.bone, 0.3), bone = mul(LIN.bone, 0.7);
    // the beam's rails and its rack
    for (const y of [gy - 0.595, gy - 0.545]) lb.seg(cx - 30, y, 0.481, cx + 30, y, 0.481, 1, dim[0], dim[1], dim[2], a);
    for (let i = -40; i <= 40; i++) {
      const x = Math.round(cx / 0.12) * 0.12 + i * 0.12;
      lb.seg(x, gy - 0.52, 0.4, x, gy - 0.52, 0.48, 0.8, dim[0], dim[1], dim[2], a * Math.exp(-Math.abs(x - cx) / 3));
    }
    // carriage: bolts and a window on the scanner
    for (const [x, y] of [[-0.24, -0.42], [0.24, -0.42], [-0.24, -0.62], [0.24, -0.62]] as const) {
      const r = 0.018, X = cx + x, Y = gy + y, Z = 0.581;
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU;
        lb.seg(X + Math.cos(a0) * r, Y + Math.sin(a0) * r, Z, X + Math.cos(a1) * r, Y + Math.sin(a1) * r, Z, 0.9, bone[0], bone[1], bone[2], a);
      }
    }
    lb.seg(cx + 0.36, gy - 0.234, 0.2, cx + 0.48, gy - 0.234, 0.2, 1.2, bone[0], bone[1], bone[2], a);
    // the stencil on the carriage
    const st = mul(LIN.bone, 0.45);
    for (let k = 0; k < 5; k++) lb.seg(cx - 0.2 + k * 0.03, gy - 0.52, 0.581, cx - 0.185 + k * 0.03, gy - 0.52, 0.581, 1.6, st[0], st[1], st[2], a);
  }

  // ------------------------------------------------------------------ 2D: the dot, tags, readout
  private drawDot(c: CanvasRenderingContext2D, t: number, dot: { p: V3; reading: boolean; hopT: number }, stopped: boolean) {
    const q = this.proj(dot.p);
    if (!q) return;
    const stuck = stopped && t > this.alive.end && t < (this.reads.find((r) => r.lab !== this.aliveLab && r.t0 > this.stopT)?.t0 ?? this.tReturn) - HOP;
    let fl = 0;
    for (const rd of this.reads) if (t >= rd.t0) fl = Math.max(fl, pulse(t, rd.t0, 0.05));
    const I = stuck ? (hash(frameIdx(t), 5) < 0.3 ? 0.35 : 1) : 1;
    dot2D(c, q[0], q[1], t, 0.9 + 0.5 * fl, I);
    if (dot.hopT > 0 && t >= dot.hopT && t < dot.hopT + 0.25) burst2D(c, q[0], q[1], t, dot.hopT + HOP, { n: 12, speed: 420, life: 0.2, seed: 11 + Math.round(dot.hopT * 10) });
    if (stuck) {
      // sputtering: short sparks, re-seeded every frame
      c.save();
      c.strokeStyle = rgba('ember', 0.85); c.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) {
        if (hash(k, frameIdx(t), 9) < 0.45) continue;
        const an = hash(k, frameIdx(t)) * TAU, r = 10 + 26 * hash(k, frameIdx(t), 2);
        c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + Math.cos(an) * r, q[1] + Math.sin(an) * r); c.stroke();
      }
      c.restore();
    }
  }

  /** Numeral flashes on the set-up cuts (~7 frames): the slot's element address. */
  private drawTags(c: CanvasRenderingContext2D, t: number) {
    for (const tag of this.cutTags) {
      if (t < tag.t || t > tag.t + 7 / 60) continue;
      const L = labelAt(tag.r, tag.c);
      const q = this.proj([L[0] - LW / 2, L[1] + LH / 2, L[2]]);
      if (!q) continue;
      const x = q[0] - 20, y = q[1] - 36;
      c.save();
      c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(x, y); c.lineTo(x - 150, y); c.stroke();
      c.textAlign = 'right';
      c.font = font(F.mono(500), 22); c.fillStyle = rgba('bone', 0.95);
      c.fillText(`SLOT ${1025 + tag.r * 16 + tag.c}`, x - 6, y - 8);
      c.font = font(F.mono(400), 12); c.fillStyle = rgba('ash', 0.9);
      c.fillText(`shelf ${String(tag.r).padStart(3, '0')} · col ${String(tag.c).padStart(2, '0')}`, x - 6, y + 16);
      c.restore();
    }
  }

  /** Beside the loose tape as it lands: how far out of alignment it is (half a second). */
  private drawReadout(c: CanvasRenderingContext2D, t: number) {
    if (t < this.rotT1 - 0.05 || t > this.rotT1 + 0.5) return;
    const e = this.cart.matrixWorld;
    const corner = new THREE.Vector3(CW / 2, CHT / 2, CD / 2).applyMatrix4(e);
    const q = this.proj([corner.x, corner.y, corner.z]);
    if (!q) return;
    const k = prog(t, this.rotT1 - 0.05, this.rotT1 + 0.05, ease.outCubic) * (1 - prog(t, this.rotT1 + 0.42, this.rotT1 + 0.5));
    const deg = (this.cart.rotation.y * 180) / Math.PI;
    c.save();
    c.globalAlpha = k;
    c.strokeStyle = rgba('signal', 0.95); c.lineWidth = 1.5;
    const x1 = Math.min(q[0] + 50, W - 330), y1 = q[1] - 70;
    c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(x1, y1); c.lineTo(x1 + 250, y1); c.stroke();
    c.font = font(F.mono(500), 24); c.fillStyle = rgba('signal', 1);
    c.fillText(`${deg.toFixed(1)}° out of slot`, x1 + 8, y1 - 10);
    c.font = font(F.mono(400), 14); c.fillStyle = rgba('bone', 0.75);
    c.fillText('NOT SEATED (1 of ∞)', x1 + 8, y1 + 22);
    c.restore();
  }
}

/** Beat times (from the analysed grid) in [t0, t1). */
function beatsIn(au: { beatAt(t: number): number; timeOfBeat(i: number): number }, t0: number, t1: number): number[] {
  const out: number[] = [];
  const i0 = Math.ceil(au.beatAt(t0) - 1e-6);
  for (let i = i0; i < i0 + 400; i++) {
    const t = au.timeOfBeat(i);
    if (t >= t1) break;
    if (t >= t0 - 1e-6) out.push(t);
  }
  return out;
}
