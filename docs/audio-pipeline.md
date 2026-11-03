# 音频流水线

```
scripts/tts/config.py（声音、SSML、多音字、片段表）
  └─ scripts/tts/gen.py ──(Azure Speech，付费，需批准)──> assets/source/tts-raw/<key>.mp3 + meta.json（词边界）
       └─ scripts/tts/process.py（免费，离线）──> assets/audio/{title,again,e1-3,b1,c2,d3,u1-3}.mp3 + timings.json
assets/source/sfx/*（CC0 录音）
  └─ scripts/sfx/make.py（免费，离线）──> assets/audio/{squeak,meow,woof,trumpet}.mp3 + timings.json 中的叫声时长
```

依赖：Python 3、`ffmpeg`/`ffprobe`、numpy；`gen.py` 另需 `azure-cognitiveservices-speech`。

## 重新生成
```bash
python3 scripts/tts/process.py     # 原始配音 -> 上线音频（不调用任何 API）
python3 scripts/sfx/make.py        # 叫声；加 --preview 生成 build/sfx-all.mp3 方便试听
```
已验证：在本仓库里重跑这两步，15 个 mp3 + timings.json 中 14 个 mp3 和 timings.json 与上线版本逐字节一致；
`squeak.mp3` 因为源文件只保留了 2 s 的 FLAC 片段，解码起点略有差异（与原版差值约 -52 dB，听感无差别），仓库里保留的是原版。

只有在要改词、改声音、加新句子时才需要 `gen.py`：
```bash
set -a; . ./.env; set +a           # AZURE_SPEECH_KEY / AZURE_SPEECH_REGION，见 .env.example；不要打印 key
python3 scripts/tts/gen.py e1 --force   # 只重渲染需要的句子；已存在的默认跳过
python3 scripts/tts/process.py
```

## 处理参数
- 人声：`loudnorm=I=-16:TP=-1.5:LRA=11`，24 kHz 单声道 64 kbps。
- 齐读：小兔基准，小猫/小狗 `atempo` 对齐时长，延迟 0/70/140 ms，`amix normalize=0` 后 loudnorm。
- 叫声：截取 → 高通（兔子另加低通 + `afftdn` 降噪）→ 淡入淡出 → 按人声（b1/c2/d3）的有效 RMS 下调 5 dB（≈ -21 dBFS vs 人声 -15.5）→ `alimiter=limit=0.6:...:level=0`。
  - **坑**：`alimiter` 默认 `level=1` 会自动拉回电平，叫声会变得很响；必须保留 `level=0`。

| 叫声 | 源文件 | 起点 | 时长 | 淡出 |
|---|---|---|---|---|
| squeak 小兔 | `Rabbit_oinks_and_squeaks-excerpt-19.83s.flac`（原文件 20.33 s 处） | 0.50 s | 1.0 s | 0.2 s |
| meow 小猫 | `fs-448084_9159316.mp3` | 0 | 0.62 s | 0.12 s |
| woof 小狗 | `fs-583142_3403708.mp3` | 0.05 s | 1.3 s | 0.15 s |
| trumpet 大象 | `fs-527845_11431915.mp3` | 0.04 s | 1.96 s | 0.85 s（自然尾音，不拉伸） |

来源与许可见 `assets/CREDITS.md`。代理无法试听音频，任何音频改动都需要人工听检。
