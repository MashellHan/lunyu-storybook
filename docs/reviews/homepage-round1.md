# 首页与首章独立审查

Reviewer：lunyu-review。日期：2026-11-03。唯一目标：`/Users/mengxionghan/workspace/lunyu-storybook`；基线/HEAD 为 `cf214146043158bd74817d0002f4b34f06e40d65`。

**当前结论：首轮产物待修复复核，不能判通过。** 工程仍在修改；最终源码、构建产物、统一 test/build/dry-run 证据尚未冻结。以下是独立取得的实际证据，不能替代最终同一版本的复测。

本审查只写 `docs/reviews/`；未修改实现、素材、锁文件或其他文档，未运行 npm test、构建、安装、下载、部署或生成服务。通过官方 Herdr 向 lunyu-lead 汇报，不指挥其他成员。

## 已读依据与方法

已完整读取 AGENTS.md、README.md、PRODUCT.md、docs/architecture.md、docs/animation.md、docs/homepage-brief.md、docs/full-book-plan.md、docs/design/homepage.md、skills/herdr-team/SKILL.md 及官方 Herdr SKILL.md。代码审查采用 Ponytail 的最小完整原则；界面采用 Impeccable audit/adapt 中适用的实际尺寸、键盘、动效、资源与响应式检查。未初始化插件或下载 Impeccable 引擎，直接使用现有产品和设计文档。

浏览器访问现有 `http://127.0.0.1:4173/`，没有启动或替换工程服务。首轮布局/交互用已安装 Chromium headless shell；真实 BFCache 使用 Lead 提供的已缓存完整 Chrome for Testing，均为 `headless:true`。证据记录浏览器版本、时间、源码和产物 SHA。

首轮首章 HTML SHA-256：`9cf9e107a3628c9358787a06533e7f767fad27211bd55e423c0a9293dfd94221`；首页 SHA-256：`639e5cfd952e0c420e57194902d831c000c21837e46e8ccbdeff3334ef360f9d`。该首章产物与后来已改动的 CSS 并非完全一致，所有旧产物问题须在工程正式更新后复核。

## 发现与最小修复建议

### R1 · P1：中间断点角色被裁切

位置：`src/styles.css` 的 `.cast` 网格（首轮约 214、250 行）与角色固定宽度；初轮产物见 [768×1024](round1-chapter-stopped-768x1024.png)、[844×390](round1-chapter-stopped-844x390.png)。

复现：以 768×1024 或 844×390 打开 `/learn/xue-er/1/`，按 ■；读取四角色 `getBoundingClientRect()`。依次为大象 x=28/w=320、小兔 x=358/w=170、小猫 x=538/w=150、小狗 x=698/w=180。小狗右界 878，超出 768/844 视口，`#book` 裁掉角色；768 宽时小狗中心也在视口之外。整页没有横向滚动不能证明角色完整。

旧 ID 的 left/bottom 偏移已被 `#cast .char` 覆盖成 auto，问题仍来自网格轨道的最小内容宽度。建议使中间断点轨道可收缩（如合适的 `minmax(0, …)`），同时限制每个角色实际宽度；以四个角色逐个 bounds 和点击命中复测，不用只断言 `#book` 在屏幕内。

证据：[round1-layout.json](round1-layout.json)；命令：`node docs/reviews/review-layout.mjs`。已通过 Herdr 报告 Lead。

### R2 · P1：暂停期间的大时钟间隔提前消耗等待和音频兜底时间

位置：`src/app.js` 的 `wait()`（首轮约 60–66 行）与 `playClip()` 的 `last/wall/fbT`（约 282、291–295 行）。

复现：在 e1 初段，同一个 JS 任务内将 `performance.now` 包装为 `realNow()+gap`，调用暂停按钮处理器，令 gap=12000，再调用继续处理器；700ms 后首轮产物已进入 u1，e1 未正常读完。对播放失败注入 rejected `play()` 的 fallback 计时，同样提前推进；小兔独读前 900ms 的等待，注入暂停期间 4000ms 间隔后，400ms 内就开始 b1。

这是**时钟间隔模拟/故障注入**，不是后台或真机冻结实测。它明确暴露恢复时把整个间隔计入 `wall/fallback/wait` 的错误；普通 1.2 秒暂停恢复则保持 e1 和当前音频时间，不能用普通暂停通过覆盖此问题。

