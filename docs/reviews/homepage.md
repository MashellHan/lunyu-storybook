# 首页与首章独立审查 · 最终结论

Reviewer：lunyu-review，2026-11-03。

**冻结 `6c50d762` 版本独立复核通过，R1–R4 均已通过修复复核，无未解决阻断。** 本结论覆盖 20 篇目录与学而首章。

证据：[独立核验](final-verification.json)、[真实 BFCache](final-6c50d762-bfcache.json)、[38 项通过测试日志](../../tests/artifacts/npm-test.log)、[构建与部署 dry-run 记录](../homepage-build.md)。真机触控、后台/锁屏/挂起恢复及人工听检仍未验证；完整边界见文末。

唯一目标是 `/Users/mengxionghan/workspace/lunyu-storybook`，基线为 `cf214146043158bd74817d0002f4b34f06e40d65`。本 Reviewer 只写 `docs/reviews/`；未改实现或媒体，未运行 npm test、构建、安装、下载或部署。缺陷与交接经官方 Herdr 发给 lunyu-lead。

## 冻结版本与证据核验

已逐文件重新计算并核对 27 个输入、4 个产物、7 张工程截图；全部匹配 [工程指纹](../../tests/artifacts/build-fingerprint.json)。27 个输入的汇总 SHA-256：`6bee5af9ec89479fe0933af96c6fb6e04d4cec3e6348eb20aae6afcba957cc7e`。

| 产物 | 字节 | SHA-256 |
| --- | ---: | --- |
| `public/index.html` | 15,795 | `0f66016708052036855c415f2eb47dd280bf0ed0e31d990a7a34c8d376e3669c` |
| `public/learn/xue-er/1/index.html` | 564,226 | `6c50d7627405b26fa63eaf4fa8854f7ed13f981662d555a164b712fbfa791e94` |
| `dist/index.html` | 280,936 | `1366ae8429aad94473c89b053a96b6c26b0c69dc3c7c5733743f43a61bc9f9a0` |
| `dist/index-single.html` | 829,361 | `d874353f248751574262cfc28f31094c03de6d92a4254f450b3af9bc528db0a0` |

[独立核验总记录](final-verification.json) 保存输入集合、逐项比对、日志计数、控件测量与最终 BFCache 结果。文件名含 `candidate-6c50d762` 的独立证据，其检查前后源码和产物 SHA 均与本次冻结版本一致，直接复用，没有重跑同快照专项。首轮 `9cf9e107…` 与中途 `189e70c7…` 仅保留追溯，不作为最终通过版本。

## R1–R4 修复复核

| 项目 | 原缺陷与位置 | 最终证据与结论 |
| --- | --- | --- |
| R1 · 原 P1 | 768/844 宽时，小狗 x=698、width=180、右界=878，被裁切。`src/styles.css:216` 的网格最小内容宽度及 `:217` 的角色约束。 | 网格改为 `minmax(0,…)` 并限制角色最小宽度；768 时小狗右界约 739.984，844 时约 815.984，均完整落在视口内。六视口逐个角色及热区实测通过。**关闭。** |
| R2 · 原 P1 | `wait()` / `playClip()` 将暂停期间的大 `performance.now()` 间隔计入等待、wall/fallback，导致提前进入 u1。位置：`src/app.js:41`、`:64`、`:283`。 | `activeNow()` 统一排除暂停时间。正常播放、fallback、900ms 等待及普通暂停恢复均通过独立复核；见下方具体数据。**关闭。** |
| R3 · 原 P2 | 1024 宽旧产物拼音为 13.312px，低于 14px。位置：`src/styles.css:223`。 | 新产物为 14px；六视口原文均 ≥24px、拼音均 ≥14px，没有整体缩小舞台。**关闭。** |
| R4 · 原 P2 | 首页兔脚贴狗头；手机旧 cushion/rug/floor 错位、返回图标为浏览器蓝色。位置：`src/home.css:17`、`:21`；`src/styles.css:213`、`:254`、`:295`。 | 实际打开同快照桌面/平板/手机截图：兔狗轮廓分开；窄屏旧地面装饰隐藏，局部影子保留；返回图标为深棕。**关闭。** |

完整的旧版复现步骤、影响及最小修复建议保存在 [首轮报告](homepage-round1.md)。此次只复核上述问题及最终交接证据，不新增产品范围。

### R1 / R3：逐角色、字号与滚动控件

[独立布局记录](candidate-6c50d762-layout.json) 覆盖 1440×900、1024×768、768×1024、844×390、390×844、320×568。以下均为 DOM 实测 CSS px，坐标取文档顶部，不由截图推断。

