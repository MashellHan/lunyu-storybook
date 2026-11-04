# 《学而》16 章实施与发布记录

2026-11-03；唯一仓库 `/Users/mengxionghan/workspace/lunyu-storybook`。执行依据为主会话维护的 [学而任务](xue-er-brief.md)、[首页任务](homepage-brief.md)、[全书方案](full-book-plan.md)。本文由 lunyu-lead 维护；准备中的章节不算完成。

当前《学而》16章已按大雄“直接全部部署”的 [固定授权](xue-er-release-authorization.md) 上线。Root于 **2026-11-03 14:25:51 UTC** 发布到既有 `lunyu-picturebook`，版本 **`58bbdbd5-5595-4881-927a-40fc1d335477`**；完整本地测试71通过、0失败、0跳过，线上限定套件29通过、0失败、42项配置跳过，18页面字节及抽样互动验证均通过。真人听检仍未确认，`humanListeningApproved=false`，不填写listening。此前目录、配音与本地预演阶段的延期和未发布状态保留为历史，当前发布结论见文末。

## 当前顺序与授权

1. 首页目录顶边动漫增量优先完成、检查和真实发布；不等待整篇内容生产。
2. 现有 Designer、Engineer、Reviewer 并行完成场景、内容校核和工程准备。首页发布期间工程源码与构建单写，发布后再交接多章改造。
3. 后续每章五项齐全（完整原文、逐字拼音、正式领读、正式跟读、点击互动），且内容/媒体引用、测试、截图审查通过后才能 ready 并增量发布。

用户已授权当前首页和逐章发布到现有 `lunyu-picturebook`，无需再次确认部署。最新配音授权为 **A+B共235条精确请求、US$10总上限，先A的30条再B的205条**，零自动重试，不再询问同范围预算；范围外的新条目另交明确输入，不静默追加。制作初期未授权 commit/push；大雄于2026-11-04补充了持续commit、push、PR、review和merge要求，见 [代码交付流程](source-control-workflow.md)，下文未提交的记录保留为历史。原有 v5 配音、叫声与响度关系保留；首章缺少的「子曰」等标识单独补录，不重渲染旧片段。不得以浏览器 TTS、占位音频或缺文页面冒充成品。

随后“直接全部部署”的明确授权仅覆盖本次固定16章及现有内容/manifest/音频/时间轴哈希。它允许这批未听检媒体在全部技术检查通过后发布，不改变真人听检事实，也不使未来新媒体继承例外。机器记录为 [xue-er-release-authorization.json](xue-er-release-authorization.json)，SHA `9dcafa05a26b38c05c14c5c770221d7c3de7d7bcc2a6324d4aa26e23d54b51c2`。

## 互斥所有权

| 成员 | 唯一可写范围 | 当前交付 |
| --- | --- | --- |
| Lead / Media | `README.md`、`docs/homepage-build.md`、本文件、`docs/tts/`；新增 `scripts/tts/batch.py`、`scripts/tts/test_batch.py`；四个获准 A/B 新媒体目录（见下） | 范围、接收证据、语音审核包、隔离批次工具与媒体、逐章状态和串行实际发布 |
| Designer | `docs/design/` | 先交首页顶部方案，再交 16 章差异化场景与动作方案；审看新增画面 |
| Engineer | `src/`、`scripts/`（排除 Lead 两个新增 TTS 文件）、`tests/` 及命令生成的前端产物 | 独占目录/构建/播放器、多章接入、`src/chapter-media.json` 与 JavaScript 测试；从 Lead 候选清单接入新媒体 |
| Reviewer / Content | `docs/content/`、`docs/reviews/` | 校核底本、16 章完整原文和逐字拼音；首页可运行后只审查新增影响；后续按章验收 |
| 主会话 | `PRODUCT.md`、`docs/full-book-plan.md`、brief、既有主会话说明文件 | 用户意图、Cloudflare 认证、付费生成授权与资源协调 |

生产数据只由 Engineer 从校核后的 `docs/content/` 接入，不让其他成员同时改 `src/catalog.json`、`scripts/build.mjs` 或播放器。任何新音频写入范围须在具体生成批次获批后单独交接，禁止原音频目录被批量处理脚本覆盖。

A/B精确请求获批后，用户最新明确由 Lead 兼任 Media，已通过 Herdr 通知并由 Engineer 确认移交：`scripts/tts/batch.py`、`scripts/tts/test_batch.py` 与 `assets/source/tts-raw/xue-er/batch-a/`、`batch-b/`、`assets/audio/xue-er/batch-a/`、`batch-b/` 均由 **Lead 独占**，包括本批调用记录、词边界、单条时间轴、齐读与候选索引。Engineer 未创建这些 TTS 文件或新媒体，继续独占生产 manifest/player/build/JS 测试。接口先记录于 [批次工具接口](tts/xue-er-batch-interface.md)，再实现；候选清单包含全部 15 条新标题，Engineer 负责实际构建接入。安全凭据交接前只做离线实现/验证，不调用合成；旧媒体、旧全局timings/meta和锁文件保持原样。

B目录最终冻结后，Engineer已将源码/测试/正式产物写权交Lead完成发布。期间用户明确允许Engineer只写独立的 `build/xue-er-audition/`：读取真实候选与timing，核验SHA后仅复制处理后MP3，用单Audio逐条或顺序试听；服务仅绑定127.0.0.1且只暴露该目录，不暴露仓库根或`.env`。试听页面不写正式manifest、`listening`或`ready`，播放结束不算人工通过。正式媒体导入须由Lead另行交回写权，四个媒体目录始终归Lead。

## 首页发布后的工程接续

