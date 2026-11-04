**通过：本次首页导航与限定视觉审查未发现问题，可交回Root。** lunyu-review，2026-11-03。

已核对7份改动及其[冻结指纹](../../build/home-volume-fix/test-inputs-before.json)：`scripts/build.mjs`、`src/home.css`、`src/home.js`，以及 homepage、responsive、single-file、chapters 四份测试。首页保留20篇，只有整行“学而”链接到 `/learn/xue-er/`；首章直达及章名字样已移除，19篇仍不可进入。原生链接只有一个焦点入口，焦点环保留，返回 `#xue-er` 时恢复到 `#xue-er-entry`。

已实际查看[390×844手机整页](../../build/home-volume-fix/local-390.png)与[1024×768平板横屏](../../build/home-volume-fix/local-1024.png)：篇名、整行入口和箭头清楚，未见遮挡或横向溢出。[Root浏览器记录](../../build/home-volume-fix/local-ui.json)四视口通过：首页→16章目录→第7章→首页并恢复焦点，无JS路径通过、无错误。

只读核对线上与离线首页、篇目录产物：两份目录各有16个不同章入口，对应文件均存在；离线为 `index.html → xue-er.html → 单章`，目录返回 `./index.html#xue-er`，源码和产物路径一致。动态file://回归及完整测试退出由Root本轮套件负责，本报告不提前声明其结果。

本次首页SHA为 `6eba242d40764499f703f7f84c34c0925ed037eb99391f73779a7a6bc804af07`。[产物差异记录](../../build/home-volume-fix/production-change.json)显示28个线上产物仅首页变化，章节字节未改；[设计检测](../../build/home-volume-fix/design-detector.json)为 `[]`。Reviewer未运行构建、测试或部署，未重开播放器、内容、TTS和媒体审计；后续测试收尾及发布由Root执行。
