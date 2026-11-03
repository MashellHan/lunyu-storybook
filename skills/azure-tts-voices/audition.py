#!/usr/bin/env python3
"""Render one line with several Azure voices and join them into compare-all.mp3 for one listening pass.
  python3 audition.py candidates.json out/
candidates.json: [{"id":"01-yunze-calm","voice":"zh-CN-YunzeNeural","style":"calm","degree":"1.2",
                   "role":"OlderAdultMale","rate":"-15%","text":"学而时习之，不亦<phoneme alphabet=\"sapi\" ph=\"yue 4\">说</phoneme>乎？"}, ...]
Each candidate is one billed request. Key comes from AZURE_SPEECH_KEY (never printed)."""
import json, os, subprocess, sys, requests
key = os.environ["AZURE_SPEECH_KEY"]; region = os.environ.get("AZURE_SPEECH_REGION", "eastus")
url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
cands = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)

def ssml(c):
    inner = f'<prosody rate="{c.get("rate","0%")}" pitch="{c.get("pitch","0%")}">{c["text"]}</prosody>'
    attrs = "".join(f' {k}="{c[v]}"' for k, v in (("style", "style"), ("styledegree", "degree"), ("role", "role")) if c.get(v))
    if attrs: inner = f"<mstts:express-as{attrs}>{inner}</mstts:express-as>"
    return ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" '
            f'xml:lang="zh-CN"><voice name="{c["voice"]}">{inner}</voice></speak>')

files = []
for c in cands:
    r = requests.post(url, data=ssml(c).encode(), headers={"Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3"})
    if r.status_code != 200 or len(r.content) < 2000:
        print("FAIL", c["id"], r.status_code, r.text[:200]); continue
    f = os.path.join(out, f'{c["id"]}.mp3'); open(f, "wb").write(r.content); files.append(f); print("ok", c["id"])

# compare-all: 1 s silence between clips, in candidate order (tell the listener the order)
if files:
    inp = sum([["-i", f] for f in files], [])
    fc = "".join(f"[{i}]aresample=24000,apad=pad_dur=1[a{i}];" for i in range(len(files))) + \
         "".join(f"[a{i}]" for i in range(len(files))) + f"concat=n={len(files)}:v=0:a=1"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inp, "-filter_complex", fc, os.path.join(out, "compare-all.mp3")], check=True)
    print("order:", ", ".join(os.path.basename(f) for f in files))
