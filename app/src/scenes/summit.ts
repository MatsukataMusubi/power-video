// submit + tail — SUMMIT (the ending; one module, two timeline entries: `tail` has params.tail).
// Structure: P(doom)'s outro without the rewind (docs/PDOOM-STRUCTURE.md); imagery: a mountaineering
// elevation profile, one false summit per sung "submit / summit" (docs/PLATES.md #20–21).
//
//  submit
//   1  Frame 1 is the film's biggest hit: the cladogram's branch tip (HANDOFF.summit, the frame centre)
//      detonates: white flash, streaks, a shockwave ring on each of the first four beats. The tip is the
//      first peak; the profile plots itself out from it (the approach behind it is the film's values so
//      far: 20 W, world1's 2 kW spike "briefly", 700 W, 150 MW, 1 GW), and the value lands huge: 20 TW.
//   2  Then a static sheet, one graphic cut per sung word. On each word the dot stands on a peak; the
//      plotter reveals a higher one beyond it, so the peak it stands on is stamped FALSE SUMMIT and its
//      value lands (the Kardashev climb, one real value per word); a dashed sight line at the peak's
//      level runs into the higher ground; the dot writes the sung word along it by hand (the pen tip is
//      the cursor), inks the rest of the line, lands on the flank and climbs a step per beat to arrive on
//      the next peak with the next word, where the chart re-fits to the new, higher peak.
//   3  After the last word the ground keeps rising past the last false summit (unsurveyed, up and to the
//      right); a 16th-note strobe recaps the values and lands on "—".
//  tail (the end card, no rewind; energy follows the music down)
//      The sheet, reframed; the line is plotted on up and out of the frame, a step per beat; four beats
//      before the drums stop a match line is ruled at the edge and the note builds word by word:
//      MATCH LINE — SEE SHEET 2 / summit (est.): — , the dash landing where the drums stop. The dot keeps
//      climbing, slower and slower, its value still ticking in the last frame.
// Every time comes from the lyrics (the lines in the window, by position) and the beat grid.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { strokeText, type StrokeText } from '../engine/stroke';
import { clamp, ease, frameIdx, hash, lerp, mulberry32, noise1, prog, pulse, smoothstep, TAU } from '../engine/util';
import { dot2D, burst2D, siW, HANDOFF } from './_power';
import {
  Route, PEAKS, XA, XR0, YB, type View, type Val, lerpView, sx, sy, view0, viewFit, viewCard, fmtW,
} from './summit-geo';

type C2 = CanvasRenderingContext2D;
type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

const MONO = F.mono(400), MONO_M = F.mono(500);
const GAP = 16; // peak → start of its word on the sight line
const WMAX = 66; // largest handwriting (px per em)
const XM = 1792; // the match line (sheet x)
const STEP = 0.11; // one quantised step (s)
const E_MAX = 52; // the elevation scale's last tick, 10⁵² W (c⁵/G = 3.6×10⁵² W)
const expSize = (size: number) => Math.max(size * 0.58, Math.min(size * 0.82, 9.5));

export default class Summit extends Scene {
  L = new Layer2D();
  lb = new LineBatch(9000, { blend: 'add' });
  ground = new FSPass(/* glsl */ `
    uniform sampler2D tex; uniform vec3 cam; uniform float gridK, black, hot; uniform vec2 revC;
    void main() {
      vec2 sp = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);         // logical px, y down
      vec2 w = (sp - cam.xy) / cam.z + cam.xy;                 // sheet px (the end card's slow push)
      float yy = FRAG_PX.y / 1080.0;
      vec3 g = mix(toLinear(vec3(0.043, 0.050, 0.050)), toLinear(vec3(0.090, 0.104, 0.100)), yy);
      vec2 c1 = abs(fract(w / 60.0 + 0.5) - 0.5) * 60.0 * cam.z;
      vec2 c2 = abs(fract(w / 240.0 + 0.5) - 0.5) * 240.0 * cam.z;
      float gl = 0.2 * pxLine(min(c1.x, c1.y), 0.3, 1.2) + 0.42 * pxLine(min(c2.x, c2.y), 0.45, 1.45);
      float r = length(sp - revC);
      float reveal = smoothstep(gridK * 2600.0 + 90.0, gridK * 2600.0 - 90.0, r);
      g += toLinear(vec3(0.17, 0.19, 0.18)) * gl * 0.42 * reveal;
      g = mix(g, C_INK, black);
      vec4 s = texture(tex, vUv);
      float h = smoothstep(0.25, 0.7, s.b - s.r * 1.3);        // only the blue glows
      fragColor = vec4(mix(g, s.rgb * (1.0 + hot * h), s.a), 1.0);
    }`, {
    tex: { value: null }, cam: { value: new THREE.Vector3(W / 2, H / 2, 1) }, gridK: { value: 1 }, black: { value: 0 },
    hot: { value: 1.6 }, revC: { value: new THREE.Vector2(W / 2, H / 2) },
  });

  R!: Route;
  tail = false;
  // ---- timing (song seconds, all from init)
  tD = 0; S1 = 0; TEND = 0;
  n = 0;
  ws: number[] = []; we: number[] = []; texts: string[] = [];
  st: StrokeText[] = [];
  vals: Val[] = [];
  beats: number[] = [];
  tw1: number[] = []; tl: number[] = [];
  climb: [number, number][][] = [];
  tStrobe = 0; tStop = 0; tc: number[] = [];
  fSteps: number[] = []; dSteps: number[] = [];
  uF0 = 0; uExit = 0;
  eL = 0; eStop = 0; eEnd = 0;
  V0!: View; Vc!: View;
  strobeSeq: (Val | null)[] = [];
  ratio0 = '';

