# 动画书 · Lunyu Storybook

**论语** —— 动画目录与儿童互动绘本

给 3 岁左右小朋友和陪伴家长使用。首页按《论语》20篇导航，点击「学而」进入完整16章目录，再选择具体章节；首页不再单独展示「学而时习之」首章入口。《学而》16章已上线，包含完整原文、拼音、真实配音和互动，72段原文均配有白话释义，共163条字词注解，跟随原有分页显示。其余篇目保留不可播放状态，不表示全书已经制作完成。本批媒体按大雄“直接全部部署”的 [固定授权](docs/xue-er-release-authorization.md) 发布，真人听检仍未确认。当前版本与验收见 [注解实施记录](docs/annotations-build.md)，首次16章发布见 [逐章实施记录](docs/xue-er-build.md)。
首章保留原三句 demo 的定稿音频，另补齐「子曰」前缀。大象老师领读，小兔、小猫、小狗跟读；可随时按 ■ 停止自动流程，立即点角色或句子互动。⏸ 则冻结音频、时间线和动画，随后继续。
纯静态页面（无框架、无运行时依赖、无 CDN）；线上按章加载，离线交付索引和各章自包含 HTML。

- 线上首页：https://lunyu-picturebook.mxhan.workers.dev（2026-11-03 15:20:55 UTC 已发布《学而》逐段注解；版本 `72de80fb-d111-41e1-959d-41fd77f592ca`，Worker 为 `lunyu-picturebook`，GitHub 仓库为 [MashellHan/lunyu-storybook](https://github.com/MashellHan/lunyu-storybook)）。
- 首页文字限标题、篇名、必要编号和真实章目。原 demo 保留既有标题、三句原文 + 拼音；章节按完整原文、逐字拼音及对应注解连续分页。阅读页沿用「我们再来一遍吧」及动物叫声，控制图标化，开始按钮只有 ▶。
- 当前交付见 [注解实施记录](docs/annotations-build.md)，章节和首页历次验证见 [学而实施记录](docs/xue-er-build.md) 与 [首页实施记录](docs/homepage-build.md)；后续扩展见 [全书方案](docs/full-book-plan.md)。

## 快速开始

构建需要 Node.js ≥ 20，以及 PATH 中可用的 `ffmpeg` 和 `ffprobe`。构建会校验音频可解码及时间轴与实测时长一致；浏览器页面本身没有这些运行时依赖。

```bash
npm ci                             # 按锁文件安装本地开发依赖：wrangler、@playwright/test
npm run build                      # src/ + assets/ -> public/，校验章节与媒体完整性
npm run serve                      # http://127.0.0.1:4173 （或 npm run dev 用 wrangler dev）
```
本地首页为 `http://127.0.0.1:4173/`，首章深链为 `http://127.0.0.1:4173/learn/xue-er/1/`，可直接打开或刷新。首页不内嵌或预取章节音频。

