import os, sys, json
import azure.cognitiveservices.speech as sdk
cfg=sdk.SpeechConfig(subscription=os.environ["AZURE_SPEECH_KEY"], region="eastus")
cfg.set_speech_synthesis_output_format(sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3)
cfg.set_property(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary if hasattr(sdk.PropertyId,"SpeechServiceResponse_RequestWordBoundary") else sdk.PropertyId.SpeechServiceResponse_RequestSentenceBoundary,"true")
VO={"elephant":('zh-CN-YunzeNeural','<mstts:express-as style="calm" styledegree="1.2" role="OlderAdultMale">','</mstts:express-as>',"-15%","0%",True),
    "bunny":('zh-CN-XiaoyouNeural','','',"-12%","0%",True),
    "cat":('zh-CN-YunxiaNeural','<mstts:express-as style="cheerful" styledegree="1.2">','</mstts:express-as>',"-12%","0%",True),
    "dog":('zh-CN-Yunxi:DragonHDFlashLatestNeural','<mstts:express-as style="cheerful" styledegree="1.2">','</mstts:express-as>',os.environ.get("DOG_RATE","-15%"),"0%",False)}
PHN={"说":"yue 4","乐":"le 4","愠":"yun 4","论":"lun 2"}; ALI={"说":"悦","愠":"运"}
S=["学而时习之，不亦{说}乎？","有朋自远方来，不亦{乐}乎？","人不知而不{愠}，不亦君子乎？"]
CL={"title":("elephant","{论}语，之，学而时习之。","论语 之 学而时习之"),"again":("elephant","我们再来一遍吧！","我们再来一遍吧")}
for i,s in enumerate(S,1):
  disp=s.replace("{","").replace("}","")
  CL[f"e{i}"]=("elephant",s,disp)
  for w,k in (("bunny","b"),("cat","c"),("dog","d")): CL[f"{k}{i}"]=(w,s,disp)
def mark(s,neural):
  import re
  def f(m):
    c=m.group(1)
    if neural: return f'<phoneme alphabet="sapi" ph="{PHN[c]}">{c}</phoneme>'
    return f'<sub alias="{ALI[c]}">{c}</sub>' if c in ALI else c
  return re.sub(r"\{(.)\}",f,s)
def one(key):
  who,s,disp=CL[key]; v,a,b,rate,pitch,neu=VO[who]
  ssml=f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="{v}">{a}<prosody rate="{rate}" pitch="{pitch}">{mark(s,neu) if who!='dog' else mark(s,neu).replace('，','，<break time="'+os.environ.get('DOG_BRK','100ms')+'"/>',1)}</prosody>{b}</voice></speak>'
  syn=sdk.SpeechSynthesizer(speech_config=cfg,audio_config=None); wb=[]
  def on(e):
    if e.boundary_type==sdk.SpeechSynthesisBoundaryType.Word: wb.append((e.audio_offset/1e7,e.duration.total_seconds(),e.text))
  syn.synthesis_word_boundary.connect(on)
  r=syn.speak_ssml_async(ssml).get()
  if r.reason!=sdk.ResultReason.SynthesizingAudioCompleted:
    print("FAIL",key,r.cancellation_details.reason,r.cancellation_details.error_details); return None
  open(f"raw/{key}.mp3","wb").write(r.audio_data); print("ok",key,len(r.audio_data),wb)
  return {"who":who,"text":disp,"wb":wb}
keys=sys.argv[1:] or list(CL)
meta=json.load(open("raw/meta.json")) if os.path.exists("raw/meta.json") else {}
for k in keys:
  if k in meta and os.path.exists(f"raw/{k}.mp3"): print("skip",k); continue
  m=one(k)
  if m: meta[k]=m; json.dump(meta,open("raw/meta.json","w"),ensure_ascii=False,indent=1)
