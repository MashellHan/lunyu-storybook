#!/usr/bin/env python3
"""Step 1: remove the light floor/shadow blob under each character (two passes).
  python3 scripts/image/clean.py      -> build/image/<who>-clean.png
Thresholds were tuned by eye on these four images; re-check build/image/*.png after any art change."""
from PIL import Image
import numpy as np
from scipy import ndimage as nd
from common import CHAR, w
def clean(src,dst):
    a=np.array(Image.open(src).convert("RGBA")).astype(int)
    rgb=a[...,:3]; al=a[...,3]
    H,W=al.shape
    sat=rgb.max(-1)-rgb.min(-1)
    cand=((sat<22)&(rgb.min(-1)>195)) | (al<200)
    ys,xs=np.where(al>10); y1=ys.max()
    band=np.zeros_like(cand); band[int(y1-(y1-ys.min())*0.22):,:]=True
    cand&=band
    cand|=(al==0)
    lab,n=nd.label(cand)
    # components touching fully transparent area
    keep=set(np.unique(lab[al==0]))-{0}
    rm=np.isin(lab,list(keep))&(al>0)
    # soften: dilate removal 1px for fringe, feather alpha
    out=a.copy()
    out[...,3][rm]=0
    # fringe: pixels adjacent to removed with bright neutral color get alpha reduced
    ring=nd.binary_dilation(rm,iterations=4)&~rm&(al>0)&band
    br=(rgb.min(-1)>175)&(sat<30)
    out[...,3][ring&br]=(out[...,3][ring&br]*0.0).astype(int)
    Image.fromarray(out.astype(np.uint8)).save(dst)
    print(src,'removed',rm.sum())

def pass2(path, satmax=33, minv=165):
    a=np.array(Image.open(path)).astype(int); rgb=a[...,:3]; al=a[...,3]; sat=rgb.max(-1)-rgb.min(-1)
    ys,xs=np.where(al>10); y1=ys.max(); band=np.zeros(al.shape,bool); band[int(y1-(y1-ys.min())*0.16):,:]=True
    c=((sat<satmax)&(rgb.min(-1)>minv)&band&(al>0))|(al==0)
    lab,n=nd.label(c); keep=set(np.unique(lab[al==0]))-{0}
    rm=np.isin(lab,list(keep))&(al>0)
    a[...,3][rm]=0
    # 1px alpha feather on new edge
    edge=nd.binary_dilation(a[...,3]==0,iterations=1)&(a[...,3]>0)&band
    a[...,3][edge]=a[...,3][edge]//2
    Image.fromarray(a.astype(np.uint8)).save(path); print('pass2',path,rm.sum())

if __name__ == "__main__":
    for who in ("elephant", "bunny", "cat", "dog"):
        clean(f"{CHAR}/{who}.webp", w(f"{who}-clean.png"))
    pass2(w("dog-clean.png"))   # only the dog needed the stricter second pass
