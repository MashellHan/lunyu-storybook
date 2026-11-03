# 动画规范

依据 impeccable（`animate.md`、`delight.md`）与 hallmark（`craft.md` §5、`microinteractions.md`、`genres/playful.md`）。改动画前对照本页。

## 核心理念
- 主题：**“小伙伴们和你一起学”**。庆祝的幅度和孩子付出的努力成正比（读完三句才全体庆祝、亮星）。
- **没有点击就没有声音**（标题配音只在浏览器允许时自动播放，否则等第一下点击）。
- 每次点击只有一个焦点动作（one focal moment per tap），动作依次发生，不同时抢戏。

## 时长与缓动
| 类型 | 时长 | 用在 |
|---|---|---|
| 反馈 feedback | 120–150 ms（`--dur-micro: 120ms`） | 按钮按下、卡片 |
| 状态 state | 150–300 ms（`--dur-short: 220ms`） | 星星填色、气泡、高亮 |
| 焦点 focal | 500–800 ms（`--dur-long: 420ms` 起） | 标题字母、▶ 出现 |
| 角色大动作（刻意偏离，见下） | 1.0–1.3 s | 小兔大跳、小猫转圈、小狗翻跟头、大象扬鼻 |

- 退场时长约为进场的 65%。
- 缓动：进场 `cubic-bezier(0.16,1,0.3,1)`（`EASE_OUT`）；退场用 ease-in 曲线。**永远不用浏览器默认 `ease`**。
- 只动 `transform` / `opacity`；序列动画用 WAAPI（`element.animate`），便于打断和暂停。
- 弹簧/回弹只用于声明过的角色时刻（标题字母、角色大动作）。

## 循环与暂停
- 待机循环（idle）≤ 4 s 或 ≥ 8 s，幅度很小；页面隐藏时暂停。
- 有可见的暂停控件（hallmark gate 18）：⏸ 冻结音频、剧本时间线和所有动画。
- 偶尔眨眼：2.6–6.4 s 随机间隔，220 ms。

## 交互细节
- 按钮按下下沉 1–2 px；焦点环（focus ring）不做动画（gate 15）。
- 成功是“安静的”：用星星表示（gate 16），不弹窗、不出字。

## 减弱动态（prefers-reduced-motion）
- 每个关键帧都有 reduced-motion 兜底（gate 27）：只保留透明度/颜色/状态反馈，取消位移、旋转、缩放和待机循环。
- `src/styles.css` 两处 `@media (prefers-reduced-motion: reduce)`；`src/app.js` 里每个 `animate()` 都检查 `reduce.matches`。
- 测试 `reduced motion` 用例会断言：剧本照常推进，且没有带 transform 的动画在运行。

## 刻意偏离（已记录）
hallmark playful 只允许主 CTA + 一个角色时刻用弹簧，impeccable 把焦点动作放在 500–800 ms；
但对 3 岁孩子，负责人要求动作更大，所以：每个动物保留一个 1.0–1.3 s 的角色大动作，标题字母用弹簧（开场是唯一的“英雄时刻”）。
这些时刻始终依次发生、从不用于 UI 状态，待机动画保持克制。

## 当前代码与规范不一致处（待清理）
- 按下下沉：卡片 2–3 px、▶ 开始键 5 px（规范 1–2 px；▶ 是给孩子的大按钮，可考虑保留并记为偏离）。
- 小兔耳朵待机 `earTwitch` 周期 5.5 s，落在 4–8 s 的禁区；尾巴摇 0.9 s、▶ 光圈 1.8–2 s 属于短循环，符合规则。
