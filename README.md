# 论语 · 学而时习之 —— 互动绘本

给小朋友的《论语·学而》第一章互动绘本（大象老师 + 小兔 / 小猫 / 小狗）。当前内容 = demo v6。

线上地址：__URL__

## 目录
- `public/` —— 部署出去的静态站（由 `build.py` 生成，别手改）
  - `index.html`（配音和叫声以 data URI 内嵌，原因见下）、`assets/img/*.webp`、`CREDITS.md`（动物叫声 CC0 来源）、`_headers`
- `src/` —— 源文件
  - `template.html`：页面模板（HTML + CSS + JS，占位符 `__CAT__`、`__AUDIO__` 等由 build.py 替换）
  - `img/`：角色图层 PNG（原创插画，无真人照片）
  - `audio/`：配音和动物叫声 mp3 + `timings.json`（逐字卡拉OK时间）
  - `CREDITS.md`：叫声来源与许可
  - `tools/`：重新生成音频的脚本（`tts-gen.py` Azure 配音，需环境变量 `AZURE_SPEECH_KEY`，不要把 key 写进仓库；`tts-process.py` 响度/齐读混音；`sfx-make.py` 叫声剪辑）。路径还是旧工作目录的，用前改一下。
  - `parts/`、`legacy/`：v6 之前拼模板用的分片和旧脚本，仅供参考
- `tests/check.py` —— 无头浏览器冒烟测试（点 ▶、等大象叫和第一句、点小狗；有 JS 报错或请求失败就退出 1）
- `dist/index-single.html` —— `python3 build.py --single` 生成的单文件版（双击即可离线打开，不提交）

## 改完重新构建
```bash
pip install pillow          # 只需要 Pillow
python3 build.py            # 生成 public/
python3 build.py --single   # 可选：生成单文件版 dist/index-single.html
```
本地预览：`cd public && python3 -m http.server 8000`，打开 http://localhost:8000
测试：`python3 tests/check.py http://localhost:8000/`（需要 playwright + Chrome）

## 部署到 Cloudflare（Workers 静态资源）
```bash
npx wrangler whoami         # 确认已登录（没登录就 npx wrangler login）
npm run deploy              # = python3 build.py && wrangler deploy
```
配置在 `wrangler.jsonc`（Worker 名 `lunyu-picturebook`，`assets.directory = ./public`，没有 Worker 代码）。

## 说明
- 音频用一个 `<audio>` 元素播放；第一次点 ▶ 时解锁（iPad Safari 需要用户手势）。
- 音频默认内嵌在 index.html 里：Cloudflare Workers 静态资源不支持 Range 请求（返回 200 不是 206），iOS Safari 直接播 mp3 地址可能失败。`python3 build.py --audio-files` 可改成独立 mp3（页面先 fetch 成 blob 再播），在 iPad 上验证过再用。
- 页面上的文字只有标题、三句原文+拼音、“我们再来一遍吧”和动物叫声；开始按钮只有 ▶。
- 动物叫声都是 CC0，见 `CREDITS.md`。
