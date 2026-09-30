// HOOK ×4: "WE / APPRECIATE / POWER, WE / APPRECIATE / POWER". Structure: P(doom)'s hook, move for
// move (docs/PDOOM-STRUCTURE.md): one full-frame slam per sung word, then the value takes the frame
// (the sung POWER glides into its label, the watts roll on drums, a log bar) and leaves on the cut,
// a different way each time:
//   n=1 bone on ink, clean. Frame 1 is the ignition: the dot lights on the first downbeat. The watts
//       land after the hit; on the next 8th the instrument implodes into the dot, on the first hold of
//       the climbing wall (world1).
//   n=2 ink on a blue field. The instrument rolls in on the second APPRECIATE and lands on the hit;
//       then the field closes from above and below into one blue line: world2's busbar.
//   n=3 the quiet chorus: hairlines, tiny, black. A ghost of the number waits behind the words, rolls,
//       and burns out filament by filament; one dot is left, the petri dish's centre (world4).
//   n=4 maximal: strobes, stacked outlines, a re-slam on every beat; past 1 GW the zeros multiply
//       until the string is a thread, which becomes world5's first hypha.
// APPRECIATE rises (an asset that appreciates goes up). Values and hand-off geometry: _power.ts.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { HEX, rgba } from '../engine/palette';
import { F, font, measure, layout, type TextLayout } from '../engine/type';
import type { Word } from '../engine/lyrics';
import { clamp, ease, hash, lerp, noise1, prog, pulse, smoothstep, frameIdx } from '../engine/util';
import { dot2D, burst2D, VALUES, HANDOFF, kIndex, fmtK, siW, HUMANITY_W } from './_power';

const CAP = 0.686; // Archivo cap height / em
const PCAP = 0.698; // Plex Mono cap height / em
const PADV = 0.6; // Plex Mono advance / em
const K0 = -1, K1 = 3; // the Kardashev ruler

/** The instrument at full scale: label top-left, digits (right-aligned on the unit), log bar; hairline variant for n=3. */
const BIG = { numSize: 560, numC: 585, labX: 118, labY: 214, labSize: 168, barX: 118, barY: 906, barW: W - 236 };
const HAIR = { numSize: 520, numC: 542, labX: 118, labY: 190, labSize: 84, barX: 118, barY: 890, barW: W - 236 };
const LABELS = ['WE', 'APPRECIATE', 'POWER', 'WE', 'APPRECIATE', 'POWER'];

type Col = keyof typeof HEX;

export default class Hook extends Scene {
  n = 1;
  L = new Layer2D();
  comp!: FSPass;
  words: Word[] = [];
  ws: number[] = [];
  /** The hit (second POWER); the instrument's entrance; its roll; the exit window; hook 1's implosion. */
  tHit = 0; tNum = 0; tRoll0 = 0; tRoll1 = 0; tX0 = 0; tX1 = 0; tSlam = 0; tIgn = 0;
  vPrev = 1; vNew = 20;
  lw = 1;
  f = {
    we: F.archivo(100, 900), app: F.archivo(62, 900), pow: F.archivo(62, 900),
    hair: F.archivo(100, 300), hairW: F.archivo(125, 300),
    mono: F.mono(400), monoM: F.mono(500), monoL: F.mono(300),
  };
  appLay!: TextLayout;

  override init() {
    const { lyrics, params, start, end, audio: au } = this.ctx;
    this.n = Number(params.n ?? 1);
    const n = this.n;
    const line = lyrics.linesIn(start - 0.3, end).find((l) => /appreciate power/i.test(l.text)) ?? lyrics.linesIn(start - 0.3, end)[0]!;
    this.words = line.words.slice(0, 6);
    this.ws = this.words.map((w) => w.start);
    while (this.ws.length < 6) this.ws.push(lerp(start, end, this.ws.length / 6));
    this.tHit = Math.min(this.ws[5]!, end - 0.2);
    // the previous hook on screen (a cut version may skip one): its value is where this one rolls from
    const prev = Number(params.prev ?? n - 1);
    this.vPrev = prev >= 1 ? VALUES[prev - 1]!.w : 1;
    this.vNew = VALUES[n - 1]!.w;
    this.tIgn = au.downbeats[0] ?? 0.04;

    // Hooks 1 and 4 have a beat after the hit: the number arrives on the hit. In 2 and 3 the number
    // arrives on the second APPRECIATE and lands on the hit, which starts the exit.
    const early = n === 2 || n === 3;
    // (1 and 4: the second POWER holds full frame for a moment before it glides into the label)
    this.tNum = early ? this.ws[4]! : this.tHit + 0.1;
    this.tRoll0 = this.tNum + 0.015;
    this.tRoll1 = n === 1 ? this.tNum + 0.1 : n === 4 ? this.tNum + 0.08 : this.tHit - 0.015;
    if (n === 1) {
      const hat = au.timeOfBeat(Math.round(au.beatAt(this.tHit)) + 0.5); // the 8th after the hit, if it fits
      this.tSlam = hat > this.tRoll1 + 0.15 && hat < end - 0.12 ? hat : end - 0.2;
      this.tX0 = this.tSlam - 0.066; this.tX1 = this.tSlam - 0.004;
    } else if (n === 2) {
      this.tX0 = this.tHit + 0.06; this.tX1 = end - 0.002;
    } else if (n === 3) {
      this.tX0 = Math.max(this.tRoll1 + 0.06, end - 0.42); this.tX1 = end - 0.004;
    } else {
      this.tX0 = end - 0.1; this.tX1 = end - 0.008;
    }
    this.appLay = layout('APPRECIATE', this.f.app, 100);
    this.comp = new FSPass(COMP, { tex: { value: this.L.texture }, bgCol: { value: [0, 0, 0] }, echo: { value: 0 }, hot: { value: 1 }, gain: { value: 1 } });
  }

