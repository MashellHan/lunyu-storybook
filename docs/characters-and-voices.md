# 角色与配音

全部配音由 Azure Speech 合成（region 用 `AZURE_SPEECH_REGION`，当前 eastus），输出格式 `Audio24Khz96KBitRateMonoMp3`，请求词边界（word boundary）。
配置的唯一来源是 `scripts/tts/config.py`；改动前先读 [polyphones.md](polyphones.md)。

| 角色 | 页面 id | 声音 | 风格 / 角色 | 语速 | 音高 | 其他 | 片段 |
|---|---|---|---|---|---|---|---|
| 大象老师 | `#elephant` | `zh-CN-YunzeNeural` | `express-as style="calm" styledegree="1.2" role="OlderAdultMale"` | -15% | 0% | | title、again、e1–e3 |
| 小兔 | `#bunny` | `zh-CN-XiaoyouNeural`（童声） | 无 | -12% | 0% | | b1（独读）、b1–b3（齐读素材） |
| 小猫 | `#cat` | `zh-CN-YunxiaNeural` | `style="cheerful" styledegree="1.2"` | -12% | 0% | | c2（独读）、c1–c3 |
| 小狗 | `#dog` | `zh-CN-Yunxi:DragonHDFlashLatestNeural`（HD） | `style="cheerful" styledegree="1.2"` | -15% | 0% | 第一个逗号后 `<break time="100ms"/>` | d3（独读）、d1–d3 |

SSML 模板（`gen.py`）：
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">
  <voice name="{voice}">{express-as 开}<prosody rate="{rate}" pitch="0%">{文本，多音字已标注}</prosody>{express-as 关}</voice>
</speak>
```

## 片段一览（assets/audio）
| key | 内容 | 谁 |
|---|---|---|
| title | 论语 之 学而时习之（SSML：「{论}语，之，学而时习之。」） | 大象 |
| again | 我们再来一遍吧 | 大象 |
| e1–e3 | 三句原文 | 大象 |
| u1–u3 | 三句原文齐读 | 小兔+小猫+小狗混音 |
| b1 / c2 / d3 | 第 1/2/3 句独读 | 小兔 / 小猫 / 小狗 |
| squeak / meow / woof / trumpet | 叫声 | 见 audio-pipeline.md |

## 齐读（u1–u3）
小兔为基准；小猫、小狗用 `atempo` 拉伸到小兔的时长，分别延迟 70 ms、140 ms 叠加（`amix normalize=0`），再 `loudnorm I=-16`。

## 定稿说明
- v5 起小猫、小狗的配音定稿，v6 未改动（v6 只换了大象叫声并把叫声降低约 5 dB）。没有负责人明确要求不要重渲染。
- 不要换声音或语速做“试试看”——每次渲染都是付费调用。
