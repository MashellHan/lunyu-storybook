#!/usr/bin/env python3
"""Step 2b: split the bunny's right ear into its own layer (for the ear flop), and make 640px elephant/cat.
  python3 scripts/image/layers_bunny.py -> build/image/bunny-{ear,base}.png, elephant-640.png, cat-640.png"""
from common import w
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
src=Image.open(w("bunny-clean.png")).convert("RGBA"); A=np.array(src); H,W=A.shape[:2]; al=A[...,3]
P=[(700,238),(704,170),(730,150),(790,130),(860,100),(940,110),(1010,180),(1090,290),(1150,400),(1150,480),(1100,545),(1040,545),(975,525),(935,505),(910,465),(880,405),(840,335),(790,286)]
m=Image.new("L",(W,H),0); ImageDraw.Draw(m).polygon(P,fill=255); ear=(np.array(m)>0)&(al>0)
E_=A.copy(); E_[...,3]=np.where(ear,al,0); earI=Image.fromarray(E_)
B=A.copy(); B[...,3]=np.where(ear,0,al); baseI=Image.fromarray(B)
col=tuple(int(v) for v in np.median(A[...,:3][ear&(al>250)],axis=0))
root=Image.new("RGBA",(W,H),(0,0,0,0)); ImageDraw.Draw(root).ellipse((700,200,860,360),fill=(236,224,210,255))
earI=Image.alpha_composite(root.filter(ImageFilter.GaussianBlur(3)),earI)
earI.resize((640,640),Image.LANCZOS).save(w("bunny-ear.png")); baseI.resize((640,640),Image.LANCZOS).save(w("bunny-base.png"))
c=Image.new("RGBA",(W,H),(229,180,123,255)); c.alpha_composite(earI); c.alpha_composite(baseI); c.convert("RGB").resize((627,627)).save(w("bunny-comp.jpg"))
# rotated check
c2=Image.new("RGBA",(W,H),(229,180,123,255)); c2.alpha_composite(earI.rotate(-16,center=(770,260),resample=Image.BICUBIC)); c2.alpha_composite(baseI); c2.convert("RGB").resize((627,627)).save(w("bunny-flop.jpg"))
for n in ["elephant","cat"]:
    Image.open(w(f"{n}-clean.png")).resize((640,640),Image.LANCZOS).save(w(f"{n}-640.png"))
