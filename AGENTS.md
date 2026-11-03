# AGENTS.md — 给 AI 代理和新成员的约定

## 项目一句话
《论语·学而》第一章儿童互动绘本。纯静态页，Node 构建，Cloudflare Workers 静态资源部署。先读 README.md 和 docs/architecture.md。

## 常用命令
- `npm run build` / `npm run build:single` / `npm run serve` / `npm test` / `npm run check:deploy`
- 改了 `src/` 或 `assets/` 后必须 `npm test` 通过再提交。

## 必须遵守（DON'T）
- **不要用任何真实儿童（或真人）照片**，包括参考图、测试截图、提交到仓库的任何文件。角色只用 `assets/source/characters/` 里的原创插画。
- **动物叫声只用 CC0**（公有领域）素材；新增时在 `assets/CREDITS.md` 写明标题、作者、URL、许可、截取片段，并把源文件放进 `assets/source/sfx/`。不接受 CC-BY / CC-BY-NC / 来源不明的素材。
- **不要在未获批准时调用付费 API**（Azure Speech、任何图像/语音生成付费服务等）。`scripts/tts/gen.py` 会产生费用，跑之前先问项目负责人；尽量少量、按需（`gen.py <key>` 只渲染指定句）。
- **不要提交或打印密钥**。`AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` 只从环境变量读（见 `.env.example`，`.env` 已被忽略）；检查是否设置用 `[ -n "$AZURE_SPEECH_KEY" ]`，不要 echo。
- 不要手改 `public/`、`dist/`（构建产物）。
- 不要往页面上加新的文字/说明/按钮文案：屏幕上只允许标题、三句原文 + 拼音、「我们再来一遍吧」、动物叫声；开始按钮只有 ▶。
- 不要改动已定稿的配音（小猫、小狗沿用 v5）和叫声音量关系（叫声比人声低约 5 dB），除非负责人明确要求。
- 不要引入运行时依赖、框架或 CDN；页面必须能单文件离线打开。
- 部署（`wrangler deploy`）、推送、创建公开仓库前先确认。

## 应该做（DO）
- 动画遵守 docs/animation.md：只动 transform/opacity；每次点击一个焦点动作；每个关键帧都要有 reduced-motion 兜底；暂停键要能冻结音频、时间线和动画。
- 新句子/新角色：先在 `scripts/tts/config.py` 里加，多音字按 docs/polyphones.md 处理，再跑 `gen.py`（需批准）→ `process.py`。
- 新插画：按 docs/asset-pipeline.md 的提示词风格生成，放进 `assets/source/characters/`，用 `scripts/image/` 切层，产出放 `assets/img/`。
- 二进制文件单个 < 5 MB；源素材能截取就截取（参考兔子叫声 FLAC 片段）。
- 改测试钩子（`#book[data-step]`、`window.__log`、`window.__demo`）时同步更新 `tests/`。
- 提交信息用英文祈使句；作者沿用 `Mengxiong Han <mxhan@outlook.com>`（除非另有安排）。