- 先保留首页发布快照及现有首章兼容入口，再由 Engineer 接手单一内容清单、篇内章目、按章构建和变长播放器。校核文档由 Reviewer 继续维护，生产字段与路径统一由 Engineer 管理。
- 篇内目录应能发现每个真实开放的章；在线每章独立 URL，离线索引加各章独立 HTML。未齐备章保留不可用状态，不能落入相同首章或占位播放器。现有三句 demo 在补全首章前继续可用，但不标为完整底本已交付。
- 原文按稳定段号/原文区间连续分页，保留引语标识和全部标点。手动翻页先取消旧播放，自动全章朗读只在当前页确实读完后继续；返回、停止、暂停和单 Audio 沿用已验证机制。
- 场景按设计逐章接入，至少改变空间/站位/道具/动作中的两项。缺配音时可以继续实现和检查场景、内容映射与构建门槛，生产目录及产物不得把这些开发工作当 ready。
- 新媒体流程接受精确审核清单和显式选择的条目，只写获授权的新批次路径；默认不调用API、不自动重试、不覆盖旧v5或全局timings/meta。新素材完成后仍需人工听检、必要回归、截图和部署预检，才逐章发布。

## 当前逐章状态

| 章号 | 原文/拼音 | 正式语音 | 场景/互动 | 当前状态 |
| --- | --- | --- | --- | --- |
| 1 | 全文/拼音稿已校核，含独立「子曰」前缀 | 原定稿保留；A前缀已接入，待真人听检 | 书房与互动，1页 | 完整章已按固定授权上线 |
| 2 | 全文/拼音稿已校核 | A已合成并接入，待真人听检 | 院门与根系，2页 | 已按固定授权上线 |
| 3 | 全文/拼音稿已校核 | A已合成并接入，待真人听检 | 素纸屏风，1页 | 已按固定授权上线 |
| 4 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 三格书案，2页 | 已按固定授权上线 |
| 5 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 田埂与小车，1页 | 已按固定授权上线 |
| 6 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 门内门外与书角，2页 | 已按固定授权上线 |
| 7 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 书卷交接，3页 | 已按固定授权上线 |
| 8 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 积木修补台，1页 | 已按固定授权上线 |
| 9 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 老树与静灯，1页 | 已按固定授权上线 |
| 10 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 廊下问答，2页 | 已按固定授权上线 |
| 11 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 窗前旧书，1页 | 已按固定授权上线 |
| 12 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 圆桌拼片，2页 | 已按固定授权上线 |
| 13 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 三段小桥，1页 | 已按固定授权上线 |
| 14 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 林边书亭，1页 | 已按固定授权上线 |
| 15 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 打磨书案与四轮对话，4页 | 已按固定授权上线 |
| 16 | 全文/拼音稿已校核 | B已合成并接入，待真人听检 | 并肩看书，1页 | 已按固定授权上线 |

内容单一来源为 [校核数据](content/xue-er.json)，场景与26页建议见 [16章方案](design/xue-er-scenes.md)。Reviewer已完成16章、72段（20个引语标识）、493个汉字、167个标点位置及118个正文读音项的校核；数据SHA-256为 `85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73`，来源与检查见 [内容交接](content/xue-er-review.md) 和 [验证记录](content/xue-er-validation.json)。Lead独立核对16章全文严格等于固定底本，拼接、逐字长度、标点空槽与全章半开区间无错误；这不替代新语音的人工听检。内容就绪绑定上述已校核状态与证据，不新增用户逐章人工签字关卡。本次明确授权匹配且原技术校验通过后，完整章生产ready已为16；humanListeningApproved仍为false，实际发布状态另记。篇内章目和连续分页均由Engineer统一接入。

Designer的初版机器配置 SHA-256 为 `13be8fad01ccda687f94222c0656b378e7a7ff8f9dc4d6d3380d57163b47ff4a`，已用于早期16场景、26页、72段、49朗读组及20处引语归组检查。随后按实际画面收拢静态几何：第3/15章屏风与书案、5/10/11章宽背景、13章桥与溪流，4/7承接共享桌模板；保留原文、拼音、角色/控件尺寸、稳定ID及动作/音频绑定。

本轮最终 [机器配置](design/xue-er-scene-config.json) SHA-256 为 `17a163e213a206b39622fec527e185a7e5ff8a4c71a18e63fa22eb8225e97a9c`，[地面 CSS 建议](design/xue-er-scene-ground-proposal.css) 为 `df6210c5409af120ab8486585c1b775f0b95e222c73b10990c54998e34119393`；Lead已实际核对文件摘要。Designer的 [正式交接](design/xue-er-phase-b-review.md) 绑定候选截图、[逐项差异](design/xue-er-phase-b-geometry-diff.json) 与 [静态验证](design/xue-er-scene-config.validation.json)。Engineer统一接入后只复核匹配和标点禁则，再在冻结源码上完成一次完整 `npm test`；候选设计通过不能替代工程最终验收。

## 语音准备与已知约束

按 [Azure TTS 技能](../skills/azure-tts-voices/SKILL.md) 和既有声音配置准备具体原文、按句 SSML、角色/声音/参数、请求数、字数与预算；由主会话办理新付费批次授权。授权前不运行 `gen.py` 或任何合成 API。

初次只读检查时默认 `python3` 未发现 Azure Speech SDK，Azure 两环境变量未设置、项目 `.env` 不存在。主会话随后在项目 `.venv` 安装 Speech SDK 1.53.0，确认 native/import、`pip check` 与FFmpeg/ffprobe可用。2026-11-03主会话已将用户提供的凭据安全规范到项目 `.env`，权限0600且被git忽略；eastus端点仅认证POST返回200，未保留token。Lead使用 `.venv/bin/python`，在Python内解析两变量并仅注入子进程环境，不打印值、不改全局Python。后已按A→B完成全部235次实际合成，调用结果及媒体不能再描述为始终0调用；完整记录见文末。

