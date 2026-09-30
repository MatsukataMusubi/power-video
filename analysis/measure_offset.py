"""Measure the Demucs stems' offset against the gapless mp3 decode (-> common.STEM_OFFSET_SAMPLES).

The stems are summed and cross-correlated with the mix over a few windows; the result must be
constant across the song. Run: uv run python measure_offset.py
"""
import common
import numpy as np
import soundfile as sf
from scipy.signal import correlate

mix, _ = common.load_mix(44100)
stems = sum(sf.read(common.STEMS / f"{n}.wav", dtype="float32", always_2d=True)[0].mean(axis=1)
            for n in ("vocals", "drums", "bass", "other"))
lags = []
for t in np.linspace(20, len(mix) / 44100 - 30, 6):
    a = int(t * 44100)
    m, s = mix[a:a + 5 * 44100], stems[a - 4410:a + 5 * 44100 + 4410]
    c = correlate(s, m, mode="valid", method="fft")
    lags.append(int(np.argmax(c)) - 4410)
print("stem offset per window (samples, + = stems late):", lags)
