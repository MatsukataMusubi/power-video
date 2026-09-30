# Putting the engine on your own song

Upstream's analysis was built around one track, "I'm Upping My P(doom)". This fork makes the
pipeline work for any song and adds a bar-grid editor. This guide covers the whole path from a
bare mp3 to a previewable video, and the knobs to tune along the way. The scene API itself is in
[`ENGINE.md`](ENGINE.md).

Everything below runs in `analysis/` unless noted. The first run downloads the models (Demucs,
whisper, MMS_FA) into `analysis/.cache/`; see `common.py`. whisper runs through mlx-whisper, so
the analysis needs Apple Silicon.

```sh
cd analysis && uv sync
```

## 0. What you supply (never committed)

| file | what |
|---|---|
| `audio/song.mp3` | the song the video plays. If you cut an edit (step 6), this is generated and your original goes in `audio/source.mp3` |
| `lyrics/lyrics.src.js` | the lyric text, one sung line per row: `[start_s, end_s, "text"]`. The times only need to be approximate: they give each line a search window for the aligner |

`audio/`, `lyrics/` and `data/lyrics*.json` are gitignored. Keep them that way for any song you
don't own.

## 1. Stems

```sh
uv run python -m demucs -n htdemucs_ft -o stems ../audio/song.mp3    # -> stems/htdemucs_ft/song/
```

The analysis reads the `vocals`, `drums`, `bass` and `other` stems.

## 2. Stem offset

The mp3's gapless decode (ffmpeg, libsndfile and browsers all use it) is the time reference.
Demucs decodes without trimming the encoder delay, so its stems run late by a constant number of
samples.

```sh
uv run python measure_offset.py
```

The script prints the lag in several windows. They must all agree. Put the value in
`common.STEM_OFFSET_SAMPLES`. Every script shifts the stems by it, so an error here shows up
later as words that are all early or all late.

## 3. Lyric draft

If you don't have timed lyrics yet, let whisper write a draft:

```sh
uv run python whisper_run.py turbo
uv run python whisper_run.py large --draft   # writes lyrics/lyrics.src.js (approximate, line per segment)
```

Proofread the draft by hand. Where the two runs disagree (`work/whisper_turbo.json` and
`work/whisper_large.json`), listen and decide. Fix words, merge or split lines so that each row
is one sung line, and drop anything that isn't sung. The aligner treats what's left of the
lyric text as the truth.

## 4. Alignment

```sh
uv run python align_song.py       # -> data/lyrics.json
```

This is one global CTC Viterbi pass over the whole vocal stem, with each line held to its
window. A garbage state between lines absorbs intros, ad-libs and backing vocals. Each word gets
a confidence from how well it agrees with whisper (1.0, 0.6 or 0.3).

What to tune, in `align_song.py`:
- `PRON`: spell out acronyms and numbers the way they are sung (keys are lowercase: `"ai": "ay eye"`).
- `FIX`: manual word corrections keyed by `(line, word)`. Use it only where the QA plots show the
  automatic result is clearly wrong.

## 5. Tempo, bars and sections

```sh
uv run python vocal_feats.py      # cached vocal-stem features (rms, f0, onsets), read by analyze.py
uv run python analyze.py --plots  # -> data/audio.json, analysis/qa/*.png
```

The tempo is fitted as one constant grid, with the phase refined on kick attacks. The bar phase
comes from where kicks, snares and bass-harmony changes fall in the bar. Read the printed summary
and the plots in `analysis/qa/`, then tune:

