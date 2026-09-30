# Rendering on several machines

A final 4K render can take hours on one machine, and the export is embarrassingly parallel. Every
frame is a pure function of song time, and with `--samples auto` no scene may keep state, so any
time range renders independently of the rest. The final renders for this video use every
machine on the local network.

## Worker checklist

- bun, Google Chrome and ffmpeg with libx264. The analysis tools (uv) are not needed on workers.
- A GPU that headless Chrome can use. On a headless machine, that means a logged-in session
  (autologin).
- Memory: a pipeline takes about 5 GB for headless Chrome plus about 4 GB for ffmpeg at 4K. A
  16 GB machine runs one pipeline, and at 4K it needs a short x264 lookahead
  (`--x264 aq-mode=3:rc-lookahead=30`).
- Reachable over ssh on the LAN. A laptop coordinator should be plugged in.

## Method

1. **Sync.** Every worker checks out the repo at the same commit. The local-only inputs
   (`audio/song.mp3` and `data/lyrics.json`) are copied from the coordinator over the LAN. They
   stay on the machines you own and are never pushed anywhere.
2. **Measure.** Run `bun scripts/render.ts perf --from A --to B --samples auto` on a few ranges
   per machine to get each machine's ms/frame. Scene cost varies a lot: a still plate stops at
   12 sub-frames, while a fast one goes to 108–324. So split the segments by **estimated cost**,
   not by equal time. Take the cost per range from a quick 1-sample `perf` pass on the
   coordinator, and each machine's throughput from its benchmark.
3. **Render.** Each worker renders its segments with identical encoder settings and no audio:
   `bun scripts/render.ts video --from A --to B --samples auto --shutter 0.2 --noaudio --out seg_NN.mp4`.
   Segment boundaries are whole frames (`render.ts` renders frames `round(from·fps)` …
   `round(to·fps) − 1`), so consecutive segments neither overlap nor leave a gap. Run each render
   under `caffeinate -dimsu` (macOS) and detached (`nohup … &`), so that a closed ssh session or sleep
   does not kill it.
4. **Join.** Copy the segments back to the coordinator. Concatenate the video streams without
   re-encoding (`ffmpeg -f concat -safe 0 -i list.txt -c copy`), then mux the audio once from
   `audio/song.mp3` (AAC 320k). Muxing once avoids AAC priming gaps at the segment joins.
5. **Check.** The frame count is `round(duration·60)`, a contact sheet of the frames around
   every segment join looks right, and the audio and video durations match.

A `scripts/farm.ts` coordinator (sync → benchmark → split → launch → collect → join) will be
written once real plates exist, since the split depends on their cost.
