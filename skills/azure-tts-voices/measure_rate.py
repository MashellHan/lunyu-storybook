#!/usr/bin/env python3
"""Voiced speaking rate (syllables per second of speech), to compare voices whose `rate` % are not comparable.
  python3 measure_rate.py a.mp3 [b.mp3 ...] --syllables 10
Method: ffmpeg -> 16 kHz mono PCM, 20 ms frames; a frame is voiced if within 35 dB of the loudest frame;
speech = span from first to last voiced frame minus silent runs >= 100 ms (pauses)."""
import subprocess, sys
import numpy as np
args = sys.argv[1:]; n = 10
if "--syllables" in args:
    i = args.index("--syllables"); n = int(args[i + 1]); del args[i:i + 2]
for f in args:
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                                     capture_output=True, check=True).stdout, np.float32)
    h = 320; fr = x[: len(x) // h * h].reshape(-1, h)
    db = 10 * np.log10((fr ** 2).mean(1) + 1e-12); on = db > db.max() - 35
    idx = np.where(on)[0]; span = (idx[-1] - idx[0] + 1) * 0.02
    pause = 0.0; run = 0
    for v in on[idx[0]: idx[-1] + 1]:
        if not v: run += 1
        else:
            if run >= 5: pause += run * 0.02
            run = 0
    speech = span - pause
    print(f"{f}: span {span:.2f}s, pauses {pause:.2f}s, speech {speech:.2f}s -> {n / speech:.2f} syl/s")