  override init() {
    const { lyrics: ly, audio: au, params, start, end } = this.ctx;
    this.tail = !!params.tail;
    this.S1 = this.tail ? start : end;
    this.TEND = this.tail ? end : au.duration;
    // the window's lines, by position: the timeline cuts submit on the beat at/before the first "submit"
    const first = ly.get('submit');
    this.tD = this.tail ? au.timeOfBeat(Math.floor(au.beatAt(first.words[0]!.start + 0.02))) : start;
    const lines = ly.lines.filter((l) => l.words.length > 0 && l.start >= this.tD - 0.05 && l.start < this.S1 - 0.3);
    if (lines.length === 0) throw new Error('summit: no lines in the submit window');
    const n = (this.n = lines.length);
    this.ws = lines.map((l) => l.words[0]!.start);
    this.we = lines.map((l) => l.words[l.words.length - 1]!.end);
    this.texts = lines.map((l) => l.text.trim());
    this.st = this.texts.map((s) => strokeText(s, 'hscript', 100));
    const pick = (i: number) => (n <= PEAKS.length ? (n === 1 ? PEAKS.length - 1 : Math.round((i * (PEAKS.length - 1)) / (n - 1))) : Math.min(i, PEAKS.length - 1));
    const values = lines.map((_, i) => PEAKS[pick(i)]!);
    this.R = new Route(values.map((v) => ({ w: v.w, note: v.note })));
    this.vals = values.map((v) => fmtW(v.w, siW));
    this.ratio0 = `×${Math.round(values[0]!.w / 1e9).toLocaleString('en-US')}`; // from hook 4's 1 GW
    this.beats = au.beats.filter((b) => b > this.tD - 0.01 && b < this.TEND + 1);
    this.V0 = view0(this.R); this.Vc = viewCard(this.R);

    // the strobe recap: the last two beats of submit (if the singing is over by then)
    const bS1 = Math.round(au.beatAt(this.S1));
    this.tStrobe = au.timeOfBeat(bS1 - 2);
    if (this.tStrobe < this.we[n - 1]! + 0.5) this.tStrobe = this.S1;
    const si = Array.from({ length: Math.min(7, n) }, (_, k) => (n <= 7 ? k : Math.round((k * (n - 1)) / 6)));
    this.strobeSeq = [...new Set(si)].map((i) => this.vals[i]!);
    this.strobeSeq.push(null);

    // the dot: writes each word along its sight line, inks on to the flank, climbs a step per beat
    for (let p = 0; p < n; p++) {
      const next = p < n - 1 ? this.ws[p + 1]! : this.tStrobe;
      const wd = clamp(this.we[p]! - this.ws[p]!, 0.2, Math.max(0.2, 0.72 * (next - this.ws[p]!)));
      this.tw1.push(this.ws[p]! + wd);
      this.tl.push(this.tw1[p]! + Math.max(0.04, Math.min(0.12, 0.3 * (next - this.tw1[p]!))));
      if (p < n - 1) {
        const arr = this.ws[p + 1]!;
        const bs = this.beats.filter((b) => b > this.tl[p]! + 0.05 && b < arr - 0.16);
        const steps: [number, number][] = bs.map((b) => [b, b + STEP]);
        const s = Math.max(this.tl[p]!, arr - 0.1);
        steps.push([Math.min(s, arr - 0.01), arr]);
        this.climb.push(steps);
      }
    }
    // drums stop: the downbeat the end card's last element lands on (P(doom)'s NaN)
    let jStop = 8;
    for (let j = 5; j <= 16; j++) {
      const tj = au.timeOfBeat(bS1 + j);
      if (tj > this.TEND - 0.8) break;
      if (au.env('drums', tj + 0.15) < 0.25 && au.env('drums', tj + 0.6) < 0.25) { jStop = j; break; }
    }
    this.tStop = au.timeOfBeat(bS1 + jStop);
    this.tc = [0, 1, 2, 3, 4].map((k) => au.timeOfBeat(bS1 + jStop - 4 + k));
    // the endless flank: the plotter steps up it per beat and leaves the sheet as the match line lands
    const last = this.R.peaks[n - 1]!;
    this.uF0 = last.land + 0.3;
    this.uExit = Math.max(this.uF0 + 0.5, (() => { let u = this.uF0; while (sx(this.Vc, u) < W + 16 && u < this.R.uEnd - 0.1) u += 0.01; return u; })());
    this.fSteps = this.beats.filter((b) => b > this.tl[n - 1]! + 0.05 && b <= this.tc[0]! + 0.01);
    this.dSteps = this.beats.filter((b) => b > this.tl[n - 1]! + 0.05 && b <= this.tStop + 0.01);
    this.eL = last.e;
    this.eEnd = Math.min(last.e + 2.7, 52.45); // stays under c⁵/G (3.6×10⁵² W): the numbers stay physical
    this.eStop = last.e + 0.66 * (this.eEnd - last.e);
  }

