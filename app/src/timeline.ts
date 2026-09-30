// The edit: which scene plays when. Boundaries are anchored to lyric lines and snapped
// to the beat grid, so they follow the aligned data (data/lyrics.json, data/audio.json).
// Structure: P(doom)'s, entry for entry (docs/PDOOM-STRUCTURE.md, approved 2026-09-28); the
// imagery is ours (docs/PLATES.md). Anchors avoid words still waiting for the lyric proofread:
// lines are found by their confident words or by position (the line after a hook, the nth line
// of a section), so a corrected lyric does not move a cut.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics, Line } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first word of a line (never after the word). */
  const cutAt = (l: Line, tol = 0.02) => au.timeOfBeat(Math.floor(au.beatAt(l.words[0]!.start + tol)));
  const cut = (q: string, nth = 0, tol = 0.02) => cutAt(ly.get(q, nth), tol);
  const sec = (name: string) => {
    const s = au.sections.find((x) => x.name === name);
    if (!s) throw new Error(`section not found: ${name}`);
    return s;
  };
  /** The first line containing q that starts inside a section. */
  const firstIn = (q: string, name: string) => {
    const s = sec(name);
    const l = ly.find(q).find((x) => x.start >= s.start - 0.3 && x.start < s.end);
    if (!l) throw new Error(`lyric not found in ${name}: ${q}`);
    return l;
  };
  const next = (l: Line) => ly.lines[l.i + 1]!;
  /** Nearest downbeat to the end of a line. */
  const after = (l: Line) => au.downbeats.reduce((b, d) => (Math.abs(d - l.end) < Math.abs(b - l.end) ? d : b), au.downbeats[0] ?? l.end);

  // Every entry is optional: a cut version (analysis/recut.py) drops whole sections, and an entry whose
  // anchor is gone is skipped (its predecessor runs on). Anchors by section, so a missing pre4 doesn't
  // shift which prompt is which.
  const tryT = <T,>(f: () => T): T | null => { try { return f(); } catch { return null; } };
  const HOOK = 'We appreciate power';
  const hookIn = (name: string) => tryT(() => firstIn(HOOK, name));
  const h2 = hookIn('chorus2'), h3 = hookIn('chorus4'), h4 = hookIn('chorus5');
  const promptIn = (name: string) => tryT(() => cutAt(firstIn('What will it take', name)));
  // (lines that start in the section, not the next section's pickup just before its end)
  const bridge = tryT(() => ly.linesIn(sec('bridge').start - 0.3, sec('bridge').end - 0.3)) ?? [];
  const inst = tryT(() => sec('instrumental'));
  const at = (l: Line | null | undefined) => (l ? cutAt(l) : null);
  const b = {
    world1: tryT(() => cut('Elevate the human race')),
    prompt1: promptIn('pre2'),
    hook2: at(h2),
    world2: h2 ? at(next(h2)) : null,
    drop: h2 ? tryT(() => after(ly.lines[next(h2).i + 1]!)) : null, // the bass drop: the downbeat that ends the hook's repeat
    verseA: tryT(() => cut('People like to say')),
    verseB: tryT(() => cut('Congratulations')),
    // the bridge sings its four lines twice: tape for the first pass, the platter for the second; a cut
    // that keeps one pass keeps the platter
    bridgeA: bridge.length >= 8 ? at(bridge[0]) : null,
    bridgeB: bridge.length >= 4 ? at(bridge[bridge.length - 4]) : null,
    prompt2: promptIn('pre4'),
    hook3: at(h3),
    world4: h3 ? at(next(h3)) : null,
    prompt3: promptIn('pre5'),
    hook4: at(h4),
    world5: h4 ? at(next(h4)) : null,
    preach: tryT(() => cut('preaching', 0)),
    inst: inst && inst.end - inst.start > 4 ? inst.start : null,
    outroV: tryT(() => cut('Neanderthal')),
    submit: tryT(() => cut('submit', 0)),
    tail: tryT(() => sec('tail').start),
  };

  type Cand = { id: string; file: string; start: number | null; params?: Record<string, any> };
  const C: Cand[] = [
    { id: 'hook1', file: 'hook', start: 0, params: { n: 1 } },
    { id: 'world1', file: 'climb', start: b.world1 },
    { id: 'prompt1', file: 'mate', start: b.prompt1, params: { variant: 1 } },
    { id: 'hook2', file: 'hook', start: b.hook2, params: { n: 2 } },
    { id: 'world2', file: 'grid', start: b.world2 },
    { id: 'drop', file: 'patch', start: b.drop },
    { id: 'verseA', file: 'patent', start: b.verseA },
    { id: 'verseB', file: 'hall', start: b.verseB },
    { id: 'bridgeA', file: 'tape', start: b.bridgeA },
    { id: 'bridgeB', file: 'platter', start: b.bridgeB },
    { id: 'prompt2', file: 'mate', start: b.prompt2, params: { variant: 2 } },
    { id: 'hook3', file: 'hook', start: b.hook3, params: { n: 3 } },
    { id: 'world4', file: 'culture', start: b.world4 },
    { id: 'prompt3', file: 'mate', start: b.prompt3, params: { variant: 3 } },
    { id: 'hook4', file: 'hook', start: b.hook4, params: { n: 4 } },
    { id: 'world5', file: 'mycel', start: b.world5 },
    { id: 'preach', file: 'organ', start: b.preach },
    { id: 'inst', file: 'exhibit', start: b.inst },
    { id: 'outroV', file: 'clade', start: b.outroV },
    { id: 'submit', file: 'summit', start: b.submit },
    { id: 'tail', file: 'summit', start: b.tail, params: { tail: true } },
  ];
  let es = C.filter((c) => c.start != null) as (Cand & { start: number })[];
  // in order, no empty or sliver windows (the predecessor runs on)
  es = es.filter((c, i) => i === 0 || c.start > es[i - 1]!.start);
  const MIN = 1.5;
  es = es.filter((c, i) => i === es.length - 1 || es[i + 1]!.start - c.start >= MIN || i === 0);
  // each hook knows the previous hook on screen (its number rolls up from that one's value)
  let prevHook = 0;
  const out: TimelineEntry[] = es.map((c, i) => {
    const params: Record<string, any> = { plate: c.file, ...(c.params ?? {}) };
    if (c.file === 'hook') { params.prev = prevHook; prevHook = params.n; }
    const end = i + 1 < es.length ? es[i + 1]!.start : au.duration;
    return { id: c.id, load: scene(modules[`./scenes/${c.file}.ts`] ? c.file : 'karaoke'), start: c.start, end, params };
  });
  return out;
}
