#!/usr/bin/env python3
"""Build public/ from src/.
  python3 build.py            -> public/index.html + public/assets/{img,audio}/ (for Cloudflare)
  python3 build.py --single   -> dist/index-single.html (one self-contained file, double-click to open)
Needs Pillow (images are converted to 640px WebP)."""
import base64, io, json, os, shutil, sys
from PIL import Image
R = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(R, "src")
SINGLE = "--single" in sys.argv
KEYS = ["title","again","e1","e2","e3","u1","u2","u3","b1","c2","d3","squeak","meow","woof","trumpet"]
IMG = {"__ELEPHANT__":"elephant-640.png","__CAT__":"cat-640.png","__BUNNY_EAR__":"bunny-ear.png","__BUNNY_BASE__":"bunny-base.png",
       "__DOG_TAIL__":"dog-tail.png","__DOG_BODY__":"dog-body.png","__DOG_HEAD__":"dog-head.png"}
def webp(name, size=640, q=90):
    im = Image.open(os.path.join(S, "img", name)).convert("RGBA")
    if im.size[0] != size: im = im.resize((size, size), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "WEBP", quality=q, method=6); return b.getvalue()
tpl = open(os.path.join(S, "template.html"), encoding="utf-8").read()
tim = json.load(open(os.path.join(S, "audio", "timings.json"), encoding="utf-8")); tim = {k: tim[k] for k in KEYS}
# when clips are separate files, fetch them once into blob URLs so a tap plays instantly
WARM = ('\n/* warm audio files into blob URLs (instant playback; same <audio> element keeps the iOS unlock) */\n'
        'Object.keys(AUD).forEach(k => { if (AUD[k].startsWith("data:")) return;\n'
        '  fetch(AUD[k]).then(r => r.ok ? r.blob() : null).then(b => { if (b) AUD[k] = URL.createObjectURL(b); }).catch(() => {}); });\n')
M = {"__TIMINGS__": json.dumps(tim, ensure_ascii=False)}
if SINGLE:
    out_dir = os.path.join(R, "dist"); os.makedirs(out_dir, exist_ok=True)
    for ph, n in IMG.items(): M[ph] = "data:image/webp;base64," + base64.b64encode(webp(n)).decode()
    M["__AUDIO__"] = json.dumps({k: "data:audio/mpeg;base64," + base64.b64encode(open(os.path.join(S, "audio", k + ".mp3"), "rb").read()).decode() for k in KEYS})
    out = os.path.join(out_dir, "index-single.html"); M["__ICON__"] = "data:,"
else:
    P = os.path.join(R, "public"); A = os.path.join(P, "assets")
    shutil.rmtree(A, ignore_errors=True); os.makedirs(os.path.join(A, "img")); os.makedirs(os.path.join(A, "audio"))
    for ph, n in IMG.items():
        fn = n.replace(".png", ".webp"); open(os.path.join(A, "img", fn), "wb").write(webp(n)); M[ph] = "assets/img/" + fn
    for k in KEYS: shutil.copy(os.path.join(S, "audio", k + ".mp3"), os.path.join(A, "audio", k + ".mp3"))
    M["__AUDIO__"] = json.dumps({k: f"assets/audio/{k}.mp3" for k in KEYS})
    ic = Image.open(os.path.join(S, "img", "elephant-640.png")).convert("RGBA").resize((180, 180), Image.LANCZOS)
    bg = Image.new("RGBA", ic.size, (255, 246, 230, 255)); bg.alpha_composite(ic); bg.convert("RGB").save(os.path.join(A, "img", "icon.png"))
    M["__ICON__"] = "assets/img/icon.png"
    shutil.copy(os.path.join(S, "CREDITS.md"), os.path.join(P, "CREDITS.md"))
    out = os.path.join(P, "index.html")
s = tpl.replace("const AUD = __AUDIO__;", "const AUD = __AUDIO__;" + WARM)
for k, v in M.items(): s = s.replace(k, v)
left = [k for k in list(IMG) + ["__AUDIO__", "__TIMINGS__", "__ICON__"] if k in s]; assert not left, left
open(out, "w", encoding="utf-8").write(s); print(out, len(s) // 1024, "KB")
