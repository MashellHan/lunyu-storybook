#!/usr/bin/env python3
"""Render raw TTS clips with Azure Speech (PAID API -- ask the owner before running).

  AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=eastus python3 scripts/tts/gen.py [key ...] [--force]

Writes assets/source/tts-raw/<key>.mp3 and word boundaries to meta.json.
Existing clips are skipped unless --force. Then run scripts/tts/process.py.
Credentials come from the environment only (see .env.example); never hard-code or print them.
"""
import os, sys, json, re
from config import RAW, VOICES, PHONEME, ALIAS, CLIPS, DOG_FIRST_BREAK

key, region = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
if not key or not region:
    sys.exit("set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (see .env.example)")
import azure.cognitiveservices.speech as sdk

cfg = sdk.SpeechConfig(subscription=key, region=region)
cfg.set_speech_synthesis_output_format(sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3)
cfg.set_property(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary, "true")

def mark(s, neural):
    def f(m):
        c = m.group(1)
        if neural: return f'<phoneme alphabet="sapi" ph="{PHONEME[c]}">{c}</phoneme>'
        return f'<sub alias="{ALIAS[c]}">{c}</sub>' if c in ALIAS else c
    return re.sub(r"\{(.)\}", f, s)

def ssml_for(k):
    who, s, _ = CLIPS[k]; v, a, b, rate, pitch, neural = VOICES[who]
    body = mark(s, neural)
    if who == "dog": body = body.replace("，", f'，<break time="{DOG_FIRST_BREAK}"/>', 1)
    return (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">'
            f'<voice name="{v}">{a}<prosody rate="{rate}" pitch="{pitch}">{body}</prosody>{b}</voice></speak>')

def render(k):
    syn = sdk.SpeechSynthesizer(speech_config=cfg, audio_config=None); wb = []
    syn.synthesis_word_boundary.connect(lambda e: e.boundary_type == sdk.SpeechSynthesisBoundaryType.Word and
                                        wb.append((e.audio_offset / 1e7, e.duration.total_seconds(), e.text)))
    r = syn.speak_ssml_async(ssml_for(k)).get()
    if r.reason != sdk.ResultReason.SynthesizingAudioCompleted:
        print("FAIL", k, r.cancellation_details.reason, r.cancellation_details.error_details); return None
    open(os.path.join(RAW, f"{k}.mp3"), "wb").write(r.audio_data); print("ok", k, len(r.audio_data))
    who, _, disp = CLIPS[k]
    return {"who": who, "text": disp, "wb": wb}

if __name__ == "__main__":
    force = "--force" in sys.argv
    keys = [a for a in sys.argv[1:] if not a.startswith("--")] or list(CLIPS)
    mp = os.path.join(RAW, "meta.json")
    meta = json.load(open(mp)) if os.path.exists(mp) else {}
    for k in keys:
        if k not in CLIPS: sys.exit(f"unknown clip {k}; choose from {list(CLIPS)}")
        if not force and k in meta and os.path.exists(os.path.join(RAW, f"{k}.mp3")): print("skip", k); continue
        m = render(k)
        if m: meta[k] = m; json.dump(meta, open(mp, "w"), ensure_ascii=False, indent=1)
