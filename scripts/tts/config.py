"""Shared TTS config: voices, SSML style, polyphone fixes and the clip list.
See docs/characters-and-voices.md and docs/polyphones.md before changing anything here."""
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "assets", "source", "tts-raw")   # raw Azure output + word boundaries (meta.json)
OUT = os.path.join(ROOT, "assets", "audio")               # shipped clips + timings.json

# who: (voice, express-as open, express-as close, rate, pitch, neural?)
#   neural=True  -> polyphones fixed with <phoneme alphabet="sapi">
#   neural=False -> HD (Dragon) voice ignores <phoneme>, so use <sub alias> with a homophone
VOICES = {
    "elephant": ("zh-CN-YunzeNeural", '<mstts:express-as style="calm" styledegree="1.2" role="OlderAdultMale">', "</mstts:express-as>", "-15%", "0%", True),
    "bunny":    ("zh-CN-XiaoyouNeural", "", "", "-12%", "0%", True),
    "cat":      ("zh-CN-YunxiaNeural", '<mstts:express-as style="cheerful" styledegree="1.2">', "</mstts:express-as>", "-12%", "0%", True),
    "dog":      ("zh-CN-Yunxi:DragonHDFlashLatestNeural", '<mstts:express-as style="cheerful" styledegree="1.2">', "</mstts:express-as>", "-15%", "0%", False),
}
DOG_FIRST_BREAK = "100ms"   # short pause after the dog's first comma

PHONEME = {"说": "yue 4", "乐": "le 4", "愠": "yun 4", "论": "lun 2"}   # SAPI pinyin, tone number
ALIAS = {"说": "悦", "愠": "运"}                                       # HD voice fallback

SENTENCES = ["学而时习之，不亦{说}乎？", "有朋自远方来，不亦{乐}乎？", "人不知而不{愠}，不亦君子乎？"]
# key: (who, ssml text with {polyphone} marks, on-screen text)
CLIPS = {
    "title": ("elephant", "{论}语，之，学而时习之。", "论语 之 学而时习之"),
    "again": ("elephant", "我们再来一遍吧！", "我们再来一遍吧"),
}
for i, s in enumerate(SENTENCES, 1):
    disp = s.replace("{", "").replace("}", "")
    CLIPS[f"e{i}"] = ("elephant", s, disp)
    for who, k in (("bunny", "b"), ("cat", "c"), ("dog", "d")):
        CLIPS[f"{k}{i}"] = (who, s, disp)   # b/c/d 1-3 feed the unison mix u1-u3

SHIPPED = ["title", "again", "e1", "e2", "e3", "b1", "c2", "d3"]   # solo clips the page plays (+ u1-u3)
