"""Cut the song down along the bar grid -> an edited mp3 plus the source->edit time map.

analysis/edit.json:
  {"source": "audio/source.mp3",            # the uncut song (relative to the repo root)
   "start_bar": 13,                         # optional: open on this bar (drops everything before it)
   "cuts": [[from_bar, to_bar], ...],       # remove bars [from_bar, to_bar) (bar k = downbeat k)
   "end": 326.0, "fade": 4.0}               # stop at this source time with a fade-out

Every cut removes a whole number of bars, so the beat grid runs on unbroken through each splice.
The exact splice point is moved off the downbeat by the same offset on both sides (so the bar
phase still matches), within two beats before / a quarter beat after the downbeat, using the aligned
word onsets (data/lyrics.json): no splice on an onset, every line keeps all its words on its own
side, a pickup (a line starting < 2 beats before the downbeat) travels with its own section, and
among the valid offsets the one where the vocal stem is quietest at both ends wins.
25 ms equal-power crossfades.

Inputs are always the uncut song's data, kept aside in source time: work/source/{audio,lyrics}.json
and whisper_*.json, stems/htdemucs_ft/source/, lyrics/lyrics.src.source.js, sections.source.json.
Outputs (edit time): the mp3 (default audio/song.mp3) and <out>.map.json
([[src_start, src_end, edit_start], ...]); with the default output also lyrics/lyrics.src.js,
sections.json and work/whisper_*.json remapped into edit time (lines, sections and words inside
cuts are dropped). Then rerun the pipeline on the edit (see README).

Run:  uv run python make_edit.py [edit.json] [out.mp3]
"""
import common
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

XFADE = 0.025


