# 《学而》真实媒体交接

2026-11-03；lunyu-lead / Media。235条获准合成请求已实际全部成功，零自动重试。A先于B完成；旧v5、叫声、timings/meta和lock未改。只使用原获准四声音，无付费图像或新声音试音。

当前《学而》16章已按大雄“直接全部部署”的 [固定授权](../xue-er-release-authorization.md) 上线：Root于2026-11-03 14:25:51 UTC发布到既有 `lunyu-picturebook`，版本 `58bbdbd5-5595-4881-927a-40fc1d335477`。授权只覆盖冻结内容、manifest、305份现有音频/291份时间轴，未来新媒体不能继承。真人听检仍未确认，`humanListeningApproved=false`，不填listening；此前延后试听及媒体、预演证据均保留。

发布接入完整本地测试 **71通过、0失败、0跳过，exit0**，680输入前后不变；Root部署及线上验收完成，线上限定套件 **29通过、0失败、42配置跳过，exit0**，另核验18份HTTP字节、16章全文及第1/3/15章实际播放与停止，第3章暂停、第15章翻页和私有路径404。见 [本地结果](../../tests/artifacts/xue-er-direct-release/npm-test-direct-release-final-result.json)、[实际部署](../../build/xue-er-all-release-root/deploy-result.json)、[线上套件](../../build/xue-er-all-release-root/live-tests-result.json) 和 [浏览器核验](../../build/xue-er-all-release-root/live-smoke.json)。线上29项是限定套件，不是71项在线全跑；这些技术验证不等于真人听检。

## 给真人试听的入口

- A：[首章补充、第2–3章](http://127.0.0.1:4174/?batch=batch-a)，37份不同音频，约2分8秒。首章补充5条，第2章26条，第3章11条，共享文件仅试听一次；原固定A证据在 `build/xue-er-audition/batch-a-evidence/`。
- B：[第4–16章新增候选](http://127.0.0.1:4174/?batch=batch-b)，253份不同音频，约13分56秒。可按章/角色筛选，默认页面仍是A，不自动播放。B真实播放/暂停/停止与390px无溢出已由主会话独立验证，见 `build/xue-er-audit-root/b-audition-browser.json`。

两个批次都是真实处理后录音，支持逐条或顺序试听；程序播放结束不自动记录人工通过。大雄本人回复A“稍后试听”、B“稍后试听或分章反馈”，是延后试听而非听检批准。[原话与固定文件集合](xue-er-listening-status.md) 已归档；不重复询问，后续只按主会话转达的实际按章反馈记录。后续真人反馈先由主会话转达，技术协调回复不是听检批准。

按 [Azure配音技能](../../skills/azure-tts-voices/SKILL.md)“每次改完必须有人亲耳听确认读音”，媒体技术校验不能替代真人判断。本轮负责人后续明确授权优先于技能内听检先行要求，只对固定当前媒体允许发布例外；现有290份候选仍未填listening，不能把发布可用状态描述成声音已获真人验收。

## 真实互动预演

[16章目录](http://127.0.0.1:4175/xue-er.html) · [第3章](http://127.0.0.1:4175/xue-er-03.html) · [第15章](http://127.0.0.1:4175/xue-er-15.html)。`node scripts/build.mjs --rehearsal` 与 `node scripts/serve.mjs --rehearsal` 使用现有播放器和场景，仅输出并服务 `build/xue-er-rehearsal/`，地址限定127.0.0.1:4175。16章均技术可播放；此前预演轮生产ready为0，后续本批直接发布授权与技术完整性已使生产构建ready为16，仍无真人听检通过。原有4173生产预览和4174试听服务继续保留。

真实标题、短章领读/跟读/独读至实际ended、长章跨页顺序、暂停换页及快速互动取消、三处词级双字高亮已通过8项受影响检查，见 [结果](../../tests/artifacts/xue-er-media/media-focused-result.json)。该预演轮源码完整 `npm test` **70/70、0失败/跳过、exit0**，见 [历史结果](../../tests/artifacts/xue-er-media/npm-test-media-final-result.json)；679输入前后不变。Root另在320px第3/15章实测标题、停止及首句点读，并通过view_image完成4张图的**代理视觉检查**，见 [独立记录](../../build/xue-er-audit-root/rehearsal-title-smoke.json)；不是用户或其他真人验收，`humanListeningApproved`始终false。后续直接发布轮的71项与真实线上结果见本文开头及 [实施记录](../xue-er-build.md)。

## 工程与独立审查

- `assets/audio/xue-er/batch-b/media-candidate.json` 为全量候选，SHA `b4e80d04d725e9e092a7a6427b8d540b6fbca0bed802034b3abe263a96616220`；69个新段×5角色、15新标题，共360引用，missing=0。3个旧段继续沿用v5。
- A独立候选SHA `ccc09c1709cc707442997d3a4c0e94449cd5166c2d21e7a7a5017e348f51f5af`，保持原字节。所有处理后文件/时间轴/原始调用记录不可覆写，四个新媒体目录仍由Lead独占。
- Engineer已完成正式引用导入、同时间词组高亮、真实互动预演和最小发布接入，71项通过后将源码/测试/构建/public/dist写权交回Root并停止写入。预演复用现成模板、播放器和场景，技术可播放、发布许可和真人听检分别记录；默认保持听检门槛，本次精确授权匹配才允许现有媒体进入public/dist，不伪造listening。
- Reviewer的 [新媒体正式技术审查](../reviews/xue-er-real-media.md) 已通过，全部1287份实际输出与原始事件、引用、复用和保护文件一致，无未解决数据阻断；[最终证据](../reviews/xue-er-real-media-final.json) 不包含真人听检批准。后续只审查新增播放器影响，既有内容、场景和工具审查保留历史结论。

[接口与词级精度](xue-er-batch-interface.md) · [全部实际文件核验](../../build/xue-er-media-run/all-media-verification.json) · [23项免费工具回归](../../build/xue-er-media-run/batch-tests-word-anchors-result.json) · [发布和逐章进度](../xue-er-build.md)。三个SDK零时长词“习乎”“父母”“来者”使用真实词首，明确标为word级；不宣称取得逐字发音边界。

历史预演轮48源码/配置与679合并输入的完整70项测试、[预演限定工程审查](../reviews/xue-er-rehearsal.md) 和一次 [部署dry-run](../../build/xue-er-rehearsal-acceptance/check-deploy-result.json) 均已通过，当时未上传内容；[Lead记录](../../build/xue-er-rehearsal-acceptance/lead-verification.json) 保留该轮事实。当前直接发布轮的 [最终指纹](../../tests/artifacts/xue-er-direct-release/build-fingerprint.json) 与 [授权接入审查](../reviews/xue-er-direct-release.md) 已闭合，16章实际上线。4173/4174/4175保留，本轮结束，不持续轮询或重复询问试听；后续收到本人真实反馈时按对应音频SHA记录。

## 边界

已核验235次成功请求与290份真实处理文件。真人试听已明确延后；物理移动设备/Safari检查及Azure实际账单仍未核对。US$10是授权总上限，规划参考不是账单；未扩大235条精确输入，没有重合成、commit或push。
