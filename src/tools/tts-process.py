import json, subprocess, re
m=json.load(open("raw/meta.json")); old=json.load(open("../v3work/audio/timings.json"))
def run(*a): subprocess.run(a,check=True,capture_output=True)
def dur(p): return float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True,text=True).stdout)
NORM="loudnorm=I=-16:TP=-1.5:LRA=11"
def norm(src,dst): run("ffmpeg","-y","-i",src,"-af",NORM,"-ar","24000","-ac","1","-b:a","64k",dst)
ALI={"悦":"说","运":"愠"}
cjk=lambda s:[ALI.get(c,c) for c in s if '\u4e00'<=c<='\u9fff']
def chartimes(text, wb, shift=0.0, total=None):
  idx=[i for i,c in enumerate(text) if '\u4e00'<=c<='\u9fff']; out=[None]*len(text); p=0
  for off,du,w in wb:
    w=cjk(w)
    if du<=0 and total: du=max(0.3,total-off-0.45)
    while w and p<len(idx) and w[0]!=text[idx[p]]: w=w[1:]   # drop junk (e.g. alias artifacts)
    n=len(w)
    for j in range(n):
      if p<len(idx): out[idx[p]]=round(off+du*j/n+shift,3); p+=1
  # fill any gap by interpolation
  last=0
  for i in idx:
    if out[i] is None: out[i]=last+0.2
    last=out[i]
  return out
T={}
for k,v in m.items():
  norm(f"raw/{k}.mp3",f"audio/{k}.mp3")
  T[k]={"dur":round(dur(f"audio/{k}.mp3"),3),"text":v["text"],"t":chartimes(v["text"],v["wb"],0.0,dur(f"raw/{k}.mp3"))}
for i in (1,2,3):
  b,c,d=(f"raw/{x}{i}.mp3" for x in "bcd"); db,dc,dd=dur(b),dur(c),dur(d)
  fc=f"[1:a]atempo={dc/db:.4f},adelay=70[a1];[2:a]atempo={dd/db:.4f},adelay=140[a2];[0:a][a1][a2]amix=inputs=3:normalize=0,{NORM}"
  run("ffmpeg","-y","-i",b,"-i",c,"-i",d,"-filter_complex",fc,"-ar","24000","-ac","1","-b:a","64k",f"audio/u{i}.mp3")
  T[f"u{i}"]={"dur":round(dur(f"audio/u{i}.mp3"),3),"text":m[f"b{i}"]["text"],"t":chartimes(m[f"b{i}"]["text"],m[f"b{i}"]["wb"],0.05)}
for k in ("meow","woof","squeak"): T[k]=old[k]
json.dump(T,open("audio/timings.json","w"),ensure_ascii=False)
for k,v in T.items(): print(k,v["dur"],v["t"])
