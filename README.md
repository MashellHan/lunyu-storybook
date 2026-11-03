# 动画书 · Lunyu Storybook

**论语 · 学而时习之** —— 互动绘本

给 3 岁左右小朋友的《论语·学而》第一章互动绘本：大象老师领读，小兔、小猫、小狗跟读，读完可以自由点角色玩。
纯静态页面（无框架、无 CDN），部署在 Cloudflare Workers 静态资源上。当前内容 = demo v6。

- 线上：https://lunyu-picturebook.mxhan.workers.dev（Cloudflare Worker 仍叫 `lunyu-picturebook`，地址不变；GitHub 仓库为 [MashellHan/lunyu-storybook](https://github.com/MashellHan/lunyu-storybook)）
- 页面上的文字只有：标题「论语 之 学而时习之」、三句原文 + 拼音、「我们再来一遍吧」、动物叫声；开始按钮只有 ▶。

## 快速开始
```bash
npm install                        # 本地 devDependencies：wrangler、@playwright/test
npm run build                      # src/ + assets/ -> public/（只需要 Node ≥ 20）
npm run serve                      # http://127.0.0.1:4173 （或 npm run dev 用 wrangler dev）
```
单文件版（双击即可离线打开）：`npm run build:single` → `dist/index-single.html`

## 测试
```bash
npx playwright install chromium    # 首次；有系统 Chrome（/usr/bin/google-chrome 或 macOS 的 Google Chrome）则可省略，也可设 CHROME_PATH
npm test                           # 构建（站点 + 单文件）+ 本地起服务 + 7 个 Playwright 用例
npm run test:live                  # 同一套用例跑线上地址（单文件用例跳过）
```
覆盖：无 JS 报错加载、标题 → ▶ → 大象叫 → 领读 → 齐读、自由模式点四个角色、资源全部 200、暂停键、减弱动态（reduced motion）、单文件版 file:// 离线打开。

## 部署
```bash
npx wrangler whoami                # 确认已登录 Cloudflare（未登录：npx wrangler login）
npm run check:deploy               # 构建 + wrangler deploy --dry-run
npm run deploy                     # 构建 + 测试 + wrangler deploy
```
配置见 `wrangler.jsonc`（Worker 名 `lunyu-picturebook`，`assets.directory = ./public`，没有 Worker 代码）。

## 目录
```
src/            页面源码：index.html（结构）、styles.css、app.js（剧本/状态机/动画）、_headers
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