  // ------------------------------------------------------------------ helpers
  private wordIdx(t: number) {
    let i = -1;
    for (let k = 0; k < this.ws.length; k++) if (t >= this.ws[k]! - 1e-4) i = k;
    return i;
  }
  private slam(t: number, t0: number, amt = 0.14, dur = 0.16) {
    const r = this.retrig(t, t0);
    const hold = 1 + 0.035 * Math.max(0, t - t0);
    return hold * (1 + amt * (r === t0 ? 1 : 0.5) * (1 - ease.outExpo(clamp((t - r) / dur))));
  }
  /** Hook 4 re-slams a held word on every beat; the others slam once. */
  private retrig(t: number, t0: number) {
    if (this.n !== 4) return t0;
    const au = this.ctx.audio;
    const bt = au.timeOfBeat(Math.floor(au.beatAt(t) + 1e-4));
    return bt > t0 + 0.12 ? bt : t0;
  }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, n = this.n;
    const L = this.L; L.clear();
    const c = L.ctx;
    c.textBaseline = 'alphabetic';
    const wi = this.wordIdx(t);
    const o: PostOverrides = { bloomThreshold: 1.0, bloomKnee: 0.2, bloom: 0.6, bloomRadius: 0.55, ca: n === 3 ? 0.5 : 1.2, vignette: n === 2 ? 0.5 : 0.4, grain: n === 3 ? 0.07 : 0.055 };

    // ---- palette for this frame
    let bgK: Col = n === 2 ? 'signal' : 'ink';
    let inkK: Col = n === 2 ? 'ink' : 'bone';
    if (n === 4 && t >= this.ws[0]! - 0.01 && t < this.tHit) {
      const m = ((Math.floor(f.beat * 2) % 3) + 3) % 3; // strobe on the 8ths: ink / signal / bone
      bgK = m === 0 ? 'ink' : m === 1 ? 'signal' : 'bone';
      inkK = m === 0 ? 'bone' : 'ink';
    }
    const punchT = [...this.ws.slice(0, 5).filter((x) => x < this.tNum), n === 2 || n === 3 ? -9 : this.tHit];
    const punch = n !== 3 && punchT.some((x) => t >= x && t < x + 2 / 60);
    if (punch) { const k = bgK; bgK = inkK; inkK = k; }

    // ---- content
    let shake = 0;
    const inNum = t >= this.tNum;
    if (n === 1 && t < this.ws[0]!) this.drawIgnition(c, t);
    if (n === 3 && wi >= 0) this.drawGhost(c, t);
    if (!inNum) {
      if (wi < 0) this.drawPre(c, t, inkK);
      else if (n === 3) this.drawTiny(c, t, wi);
      else if (wi === 0 || wi === 3) this.drawWE(c, t, wi, inkK);
      else if (wi === 1 || wi === 4) this.drawAPP(c, t, wi, inkK);
      else this.drawPOW(c, t, wi, inkK);
      if (wi >= 0 && n !== 3) shake = [0, 7, 13, 0, 20][n]! * pulse(t, this.retrig(t, this.ws[wi]!), 0.05);
    } else {
      if (n === 3) this.drawTiny(c, t, 4, 1 - smoothstep(this.tNum, this.tNum + 0.06, t), 4);
      this.drawNumberPhase(c, t, inkK);
    }
    if (n === 1) burst2D(c, W / 2, H / 2, t, this.tIgn, { n: 120, speed: 1700, life: 0.45 });
    L.upload();

