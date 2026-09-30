// CHORUS — "We appreciate power" (docs/TREATMENT.md, `chorus`). n=1 is also the cold open:
//   1. first contact (the hook, twice): the ink line draws each word's outline by hand, the blue
//      line hatches it — misregistered, because the two have never read each other; the second
//      "we appreciate power" re-hatches closer.
//   2. "Elevate the human race … on my face": a face in profile, drawn by hand; the blue line lays
//      plotted contour lines over it, word by word (augmented, never replaced).
//   3. the hook again, in register; the held "power" is cross-hatched.
// Other n: not built yet (see src/timeline.ts).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, fitSize, glyphX, measure } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import {
  Paper, PAPER_POST, MARGIN, drawPlate, specimen, inkLine, hatch, flatten,
  type Specimen, type Poly, faceGeometry,
} from './_plate';

const CAP = 0.686; // Archivo cap height / em
const HOOK = F.archivo(87.5, 900);
const LYRIC = F.archivo(87.5, 800);
const clean = (w: string) => w.replace(/[,.?!“”"]/g, '');

interface HookWord { w: Word; sp: Specimen; seed: number }

export default class Chorus extends Scene {
  n = 1;
  L = new Layer2D();
  paper!: Paper;
  hookA: HookWord[][] = []; // two halves × three words, left-aligned stack
  hookB: HookWord[][] = []; // two halves × three words, centred stack
  elev!: Line;
  tElev = 0; tB = 0;
  face!: { front: Poly; back: Poly; eye: Poly; ear: Poly; all: Poly[]; len: number; clip: Path2D; box: { x: number; y: number; w: number; h: number } };

  override init() {
    const { lyrics, params, start, end, audio } = this.ctx;
    this.n = Number(params.n ?? 1);
    this.paper = new Paper(this.L.texture);
    const lines = lyrics.linesIn(start - 0.2, end);
    const hooks = lines.filter((l) => /appreciate/i.test(l.text));
    this.elev = lines.find((l) => /elevate/i.test(l.text))!;
    this.tElev = this.elev.words[0]!.start - 0.03;
    const second = hooks.find((l) => l.start > this.elev.start)!;
    this.tB = audio.downbeats.reduce((b, d) => (Math.abs(d - second.start) < Math.abs(b - second.start) ? d : b), second.start);

    // the hook stacks: WE / APPRECIATE / POWER
    const size = Math.min(250, fitSize('APPRECIATE', HOOK, W - 2 * MARGIN - 220));
    const lead = size * 0.95;
    const mkStack = (line: Line, align: 'left' | 'center', sz: number, seed0: number): HookWord[][] => {
      const halves: HookWord[][] = [line.words.slice(0, 3), line.words.slice(3, 6)].map((ws) => ws.map((w, i) => {
        const text = clean(w.w).toUpperCase();
        const width = measure(text, HOOK, sz);
        const x = align === 'left' ? MARGIN + 110 : (W - width) / 2;
        const base = H / 2 - lead + i * lead + (sz * CAP) / 2 - 10;
        return { w, sp: specimen(text, HOOK, sz, x, base), seed: seed0 + i };
      }));
      return halves;
    };
    this.hookA = mkStack(hooks[0]!, 'left', size, 1);
    this.hookB = mkStack(second, 'center', size * 1.04, 7);


    // the face (profile looking right), left of centre
    const box = { x: 250, y: 150, w: 560, h: 800 };
    this.face = faceGeometry(box);
    void flatten;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const c = this.L.ctx;
    this.L.clear();
    let glitch = 0;
    let caption = '';
    const post: PostOverrides = { ...PAPER_POST };

    if (t < this.tElev) {
      // 1. first contact
      caption = 'Fig. 1.  First contact: the ink lineage draws the word by hand; the blue lineage tries to fill it.';
      this.drawHook(c, t, this.hookA, [[1, 0.82, 0.64], [0.42, 0.26, 0.12]], false);
      glitch = 0.75 * f.a.snare;
      const sl = this.slam(t, this.hookA.flat());
      post.shake = [sl * 6 * (hash(frameIdx(t), 1) - 0.5), sl * 6 * (hash(frameIdx(t), 2) - 0.5)];
    } else if (t < this.tB) {
      // 2. the face, annotated
      caption = 'Fig. 2.  The face: drawn by one lineage, contoured by the other.';
      this.drawFace(c, t);
      glitch = 0.35 * f.a.snare;
    } else {
      // 3. in register
      caption = 'Fig. 3.  The same word, in register.';
      this.drawHook(c, t, this.hookB, [[0, 0, 0], [0, 0, 0]], true);
      glitch = 0.12 * f.a.snare;
      post.zoom = 1 + 0.012 * f.a.kick;
    }

    drawPlate(c, 'Pl. I', caption);

    this.L.upload();
    this.paper.render(this.ctx.renderer, out, t, glitch);
    return post;
  }

  // ------------------------------------------------------------------ the hook

  private slam(t: number, words: HookWord[]) {
    let s = 0;
    for (const hw of words) s = Math.max(s, pulse(t, hw.w.start, 0.07));
    return s;
  }

  /**
   * Both halves of a hook line on one stack. The first half draws the outlines (ink) and hatches them
   * (blue, offset by `mis` × 34 px); the second half's words re-hatch the same outlines as they are
   * sung: closer (hook A), or across the first hatching (hook B, `cross`).
   */
  private drawHook(c: CanvasRenderingContext2D, t: number, halves: HookWord[][], mis: number[][], cross: boolean) {
    const [h0, h1] = halves as [HookWord[], HookWord[]];
    for (let i = 0; i < h0.length; i++) {
      const a = h0[i]!, b = h1[i];
      if (t < a.w.start - (i === 0 ? 0.32 : 0.02)) continue;
      const sp = a.sp;
      const box = { x: sp.x - 10, y: sp.base - sp.size * 0.8, w: sp.w + 20, h: sp.size * 0.9 };
      const s = 1 + 0.05 * pulse(t, a.w.start, 0.06) + (b ? 0.035 * pulse(t, b.w.start, 0.06) : 0);
      c.save();
      c.translate(sp.x, sp.base);
      c.scale(s, s);
      c.translate(-sp.x, -sp.base);
      // hatch of the first half: misregistered, and it gives way to the second half's
      const ang = hash(a.seed, 3) * 6.28;
      const m0 = (mis[0]![i] ?? 0) * 34;
      const fade0 = b && !cross ? 1 - prog(t, b.w.start, b.w.start + 0.12) : 1;
      hatch(c, sp.path, box, Lyrics.wordProgress(a.w, t), { dx: Math.cos(ang) * m0, dy: Math.sin(ang) * m0, alpha: fade0 });
      if (b && t >= b.w.start) {
        const m1 = (mis[1]![i] ?? 0) * 34;
        hatch(c, sp.path, box, Lyrics.wordProgress(b.w, t), cross
          ? { angle: 0.62, spacing: 9, width: 1.4 }
          : { dx: Math.cos(ang) * m1, dy: Math.sin(ang) * m1 });
      }
      // the ink outline, drawn fast by hand as the word lands
      // (the very first word starts drawing 0.3 s early: frame one of the video must not be empty)
      const dur = clamp((a.w.end - a.w.start) * 0.6, 0.12, 0.4);
      const t0 = a.w.start - (i === 0 && a.w.start - this.ctx.start < 0.5 ? 0.3 : 0.02);
      inkLine(c, sp.polys, sp.len, prog(t, t0, a.w.start + dur, ease.outCubic), t, { seed: a.seed, width: 2.6, wobble: 1.8 });
      c.restore();
    }
  }

  // ------------------------------------------------------------------ the face

  private drawFace(c: CanvasRenderingContext2D, t: number) {
    const ws = this.elev.words;
    const face = this.face;
    // "Elevate": the head lifts and tilts up while the word is sung
    const e = prog(t, ws[0]!.start, ws[0]!.end, ease.inOutCubic);
    const chin = { x: face.box.x + 0.7 * face.box.w, y: face.box.y + 0.83 * face.box.h };
    c.save();
    c.translate(0, -46 * e);
    c.translate(chin.x, chin.y);
    c.rotate(-0.07 * e);
    c.translate(-chin.x, -chin.y);

    // the blue contours: copies of the front line, shifted back by 17 px each, clipped to the head,
    // one more per word from "let" on; each plotted top to bottom
    const iLet = Math.max(0, ws.findIndex((w) => /^let/i.test(w.w)));
    const cw = ws.slice(iLet);
    const t0 = cw[0]!.start, t1 = cw[cw.length - 1]!.end;
    const N = 14;
    const pc = prog(t, t0, t1);
    if (pc > 0) {
      c.save();
      c.clip(face.clip);
      c.strokeStyle = rgba('signal', 0.95);
      c.lineWidth = 1.5;
      for (let k = 1; k <= N; k++) {
        const pk = clamp(pc * N - (k - 1));
        if (pk <= 0) break;
        const n = Math.max(2, Math.floor(face.front.length * pk));
        c.beginPath();
        for (let i = 0; i < n; i++) {
          const q = face.front[i]!;
          const x = q.x - k * 17, y = q.y + k * 1.5;
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.stroke();
      }
      c.restore();
    }
    // the ink drawing, by hand, over "Elevate the human race,"
    // (fast: the plate must not sit empty; done by the end of "human")
    const iHuman = Math.max(0, ws.findIndex((w) => /^human/i.test(w.w)));
    const pd = prog(t, ws[0]!.start - 0.05, ws[iHuman]!.end, ease.outQuad);
    inkLine(c, face.all, face.len, pd, t, { seed: 21, width: 2.4, wobble: 2.6 });
    c.restore();

    // annotations with leader lines
    c.save();
    c.font = font(F.mono(400), 14);
    c.fillStyle = rgba('ink', 0.75);
    c.strokeStyle = rgba('ink', 0.55);
    c.lineWidth = 0.8;
    const aIn = clamp((t - ws[0]!.start) / 0.4);
    if (aIn > 0) {
      c.globalAlpha = aIn;
      c.beginPath(); c.moveTo(face.box.x + 0.64 * face.box.w, face.box.y + 0.1 * face.box.h - 46 * e); c.lineTo(900, 190); c.stroke();
      c.fillText('a.  outline, by hand', 908, 195);
    }
    if (pc > 0) {
      c.globalAlpha = clamp(pc * 4);
      c.strokeStyle = rgba('signal', 0.7);
      c.fillStyle = rgba('signal', 0.95);
      c.beginPath(); c.moveTo(face.box.x + 0.55 * face.box.w, face.box.y + 0.62 * face.box.h - 46 * e); c.lineTo(900, 820); c.stroke();
      c.fillText(`b.  contours, 17 px apart, plotted (${Math.min(14, Math.ceil(pc * 14))})`, 908, 825);
    }
    c.restore();

    // the lyric, set as the plate's text: sung words ink, the word being sung blue, the rest faint
    this.drawLyric(c, this.elev, t, 1010, 470);
  }

  private drawLyric(c: CanvasRenderingContext2D, line: Line, t: number, x: number, y: number) {
    const split = Math.max(1, line.words.findIndex((w) => /^let$/i.test(clean(w.w))));
    const rows = [line.words.slice(0, split), line.words.slice(split)];
    const size = 64;
    c.font = font(LYRIC, size);
    rows.forEach((ws, r) => {
      const text = ws.map((w) => w.w).join(' ');
      let ci = 0;
      for (const w of ws) {
        const wx = x + glyphX(text, ci, LYRIC, size);
        const p = Lyrics.wordProgress(w, t);
        const yy = y + r * size * 1.12;
        c.fillStyle = rgba('ink', p >= 1 ? 0.92 : 0.2);
        c.fillText(w.w, wx, yy);
        if (p > 0 && p < 1) {
          c.save();
          c.beginPath(); c.rect(wx - 2, yy - size, (measure(w.w, LYRIC, size) + 4) * p, size * 1.3); c.clip();
          c.fillStyle = rgba('signal', 1);
          c.fillText(w.w, wx, yy);
          c.restore();
        }
        ci += w.w.length + 1;
      }
    });
    void lerp;
  }
}
