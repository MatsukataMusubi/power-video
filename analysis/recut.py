"""Cut the working edit down further (social / long versions) without re-running the analysis.

The working edit (audio/song.mp3 + data/audio.json + data/lyrics.json, edit time) is cut along its own
bar grid and every timed thing is remapped, so the plates, which read everything from the data, just
follow. Same rules as make_edit.py: every cut removes whole bars, so the beat grid runs on unbroken;
the splice is moved off the downbeat by the same offset on both sides (two beats before … a quarter
beat after), never inside a word, and among the valid offsets the one with the least vocal at both
ends wins; 25 ms equal-power crossfades centred on the splice (lengths are exact).

analysis/cuts/<name>.json:
  {"cuts": [[from_bar, to_bar], ...],   # remove bars [from, to) of the working edit (bar k = downbeat k)
   "end_bar": 94, "fade": 1.5}          # optional: stop at that downbeat, fading over the last seconds

Outputs (gitignored, they carry the song and its lyrics): data/cuts/<name>/{song.mp3, audio.json,
lyrics.json}. The app loads them with ?cut=<name>; render.ts takes --cut <name>.

Run:  analysis/.venv/bin/python analysis/recut.py social
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
XFADE = 0.025
SR = 48000


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def main():
    name = sys.argv[1]
    cfg = json.loads((ROOT / "analysis" / "cuts" / f"{name}.json").read_text())
    au = json.loads((ROOT / "data" / "audio.json").read_text())
    ly = json.loads((ROOT / "data" / "lyrics.json").read_text())
    words = [w for l in ly["lines"] for w in l["words"]]
    db, bp, fps = au["downbeats"], au["beat_period"], au["fps"]
    vocal = np.asarray(au["vocal"], np.float32)

    def vol(t):
        i = int(round(t * fps))
        return float(vocal[max(0, i - 3): i + 4].mean()) if 0 <= i < len(vocal) else 0.0

    # ---- splice points
    kept, t0, log = [], 0.0, []
    for a, b in sorted(cfg["cuts"]):
        best = None
        for d in np.arange(-2 * bp, 0.25 * bp + 1e-9, 0.005):
            L, R = db[a] + d, db[b] + d
            # no word may straddle either splice, and nothing sung before L may run into the cut
            if any(w["start"] < L < w["end"] or w["start"] < R < w["end"] for w in words):
                continue
            if any(w["start"] < L and w["end"] > L for w in words):
                continue
            score = vol(L) + vol(R) + 0.02 * abs(d)
            if best is None or score < best[0]:
                best = (score, float(d), L, R)
        if best is None:
            raise SystemExit(f"no valid splice for bars [{a}, {b})")
        _, d, L, R = best
        log.append(f"cut bars [{a},{b}): {L:.3f} → {R:.3f} (offset {d * 1000:+.0f} ms)")
        kept.append((t0, L))
        t0 = R
    end = db[cfg["end_bar"]] if "end_bar" in cfg else au["duration"]
    kept.append((t0, end))
    fade = float(cfg.get("fade", 0))

    offs, acc = [], 0.0
    for a, b in kept:
        offs.append(acc - a)
        acc += b - a
    total = acc

    def remap(t):
        for (a, b), o in zip(kept, offs):
            if a - 1e-9 <= t < b:
                return t + o
        return None

    # ---- audio
    y = decode(ROOT / "audio" / "song.mp3")
    h = int(XFADE * SR / 2)
    parts = []
    for i, (a, b) in enumerate(kept):
        s, e = int(round(a * SR)), int(round(b * SR))
        parts.append((s, e))
    out = []
    for i, (s, e) in enumerate(parts):
        seg = y[s:e].copy()
        if i > 0:  # crossfade in: the previous segment's tail over this one's head, centred on the splice
            ps, pe = parts[i - 1]
            tail = y[pe: pe + h]
            head = y[s - h: s]
            k = np.linspace(0, 1, h, dtype=np.float32)[:, None]
            # out already holds the previous segment up to pe; blend its last h samples with this segment's pre-roll,
            # and this segment's first h samples with the previous segment's post-roll
            out[-1][-h:] = out[-1][-h:] * np.cos(k * np.pi / 4) + head * np.sin(k * np.pi / 4)
            seg[:h] = tail * np.cos((k + 1) * np.pi / 4) + seg[:h] * np.sin((k + 1) * np.pi / 4)
        out.append(seg)
    z = np.concatenate(out)
    if fade > 0:
        n = int(fade * SR)
        z[-n:] *= np.cos(np.linspace(0, np.pi / 2, n, dtype=np.float32))[:, None]
    dst = ROOT / "data" / "cuts" / name
    dst.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "cut.wav"
        sf.write(wav, z, SR)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-q:a", "0", str(dst / "song.mp3")], check=True)

    # ---- audio.json
    A = dict(au)
    A["duration"] = round(total, 3)
    A["beats"] = [round(v, 3) for v in (remap(t) for t in au["beats"]) if v is not None]
    A["downbeats"] = [round(v, 3) for v in (remap(t) for t in au["downbeats"]) if v is not None]
    secs = []
    for s in au["sections"]:
        pieces = [(max(s["start"], a), min(s["end"], b)) for a, b in kept if min(s["end"], b) > max(s["start"], a) + 0.05]
        # a section the cuts reduced to a sliver (< ~half a bar) folds into its neighbour
        if not pieces or sum(e - s0 for s0, e in pieces) < 1.2:
            continue
        st, en = remap(pieces[0][0]), remap(pieces[-1][1] - 1e-6)
        secs.append({"name": s["name"], "start": round(st, 3), "end": round(min(total, en), 3)})
    for i in range(1, len(secs)):  # contiguous
        secs[i - 1]["end"] = secs[i]["start"]
    if secs:
        secs[-1]["end"] = A["duration"]
    A["sections"] = secs
    for k in ("rms", "low", "mid", "high", "vocal", "drums", "bass", "other"):
        arr = au[k]
        A[k] = [v for a, b in kept for v in arr[int(round(a * fps)): int(round(b * fps))]]
    A["onsets"] = {k: [[round(remap(t), 3), s] for t, s in v if remap(t) is not None] for k, v in au["onsets"].items()}
    A["notes"] = au["notes"] + f" Cut '{name}' by analysis/recut.py: " + "; ".join(log) + f"; ends {end:.3f} (fade {fade} s)."
    (dst / "audio.json").write_text(json.dumps(A))

    # ---- lyrics.json
    lines = []
    for l in ly["lines"]:
        ws = []
        for w in l["words"]:
            s0 = remap(w["start"])
            if s0 is None:
                continue
            w2 = dict(w)
            w2["start"] = round(s0, 3)
            w2["end"] = round(min(total, w["end"] + (s0 - w["start"])), 3)
            if "syl" in w2 and isinstance(w2["syl"], list):
                w2["syl"] = [[round(x + (s0 - w["start"]), 3) for x in sy] if isinstance(sy, list) else sy for sy in w2["syl"]]
            ws.append(w2)
        if not ws:
            continue
        l2 = dict(l)
        l2["words"] = ws
        l2["start"], l2["end"] = ws[0]["start"], ws[-1]["end"]
        if len(ws) != len(l["words"]):
            l2["text"] = " ".join(w["w"] for w in ws)
        lines.append(l2)
    L = dict(ly)
    L["lines"] = lines
    (dst / "lyrics.json").write_text(json.dumps(L))

    print("\n".join(log))
    print(f"{name}: {total:.3f} s ({int(total // 60)}:{total % 60:04.1f}), {len(lines)} lines, sections: " + ", ".join(s["name"] for s in secs))


if __name__ == "__main__":
    main()