| 视口 | 大象 x/y/w/h | 小兔 x/y/w/h | 小猫 x/y/w/h | 小狗 x/y/w/h | 原文/拼音 |
| --- | --- | --- | --- | --- | --- |
| 320×568 | 16 / 142 / 139 / 201 | 173.5 / 159 / 122 / 184 | 27.5 / 367 / 116 / 178 | 170.5 / 355 / 128 / 190 | 24 / 14 |
| 390×844 | 28 / 144 / 150 / 212 | 219 / 158 / 136 / 198 | 40 / 382 / 126 / 188 | 217 / 368 / 140 / 202 | 26 / 15 |

六视口的四角色均在页面宽度内，角色之间、控制之间及初始角色/控制之间没有热区重叠。旧 ID 的 left/bottom 偏移确实被 `#cast .char` 覆盖成 auto。三个控制均为 64×64；逐个滚入视口后的中心命中对应按钮。

滚到最后一句后，六视口的返回/暂停/停止都完整可见，中心命中正确。390/320 的停止控件 top=12、bottom=76；844 横屏为 top=8、bottom=72。`body` 错误成为 sticky 滚动参照的问题已修复。首页首章入口底缘在 320/390 分别约 508.30/534.30，均低于 600px。

已实际查看同快照的 [768 首章](candidate-6c50d762-chapter-stopped-768x1024.png)、[844 横屏首章](candidate-6c50d762-chapter-stopped-844x390.png)、[320 首章](candidate-6c50d762-chapter-stopped-320x568.png)，以及工程最终 [390 滚动图](../../tests/artifacts/chapter-scrolled-390x844.png)、[320 滚动图](../../tests/artifacts/chapter-scrolled-320x568.png)、[844 横屏滚动图](../../tests/artifacts/chapter-scrolled-844x390.png)。截图与测量分别核对。

### R2：暂停时间排除与音频推进

采用 [ready-clock-gap 独立记录](candidate-6c50d762-ready-clock-gap.json)，其前后首章 SHA 都是本次冻结值：

- **真实播放分支：**先等 e1 的 `audio.currentTime > 0.15`，再在暂停/继续的同一个 JS 任务内注入 12,000ms 单调时钟间隔；700ms 后仍在 e1、log 未进入 u1，音频从 0.254676s 正常推进至 0.917087s。
- **播放失败的 fallback：**明确注入 rejected `play()`；同样的 12,000ms 间隔后仍在 e1，没有提前结束替代计时。
- **900ms 独读等待：**暂停期间注入 4,000ms 间隔，恢复后 400ms 仍没有 b1；随后按正常剩余等待开始 b1。
- **普通暂停：**实际等待约 1.2 秒时，音频时间保持 0.038273s；继续后推进至 0.642147s，仍在 e1。

这些是明确标注的时钟间隔模拟/故障注入及普通暂停实测，不能冒充真机后台冻结。较早 `candidate-6c50d762-clock-gap.json` 的 media 探针未等待音频时间实际推进，因此正常播放分支以本段的 `ready-clock-gap` 记录为准。

同时核对工程 [audio](../../tests/artifacts/paused-gap-audio.json)、[fallback](../../tests/artifacts/paused-gap-fallback.json)、[模拟 visibility](../../tests/artifacts/paused-gap-visibility.json)、[独读等待](../../tests/artifacts/paused-gap-solo-wait.json) 和 [测试对话框暂停渲染回调](../../tests/artifacts/pause-clock-after.json)；方法与边界标注清楚，均与通过的最终套件对应。

### R4：最终画面

实际逐张打开过工程首轮三张指定截图，随后用冻结版本的 [桌面首页](candidate-6c50d762-home-1440x900.png)、[1024 平板首页](candidate-6c50d762-home-1024x768.png)、[390 手机首页](candidate-6c50d762-home-390x844.png)、[390 停止态](candidate-6c50d762-chapter-stopped-390x844.png) 复核。原有兔狗贴叠、手机黄色坐垫穿头、悬浮旧地毯与正文区地板的问题已消除，图标颜色一致，定稿角色图未改动。

## 冻结版本的真实 BFCache

Reviewer 使用本机已有完整 Chrome for Testing，`headless:true`、`ignoreDefaultArgs:['--disable-back-forward-cache']`，从自动 e1 朗读离开到首页，再执行真实会话历史返回。

