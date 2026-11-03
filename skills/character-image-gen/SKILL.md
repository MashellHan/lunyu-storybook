---
name: character-image-gen
description: >-
  需要新画或修改绘本角色插画（新动物、换颜色、换姿势）时使用。用 GitHub Copilot CLI 的
  image_generation 工具在 Mac 上出图，先定风格锚点再画其他角色。
---
# 角色插画生成（Copilot CLI 图像生成）

## 前提
- 一台登录了 GitHub Copilot CLI 的 Mac，账号所在的 Copilot 套餐**支持图像生成**。每张图大约消耗 1 次 premium request（不是免费的，先确认额度/负责人同意）。
- 找 CLI：`which copilot`；没有的话 Copilot 应用自带一份：`ls ~/Library/Caches/github-copilot-sdk/cli/*/copilot`，取最新版本。也可以用本目录的 `gen.sh`（会自动找）。
- 没登录就让人自己运行 `copilot login`，代理不要替人走登录流程。
- **绝不把真实儿童（或任何真人）照片作为附件或参考。**

## 步骤
1. **先画风格锚点**：第一个角色（本项目是大象）用 `docs/prompts/00-style-and-elephant.md` 里的“统一风格前缀 + 角色描述 + 通用限制”。多出几张（c1/c2/c3），人工选定一张作为锚点。
2. **其他角色带锚点图**：每个新角色 = 同一风格前缀 + 自己的角色段 + 通用限制，并 `--attachment` 锚点图（只能和 `-p` 一起用）。
   ```bash
   ./skills/character-image-gen/gen.sh docs/prompts/bunny.txt out/bunny-c1.png out/elephant.png
   ```
3. **修改已有角色**（例如只换毛色）：附件 = 锚点图 + 当前定稿；提示词写清“以 X 为基础，只改 Y，其他一律不变”，见 `docs/prompts/dog-c2-recolor.txt`。
4. **核对**：
   - `file out.png; sips -g pixelWidth -g pixelHeight out.png`：应是 PNG，通常 **1254×1254 RGBA，透明背景**，约 1 MB。
   - 文件没出现时去 `~/.copilot/session-state/<sessionId>/images/` 找（工具先存那里，再由代理复制）。
   - 打开看图：脸、爪子数量、耳朵、尾巴是否完整、有没有文字/水印。
5. **入库**：选定的图以无损 WebP 存到 `assets/source/characters/<名字>.webp`（Pillow：`lossless=True, exact=True`，否则透明像素下的 RGB 会被改掉、后续切层对不上），提示词存到 `docs/prompts/`。然后走 [layered-character-animation](../layered-character-animation/SKILL.md)。

## 踩过的坑
- **代理会改写提示词，或者干脆用代码画图。** 提示词末尾一定加：“必须实际调用图像生成工具（image_generation）；不要用代码、脚本或 SVG 画图，也不要用代码给原图改色；尽量原样使用上面的描述；完成后说明实际传给工具的参数。”（`gen.sh` 已自动追加。）
- **颜色撞车**：第一版小狗是奶油黄 + 焦糖耳朵，和橘色小猫太像，孩子分不清。之后在提示词里写明“和橘黄色小猫明显区分”，小狗改成奶咖/巧克力棕（dog-c2）。新角色先把四个摆在一起看（lineup），再定稿。
- 风格要求写“透明背景，如不支持就纯白”；即使透明，脚下常有一块浅色地面/阴影，需要 `scripts/image/clean.py` 清掉。
- 每张图约 40–50 秒。不要一口气批量出几十张，先 1–3 张确认方向。
- 角色动作要为动画留余地：提示词里写“眼睛、嘴、耳朵、尾巴轮廓清楚，便于做眨眼/说话/摆尾”，四肢不要互相遮挡。
