---
name: layered-character-animation
description: >-
  要让一张静态角色插画“活起来”（眨眼、说话张嘴、摆尾、跳跃/翻跟头等大动作）时使用。
  讲用 PIL 把整图切成身体/头/尾巴图层、补缝、清白色地面阴影，用 SVG/CSS 叠加嘴和眼皮，
  以及本项目的动作词表、时长、缓动和减少动态效果的规则。
---
# 分层角色动画

## 1. 切图（Python + Pillow + numpy + scipy）
脚本在 `scripts/image/`（`pip install -r scripts/requirements.txt`），中间产物写到 `build/image/`：
```bash
python3 scripts/image/clean.py        # 去掉脚下浅色地面/阴影 -> build/image/<who>-clean.png
python3 scripts/image/layers_dog.py   # 小狗：tail / body / head 三层 + dog-comp.jpg 对比图
python3 scripts/image/layers_bunny.py # 小兔：耳朵单独一层
python3 scripts/image/export.py       # 导出 assets/img/*.webp
```
- **清阴影**（`clean.py`）：在角色下方约 22% 的带状区域里，找“低饱和 + 很亮”且与全透明区连通的像素，置透明；再把边缘一圈偏白的像素去掉。小狗还要第二遍更严格的 `pass2`。阈值是对这四张图手调的，换图要重新看 `build/image/*.png`。
- **切层**：多边形顶点是在 1254 px 原图坐标里**手工量的**（如尾巴多边形、头部按每一列的切线、抬起的爪子排除区）。换了原图就必须重量，不能复用。
- **补缝**：头/尾转动时下面会露出透明洞。在身体层后面先画一个从附近取色的毛色椭圆（高斯模糊 6 px），只在头部腐蚀后的区域内显示，再把身体层叠上去；尾巴根部同样补一个小圆。
- **锚点**：脚本最后打印眼睛、嘴、尾巴旋转中心、脖子的位置（按宽高比例），写进 CSS 的 `transform-origin` 和叠加层位置。
- 检查：打开 `build/image/dog-comp.jpg`（重新合成 vs 原图）——两者应看不出差别。
- 导出无损 WebP 时用 `exact=True`，否则透明区的颜色被改写，边缘会出现白边。

## 2. 叠加层（src/index.html、src/styles.css、src/app.js）
- **嘴**：一个小 SVG（深色口腔 + 粉色舌头 + 上唇线）放在嘴的位置，平时 `opacity:0; scaleY(0)`；说话时 WAAPI 循环 `scaleY .12→1→.35→.85→.12`，420 ms 一圈。
- **眼皮**：每只眼一个圆形 `overflow:hidden` 的 `.lid`，`::before` 用毛色填充 + 下沿深色线，`.shut` 时 70 ms 滑下、110 ms 后收回；偶尔连眨两次。其他角色用整体轻微 `scale(1.03,.94)` 220 ms 代替。
- 说话时整个角色层轻轻点头摇摆（大象 1100 ms、孩子约 600 ms 一圈），停止时 `cancel()`。

## 3. 动作词表与时间
| 用途 | 动作 | 时长 |
|---|---|---|
| 每个角色的“大动作”（点它时） | 大象：抬鼻子吹号；小兔：bigHop 大跳；小猫：spin 原地转圈；小狗：flip 蹲→起跳→空中 360° 后空翻→落地压扁→回弹 | 1.0–1.3 s，伴随地面影子缩放 |
| 待机 | 呼吸、耳朵抖、尾巴摆 | 循环 ≤4 s 或 ≥8 s（避免 4–8 s 的“看得出在循环”区间；耳朵抖 5.5 s 是已知例外） |
| 眨眼 | 随机间隔 2.6–6.4 s | 220 ms |
| 界面 | 按钮、星星、粒子 | `--dur-micro` 120 / `--dur-short` 220 / `--dur-long` 420 ms |

- 缓动：出场/大动作 `cubic-bezier(0.16,1,0.3,1)`（EASE_OUT），往复动作 `cubic-bezier(0.65,0,0.35,1)`。
- 关键帧里写 squash & stretch（起跳前压扁、落地压扁再回弹），旋转中心放在脚底（跳、转）或身体中心（翻跟头）。
- **只动 `transform` 和 `opacity`**，用 Web Animations API，便于暂停（`getAnimations().forEach(a=>a.pause())`）和取消。
- 每次点击只有一个焦点动作；同一角色正在动时（`.busy`）不叠加新动作。
- **减少动态效果**（`prefers-reduced-motion: reduce`）：所有位移/旋转换成只改透明度的版本，嘴巴固定半张，不眨眼；暂停键必须同时冻结音频、时间线和动画。

## 4. 参考规范
动画和交互遵循本机已安装的第三方设计技能 **impeccable**（animate、delight 两部分）和 **hallmark**（craft、microinteractions、playful 几部分）。这里不复制它们的内容；用之前请读原文。项目里的落地结论在 `docs/animation.md`。

## 验证
`npm test`（Playwright 会点开每个角色并检查日志）；改动作后再用 Playwright 截图逐帧看一遍，并在手机上真机看一次。