  // ================================================================== state
  private wordIdx(t: number) { let p = -1; for (let i = 0; i < this.n; i++) if (t >= this.ws[i]!) p = i; return p; }
  private viewOf(k: number): View { return k <= 1 ? this.V0 : viewFit(this.R, Math.min(k, this.n - 1)); }
  private viewAt(t: number): View {
    if (t >= this.S1) return this.Vc;
    const idx = this.wordIdx(t) + 1; // words started
    if (idx <= 1) return this.V0;
    const k = ease.outExpo(clamp((t - this.ws[idx - 1]!) / 0.14));
    return lerpView(this.viewOf(idx - 1), this.viewOf(idx), k);
  }
  /** The end card's slow push (sheet → screen), with small punches on the card's beats. */
  private camAt(t: number) {
    if (t < this.S1) return { cx: W / 2, cy: H / 2, z: 1 };
    let z = 1 + 0.06 * ease.inOutCubic(prog(t, this.S1, this.TEND));
    for (const k of this.tc) if (t >= k && k <= this.tStop) z += 0.008 * pulse(t, k, 0.07);
    return { cx: 1300, cy: 420, z };
  }
  /** The ridge's plotted extent. */
  private extent(t: number) {
    const P = this.R.peaks, n = this.n;
    const uL = lerp(P[0]!.u, 0, prog(t, this.tD, this.tD + 0.5, ease.outExpo));
    let uR = lerp(P[0]!.u, P[0]!.cu + 0.1, prog(t, this.tD, this.tD + 0.3, ease.outExpo));
    let solid = P[0]!.u, plot = 0;
    for (let p = 0; p < n; p++) {
      if (t < this.ws[p]!) break;
      const k = prog(t, this.ws[p]!, this.ws[p]! + 0.16, ease.outExpo);
      if (p < n - 1) { uR = lerp(uR, P[p + 1]!.u + 0.2, k); solid = lerp(solid, P[p + 1]!.u, k); }
      else { uR = lerp(uR, this.uF0, k); solid = uR; }
      plot = k < 1 ? 1 : 0;
    }
    if (t >= this.ws[n - 1]!) {
      const m = this.fSteps.length;
      for (const s of this.fSteps) {
        const k = prog(t, s, s + STEP, ease.outExpo);
        uR += ((this.uExit - this.uF0) / Math.max(1, m)) * k;
        if (k > 0 && k < 1) plot = 1;
      }
      solid = uR;
    }
    return { uL, uR, solid, plot };
  }
  /** The dot on the endless flank: an elevation (log W) that steps per beat, then creeps and never stops. */
  private eDot(t: number) {
    let e = this.eL;
    const m = this.dSteps.length;
    for (const s of this.dSteps) e += ((this.eStop - this.eL) / Math.max(1, m)) * prog(t, s, s + 0.14, ease.outExpo);
    if (t > this.tStop) {
      const tau = 4.2;
      e += (this.eEnd - this.eStop) * (1 - Math.exp(-(t - this.tStop) / tau)) / (1 - Math.exp(-(this.TEND - this.tStop) / tau));
    }
    return e;
  }
  private wordLay(p: number, v: View) {
    const P = this.R.peaks[p]!;
    const x = sx(v, P.u), y = sy(v, P.e), xl = sx(v, P.land);
    const w100 = Math.max(1, this.st[p]!.width);
    const size = clamp((xl - x - GAP - 14) / (w100 / 100), 11, WMAX);
    return { x, y, xl, x0: x + GAP, base: y - 9, k: size / 100, size };
  }
  private penAt(st: StrokeText, len: number) {
    let head = { x: 0, y: 0 };
    for (let i = 0; i < st.strokes.length; i++) {
      const s0 = st.startLen[i]!, pts = st.strokes[i]!, L = st.lens[i]!;
      if (s0 > len) break;
      const r = len - s0;
      let j = 1;
      while (j < pts.length && L[j]! <= r) j++;
      if (j < pts.length) { const a = pts[j - 1]!, b = pts[j]!, u = (r - L[j - 1]!) / Math.max(1e-6, L[j]! - L[j - 1]!); return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }; }
      head = pts[pts.length - 1]!;
    }
    return head;
  }
  /** The dot: screen position (sheet px), and what it is doing. */
  private dotAt(t: number, v: View): { x: number; y: number; mode: 'peak' | 'write' | 'slide' | 'climb'; p: number } {
    const P = this.R.peaks;
    const p = this.wordIdx(t);
    if (p < 0) return { x: sx(v, P[0]!.u), y: sy(v, P[0]!.e), mode: 'peak', p: 0 };
    const pk = P[p]!;
    if (t < this.tw1[p]!) {
      const wl = this.wordLay(p, v), st = this.st[p]!;
      const h = this.penAt(st, st.total * prog(t, this.ws[p]!, this.tw1[p]!));
      return { x: wl.x0 + h.x * wl.k, y: wl.base + h.y * wl.k, mode: 'write', p };
    }
    if (t < this.tl[p]!) {
      const wl = this.wordLay(p, v), st = this.st[p]!;
      const h = this.penAt(st, st.total);
      const k = prog(t, this.tw1[p]!, this.tl[p]!, ease.outExpo);
      return { x: lerp(wl.x0 + h.x * wl.k, wl.xl, k), y: lerp(wl.base + h.y * wl.k, wl.y, Math.min(1, k * 3)), mode: 'slide', p };
    }
    if (p < this.n - 1) {
      const f = this.climbF(p, t);
      const u = lerp(pk.land, P[p + 1]!.u, f);
      return { x: sx(v, u), y: sy(v, this.R.eAt(u)), mode: 'climb', p };
    }
    const e = this.eDot(t), u = this.R.flankU(e);
    return { x: sx(v, u), y: sy(v, e), mode: 'climb', p };
  }
  private climbF(p: number, t: number) {
    const s = this.climb[p]!;
    let f = 0;
    for (const [a, b] of s) f += ease.outExpo(clamp((t - a) / Math.max(1e-3, b - a))) / s.length;
    return f;
  }
  private dotU(t: number, p: number) {
    const P = this.R.peaks;
    if (t < this.tl[p]!) return P[p]!.land;
    if (p < this.n - 1) return lerp(P[p]!.land, P[p + 1]!.u, this.climbF(p, t));
    return this.R.flankU(this.eDot(t));
  }

  // ================================================================== render
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const L = this.L; L.clear();
    const c = L.ctx;
    const o: PostOverrides = { bloom: 0.62, bloomThreshold: 1.0, bloomKnee: 0.3, bloomRadius: 0.6, halation: 0.18, ca: 0.6, vignette: 0.42, grain: 0.055 };
    const g = this.ground.u;
    const strobe = t >= this.tStrobe && t < this.S1;
    let det = false;

    if (strobe) {
      this.drawStrobe(c, t, o);
    } else {
      const v = this.viewAt(t);
      const cam = this.camAt(t);
      c.save();
      c.setTransform(cam.z, 0, 0, cam.z, cam.cx * (1 - cam.z), cam.cy * (1 - cam.z));
      const ex = this.extent(t);
      this.drawAxis(c, t, v);
      this.drawTerrain(c, t, v, ex);
      this.drawApproach(c, t, v, ex.uL);
      this.drawSight(c, t, v);
      this.drawWords(c, t, v);
      this.drawTags(c, t, v);
      if (t >= this.S1) this.drawCard(c, t, v);
      this.drawDot(c, t, v, ex);
      c.restore();
      det = t < this.ws[Math.min(1, this.n - 1)]! && t < this.tD + 2.4;
      (g.cam!.value as THREE.Vector3).set(cam.cx, cam.cy, cam.z);
    }

    g.tex!.value = L.upload();
    g.black!.value = strobe ? 1 : 0;
    g.hot!.value = strobe ? 0.55 : 1.6;
    g.gridK!.value = prog(t, this.tD, this.tD + 0.7, ease.outCubic);
    (g.revC!.value as THREE.Vector2).set(HANDOFF.summit.x, HANDOFF.summit.y);
    if (strobe) (g.cam!.value as THREE.Vector3).set(W / 2, H / 2, 1);
    this.ground.render(renderer, out);
    if (det) this.detonation(t, out, o);

    // ---- post: the detonation is the only big hit; a punch per word, a nudge per kick
    if (!strobe && !det && t < this.S1) {
      const p = this.wordIdx(t);
      const wp = p >= 1 ? pulse(t, this.ws[p]!, 0.07) : 0;
      o.zoom = 1 + 0.02 * wp + 0.005 * f.a.kick;
      const sh = 5 * wp;
      o.shake = [noise1(t * 60, 1) * sh, noise1(t * 60, 2) * sh];
      o.ca = 0.6 + 1.2 * wp;
    }
    if (t >= this.S1) {
      const quiet = smoothstep(this.tStop, this.tStop + 2, t);
      o.bloom = 0.6 - 0.1 * quiet;
      o.grain = 0.055 + 0.01 * quiet;
      o.vignette = 0.42 + 0.06 * quiet;
      o.exposure = 1 - 0.07 * quiet; // winds down with the music; the dot and its number keep going
      const dash = t >= this.tc[4]! ? pulse(t, this.tc[4]!, 0.09) : 0;
      o.zoom = 1 + 0.012 * dash;
      o.ca = 0.5 + 1.5 * dash;
    }
    return o;
  }

  // ================================================================== the detonation (frame 1)
  private detonation(t: number, out: THREE.WebGLRenderTarget, o: PostOverrides) {
    const lb = this.lb; lb.clear();
    const age = t - this.tD;
    const cx = HANDOFF.summit.x, cy = HANDOFF.summit.y;
    const end = this.ws[Math.min(1, this.n - 1)]!;
    const fadeOut = 1 - smoothstep(end - 0.6, end - 0.02, t);
    const rnd = mulberry32(99);
    const grow = ease.outExpo(clamp(age / 1.4));
    const bone = mul(LIN.bone, 0.6), hot = mul(LIN.signal, 2.6);
    const thin = 1 - smoothstep(0.18, 1.05, age); // the streaks clear so the sheet can be read
    for (let i = 0; i < 2600; i++) {
      const a = rnd() * TAU, sp = 0.2 + rnd() ** 2 * 1.4, r0 = rnd() * 40;
      const len = 60 + rnd() * 380;
      const isHot = rnd() < 0.24;
      const r1 = r0 + grow * sp * 1400;
      const tail = Math.max(r0, r1 - len * (0.3 + grow));
      lb.seg2(cx + Math.cos(a) * tail, cy + Math.sin(a) * tail, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, isHot ? 1.8 : 1, isHot ? hot : bone, fadeOut * thin * (1 - grow * 0.45));
    }
    // a shockwave on each of the first four beats: rings that wobble like contour lines
    const b0 = Math.round(this.ctx.audio.beatAt(this.tD));
    for (let k = 0; k < 4; k++) {
      const tk = this.ctx.audio.timeOfBeat(b0 + k);
      const ak = t - tk;
      if (ak < 0 || ak > 1.2) continue;
      const R = ease.outCubic(ak / 1.2) * 1300;
      const segs = 180, col = mul(LIN.signal, 2.2);
      const rr = (s: number) => R * (1 + 0.035 * noise1(s * 0.09 + k * 7, 3) + 0.015 * noise1(s * 0.33, 4 + k));
      for (let s = 0; s < segs; s++) {
        const a0 = (s / segs) * TAU, a1 = ((s + 1) / segs) * TAU, q0 = rr(s), q1 = rr(s + 1 === segs ? 0 : s + 1);
        lb.seg2(cx + Math.cos(a0) * q0, cy + Math.sin(a0) * q0, cx + Math.cos(a1) * q1, cy + Math.sin(a1) * q1, 2.5 * (1 - ak / 1.2) + 0.5, col, (1 - ak / 1.2) * fadeOut);
      }
    }
    lb.render(this.ctx.renderer, out);
    o.flash = 1.3 * Math.pow(0.5, age / 0.045);
    const sh = 26 * Math.pow(0.5, age / 0.35);
    o.shake = [Math.sin(t * 90) * sh, Math.cos(t * 77) * sh];
    o.zoom = 1 + 0.06 * Math.pow(0.5, age / 0.15);
    o.ca = 0.8 + 5 * Math.pow(0.5, age / 0.2);
    o.exposure = 1 + 0.5 * Math.pow(0.5, age / 0.06);
    o.bloom = 0.8;
  }

  // ================================================================== the sheet
  private drawAxis(c: C2, t: number, v: View) {
    const k = prog(t, this.tD + 0.04, this.tD + 0.5, ease.outExpo);
    if (k <= 0) return;
    // the scale ends at 10⁵² W (c⁵/G is 3.6×10⁵² W): above it the ground has no numbers
    const yEnd = Math.max(96, sy(v, E_MAX));
    const yTop = lerp(YB, yEnd, k);
    c.save();
    c.fillStyle = rgba('bone', 0.5);
    c.fillRect(XA, yTop, 1, YB - yTop);
    // the datum
    const xr = t >= this.S1 ? XM + 60 : W - 70;
    c.fillRect(XA, YB, (xr - XA) * k, 1);
    c.textAlign = 'right';
    const pxd = (YB - v.yT) / v.eTop;
    const every = pxd * 3 >= 36 ? 3 : pxd * 6 >= 36 ? 6 : 9;
    for (let e = 0; e <= E_MAX; e++) {
      const y = sy(v, e);
      if (y < yTop - 0.5) break;
      const major = e % 3 === 0;
      c.fillStyle = rgba('bone', major ? 0.55 : 0.3);
      c.fillRect(XA - (major ? 10 : 5), Math.round(y), major ? 10 : 5, 1);
      if (e % every === 0) {
        c.fillStyle = rgba('ash', 0.9);
        this.drawVal(c, axisVal(e), XA - 16, y + 5, 14, MONO, 'right');
      }
    }
    c.textAlign = 'left';
    const n = Math.floor(prog(t, this.tD + 0.3, this.tD + 0.7) * 13);
    c.font = font(MONO_M, 12); c.letterSpacing = '2px'; c.fillStyle = rgba('ash', 0.85);
    c.fillText('ELEVATION, W'.slice(0, n), XA + 10, yTop + 6);
    // the legend, typed on the first re-fit
    if (this.n > 1 && t >= this.ws[1]!) {
      const s = 'CONTOUR INTERVAL ×10 · HORIZONTAL SCALE NTS · DATUM 1 W';
      const m = Math.floor(prog(t, this.ws[1]! + 0.05, this.ws[1]! + 0.6) * s.length);
      c.fillText(s.slice(0, m), XR0, YB + 44);
    }
    c.restore();
  }

  private ridgePts(v: View, u0: number, u1: number) {
    const R = this.R, pts: { x: number; y: number }[] = [];
    if (u1 <= u0) return pts;
    const i0 = Math.ceil(u0 / R.du), i1 = Math.floor(u1 / R.du);
    pts.push({ x: sx(v, u0), y: sy(v, R.eAt(u0)) });
    let lastX = -1e9;
    for (let i = i0; i <= i1; i++) {
      const x = sx(v, R.us[i]!);
      if (x - lastX < 0.6 && i < i1) continue; // compressed stretches: one point per ~px
      lastX = x;
      pts.push({ x, y: sy(v, R.es[i]!) });
      if (x > W + 200) break;
    }
    pts.push({ x: sx(v, u1), y: sy(v, R.eAt(u1)) });
    return pts;
  }

  private drawTerrain(c: C2, t: number, v: View, ex: { uL: number; uR: number; solid: number; plot: number }) {
    if (t < this.tD) return;
    const pts = this.ridgePts(v, ex.uL, ex.uR);
    if (pts.length < 2) return;
    const tailK = t >= this.S1 ? prog(t, this.tc[0]!, this.tc[0]! + 0.3) : 0; // beyond the match line: sheet 2
    const path = new Path2D();
    path.moveTo(pts[0]!.x, YB);
    for (const p of pts) path.lineTo(p.x, p.y);
    path.lineTo(pts[pts.length - 1]!.x, YB);
    path.closePath();
    c.save();
    let yMin = YB;
    for (const p of pts) if (p.x > 0 && p.x < W) yMin = Math.min(yMin, p.y);
    const gr = c.createLinearGradient(0, yMin, 0, YB);
    gr.addColorStop(0, 'rgba(31,37,35,0.95)'); gr.addColorStop(1, 'rgba(19,23,22,0.95)');
    c.fillStyle = gr;
    c.fill(path);
    // contour-style ticks: one hairline per decade inside the ground
    c.clip(path);
    for (let e = 1; ; e++) {
      const y = sy(v, e);
      if (y < 30) break;
      c.fillStyle = rgba('bone', e % 3 === 0 ? 0.16 : 0.075);
      c.fillRect(XR0, Math.round(y), W + 400, 1);
    }
    const xe = pts[pts.length - 1]!.x;
    if (xe < W + 10) {
      const fg = c.createLinearGradient(xe - 150, 0, xe, 0);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0.9)');
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = fg;
      c.fillRect(xe - 150, 0, 152, YB);
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
    // the ridge line: drafted in bone; the unsurveyed stretch beyond the newest peak dashed
    const solidX = sx(v, ex.solid);
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = rgba('bone', 0.93); c.lineWidth = 1.9;
    c.beginPath();
    let started = false;
    const cut = t >= this.S1 && tailK > 0 ? XM : Infinity;
    for (const p of pts) {
      if (p.x > solidX + 0.5 || p.x > cut) break;
      if (!started) { c.moveTo(p.x, p.y); started = true; } else c.lineTo(p.x, p.y);
    }
    c.stroke();
    const rest = pts.filter((p) => p.x >= Math.min(solidX, cut) - 1);
    if (rest.length > 1) {
      c.setLineDash(cut < Infinity ? [14, 7] : [6, 6]);
      c.strokeStyle = rgba('bone', cut < Infinity ? 0.55 : 0.4); c.lineWidth = 1.4;
      c.beginPath(); rest.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
    }
    c.restore();
    // the plotter's head while it draws
    if (ex.plot > 0) {
      const hp = pts[pts.length - 1]!;
      if (hp.x < W + 20) dot2D(c, hp.x, hp.y, t, 0.35, 0.9, 0);
    }
  }

  /** The film's values so far, along the approach (hooks 1–4, and world1's spike). */
  private drawApproach(c: C2, t: number, v: View, uL: number) {
    const w = sx(v, 1.25) - sx(v, 0);
    const a = clamp((w - 260) / 80); // only while the approach has room (the detonation's view)
    if (a <= 0.01) return;
    c.save();
    c.font = font(MONO, 13);
    for (const lab of this.R.labels) {
      if (lab.u < uL - 0.01) continue;
      const x = sx(v, lab.u), y = sy(v, this.R.eAt(lab.u));
      const wall = lab.text.includes('briefly');
      c.fillStyle = rgba('bone', 0.45 * a);
      c.fillRect(Math.round(x), y - (wall ? 40 : 16), 1, wall ? 34 : 10);
      c.fillStyle = rgba('ash', 0.9 * a);
      c.textAlign = wall || lab.u === 0 ? 'left' : 'right';
      c.fillText(lab.text, x + (wall || lab.u === 0 ? 5 : -5), y - (wall ? 42 : 18));
      c.textAlign = 'left';
    }
    c.restore();
  }

  /** The sight lines (dashed, at each crested peak's level, into the higher ground) and the dot's inked route. */
  private drawSight(c: C2, t: number, v: View) {
    const P = this.R.peaks;
    const cur = this.wordIdx(t);
    c.save();
    for (let p = 0; p <= cur; p++) {
      const pk = P[p]!;
      const x = sx(v, pk.u), y = sy(v, pk.e), xl = sx(v, pk.land);
      const k = prog(t, this.ws[p]! + 0.02, this.ws[p]! + 0.12, ease.outExpo);
      c.setLineDash([5, 6]);
      c.strokeStyle = rgba('bone', 0.42); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + 4, y); c.lineTo(lerp(x + 4, xl, k), y); c.stroke();
      c.fillStyle = rgba('bone', 0.6 * k);
      c.fillRect(xl - 0.5, y - 5, 1, 10); // where the higher ground meets the level
      c.setLineDash([]);
      // ink: the level line behind the pen, then the climb
      const past = p < cur || t >= this.tl[p]!;
      const d = past ? null : this.dotAt(t, v);
      const inkX = past ? xl : Math.max(x, d!.x);
      const fresh = p === cur ? 1 : 0.55;
      c.strokeStyle = rgba('signal', 0.95 * fresh); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x, y); c.lineTo(inkX, y); c.stroke();
      if (t >= this.tl[p]!) {
        const u1 = this.dotU(t, p);
        const pts = this.ridgePts(v, pk.land, u1);
        c.lineWidth = 2.4; c.lineJoin = 'round';
        c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.stroke();
      }
    }
    c.restore();
  }

  /** Each sung word, handwritten along its sight line by the dot. */
  private drawWords(c: C2, t: number, v: View) {
    const cur = this.wordIdx(t);
    const fb = Math.floor(frameIdx(t) / 3);
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let p = 0; p <= cur; p++) {
      const st = this.st[p]!;
      const len = st.total * prog(t, this.ws[p]!, this.tw1[p]!);
      if (len <= 0) continue;
      const wl = this.wordLay(p, v);
      const cool = prog(t, this.we[p]!, this.we[p]! + 0.35);
      c.strokeStyle = cool < 1 ? mixCss('#2F5BFF', '#EEE9DF', cool) : rgba('bone', p === cur ? 0.95 : 0.8);
      c.lineWidth = clamp(1 + wl.size * 0.028, 1.15, 2.6);
      const J = 1.3;
      c.beginPath();
      for (let i = 0; i < st.strokes.length; i++) {
        const s0 = st.startLen[i]!;
        if (s0 >= len) break;
        const pts = st.strokes[i]!, Ls = st.lens[i]!;
        const r = len - s0;
        const X = (q: { x: number; y: number }, j: number) => wl.x0 + (q.x + (hash(p, i, j, fb) - 0.5) * J) * wl.k;
        const Y = (q: { x: number; y: number }, j: number) => wl.base + (q.y + (hash(p, i, j, fb, 9) - 0.5) * J) * wl.k;
        c.moveTo(X(pts[0]!, 0), Y(pts[0]!, 0));
        for (let j = 1; j < pts.length; j++) {
          if (Ls[j]! <= r) { c.lineTo(X(pts[j]!, j), Y(pts[j]!, j)); continue; }
          const a = pts[j - 1]!, b = pts[j]!, u = (r - Ls[j - 1]!) / Math.max(1e-6, Ls[j]! - Ls[j - 1]!);
          c.lineTo(wl.x0 + (a.x + (b.x - a.x) * u) * wl.k, wl.base + (a.y + (b.y - a.y) * u) * wl.k);
          break;
        }
      }
      c.stroke();
    }
    c.restore();
  }

  // ================================================================== labels
  private drawTags(c: C2, t: number, v: View) {
    const P = this.R.peaks, n = this.n;
    const cur = this.wordIdx(t);
    c.save();
    c.textBaseline = 'alphabetic';
    for (let p = 0; p < n; p++) {
      const crested = cur >= p;
      const revealed = p > 0 && cur >= p - 1;
      if (!crested && revealed) this.drawPending(c, t, v, p);
      if (!crested) continue;
      const current = p === cur && t < (p === n - 1 ? this.tStrobe : this.ws[p + 1]!);
      if (current) this.drawCallout(c, t, v, p);
      else this.drawSmallTag(c, v, p, 1);
    }
    // the first peak's value lands with the detonation, before the first word
    if (cur < 0 && t >= this.tD) this.drawCallout(c, t, v, 0);
    c.restore();
    void P;
  }

  /** A revealed, unclimbed peak: "summit (est.): —". */
  private drawPending(c: C2, t: number, v: View, p: number) {
    const pk = this.R.peaks[p]!;
    const t0 = this.ws[p - 1]! + 0.12;
    const a = prog(t, t0, t0 + 0.08);
    if (a <= 0) return;
    const x = sx(v, pk.u), y = sy(v, pk.e);
    c.fillStyle = rgba('bone', 0.45 * a);
    c.fillRect(Math.round(x), y - 50, 1, 38);
    c.font = font(MONO, 15);
    c.fillStyle = rgba('ash', 0.9 * a);
    const s = 'summit (est.): —';
    c.fillText(s.slice(0, Math.ceil(s.length * prog(t, t0, t0 + 0.2))), x + 7, y - 40);
  }

  /** A past false summit: value and stamp stacked above its word, sized to its column. */
  private drawSmallTag(c: C2, v: View, p: number, a: number) {
    const wl = this.wordLay(p, v);
    const col = wl.xl - wl.x0 - 4;
    const w1 = this.valW(this.vals[p]!, 100, MONO_M) / 100;
    const vs = Math.min(18, col / w1);
    if (vs < 7.5) return; // no room: the word alone
    const capH = (this.st[p]!.capHeight || 60) * wl.k;
    const yv = wl.base - capH - 10;
    c.fillStyle = rgba('bone', 0.85 * a);
    this.drawVal(c, this.vals[p]!, wl.x0, yv, vs, MONO_M, 'left');
    // FALSE SUMMIT, as wide as the column allows (12 letters, tracked 0.18 em)
    const fs = Math.min(vs * 0.66, col / (12 * 0.6 + 11 * 0.18));
    if (fs < 6.5) return;
    c.font = font(MONO_M, fs); c.letterSpacing = `${(fs * 0.18).toFixed(2)}px`;
    c.fillStyle = rgba('ash', 0.9 * a);
    c.fillText('FALSE SUMMIT', wl.x0, yv - vs * 0.78 - 5);
    c.letterSpacing = '0px';
  }

  /** The current false summit: P(doom)'s big number, hung from the peak on a leader. */
  private drawCallout(c: C2, t: number, v: View, p: number) {
    const pk = this.R.peaks[p]!;
    const x = sx(v, pk.u), y = sy(v, pk.e);
    const val = this.vals[p]!;
    const big = p === 0 && (this.n < 2 || t < this.ws[1]!);
    const xr = x - 28;
    const w1 = this.valW(val, 100, MONO) / 100;
    const size = Math.min(big ? 190 : 146, (xr - 210) / w1);
    const wv = w1 * size, cap = size * 0.698;
    const yb = big ? y - 112 : Math.min(270, y - 98);
    const x0 = xr - wv;
    const t0 = p === 0 ? this.tD + 0.06 : this.ws[p]!;
    const age = t - t0;
    const appear = p === 0 ? smoothstep(0, 0.14, age) : 1;
    if (appear <= 0) return;
    const blow = p === 0 ? Math.pow(0.5, age / 0.5) : 0; // blown about by the rings
    const jx = Math.sin(t * 61) * 7 * blow, jy = Math.cos(t * 47) * 7 * blow;
    const fsz = big ? 28 : 24, fsY = yb - cap - (big ? 30 : 26);
    const stamp = this.n > 0 && t >= this.ws[p]! + 0.03;
    // the leader: up from the peak, a shoulder toward the number
    c.fillStyle = rgba('bone', 0.55 * appear);
    const top = fsY - fsz * 0.75;
    c.fillRect(Math.round(x), top, 1, y - 14 - top);
    c.fillRect(xr + 8, top, Math.round(x) - xr - 8, 1);
    // the number: slams in, white-hot for a moment
    const s = 1 + 0.1 * (1 - ease.outExpo(clamp(age / 0.16)));
    c.save();
    c.translate(xr + jx, yb + jy); c.scale(s, s); c.translate(-xr, -yb);
    c.globalAlpha = appear;
    c.fillStyle = age < 0.05 ? '#EEF2FF' : rgba('bone', 0.97);
    this.drawVal(c, val, x0, yb, size, MONO, 'left');
    c.restore();
    // FALSE SUMMIT: stamped the moment the higher peak shows
    if (stamp) {
      const sa = t - this.ws[p]! - 0.03;
      const ss = 1 + 0.35 * (1 - ease.outExpo(clamp(sa / 0.1)));
      c.save();
      c.translate(x0, fsY); c.scale(ss, ss);
      c.globalAlpha = clamp(sa / 0.03);
      c.font = font(MONO_M, fsz); c.letterSpacing = `${Math.round(fsz * 0.34)}px`;
      c.fillStyle = rgba('signal');
      c.fillText('FALSE SUMMIT', 0, 0);
      c.restore();
      c.letterSpacing = '0px';
      // the note, typed; wrapped to the number's width so the leader stays clear of it
      const note = p === 0 ? `${this.ratio0} · ${pk.note}` : pk.note;
      const nsz = big ? 23 : 21;
      const lines: string[] = [];
      for (const w of note.split(' ')) {
        const l = lines[lines.length - 1];
        if (l !== undefined && measure(`${l} ${w}`, MONO, nsz) <= xr - x0) lines[lines.length - 1] = `${l} ${w}`;
        else lines.push(w);
      }
      let nn = Math.ceil(note.length * prog(t, this.ws[p]! + 0.08, this.ws[p]! + 0.4));
      c.font = font(MONO, nsz); c.fillStyle = rgba('ash', 0.95);
      lines.forEach((l, i) => {
        if (nn <= 0) return;
        c.fillText(l.slice(0, nn), x0 + 4, yb + (big ? 46 : 40) + i * nsz * 1.3);
        nn -= l.length + 1;
      });
    }
  }

  // ================================================================== the dot
  private drawDot(c: C2, t: number, v: View, ex: { plot: number }) {
    if (t < this.tD) return;
    const d = this.dotAt(t, v);
    let fl = 0;
    for (let p = 0; p < this.n; p++) if (t >= this.ws[p]!) fl = Math.max(fl, pulse(t, this.ws[p]!, 0.08));
    for (const s of this.climb.flat()) if (t >= s[0]) fl = Math.max(fl, 0.4 * pulse(t, s[0], 0.06));
    const age = t - this.tD;
    const detK = Math.pow(0.5, age / 0.12);
    dot2D(c, d.x, d.y, t, 0.85 + 0.8 * fl + 2.6 * detK, 1);
    burst2D(c, d.x, d.y, t, this.tD, { n: 150, speed: 2000, life: 0.6, seed: 90 });
    for (let p = 0; p < this.n; p++) {
      burst2D(c, sx(v, this.R.peaks[p]!.u), sy(v, this.R.peaks[p]!.e), t, this.ws[p]!, { n: 26, speed: 700, life: 0.26, seed: 40 + p });
      burst2D(c, sx(v, this.R.peaks[p]!.land), sy(v, this.R.peaks[p]!.e), t, this.tl[p]!, { n: 10, speed: 380, life: 0.18, seed: 60 + p });
    }
    void ex;
    if (t >= this.S1) this.drawReadout(c, t, d);
  }

  /** The end card: the dot's elevation, ticking (world1's readout, again). */
  private drawReadout(c: C2, t: number, d: { x: number; y: number }) {
    const e = this.eDot(t);
    const a = prog(t, this.S1 + 0.02, this.S1 + 0.1);
    // hung below the flank (the ground rises into anything placed above it)
    const x0 = d.x + 14, y0 = d.y + 14;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 34, y0 + 34); c.lineTo(x0 + 290, y0 + 34); c.stroke();
    c.fillStyle = rgba('bone', 0.97);
    this.drawRolling(c, e, x0 + 40, y0 + 24, 34);
    c.font = font(MONO, 16); c.fillStyle = rgba('ash', 0.9);
    c.fillText('past the top', x0 + 41, y0 + 60);
    c.restore();
  }

  // ================================================================== the end card
  private drawCard(c: C2, t: number, v: View) {
    const [k0, k1, k2, k3, k4] = this.tc as [number, number, number, number, number];
    if (t < k0) return;
    c.save();
    // the match line: a heavy phantom line ruled down the sheet's edge
    const r = prog(t, k0, k0 + 0.12, ease.outExpo);
    c.setLineDash([36, 8, 7, 8, 7, 8]);
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(XM, 70); c.lineTo(XM, lerp(70, YB + 40, r)); c.stroke();
    c.setLineDash([]);
    // the note, word by word on the beats; the dash lands where the drums stop
    const l1 = ['MATCH', 'LINE', '—', 'SEE', 'SHEET', '2'];
    const l1T = [k1, k1, k1, k2, k2, k2];
    const S = 27;
    c.font = font(MONO_M, S); c.letterSpacing = '4px';
    const full1 = l1.join(' ');
    const w1 = measure(full1, MONO_M, S, 4);
    const xL = XM - 24 - w1, y1 = 132;
    let x = xL;
    l1.forEach((w, i) => {
      const a = prog(t, l1T[i]!, l1T[i]! + 0.05);
      if (a > 0) { c.fillStyle = rgba('bone', 0.95 * a); c.fillText(w, x, y1); }
      x += measure(w + ' ', MONO_M, S, 4);
    });
    c.letterSpacing = '0px';
    const S2 = 25, s2 = 'summit (est.): ', y2 = y1 + 48;
    c.font = font(MONO, S2);
    const w2 = measure(s2 + '—', MONO, S2);
    const x2 = XM - 24 - w2;
    const n2 = Math.ceil(s2.length * prog(t, k3, k3 + 0.22));
    c.fillStyle = rgba('ash', 0.95);
    c.fillText(s2.slice(0, n2), x2, y2);
    if (t >= k4) {
      const age = t - k4;
      const sc = 1 + 0.9 * (1 - ease.outExpo(clamp(age / 0.14)));
      const xd = x2 + measure(s2, MONO, S2);
      c.save();
      c.translate(xd, y2 - 7); c.scale(sc, sc);
      c.fillStyle = age < 0.06 ? '#EEF2FF' : mixCss('#2F5BFF', '#EEE9DF', prog(age, 0.06, 0.5));
      c.fillText('—', 0, 7);
      c.restore();
    }
    c.restore();
    void v;
  }

  // ================================================================== the strobe
  private drawStrobe(c: C2, t: number, o: PostOverrides) {
    const seq = this.strobeSeq, N = seq.length;
    const i = Math.min(N - 1, Math.floor(((t - this.tStrobe) / (this.S1 - this.tStrobe)) * N));
    const val = seq[i]!;
    const last = val === null;
    const size = last ? 460 : 250 + hash(i, 5) * 120;
    const blue = i % 2 === 1;
    const cx = W / 2 + (last ? 0 : (hash(i, 2) - 0.5) * 360), cy = H / 2 + 60 + (last ? 0 : (hash(i, 3) - 0.5) * 180);
    c.save();
    if (last) {
      // the estimate: a blank, ruled
      const w = 420;
      c.fillStyle = rgba('bone');
      c.fillRect(cx - w / 2, cy - 12, w, 24);
      c.font = font(MONO_M, 40); c.letterSpacing = '12px'; c.fillStyle = rgba('signal');
      c.fillText('SUMMIT (EST.):', cx - w / 2, cy - 90);
    } else {
      const sz = Math.min(size, (W - 160) / (this.valW(val, 100, MONO) / 100));
      const w = this.valW(val, sz, MONO);
      const xl = clamp(cx - w / 2, 80, W - 80 - w);
      c.fillStyle = blue ? rgba('signal') : rgba('bone');
      this.drawVal(c, val, xl, cy + sz * 0.35, sz, MONO, 'left');
      c.font = font(MONO_M, 30); c.letterSpacing = '9px'; c.fillStyle = blue ? rgba('bone', 0.9) : rgba('signal');
      c.fillText('FALSE SUMMIT', xl + 6, cy - sz * 0.55);
    }
    c.restore();
    o.ca = 2.2; o.bloom = 0.7; o.grain = 0.07;
  }

  // ================================================================== type
  /** Width of a value set at `size`. */
  private valW(v: Val, size: number, fam: string) {
    if (v.plain) return measure(v.plain, fam, size);
    const head = `${v.m ? `${v.m}×` : ''}10`;
    return measure(head, fam, size) + measure(String(v.e), fam, expSize(size)) + size * 0.08 + measure(' W', fam, size);
  }
  /** A value: "20 TW", or mantissa ×10 with a raised exponent. Baseline y; fill colour from the context. */
  private drawVal(c: C2, v: Val, x: number, y: number, size: number, fam: string, align: 'left' | 'right') {
    const ta = c.textAlign;
    c.textAlign = 'left';
    if (align === 'right') x -= this.valW(v, size, fam);
    if (v.plain) { c.font = font(fam, size); c.fillText(v.plain, x, y); c.textAlign = ta; return; }
    const head = `${v.m ? `${v.m}×` : ''}10`;
    c.font = font(fam, size); c.fillText(head, x, y);
    let xx = x + measure(head, fam, size) + size * 0.03;
    c.font = font(fam, expSize(size)); c.fillText(String(v.e), xx, y - size * 0.36);
    xx += measure(String(v.e), fam, expSize(size)) + size * 0.05;
    c.font = font(fam, size); c.fillText(' W', xx, y);
    c.textAlign = ta;
  }
  /** The ticking value: m.m×10^E W with the mantissa on rolling drums (hook's odometer). */
  private drawRolling(c: C2, e: number, x: number, y: number, size: number) {
    let E = Math.floor(e + 1e-9);
    const N = Math.pow(10, e - E) * 10; // 10 … 99.99; the tenths roll, the units and the exponent tick
    let Nr = Math.round(N);
    if (Nr >= 100) { E += 1; Nr = 10; }
    const adv = size * 0.6, rowH = size * 1.05;
    c.font = font(MONO_M, size);
    const drumAt = (k: number) => (k === 1 ? Math.floor(Nr / 10) : drum(N, 0));
    const a0 = c.globalAlpha;
    let xx = x;
    for (const k of [1, -1, 0]) {
      if (k === -1) { c.fillText('.', xx, y); xx += adv; continue; }
      const pos = drumAt(k), b0 = Math.floor(pos), fr = pos - b0;
      c.save();
      c.beginPath(); c.rect(xx - 2, y - size * 0.95, adv + 4, size * 1.25); c.clip();
      for (let j = -1; j <= 1; j++) {
        const dig = (((b0 + j) % 10) + 10) % 10;
        const off = (fr - j) * rowH;
        const a = 1 - Math.min(1, Math.abs(off) / (rowH * 0.85));
        if (a <= 0.01) continue;
        c.globalAlpha = a0 * a;
        c.fillText(String(dig), xx, y + off);
      }
      c.restore();
      xx += adv;
    }
    c.fillText('×10', xx, y);
    xx += measure('×10', MONO_M, size) + size * 0.03;
    c.font = font(MONO_M, size * 0.58); c.fillText(String(E), xx, y - size * 0.36);
    xx += measure(String(E), MONO_M, size * 0.58) + size * 0.05;
    c.font = font(MONO_M, size); c.fillText(' W', xx, y);
  }
}

/** The elevation axis's tick labels: SI up to TW, then powers of ten. */
function axisVal(e: number): Val {
  const si = ['1 W', '1 kW', '1 MW', '1 GW', '1 TW'];
  return e % 3 === 0 && e / 3 < si.length ? { plain: si[e / 3]! } : { e };
}

/** Odometer drum position for the digit 10^k of a continuous count N (hook.ts). */
function drum(N: number, k: number) {
  const p = Math.pow(10, k);
  if (k === 0) {
    const r = Math.round(N), f = N - r;
    return (((r + Math.sign(f) * 0.5 * smoothstep(0.38, 0.5, Math.abs(f))) % 10) + 10) % 10;
  }
  const q = Math.floor(N / p);
  const rem = N - q * p;
  const carry = clamp(rem - (p - 0.5), 0, 1);
  return ((q % 10) + carry + 10) % 10;
}

function mixCss(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  return `rgb(${[16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * clamp(k))).join(',')})`;
}