主会话提供的 eastus 官方 Retail Prices 查询记录位于 `build/xue-er-preflight/azure-retail-prices.json`：S1 Neural TTS 为 $15/百万字符，Neural HD 为 $22/百万字符。具体 Dragon SKU 与计费字符规则尚未完成映射，当前仅作预算参考，不视为报价或付费授权。

现有 `process.py` 会遍历整份 meta 并写回原 timings/音频，多章流程必须按章隔离、明确选择处理对象。原 `ALIAS_BACK` 仅适合首章，之后按原文位置映射别名；不能把整篇中正常的字一概替换。

[批次 A 审核说明](tts/xue-er-generation-request.md) 与 [30条精确SSML清单](tts/xue-er-generation-request.json) 已完成。精确请求集合 SHA-256 为 `472d68446e3209689037534c3e9dedab710503b1036719d07a0e22752f672296`，包含首章前缀和第2–3章，复用第3章相同前缀，不重做v5。最初建议上限 US$1；主会话已逐条核验XML、声音、输出路径及摘要，随后转达用户原话“允许 上线10刀”，按 **US$10 上限**控制，先执行该精确30条。为保留原始审核输入，JSON中的准备时授权字段和预算建议不改写，本段及审核说明的授权附记记录后续决定；精确SSML和数量仍原封不动。准备期曾因凭据未就绪保持0次API；现已完成安全交接并执行A30条，实际结果见下，不修改原审核输入或自动重试。

首页实际发布后，Lead另备 [批次B说明](tts/xue-er-generation-request-b.md) 与 [205条精确SSML](tts/xue-er-generation-request-b.json)，覆盖第4–16章；48个新片段四声加13个大象标题，13处前缀复用节省52次请求。请求集合SHA-256为 `ff9384ff4d805bdab7567bda65d12c0101ec4007d10b17ee00a55b06ee6ea54f`，已验证XML、文字、标题字位、唯一ID及410个未存在的隔离目标路径；主会话审核和Reviewer [4,589项静态核查](reviews/xue-er-tts-b.json) 均通过，无发现。主会话明确A+B全部235条同属已批准US$10总上限，不重复询问；现已按A后B实际执行，两个精确集合白名单同时支持。按主会话参考单价，B含全部SSML字符的规划值US$1.086569，A+B约US$1.266060；这不是供应商最终计费规则或实际账单，不提高用户总上限。

### 隔离批次工具初次交接

Lead 已先记录 [接口](tts/xue-er-batch-interface.md)，再实现 `scripts/tts/batch.py` 与 `test_batch.py`。默认只校验精确 A/B 与内容/声音哈希；显式执行先独占落盘一次调用记录，未知/失败不自动重试。新媒体单独处理、按原文字位对齐，支持 A→B 前缀复用、三声齐读及第2–16章全部15条新标题；生产清单仍由 Engineer 导入，页面标题取校核章名。

初次离线测试真实退出 0：**17/17，21.999 秒**，原始输出见 [日志](tts/batch-tests.log) 和 [退出/源码指纹](tts/batch-tests-result.json)。测试使用临时目录、mock SDK 与本机 ffmpeg 生成的测试音，无真实 API 调用；未向生产媒体目录写入测试音。14条旧 SDK 边界回归全过，包含主会话发现的 d1「悦」后 `">说乎` 残片，仅按精确 SSML/别名字位及前后事件做限定回映并保留原始证据，不全局删字或补造缺字时间。

[实际 dry-run](tts/batch-dry-run.json) 显示 A 30、B 205 条全部未开始，Key/Region 均未设置、0 API / 0 新媒体；[保护文件核验](tts/batch-tool-verification.json) 绑定源码、旧49素材汇总与 lockfile，四个新媒体目录均未创建。Reviewer的 [正式工具结论](reviews/tts-batch-tool.md) 与 [22项独立离线检查](reviews/tts-batch-tool.json) 均通过，无需修改实现；并发同条请求也实测仅一次模拟调用。源冻结为 `batch.py` 的 `5cc282ec213c832b0f252f16a7b7820cc0dd002e53094d888ced806cda08525e` 及测试的 `67f889d11d267f5cdf239711fb602f2c6c5405847091b1496f07aedb5b4770ab`。主会话另行复验17项通过，证据在 `build/xue-er-audit-root/batch-tests-result.json`。此交接是工具验证，不是新音频完成/听检声明；待安全凭据就绪后按已授权 A→B 执行。

## 发布记录

B目录增量首轮完整 `npm test` 已真实结束：**59通过 / 3失败 / 0跳过，exit1，3.1分钟**，未据此发布。原始 [日志](../tests/artifacts/xue-er-phase-b/npm-test-b.log)、[结果](../tests/artifacts/xue-er-phase-b/npm-test-b-result.json) 及 `failed-first-full-run/` 的失败上下文已保留；48输入在测试前后相同，汇总 `36ce75f047f73f1ab7ed49c17e2d0278d952dc9ef2e8fe1cb2c4464421e9c8c1`。待定位项限定为快速连点采样、首页 reduced-motion 事件/取消时序、新场景暂停后动画时间继续前进；不通过放宽冻结断言关闭问题。修正后须以新冻结输入重新完成完整套件，静态设计复核与已关闭的 TTS 工具审查分别保留。

上述三项已完成限定诊断与修正，见 [诊断原始记录](../tests/artifacts/xue-er-phase-b/failure-timing-diagnostic.json) 和 [聚焦检查](../tests/artifacts/xue-er-phase-b/failure-fixes-focused-result.json)。快速连点用例取消单例16倍加速，保留单焦点/旧回调取消断言；首页确认异步媒体变化后仍须实际 `idle` 且不重播。新场景两个SVG动画虽已收到 pause，浏览器的 pending 暂停仍让当前位置推进；共享 `holdAnimation` 现同步固定该时刻，原180ms完全不变断言保留，并增加 pending=false 与恢复后推进检查。

