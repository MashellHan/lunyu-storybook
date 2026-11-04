# 《学而》逐段注解实施与验收

按大雄“每段加上注解”的要求，已为现有《学而》16章的72段正文补充白话释义和163条字词解释，含20处引语标识。2026-11-03 15:20:55 UTC 已部署至 [线上站点](https://lunyu-picturebook.mxhan.workers.dev/learn/xue-er/)，Worker `lunyu-picturebook`，版本 `72de80fb-d111-41e1-959d-41fd77f592ca`；上一版为首页导航修复 `903cc7a4-73fd-49a6-8bf3-6796c829cc4d`。

## 内容与显示

Herdr Lead编写 [注解数据](content/xue-er-annotations.json) 和 [来源、取义说明](content/xue-er-annotations.md)，Engineer接入校验、播放器、无脚本与离线正文，Reviewer独立审校内容并实际查看手机、平板截图，Root统一构建、验证与发布。[限定复核](reviews/xue-er-annotations.md) 通过，无待修正问题。

注解按原段ID关联，默认显示在对应原文、拼音卡片下方，跟随原有26页、49个朗读组。释义采用18px文字与1.75行高；词条与释义保持次一级层次。注解在朗读按钮外，可选择文字，点击不触发声音。既有点读、领读、跟读、暂停、停止和动物互动保留。页面增高后，开场标题层改为顶部对齐，避免播放键被推到首屏下方。

注解JSON SHA-256为 `670174f9935729b5e9f20ba83a724663bb78e872070793fe46a5fb19133d2933`，绑定原文SHA `85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73`。注解校验检查版本、完整段集合、非空释义及词条属于相应原文，没有新增批准流程。原文、拼音、场景、媒体、既有发布授权及lockfile等1323份保护文件未变，见 [发布前核验](../build/xue-er-annotations/pre-deploy-integrity.json)。

## 验证

- 完整 `npm test` 于15:20:09 UTC实际exit0，**73通过、0失败、0跳过**；命令共234.078秒，50份源代码、配置和内容输入前后相同。[结果](../build/xue-er-annotations/npm-test-result.json) · [日志](../build/xue-er-annotations/npm-test.log)。
- [本地逐页浏览器检查](../build/xue-er-annotations/local-ui.json) 与 [线上逐页检查](../build/xue-er-annotations/live-ui.json) 均通过：16章、26页、72段的释义、词条、原文与拼音逐一一致，无页面错误、无横向溢出；注解点击静音、原文真实音频播放、开场播放键及无脚本正文通过，本地另核对离线无脚本正文。线上16份章节HTTP响应与待发布产物字节一致。
- [手机](../build/xue-er-annotations/local-chapter-1-page-1-390.png)、[长章手机](../build/xue-er-annotations/local-chapter-15-page-3-390.png)、[平板](../build/xue-er-annotations/local-chapter-15-page-3-1024.png) 及两张开场截图由Root和Reviewer实际查看，未见注解遮挡原文或控制区。六种视口的开场播放键与布局另由完整套件覆盖。
- Impeccable对改动的 `src/app.js`、`src/chapter.css` 检查exit0，返回空问题列表，见 [检测结果](../build/xue-er-annotations/impeccable-detect.json)。
- 发布后 `npm run test:live` 于15:22:01 UTC实际exit0，**30通过、0失败、43项仅本地用例按配置跳过**；不是73项在线全跑。[结果](../build/xue-er-annotations/live-tests-result.json) · [日志](../build/xue-er-annotations/live-tests.log)。

## 发布

沿用既有持续部署授权。[Wrangler dry-run](../build/xue-er-annotations/dry-run-result.json) 和 [实际部署](../build/xue-er-annotations/deploy-result.json) 均exit0，复用完整测试通过的产物，使用 `--env-file /dev/null`。本次仅上传16份章节HTML；在线与离线共32份章节HTML变化，首页和篇内目录保持原字节，见 [产物比较](../build/xue-er-annotations/product-comparison.json)。部署及线上套件未改变产物。

本轮未生成或更换音频，既有 `humanListeningApproved:false` 保留；浏览器检查和代理看图不代表真人听检。物理手机/Safari未复测。4173生产预览、4174试听、4175预演继续保留；未commit或push。
