---
name: azure-tts-voices
description: >-
  需要给角色配音、换声音、加新句子、修多音字、调语速、做“三个孩子齐读”或卡拉 OK 字幕时间时使用。
  用 Azure Speech（SSML、神经/HD 声音）。会产生费用，先获批准。
---
# Azure 配音（SSML）

## 前提
- 一个 Azure Speech 资源（本项目在 eastus）。密钥只放环境变量：`AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`（见 `.env.example`）。**不要 echo/打印**，检查用 `[ -n "$AZURE_SPEECH_KEY" ]`。
- `pip install -r scripts/requirements.txt`（含 `azure-cognitiveservices-speech`），以及 ffmpeg。
- **每次调用都计费**。本项目从试音到定稿一共约 48 次合成请求（短句，费用很低，但仍需负责人同意）。

## 为什么是 Azure
- 浏览器 `speechSynthesis`（v2）：每台设备声音不同、机械，拿不到逐字时间。
- edge-tts（v3）：免费但不能用 SSML 的角色/风格，多音字没法稳妥修，负责人试听后觉得“太差”；也不是正式授权的服务。
- macOS `say` 之类的系统朗读：同样机械、只在 Mac 上有，不适合给孩子听。
- 需求是“自然、好听、三个孩子三种声音能齐读”，所以选 Azure 神经/HD 声音 + SSML。

## 选声音：一次听完所有候选
1. 用 `audition.py` 把同一句（如“学而时习之，不亦说乎？”）用多个候选渲染出来，并按顺序拼成一个 `compare-all.mp3`（每段前有编号间隔），让人一口气听完、报编号：
   ```bash
   python3 skills/azure-tts-voices/audition.py candidates.json out/   # 每个候选 1 次计费
   ```
2. 本项目试过的候选：大象 6 个（Yunye calm、Xiaomo gentle、**Yunze calm**、Yunze SeniorMale、Yunye HD、Yunfan HD）；孩子 7 个（Xiaomo Girl、Yunxi Boy、**Xiaoyou**、Xiaoyou HD、**Yunxia cheerful**、Yunxia HD、Xiaoyi HD cute）；小狗另试了 4 个男孩声和 3 个放慢版本。
3. **定稿**（`scripts/tts/config.py`）：

| 角色 | 声音 | 设置 |
|---|---|---|
| 大象 | zh-CN-YunzeNeural | style calm 1.2，role OlderAdultMale，rate -15% |
| 小兔 | zh-CN-XiaoyouNeural | rate -12% |
| 小猫 | zh-CN-YunxiaNeural | cheerful 1.2，rate -12% |
| 小狗 | zh-CN-Yunxi:DragonHDFlashLatestNeural | cheerful 1.2，rate -15%，第一个逗号后 `<break time="100ms"/>` |

## 渲染定稿
```bash
python3 scripts/tts/gen.py e1        # 只渲染某句（计费）；不带参数 = 全部
python3 scripts/tts/process.py       # 免费：响度、齐读混音、timings.json
```
- `gen.py` 用 Speech SDK，输出 `Audio24Khz96KBitRateMonoMp3`，并打开 word boundary 拿每个词的时间，原始结果存在 `assets/source/tts-raw/`。
- **HD（Dragon）声音每次合成都不一样**。听到满意的那一版就保存文件，别指望重跑能复现；`tts-raw/` 就是为此提交的。

## 多音字
- 神经声音：`<phoneme alphabet="sapi" ph="yue 4">说</phoneme>`（本项目：说 yue4、乐 le4、愠 yun4、论 lun2）。
- **HD 声音会忽略 phoneme**，改用同音字替换：`<sub alias="悦">说</sub>`、`<sub alias="运">愠</sub>`；`process.py` 再把字幕里的替身字映射回原字。
- 每次改完必须有人**亲耳听**确认读音（代理无法替人听）。详见 `docs/polyphones.md`。

## 语速对齐
不同声音的 `rate` 百分比不可比。用 `measure_rate.py` 测“每秒有声音节数”：
```bash
python3 skills/azure-tts-voices/measure_rate.py a.mp3 b.mp3 --syllables 10
```
（16 kHz、20 ms 帧，比最大能量低 35 dB 以内算有声，≥100 ms 的停顿不计。）小狗按小猫的数值调：rate 0、+5%、+10% 都偏快被否，最终 -15% + 100 ms 停顿。

## 齐读（三个孩子同时读）
小兔为基准长度，小猫、小狗用 `atempo` 拉到同长，错开 0 / 70 / 140 ms，`amix=inputs=3:normalize=0`，再 `loudnorm=I=-16:TP=-1.5:LRA=11`（见 `scripts/tts/process.py`）。错开几十毫秒听起来像真的几个人，不会糊成一个声音。

## 卡拉 OK 时间
word boundary 给的是词；一个词的时长平均分给它的每个字，写进 `assets/audio/timings.json`，页面按字高亮。
