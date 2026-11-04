# 《学而》阶段 B 篇内目录增量最终复核

2026-11-03；lunyu-review。**本轮 Reviewer 审查通过：篇内目录增量无未解决阻断。** 最终冻结输入为 `bbe55d83261a0d9ec045f649564fa9e4a272925f7e0037e9c6dd03ff201c5b40`（48项）；最终完整套件已真实exit 0，62通过、0失败、0跳过。独立重算48输入、6产物、16预览、6张已审PNG及49个受保护assets文件与lockfile均吻合。仅篇内目录增量通过，完整16章仍ready=false；实际部署及线上检查由Lead执行。

[最终输入/产物绑定](xue-er-phase-b-final.json) · [最终原始日志](../../tests/artifacts/xue-er-phase-b/npm-test-b-final.log) · [工程结果](../../tests/artifacts/xue-er-phase-b/npm-test-b-final-result.json) · [汇总及变更对照](xue-er-phase-b-36ce75f/summary.json) · [完整静态原始记录](xue-er-phase-b-36ce75f/static-check.json) · [B2字位/行位置实测](xue-er-phase-b-36ce75f/b2-check.json) · [六张固定PNG指纹](xue-er-phase-b-36ce75f/screenshots.json)。目录名保留起始36ce候选；每份记录以其实际输入/HTML SHA为准。

- 实际打开六张工程PNG：首章390、第3章320/390、第15章第3页320/768/844。未见新增裁切、文字或控件遮挡；844横屏证据是可纵向滚动的整页图，不表示全部内容同屏可见。
- 16份既有预览内的26页、72段、49组与内容 `85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73`、场景 `17a163e213a206b39622fec527e185a7e5ff8a4c71a18e63fa22eb8225e97a9c` 一致。原文、拼音、标点字位、分段顺序、组/道具/动作引用和几何配置匹配；预览无音频且不可播放。
- HTTP与离线篇内目录均有16项，仅旧首章三句demo有生产入口并明确标识；第2–16章无假链接，完整16章全部ready=false。public/dist只有首页、章目、旧demo，未泄漏16章预览或runtime-fixture。HTTP章目及旧demo响应字节与当次本地产物相符；未启动旧播放器。
- **B2已在两个原复现点实测通过**：首章320×844首句逗号随“之”；第15章第3页768×1024收引号随正文。逐字rect与各行首尾保存在记录，无行首闭标点或行末孤立开标点，原文/拼音未丢；两张补图也实际打开。既有完整Chrome明确headless、reduce；没有重跑视口矩阵或时序探针。

| 当次实际检查对象 | SHA-256 |
| --- | --- |
| B2首章预览 | `3045a78e066e3e9276d2a9edc1c7b4d1eaffa2c436e48e56a69ddd21209be4ef` |
| B2第15章预览 | `3842d843fdd812b9dd1cdb9cf4f698ff6dd76dc5e497e30f39b110117d32f6f5` |
| 最终public首页 | `d1686239c8584129988138ac1c525bb74ce3bdf796e3a8e90071dd5f9ec1b085` |
| HTTP篇内目录 | `b0e782677933ba77f93111f549f9e16e960e299dbe999f1f7d7bce76998bf9df` |
| 当次public旧demo | `d68901a4dc47b06c33639fedeef470c309d283270ed8b8fcf7dc6c1bbf01496c` |

修复范围已只读核对：`app.js` 的 `holdAnimation` 在pause后同步固定currentTime，普通暂停及暂停期间新动画均使用它；场景用例保留180ms不变断言，并新增pending=false和恢复推进检查。rapid用例去掉本项16倍加速，仍检查唯一d3及旧等待/回调取消；首页仍要求idle、无transform、不重播。聚焦原日志为 [failure-fixes-focused.log](../../tests/artifacts/xue-er-phase-b/failure-fixes-focused.log)，[诊断](../../tests/artifacts/xue-er-phase-b/failure-timing-diagnostic.json) 保留media-change与cancel时间；未另跑这些用例。

取证过程保留两类边界：静态探针先修正对既有legacy-demo空layout的错误假设，见 [诊断](xue-er-phase-b-36ce75f/static-probe-diagnostic.json)，未改实现。随后按旧36ce记录对账出现4输入变化和dist暂留旧app两项差异；已确认读取输入正是新bbe冻结，在线/预览已含修复，最终离线demo已更新为 `431fcd0a50d346c5cc13ba14de326baef40e58170540317ba243fc2e389eca24`，内嵌app与冻结源码一致，此差异已关闭。该中途原始exit 1保留为换版取证记录，不是新增产品缺陷。

原失败全套 [日志副本](xue-er-phase-b-36ce75f/engineering-suite.log) 与 [结果副本](xue-er-phase-b-36ce75f/engineering-suite-result.json) 保留。最终 [npm-test-b-final.log](../../tests/artifacts/xue-er-phase-b/npm-test-b-final.log) SHA为 `129c4e5565b93224723180864c681bbeb26be484ef770e40eab11c38986b257a`；实际62条通过记录、exit 0与工程结果一致。最后仅执行 `python3 -B docs/reviews/bind-xue-er-final.py` 读取输入/产物并写审查JSON，exit 0；未重跑浏览器矩阵、时序探针或套件。最终16份预览和六张已审PNG逐字节未变，复用既有内容、几何及B2证据。

本轮仅写docs/reviews，未构建、安装、跑完整套件/旧播放器矩阵、调用SDK、生成媒体或部署。无新章ready、无真实新API；静态预览不代表音频互动已交付。真机、真实新媒体/服务、人工听检及实际计费仍未验证；内容冻结校核已满足内容审校，不另加用户逐章签字。TTS工具5cc282ec/67f889d1审查保持关闭。
