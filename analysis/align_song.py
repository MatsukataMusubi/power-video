"""Word-level lyric alignment for any English song -> data/lyrics.json

One global CTC Viterbi pass over the whole song (torchaudio MMS_FA emissions on the
time-corrected Demucs vocal stem, 20 ms frames). Lyric units are the words of
lyrics/lyrics.src.js; each is spelled with plain letters (PRON overrides for acronyms and
numbers). A garbage "star" state sits between lines and absorbs intros, instrumentals,
ad-libs and backing vocals that are not in the lyric text.

Confidence: agreement with whisper's independent word timestamps (work/whisper_*.json):
1.0 when whisper heard the same word starting within 0.25 s, 0.6 within 0.6 s, else 0.3.

Manual corrections go in FIX, keyed by (line, word) -> dict(start=..., end=..., conf=...),
only where the QA plots clearly show the automatic result is wrong.

Run:  uv run python align_song.py
"""
import common
import json
import re

import numba
import numpy as np
import torch
import torchaudio

HOP, SR = 320, 16000
FRAME = HOP / SR  # 20 ms
STAR_MARGIN = 3.0  # garbage score = best non-blank log-prob - margin
LEGATO_GAP = 0.25  # a word ends where the next starts unless there is a real gap
WINDOW_MARGIN = 1.5  # a line may only land within its lyrics.src.js times +- this (s)

# display token (lowercase, punctuation stripped) -> pronunciation in plain letters
PRON = {
    "ai": "ay eye",
}

FIX = {}


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def pron(word):
    k = norm(word)
    return PRON.get(k, k.replace("'", ""))


def emissions():
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model(with_star=False).eval()
    labels = list(bundle.get_labels(star=None))
    y, _ = common.load_stem("vocals", sr=SR)
    y = y / (np.abs(y).max() + 1e-9)
    n = len(y) // HOP
    chunk, ctx = 20 * SR, 3 * SR
    out = np.full((n, len(labels)), np.nan, np.float32)
    for s in range(0, len(y), chunk):
        a, b = max(0, s - ctx), min(len(y), s + chunk + ctx)
        with torch.inference_mode():
            em, _ = model(torch.from_numpy(y[a:b]).float()[None])
            em = torch.log_softmax(em, -1)[0].numpy()
        f0 = a // HOP
        k0, k1 = (s - a) // HOP, min(em.shape[0], (min(len(y), s + chunk) - a) // HOP)
        out[f0 + k0: f0 + k1] = em[k0:k1]
    for i in range(n):
        if np.isnan(out[i, 0]):
            out[i] = out[i - 1]
    return out, labels