def decode(path, sr=48000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(sr), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy(), sr


SRC = common.WORK / "source"
SRC_STEMS = common.ROOT / "stems" / "htdemucs_ft" / "source"


def vocal_rms():
    y, sr = sf.read(SRC_STEMS / "vocals.wav", dtype="float32", always_2d=True)
    y = y[common.STEM_OFFSET_SAMPLES:].mean(axis=1)
    hop = int(0.005 * sr)
    n = len(y) // hop
    r = np.sqrt(np.mean(y[: n * hop].reshape(n, hop) ** 2, axis=1))
    return r, 0.005


def main():
    cfg_path = Path(sys.argv[1]) if len(sys.argv) > 1 else common.ROOT / "edit.json"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else common.PROJECT / "audio" / "song.mp3"
    cfg = json.loads(cfg_path.read_text())
    audio = json.loads((SRC / "audio.json").read_text())
    P, db0 = audio["beat_period"], audio["downbeats"][0]
    bar_t = lambda k: db0 + 4 * P * k
    x, sr = decode(common.PROJECT / cfg["source"])
    vr, hop = vocal_rms()
    v = lambda t: vr[min(len(vr) - 1, max(0, int(t / hop)))]
    lines = json.loads((SRC / "lyrics.json").read_text())["lines"]
    PAD = 0.03

    def valid(a, b, d):
        """Word starts are reliable, word ends are not (legato-extended), so: no splice on a word
        onset, every line keeps all of its words on its own side, and loudness decides the rest."""
        ca, cb = a + d, b + d
        for ln in lines:
            st = [w["start"] for w in ln["words"]]
            if any(t - PAD < c < t + 0.12 for t in st for c in (ca, cb)):
                return False
            s0 = st[0]
            if s0 < a - 2 * P:  # a kept line before the cut: all its words before the splice
                if s0 < ca and st[-1] > ca - 0.1:
                    return False
            elif s0 < b - 2 * P:  # a line of the removed part (incl. its pickup)
                if s0 < ca or st[-1] > cb:
                    return False
            elif s0 < cb:  # the resumed section keeps its pickup
                return False
        return True

    # kept source segments [a, b)
    t = 0.0
    k0 = cfg.get("start_bar")
    if k0:
        # open on bar k0, moved earlier only as far as needed to keep a pickup into it whole
        a = bar_t(k0)
        starts = [w["start"] for ln in lines for w in ln["words"]]
        firsts = [ln["words"][0]["start"] for ln in lines if a - 2 * P <= ln["words"][0]["start"] < a + 0.12]
        t = min([a] + [s0 - 0.05 for s0 in firsts])
        assert not any(t - PAD < s0 < t + 0.12 for s0 in starts if s0 not in firsts), "opening splits a word"
        print(f"open at bar {k0}: {t:7.3f} s")
    segs = []
    for fb, tb in sorted(cfg["cuts"]):
        a, b = bar_t(fb), bar_t(tb)
        offs = [d for d in np.arange(-2 * P, 0.25 * P, 0.005) if valid(a, b, d)]
        if not offs:
            raise SystemExit(f"no clean splice for bars {fb}-{tb}: pick other bars")
        d = float(min(offs, key=lambda d: max(v(a + d), v(b + d))))
        segs.append([t, a + d])
        t = b + d
        print(f"cut bars {fb}-{tb}: {a + d:7.3f} -> {b + d:7.3f} (offset {d * 1000:+.0f} ms, removes {b - a:.3f} s)")
    segs.append([t, min(cfg.get("end", len(x) / sr), len(x) / sr)])

    # overlap-add: segment i sits at edit time E_i = sum of the previous segments' durations,
    # extended by half a crossfade on each inner side
    h = int(XFADE * sr / 2)
    E = np.concatenate([[0.0], np.cumsum([b - a for a, b in segs])])
    y = np.zeros((int(round(E[-1] * sr)) + 2 * h, 2), np.float32)
    tmap = []
    for i, (a, b) in enumerate(segs):
        lo = h if i else 0
        hi = h if i < len(segs) - 1 else 0
        seg = x[int(round(a * sr)) - lo: int(round(b * sr)) + hi].copy()
        ramp = np.linspace(0, np.pi / 2, 2 * h)[:, None]
        if lo:
            seg[: 2 * h] *= np.sin(ramp)
        if hi:
            seg[-2 * h:] *= np.cos(ramp)
        p0 = int(round(E[i] * sr)) - lo
        y[p0: p0 + len(seg)] += seg
        tmap.append([round(a, 4), round(b, 4), round(float(E[i]), 4)])
    y = y[: int(round(E[-1] * sr))]
    fin = int(0.01 * sr)  # 10 ms fade-in: no click on a cold open
    y[:fin] *= np.linspace(0, 1, fin)[:, None]
    fade = int(cfg.get("fade", 0) * sr)
    if fade:
        y[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    tmp = out.with_suffix(".wav")
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(tmp, y, sr)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-c:a", "libmp3lame", "-q:a", "0", str(out)], check=True)
    tmp.unlink()
    out.with_suffix(".map.json").write_text(json.dumps(tmap))
    print(f"wrote {out}: {len(y) / sr:.2f} s ({len(segs)} segments)")
    if out == common.PROJECT / "audio" / "song.mp3":
        remap_inputs(tmap, sorted(cfg["cuts"]), cfg.get("start_bar"))


def to_edit(tmap, t):
    for a, b, e in tmap:
        if a <= t < b:
            return round(e + (t - a), 3)
    return None


def remap_inputs(tmap, cuts, start_bar=None):
    # lyric draft: (start, end, text) per line. The draft's times are approximate (whisper), so a
    # line is kept when most of its span lies in one kept segment, and its times are clamped to it
    rows = [r for r in common.load_lyrics_src(common.PROJECT / "lyrics" / "lyrics.src.source.js")]
    keep = []
    for a, b, text in rows:
        best = max(tmap, key=lambda s: min(b, s[1]) - max(a, s[0]))
        sa, sb, e = best
        if min(b, sb) - max(a, sa) > 0.5 * (b - a):
            keep.append([round(e + max(a, sa) - sa, 3), round(e + min(b, sb) - sa, 3), text])
    body = ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in keep)
    common.LYRICS_SRC.write_text("// EDIT TIME, generated by analysis/make_edit.py from lyrics.src.source.js (edit that file,\n"
                                 "// then rerun make_edit.py). Format per sung line: start s, end s, text.\n"
                                 f"const LY = [\n{body}\n];\n")
    # sections: bar numbers minus the bars removed before them; sections starting inside a cut dropped
    k0 = start_bar or 0

    def bar(k):
        if k is None or k <= k0:
            return None
        if any(fb <= k < tb for fb, tb in cuts):
            return "cut"
        return k - k0 - sum(tb - fb for fb, tb in cuts if tb <= k)
    sec = [[n, bar(a)] for n, a, _ in json.loads((common.ROOT / "sections.source.json").read_text())]
    sec = [x for x in sec if x[1] != "cut"]
    sec = [x for i, x in enumerate(sec) if not (x[1] is None and i + 1 < len(sec) and sec[i + 1][1] is None)]
    sec = [[n, a, sec[i + 1][1] if i + 1 < len(sec) else None] for i, (n, a) in enumerate(sec)]
    (common.ROOT / "sections.json").write_text(json.dumps(sec))
    # whisper words (used for alignment confidence)
    for p in SRC.glob("whisper_*.json"):
        res = json.loads(p.read_text())
        segs = []
        for sg in res["segments"]:
            ws = [dict(w, start=to_edit(tmap, w["start"]), end=to_edit(tmap, w["end"] - 1e-3)) for w in sg.get("words") or []]
            ws = [w for w in ws if w["start"] is not None and w["end"] is not None]
            if ws:
                segs.append(dict(sg, start=ws[0]["start"], end=ws[-1]["end"], words=ws))
        (common.WORK / p.name).write_text(json.dumps({"segments": segs}))
    for stale in ("vocals16k.wav", "vocal_feats.npz"):
        (common.WORK / stale).unlink(missing_ok=True)
    print(f"remapped: {len(keep)}/{len(rows)} lyric lines, {len(sec)} sections, whisper words")


if __name__ == "__main__":
    main()