修正后的最终完整套件于 **2026-11-03 12:36:42 UTC** 真实退出0：**62/62，0失败、0跳过，3.6分钟**。原始 [最终日志](../tests/artifacts/xue-er-phase-b/npm-test-b-final.log) SHA-256 为 `129c4e5565b93224723180864c681bbeb26be484ef770e40eab11c38986b257a`；[最终结果](../tests/artifacts/xue-er-phase-b/npm-test-b-final-result.json) 记录48输入前后一致，汇总 `bbe55d83261a0d9ec045f649564fa9e4a272925f7e0037e9c6dd03ff201c5b40`。Lead已重算日志、48个当前输入与6份产物，全部匹配。没有为留日志重跑本快照的本地完整套件；D/R最终绑定、部署预检与真实目录发布均已完成，见下。

| 阶段 | 版本/输入 | 验证 | 发布状态与入口 |
| --- | --- | --- | --- |
| 第一轮本地首页 | 首章 `6c50d762…791e94`；输入 `6bee5af9…7cc7e` | 38/38、dry-run、设计/审查全部关闭 | 第一轮未部署；本地 http://127.0.0.1:4173/ 保留 |
| 第二轮首页动漫增量 | 首页 `d7179532…c8313ba`；输入 `8f5f660f…ed76d57` | 本地45/45、dry-run、六视口双审查、公开浏览器检查；test:live 42过/3配置skip | 已真实发布：`11452180-c7cf-418b-b484-37ff87de3991`；https://lunyu-picturebook.mxhan.workers.dev/ |
| B阶段篇内16章目录 | 输入 `bbe55d8…01c5b40`；首页 `d1686239`、篇目录 `b0e78267`、demo `d68901a4` | 本地62/62、dry-run、D/R冻结审查通过；公开三HTML逐字节匹配，真实浏览器往返和未开放章404通过 | 已真实发布 `ba93f8e3-d89d-4f44-a18d-205fe891e891`；[篇目录](https://lunyu-picturebook.mxhan.workers.dev/learn/xue-er/)，仍只有旧demo可播、完整章ready为0 |
| 当前16章完整发布 | 680输入 `dcd1caf8…d8c84f`；授权 `9dcafa05…54b51c2` | 本地71通过/0失败/0跳过；dry-run与部署exit0；线上29通过/42配置跳过；18页面字节、16章全文及抽样互动通过 | 2026-11-03 14:25:51 UTC已发布 `58bbdbd5-5595-4881-927a-40fc1d335477`；[16章目录](https://lunyu-picturebook.mxhan.workers.dev/learn/xue-er/)，16章均开放，真人听检仍未确认 |

发布账号准备已闭合：主会话 OAuth login 真实成功。Lead `wrangler whoami` 确认账号 `mxhan@outlook.com`；只读账户 API 确认 workers.dev 子域为 `mxhan`，现有 `lunyu-picturebook` 部署列表可读。本次更新前的远端部署 ID 为 `28f4e1dd-9110-4276-a932-f9e79712c997`、版本 `655531ed-f8e1-49cc-bae7-f5df87f39528`（2026-11-03T08:49:48.417516Z）；现已更新为上表B篇目录版本。团队没有重复启动 login，也没有新建或改名 Worker。

阶段A真实发布、首次传播诊断、公开首页/首章逐字节匹配、截图与线上套件证据均见 [首页实施记录](homepage-build.md#实际发布与公开核验)。11:35 UTC线上套件结束且源码/产物未变后，Lead已通过Herdr明确交回Engineer写权，启动全16章数据/分页/场景/目录和隔离媒体流程。后续只发布达到五项与听检/测试要求的章，继续记录实际版本和深链。


### B篇目录正式发布闭合

Designer的 [最终结论](design/xue-er-phase-b-review.md) 与 [绑定清单](design/xue-er-phase-b/final-bbe55d8/manifest.json)、Reviewer的 [正式结论](reviews/xue-er-phase-b-candidate.md) 与 [机器证据](reviews/xue-er-phase-b-final.json) 均绑定同一 `bbe55d8…01c5b40` 快照并通过，无未解决阻断。最终11张设计截图与已审副本字节相同，未重复静态图矩阵。Lead保存131份冻结输入/产物/截图/日志到 [发布快照](../build/xue-er-directory-release/frozen-snapshot.json) 及同目录snapshot，后续线上测试或开发不能替换这份本地验收证据。

`npm run check:deploy` 于12:40:53 UTC真实exit0，前后48输入和6产物不变，见 [预检](../build/xue-er-directory-release/check-deploy-result.json)。随后按已有授权直接执行本地Wrangler4.86.0的 `wrangler deploy`，12:46:29 UTC真实exit0，上传3份更新HTML到原Worker，版本 `ba93f8e3-d89d-4f44-a18d-205fe891e891`；[原始输出](../build/xue-er-directory-release/deploy.log)、[发布结果](../build/xue-er-directory-release/deploy-result.json)。没有重复本地完整套件、没有新建Worker、commit或push。

- 公开首页 `/`：19,422字节，SHA `d1686239c8584129988138ac1c525bb74ce3bdf796e3a8e90071dd5f9ec1b085`。
- 公开篇目录 `/learn/xue-er/`：9,289字节，SHA `b0e782677933ba77f93111f549f9e16e960e299dbe999f1f7d7bce76998bf9df`。
- 旧demo `/learn/xue-er/1/`：568,535字节，SHA `d68901a4dc47b06c33639fedeef470c309d283270ed8b8fcf7dc6c1bbf01496c`。

Lead的 [无查询参数读取](../build/xue-er-directory-release/live-fetch-first.json) 三HTML均200且逐字节匹配；15个未开放章及开发预览/未知路径404。实际Chromium [导航记录](../build/xue-er-directory-release/live-browser.json) 通过首页→篇目录→旧demo→停止free/停音→篇目录刷新→首页恢复焦点；390px目录16项、1旧demo链接、15禁用、0完整ready且不溢出，脚本及资源错误均0。[线上目录截图](../build/xue-er-directory-release/live-volume-390.png) 已实际查看。主会话独立Chromium核验见 `build/xue-er-audit-root/directory-release-browser-final.json`；其Python urllib首次HTTP403/1010是客户端访问拦截，未据此重部署或改文件。

`npm run test:live` 于12:49:52 UTC真实exit0，**47通过、0失败、15按配置跳过（2.3分钟）**。12项本地开发预览/旧媒体测试夹具、2项离线、1项本地完整Chrome BFCache不跑公开URL，本地62项已覆盖；Lead另实测了公开篇目录。见 [原日志](../build/xue-er-directory-release/test-live.log)、[结果](../build/xue-er-directory-release/test-live-result.json)，日志SHA `6f82c3d96243a62183700d48a90f413f2c91f2ee66462bbd20d1046375753831`，48输入与六产物均未变。线上截图另存live-test-artifacts；本地验收仍以snapshot为准。

[发布闭合清单](../build/xue-er-directory-release/release-complete.json) 已保存。Lead已通过Herdr交回Engineer新媒体manifest/player/build/JS测试写权，先交实际试听，再适配真实开放状态与新章回归；Lead继续独占TTS两文件及四个A/B输出目录。4173保留。

### 实际A/B配音与试听交接

A30条于12:48:12–12:50:14 UTC完成，真实exit0、30成功/0失败/0重试，逐条attempt、原始MP3、wb和SDK定位均保留；[执行记录](../build/xue-er-media-run/batch-a-execute-result.json)。第一次免费process在11份处理后文件落盘后遇到真实HD `textOffset=-1`，退出2，原 [失败日志](../build/xue-er-media-run/batch-a-process.log) 保留。这不是API失败，没有重合成。

已根据真实数据限定修复：SDK -1保留为未知定位，-2等非法值拒绝；只在精确获准SSML的单字alias、紧前别名事件、连续原文字位与时间顺序均吻合时，回映一或两个剩余汉字。6处SSML残片均保留原事件/原字位/offset/span及SDK定位；不全局删字、不补时间。20项离线测试真实exit0（包括旧17项、4份真实AHD边界与拒绝反例），见 [测试日志](../build/xue-er-media-run/batch-tests-hd-a.log) 和 [结果/源码SHA](../build/xue-er-media-run/batch-tests-hd-a-result.json)。Reviewer [独立数据证明](reviews/xue-er-media-a-alignment.md) 与8个拒绝反例通过。免费处理于12:56:30 UTC真实exit0，产出37个唯一MP3/timing（30配音+7齐读），候选SHA `ccc09c1709cc707442997d3a4c0e94449cd5166c2d21e7a7a5017e348f51f5af`，共127.543秒；[恢复处理结果](../build/xue-er-media-run/batch-a-process-recovered-result.json)与[Lead候选核验](../build/xue-er-media-run/batch-a-candidate-check.json)。6处边界修正有完整溯源，50份旧素材/锁保护文件均未变。B在A原始30条全成功后按获准205条清单串行执行，于13:08:01 UTC真实exit0、205成功/0失败/0重试，[B执行记录](../build/xue-er-media-run/batch-b-execute-result.json)。A+B实际235次应用层合成调用，均在原精确集合内；实际账单尚未核对。

本地真人试听入口由Engineer独立提供 `http://127.0.0.1:4174/`，服务根严格为 `build/xue-er-audition/`、仅绑定127.0.0.1。候选未到齐时显示空态且禁播，实际处理后MP3通过SHA/timing核验才复制；人工听检尚未发生，不能把播放结束或生成成功写成listening/ready。所有16个完整章仍未开放。A已按音频SHA去重实际验证37条/37文件/92引用；[固定A试听清单](../build/xue-er-audition/batch-a-evidence/audition.json)、[实际播放/暂停/继续/停止/真实ended顺序切换](../build/xue-er-audition/batch-a-evidence/verification.json) 与 [批次筛选](../build/xue-er-audition/batch-scope-verification.json) 保存原始证据。明确A入口为 `http://127.0.0.1:4174/?batch=batch-a`，B入口为 `?batch=batch-b`，B候选未到前不会混入A。主会话13:02 UTC已将A试听问题转给大雄；随后协调回复仅说明等待本人回答，不是听检批准。


B真实HD词边界另有“习乎”“父母”两个多字词duration为0。首次发现保持拒绝且不猜时长；主会话随后明确采用真实词首锚点方案，Reviewer确认完整事件链和原文字位后，工具仅让词内字符共享SDK实际offset，并保存 `wordGroups` 的词级精度、原事件/字位和原始duration=0。不能把下一词或音频结尾写成末字/词长。真实两个记录、缺/多字/负时间拒绝、证据丢失/篡改拒绝已加入回归；**23/23、exit0**，见 [回归日志](../build/xue-er-media-run/batch-tests-word-anchors.log) 和 [结果/源码指纹](../build/xue-er-media-run/batch-tests-word-anchors-result.json)。当前batch.py SHA为 `d74ea3c297bf86dc6968e48af32bdc0a0e0da970c6a3afc8e51ca7f288444cd4`，测试为 `9f1c21e341dab08794399a6bece8094a809d43ff4c9c11b3cf0369aea264649d`；已有A/v5字节不重写，Engineer兼容同时间字同时高亮。

主会话已明确授权仅本地真实媒体互动预演。Engineer使用现成模板/播放器/场景，按明确构建选项输出 `build/xue-er-rehearsal/`，现已覆盖16章；`verifyClip(requireListening:false)`只用于该内部路径，其余文本、媒体、时间与哈希验证保留。预演的技术可播放不等同production publicationReady，不写伪造listening、不进入public/dist；仅绑定127.0.0.1的独立4175入口已实际可用，验证见文末。4173生产预览、4174原音频试听继续保留。正式章节发布仍需真人听检与相应源码的完整测试/预检。


### 媒体最终技术交接（人工听检未完成）

B免费处理于 **13:13:17 UTC** 真实exit0，253份B处理后MP3/timing（205配音+48齐读），[原始处理日志](../build/xue-er-media-run/batch-b-process.log) 与 [结果](../build/xue-er-media-run/batch-b-process-result.json) 已保存。最终候选 `assets/audio/xue-er/batch-b/media-candidate.json` SHA-256为 `b4e80d04d725e9e092a7a6427b8d540b6fbca0bed802034b3abe263a96616220`，覆盖69个新段的四角色及齐读、15个新标题，360条引用，missing=0；另3个既有段继续引用保留v5。A候选仍是ccc09c17…f5af，未被B刷新覆盖。

Lead已逐文件核验全部235次一次调用记录、raw、290份processed/timing与候选：[全量核验](../build/xue-er-media-run/all-media-verification.json)。全部235成功、0失败/0重试，A完成在B开始之前；原精确SSML/数量未改。A37份共127.543秒，B253份共835.947秒；共有290个不同音频SHA。50份旧素材和lock逐项未变；四个新输出目录1287文件汇总SHA为 `22a67cfc4707c54ea59d41f1c0abc646c2bed6848e2793ec13f2f61665a7abea`（排序path + TAB + fileSHA + LF后SHA256）。已停止TTS源码和媒体写入并交Engineer统一引用导入、B试听及本地互动预演。

最终共有16处可证明的HD残片修正、**3处词级锚点**：第4章小狗“习乎”0.552秒、第7章小狗“父母”0.364秒，以及后续生成的第15章小狗“来者”1.07秒。各组保留原始duration=0和完整源事件，词内字共享真实词首，不推算末字时间。第三处沿同一已测试路径处理，没有额外重合成或修改审核输入。

媒体候选publicationReady=false，290份均待真人听检；Engineer随后完成实际新播放器全链路与当前源码70项完整套件，见文末，媒体技术通过与播放器验收分别留证。US$10为获准总上限，235条均在原审核集合内；Azure实际账单仍未核对。本地A/B试听及互动预演见 [媒体交接](tts/xue-er-media-handoff.md)。

Reviewer的 [正式媒体技术结论](reviews/xue-er-real-media.md) 与 [最终机器证据](reviews/xue-er-real-media-final.json) 已通过，无未解决数据阻断。Lead实际读完报告，逐项核对其235/290/360计数、候选SHA、1287文件汇总、3处word锚点及保护文件，与独立全量记录一致。此处关闭的是媒体对应关系和格式/时间证据；真人试听仍未完成，播放器完整回归的后续独立结果见文末。


### 本人试听反馈与本轮收尾边界

主会话随后明确转达大雄本人原话：A“稍后试听”，B“稍后试听或分章反馈”。[原话及固定音频集合](tts/xue-er-listening-status.md) 分别绑定37/253份文件及主会话请求集合SHA，完整文件列表另存不可混淆的记录。此回复未批准听检、不是工程暂停；不重复发问题、不追加API、不填写listening。工程继续完成16章真实本地预演与最终技术验收，之后保留4173/4174/实际预演入口，等待以后本人按章反馈再发布对应新章。现有 `ba93f8e3` 目录发布与原US$10授权不变，235条已执行完毕。

### 16章真实媒体本地预演

`node scripts/build.mjs --rehearsal` 已成功生成全部16章、26页的自包含HTML，`node scripts/serve.mjs --rehearsal` 只在127.0.0.1:4175服务 `build/xue-er-rehearsal/`。入口为 [篇目录](http://127.0.0.1:4175/xue-er.html)、[第3章](http://127.0.0.1:4175/xue-er-03.html)、[第15章](http://127.0.0.1:4175/xue-er-15.html)。16个technicalPlayable为true，所有publicationReady仍为false；页面明确标注本地预演，不改变线上或正式离线包的开放状态。4175的根配置、源码、raw和路径越界请求拒绝证据见 [工程首次验证](../tests/artifacts/xue-er-media/rehearsal-first-verification.json)。

受影响8项真实exit0（2.9分钟）：[原始日志](../tests/artifacts/xue-er-media/media-focused.log)，SHA `3698951469d083a77bab85b2b9b28f943155881675d0ab4aad9105e4c0bd2f91`；[结果](../tests/artifacts/xue-er-media/media-focused-result.json)。涵盖16章预演与生产隔离、新标题及短章完整真实ended、长章跨页顺序、暂停换页/快速点击取消，以及三个SDK零duration词组双字同时高亮。原始duration=0和真实词首保留；暂停恢复、停止/换页清理和旧回调不复活的实际记录在 [词级锚点证据](../tests/artifacts/xue-er-media/real-word-groups.json)。自动化全流程使用测试播放速率验证真实ended，不作为正常语速或音质听检。

Root窄范围 [独立预演记录](../build/xue-er-audit-root/rehearsal-title-smoke.json) 实际通过：第3/15章320×568，等标题入场后真实标题音频前进，■立即free，首句点击实际播放，二次停止不复活旧流程；无横向溢出/页面异常，16目录链接及隔离路径检查通过。4张截图由Root代理通过view_image完成**代理视觉检查**，不是用户或其他真人验收，`humanListeningApproved`始终false。所测第3章HTML为 `98119fc79d5e3e8ba458bc6b41bc09281e04636eced633620982bd90be9b2fa9`，第15章为 `3f3af098a50ccc2db5ec61b0611ce81fc43fa82454d779d1506018c3d50378bc`；Lead在当前完整套件结束后已独立重算，两章字节均精确一致，复用该证据，不重开静态矩阵。

当前源码完整 `npm test` 于 **2026-11-03 13:39:20 UTC** 真实退出0：**70通过、0失败、0跳过**，Playwright报告5.9分钟，包含构建的命令总耗时368.923秒。[原始日志](../tests/artifacts/xue-er-media/npm-test-media-final.log) SHA为 `59d793bfc21d294877810ddbbce9ab77156fa4fb2ea87a9e2e7ca1485687e7a0`，[实际结果](../tests/artifacts/xue-er-media/npm-test-media-final-result.json) 及测试前后输入清单均已落盘。Lead重算日志并核对70条通过记录，逐文件核验48份源码/配置、582份新媒体输入和50份保护素材/lock；合并去重679份前后及当前均相同。源码汇总为 `4827477df48fd8e2d08299643cb6585d707b66da11c040b572c7aed11dff5c93`，全部输入汇总为 `4bbfa6d08890f049fa74041761b678909cbea18c0376e01b15e7ea5a83bc5361`（排序相对路径 + TAB + 文件SHA + LF后SHA256）。没有为补日志重跑完整套件。

Reviewer的 [本地预演限定工程复核](reviews/xue-er-rehearsal.md) 与 [独立绑定证据](reviews/xue-er-rehearsal-evidence.json) 已通过，未发现需阻断预演接入的问题。只读复核同时间双字高亮/取消、本地技术可播放与生产听检门槛隔离，并实际查看三张词组图；48源码与70项原日志绑定一致，没有复跑媒体解码、浏览器矩阵、测试或构建。Lead另实际查看第4章词组截图，原文、拼音与双字高亮清楚；该检查同样仅为代理视觉检查。

### 最终冻结交接与部署预检

Engineer已正式交回源码、测试、前端构建及试听目录主动写入权并停止写入，三个服务继续运行。最终 [指纹](../tests/artifacts/xue-er-media/build-fingerprint.json) 与顶层 `tests/artifacts/build-fingerprint.json` 字节相同，SHA为 `0ab6eba5e19f38d08466c0b80f2c26341014f94220b3b59460b5ff9730545351`。Lead核验6份生产HTML、18份预演HTML、19份静态预览/支撑HTML、1份旧demo回归HTML、58张截图和26份证据，全部匹配；接收清单与 [独立核验](../build/xue-er-rehearsal-acceptance/lead-verification.json) 已保存。18份真实预演HTML汇总为 `5c7b8fb9676f1176ebf426488d8eab288e9488f3e87ed8952c6adc44a5c06a0c`。

收尾服务探针曾将4174的紧凑JSON响应与缩进JSON文件直接比较原始字节，失败已保留在 [原探针记录](../tests/artifacts/xue-er-media/served-probe-first-failure.json)。改为全字段深相等及290份复制音频/源文件SHA对照后通过，290条/360绑定/issues=0；只修取证方式，未改服务、媒体或冻结源码。最终 [23个响应核验](../tests/artifacts/xue-er-media/served-artifacts-verification.json) 绑定静态HTML字节、试听JSON内容和三个仅loopback端口。Root独立确认相同结果；没有据此重跑70项。

Lead接手后仅执行一次 `npm run check:deploy`，于 **2026-11-03 13:45:59 UTC** 真实exit0，用时14.601秒：[原始日志](../build/xue-er-rehearsal-acceptance/check-deploy.log)，SHA `61191a918bfa418a8c2223e906f6f29dcc04da6a1444e1f36062b303da5017da`；[结果](../build/xue-er-rehearsal-acceptance/check-deploy-result.json)。Wrangler4.86.0明确 `--dry-run: exiting now`，没有上传、部署或新API调用，未加载项目`.env`。679输入及128份去重产物/截图/证据前后相同，`git diff --check`退出0。当前本地产物因新播放器兼容代码与已发布demo字节不同，线上版本仍是 `ba93f8e3-d89d-4f44-a18d-205fe891e891`，不能把本次dry-run当作上线。

本轮技术交接和文档已完成，结束本轮等待，保留4173生产预览、4174试听及4175互动预演；以后只依据本人按章真实听检反馈发布相应新章。用户的延期回复不改变 `humanListeningApproved:false`，自动化播放或代理视觉检查也不改变该值。仍未验证本人听检、物理移动设备/Safari、真机后台/锁屏及Azure实际账单；没有commit、push或新增章发布。

## 负责人授权16章直接发布（已完成）

以上为本地预演轮的历史结论。大雄随后明确要求“直接全部部署”，主会话要求立即按本批固定范围接入，不能再为听检阻塞，也不能把直接发布误记为已经听检。Lead已单独保存 [原话说明](xue-er-release-authorization.md) 和 [冻结JSON](xue-er-release-authorization.json)：16章、内容SHA `85168c…13b73`、manifest SHA `83457528…be5c`、370个引用、305份唯一音频（290新+15旧共用/定稿）与291份时间轴；Lead逐文件核验，原媒体和manifest未改。

互斥分工：Engineer重新独占src/scripts/tests（排除全部TTS）和前端生成产物，只做loadBook的固定授权接入及必要测试，默认assessReadiness/verifyClip保持严格；Reviewer只读核对本批范围、未来媒体不可继承与原技术验证完整。Lead只维护上述授权、README、本实施记录和TTS说明，不并发构建；Designer无需重开视觉审查。旧70项日志与指纹保留，新工程证据使用 `tests/artifacts/xue-er-direct-release/`。

Root负责最终dry-run、实际deploy、线上套件及全16章HTTP字节/目录/抽样互动验证，独占 `build/xue-er-all-release-root/`，团队不写该目录、不部署。OAuth已由Root确认可用，账号与Worker不变；最终源码/产物已交回，Engineer和Lead均停止构建写入。Root已完成实际发布及线上验收，结果见下；不追加API、不commit/push，三个本地服务继续保留。

发布接入已实现：`verifyReleaseAuthorization`固定本批JSON字节SHA，检查内容、manifest、16章有序范围，以及305音频/291时间轴逐文件SHA；缺记录返回null并保留严格路径，存在但不匹配即拒绝。`loadBook`仅在这一明确记录完整匹配时传 `requireListening:false`。Reviewer [限定源码审查](reviews/xue-er-direct-release.md) 已通过，确认validateBook、validateTiming、verifyClip、assessReadiness与已审基线逐字一致，未放宽技术校验；最终完整套件及冻结产物已交接，无未解决发布阻断。

[授权边界专项](../tests/artifacts/xue-er-direct-release/authorization-focused.log) 实际1/1、exit0；[阶段结果](../tests/artifacts/xue-er-direct-release/focused-result.json) 另记录在线构建exit0（76.819秒）和离线构建exit0（73.05秒）。当前在线/离线各18份HTML，包含16个真实章节和2个索引，所有新媒体仍无listening。最大在线章为第15章约1921KB，离线同章约2180KB；没有首页预取全书媒体。产物ready=16来自固定授权与技术完整性，授权内humanListeningApproved仍为false，不代表已经部署或声音获真人验收。

随后 [6项生产回归](../tests/artifacts/xue-er-direct-release/production-focused.log) 也真实exit0，与上述授权专项合计7项通过，原始命令/退出/日志SHA均在阶段结果中。Engineer随后在冻结输入上完成一次完整 `npm test`，未用旧70项代替本轮验证。

### 最终完整测试与正式交接

完整 `npm test` 于 **2026-11-03 14:24:06 UTC** 实际退出0，**71通过、0失败、0跳过**；命令总耗时662.268秒，Playwright尾行71 passed（8.3分钟）。[实际结果](../tests/artifacts/xue-er-direct-release/npm-test-direct-release-final-result.json) 记录680输入测试前后完全一致；[原始日志](../tests/artifacts/xue-er-direct-release/npm-test-direct-release-final.log) SHA为 `b79b89280c6e9cde582938b815035d44092d89591c14014ee5159aea8f12dbad`。Engineer实际退出后立即交回源码/测试源码/构建/public/dist写权，仅继续整理证据；Root未等待归档或重复构建、测试。

本轮以 [最终指纹](../tests/artifacts/xue-er-direct-release/build-fingerprint.json) 和 [正式交接](../tests/artifacts/xue-er-direct-release/handoff.json) 为准；指纹文件SHA为 `48263bcbd51159a0c14e181aa055a4113ca15feca4a36c2e5eee5956b96d6e2d`。49份源码/配置输入汇总 `ec6dfd811b559fd4885c3b686fdbbb32777d40f36dccc8e16ac2bc07bb5e0221`；680合并输入汇总 `dcd1caf8a503c7b91d271f207d73938bf9e798e347a631a03a2920c82dd8c84f`。36份生产HTML汇总 `699dd601c5b7754c09809ca3a0bf1fc540ad6929ccf9dceefa68238f0fc3eaca`，public全部28文件汇总 `d58fed0f37b159ae96d2130c34ec5cc15e34413c68a420c69402a04743475929`。Lead的 [接收核验](../build/xue-er-direct-release-lead/verification.json) 已绑定实际输入、原日志、产物及授权字节；没有复跑套件。

53张本轮套件截图已列入指纹；旧70项的130份证据原样保存在 `tests/artifacts/xue-er-direct-release/prior-70-evidence/`。旧顶层 `tests/artifacts/build-fingerprint.json` 仍代表上一轮，不作为本次直接发布快照。

### 实际部署与线上验收

Root对现有已测试字节执行Wrangler dry-run及实际部署，均使用全局 `--env-file /dev/null` 避免读取Azure `.env`；[预检](../build/xue-er-all-release-root/dry-run-result.json) 14:25:02 UTC实际exit0。[部署](../build/xue-er-all-release-root/deploy-result.json) 于 **2026-11-03 14:25:51 UTC** 实际exit0，17个新增/变更文件已上传，Worker仍为 `lunyu-picturebook`，版本 **`58bbdbd5-5595-4881-927a-40fc1d335477`**。未重复构建、测试或改名Worker。

[线上首页](https://lunyu-picturebook.mxhan.workers.dev/) 与 [《学而》16章目录](https://lunyu-picturebook.mxhan.workers.dev/learn/xue-er/) 已开放。Root的 [实际Chromium核验](../build/xue-er-all-release-root/live-smoke.json) `passed=true`：首页、篇目录和16章共18份HTTP响应均200且逐字节匹配本地产物；16章全文、入口及productionReady正确，无JS异常。第1/3/15章真实音频前进和停止、第3章暂停、第15章翻页通过，私有/开发路径与第17章返回404。

`npm run test:live` 于 **14:27:24 UTC** 真实exit0，**29通过、0失败、42项仅本地用例按配置跳过**；这是线上限定套件，不是71项在线全跑。见 [结果](../build/xue-er-all-release-root/live-tests-result.json) 与 [原始日志](../build/xue-er-all-release-root/live-tests.log)，日志SHA为 `6243a2db7a34ed0a046db98c3df11d6923a2eff82b0aed034bbcc975402c3b0b`。public/dist上传及线上测试前后字节均未变。

本次16章直接发布与文档交付已完成。`humanListeningApproved=false`，没有填入listening；A“稍后试听”、B“稍后试听或分章反馈”的原话与固定集合继续保留，未来新媒体不能继承本次发布例外。本人听检、物理移动设备/Safari、真机后台/锁屏及Azure实际账单仍未验证。4173生产预览、4174试听、4175互动预演继续保留；本轮结束，不追加API、测试、构建或部署，不持续轮询等待试听，没有commit或push。
