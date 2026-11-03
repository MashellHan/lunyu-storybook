#!/usr/bin/env python3
"""Free, offline: raw TTS -> shipped clips. Needs ffmpeg/ffprobe on PATH.

  python3 scripts/tts/process.py

- loudnorm every shipped solo clip to I=-16 LUFS (24 kHz mono 64 kbps)
- u1-u3 (unison): bunny + cat + dog, cat/dog atempo-matched to bunny length, offsets 0/70/140 ms
- per-character karaoke times from Azure word boundaries -> assets/audio/timings.json
  (sound-effect entries already in timings.json are kept; scripts/sfx/make.py owns them)
"""
import json, os, subprocess, tempfile
from config import RAW, OUT, SHIPPED

NORM = "loudnorm=I=-16:TP=-1.5:LRA=11"
ALIAS_BACK = {"悦": "说", "运": "愠"}   # HD voice word boundaries report the alias text
def run(*a): subprocess.run(a, check=True, capture_output=True)
def dur(p): return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout)
def norm(src, dst): run("ffmpeg", "-y", "-i", src, "-af", NORM, "-ar", "24000", "-ac", "1", "-b:a", "64k", dst)
cjk = lambda s: [ALIAS_BACK.get(c, c) for c in s if "\u4e00" <= c <= "\u9fff"]

def chartimes(text, wb, shift=0.0, total=None):
    """Spread each word boundary evenly over its characters; returns one time per char (None for punctuation)."""
    idx = [i for i, c in enumerate(text) if "\u4e00" <= c <= "\u9fff"]; out = [None] * len(text); p = 0
    for off, du, w in wb:
        w = cjk(w)
        if du <= 0 and total: du = max(0.3, total - off - 0.45)
        while w and p < len(idx) and w[0] != text[idx[p]]: w = w[1:]
        n = len(w)
        for j in range(n):
            if p < len(idx): out[idx[p]] = round(off + du * j / n + shift, 3); p += 1
    last = 0
    for i in idx:
        if out[i] is None: out[i] = last + 0.2
        last = out[i]
    return out

def main():
    m = json.load(open(os.path.join(RAW, "meta.json")))
    tp = os.path.join(OUT, "timings.json")
    old = json.load(open(tp)) if os.path.exists(tp) else {}
    tmp = tempfile.mkdtemp()
    T = {}
    for k, v in m.items():
        dst = os.path.join(OUT if k in SHIPPED else tmp, f"{k}.mp3")
        norm(os.path.join(RAW, f"{k}.mp3"), dst)
        T[k] = {"dur": round(dur(dst), 3), "text": v["text"], "t": chartimes(v["text"], v["wb"], 0.0, dur(os.path.join(RAW, f"{k}.mp3")))}
    for i in (1, 2, 3):
        b, c, d = (os.path.join(RAW, f"{x}{i}.mp3") for x in "bcd"); db, dc, dd = dur(b), dur(c), dur(d)
        fc = f"[1:a]atempo={dc/db:.4f},adelay=70[a1];[2:a]atempo={dd/db:.4f},adelay=140[a2];[0:a][a1][a2]amix=inputs=3:normalize=0,{NORM}"
        u = os.path.join(OUT, f"u{i}.mp3")
        run("ffmpeg", "-y", "-i", b, "-i", c, "-i", d, "-filter_complex", fc, "-ar", "24000", "-ac", "1", "-b:a", "64k", u)
        T[f"u{i}"] = {"dur": round(dur(u), 3), "text": m[f"b{i}"]["text"], "t": chartimes(m[f"b{i}"]["text"], m[f"b{i}"]["wb"], 0.05)}
    for k in ("meow", "woof", "squeak", "trumpet"):
        if k in old: T[k] = old[k]
    json.dump(T, open(tp, "w"), ensure_ascii=False)
    for k, v in T.items(): print(k, v["dur"])

if __name__ == "__main__":
    main()
