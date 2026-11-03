import subprocess,numpy as np,json,os
A="../v6work/audio"
def pcm(f,extra=[]):
  return np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",f,*extra,"-ac","1","-ar","24000","-f","f32le","-"],capture_output=True).stdout,np.float32)
def act_rms(x):
  h=480;r=np.array([np.sqrt(np.mean(x[i:i+h]**2)) for i in range(0,len(x)-h,h)]);r=r[r>r.max()*0.1]
  return 20*np.log10(np.sqrt(np.mean(r**2)))
ref=np.mean([act_rms(pcm(f"{A}/{k}.mp3")) for k in ("b1","c2","d3")])
print("voice active rms",round(ref,1))
# name: (src, start, dur, fade_in, fade_out, filters, offset_vs_voice_dB)
S={"squeak":("src/Rabbit_oinks_and_squeaks.wav",20.33,1.0,0.03,0.2,"highpass=f=500,lowpass=f=7000,afftdn=nf=-45",-5),
   "meow":("src/fs-448084_9159316.mp3",0.0,0.62,0.01,0.12,"highpass=f=200",-5),
   "woof":("src/fs-583142_3403708.mp3",0.05,1.3,0.01,0.15,"highpass=f=150",-5),
   "trumpet":("src/fs-527845_11431915.mp3",0.04,1.96,0.02,0.85,"highpass=f=120",-5)}
info={}
for k,(src,ss,d,fi,fo,flt,off) in S.items():
  tmp=f"/tmp/sfx-{k}.wav"
  subprocess.run(["ffmpeg","-v","error","-y","-ss",str(ss),"-t",str(d),"-i",src,"-af",f"{flt},afade=t=in:d={fi},afade=t=out:st={d-fo}:d={fo}","-ac","1","-ar","24000",tmp],check=True)
  g=ref+off-act_rms(pcm(tmp))
  subprocess.run(["ffmpeg","-v","error","-y","-i",tmp,"-af",f"volume={g:.2f}dB,alimiter=limit=0.6:attack=1:release=50:level=0,apad=pad_dur=0.12","-ar","24000","-ac","1","-b:a","64k",f"{A}/{k}.mp3"],check=True)
  x=pcm(f"{A}/{k}.mp3"); info[k]=dict(dur=round(len(x)/24000,3),peak_db=round(20*np.log10(np.abs(x).max()),1),rms=round(act_rms(x),1),gain=round(g,1))
  print(k,info[k])
T=json.load(open(f"{A}/timings.json"))
for k,v in info.items(): T[k]={"dur":v["dur"],"text":"","t":[]}
json.dump(T,open(f"{A}/timings.json","w"),ensure_ascii=False)
L=["trumpet","squeak","meow","woof"]
inp=sum([["-i",f"{A}/{k}.mp3"] for k in L],[])
fc="".join(f"[{i}]apad=pad_dur=0.6[a{i}];" for i in range(4))+"".join(f"[a{i}]" for i in range(4))+"concat=n=4:v=0:a=1"
subprocess.run(["ffmpeg","-v","error","-y",*inp,"-filter_complex",fc,"-b:a","128k","sfx-all-v6.mp3"],check=True)
print("sfx-all",subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0","sfx-all-v6.mp3"],capture_output=True,text=True).stdout.strip())