《学而》[线上篇内目录](https://lunyu-picturebook.mxhan.workers.dev/learn/xue-er/)与 [本地生产预览](http://127.0.0.1:4173/learn/xue-er/) 均开放完整16章。当前注解版已用实际Chromium核对16章、26页和72段的释义、词条、原文与拼音；线上16份章节HTTP响应精确匹配本地产物，见 [本地检查](build/xue-er-annotations/local-ui.json) 和 [线上检查](build/xue-er-annotations/live-ui.json)。缺配音、未通过技术校验或没有适用发布依据的其他章节仍不开放。

离线版：`npm run build:single` 生成 `dist/index.html`（全书索引）、`dist/xue-er.html`（篇内目录）、`dist/index-single.html`（完整第1章）及 `dist/xue-er-02.html` 至 `xue-er-16.html`。保留这些文件在同一目录，可从索引进入各章并返回；章节自身包含图片、音频、脚本，可单独离线阅读。当前16章依据本批固定授权进入离线包，默认听检门槛和全部技术校验仍保留。

全16章、26页的真实媒体本地预演：

```bash
node scripts/build.mjs --rehearsal  # 只输出 build/xue-er-rehearsal/，不改变生产目录
node scripts/serve.mjs --rehearsal  # 仅绑定 http://127.0.0.1:4175
```

打开 [16章预演目录](http://127.0.0.1:4175/xue-er.html)，可试 [第3章](http://127.0.0.1:4175/xue-er-03.html) 和 [第15章](http://127.0.0.1:4175/xue-er-15.html)。支持真实标题、领读、跟读、分页和点击互动；每章 HTML 自包含，也可从该目录离线打开。页面明确标注本地预演，预演目录与生产包分开；播放不算听检批准，当前16章的生产可用状态另由固定发布授权及技术校验决定。

静态开发预览仍可用 `node scripts/build.mjs --preview` 生成到 `build/xue-er-preview/`，用于原文、拼音与场景校核，保持无音频且读键禁用。`--preview` 与 `--rehearsal` 不可同时使用。

如代理缺少锁定包，按 [依赖恢复记录](docs/homepage-build.md#本次依赖恢复) 恢复原包，不改 lockfile 或升级依赖。

## 测试

```bash
npx playwright install chromium    # 首次；有系统 Chrome（/usr/bin/google-chrome 或 macOS 的 Google Chrome）则可省略，也可设 CHROME_PATH
npm test                           # 构建站点和离线包 + 本地服务 + Playwright 回归
npm run test:live                   # 线上限定套件；仅本地用例按配置跳过
```
当前注解版的完整 `npm test` 已通过 **73项，0失败、0跳过，exit0**，50份代码、配置及内容输入测试前后不变，见 [实际结果](build/xue-er-annotations/npm-test-result.json)。覆盖72段注解与分页对应、选取注解不触发朗读、无脚本和离线回退，以及按篇导航、朗读、跟读、四角色互动、暂停与停止取消、完整文字拼音、六视口布局与开场播放键、reduced-motion、真实媒体与词级双字高亮、固定授权边界。

部署后的 `npm run test:live` 实际 **30通过、0失败、43项仅本地用例按配置跳过，exit0**，见 [线上限定套件结果](build/xue-er-annotations/live-tests-result.json)。这不是73项在线全跑。独立浏览器另核验全部26页注解、实际点读、手机和平板开场播放键及无脚本回退，见 [线上页面记录](build/xue-er-annotations/live-ui.json)。16章首次完整发布和首页导航修复的结果保留为历史，见 [逐章实施记录](docs/xue-er-build.md) 和 [首页实施记录](docs/homepage-build.md)。

本机可用缓存 Chromium，运行测试时设置 `CHROME_PATH` 为已有浏览器的可执行文件路径即可，无需重复下载。

新配音采用 [隔离批次工具](docs/tts/xue-er-batch-interface.md)：`.venv/bin/python scripts/tts/batch.py` 默认只离线校验已审核清单，不调用 API。`.venv/bin/python -B scripts/tts/test_batch.py` 用临时目录、模拟 SDK 与本机 ffmpeg 验证流程；旧 v5、全局音频索引和已审核 SSML 保持原样。获准235条已全部合成成功，处理为290份候选音频，工具23项回归及独立媒体技术审查通过；实际账单尚未核对。

本机试听：[A批37条](http://127.0.0.1:4174/?batch=batch-a) · [B批253条](http://127.0.0.1:4174/?batch=batch-b)。可按章、角色筛选或顺序播放，服务仅绑定127.0.0.1。大雄此前延后试听，后又明确授权本批直接发布，见 [本人反馈与固定文件集合](docs/tts/xue-er-listening-status.md)；生成、自动播放和发布授权都不算真人听检。授权只适用固定16章及当前媒体，后续替换或新增媒体不能自动继承，无需重复生成本批录音。

## 部署

```bash
npx wrangler whoami                # 确认已登录 Cloudflare（未登录：npx wrangler login）
npm run check:deploy               # 构建 + wrangler deploy --dry-run
npm run deploy                     # 构建 + 测试 + wrangler deploy
```
配置见 `wrangler.jsonc`（Worker 名 `lunyu-picturebook`，`assets.directory = ./public`，没有 Worker 代码）。本轮发布复用完整测试通过的产物，Wrangler使用全局 `--env-file /dev/null` 避免读取Azure `.env`。[dry-run](build/xue-er-annotations/dry-run-result.json) 和 [实际部署](build/xue-er-annotations/deploy-result.json) 均exit0；上传16份带注解的章节HTML，版本为 `72de80fb-d111-41e1-959d-41fd77f592ca`，线上验收通过。首页、篇目录、原文、拼音、场景和媒体保持原字节；真人听检状态不变，未来新媒体不能继承本次例外。

## 目录
```
src/            home.html / home.css / home.js（首页）、catalog.json（篇目和可用入口）
                volume.html / volume.css（篇内目录）、chapter-media.json（媒体引用）
                index.html / styles.css / app.js（播放与动画）
                chapter-player.js / chapter.css（多章分页与场景）、_headers
assets/img/     上线用的角色图层（640px WebP）+ icon.png
assets/audio/   上线用的配音和叫声 mp3 + timings.json（逐字卡拉 OK 时间）
assets/source/  重新生成用的源素材：characters/（原始插画，无损 WebP）、sfx/（CC0 录音）、tts-raw/（Azure 原始输出 + 词边界）
assets/CREDITS.md  素材来源与许可（会被复制到线上 /CREDITS.md）
scripts/        build.mjs、serve.mjs；image/、tts/、sfx/ 三条素材流水线（Python，见 docs/）
tests/          Playwright 用例
skills/         可复用做法：生图、分层动画、Azure 配音、CC0 叫声、部署、herdr 团队（见 skills/README.md）
docs/           架构、角色与配音、多音字、动画规范、素材/音频流水线、许可、已知问题与路线图
```
`public/` 和 `dist/` 是构建产物，不提交（原因见 [docs/architecture.md](docs/architecture.md#构建产物为什么不提交)）。

## 文档
- [架构：场景流程 / 状态机 / 时间线](docs/architecture.md)
- [首页实施与验收](docs/homepage-build.md) · [首页设计](docs/design/homepage.md) · [全书方案](docs/full-book-plan.md)
- [逐段注解实施与验收](docs/annotations-build.md) · [注解来源与取义](docs/content/xue-er-annotations.md) · [Herdr内容与视觉复核](docs/reviews/xue-er-annotations.md)
- [角色与配音（Azure 声音和 SSML 参数）](docs/characters-and-voices.md) · [多音字处理](docs/polyphones.md)
- [动画规范（impeccable / hallmark）](docs/animation.md)
- [图片流水线（含 Copilot 生图）](docs/asset-pipeline.md) · [音频流水线](docs/audio-pipeline.md)
- [技能：我们是怎么做出来的（生图 / 动画 / 配音 / 叫声 / 部署 / herdr 团队）](skills/README.md)
- [素材来源与许可](docs/credits-and-licensing.md) · [已知问题与路线图](docs/roadmap.md)
- 给 AI 代理 / 新成员的约定：[AGENTS.md](AGENTS.md)

## 许可
- **代码**（`src/`、`scripts/`、`tests/`、配置文件）：[MIT](LICENSE)，© 2026 Mengxiong Han。
- **素材不是 MIT**，详见 [assets/LICENSE.md](assets/LICENSE.md)：
  - 角色插画（本项目生成）与提示词：保留所有权利（All rights reserved），除非另有说明；
  - 配音：Azure Speech 合成，受 Azure 服务条款约束，保留所有权利；
  - 动物叫声：CC0 1.0，逐个文件的出处见 [assets/CREDITS.md](assets/CREDITS.md)。
