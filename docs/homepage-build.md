# 动画首页实施与验收

## 最新：首页按篇导航修复

2026-11-03，大雄确认“首页一直显示首章入口，目录不对”。原首页在「学而」篇名链接下另有醒目的「学而时习之 ▶」入口。现已移除独立章目和播放图标，保留二十篇与原动漫插画；整行「学而 →」进入16章目录，在线、离线和键盘返回使用相同层级。

Herdr Engineer完成7份源码/测试修改，Reviewer实际查看390×844手机和1024×768平板截图并通过 [限定审查](reviews/home-volume-navigation.md)。Root独立核验1440、1024、390、320四种宽度的首页、16章目录、第7章和返回焦点，以及关闭JavaScript后的导航；[本地记录](../build/home-volume-fix/local-ui.json) 和 [线上记录](../build/home-volume-fix/live-ui.json) 均通过。检查使用Chromium模拟视口，不代替物理手机测试。

完整 `npm test` 于14:49:43 UTC实际exit0，**71通过、0失败、0跳过**，46份输入前后不变，见 [结果](../build/home-volume-fix/npm-test-result.json)。Wrangler预检通过后，于 **14:50:37 UTC** 实际部署成功，版本 **`903cc7a4-73fd-49a6-8bf3-6796c829cc4d`**，见 [部署记录](../build/home-volume-fix/deploy-result.json)。28个线上文件与前版相比 [仅首页变化](../build/home-volume-fix/production-change.json)，实际只上传1个文件；章节、媒体和发布授权未改。

部署后的 [线上套件](../build/home-volume-fix/live-tests-result.json) 于14:51:34 UTC实际exit0：**29通过、0失败、42项仅本地用例按配置跳过**。部署和线上测试没有改动public/dist。设计检测结果为 `[]`。上一轮会被测试覆盖的截图/证据已保存在 `build/home-volume-fix/previous-artifacts/`；下面保留早期实施历史。

## 早期版本记录

日期：2026-11-03。代码基线：`cf21414`。第一轮 [首页任务](homepage-brief.md) 已交付并关闭：完整测试38/38、部署dry-run通过，Designer的D1–D3、Reviewer的R1–R4全部关闭，当时未部署。第二轮动漫首页现已真实发布，仍只开放既有三句demo；完整《学而》16章和首章引语补齐见 [逐章记录](xue-er-build.md)。下文分别保留两轮证据。

