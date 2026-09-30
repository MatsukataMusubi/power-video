# power-video

A code-rendered music video for Grimes – "We Appreciate Power". Every frame is a deterministic
function of song time, so the browser preview and the offline 1080p60 / 4K60 export are identical.

**This is a fork of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video)** by Giacomo
Magnanini, the engine behind the "I'm Upping My P(doom)" video
([4K on YouTube](https://www.youtube.com/watch?v=5EoO5413dBY)). The renderer, the post chain, the
typography, the scene API and the offline exporter are upstream's; the upstream remote is kept so
engine fixes can be merged back in.

Status: all 21 plates are built. The film follows P(doom)'s storyboard structure entry for entry
([`docs/PDOOM-STRUCTURE.md`](docs/PDOOM-STRUCTURE.md): cuts on the last beat before a line, a
designed hand-off at every cut, one maximal hit per plate, hook ×4 and prompt ×3), with its own
imagery, one drawing language per plate ([`docs/PLATES.md`](docs/PLATES.md)), for the opposite
argument: human–AI symbiosis ([`docs/TREATMENT.md`](docs/TREATMENT.md)). The lyric text still awaits
a proofread. Decisions are logged in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## What this fork adds

- **Analysis for any song** (upstream's was tuned to one track): a tempo window from librosa's
  estimate, an automatic bar phase, named sections in `analysis/sections.json`, and a single-pass
  MMS_FA CTC aligner with per-line windows. The knobs are `--bpm LO HI` and `--bar-offset K`.
- **A bar-grid editor**, `analysis/make_edit.py`, that cuts a long song down to a target length.
  It removes whole bars only, splices in vocal gaps, can start cold on any bar (`start_bar`), and
  remaps the lyrics, sections and whisper words into edit time.
- **A palette retune**: the signal family is submit blue, and the film halation follows the
  signal colour. It was hardcoded orange.
- **The plates** (`app/src/scenes/`): hook ×4 and prompt ×3 as templates plus one scene per
  entry, ported move for move from P(doom)'s scenes with new imagery; a thread object (a blue
  dot) handed across every cut, and a value on the Kardashev scale that climbs across the hooks
  (`scenes/_power.ts` holds the shared motifs and every cut's hand-off geometry).
- **Cut versions**: `analysis/recut.py` cuts the working edit down further along its bar grid
  (splices off words, all timing data remapped) into `data/cuts/<name>/`; the app and the renderer
  load one with `?cut=<name>` / `--cut <name>`, and the timeline skips entries a cut removed.
  `analysis/cuts/` has a ~1:53 social cut and a ~3:00 long cut.
- **A dev karaoke scene** (`app/src/scenes/karaoke.ts`), the placeholder for any entry whose scene
  file is missing.
- **Parallel rendering across machines**: the export is split into segments by measured cost,
  the segments are joined losslessly and the audio is muxed once. See
  [`docs/RENDERING.md`](docs/RENDERING.md).

**To put the engine on your own song, follow [`docs/ADAPTING.md`](docs/ADAPTING.md).**

## Not in the repo (copyright)

The song and anything carrying its lyrics are local only and gitignored:
- `audio/`: `source.mp3` and the edit, `song.mp3`
- `lyrics/`: the lyric text, the whisper draft and the proofreading sheet
- `data/lyrics.json`

To build or render, supply your own legally obtained copy of the song. `data/audio.json` is
committed. It holds derived timing data only: beats, sections and envelopes, with no audio and
no lyric text.

## Requirements

[bun](https://bun.sh), Google Chrome (the offline renderer drives it headless through
playwright-core) and ffmpeg with libx264. The analysis tools need [uv](https://docs.astral.sh/uv/)
and run on Apple Silicon, because whisper runs through mlx-whisper. The renderer doesn't need them.

## Layout

- `analysis/`: Python (uv) tools that turn the song into timing data.
  - `whisper_run.py [turbo|large] [--draft]`: whisper word timestamps on the vocal stem; `--draft` writes a line-level lyric draft to proofread.
  - `align_song.py`: word-level alignment (one global MMS_FA CTC Viterbi pass, per-line windows) → `data/lyrics.json`.
  - `analyze.py [--plots] [--bpm LO HI] [--bar-offset K]`: beat grid, bar phase, sections (`sections.json`), envelopes, onsets → `data/audio.json`.
  - `measure_offset.py`: stem/mp3 offset (→ `common.STEM_OFFSET_SAMPLES`).
  - `make_edit.py`: cuts the song along the bar grid (`edit.json`), splicing only in vocal gaps; remaps the lyric draft, sections and whisper words into edit time.
- `app/`: the renderer (TypeScript + three.js, bun + Vite). The engine in `src/engine/` is upstream's; `src/scenes/` holds the plates and `src/timeline.ts` the edit. The scene API is in [`docs/ENGINE.md`](docs/ENGINE.md).
- `docs/`: [`ADAPTING.md`](docs/ADAPTING.md) (your own song), [`ENGINE.md`](docs/ENGINE.md) (scene API, upstream), [`RENDERING.md`](docs/RENDERING.md) (parallel renders), [`TREATMENT.md`](docs/TREATMENT.md) (this video's concept), [`DECISIONS.md`](docs/DECISIONS.md).
- `out/`: renders (not in the repo).

## Regenerate the data

The video runs on a roughly 4-minute edit of the song, `analysis/edit.json`. The edit removes
whole bars, so the beat grid is unbroken. The uncut song's data is kept aside in source time,
and the edit is always rebuilt from it:

```sh
cd analysis && uv sync
uv run python make_edit.py                # audio/song.mp3 + edit-time lyric draft, sections, whisper words
uv run python -m demucs -n htdemucs_ft -o stems ../audio/song.mp3
uv run python measure_offset.py           # check common.STEM_OFFSET_SAMPLES
uv run python vocal_feats.py
uv run python align_song.py               # data/lyrics.json
uv run python analyze.py --plots          # data/audio.json (+ analysis/qa/*.png)
```

The full procedure, starting from a bare mp3, is in [`docs/ADAPTING.md`](docs/ADAPTING.md).

## Preview

```sh
cd app
bun install
bunx vite                                   # http://localhost:5173/?t=30
```

| Key | Action |
|---|---|
| space | play / pause |
| ← / → | seek ±1 s (±5 s with shift) |
| `,` / `.` | step one frame |
| `[` / `]` | previous / next scene |
| `l` | loop the current scene |
| `h` | hide the UI |

## Render locally

**1. Inputs.** A fresh clone has `data/audio.json` but not the song. Before the app can boot you
need two local files, which are never committed:
- `audio/song.mp3`, the audio the video plays and the export muxes in
- `data/lyrics.json`, the word timings. Without it the app stops with "no lyrics data found"

Build both from your own copy of the song, following [`docs/ADAPTING.md`](docs/ADAPTING.md). If
you use `analysis/edit.json`, `audio/song.mp3` is the edit that `make_edit.py` writes. Your
source mp3 goes in `audio/source.mp3`.

**2. Tools.** Install [bun](https://bun.sh), Google Chrome (the stable channel: the renderer
launches it through playwright-core with `channel: 'chrome'`) and ffmpeg with libx264 on your
`PATH`. Then run:

```sh
cd app
bun install
```

**3. Check before a long render.** `render.ts` uses a dev server on `--url` (default
`http://localhost:5173`). If none is reachable, it starts its own with live reload off.

```sh
bun scripts/render.ts sheet --cuts --out ../out/wip/cuts.png      # contact sheet at every scene boundary
bun scripts/render.ts stills --t 1.5,30,90 --out ../out/wip       # a few full frames
bun scripts/render.ts video --from 0 --to 10 --samples 4 --out ../out/wip/draft.mp4   # quick 10 s draft
```

**4. Final render.**

```sh
# 1080p60
bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/power.mp4
# 4K60 (true 3840x2160, GPU-bound, hours on a laptop)
bun scripts/render.ts video --scale 2 --samples auto --shutter 0.2 --x264 aq-mode=3:rc-lookahead=30 --out ../out/power-4k.mp4
```

- **Output:** 1920×1080 at 60 fps, x264 CRF 16 (`--crf N` changes it), with AAC 320k audio from
  `audio/song.mp3`. `--noaudio` leaves the audio out.
- **Motion blur:** `--samples auto` picks a sub-frame count per frame (12 for a still frame, up
  to 324 for fast motion) over a `--shutter` of 0.2 frame times. A fixed `--samples N` is
  faster; `--samples 4` makes a quick draft.
- **Part of the song:** `--from A --to B`, in seconds of song time. Segments cut on whole
  frames, so they concatenate losslessly. That is how a long render is split, on one machine
  with two pipelines or across several (see [`docs/RENDERING.md`](docs/RENDERING.md)).
- **Speed:** `bun scripts/render.ts perf --from A --to B --samples auto` prints ms per frame, so
  you can estimate the total render time first.
- **While you edit scenes:** run a server without live reload (`PDOOM_NO_HMR=1 bunx vite --port 5190`)
  and pass `--url http://localhost:5190`, so a file save cannot reload the page mid-render.
- **Debugging:** `--headed` shows the Chrome window. Browser errors are printed after the run.

This has been used on macOS with Apple Silicon: Chrome is launched with its Metal backend. On
other platforms, expect to adjust the Chrome flags in `openPage` in `app/scripts/render.ts`.
Upstream's [README](https://github.com/mexicat/pdoom-video#render-the-video) has more detail,
including 4K cost, memory and bitrate numbers.

## Credits

- **Engine:** [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) by Giacomo Magnanini (MIT),
  with contributions from Anwin Sharon and HEOJUNFO. It was made with Claude in Claude Code.
- **This fork:** lycfyi, with Claude (Opus 5.5) in Claude Code.
- **Song:** "We Appreciate Power" by Grimes (2018). Not ours, and not covered by the license.
- **Fonts:** Archivo, IBM Plex Mono and Cormorant Garamond (SIL Open Font License). Single-stroke
  EMS and Hershey fonts via the `hersheytext` package (OFL / public domain).

## License

The code is released under the [MIT License](LICENSE). The original copyright is Giacomo
Magnanini's, and the changes in this fork are lycfyi's. The fonts in `app/public/fonts/` keep
their own licenses (see Credits). The song and its lyrics are not covered by the license: they
belong to their authors.