| symptom | knob |
|---|---|
| tempo is half or double (e.g. 54 instead of 108) | `--bpm LO HI`, the search range (default: librosa's estimate ±8%) |
| downbeats land on beat 2, 3 or 4 | `--bar-offset K`, where beat index K (0..3) is the first downbeat |
| sections are wrong or unnamed | write `analysis/sections.json`: `[[name, first_bar, end_bar], ...]`. Bar k starts at downbeat k; `null` means song start / song end |

Without `sections.json`, sections are found automatically by structural segmentation on bars.
Name them yourself for anything you will anchor scenes to: the timeline makes one entry per
section. The tempo and kick residual printed here also tell you whether the song has a steady
grid at all. The engine assumes it does.

## 6. Optional: cut an edit on the bar grid

Songs are often longer than a video should be. `make_edit.py` removes whole bars, so the beat
grid runs on unbroken across every splice.

**First, keep the uncut song's data aside in source time.** Run steps 1–5 on the full song with
it in `audio/song.mp3`, then move the results to the names `make_edit.py` reads:

| from | to |
|---|---|
| `audio/song.mp3` | `audio/source.mp3` |
| `analysis/stems/htdemucs_ft/song/` | `analysis/stems/htdemucs_ft/source/` |
| `lyrics/lyrics.src.js` | `lyrics/lyrics.src.source.js` |
| `analysis/sections.json` | `analysis/sections.source.json` |
| `data/{audio,lyrics}.json`, `analysis/work/whisper_*.json` | `analysis/work/source/` |

Then describe the edit in `analysis/edit.json`:

```json
{"source": "audio/source.mp3",
 "start_bar": 13,
 "cuts": [[19, 35], [63, 71]],
 "end": 326.0, "fade": 4.0}
```

- `cuts`: remove bars `[from_bar, to_bar)`. Pick them from the section table, so that whole
  verses, repeated choruses and long instrumentals go.
- `start_bar` (optional): open cold on that bar and drop everything before it. This is useful
  for social feeds, where the first second has to be the hook. A pickup into that bar (a line
  starting less than 2 beats before it) is kept whole, with a 10 ms fade-in. Choose a bar where
  no held note crosses the bar line.
- `end` and `fade`: stop at this source time, with a fade-out.

```sh
uv run python make_edit.py        # -> audio/song.mp3, audio/song.map.json, and edit-time
                                  #    lyrics/lyrics.src.js, sections.json, work/whisper_*.json
```

How each splice is placed: it moves off the downbeat by the same offset on both sides, so the
bar phase still matches. It stays within two beats before and a quarter beat after the downbeat,
never lands on a word onset, keeps every line whole on its own side, and lets a pickup travel
with its own section. Among the valid offsets, it picks the one where the vocal stem is quietest.
Each splice gets a 25 ms equal-power crossfade.

**Check the splices by ear.** Listen through every splice in `audio/song.mp3` before going on.
If one is audible, move that cut by a bar, or cut a whole section instead. Then run the pipeline
again on the edit (steps 1, 2, 4 and 5; step 3's draft already came out of `make_edit.py`):

```sh
uv run python -m demucs -n htdemucs_ft -o stems ../audio/song.mp3
uv run python measure_offset.py && uv run python vocal_feats.py
uv run python align_song.py && uv run python analyze.py --plots
```

The edit is always rebuilt from the source-time data. To change the lyrics, fix
`lyrics/lyrics.src.source.js` (in source times), then rerun `make_edit.py` and the pipeline. You
can skip Demucs if `edit.json` did not change.

## 7. Look: palette and signal colour

The whole engine runs on a restrained palette with one colour that may glow, in
`app/src/engine/palette.ts`:

- `signal`: the only glowing colour. This fork uses submit blue `#2F5BFF`; upstream used hazard
  orange.
- `ember`: a lighter tone of `signal` for cores and highlights.
- `blood`: a deep tone of `signal` for shadows.
- `ink`, `bone`, `graphite` and `ash`: the neutrals.

Change the three signal tones together. The film halation in `post.ts` and the heat ramp in
`glsl/common.ts` follow `signal` (upstream had the halation hardcoded orange), so one edit
recolours the whole look. These three files are the only engine files this fork changed, which
keeps upstream merges easy. Upstream's names such as `__pdoom`, `PDOOM_NO_HMR` and the `PDoom`
HUD instrument are kept for the same reason.

## 8. Scenes and the timeline

```sh
cd app && bun install && bunx vite      # http://localhost:5173/?t=0
```

`app/src/timeline.ts` makes one entry per analysed section. A section with no plate yet plays
`scenes/karaoke.ts`, a dev read-out that shows the section, bar, beat, BPM and the current line
with word timing. Use it to check the data: if the words light up on time and the bar counter
turns over on the downbeat, the analysis is right.

To replace a section with a real plate, add it to `PLATES` in `timeline.ts` and write the scene
against the API in [`ENGINE.md`](ENGINE.md). Anchor events to content through the `Lyrics` API
(`lyrics.get("a few words of the line")`) and to the grid through `AudioData`
(`beatAt`, `timeOfBeat`, `sections`). Never hard-code times: they change every time the edit
or the alignment does.

## 9. Render

See the README for single-machine renders. To split a long 4K render across several machines,
see [`RENDERING.md`](RENDERING.md).
