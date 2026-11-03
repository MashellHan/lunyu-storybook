---
name: cloudflare-deploy
description: >-
  需要构建、检查或发布本绘本到 Cloudflare Workers（静态资源）时使用；也用于排查“手机上没声音”这类部署后问题。
  部署前必须得到负责人同意。
---
# 部署到 Cloudflare Workers

## 结构
- `wrangler.jsonc`：Worker 名 `lunyu-picturebook`，只托管静态资源（`public/`，由 `npm run build` 生成，不提交）。**不要改名**，改名等于新建一个站点。
- 线上：https://lunyu-picturebook.mxhan.workers.dev

## 命令
```bash
npm install               # 本地依赖（wrangler、playwright），不要全局安装
npm test                  # build + 单文件版 + Playwright，必须全绿
npm run check:deploy      # build + wrangler deploy --dry-run：不上传，只检查配置和打包
npm run deploy            # build + test + wrangler deploy（真正发布，先问）
npm run test:live         # 发布后对线上地址跑同一套测试
```
- wrangler 用 OAuth 登录，**只在负责人的开发 Mac 上登录过**。别的机器上不要替人跑 `wrangler login`；需要时请负责人自己登录，或在那台 Mac 上部署。
- CI/无人值守需要 API Token 的话，放环境变量 `CLOUDFLARE_API_TOKEN`，不要写进仓库。

## 踩过的坑：音频必须内联
- Workers 静态资源**不支持 HTTP Range 请求**。iOS Safari 播放 `<audio>` 时要用 Range 取 mp3，拿不到就直接不出声（桌面浏览器正常，很容易漏测）。
- 解决：构建时把所有 mp3 以 `data:` URI 内联进页面（`scripts/build.mjs`），页面只用**一个** Audio 元素（`new Audio()`），在第一次点击 ▶ 时解锁，之后换 `src` 播放各段。
- 所以页面体积约等于音频总大小；新增音频注意控制码率（24 kHz 单声道 64 kbps）。
- `src/_headers`（缓存、CREDITS.md 的 Content-Type）在构建时复制到 `public/`，一并部署。

## 发布后检查
- `npm run test:live` 通过；用 iPhone Safari 和一台安卓手机各点一遍，确认有声音、字幕跟得上、暂停有效。