后续B篇目录增量已于12:46 UTC发布，版本 `ba93f8e3-d89d-4f44-a18d-205fe891e891`；本地62/62、dry-run、D/R冻结审查及线上47通过/15配置跳过均闭合。首页新增《学而》篇内目录入口，完整章仍0 ready，只有旧demo可播放。后续准确快照、线上字节与配音试听进度见 [逐章记录](xue-er-build.md#b篇目录正式发布闭合)，以下两轮历史证据保持原样。

## 第二轮：目录顶边动漫元素（已发布）

用户反馈整体方向可以，希望在目录上面加入更多动漫元素。本轮只打磨首页视觉与动效：在现有书页顶边安排小动物探头、彩色书签和纸飞机，配少量点头或眨眼；使用既有插画图层和代码绘制，不新增文案，不改变刚通过的主布局与真实目录状态。

- Designer 只写 `docs/design/`，先根据第一轮最终截图给出可直接实现的小幅构图与响应式建议，再审看新增部分。
- Engineer 负责 `src/home.html`、`src/home.css`、`src/home.js` 和必要的首页回归用例、生成证据；目录数据、构建方式、首章与全部播放逻辑保持冻结。先保留第一轮测试/截图证据，再执行本轮构建与测试。
- Reviewer 只写 `docs/reviews/`，实现可运行后仅审查新增首页内容的布局、遮挡、可访问性和动效取消，不重开第一轮播放器专项。
- Lead 维护 `README.md`、本文件及 [学而逐章实施记录](xue-er-build.md)，核验本轮原始测试结果、截图和冻结差异，串行执行部署 dry-run 和已授权的实际发布；不重复同一快照完整套件。

验收边界：装饰不遮挡篇名、首章或触区，手机首章入口仍在首屏且底缘 ≤600px；只动 transform/opacity，支持 reduced-motion、后台/pagehide 取消，无多个持续争抢焦点的动画。首页源码更改后必须执行 `npm test`（从已通过的 38 项起步）；不另跑无关播放器专项。保留现有 4173 预览服务，不新增代理或布局，不改媒体/锁文件，不调用未批准的付费生成，不提交或推送。

**最新发布授权：**用户已明确授权此首页增量通过检查后直接发布到现有 Worker `lunyu-picturebook`，以后每完成一章即可增量发布，不再逐次确认。此前“不部署”仅是第一轮历史边界。每次实际发布前须在相应源码上通过 `npm test`、`check:deploy` 与截图审看，发布后核验公开首页/章深链并记录 URL 与版本。主会话已完成 OAuth；Lead 已独立确认 `mxhan@outlook.com` 的账号、`mxhan.workers.dev` 子域及已有 Worker 部署，认证阻塞已解除。内容和场景准备并行继续，不阻塞首页交付。

首章冻结基准：`src/app.js` SHA-256 `7d380a43f78f5a3b0bb05191642fb819335f306a92f8d8b13d0ad65a62d20903`；`src/styles.css` 为 `da7901b410acaf0432c52858dae18279a03cda0450a683f25c268f850f765adf`；`src/index.html` 为 `f9d654fe0436f02df9f08e6ed5f235c0a09a0adc6831309b5e5e464934d04a82`。首章在线产物 `6c50d762…791e94`、离线产物 `d874353f…db0a0` 必须保持一致。

### 阶段 A 冻结证据与放行

本轮只改首页三文件及两个首页/响应式测试文件。新增目录顶边探头小猫、桌面静态小兔、两条书签和纸飞机；小猫仅一次640ms点头，取代原大象迎宾动作。无新文案、音频或运行时依赖，目录仍为20篇、1个真实首章入口。首章源码、目录数据、构建脚本及媒体/锁文件均保持第一轮冻结状态。

工程唯一一次完整 `npm test` 已实际退出 **0**：**45 passed (2.3m)，0 failed / 0 skipped**（session `85606`）。[原始日志](../tests/artifacts/npm-test-home-polish.log) 在本次运行中直接捕获；SHA-256 为 `4cfd0aef897757ff665c7b8968bf39f6042e0d7604ee4ede8c696f3dd1d85d9f`。[运行结果](../tests/artifacts/npm-test-home-polish-result.json) 记录测试前后相同的27输入汇总 `8f5f660f77f638c43d7df4108c2f39a175f5e1fe9807c5b712db7db80ed76d57`。Lead 读完日志，重算全部输入、四产物和11张截图指纹，均一致；没有重复完整套件。

| 本轮产物 | 字节 | SHA-256 |
| --- | ---: | --- |
| `public/index.html` | 19,084 | `d7179532783d0405cbece7b4e69069ea7e11a2fa17abbbc77b5bd7341c8313ba` |
| `public/learn/xue-er/1/index.html` | 564,226 | `6c50d7627405b26fa63eaf4fa8854f7ed13f981662d555a164b712fbfa791e94` |
| `dist/index.html` | 410,053 | `b10b60bdf7ae95d00535f5fe446fae0d5fc85935d120c68e07290be9739ef444` |
| `dist/index-single.html` | 829,361 | `d874353f248751574262cfc28f31094c03de6d92a4254f450b3af9bc528db0a0` |

Designer [第6节正式结论](design/homepage-anime-polish.md#6-阶段-a-最终增量视觉结论--2026-11-03-1121-utc) 已通过六视口、五个动作峰值及放大裁片；主会话与Lead也实看当前截图。320/390入口底缘仍为508.296875/534.296875px，触区88px、图标64px，未增高或遮挡。Designer 所看11张截图与最终完整套件截图逐文件SHA一致。

Reviewer 的 [正式增量审查](reviews/homepage-anime-polish.md) 已通过，无未解决阻断。[浏览器记录](reviews/home-anime-d7179532-check.json) 完成六视口遮挡、焦点、点击命中、无音频/多余tabstop、单次动画及reduce/hidden检查，无页面错误。首次跨文档console未收到离页事件，原汇总false保留为取证诊断；随后仅补一次同源sessionStorage取证，[实际pagehide](reviews/home-anime-d7179532-pagehide.json) 为 `isTrusted=true`、`persisted=false`、`cancelled=1`、`active=0`、动画idle，该项闭合。未重跑已通过矩阵，也未把诊断当成产品缺陷。物理真机、Safari、系统后台/锁屏及人工听检边界仍保留。

工程已正式移交源码/测试/构建写权。Lead 执行一次 `npm run check:deploy`，Wrangler4.86.0读取17份静态资源并以 **0** 退出；[原始输出](../build/homepage-anime-release/check-deploy.log)、[结果及前后指纹](../build/homepage-anime-release/check-deploy-result.json) 记录27输入和四产物未变。这是发布预检，不冒充实际发布。

为后续B阶段保留本轮证据，已在 [冻结快照清单](../build/homepage-anime-release/frozen-snapshot.json) 及同目录 `snapshot/` 保存53份源码/产物/测试/截图/设计证据；不会因下一阶段重建而混淆本轮通过版本。4173预览继续保留。

### 实际发布与公开核验

Lead 使用既有配置执行 `node_modules/.bin/wrangler deploy`，真实退出 **0**，2026-11-03 11:31 UTC 发布到原 Worker **lunyu-picturebook**；版本 **`11452180-c7cf-418b-b484-37ff87de3991`**。没有新建或改名Worker，没有commit/push。[发布原始日志](../build/homepage-anime-release/deploy.log) 与 [版本/输入记录](../build/homepage-anime-release/deploy-result.json) 已保存。

- 公开首页：https://lunyu-picturebook.mxhan.workers.dev/ ；首章：https://lunyu-picturebook.mxhan.workers.dev/learn/xue-er/1/ 。无查询参数的实际响应分别200、19,084/564,226字节，SHA与本节冻结产物严格一致。
- 首次边缘响应仍是旧demo和未传播深链，证据保留在 [首次读取](../build/homepage-anime-release/live-verification-first-attempt.json)；11:32 UTC后主会话重新取到新版本，Lead随后也独立确认。没有为传播重部署、改源码或放行并发构建。
- Lead [公开浏览器核验](../build/homepage-anime-release/live-verification.json) 通过：1440/390/320无横向溢出，20篇1个真实链接，手机入口位置与88/64触区不变，图片全部加载；首章进入/刷新200、停止为free且停音、返回 `/#xue-er` 聚焦 `first-chapter`，页面错误0。未开放的第2章仍404。
- 用户要求的固定版本 `npm run test:live` 实际退出 **0**：**42 passed (2.1m)，3 skipped，0 failed**。3项为配置明确排除的两项file://离线及一项本地完整Chrome BFCache；本地45项已覆盖。[线上原始日志](../build/homepage-anime-release/npm-test-live.log)、[结果](../build/homepage-anime-release/npm-test-live-result.json) 记录27输入与四产物全程未变。日志SHA为 `ceb5a1adcfdb4d313768dc349a319d9f9d5e94e4c445637fa711623e23e5e4a5`。

线上截图：[1440首页](../build/homepage-anime-release/live-home-1440x900.png)、[390首页](../build/homepage-anime-release/live-home-390x844.png)、[320首页](../build/homepage-anime-release/live-home-320x568.png)、[首章停止态](../build/homepage-anime-release/live-chapter-stopped-390x844.png)。Lead已实际打开当前线上手机截图。公开核验和线上套件结束后，源码/测试/构建写权正式交回Engineer进入B阶段；本记录中的快照是此次已发布版本，不随后续开发产物变化。

## 第一轮范围与分工（历史记录）

- 首页展示《论语》20 篇，只有已完成的学而首章提供阅读入口；其余篇目保留真实不可用状态。
- 首页 `/` 与首章 `/learn/xue-er/1/` 双向导航，保留单文件首章与离线首页入口。
- 停止取消自动朗读与延迟动作，立即进入点击互动；暂停继续冻结与恢复。
- 修复手机阅读布局，保留既有经文、拼音、音频、角色互动及减少动态效果。
- 使用 Herdr `default` 的现有 `lunyu-design`、`lunyu-engineer`、`lunyu-review`；不新增成员或调整终端布局与焦点。

设计依据：[动画首页设计](design/homepage.md)。构图采用四动物围坐与相接书页，手机优先露出首章入口；正文、拼音和图标独立排版，不整体缩放。Designer 已实际打开六个视口的首页、停止态及三张滚动截图，D1–D3 的画面修正通过，见 [设计复核](design/homepage-review.md)。

| 成员 | 唯一写入范围 | 本轮任务 |
| --- | --- | --- |
| lunyu-lead | `README.md`、本文件 | 协调、依赖准备、实际证据核验与交付说明 |
| lunyu-design | `docs/design/` | 首页与响应式设计、最终截图审看 |
| lunyu-engineer | `src/`、`scripts/`、`tests/` | 首页、导航、停止、布局、测试与截图 |
| lunyu-review | `docs/reviews/` | 可运行版本的独立代码与浏览器审查 |

`PRODUCT.md`、`docs/full-book-plan.md`、`AGENTS.md`、`docs/architecture.md` 与 `docs/roadmap.md` 由主会话维护，本团队只读。生成的 `public/`、`dist/` 与测试输出由构建/测试命令产生，不手动修改。既有媒体和锁文件保持不变。

## 环境与依赖

- Herdr 客户端/服务端：0.9.5，协议兼容；使用实际 CLI 的 `agent prompt`，不执行旧插件初始化。
- 初始未安装本地开发依赖。Lead 单独负责按现有锁文件安装 `@playwright/test` 与 `wrangler`，用途是浏览器测试和部署 dry-run；不引入运行时依赖。
- 发生代理或锁定版本故障时按 `npm-locked-recovery` 恢复原始包，保留 lockfile。
- 浏览器使用既有缓存 `CHROME_PATH=/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`，不下载浏览器。

锁文件 SHA-256：`e36f510eda4ecb392a9cbd9ce4eb55639ce4ea819b09ccbeb0aa95467bb3e4d0`。49 个受版本控制的媒体文件按路径及内容组成的 SHA-256：`80a5ad9002475adad448f4391651ae209c84cf172f182c41f2de44e730f1dda3`。Lead 交付前重新计算，两者均与初始记录一致；`assets/`、`package.json`、`package-lock.json`、`wrangler.jsonc` 相对基线无差异。

### 本次依赖恢复

Node `v26.12.1`、npm `11.20.0`、macOS arm64。首次正常 `npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` 因配置代理缺少 `semver@7.8.6` 的 tarball 返回 E404；对同版本元数据的单次诊断也返回 E404。官方 registry 与 npmmirror 的有界连接尝试返回 `ENOTCONN`。

清点锁文件后，本机平台相关包共 41 份，其中 38 份从既有内容缓存读取并按锁文件 SRI 校验；缺失的 `semver@7.8.6`、`@emnapi/runtime@1.11.3`、`tslib@2.9.1` 从公开 Huawei npm 镜像取得原始 tarball，均通过锁文件 SHA-512 和包内 name/version 校验。私有任务缓存与凭据无关的恢复记录保留在：

`/var/folders/2b/lh8bsh0j7bg1r8bc2k98n3bm0000gn/T/lunyu-storybook-npm-20261103-ojjmhwro/`

`verified-artifacts.json` 记录来源、原包路径与摘要；随后使用正常 `npm cache add` 填充私有缓存。此来源仅用于本次恢复，不更改全局 npm 配置。

在私有缓存、`npm_config_offline=true`、`npm_config_registry=https://registry.npmjs.org/` 环境下，正常 `npm ci --no-audit --no-fund` 成功，39 个已安装包均匹配锁定版本，无必需包缺失，lockfile 摘要不变。其余是未使用的可选分支或其他平台包。`sharp` 安装脚本、`esbuild` 和 `workerd` 的 postinstall 均以 0 退出，未跳过脚本；二进制自检分别返回 `0.27.3` 和 `workerd 2026-04-26`。npm 的 allowScripts 提示是尚未记录允许清单，日志确认本次脚本实际已执行成功；未为此修改根配置。

## 实现与文件

| 文件 | 交付行为 |
| --- | --- |
| `src/home.html`、`src/home.css`、`src/home.js`、`src/catalog.json` | 20 篇目录、现有四动物构图及短迎宾动作；只有首章有链接，其他 19 篇显示不可用图标与可访问状态；首页不加载章节音频。 |
| `src/index.html`、`src/styles.css`、`src/app.js` | 返回、暂停、停止三个图标控件；停止统一取消旧流程后自由点读；手机重排、滚动时保留控件；排除暂停时间的有效时钟；历史返回恢复互动。 |
| `scripts/build.mjs` | 线上实体 `/learn/xue-er/1/`；离线索引和自包含首章分别构建，保留原来的 15 段内嵌音频。 |
| `tests/homepage.spec.js`、`cancellation.spec.js`、`responsive.spec.js`、`lifecycle.spec.js` | 目录、导航、停止、首次手势、快速点击、六视口、暂停间隔及真实 BFCache 回归。 |
| `tests/helpers.js`、`smoke.spec.js`、`single-file.spec.js` | 原有用例适配实体首章路径，保留朗读/点读/暂停检查并增加离线索引来回。 |
| `README.md`、本文件 | 运行入口、交付边界、实际验证与未覆盖事项。 |

Lead 对照 `cf21414` 核对 `SENT` 与 `SOLO`：三句原文、全部拼音、领读/跟读/动物音频映射保持原样，包括 `yuè`、`lè`、`yùn`。本次没有新增或改写媒体、运行时依赖和部署配置。

## 冻结版本

工程交接后停止源码、测试与构建写入。Lead 逐文件核验 [构建指纹](../tests/artifacts/round1/build-fingerprint.json)，再运行一次 `check:deploy`；检查结束后四个产物及 27 个输入文件均未改变。

| 产物 | 字节 | SHA-256 |
| --- | ---: | --- |
| `public/index.html` | 15,795 | `0f66016708052036855c415f2eb47dd280bf0ed0e31d990a7a34c8d376e3669c` |
| `public/learn/xue-er/1/index.html` | 564,226 | `6c50d7627405b26fa63eaf4fa8854f7ed13f981662d555a164b712fbfa791e94` |
| `dist/index.html` | 280,936 | `1366ae8429aad94473c89b053a96b6c26b0c69dc3c7c5733743f43a61bc9f9a0` |
| `dist/index-single.html` | 829,361 | `d874353f248751574262cfc28f31094c03de6d92a4254f450b3af9bc528db0a0` |

`src/`、`scripts/`、`tests/` 中 27 个受控或未忽略输入的汇总 SHA-256 为 `6bee5af9ec89479fe0933af96c6fb6e04d4cec3e6348eb20aae6afcba957cc7e`。算法：按相对路径排序，每行是文件 SHA-256、两个空格、相对路径和 LF，再对所有行取 SHA-256；排除生成的 `tests/artifacts/`。逐文件摘要见指纹 JSON。

Lead 独立确认首页 CSS/JS、首章 CSS/JS（包括原音频与 timings 替换）与实际 HTML 一致。首轮 `9cf9e107…`、中途 `189e70c7…` 仅用于追溯，不能作为最终通过版本。

## 检查结果

### 完整测试与构建

工程执行 `npm test`，真实退出码 **0**，**38 passed (2.5m)，0 failed，0 skipped**；它依次执行 `npm run build`、`npm run build:single` 和 Playwright。采用上文私有 npm 缓存和已有 `CHROME_PATH`，没有重装依赖或下载浏览器。

[原始 CLI 日志](../tests/artifacts/round1/npm-test.log) 来自同一次 exec session `75871` 返回的原始片段，终块 `1289d4`，没有为了留日志重新运行。日志 SHA-256：`7d4a6ba6a9b4969a05c7346ce197a4d740b9d3be1d2f3fbc500c5ee4ae4a293a`。Lead 已读取整份日志，逐项核对 38 条通过记录、日志摘要、输入和产物摘要；`test-results/.last-run.json` 为 `passed`、失败列表为空。按收尾约定接收本次结果，不重复同一快照完整套件。

覆盖内容：

- 20 篇顺序与名称、唯一真实首章入口、禁用 JS 的目录、首页无音频/预取；深链与刷新成功，未知章节为 404。
- 十个自动阶段和暂停态均能停止，立即进入 free；旧音频、焦点、气泡与回调不复活，早停不补星星；之后仍可点角色和句子。
- 未按 ▶ 的首次自由点击，在可信事件的角色监听器中同步解锁同一 Audio，随后实际播放；连续点击保持单 Audio 并取消旧动作。
- 12 秒合成单调时钟间隔分别覆盖音频、fallback、模拟 visibility，以及 900ms 独读等待；恢复后不跳读。测试对话框另验证真实渲染回调暂停后的恢复。
- 完整 Chrome 的 title、title-voice、e1 三个阶段真实 BFCache：可信 `pageshow.persisted=true`、同一 docId/Audio、返回 free、无旧声；随后可点读。没有用普通 reload 或合成 pageshow 代替。
- 六视口的角色逐个 bounds、热区不重叠、字号下限、64px 控件、滚动后的完整可见与中心点击命中；reduced-motion 动态切换在 350ms 上限内取消位移动画。
- 既有领读、跟读、四角色与叫声、暂停恢复、无脚本/资源错误，以及离线索引/独立首章的 file:// 来回。

初次未通过的测试中，首次点击探针改为在 bubble 阶段清理事件、在实际 `currentTarget` 上证明同步手势；reduced-motion 用短上限轮询等待异步 change；BFCache 使用真实 history 返回并验证 pageshow/document identity。这些修正保留了原有验收断言。sticky 则修复了 BODY 错误成为滚动参照的真实布局问题。

### 部署 dry-run

Lead 在 `/Users/mengxionghan/workspace/lunyu-storybook` 执行：

```sh
env npm_config_cache=/var/folders/2b/lh8bsh0j7bg1r8bc2k98n3bm0000gn/T/lunyu-storybook-npm-20261103-ojjmhwro/cache npm_config_offline=true npm_config_registry=https://registry.npmjs.org/ WRANGLER_SEND_METRICS=false npm run check:deploy
```

退出码 **0**。原始输出要点（exec session `4460`，输出块 `062c88`，退出块 `b05a8a`）：

```text
> npm run build && wrangler deploy --dry-run
public/index.html 15 KB
public/learn/xue-er/1/index.html 551 KB
wrangler 4.86.0
Read 17 files from the assets directory /Users/mengxionghan/workspace/lunyu-storybook/public
Total Upload: 0.31 KiB / gzip: 0.22 KiB
No bindings found.
--dry-run: exiting now.
```

这是配置与打包检查，没有上传或发布。`git diff --check` 通过，原 Worker 名及配置保留。此次构建之后，Lead 重新核对上述全部四产物和 27 个输入的 SHA，仍与工程通过套件的快照一致。

## 已有问题的修复证据

| 审查项 | 修复与证据 |
| --- | --- |
| R1：768/844 角色裁切 | 用 `minmax(0,…)` 与角色 `min-width:0` 消除网格最小内容宽度限制；六视口逐个角色实测均在页面内。 |
| R2：暂停后计时跳读 | `activeNow()` 统一扣除累计暂停时段，音频与等待共用；[音频间隔](../tests/artifacts/round1/paused-gap-audio.json)、[fallback](../tests/artifacts/round1/paused-gap-fallback.json)、[等待](../tests/artifacts/round1/paused-gap-solo-wait.json)、[渲染回调暂停](../tests/artifacts/round1/pause-clock-after.json)。 |
| R3：平板拼音过小 | 所查尺寸原文至少 24px、拼音至少 14px，1024 的拼音下限已提升为 14px。 |
| R4 / D1–D3：站位、地面、图标 | 兔狗轮廓分开并加深地毯；窄屏隐藏不适用的旧 floor/rug/cushion；返回控件采用深棕色。Designer 已逐张复核。 |
| 滚动时停止按钮移出视口 | HTML 保留纵向滚动，BODY 取消独立滚动参照；390 滚至末卡时停止钮 top=12、bottom=76，中心命中 `stopBtn`；六视口同类断言均通过。 |

主会话的 [独立最终专项](../build/home-audit-root/final-audit.json) 与本次四产物 SHA 一致：确认源码/产物匹配、返回焦点 `first-chapter`、sticky 点击命中及暂停恢复后 700ms 仍在 e1、音频推进约 0.653s。Lead 读取该证据，未重复其专项。

## 截图与正式审查

最终截图来自完整通过套件，见 [桌面首页](../tests/artifacts/round1/home-1440x900.png)、[平板首页](../tests/artifacts/round1/home-1024x768.png)、[手机首页](../tests/artifacts/round1/home-390x844.png)、[手机停止态](../tests/artifacts/round1/chapter-stopped-390x844.png)、[手机滚动态](../tests/artifacts/round1/chapter-scrolled-390x844.png)。另有 320×568、768×1024、844×390 及对应布局 JSON；当前六视口是 1440×900、1024×768、768×1024、390×844、320×568、844×390。

Designer 的 [最终设计复核](design/homepage-review.md) 已关闭 D1–D3、字号、角色裁切与滚动控件外观问题。Reviewer 的 [正式独立审查](reviews/homepage.md) 已判定本轮本地实现通过，R1–R4 全部关闭；[逐项核验记录](reviews/final-verification.json) 无指纹差异、无布局或计时复核失败。

Lead 已打开当前最终桌面、平板、手机首页及手机停止/滚动截图，完整读取两份正式结论与原始证据。Reviewer 在冻结产物上再次取得 [真实 BFCache 记录](reviews/final-6c50d762-bfcache.json)：同 docId/Audio、`pageshow.persisted=true`、返回 free 且停音，2 秒后无旧流程；随后小猫 c2 音频时间推进至 0.317425 秒。主会话已在浏览器打开预览并展示实际首页截图。

## 预览与未验证事项

- 在线本地入口：http://127.0.0.1:4173/ ；首章：http://127.0.0.1:4173/learn/xue-er/1/ 。Lead 在 dry-run 后请求两者均返回 200，响应 SHA 与冻结版一致；原有 4173 预览服务继续运行。
- 离线从 [dist/index.html](../dist/index.html) 打开，进入同目录 [index-single.html](../dist/index-single.html) 并可返回；独立首章自身包含图片、音频和脚本。目录与章节须一起保留才能来回导航。
- 尚未验证物理 iPhone/iPad/Android、Safari、真机触控、系统后台/锁屏恢复及人工听检。合成时钟间隔、模拟 visibility 和测试对话框的结果不能替代真实设备后台测试。
- 第一轮结束时没有commit、push、部署，没有调用TTS或生图，没有修改定稿媒体；当时线上仍为之前版本。第二轮真实发布结果见前文，后续整篇工作见逐章记录。