@numba.njit(cache=True)
def viterbi(E, seq, lo, hi):
    """E: [T, V] log-probs with column V-1 = star score; seq: token ids incl. star separators;
    lo/hi: per-state allowed frame range (the line windows). Standard CTC topology (blank=0
    between tokens). Returns the per-frame state index."""
    T = E.shape[0]
    L = len(seq)
    S = 2 * L + 1
    NEG = -1e30
    dp = np.full(S, NEG)
    bp = np.zeros((T, S), np.int8)
    dp[0] = E[0, 0]
    dp[1] = E[0, seq[0]]
    for t in range(1, T):
        nd = np.full(S, NEG)
        for s in range(S):
            if t < lo[s] or t > hi[s]:
                continue
            tok = 0 if s % 2 == 0 else seq[s // 2]
            best, arg = dp[s], 0
            if s >= 1 and dp[s - 1] > best:
                best, arg = dp[s - 1], 1
            if s >= 2 and s % 2 == 1 and seq[s // 2] != seq[s // 2 - 1] and dp[s - 2] > best:
                best, arg = dp[s - 2], 2
            nd[s] = best + E[t, tok]
            bp[t, s] = arg
        dp = nd
    s = S - 1 if dp[S - 1] > dp[S - 2] else S - 2
    path = np.zeros(T, np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= bp[t, s]
    return path


def whisper_words():
    ws = []
    for p in sorted(common.WORK.glob("whisper_*.json")):
        for seg in json.loads(p.read_text())["segments"]:
            for w in seg.get("words") or []:
                ws.append((norm(w["word"]), float(w["start"])))
    return ws


def main():
    src = common.load_lyrics_src()
    lines = [t for _, _, t in src]
    em, labels = emissions()
    lab = {c: i for i, c in enumerate(labels)}
    star = np.max(em[:, 1:], axis=1) - STAR_MARGIN
    E = np.concatenate([em, star[:, None]], 1).astype(np.float64)
    STAR = E.shape[1] - 1
    seq, owner, U = [STAR], [(-1, -1)], []
    for li, line in enumerate(lines):
        words = line.split()
        U.append(words)
        for wi, w in enumerate(words):
            for ch in pron(w):
                if ch in lab:
                    seq.append(lab[ch])
                    owner.append((li, wi))
        seq.append(STAR)
        owner.append((-1, -1))
    seq = np.array(seq, np.int64)
    # line windows: token states (and the blanks inside a line) may only be visited within the
    # line's draft times +- WINDOW_MARGIN; star states and blanks next to them are free
    T = len(E)
    tok_lo = np.array([0 if o[0] < 0 else max(0, int((src[o[0]][0] - WINDOW_MARGIN) / FRAME)) for o in owner])
    tok_hi = np.array([T if o[0] < 0 else min(T, int((src[o[0]][1] + WINDOW_MARGIN) / FRAME)) for o in owner])
    S = 2 * len(seq) + 1
    lo, hi = np.zeros(S, np.int64), np.full(S, T, np.int64)
    for st in range(S):
        if st % 2 == 1:
            lo[st], hi[st] = tok_lo[st // 2], tok_hi[st // 2]
        else:
            k = st // 2  # blank between token k-1 and token k
            if 0 < k < len(seq) and owner[k - 1][0] >= 0 and owner[k][0] >= 0:
                lo[st], hi[st] = min(tok_lo[k - 1], tok_lo[k]), max(tok_hi[k - 1], tok_hi[k])
    print(f"frames {T}  tokens {len(seq)}  lines {len(lines)}", flush=True)
    path = viterbi(E, seq, lo, hi)

    span = {}
    for t, s in enumerate(path):
        if s % 2 == 1:
            o = owner[s // 2]
            if o[0] < 0:
                continue
            a, b = span.get(o, (t, t))
            span[o] = (min(a, t), max(b, t))

    wh = whisper_words()
    res = {"lines": [], "notes": (
        "Word timings: one global MMS_FA CTC Viterbi pass on the Demucs vocal stem (align_song.py), "
        "legato ends, conf = agreement with whisper word starts. Manual FIX entries: "
        + (", ".join(f"L{k[0]} w{k[1]}" for k in FIX) or "none") + ".")}
    low = []
    for li, words in enumerate(U):
        out = []
        for wi, w in enumerate(words):
            a, b = span.get((li, wi), (None, None))
            out.append({"w": w, "start": None if a is None else round(a * FRAME, 3),
                        "end": None if b is None else round((b + 1) * FRAME, 3)})
        for i, w in enumerate(out):  # words with no frames: squeeze between neighbours
            if w["start"] is None:
                prev = next((x["end"] for x in reversed(out[:i]) if x["end"] is not None), None)
                nxt = next((x["start"] for x in out[i + 1:] if x["start"] is not None), None)
                w["start"] = prev if prev is not None else nxt
                w["end"] = nxt if nxt is not None else prev
        for i in range(len(out) - 1):
            if out[i + 1]["start"] - out[i]["end"] < LEGATO_GAP:
                out[i]["end"] = out[i + 1]["start"]
        for wi, w in enumerate(out):
            k = norm(w["w"])
            d = min((abs(s - w["start"]) for n, s in wh if n == k), default=9)
            w["conf"] = 1.0 if d < 0.25 else 0.6 if d < 0.6 else 0.3
            for key, v in FIX.get((li, wi), {}).items():
                w[key] = v
            if w["conf"] < 0.6:
                low.append(f"L{li:02d} w{wi} {w['w']!r} @{w['start']:.2f}")
        res["lines"].append({"i": li, "text": " ".join(words), "start": out[0]["start"],
                             "end": out[-1]["end"], "words": out})
        print(f"L{li:02d} {out[0]['start']:7.2f}-{out[-1]['end']:7.2f}  "
              + " ".join(f"{w['w']}@{w['start']:.2f}" for w in out))
    (common.DATA / "lyrics.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
    print(f"wrote {common.DATA / 'lyrics.json'}; {len(low)} low-confidence words:")
    for x in low:
        print("  ", x)


if __name__ == "__main__":
    main()