建议统一排除暂停期间经过的时间，覆盖音频真实播放、fallback 与普通等待，不改音频本身。修复后复测同一模拟及普通暂停恢复，再看工程回归测试的实际证据。

证据：[round1-clock-gap.json](round1-clock-gap.json)，另与主会话 `build/home-audit-root/pause-gap-check.json` 一致；命令：`node docs/reviews/review-clock-gap.mjs`。已报告 Lead。

### R3 · P2：1024 宽旧产物拼音低于约定下限

位置：旧产物 `.card rt { font-size:clamp(12px,1.3vw,15px) }`；源码对应 `.card rt` 已观察到改为最小 14px，尚待正式构建复测。

复现：1024×768 首章停止态，`getComputedStyle(rt).fontSize` 为 13.312px，低于 14px。320/390 的独立断点分别达到 14/15px。建议保持已做的下限修复，确认新产物在所有断点均满足原文至少 24px、拼音至少 14px。

证据：[round1-layout.json](round1-layout.json)、[1024×768](round1-chapter-stopped-1024x768.png)。

### R4 · P2：角色站位与场景地面不一致

已真正逐张打开工程 `tests/artifacts/home-desktop.png`、`home-mobile.png`、`chapter-stopped-mobile.png`。首页兔脚紧贴小狗头顶；手机首章旧 cushion 出现在大象头后，rug 浮在两排之间，floor 到正文区域才出现。Lead/主会话已转工程修复，非本审查新扩展范围。

位置：`src/home.css` 四动物相对站位；`src/styles.css` 手机 `.cushion/.rug/.floor/.wall`。建议按实际脚底调整或简化装饰，保留定稿插画。蓝色返回图标也在最终画面中复核。修复需查看新截图，不能用源文件改动代替画面结果。

## 初轮已通过的检查

### 目录、资源、导航与内容

- 20 篇名称、顺序正确：学而、为政、八佾、里仁、公冶长、雍也、述而、泰伯、子罕、乡党、先进、颜渊、子路、宪问、卫灵公、季氏、阳货、微子、子张、尧曰。
- 只有首章一个真实链接；19 篇使用不可用图标及可访问名称「尚未开放」，没有假链接、按钮或多余 Tab 停靠点。
- 首页为 15,708 字节，内嵌章节音频为 0，无 audio 标签、预加载/预取或章节请求；首章内嵌 15 段旧音频。
- `/` → `/learn/xue-er/1/` → `/#xue-er`、首章直接访问和刷新均成功；返回焦点落在 `first-chapter`。未知篇章返回真实 404，没有落入首章。
- `file://` 索引 → 独立首章 → 索引锚点可用；独立首章直接打开可见 ▶，停止后点猫实测播放 c2、currentTime 推进；无外网请求。
- 首页禁用 JS 后仍有 20 篇及真实首章链接。正常路径未见页面 JS、控制台或资源 404 错误。
- 原文与拼音映射保留，包括说/yuè、乐/lè、愠/yùn；未擅补/改 demo 原文。`git diff cf21414 -- assets package-lock.json package.json wrangler.jsonc` 为空，定稿媒体、锁文件与运行时依赖边界未变。

证据：[round1-layout.json](round1-layout.json)。

### 手机逐角色与控件测量

下列为 CSS px，坐标取文档顶部；来自 DOM 实测，不由截图推断。

| 视口 | 大象 x/y/w/h | 小兔 x/y/w/h | 小猫 x/y/w/h | 小狗 x/y/w/h | 原文/拼音 |
| --- | --- | --- | --- | --- | --- |
| 320×568 | 16 / 142 / 140 / 202 | 174 / 160 / 122 / 184 | 28 / 356 / 116 / 178 | 171 / 344 / 128 / 190 | 24 / 14 |
| 390×844 | 28 / 144 / 150 / 212 | 219 / 158 / 136 / 198 | 40 / 370 / 126 / 188 | 217 / 356 / 140 / 202 | 26 / 15 |

