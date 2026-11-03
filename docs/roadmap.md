# 已知问题与路线图

## 已知问题 / 限制
- **未在真机 iPad Safari 上验证**（只做了桌面 Chrome 无头测试）。音频内嵌 + 单一 `<audio>` 的方案是为 iOS 设计的，但需要真机确认首次点击解锁、切后台暂停、静音键下的行为。
- index.html 约 540 KB（音频 base64 内嵌）。新增章节后会线性增长；届时考虑改用支持 Range 的存储（例如 R2 + Worker）或 fetch 成 blob 再播放。
- Workers 静态资源不支持 Range 请求，所以不能直接用 mp3 URL。
- 页面只覆盖学而第一章；文本、拼音、颜色写死在 `src/app.js` 的 `SENT`。
- 图片切层的阈值和多边形是手调的，换图需要重调（见 asset-pipeline.md）。
- 测试只跑 Chromium；没有视觉回归测试；代理无法听音频，音质靠人工听检。
- 没有 404 页面（`not_found_handling: "404-page"` 但未提供 404.html，返回默认 404）。

## 路线图（建议）
1. 真机 iPad / iPhone 测试，并把结果补进测试说明。
2. 内容数据化：把句子、拼音、颜色、片段表抽成 `content/*.json`，`config.py` 与 `app.js` 共用，方便加更多章节。
3. 多章节：章节选择页、按章节懒加载音频。
4. 测试：加 WebKit 项目、视觉快照（只用插画角色截图）、单文件版 `dist/index-single.html` 的 file:// 冒烟测试。
5. CI：GitHub Actions 跑 `npm test`；可选接入 Cloudflare Workers Builds 自动部署（构建命令 `npm run build`）。
6. 离线/PWA（Service Worker 缓存），适合平板反复使用。
