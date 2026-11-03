---
name: animal-sfx-sourcing
description: >-
  需要新增或替换动物叫声（或其他音效）时使用：只找 CC0 真实录音，核对许可，截取、滤波、淡入淡出，
  把响度压到人声下方约 5 dB，并登记到 assets/CREDITS.md。全程免费、离线处理。
---
# 动物叫声：找素材 → 处理 → 登记

## 规则
- **只用 CC0 1.0**（公有领域）。CC-BY、CC-BY-NC、“免费下载”但没写许可的，一律不用。
- 优先真实动物录音。负责人觉得早期的叫声“太假”；合成音、人嘴模仿、乐器/管子模拟的都被否了。

## 找
1. **freesound.org**：搜索后用左侧 License 过滤选 “Creative Commons 0”。每个音效页面有公开的 **HQ preview mp3**，不需要登录就能下载；下载前在该页面再确认一次许可。
2. **Wikimedia Commons**：文件页的 “Licensing” 段写明 CC0 才用。
3. 文件名保留来源编号，如 `fs-527845_11431915.mp3`，放进 `assets/source/sfx/`。原文件太大就只保留用到的片段（例：兔子叫声只留 2 秒 FLAC）。

## 挑（让人听）
把候选拼成一个文件、每段之间 1.2 秒空白，并写一份带编号的清单，让人一次听完报编号：
```bash
./skills/animal-sfx-sourcing/concat_candidates.sh out/elephant-candidates.mp3 cand1.mp3 cand2.mp3 ...
```
本项目大象试了 7 个，选中 freesound 527845（D.jones，“Elephant Trumpets Growls”）；被否的原因：合成器、人嘴模仿、PVC 管、“听起来假”、带人说话（法语单词）、铃声。

## 处理
在 `scripts/sfx/make.py` 的 `SOUNDS` 里加一行：`(源文件, 起点秒, 时长, 淡入, 淡出, 滤波, 相对人声 dB)`，然后：
```bash
python3 scripts/sfx/make.py --preview   # 生成 assets/audio/*.mp3，并写 build/sfx-all.mp3 供试听
```
- 截取：只要最有特点的 0.6–2 秒；结尾留自然尾音，用淡出收，不要拉伸。
- 滤波：高通去低频噪声（120–500 Hz，视动物而定）；噪声大的再加 `lowpass` 和 `afftdn`。
- 响度：按“有声部分 RMS”算，叫声比人声低约 **5 dB**（本项目叫声约 -21 dBFS，人声约 -15.5）。
- **坑：`alimiter` 必须写 `level=0`**。默认会自动把电平拉回满刻度，结果叫声比人声还响。
- 输出 24 kHz 单声道 mp3，和配音一致。

## 登记
在 `assets/CREDITS.md` 表格加一行：用途、文件、标题、作者、来源 URL、许可、用了哪一段；写上核对许可的日期。然后 `npm test`，再让人**真的听一遍**（代理不能替人听）。
