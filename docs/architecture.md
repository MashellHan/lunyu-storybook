# 架构：场景流程、状态机与时间线

## 总览
- 一个 HTML 页面，无框架、无运行时依赖。源码拆成 `src/index.html`（结构）、`src/styles.css`、`src/app.js`。
- `scripts/build.mjs`（纯 Node）把 CSS/JS 内联进 HTML，并填占位符：
  - `__AUDIO__`：15 段音频，**以 data URI 内嵌**（原因见下）
  - `__TIMINGS__`：`assets/audio/timings.json` 中这 15 段的时长与逐字时间
  - `__ELEPHANT__ __CAT__ __BUNNY_EAR__ __BUNNY_BASE__ __DOG_TAIL__ __DOG_BODY__ __DOG_HEAD__ __ICON__`：图片地址（站点版为 `assets/img/*.webp`，单文件版为 data URI）
  - 留下未填的占位符会让构建失败。
- 产物：`public/`（index.html ≈ 540 KB + 8 张图 + CREDITS.md + _headers）或 `dist/index-single.html`（≈ 800 KB，双击离线可用）。

## 音频播放
- 全页只有一个 `<audio>` 元素（`au`），每段 `au.src = AUD[key]`。iOS Safari 只解锁“在用户手势里 play() 过”的那个元素，所以始终复用它。
- 第一次点 ▶ 时在手势内播放标题配音（若加载时已自动播过，则静音播一下来解锁）。
- **音频内嵌而不是独立 mp3**：Cloudflare Workers 静态资源不支持 Range 请求（返回 200 而非 206），iOS Safari 直接播 mp3 URL 可能失败。代价是 index.html 较大（≈ 540 KB，gzip/br 后传输）。
- `playClip(key, {kara, talkers, strict})`：播放并驱动卡拉 OK 高亮和“说话”动画；音频被拦截时退化为按 `timings.json` 的时长计时（`fallback`），且每段最多等 `dur + 2.5 s`，剧本永不卡死。

## 剧本 / 状态机
`#book` 的 `data-step` 记录当前状态（测试也靠它）：

```
title ──(加载后尝试自动播 title；被浏览器拦截则等第一下点击)──> title-voice
  └─ 点 ▶ ─> 标题淡出 ─> intro（四个角色依次弹一下）
        ─> trumpet（大象叫 ~2 s）
        ─> 每句 i=1..3：e{i}（大象领读）─ 350 ms ─> u{i}（小兔+小猫+小狗齐读）─ 650 ms
        ─> again（大象：“我们再来一遍吧”）
        ─> solo-bunny ─> sound-bunny（第 1 句 + 吱吱～，亮第 1 颗星）
        ─> solo-cat   ─> sound-cat  （第 2 句 + 喵～，第 2 颗星）
        ─> solo-dog   ─> sound-dog  （第 3 句 + 汪汪！+ 翻跟头，第 3 颗星）
        ─> celebrate（全体大动作 + 大象叫，等 2100 ms）
        ─> free
free（自由模式）：
  点大象 ─> trumpet ─> e1 ─> e2 ─> e3 ─> free
  点小兔/小猫/小狗 ─> solo-x ─> sound-x ─> free
  点句子卡 i ─> e{i} ─> u{i} ─> free
```

- 打断：每次新点击调用 `interrupt()`：`runId++`、停音频、收气泡。所有 `await` 之后都检查 `my !== runId`，旧流程自然退出。
- 非自由模式下点角色只做一个小摆动反馈，不打断剧本。
- 暂停键（⏸/▶，给大人用）：`setPaused` 暂停音频、`wait()`（只在未暂停时计时）、所有 WAAPI 动画和 CSS 动画；页面隐藏（切后台）时自动暂停。

## 时间线 / 卡拉 OK
- 底部三张句子卡就是字幕：原文 + 拼音，逐字高亮。
- 逐字时间来自 Azure 词边界（word boundary）：一个词的时长平均分给它包含的汉字（`scripts/tts/process.py` 的 `chartimes`）。齐读 u1–u3 用小兔的词边界 + 50 ms。
- 叫声（squeak/meow/woof/trumpet）在 timings.json 里只有 `dur`，没有字。

## 测试钩子
- `#book[data-step]`、`window.__log`（播过的 clip key + 时间）、`window.__demo`（`enterFree()`、`react()`、`audio` 等，仅供测试/截图）。
- 元素 id：`#startBtn #pauseBtn #elephant #bunny #cat #dog #cards #stars #title`。

## 构建产物为什么不提交
`public/` 与 `dist/` **不提交**，由 `npm run build` 生成：
1. 构建是确定的、零依赖（只要 Node），几十毫秒完成，提交产物没有收益；
2. 产物里内嵌了全部音频（≈ 540 KB base64），每次改一行 JS 都会产生大块二进制式 diff，仓库会迅速膨胀；
3. 避免“改了 src 忘了重新构建”导致源码和产物不一致；
4. `npm run deploy` 和 Cloudflare Workers Builds（如以后接 Git 自动部署，构建命令填 `npm run build`）都会先构建。
