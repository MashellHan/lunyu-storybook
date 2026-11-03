# 图片流水线

```
docs/prompts/*  ──(GitHub Copilot CLI image_generation)──>  assets/source/characters/{elephant,bunny,cat,dog}.webp
   ──scripts/image/clean.py──>        build/image/*-clean.png      去掉脚下的浅色地面/阴影
   ──scripts/image/layers_dog.py──>   build/image/dog-{tail,body,head}.png   小狗切成尾巴/身体/头三层
   ──scripts/image/layers_bunny.py──> build/image/bunny-{ear,base}.png, elephant-640.png, cat-640.png
   ──scripts/image/export.py──>       assets/img/*.webp（640px，WebP q90）+ icon.png（180px，奶油底）
```

运行（需要 Python + `scripts/requirements.txt` 里的 numpy/scipy/Pillow）：
```bash
cd scripts/image && python3 clean.py && python3 layers_dog.py && python3 layers_bunny.py && python3 export.py
```
已验证：从仓库里的原图重跑，`assets/img/` 的 8 个文件与线上版本**逐字节一致**。检查图（`dog-comp.jpg`、`dog-layers.jpg`、`bunny-flop.jpg` 等）在 `build/image/`。

## 生成插画（Copilot）
- 工具：GitHub Copilot CLI 的 `image_generation`（在 Mac 上运行；Grok Bot 有 `copilot-image-gen` 技能）。不使用其他付费图像 API。
- 提示词：`docs/prompts/00-style-and-elephant.md`（统一风格前缀 + 大象 + 通用限制）、`bunny.txt`、`cat.txt`、`dog-c1.txt`。小兔/小猫/小狗把大象定稿图作为风格参考附件。
- 小狗定稿是 `dog-c2`：在 dog-c1 基础上只改毛色（`dog-c2-recolor.txt`，附件为大象定稿 + dog-c1）。
- 原图以**无损 WebP（exact，像素与原 PNG 完全一致）**保存在 `assets/source/characters/`，约 0.7–0.8 MB/张。
- 规则：只用原创插画；**不使用任何真实儿童照片**做参考或素材；不要模仿已有知名动画角色。

## 注意
- `clean.py` 的阈值、`layers_*.py` 里的多边形坐标都是按这几张图手调的（源图 1254×1254 像素坐标）。换图必须重新调，并看 `build/image/` 的检查图。
- `clean.py` 的第二遍（更严格）只对小狗做。
- 图层在页面里的拼装位置、旋转支点写在 `src/styles.css`（`#dog .tail/.head`、`#bunny .ear`）。
