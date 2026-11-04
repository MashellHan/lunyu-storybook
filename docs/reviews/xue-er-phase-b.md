> 当前正式结论（2026-11-03）：[bbe55d8篇内目录增量复核通过](xue-er-phase-b-candidate.md)，[最终绑定证据](xue-er-phase-b-final.json) 已核对62项真实通过、48输入与6产物一致。完整16章仍非ready；下文保留早期快照历史。

# 《学而》阶段 B 早期只读审查

2026-11-03；lunyu-review。**现有静态产物的内容覆盖、分页、路径、道具引用及非ready隔离通过，未发现阻断本阶段交接的问题。** 新章发布验收仍待最终源码/产物冻结、工程测试及真实新媒体/听检证据。本轮未构建、未跑首页全套或旧播放器矩阵、未导入SDK或生成媒体。

正式证据：[汇总与完整产物指纹](xue-er-phase-b-early/summary.json)、[主检查原始记录](xue-er-phase-b-early/evidence.json)、[横屏尾两页补充](xue-er-phase-b-early/tail-evidence.json)、[实际bounds对账](xue-er-phase-b-early/geometry.json)。源码在检查结束后继续更新，变化及前后SHA记在汇总的 `codeUpdatesAfterBrowserProbe`；本结论绑定下列既有HTML快照。

| 绑定项 | SHA-256 |
| --- | --- |
| 内容 | `85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73` |
| 正式场景配置 | `13be8fad01ccda687f94222c0656b378e7a7ff8f9dc4d6d3380d57163b47ff4a` |
| 19份HTML产物指纹集合 | `3b29a0dbfa7679ccde2aec3ab0a2d22d4e8ae5fcc465be8f2ae62230444759d5` |
| HTTP篇内章目 | `b0e782677933ba77f93111f549f9e16e960e299dbe999f1f7d7bce76998bf9df` |
| 第15章静态预览 | `332857ceaaa2ebfa8c91edec34c8294624c1344b6fa172aba772b2227f6dc71b` |

通过范围：

- 16个预览文件内实际CHAPTER数据，以及浏览器渲染出的26页、72段、49组，与冻结稿逐码点一致；原文、拼音、20处引语标识及 `data-segment` / `data-source-index` 连续且无遗漏、重复或跨章拼接。首章静态预览确实补出“子曰”，生产仍保留独立的旧三句demo。
- 320×844与390×844逐页检查全部16章；1024×768、844×390检查第3章及第15章四页，共62个页面/视口组合。前后翻页顺序、首尾禁用状态、末页焦点转到可用翻页按钮均正确；第15章实测回到篇内章目对应锚点、重新进入及file深链刷新。
- 实际测得原文最低24px、拼音最低14px；四角色最小边长80px，控件及绑定道具不少于48px。页顶测量的角色、控件、绑定道具矩形无相互重叠、无横向溢出；横屏正文可纵向滚动阅读。全部x/y/宽高保存在证据中，未把截图代替测量，也未将页顶结果外推到任意滚动位置。
- 每页只生成当前 `visiblePropIds`，绑定的组、角色和完成动作引用与正式配置一致。预览道具为 `aria-hidden`、不接收指针且不进入Tab序列；角色、原文卡片、朗读入口均禁用。62次观察均为free、Audio无src且暂停、播放log为空、无待执行wait、无虚假完成星星。此项只验证静态隔离，实际点读/动作完成链等待新媒体。
- HTTP `/learn/xue-er/` 正常显示16项，仅旧首章为入口并标明现有三句；第2–16章没有生产链接，直接请求均返回预期404。16个file预览及篇内索引链接均存在；所有离线图片可解码，无CDN/外部请求、无浏览器错误。生产旧首章HTTP字节与本地一致、CHAPTER为null、保留15段旧音频；未对其播放器重跑专项。

浏览器使用既有完整Chrome、`headless:true`、`reducedMotion:'reduce'`，未改变用户焦点。工程的12张 [阶段B截图](../../tests/artifacts/xue-er-phase-b/) 已实际打开审看；本次另存7张截图，包括 [首章320完整原文](xue-er-phase-b-early/xue-er-01-p1-320x844.png)、[第15章第3页手机](xue-er-phase-b-early/xue-er-15-p3-320x844.png)、[横屏第3页阅读区域](xue-er-phase-b-early/xue-er-15-p3-844x390-reading.png) 与 [横屏第4页](xue-er-phase-b-early/xue-er-15-p4-844x390-reading.png)。

取证诊断：主检查在第15章第3页844×390的整页截图调用上超时，已完成的60组检查没有功能失败；原始 `needs-review` 状态保留。仅在新headless上下文补完最后两页并取得视口截图，补充记录退出0。此事按截图探针超时处理，不计为产品缺陷，也没有重跑前60组。

一个非阻断排版观察：旧静态预览在窄屏可能把标点单独换行，例如首章320首句逗号、工程第15章768第3页收引号。正文和拼音没有丢失。工程后续源码已加入 `word-unit` 的标点禁则处理（`src/app.js`、`src/chapter.css`），新产物尚待冻结后复核；本轮没有把源码修复直接写成画面已通过。

已只读看到媒体接入继续完善标题、批准请求/角色/复用来源、原文字位、实际时长及听检证据校验；内容校核依据已冻结证据，不附加用户逐章文字签字。真实新音频、HD实际发音、word boundary回映、齐读混音、正常动效下的音频/动作取消、人工听检和真机未验证。正式dist离线包尚未为B重建，本轮验证的是隔离的16章file预览。所有16章仍非ready，现有demo不代表完整首章或整篇完成。

复现入口（仅操作浏览器和写审查证据）：

```sh
cd /Users/mengxionghan/workspace/lunyu-storybook
node docs/reviews/review-xue-er-phase-b.mjs
node docs/reviews/review-xue-er-phase-b-tail.mjs
```

这些命令记录当时可用产物。等待工程交接最终冻结快照后，只复核受影响项，不扩展旧首页或播放器矩阵。