两种手机宽度下角色、三个控制按钮之间均无热区重叠；返回/暂停/停止各 64×64。各按钮滚动进入视口后，其中心 `elementFromPoint()` 命中对应按钮。页面可纵向滚动，原文与拼音没有随整页缩放。768/844 的问题见 R1；1024 拼音见 R3。

### 停止、点读与减少动态效果

标题、标题语音、开场、领读 e1、跟读 u1、独读 solo-bunny、叫声 sound-dog、庆祝、暂停共 9 个场景均通过：立即 free、音频暂停、焦点/说话/气泡/临时粒子清理、角色与句子解除 inert；3 秒后无旧 log、状态或星星变化；之后点猫仍播放 c2。

为到达较晚阶段使用真实音频 `playbackRate=8`，没有伪造 ended；停止后点读恢复正常速率。sound-dog 停止保留 2 星，celebrate 保留已完成 3 星，早停不补亮星星。

从未按 ▶ 先停止再点猫，记录到点击中的首个 `play()`，后续 c2 仍使用同一个 Audio。快速「猫正在读 → 狗 → 猫 → 兔」只有最后一轮 b1 开始，没有多 Audio。四角色分别覆盖 b1/squeak、c2/meow、d3/woof、trumpet/e1/e2/e3；三句子分别覆盖 e1/u1、e2/u2、e3/u3。运行中切 reduced-motion，检查不到仍运行的 transform 动画。

证据：[round1-stops.json](round1-stops.json)；命令：`node docs/reviews/review-stops.mjs`。这验证播放调用与时序，不代表亲耳听检。

### 真实 BFCache 与冻结证据边界

完整 Chrome for Testing 以 `headless:true`、`ignoreDefaultArgs:['--disable-back-forward-cache']` 启动，自动 e1 朗读时离开至首页，再执行真实会话历史返回：`pageshow.persisted=true`、同一 docId、返回 free、音频已停止，2 秒后没有旧流程继续；随后点猫播放 c2，currentTime=0.352 秒。没有合成 pageshow，也没有以普通 reload 代替。

证据：[round1-fullchrome-history-bfcache.json](round1-fullchrome-history-bfcache.json)，`actualBFCache=true`、`notRestored=[]`。最终冻结产物仍须复测。

前两份诊断保留但**不作为成功证据**：

- [round1-bfcache.json](round1-bfcache.json)：headless shell `persisted=false`，原因包括 `BackForwardCacheDisabledForDelegate`；只证明普通历史恢复能互动。
- [round1-freeze.json](round1-freeze.json)：CDP frozen 命令返回，但没有 freeze/visibility 变化，12 秒内脚本仍正常推进；已标为环境诊断，不能证明真实冻结。
- `round1-fullchrome-bfcache.json` 是完整 Chrome 第一次尝试的诊断：等待 load 超时，不能据此判产品失败或 BFCache 通过。正式成功记录改为等待真实历史 URL 和 pageshow，见上面的 history 文件。

## 可复现命令

所有命令的工作目录均为 `/Users/mengxionghan/workspace/lunyu-storybook`，依赖现有 4173 服务；不包含安装、构建或测试套件启动。

```sh
CHROME_PATH=/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell REVIEW_ROUND=round1 node docs/reviews/review-layout.mjs
CHROME_PATH=/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell REVIEW_ROUND=round1 node docs/reviews/review-stops.mjs
CHROME_PATH=/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell REVIEW_ROUND=round1 node docs/reviews/review-clock-gap.mjs
CHROME_PATH='/Users/mengxionghan/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' REVIEW_ROUND=round1-fullchrome-history node docs/reviews/review-lifecycle.mjs bfcache
```

脚本及输出均只在 `docs/reviews/`。复跑时使用新的 REVIEW_ROUND 保留历史证据。

## 尚未验证与最终关卡

- 最终源码/产物冻结后的同版本修复复核，以及 Lead 统一 test/build/dry-run 的真实证据。
- iPhone/iPad Safari、Android 真机、物理触摸、真实锁屏和系统挂起恢复；时钟模拟不能替代这些验证。
- 人工亲耳听检、儿童/家长试玩、屏幕阅读器实操、真实浏览器 200% 文字缩放；本报告不代用户作主观通过声明。
- 不执行公开访问、部署、TTS、图片生成、commit 或 push。
