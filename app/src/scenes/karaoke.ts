// Dev scene: a plain karaoke read-out of the analysis data, used to check the beat grid, sections and
// word timings before any real plate exists. Not part of the final video.
import type * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { F, font, fitSize, glyphX, measure } from '../engine/type';
import { Lyrics } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { clamp } from '../engine/util';

export default class Karaoke extends Scene {
  layer = new Layer2D();

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    clearRT(renderer, out, LIN.ink);
    const c = this.layer.ctx;
    this.layer.clear();

    // header: section, bar.beat, time
    const sec = audio.sections.find((s) => f.t >= s.start && f.t < s.end);
    c.fillStyle = rgba('ash');
    c.font = font(F.mono(500), 22);
    c.textBaseline = 'alphabetic';
    c.fillText(`${this.ctx.id.toUpperCase()} · ${String(this.ctx.params.plate ?? '').toUpperCase()} (NOT BUILT) · ${(sec?.name ?? '—').toUpperCase()}`, 96, 110);
    const bar = Math.floor(f.bar), inBar = Math.min(3, Math.floor(f.barPhase * 4)), beat = inBar + 1;
    const hdr = `BAR ${String(bar + 1).padStart(3, '0')} · BEAT ${beat} · ${f.t.toFixed(2)} s · ${audio.bpm.toFixed(3)} BPM`;
    c.textAlign = 'right';
    c.fillText(hdr, W - 96, 110);
    c.textAlign = 'left';

    // beat boxes: the current beat lit, downbeat box wider
    for (let k = 0; k < 4; k++) {
      const x = 96 + k * 64, w = k === 0 ? 52 : 36;
      c.fillStyle = k === inBar ? rgba('signal', 0.35 + 0.65 * (1 - f.beatPhase)) : rgba('graphite', 0.5);
      c.fillRect(x, 140, w, 12);
    }
    // drum hits
    const hits: [string, number][] = [['KICK', f.a.kick], ['SNARE', f.a.snare], ['HAT', f.a.hat], ['VOX', f.a.vonset]];
    c.font = font(F.mono(400), 16);
    hits.forEach(([name, v], i) => {
      const x = W - 96 - (3 - i) * 150 - 120;
      c.fillStyle = rgba('graphite', 0.6);
      c.fillRect(x, 140, 120, 12);
      c.fillStyle = rgba(i === 0 ? 'signal' : 'bone', 0.9);
      c.fillRect(x, 140, 120 * clamp(v), 12);
      c.fillStyle = rgba('ash');
      c.fillText(name, x, 176);
    });

    // current line (the last one that started, while it is still near) and the next one
    const cur = lyrics.lastLine(f.t);
    const nxt = lyrics.nextLine(f.t);
    const fam = F.archivo(87.5, 800);
    if (cur && f.t < cur.end + 1.2) this.drawLine(c, cur, f.t, fam, H / 2 + 20, 1);
    if (nxt && nxt.start - f.t < 2.5) {
      const text = nxt.words.map((w) => w.w).join(' ');
      const size = Math.min(44, fitSize(text, fam, W - 192, 44));
      c.font = font(fam, size);
      c.fillStyle = rgba('bone', 0.22);
      c.fillText(text, 96, H / 2 + 150);
    }

    // word confidence strip at the bottom: one tick per word of the current line
    if (cur) {
      c.font = font(F.mono(400), 16);
      c.fillStyle = rgba('ash');
      const conf = cur.words.map((w) => (w.conf ?? 1).toFixed(2)).join('  ');
      c.fillText(`L${String(cur.i).padStart(2, '0')}  conf ${conf}`, 96, H - 110);
    }

    comp.draw(renderer, this.layer.upload(), out);
    return { bloom: 0.3, grain: 0.03, vignette: 0.2, hud: 0 };
  }

  private drawLine(c: CanvasRenderingContext2D, line: Lyrics['lines'][number], t: number, fam: string, y: number, alpha: number) {
    const text = line.words.map((w) => w.w).join(' ');
    const size = Math.min(110, fitSize(text, fam, W - 192, 110));
    c.font = font(fam, size);
    let ci = 0;
    for (const w of line.words) {
      const x = 96 + glyphX(text, ci, fam, size);
      const ww = measure(w.w, fam, size);
      const p = Lyrics.wordProgress(w, t);
      c.fillStyle = rgba('bone', 0.3 * alpha);
      c.fillText(w.w, x, y);
      if (p > 0) {
        c.save();
        c.beginPath();
        c.rect(x - 4, y - size, (ww + 8) * p, size * 1.4);
        c.clip();
        c.fillStyle = p < 1 ? rgba('signal', alpha) : rgba('bone', alpha);
        c.fillText(w.w, x, y);
        c.restore();
      }
      ci += w.w.length + 1;
    }
  }
}