    const u = this.comp.u;
    (u.bgCol!.value as number[]).splice(0, 3, ...lin(bgK));
    u.echo!.value = n === 4 ? 0.06 * pulse(t, this.ws[Math.max(0, wi)] ?? t, 0.1) + (inNum && t < this.tX0 ? 0.025 : 0) : 0;
    u.hot!.value = bgK === 'signal' ? 0 : n === 3 ? 0.9 : 0.95;
    u.gain!.value = n === 1 ? 1 + 0.9 * pulse(t, this.tSlam, 0.08) : n === 4 ? 1 + 1.2 * smoothstep(this.tX0 + 0.03, this.tX1, t) : 1;
    this.comp.render(this.ctx.renderer, out);

    // ---- camera-ish post
    if (n === 1) { o.flash = 0.9 * pulse(t, this.tIgn, 0.03); shake += 9 * pulse(t, this.tIgn, 0.06); }
    const hit = pulse(t, this.tHit, 0.06);
    if (n !== 3 && n !== 2) { shake += [0, 10, 16, 0, 26][n]! * hit; o.zoom = 1 + 0.04 * hit; }
    if (n === 2) shake += 8 * hit;
    if (n === 1) { shake += 9 * pulse(t, this.tSlam, 0.05); o.bloom = 0.6 + 0.5 * pulse(t, this.tSlam, 0.08); }
    if (shake > 0.05) o.shake = [noise1(t * 60, 1) * shake, noise1(t * 60, 2) * shake];
    // the exits hand geometry to the next plate: hold the frame still for them
    const still = n === 1 ? this.ctx.end - 0.1 : this.tX0;
    if (t >= still) { o.shake = [0, 0]; o.zoom = 1; o.ca = 0.5; }
    return o;
  }

  // ------------------------------------------------------------------ words
  /** Hook 1, frame 1: the dot lights in the dark on the first downbeat. */
  private drawIgnition(c: CanvasRenderingContext2D, t: number) {
    const k = smoothstep(this.tIgn - 0.03, this.tIgn, t);
    dot2D(c, W / 2, H / 2, t, 0.4 + 2.4 * k * (1 - 0.5 * prog(t, this.tIgn, this.ws[0]!)), 0.4 + 0.8 * k, 0);
  }

  private drawPre(c: CanvasRenderingContext2D, t: number, ink: Col) {
    const k = ease.outExpo(prog(t, this.ctx.start, this.ws[0]!));
    c.fillStyle = rgba(ink, 0.3);
    c.fillRect(W / 2 - 400 * k, H / 2, 800 * k, 1);
  }

  /** Type-specimen guides: hairlines at the word's baseline and cap height, full width. */
  private guides(c: CanvasRenderingContext2D, base: number, capH: number, ink: Col, a = 1) {
    if (this.n === 3) return;
    c.save();
    c.fillStyle = rgba(ink, 0.22 * a);
    c.fillRect(0, Math.round(base), W, 1);
    c.fillRect(0, Math.round(base - capH), W, 1);
    c.font = font(this.f.mono, 11);
    c.fillStyle = rgba(ink, 0.5 * a);
    c.fillText('baseline', 96, Math.round(base) + 16);
    c.fillText(`cap-height · ${CAP.toFixed(3)} em`, 96, Math.round(base - capH) - 8);
    c.restore();
  }

  /** The cursor: the dot sits at the end of the word being sung, flaring as it lands. */
  private cursor(c: CanvasRenderingContext2D, x: number, y: number, t: number, t0: number) {
    dot2D(c, x, y, t, 0.7 + 1.3 * pulse(t, t0, 0.08), 1);
  }

  private drawWE(c: CanvasRenderingContext2D, t: number, wi: number, ink: Col) {
    const n = this.n, t0 = this.ws[wi]!;
    const fam = this.f.we;
    const w1 = measure('WE', fam, 100) / 100;
    const size = Math.min(n === 1 ? 980 : 1150, (W - 150) / w1);
    const s = this.slam(t, t0, n === 4 ? 0.3 : 0.16);
    const w = w1 * size;
    const base = H / 2 + (size * CAP) / 2;
    this.guides(c, base, size * CAP, ink);
    c.save();
    c.translate(W / 2, base);
    c.scale(s, s);
    if (n === 4) this.echoes(c, 'WE', fam, size, -w / 2, 0, t, t0);
    c.font = font(fam, size);
    c.fillStyle = rgba(ink);
    c.fillText('WE', -w / 2, 0);
    c.restore();
    this.cursor(c, W / 2 + (w / 2) * s + 34, base - 6, t, t0);
  }

  /** APPRECIATE rises letter by letter, and keeps rising (hook 4: a new copy launches every 8th). */
  private drawAPP(c: CanvasRenderingContext2D, t: number, wi: number, ink: Col) {
    const n = this.n, t0 = this.ws[wi]!, t1 = this.ws[wi + 1] ?? t0 + 0.6;
    const fam = this.f.app;
    const size = Math.min(640, (W - 150) / (this.appLay.width / 100));
    const lay = layout('APPRECIATE', fam, size);
    const x0 = (W - lay.width) / 2;
    const capH = size * CAP;
    const endY = H / 2 + capH / 2 - 30;
    const hold = t1 - t0;
    const dur = Math.min(0.3, hold * 0.6);
    const stagger = Math.min(0.03, (hold * 0.5) / lay.glyphs.length);
    const period = n === 4 ? this.ctx.audio.timeOfBeat(this.ctx.audio.beatAt(t0) + 0.5) - t0 : 99;
    const reps = n === 4 ? Math.min(8, 1 + Math.floor(Math.max(0, t - t0) / Math.max(0.12, period))) : 1;
    this.guides(c, endY, capH, ink, 0.6);
    c.save();
    c.font = font(fam, size);
    const posAt = (i: number, tt: number, rep: number) => {
      const ts = t0 + i * stagger + rep * period;
      const e = ease.outExpo(clamp((tt - ts) / dur));
      const drift = Math.max(0, tt - ts - dur) * (n === 4 ? 900 : 90); // keeps appreciating
      return { y: lerp(H + capH * 1.3, endY, e) - drift, ts };
    };
    let lastY = endY;
    for (let rep = reps - 1; rep >= 0; rep--) {
      for (let i = 0; i < lay.glyphs.length; i++) {
        const g = lay.glyphs[i]!;
        const p = posAt(i, t, rep);
        if (t < p.ts || p.y < -80) continue;
        const vel = Math.abs(posAt(i, t - 1 / 60, rep).y - p.y) * 60;
        const stretch = 1 + clamp(vel / 5000, 0, 1.3);
        const x = x0 + g.x;
        const trail = clamp(vel / 3000);
        if (trail > 0.02) {
          c.strokeStyle = rgba(ink, 0.55 * trail);
          c.lineWidth = 1.5;
          for (let j = 1; j <= 4; j++) { c.save(); c.translate(x, p.y + j * vel * 0.012); c.scale(1, stretch); c.strokeText(g.ch, 0, 0); c.restore(); }
        }
        c.save();
        c.translate(x, p.y);
        c.scale(1, stretch);
        c.fillStyle = rgba(ink);
        if (n === 4 && rep < reps - 1) { c.strokeStyle = rgba(ink, 0.9); c.lineWidth = 3; c.strokeText(g.ch, 0, 0); }
        else c.fillText(g.ch, 0, 0);
        c.restore();
        if (rep === 0 && i === lay.glyphs.length - 1) lastY = p.y;
      }
    }
    c.restore();
    if (t >= t0 + (lay.glyphs.length - 1) * stagger) this.cursor(c, x0 + lay.width + 30, lastY - 6, t, t0 + (lay.glyphs.length - 1) * stagger);
  }

  private drawPOW(c: CanvasRenderingContext2D, t: number, wi: number, ink: Col) {
    const n = this.n, t0 = this.ws[wi]!;
    const fam = this.f.pow;
    const w1 = measure('POWER', fam, 100) / 100;
    const size = Math.min(1500, (W - 150) / w1);
    const s = this.slam(t, t0, n === 4 ? 0.3 : wi === 5 ? 0.18 : 0.12);
    const w = w1 * size;
    const base = H / 2 + (size * CAP) / 2;
    this.guides(c, base, size * CAP, ink);
    c.save();
    c.translate(W / 2, base);
    c.scale(s, s);
    if (n === 4) this.echoes(c, 'POWER', fam, size, -w / 2, 0, t, t0);
    c.font = font(fam, size);
    c.fillStyle = rgba(ink);
    c.fillText('POWER', -w / 2, 0);
    c.restore();
    this.cursor(c, W / 2 + (w / 2) * s + 30, base - 6, t, t0);
  }

  /** Stacked outline echoes (hook 4). */
  private echoes(c: CanvasRenderingContext2D, s: string, fam: string, size: number, x: number, y: number, t: number, t0: number) {
    c.save();
    c.font = font(fam, size);
    const age = t - this.retrig(t, t0);
    for (let j = 6; j >= 1; j--) {
      const sc = 1 + j * 0.07 * (1 + age * 2.5);
      c.save();
      c.scale(sc, sc);
      c.strokeStyle = rgba(j % 2 ? 'signal' : 'bone', 0.6 - j * 0.07);
      c.lineWidth = 2 / sc;
      c.strokeText(s, x, y);
      c.restore();
    }
    c.restore();
  }

  /** Hook 3: tiny hairline words in a lot of black; earlier words climb away above, fading. */
  private drawTiny(c: CanvasRenderingContext2D, t: number, wi: number, fade = 1, skip = -1) {
    const fam = this.f.hair, size = 54, track = 16, gap = 84;
    const cy = H / 2 + (size * CAP) / 2;
    for (let i = 0; i <= Math.min(wi, 5); i++) {
      if (i === skip) continue;
      const since = t - this.ws[i]!;
      if (since < 0) continue;
      const cur = i === wi;
      let slot = 0;
      for (let j = i + 1; j <= wi; j++) slot += ease.outExpo(clamp((t - this.ws[j]!) / 0.3));
      const rise = -(1 - ease.outExpo(clamp(since / 0.3))) * (i % 3 === 1 ? gap : gap * 0.5);
      const y = cy - slot * gap - rise - since * 8;
      const a = (cur ? 0.95 : 0.22 / Math.max(1, slot)) * fade;
      c.save();
      c.fillStyle = rgba('bone', a);
      c.font = font(fam, size);
      c.letterSpacing = `${track}px`;
      const s = LABELS[i]!;
      const w = measure(s, fam, size, track) - track;
      c.fillText(s, W / 2 - w / 2, y);
      c.restore();
    }
    c.fillStyle = rgba('bone', 0.1 * fade);
    c.fillRect(W / 2 - 360, cy + 26, 720, 1);
  }

  // ------------------------------------------------------------------ the number
  /** Displayed watts: rolls on a log scale from the previous hook's value to this one's. */
  private shown(t: number) {
    const k = prog(t, this.tRoll0, this.tRoll1, this.n === 3 ? ease.inOutCubic : ease.outCubic);
    if (k >= 1) return this.vNew;
    return Math.exp(lerp(Math.log(this.vPrev), Math.log(this.vNew), k));
  }
  /** Hook 4: how many extra zeros have been appended (one every 18 ms after the roll). */
  private extra0(t: number) {
    if (this.n !== 4) return 0;
    const t0 = this.tRoll1 + 0.06;
    return t >= t0 ? Math.min(24, 1 + Math.floor((t - t0) / 0.018)) : 0;
  }
  /** Where the label glides in from: the POWER slam, or the tiny ladder. */
  private labelFrom(t: number) {
    const n = this.n;
    if (n === 3) {
      const size = 54;
      return { x: W / 2 - measure('POWER', this.f.hair, size, 16) / 2, base: H / 2 + (size * CAP) / 2 - (t - this.tNum) * 8, size, fam: this.f.hair };
    }
    if (n === 1 || n === 4) {
      const w1 = measure('POWER', this.f.pow, 100) / 100;
      const size = Math.min(1500, (W - 150) / w1);
      return { x: W / 2 - (w1 * size) / 2, base: H / 2 + (size * CAP) / 2, size, fam: this.f.pow };
    }
    return { x: BIG.labX, base: BIG.labY, size: BIG.labSize, fam: this.f.pow };
  }

  private drawNumberPhase(c: CanvasRenderingContext2D, t: number, ink: Col) {
    const n = this.n;
    this.lw = 1;
    if (n === 1) {
      // lands after the hit; implodes into the dot on the next 8th, onto the first hold of world1
      const R = HANDOFF.climb;
      if (t < this.tSlam) {
        const k = prog(t, this.tX0, this.tX1, ease.inCubic);
        c.save();
        if (k > 0) { c.translate(R.x, R.y); c.scale(1 - k, 1 - k); c.translate(-R.x, -R.y); }
        this.drawInstrument(c, t, ink);
        c.restore();
        if (k > 0.02) dot2D(c, R.x, R.y, t, 0.4 + 1.8 * k, 1);
      } else {
        burst2D(c, R.x, R.y, t, this.tSlam, { n: 70, speed: 900, life: 0.35, seed: 11 });
        dot2D(c, R.x, R.y, t, lerp(2.2, 0.8, prog(t, this.tSlam, this.tSlam + 0.16, ease.outCubic)), 1);
      }
    } else if (n === 2) {
      // the field closes from above and below into one blue line: world2's busbar
      const e = prog(t, this.tX0, this.tX1, ease.inOutCubic);
      if (e <= 0) { this.drawInstrument(c, t, ink); return; }
      const B = HANDOFF.bus;
      const G = { x: W / 2, y: BIG.numC };
      c.save();
      c.translate(W / 2, lerp(G.y, B.y, e));
      c.scale(lerp(1, 1.6, e), Math.max(0.002, (1 - e) * (1 - e)));
      c.translate(-G.x, -G.y);
      this.drawInstrument(c, t, ink);
      c.restore();
      const half = lerp(H, B.w / 2, ease.inCubic(e));
      c.fillStyle = rgba('ink', 1);
      c.fillRect(0, 0, W, Math.max(0, B.y - half));
      c.fillRect(0, B.y + half, W, H);
    } else if (n === 3) {
      this.drawInstrument(c, t, ink);
      const k = prog(t, this.tX1 - 0.12, this.tX1);
      const P = HANDOFF.petri;
      if (k > 0) dot2D(c, P.x, P.y, t, 0.3 + 0.6 * k, k);
    } else {
      // the zeros become a thread; the thread is world5's first hypha
      const k = prog(t, this.tX0, this.tX1);
      if (k <= 0) { this.drawInstrument(c, t, ink); return; }
      const Y = HANDOFF.hypha;
      const G = { x: W / 2, y: BIG.numC };
      const sy = Math.pow(1 - k, 3);
      c.save();
      c.translate(W / 2, lerp(G.y, Y.y, ease.outCubic(k)));
      c.scale(lerp(1, 1.25, ease.inCubic(k)), Math.max(0.003, sy));
      c.translate(-G.x, -G.y);
      this.drawInstrument(c, t, ink);
      c.restore();
      const a = smoothstep(0.25, 0.85, k);
      c.fillStyle = rgba('bone', a);
      c.fillRect(0, Y.y - 1, W, 2);
      c.fillStyle = rgba('signal', 0.5 * a);
      c.fillRect(0, Y.y - 3, W, 1);
      if (k > 0.5) dot2D(c, Y.x, Y.y - 1, t, smoothstep(0.5, 1, k) * 0.9, 1);
    }
  }

  /** Hook 3: the number's ghost, waiting behind the tiny words. */
  private drawGhost(c: CanvasRenderingContext2D, t: number) {
    if (t >= this.tNum) return;
    const a = 0.1 * smoothstep(this.ws[0]!, this.ws[0]! + 0.5, t);
    if (a <= 0.003) return;
    const { size, base } = this.numFit();
    c.save();
    c.strokeStyle = rgba('bone', a);
    c.lineWidth = 1.2;
    c.font = font(this.f.monoL, size);
    c.textAlign = 'center';
    c.strokeText(fmtK(kIndex(this.vPrev)), W / 2, base);
    c.restore();
  }

  /** The K digits' size and baseline ("−0.32": five characters, centred). */
  private numFit() {
    const B = this.n === 3 ? HAIR : BIG;
    const size = Math.min(B.numSize, (W - 200) / (5.2 * PADV));
    return { size, base: B.numC + (size * PCAP) / 2 };
  }

  /** Watts actually shown: the roll, then (hook 4) ×10 per appended zero. */
  private watts(t: number) { return this.shown(t) * 10 ** this.extra0(t); }
  /** K on the drums: rolls between the two hooks' values rounded to hundredths (K is linear in log W,
   * so this is the same roll as the watts), then +0.1 per appended zero. Lands exactly on a detent. */
  private kShown(t: number) {
    const r = (x: number) => Math.round(x * 100) / 100;
    const p = prog(t, this.tRoll0, this.tRoll1, this.n === 3 ? ease.inOutCubic : ease.outCubic);
    return lerp(r(kIndex(this.vPrev)), r(kIndex(this.vNew)), p) + 0.1 * this.extra0(t);
  }

  private drawInstrument(c: CanvasRenderingContext2D, t: number, ink: Col) {
    const n = this.n, hair = n === 3;
    const B = hair ? HAIR : BIG;
    const age = t - this.tNum;
    const w = this.watts(t);
    const k = this.kShown(t), kPrev = this.kShown(t - 1 / 60);
    const inkField = ink === 'ink';
    // hook 3 burns out: each element at its own moment (bar first, then the digits, the label last)
    const burn = (i: number): { col: string; a: number } => {
      if (!hair) return { col: '', a: 1 };
      const span = Math.max(0.02, this.tX1 - 0.05 - (this.tX0 + 0.025));
      const tb = i === -2 ? this.tX0 : i === -1 ? this.tX1 - 0.13 : this.tX0 + 0.025 + (span * (hash(i, 5) * 0.9));
      const heat = prog(t, tb - 0.03, tb + 0.01);
      const out = prog(t, tb, tb + 0.05, ease.inQuad);
      const flick = 0.55 + 0.45 * hash(frameIdx(t), i + 3);
      const a = (1 - out) * (heat > 0 && out > 0 ? flick : 1) * (1 + 0.6 * heat * (1 - out));
      const kk = Math.min(1, heat * 1.3);
      const col = kk > 0 ? `rgb(${Math.round(lerp(242, 157, kk))},${Math.round(lerp(236, 180, kk))},${Math.round(lerp(228, 255, kk))})` : rgba('bone');
      return { col, a: Math.min(1, a) * (i < 0 ? 1 : 0.92) };
    };
    const appear = hair ? prog(age, 0, 0.1) : 1;

    // ---- label: the sung POWER gliding in from where it was last set
    const m = n === 2 ? 1 : hair ? prog(t, this.tNum + 0.02, this.tNum + 0.16, ease.inOutCubic) : prog(t, this.tNum, this.tNum + 0.14, ease.outExpo);
    const from = this.labelFrom(t);
    const ls = Math.exp(lerp(Math.log(from.size), Math.log(B.labSize), m));
    const lb = burn(-1);
    c.save();
    c.globalAlpha = lb.a * (n === 2 ? lerp(0.35, 1, smoothstep(this.tHit - 0.02, this.tHit + 0.02, t)) : 1);
    c.font = font(m < 0.5 ? from.fam : hair ? this.f.hair : this.f.pow, ls);
    c.fillStyle = hair && t >= this.tHit ? lb.col : rgba(ink);
    c.fillText('POWER', lerp(from.x, B.labX, m), lerp(from.base, B.labY, m));
    // what the label measures: the Kardashev type, under the word
    c.globalAlpha *= smoothstep(0.4, 1, m);
    c.font = font(this.f.monoM, 16);
    c.letterSpacing = '3px';
    c.fillStyle = rgba(ink, 0.7);
    c.fillText('KARDASHEV TYPE', B.labX + 4, B.labY + 34);
    c.restore();

    // ---- the Kardashev ruler, −1 … 3 (drawn on left to right as the instrument arrives)
    const bb = burn(-2);
    const d = prog(age, 0, hair ? 0.2 : 0.16, ease.outExpo);
    const bx = B.barX, by = B.barY, bw = B.barW;
    const X = (kk: number) => bx + (bw * (kk - K0)) / (K1 - K0);
    const th = hair ? 1 : 2;
    c.save();
    c.globalAlpha = appear * bb.a;
    c.fillStyle = rgba(ink, hair ? 0.35 : 0.43);
    c.fillRect(bx, by, bw * d, th);
    for (let i = 0; i <= (K1 - K0) * 10 * d; i++) {
      const hh = (i % 10 === 0 ? 5 : i % 5 === 0 ? 3.5 : 2) * (hair ? 3 : 4);
      c.fillRect(bx + (bw * i) / ((K1 - K0) * 10), by - hh, th, hh);
    }
    c.font = font(this.f.mono, 13);
    c.fillStyle = rgba(ink, 0.55 * smoothstep(0.3, 0.9, d));
    const marks: [number, string][] = [[-1, '−1'], [0, '0 · 1 MW'], [1, 'I'], [2, 'II'], [3, 'III']];
    for (const [kk, s] of marks) c.fillText(s, X(kk) - (kk === K1 ? measure(s, this.f.mono, 13) : kk === K0 ? 0 : measure(s, this.f.mono, 13) / 2), by + 26);
    // the one fixed mark: humanity, today
    const kh = kIndex(HUMANITY_W);
    c.fillStyle = rgba(ink, 0.8 * smoothstep(0.5, 1, d));
    c.fillRect(X(kh), by - 26, th, 26);
    c.fillText(`humanity, today · ${fmtK(kh)}`, X(kh) + 6, by - 14);
    c.textAlign = 'right';
    c.fillStyle = rgba(ink, 0.55 * smoothstep(0.3, 0.9, d));
    c.fillText('K = (log10 P − 6) / 10 · Sagan, 1973', bx + bw, by + 50);
    c.textAlign = 'left';
    c.fillStyle = hair ? rgba('bone', 0.9) : inkField ? rgba('ink', 1) : rgba('signal', 1);
    c.fillRect(bx, by - (hair ? 1 : 3), Math.max(0, X(Math.min(K1, k)) - bx) * d, hair ? 3 : 9);
    c.restore();

    // ---- the number: K on drums (slams in; hook 3 fades in)
    const { size, base } = this.numFit();
    const numCol = inkField ? rgba('ink', 1) : hair ? rgba('bone', 0.9) : rgba('signal', 1);
    const s = hair ? 1 : 1 + 0.1 * (1 - ease.outExpo(clamp(age / 0.16)));
    c.save();
    const cx = W / 2, cy = B.numC;
    c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy);
    c.globalAlpha = appear;
    c.fillStyle = numCol; c.strokeStyle = numCol;
    this.drawK(c, W / 2, base, size, k, kPrev, hair, hair ? burn : undefined);
    c.restore();

    // ---- what that is, in watts, under the number
    const note = this.extra0(t) > 0 || t < this.tRoll1 ? '' : VALUES[n - 1]!.note;
    const ratio = this.vNew / this.vPrev;
    const lineA = appear * smoothstep(0.05, 0.2, age) * burn(-2).a;
    if (lineA > 0.01) {
      c.save();
      c.globalAlpha = lineA;
      c.font = font(this.f.monoM, hair ? 26 : 34);
      c.textAlign = 'center';
      c.fillStyle = rgba(ink, hair ? 0.8 : 0.9);
      const wtxt = `${siW(w)}${note ? ' · ' + note : ''}${n > 1 && !this.extra0(t) && t >= this.tRoll1 ? `   ×${ratio >= 100 ? Math.round(ratio).toLocaleString('en-US') : ratio.toFixed(ratio >= 10 ? 0 : 1)}` : ''}`;
      c.fillText(wtxt, W / 2, base + (hair ? 70 : 92));
      c.restore();
    }
  }

  /** K on drums: sign, units, point, tenths, hundredths — centred on xc. The sign flips at zero. */
  private drawK(c: CanvasRenderingContext2D, xc: number, y: number, size: number, k: number, kPrev: number, hair: boolean, style?: (i: number) => { col: string; a: number }) {
    const adv = size * PADV, rowH = size * 1.05;
    const a0 = c.globalAlpha;
    const glyph = (s: string, gx: number, gy: number) => { if (hair) { c.lineWidth = 1.4 * this.lw; c.strokeText(s, gx, gy); } else c.fillText(s, gx, gy); };
    const apply = (i: number) => { if (!style) return 1; const st = style(i); c.fillStyle = st.col; c.strokeStyle = st.col; return st.a; };
    c.font = font(hair ? this.f.monoL : this.f.mono, size);
    const x0 = xc - 2.5 * adv;
    const N = Math.round(Math.abs(k) * 1e4) / 100, Np = Math.round(Math.abs(kPrev) * 1e4) / 100; // hundredths
    let sa = apply(0); c.globalAlpha = a0 * sa;
    if (k < -0.004) glyph('−', x0, y);
    sa = apply(1); c.globalAlpha = a0 * sa; glyph('.', x0 + 2 * adv, y);
    // drums: units (10^2 of hundredths), tenths (10^1), hundredths (10^0)
    ([[2, x0 + adv], [1, x0 + 3 * adv], [0, x0 + 4 * adv]] as const).forEach(([kp, xx], di) => {
      const pos = drum(N, kp), posP = drum(Np, kp);
      const speed = Math.abs(pos - posP) * 60;
      sa = apply(2 + di);
      c.save();
      c.beginPath();
      c.rect(xx - 6, y - size * PCAP - size * 0.3, adv + 12, size * PCAP + size * 0.6);
      c.clip();
      const b0 = Math.floor(pos), fr = pos - b0;
      const blur = clamp(speed / 25, 0, 1);
      for (let j = -1; j <= 1; j++) {
        const dig = (((b0 + j) % 10) + 10) % 10;
        const off = (fr - j) * rowH;
        const a = (1 - Math.min(1, Math.abs(off) / (rowH * 0.85))) * (hair && j !== 0 ? 0.5 : 1);
        if (a <= 0.01) continue;
        const copies = blur > 0.05 && !hair ? 4 : 1;
        for (let q = 0; q < copies; q++) {
          c.globalAlpha = a0 * sa * a * (copies > 1 ? 0.4 : 1);
          glyph(String(dig), xx, y + off + (q - (copies - 1) / 2) * rowH * 0.07 * blur);
        }
      }
      c.restore();
    });
    c.globalAlpha = a0;
  }
}

/** Odometer drum position for the digit 10^k of a continuous count N. */
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

function lin(k: Col): [number, number, number] {
  const n = parseInt(HEX[k].slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }) as [number, number, number];
}

const COMP = /* glsl */ `
uniform sampler2D tex; uniform vec3 bgCol; uniform float echo, hot, gain;
void main() {
  vec4 s = texture(tex, vUv);
  if (echo > 0.0) {
    // radial echo (zoom trails) for the maximal hook
    vec4 acc = vec4(0.0); float wsum = 0.0;
    for (int i = 0; i < 6; i++) {
      float k = float(i) / 5.0;
      vec4 e = texture(tex, mix(vUv, vec2(0.5), k * echo));
      float w = 1.0 - k * 0.8;
      acc += vec4(e.rgb * e.a, e.a) * w; wsum += w;
    }
    acc /= wsum;
    s = vec4(acc.rgb / max(acc.a, 1e-3), max(s.a, acc.a));
  }
  // only the blue glows (blue well above red); gain = white-hot
  float h = smoothstep(0.25, 0.7, s.b - s.r * 1.3);
  vec3 col = mix(bgCol, s.rgb * (1.0 + hot * h) * gain, s.a);
  fragColor = vec4(col, 1.0);
}`;
