"""Run mlx-whisper (word timestamps) on the time-corrected vocal stem.

Writes work/whisper_<tag>.json, used as an independent cross-check for the CTC forced
alignment. With --draft it also writes lyrics/lyrics.src.js, a line-level DRAFT of the lyric
text (one line per whisper segment, approximate times) to be proofread by hand before aligning.

Run:  uv run python whisper_run.py [turbo|large] [--draft]
"""
import common  # noqa: F401  (sets cache dirs)
import json
import sys

import mlx_whisper

MODELS = {
    "turbo": "mlx-community/whisper-large-v3-turbo",
    "large": "mlx-community/whisper-large-v3-mlx",
}
VOCALS16K = common.WORK / "vocals16k.wav"


def ensure_vocals16k():
    if VOCALS16K.exists():
        return
    import soundfile as sf
    y, sr = common.load_stem("vocals", sr=16000)
    sf.write(VOCALS16K, y, sr)


def run(tag, model, prompt=None):
    res = mlx_whisper.transcribe(
        str(VOCALS16K), path_or_hf_repo=model, language="en",
        word_timestamps=True, condition_on_previous_text=False, initial_prompt=prompt,
        temperature=0.0, no_speech_threshold=None, hallucination_silence_threshold=None,
    )
    out = common.WORK / f"whisper_{tag}.json"
    out.write_text(json.dumps(res, indent=1, default=float))
    for seg in res["segments"]:
        print(f"{seg['start']:7.2f} {seg['end']:7.2f} {seg['text']}")
    return res


def write_draft(res):
    """lyrics/lyrics.src.js in the upstream format (start, end, "text" per line). Words whisper
    was unsure of (probability < 0.5) are marked with a trailing '?' for proofreading."""
    rows = []
    for seg in res["segments"]:
        words = seg.get("words") or []
        if not words:
            continue
        text = " ".join(w["word"].strip() + ("?" if w.get("probability", 1) < 0.5 else "") for w in words).strip()
        if text:
            rows.append([round(words[0]["start"], 2), round(words[-1]["end"], 2), text])
    common.LYRICS_SRC.parent.mkdir(exist_ok=True)
    body = ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in rows)
    common.LYRICS_SRC.write_text(
        "// DRAFT from whisper (analysis/whisper_run.py --draft): proofread every line; '?' marks words\n"
        "// whisper was unsure of. Format per sung line: start s, end s, text (times approximate).\n"
        f"const LY = [\n{body}\n];\n")
    print(f"wrote {common.LYRICS_SRC} ({len(rows)} lines)")


if __name__ == "__main__":
    which = next((a for a in sys.argv[1:] if not a.startswith("--")), "turbo")
    ensure_vocals16k()
    res = run(which, MODELS[which])
    if "--draft" in sys.argv:
        write_draft(res)
