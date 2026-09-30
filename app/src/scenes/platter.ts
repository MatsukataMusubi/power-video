// BRIDGE B ("the same four lines a second time"): a hard-disk platter in macro. P(doom)'s dense, move
// for move (docs/PDOOM-STRUCTURE.md; docs/PLATES.md 10): three movements joined by two internal cuts.
//   1  "And if you're wrong, you'll never die": the line written on the tracks, the head as the cursor.
//      A compression on every kick: the tracks get denser (the areal-density squeeze), the head
//      re-seeks. An event on every beat (a light sweep across the turning disc, a punch).
//   2  "Baby, plug in, I'll blow your mind": each stressed word on its own track, too wide for it,
//      bursting the sector, the guard band, the data zone (under load, then it snaps on "mind").
//      Ruptures with hit-scaled shake. Then a dive into a stem of MIND: match cut to...
//   3  "Come on, you're not even alive": ...one sector of the sector map; crane up (exponential zoom)
//      to the whole platter, the words spelled by its sectors; the arm seeks on the kicks; the drive's
//      label (≈ 7 W, the fine print). A dutch roll in on the last beat.
//   4  "If you're not back, back, back on your drive": closer, the arm and the track; the frame rolls a
//      step on every kick, each step caught by a spring. The head slaps the platter on each "back" and
//      crashes on the third (the plate's one maximal hit), gouging the track; then the whip to
//      HANDOFF.roll, held into the cut: prompt2 opens rolled by the same angle.
// Files: platter-kit.ts (geometry, camera, polar text, the arm, the disc pass), platter-press.ts
// (1–2), platter-map.ts (3), platter-crash.ts (4). The thread object is the head's dot.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import type { Line } from '../engine/lyrics';
import { Disc } from './platter-kit';
import { Press } from './platter-press';
import { SectorMap } from './platter-map';
import { Crash } from './platter-crash';

export default class Platter extends Scene {
  L = new Layer2D();
  disc!: Disc;
  press!: Press;
  map!: SectorMap;
  crash!: Crash;
  c2 = 0; c3 = 0; c4 = 0;

  override init() {
    const { lyrics: ly, audio: au, start, end } = this.ctx;
    // the four lines in the window, by position (the bridge's lines 5–8, the second time round)
    const ls = ly.lines.filter((l) => l.start >= start - 0.3 && l.start < end - 0.2);
    if (ls.length < 4) throw new Error(`bridgeB: expected four lines in the window, found ${ls.length}`);
    const [L1, L2, L3, L4] = ls as [Line, Line, Line, Line];
    /** The last beat at/before a line's first word (timeline.ts's rule). */
    const cutAt = (l: Line) => au.timeOfBeat(Math.floor(au.beatAt(l.words[0]!.start + 0.02)));
    this.c2 = cutAt(L2); this.c3 = cutAt(L3); this.c4 = cutAt(L4);
    const kicks = au.events('kick', start - 0.05, end + 0.3).filter(([, s]) => s >= 0.8).map(([t]) => t);
    const beats = au.beats.filter((b) => b >= start - 0.6 && b < end + 0.6);
    this.map = new SectorMap(L3, this.c3, this.c4, kicks, beats);
    this.disc = new Disc(this.L.texture, this.map.mask);
    this.press = new Press(L1, L2, start, this.c2, this.c3, kicks, beats);
    this.map.setEntry(this.press.diveStemPx);
    this.crash = new Crash(L3, L4, this.c4, end, kicks, beats);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const L = this.L; L.clear();
    let post: PostOverrides;
    if (t < this.c3) {
      const cam = this.press.cam(t);
      post = this.press.draw(L.ctx, t, cam);
      this.disc.set(this.press.disc(t, cam));
    } else if (t < this.c4) {
      const r = this.map.draw(L.ctx, t);
      this.disc.set(r.disc);
      post = r.post;
    } else {
      const r = this.crash.draw(L.ctx, t);
      this.disc.set(r.disc);
      post = r.post;
    }
    L.upload();
    this.disc.render(this.ctx.renderer, out);
    return post;
  }
}
