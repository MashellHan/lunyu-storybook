#!/usr/bin/env python3
"""Step 2a: cut the dog into tail / body / head layers (hand-placed polygons in source pixels).
  python3 scripts/image/layers_dog.py  -> build/image/dog-{head,body,tail}.png + dog-comp.jpg, dog-layers.jpg
Polygons only fit assets/source/characters/dog.webp; new art means new polygons."""
from common import w
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage as nd
src=Image.open(w("dog-clean.png")).convert("RGBA")
A=np.array(src).astype(int); H,W=A.shape[:2]; al=A[...,3]
rgb=A[...,:3]
def poly_mask(pts):
    m=Image.new("L",(W,H),0); ImageDraw.Draw(m).polygon(pts,fill=255); return np.array(m)>0
# ---- tail
tailP=[(866,874),(880,858),(905,838),(955,800),(990,778),(1012,790),(1022,840),(1018,905),(1006,960),(980,990),(944,992),(941,960),(940,935),(905,903)]
tail=poly_mask(tailP)&(al>0)
# ---- head: cut line per column
blue=(rgb[...,2]>rgb[...,0]+25)&(al>200)
cut=np.full(W,0)
for x in range(W):
    if x<355: cut[x]=748
    elif x<500: cut[x]=722
    elif x<=870:
        ys=np.where(blue[600:760,x])[0]
        cut[x]=600+ys[0]+3 if len(ys) else 700
    else: cut[x]=684
# smooth cut a bit
cut=np.round(nd.uniform_filter1d(cut.astype(float),9)).astype(int)
yy=np.arange(H)[:,None]
head=(yy<cut[None,:])&(al>0)&~tail
# exclude paw: raised paw region
paw=poly_mask([(352,735),(380,722),(450,718),(505,735),(515,800),(500,850),(360,850)])
head&=~paw
bl=nd.binary_dilation(blue,iterations=3); bl[:640]=False
head&=~bl
# ---- body = rest
body=(al>0)&~head&~tail
def layer(mask, feather=True):
    out=A.copy(); out[...,3]=np.where(mask,al,0); return Image.fromarray(out.astype(np.uint8))
headI=layer(head); tailI=layer(tail); bodyI=layer(body)
# fill behind head on body: fur ellipse (sampled) under head bottom, only drawn where body transparent
fur=tuple(int(v) for v in np.median(rgb[(al>250)&(np.abs(yy-640)<30)&(np.arange(W)[None,:]>420)&(np.arange(W)[None,:]<470)],axis=0))
cream=tuple(int(v) for v in np.median(rgb[600:640,620:700][al[600:640,620:700]>250],axis=0))
print('fur',fur,'cream',cream)
fill=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(fill)
d.ellipse((380,560,900,760),fill=fur+(255,))
d.ellipse((520,560,800,740),fill=cream+(255,))
fill=fill.filter(ImageFilter.GaussianBlur(6))
fa=np.array(fill); hm=nd.binary_erosion(head,iterations=4)&(yy>520); fa[...,3]=np.where(hm,fa[...,3],0); fill=Image.fromarray(fa)
# texture noise to match felt
bodyFilled=Image.alpha_composite(fill,bodyI)
# tail root extension: draw tail-colored blob at root, BEHIND tail (tail layer is behind body)
tailcol=tuple(int(v) for v in np.median(rgb[tail&(al>250)],axis=0))
root=Image.new("RGBA",(W,H),(0,0,0,0)); ImageDraw.Draw(root).ellipse((830,860,960,960),fill=tailcol+(255,))
root=root.filter(ImageFilter.GaussianBlur(4))
tailFilled=Image.alpha_composite(root,tailI)
# downscale all to 640
S=640
for name,im in [("head",headI),("tail",tailFilled),("body",bodyFilled)]:
    im.resize((S,S),Image.LANCZOS).save(w(f"dog-{name}.png"))
# sanity composite
comp=Image.new("RGBA",(W,H),(0,0,0,0))
for im in (tailFilled,bodyFilled,headI): comp=Image.alpha_composite(comp,im)
bg=Image.new("RGBA",(W,H),(229,180,123,255)); bg.alpha_composite(comp); bg.convert("RGB").resize((627,627)).save(w("dog-comp.jpg"))
# exploded view
ex=Image.new("RGBA",(W*3//2,H//2+40),(40,90,60,255))
for i,im in enumerate((bodyFilled,headI,tailFilled)):
    ex.alpha_composite(im.resize((627,627)),(i*627//1,0) if i<2 else (2*627-300,0)) if False else None
for i,im in enumerate((bodyFilled,headI,tailFilled)):
    t=Image.new("RGBA",(627,627),(40,90,60,255)); t.alpha_composite(im.resize((627,627)))
    ex.paste(t,(i*627,0))
ex.convert("RGB").save(w("dog-layers.jpg"))
# print geometry for CSS (fractions of canvas)
print('eyeL',528/W,505/H,'eyeR',760/W,470/H,'mouth',668/W,612/H,'tailPivot',900/W,905/H,'neck',640/W,700/H)
print('lidcolor', tuple(int(v) for v in np.median(rgb[430:450,500:560].reshape(-1,3),axis=0)), tuple(int(v) for v in np.median(rgb[395:415,740:790].reshape(-1,3),axis=0)))