[最终 BFCache 记录](final-6c50d762-bfcache.json) 的前后首章 SHA 与冻结版一致，结果为：`pageshow.persisted=true`、同一 docId、同一 Audio；返回后 free、音频停止，2 秒后 log/状态没有旧流程继续；随后点猫播放 c2，音频时间推进至 0.317425s。`notRestored=[]`，无页面或控制台错误。没有使用合成 pageshow 或普通 reload 代替。

工程 [bfcache.json](../../tests/artifacts/bfcache.json) 另覆盖 title、title-voice、e1 三阶段，均记录可信 pageshow、同 docId/Audio 与自由互动；对应完整套件真实通过条目。

历史诊断保留且不计作成功：headless shell 的 [round1-bfcache](round1-bfcache.json) 明确未触发；[round1-freeze](round1-freeze.json) 中 CDP 命令没有真正冻结页面；第一次完整 Chrome 尝试等待 load 超时，不能据此判产品失败或 BFCache 通过。正式结论只采用上面的最终真实 BFCache 记录。

## 回归、构建与资源证据

已读取完整 [npm-test.log](../../tests/artifacts/npm-test.log)，重新计数 38 条通过记录，并核验其 SHA-256 为 `7d4a6ba6a9b4969a05c7346ce197a4d740b9d3be1d2f3fbc500c5ee4ae4a293a`；工程执行 `npm test` 的退出码为 0，38 passed (2.5m)、0 failed、0 skipped；`test-results/.last-run.json` 为 passed、失败列表为空。该命令已包含在线和离线构建。Reviewer 没有重跑套件。

Lead 唯一一次 `npm run check:deploy` 退出 0：Wrangler 4.86.0，17 files，No bindings found，`--dry-run: exiting now`。执行命令、原始输出要点及 exec 标识见 [实施记录](../homepage-build.md)；Reviewer 读取并核对其前后源码/产物指纹，没有执行发布或 dry-run。

最终证据覆盖：

- 20 篇名称/顺序、唯一真实首章入口、19 篇不可用、无假链接；首页 15,795 字节、0 章节音频、无章节预取，禁用 JS 仍可导航。
- 首页 → 实体首章 → `/#xue-er`、深链刷新、file:// 索引与独立首章来回；返回焦点为 `first-chapter`，正常路径无控制台错误/404，未知章节为真实 404。
- 十个自动阶段和暂停态停止，立即 free、停音、清字幕焦点/气泡/旧等待/回调；不补未完成星星，停止后可点读，首次手势复用同一 Audio，快速连点不叠音。
- 原有领读、跟读、四角色/三句点读、暂停及 reduced-motion 回归；运行中切换减弱动态仍有状态反馈并及时停止位移动画。
- 原文、拼音和音频映射保持原样，包括 yuè/lè/yùn；独立解码最终 HTML 的 15 段音频，与对应 `assets/audio/*.mp3` 逐一字节相同。`assets/`、package.json、lockfile、wrangler.jsonc 相对基线无差异，无新运行时依赖/CDN。

首轮独立停止矩阵与点读记录仍可追溯于 [round1-stops](round1-stops.json)，中途键盘/合成触摸见 [round1-access](round1-access.json)；它们不替代最终套件和本次冻结版本专项。

## 本次独立复核命令

以下命令实际运行时的 workdir 均为 `/Users/mengxionghan/workspace/lunyu-storybook`，使用现有 4173 服务；结果已核验，无需重复运行。

```sh
CHROME_PATH=/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell REVIEW_ROUND=candidate-6c50d762 node docs/reviews/review-layout.mjs
CHROME_PATH=/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell REVIEW_ROUND=candidate-6c50d762-ready node docs/reviews/review-clock-gap.mjs
CHROME_PATH='/Users/mengxionghan/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' REVIEW_ROUND=final-6c50d762 node docs/reviews/review-lifecycle.mjs bfcache
```

已完整读取任务指定文档和官方 Herdr 技能；代码按 Ponytail 最小完整原则审查，界面采用 Impeccable audit/adapt 中适用的实际尺寸、焦点、动效、资源与响应式规则。未初始化插件或下载检测引擎，未新增风格问卷或代理。

## 未验证边界

未实测物理 iPhone/iPad/Android、Safari、真机触摸、系统后台/锁屏与挂起恢复；时钟模拟、对话框暂停和 Chromium BFCache 都不替代这些验证。没有进行人工亲耳听检、儿童/家长试玩、屏幕阅读器实操或真实浏览器 200% 文字缩放，不替用户声称通过。

本轮没有 commit、push、部署、TTS 或生图。既有 `http://127.0.0.1:4173/` 预览保持运行。
