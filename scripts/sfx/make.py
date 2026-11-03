#!/usr/bin/env python3
"""Free, offline: CC0 source recordings -> shipped animal sounds. Needs ffmpeg + numpy.

  python3 scripts/sfx/make.py [--preview]

Each sound is cut, filtered, faded, then set ~5 dB below the voices' active RMS
(measured from b1/c2/d3) and peak-limited. NOTE: alimiter must keep level=0,
otherwise it auto-levels and the sounds come out far too loud.
--preview also writes build/sfx-all.mp3 (all four sounds in a row) for listening.
Sources and licences: assets/CREDITS.md. Only CC0 sources are allowed (AGENTS.md).
"""
import subprocess, json, os, sys, tempfile
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "assets", "source", "sfx")
OUT = os.path.join(ROOT, "assets", "audio")

# name: (source file, start s, duration s, fade in, fade out, filters, dB relative to voice)
SOUNDS = {
    "squeak":  ("Rabbit_oinks_and_squeaks-excerpt-19.83s.flac", 0.50, 1.0, 0.03, 0.2, "highpass=f=500,lowpass=f=7000,afftdn=nf=-45", -5),
    "meow":    ("fs-448084_9159316.mp3", 0.0, 0.62, 0.01, 0.12, "highpass=f=200", -5),
    "woof":    ("fs-583142_3403708.mp3", 0.05, 1.3, 0.01, 0.15, "highpass=f=150", -5),
    "trumpet": ("fs-527845_11431915.mp3", 0.04, 1.96, 0.02, 0.85, "highpass=f=120", -5),
}

def pcm(f):
    return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "24000", "-f", "f32le", "-"], capture_output=True).stdout, np.float32)

def act_rms(x):
    h = 480; r = np.array([np.sqrt(np.mean(x[i:i + h] ** 2)) for i in range(0, len(x) - h, h)]); r = r[r > r.max() * 0.1]
    return 20 * np.log10(np.sqrt(np.mean(r ** 2)))

def main():
    ref = np.mean([act_rms(pcm(os.path.join(OUT, f"{k}.mp3"))) for k in ("b1", "c2", "d3")])
    print("voice active rms", round(ref, 1))
    tmpd = tempfile.mkdtemp(); info = {}
    for k, (src, ss, d, fi, fo, flt, off) in SOUNDS.items():
        tmp = os.path.join(tmpd, f"{k}.wav"); dst = os.path.join(OUT, f"{k}.mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(ss), "-t", str(d), "-i", os.path.join(SRC, src),
                        "-af", f"{flt},afade=t=in:d={fi},afade=t=out:st={d - fo}:d={fo}", "-ac", "1", "-ar", "24000", tmp], check=True)
        g = ref + off - act_rms(pcm(tmp))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", f"volume={g:.2f}dB,alimiter=limit=0.6:attack=1:release=50:level=0,apad=pad_dur=0.12",
                        "-ar", "24000", "-ac", "1", "-b:a", "64k", dst], check=True)
        x = pcm(dst); info[k] = dict(dur=round(len(x) / 24000, 3), peak_db=round(20 * np.log10(np.abs(x).max()), 1), rms=round(act_rms(x), 1), gain=round(g, 1))
        print(k, info[k])
    tp = os.path.join(OUT, "timings.json"); T = json.load(open(tp))
    for k, v in info.items(): T[k] = {"dur": v["dur"], "text": "", "t": []}
    json.dump(T, open(tp, "w"), ensure_ascii=False)
    if "--preview" in sys.argv:
        os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
        L = list(SOUNDS); inp = sum([["-i", os.path.join(OUT, f"{k}.mp3")] for k in L], [])
        fc = "".join(f"[{i}]apad=pad_dur=0.6[a{i}];" for i in range(len(L))) + "".join(f"[a{i}]" for i in range(len(L))) + f"concat=n={len(L)}:v=0:a=1"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inp, "-filter_complex", fc, "-b:a", "128k", os.path.join(ROOT, "build", "sfx-all.mp3")], check=True)

if __name__ == "__main__":
    main()
