---
name: herdr-team
description: >-
  想用 herdr 在本机起一个多代理团队（Lead / Designer / Engineer / Reviewer，按需加内容和媒体角色）
  继续开发这个绘本时使用：怎么初始化、各角色管什么、交付前必须过哪些关卡。
---
# herdr 多代理团队

> 说明：v1–v6 实际是**一个代理**从头做到尾的；下面是把同样的分工和关卡整理成团队形式，供后续用 herdr 团队开发时使用。

## 准备
- herdr ≥ 0.8、Node ≥ 20、一个 herdr 支持的代理 CLI；为该代理装好官方 herdr skill：
  `npx skills add ogulcancelik/herdr --skill herdr -g -y`（全局安装，先征得机器主人同意）。
- 安装团队插件 `ligd.agent-team`：`herdr plugin install gdli6177/herdr-agent-team`。

## 初始化
```bash
cd <本仓库>
herdr                                             # 在仓库目录打开 herdr
herdr plugin action invoke ligd.agent-team.init   # 生成 .agents/team/playbook.md + roles/，并在 AGENTS.md 加一小段
herdr plugin action invoke ligd.agent-team.doctor # 检查环境
```
init 生成的是通用模板。把 `team-template/` 里的 playbook 和角色文件复制过去覆盖（内容已按本项目改好），提交进仓库：
```bash
cp -R skills/herdr-team/team-template/. .agents/team/
herdr plugin action invoke ligd.agent-team.start  # 启动或聚焦 Lead
```
用户只和 Lead 对话；Lead 决定何时启动哪些成员。

## 角色（roster）
| 角色 | 文件 | 负责 | 只写 |
|---|---|---|---|
| Lead | roles/leader.md | 理解需求、派活、验收、Git集成、PR和合并、对用户汇报 | docs/、.agents/、README.md；交接后的Git集成 |
| Designer | roles/designer.md | 画面布局、角色动作、交互节奏；按 impeccable / hallmark 设计技能做方案和审查清单 | docs/design/ |
| Engineer | roles/engineer.md | `src/`、`scripts/`、`tests/` 实现；保证 `npm test` 绿 | src/、scripts/、tests/ |
| Reviewer | roles/reviewer.md | 独立只读审查：读音、点击路径、动画、减少动态效果、回归 | docs/reviews/ |
| Content（按需） | roles/content.md | 原文、拼音、多音字核对，给 3 岁孩子的白话 | docs/content/ |
| Media（按需） | roles/media.md | 插画、配音、叫声，按本目录其他 skills 操作 | assets/、docs/prompts/ |

模型：Lead / Designer / Reviewer 用手头**推理最强**的模型；Engineer 用**速度快的编码模型**。具体写在各角色文件 front matter 的 `runtime` / `model`（Lead 的 `runtime` 必须是 herdr 支持的代理类型，模板默认 `codex`），按自己的环境改；模型费用记在运行它的机器所配置的账号上。

## 交付关卡（Lead 验收前全部要过）
1. `npm test` 全绿（构建 + 单文件 + Playwright）。
2. 有界面变化：Playwright 截图（平板横屏 + 手机竖屏）由 Designer/Reviewer 看过。
3. 有音频变化：**必须有人亲耳听过**（读音、语速、叫声音量），除非负责人明确授权适用范围的例外。代理不能替人听，没听就写“未试听”；现有固定16章的发布授权不能延伸到未来新媒体。
4. 不出现真实儿童或真人照片，也不把它们作为生图参考。
5. 已获授权的操作直接推进。大雄已要求现有仓库完成功能即commit、push、PR、独立review后merge，现有Cloudflare站点也已有持续发布授权；不要重复询问。新增付费调用、全局安装、创建公开仓库或新发布目标等超出既有授权的动作，由Lead先问。
6. 不打印、不提交密钥。

## 完成即提交

遵守项目 [代码交付流程](../../docs/source-control-workflow.md)。Lead默认独占Git index/分支写操作，成员交回通过检查的逻辑完整功能后及时commit、push并创建或更新PR，不等全书结束再提交。Reviewer核对实际PR head并记录结论；有修改则重新核对受影响范围。无阻断问题且必需checks满足后，Lead合并并同步本地main，向用户报告链接与结果。同账号不能批准自己的PR时，明确记录独立代理的审查comment，不伪造GitHub批准，也不绕过分支保护。

## 相关技能
[character-image-gen](../character-image-gen/SKILL.md) · [layered-character-animation](../layered-character-animation/SKILL.md) · [azure-tts-voices](../azure-tts-voices/SKILL.md) · [animal-sfx-sourcing](../animal-sfx-sourcing/SKILL.md) · [cloudflare-deploy](../cloudflare-deploy/SKILL.md)
