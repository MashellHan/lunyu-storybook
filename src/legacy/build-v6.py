# builds demo/index-v6.html from v3parts (head from v4parts) + v2 CSS/motion + layer PNGs (v2work) + Azure audio (v5work/audio)
import base64, io, os, json, re
from PIL import Image
R=os.path.dirname(os.path.abspath(__file__)); P=os.path.join(R,"v3parts"); P6=os.path.join(R,"v6parts"); W=os.path.join(R,"..","..","v2work"); A=os.path.join(R,"..","..","v6work","audio"); P4=os.path.join(R,"v4parts")
def b64(p, size=640, q=90):
    im=Image.open(os.path.join(W,p)).convert("RGBA")
    if im.size[0]!=size: im=im.resize((size,size),Image.LANCZOS)
    buf=io.BytesIO(); im.save(buf,"WEBP",quality=q,method=6); return "data:image/webp;base64,"+base64.b64encode(buf.getvalue()).decode()
v2=open(os.path.join(R,"template-v2.html")).read().split("\n")
css="\n".join(v2[38:179]); motion="\n".join(v2[293:422])
rd=lambda n: open(os.path.join(P6 if n in ("head.html","script2.js") else P,n)).read()
tpl=rd("head.html")+css+"\n"+rd("extra.css")+rd("body.html")+rd("script1.js")+"\n"+motion+"\n"+rd("script2.js")
open(os.path.join(R,"template-v6.html"),"w").write(tpl)
KEYS=["title","again","e1","e2","e3","u1","u2","u3","b1","c2","d3","squeak","meow","woof","trumpet"]
aud={k:"data:audio/mpeg;base64,"+base64.b64encode(open(os.path.join(A,k+".mp3"),"rb").read()).decode() for k in KEYS}
tim=json.load(open(os.path.join(A,"timings.json"))); tim={k:tim[k] for k in KEYS}
M={"__ELEPHANT__":b64("elephant-640.png"),"__CAT__":b64("cat-640.png"),"__BUNNY_EAR__":b64("bunny-ear.png"),"__BUNNY_BASE__":b64("bunny-base.png"),
   "__DOG_TAIL__":b64("dog-tail.png"),"__DOG_BODY__":b64("dog-body.png"),"__DOG_HEAD__":b64("dog-head.png"),
   "__AUDIO__":json.dumps(aud),"__TIMINGS__":json.dumps(tim,ensure_ascii=False)}
s=tpl
for k,v in M.items(): s=s.replace(k,v)
out=os.path.join(R,"..","index-v6.html"); open(out,"w").write(s); print(out, len(s)//1024,"KB")
