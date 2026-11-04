# AGENTS.md — 给 AI 代理和新成员的约定

## 项目一句话
《论语》儿童互动绘本：20 篇动漫目录，《学而》16章已按负责人“直接全部部署”的指示上线，真人听检另行补充。纯静态页，Node 构建，Cloudflare Workers 静态资源部署。先读 README.md、docs/architecture.md 和 [本次发布授权](docs/xue-er-release-authorization.md)。

## 技能（怎么做）
做插画、动画、配音、叫声、部署、多代理团队时，先读 [skills/](skills/README.md) 里对应的 `SKILL.md`：
[character-image-gen](skills/character-image-gen/SKILL.md) · [layered-character-animation](skills/layered-character-animation/SKILL.md) · [azure-tts-voices](skills/azure-tts-voices/SKILL.md) · [animal-sfx-sourcing](skills/animal-sfx-sourcing/SKILL.md) · [cloudflare-deploy](skills/cloudflare-deploy/SKILL.md) · [herdr-team](skills/herdr-team/SKILL.md)

## 常用命令
- `npm run build` / `npm run build:single` / `npm run serve` / `npm test` / `npm run check:deploy`
- 改了 `src/` 或 `assets/` 后必须 `npm test` 通过再提交。

## 完成功能后的 Git 流程
- 大雄已于2026-11-04明确要求 lunyu team 主动 commit、发PR、review并merge，功能完成就提交，不把完成的代码留在本地。此授权持续适用于现有仓库 `MashellHan/lunyu-storybook`，无需逐次请求同类操作许可。
- 完成一个逻辑完整的功能并通过适用检查后，立即在功能分支提交、推送并创建或更新PR；Reviewer审查实际PR head，修复阻断问题后，由Lead合并并同步本地main。已有对应源码的有效测试可复用；新增代码变化需补充相应检查。
- 共享工作区同一时刻只有一位Git集成人员操作index、分支、commit和merge，默认由Lead负责；成员完成后及时交接。不绕过分支保护，不伪造审批，不将部署成功当作已提交到GitHub。
- 交付时报告PR链接、commit、审查和合并结果，并检查是否还有遗漏的已完成功能。具体约定见 [代码交付流程](docs/source-control-workflow.md)。

## npm 依赖恢复
- 代理缺少锁定包或安装失败时，使用机器上的 `npm-locked-recovery` 技能；保留 lockfile，核验原始包的 SRI，再执行正常安装和检查。
- 本项目恢复记录见 [首页实施记录](docs/homepage-build.md#本次依赖恢复)。临时缓存和本次镜像选择不作为永久配置。

## 必须遵守（DON'T）
- **不要用任何真实儿童（或真人）照片**，包括参考图、测试截图、提交到仓库的任何文件。角色只用 `assets/source/characters/` 里的原创插画。
- **动物叫声只用 CC0**（公有领域）素材；新增时在 `assets/CREDITS.md` 写明标题、作者、URL、许可、截取片段，并把源文件放进 `assets/source/sfx/`。不接受 CC-BY / CC-BY-NC / 来源不明的素材。
- **不要在未获批准时调用付费 API**（Azure Speech、任何图像/语音生成付费服务等）。`scripts/tts/gen.py` 会产生费用，跑之前先问项目负责人；尽量少量、按需（`gen.py <key>` 只渲染指定句）。
- **不要提交或打印密钥**。`AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` 只从环境变量读（见 `.env.example`，`.env` 已被忽略）；检查是否设置用 `[ -n "$AZURE_SPEECH_KEY" ]`，不要 echo。
- 不要手改 `public/`、`dist/`（构建产物）。
- 页面文字限标题、目录篇名与章目、当前章原文 + 拼音、对应段落的简明释义及必要字词注解、「我们再来一遍吧」、动物叫声。负责人已明确要求“每段加上注解”；不要增加无关讲解、营销文案或文字控制按钮，开始按钮只有 ▶，其他控制也用图标并提供可访问名称。
- 不要改动已定稿的配音（小猫、小狗沿用 v5）和叫声音量关系（叫声比人声低约 5 dB），除非负责人明确要求。
- 不要引入运行时依赖、框架或 CDN；页面必须能单文件离线打开。
- 现有Cloudflare站点已获持续部署授权，现有GitHub仓库按上述Git流程执行；新增发布目标、创建公开仓库或超出既有授权的动作须先确认。

## 应该做（DO）
- 动画遵守 docs/animation.md：只动 transform/opacity；每次点击一个焦点动作；每个关键帧都要有 reduced-motion 兜底；暂停键要能冻结音频、时间线和动画。
- 逐段注解独立存放于 `docs/content/xue-er-annotations.json`，按原段ID关联；不要为新增或修正注解改写已校核的原文、拼音、配音或发布授权。注解需随在线、离线与无脚本正文显示。
- 新句子/新角色：先在 `scripts/tts/config.py` 里加，多音字按 docs/polyphones.md 处理，再跑 `gen.py`（需批准）→ `process.py`。
- 新插画：按 docs/asset-pipeline.md 的提示词风格生成，放进 `assets/source/characters/`，用 `scripts/image/` 切层，产出放 `assets/img/`。
- 二进制文件单个 < 5 MB；源素材能截取就截取（参考兔子叫声 FLAC 片段）。
- 改测试钩子（`#book[data-step]`、`window.__log`、`window.__demo`）时同步更新 `tests/`。
- 提交信息用英文祈使句；作者沿用 `Mengxiong Han <mxhan@outlook.com>`（除非另有安排）。
