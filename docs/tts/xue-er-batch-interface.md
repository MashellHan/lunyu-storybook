# 《学而》隔离配音批次接口

2026-11-03；lunyu-lead / Media。先记录接口，再实现。仅用于 `/Users/mengxionghan/workspace/lunyu-storybook`。

## 所有权与已批准输入

制作阶段由Lead独占 `scripts/tts/batch.py`、`test_batch.py` 和 `assets/source/tts-raw/xue-er/{batch-a,batch-b}/`、`assets/audio/xue-er/{batch-a,batch-b}/`；Engineer独占 `src/chapter-media.json`、播放器、构建和 JS 测试，只导入Lead候选JSON，不同时写新媒体。当前TTS、媒体及工程产物均已冻结，Engineer已将源码/测试/构建写权交回Root完成发布；本轮不再生成或处理媒体。

固定内容 SHA-256：`85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73`。

| 批次 | 精确清单 | 条数 | entries 集合 SHA-256 |
| --- | --- | ---: | --- |
| batch-a | `docs/tts/xue-er-generation-request.json` | 30 | `472d68446e3209689037534c3e9dedab710503b1036719d07a0e22752f672296` |
| batch-b | `docs/tts/xue-er-generation-request-b.json` | 205 | `ff9384ff4d805bdab7567bda65d12c0101ec4007d10b17ee00a55b06ee6ea54f` |

A+B 已获同一 US$10 上限授权，先 A 后 B，零自动重试。原 JSON 的准备态/US$1 字段是历史快照，后续授权见 [批次 A](xue-er-generation-request.md)、[批次 B](xue-er-generation-request-b.md)。不改原清单、声音或 SSML；校验完整文件与 entries 哈希，防止复用/路径/混音规则被旁路修改。2026-11-03 主会话已安全交接项目 `.env` 并完成仅认证验证；Lead 在内存中解析两个变量，仅通过子进程环境传入。执行/处理事实以 [逐章记录](../xue-er-build.md) 及 `build/xue-er-media-run/` 为准，离线工具测试中的0调用是历史验证状态。

## 命令与调用记录

使用项目 `.venv/bin/python`。默认 `validate`，不导入 Speech SDK、不联网、不创建媒体目录，输出可保存的 JSON 检查结果。`--dry-run` 同样只校验。获准235条现已全部执行完毕，下面的执行命令仅说明接口，本轮不追加合成调用。

```bash
.venv/bin/python scripts/tts/batch.py
.venv/bin/python scripts/tts/batch.py validate --batch batch-a
.venv/bin/python scripts/tts/batch.py execute --batch batch-a --ids xue-er-01-s01-elephant --dry-run
# 以下 execute 仅在主会话安全交接凭据后执行；不在命令参数中放密钥。
.venv/bin/python scripts/tts/batch.py execute --batch batch-a --all
.venv/bin/python scripts/tts/batch.py process --batch batch-a --all
.venv/bin/python scripts/tts/batch.py index --batch batch-a
```

`execute` 和 `process` 必须显式选择 `--ids` 或 `--all`；执行 B 前先核验 A 全部成功原始结果。选错 ID、重复 ID、变更输入、越界/符号链接路径先整体拒绝。密钥只从环境变量读取；日志不输出密钥或供应商原始错误详情。

每条付费请求先以独占创建并 fsync 写下 `<id>.attempt.json`，之后最多一次 `speak_ssml_async`。原始 MP3 沿用清单 `rawOutput`，`<id>.result.json` 保存状态、时间、输入/集合/内容/音频 SHA、原始 `wb`（`[offsetSeconds,durationSeconds,text]`）及等长的 `wordBoundaryDetails`（SDK 原样 `textOffset` / `wordLength`，保留精确 SSML 供定位）。成功记录和音频核验一致可跳过；已有失败、结果未知、缺结果或损坏均拒绝再次付费调用，不能用重跑命令自动重试。没有 `--force`。请求中断也保留 attempt。

`process` 只免费处理显式选中的新条目及其可用三声齐读；保留原始输出，24kHz/mono/64kbps、`loudnorm=I=-16:TP=-1.5:LRA=11`。小兔原轨为齐读长度基准，猫狗 atempo 对齐，延迟 0/70/140ms，amix normalize=0 后 loudnorm。齐读不增加合成请求，也不重新渲染复用前缀。

## 时间轴与候选索引

每个处理后 `<id>.mp3` 配 `<id>.timing.json`，齐读使用 `<textId>-children.mp3` 和同名 timing。时间轴的最小接口：

```json
{
  "text": "子曰：“",
  "dur": 1.234,
  "t": [0.08, 0.3, null, null],
  "audioSHA256": "真实处理后文件的SHA256",
  "contentSHA256": "85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73",
  "sourceEntrySetSHA256": "源批次精确集合SHA256"
}
```

`t` 按原文 Unicode 码点等长，标点为 null，汉字都有非负、单调且小于实测时长的时间。只在各条目明确的 `aliasesBySourcePosition` 字位接受别名字，支持 SDK 返回该字位原字；不做全局同音替换。词内按实际词边界均分；漏字、额外字、错位或无可用边界即失败，不补造时间。每条保留 raw SHA/请求 SHA；齐读另记三条输入 SHA 与对齐参数。

