import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHAR = os.path.join(ROOT, "assets", "source", "characters")   # original generated art (lossless WebP, pixel-exact)
WORK = os.path.join(ROOT, "build", "image")                     # intermediates + check images (gitignored)
IMG = os.path.join(ROOT, "assets", "img")                       # shipped 640px WebP layers
os.makedirs(WORK, exist_ok=True)
def w(name): return os.path.join(WORK, name)
