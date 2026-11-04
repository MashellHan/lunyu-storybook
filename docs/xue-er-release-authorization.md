# 《学而》16章直接发布授权

2026-11-03；由 lunyu-lead 记录本轮主会话明确转达的大雄本人指令。

> 直接全部部署

本次“全部”指当前《学而》16章。负责人明确授权将现有真实音频直接发布，覆盖此前本批先听检再上线约定；这不是本人已经试听或读音、音色通过的声明。`humanListeningApproved` 保持 false，任何媒体引用都不补造 `listening`。原A“稍后试听”、B“稍后试听或分章反馈”的 [固定集合与原话](tts/xue-er-listening-status.md) 仍作为听检事实保留。

## 固定授权范围

[机器可核验记录](xue-er-release-authorization.json) 已冻结，SHA-256 为 `9dcafa05a26b38c05c14c5c770221d7c3de7d7bcc2a6324d4aa26e23d54b51c2`。

- 章号：`xue-er-01` 至 `xue-er-16`，仅这16个有序ID。
- 原文和逐字拼音：`docs/content/xue-er.json`，SHA `85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73`。
- 现有媒体清单：`src/chapter-media.json`，SHA `83457528c86cca2ee737095447e241814b781b7a022bcd65e34222a1586bbe5c`，370个既有引用。
- 音频：305份唯一文件，其中290份新录音/齐读及15份旧定稿/共用音频；完整路径与SHA逐项记录。集合SHA为 `5694faf4fce7362b0bd4dac790ce7e6f831a02ec447c99c7c1e5e0f1a15cce03`。
- 时间轴：291份文件（290份新timing及保留的旧全局timings）；集合SHA为 `e17e10bc68b3e8533394122da6a21ed201dd5d08d73cfcdc186062d05346e2f3`。

集合算法为排序相对路径 + TAB + 文件SHA + LF，UTF-8编码后再SHA256。Lead创建记录时已逐文件核对，未修改内容、manifest、媒体或时间轴。原235条付费请求全部完成，本授权没有新增TTS、图像或试音范围。

## 最小接入与交接

Engineer只在 `loadBook` 根据该精确记录决定本批是否可绕过听检先行条件。`assessReadiness` 和 `verifyClip` 的默认严格行为保留；原文、拼音、声音来源、复用映射、音频哈希、原文字位、时间轴、解码和实测时长检查均继续执行。新文件、替换音频、变更manifest或不匹配的记录不能继承本次例外。此为单次明确授权的接入，不扩展为通用审批系统。

Engineer已保留之前70项快照，完成针对性验证及当前源码一次完整 `npm test`：71通过、0失败、0跳过，680输入前后不变，随后交回源码/构建/public/dist写权并停止写入。Reviewer的 [限定审查](reviews/xue-er-direct-release.md) 已通过，确认授权范围与原技术校验保持严格；未重复既有内容、媒体和静态画面审查。

Root负责最终部署dry-run、实际发布到既有 `lunyu-picturebook`、线上套件和公开URL核验，独占 `build/xue-er-all-release-root/`。Lead、Engineer、Reviewer不部署、不写该目录；完整产物与退出结果交回后停止构建写入。不commit、不push，4173/4174/4175服务保留。发布事实与版本另记于 [实施记录](xue-er-build.md)，本授权记录自身不表示已部署成功。

## 实际发布结果

Root已于2026-11-03 14:25:51 UTC完成 [实际部署](../build/xue-er-all-release-root/deploy-result.json)，exit0，Worker `lunyu-picturebook`，版本 `58bbdbd5-5595-4881-927a-40fc1d335477`。本地完整71项通过后，直接使用已测试产物进行dry-run和上传，没有重复构建或测试；public/dist上传及线上测试前后不变。

[线上限定套件](../build/xue-er-all-release-root/live-tests-result.json) 实际29通过、0失败、42项仅本地用例按配置跳过，exit0；[Chromium核验](../build/xue-er-all-release-root/live-smoke.json) 的18份HTTP页面字节、16章全文与入口、第1/3/15章播放停止、第3章暂停和第15章翻页均通过，私有路径404。发布授权JSON与固定媒体未改，`humanListeningApproved=false`，没有补造listening。