2026-11-03主会话明确了真实HD多字词 `duration=0` 的兼容方式：若完整事件链逐字严格覆盖原文且词首offset有效，各字共享该**真实词首**，不推算末字时间，不用下一词或音频结尾补时。此时timing必须另存 `wordGroups`：每项含 `granularity:"word"`、`boundaryIndex`、`originalBoundaryText`、`sourceIndexes`（段内Unicode字位）、`offsetSeconds`、`sourceDurationSeconds:0` 和原样 `sdkPosition`。这是词级锚点，不宣称取得逐字发音边界；Engineer让相同高亮时间的字同时亮。旧timing没有该字段等价空数组，A/v5不重写。工具重算并核验该证据，缺失/被改写即拒绝；无事件、缺字、额外字、负时间仍不接受。`character_times` 调用方必须显式收集词级证据才能使用此路径，不能只取得裸t数组而丢失精度说明。

已知真实旧 HD `d1` 有「悦」后紧接 `">说乎` 的 SDK 残片。工具保留原始事件，只在精确 SSML 的 `<sub>` 字位与审核别名一致、前一单字事件恰好为该别名、剩余原文字位严格连续且无其他alias、时间不倒退时回映。实际A新增「好犯上」「好作乱」残片后，范围限定为一个或两个剩余汉字：使用该事件原有offset/span按剩余字数均分，已经映射的原字不重复分时。每次修复记入timing的`alignmentCorrections`，含原事件、已覆盖及全部剩余原文字位、原offset/span和SDK定位字段；实际SDK `textOffset=-1`原样保留为未知位置，不伪造下标，-2等非法值仍拒绝。旧记录缺 SDK offset 的事实如实保留。其他无法证明的残片仍报未对齐，绝不靠全局删字符或自动重合成处理。

`process` 完成后和显式 `index` 都在所选新批次目录输出 `media-candidate.json`。它是**待接入片段**，不是 ready 声明。只收录字节/时间轴核验通过的实际文件，列明缺失条目与待听检文件。顶层：

```json
{
  "schemaVersion": 1,
  "contentSHA256": "固定内容SHA256",
  "publicationReady": false,
  "batches": {
    "batch-a": {"request": "docs/tts/xue-er-generation-request.json", "entrySetSHA256": "A集合SHA"},
    "batch-b": {"request": "docs/tts/xue-er-generation-request-b.json", "entrySetSHA256": "B集合SHA"}
  },
  "segments": {
    "xue-er-01-s01": {
      "elephant": {"file": "assets/audio/xue-er/batch-a/xue-er-01-s01-elephant.mp3", "sha256": "音频SHA", "timingFile": "assets/audio/xue-er/batch-a/xue-er-01-s01-elephant.timing.json", "batch": "batch-a"}
    }
  },
  "titles": {
    "xue-er-02": {"file": "assets/audio/xue-er/batch-a/xue-er-02-title-elephant.mp3", "sha256": "音频SHA", "timingFile": "assets/audio/xue-er/batch-a/xue-er-02-title-elephant.timing.json", "batch": "batch-a"}
  }
}
```

`segments` 包含 elephant/bunny/cat/dog 及可用 children。相同引语按审核复用表指向源批次同一文件/时间轴；保留目标 segmentId 和全文字位，不复制付费请求。索引检查两批已有结果，A→B 共享前缀与 B 内共享均沿用源批次 SHA。

`titles` 必须覆盖 **第2–16章共15条新大象标题**（A 2条、B 13条），由 Engineer 接入 manifest、构建和播放器；实际未生成时列缺失，不能伪造可播放引用。标题声音的 timing.text 为已审核的“论语，之，章名。”；页面标题取内容库的可读章名，不能直接把整段 SSML 标点文本当页面标题。首章定稿旧 title 保持原样。

工具不填 `listening`。实际人工听检后，由真实审核者给出 `audioSHA256`、`reviewedBy` 与存在的 `evidence`，Engineer 再将证据附到对应 ref；代理不能伪造听检。旧首章音频及其显示闭引号适配仍由工程既有 legacy 引用承担，本工具不写旧 v5、meta、timings 或叫声。

负责人后续明确要求“直接全部部署”，另由 [固定发布记录](../xue-er-release-authorization.md) 授权当前16章现有媒体不等听检上线。该例外由loadBook的精确范围匹配处理，工具与默认verifyClip/assessReadiness听检要求不改；未来新媒体不继承，不为此回写候选publicationReady或任何listening，也不追加合成。Root已于2026-11-03 14:25:51 UTC实际发布版本 `58bbdbd5-5595-4881-927a-40fc1d335477`；完整本地71项通过，线上限定29项通过、42项配置跳过，以及18页面字节/全文和抽样互动均通过。证据见 [发布记录](../xue-er-build.md)，真人听检仍未确认，`humanListeningApproved=false`。

## 验证边界

独立 Python 测试只用临时目录、模拟 SDK 和本机 ffmpeg，测试音频不进生产目录。覆盖默认0调用、明确选择、一次调用持久记录、失败/未知不重试、路径越界、按字位别名、缺字拒绝、离线处理/齐读、A→B复用和15标题索引；当前23项通过。235次真实请求及290份处理文件的对应关系已通过 [独立技术审查](../reviews/xue-er-real-media.md)。真实音质、读音和语速仍需本人听检；本人已延期反馈，见 [固定集合与原话](xue-er-listening-status.md)，技术检查或代理视觉检查不授予听检批准。
