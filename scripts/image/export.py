#!/usr/bin/env python3
"""Step 3: 640px layers -> shipped WebP (q90) in assets/img/, plus the 180px icon.
  python3 scripts/image/export.py"""
import os
from PIL import Image
from common import IMG, w
LAYERS = ["elephant-640", "cat-640", "bunny-ear", "bunny-base", "dog-tail", "dog-body", "dog-head"]
for n in LAYERS:
    im = Image.open(w(f"{n}.png")).convert("RGBA")
    if im.size != (640, 640): im = im.resize((640, 640), Image.LANCZOS)
    im.save(os.path.join(IMG, f"{n}.webp"), "WEBP", quality=90, method=6)
ic = Image.open(w("elephant-640.png")).convert("RGBA").resize((180, 180), Image.LANCZOS)
bg = Image.new("RGBA", ic.size, (255, 246, 230, 255)); bg.alpha_composite(ic); bg.convert("RGB").save(os.path.join(IMG, "icon.png"))
print("wrote", len(LAYERS), "layers + icon.png to", IMG)
