# 真实媒体本地预演限定工程复核

2026-11-03；lunyu-review。**本轮技术复核通过，未发现需要阻断预演接入的问题。** 冻结源码输入48项独立重算吻合，SHA为 `4827477df48fd8e2d08299643cb6585d707b66da11c040b572c7aed11dff5c93`。Engineer最终完整套件真实exit0：70通过、0失败、0跳过；输入前后清单一致，全输入摘要 `4bbfa6d08890f049fa74041761b678909cbea18c0376e01b15e7ea5a83bc5361`。

- 三处“习乎／父母／来者”同时间双字均共同高亮，暂停时保留两个cur且未提前done；停止或第7章翻页后清理高亮/焦点、音频暂停，旧ended回调不复活，后续点读仍可用。已读实际记录及对应取消链（`src/app.js:131,486`、`src/chapter-player.js:116`），并真正打开三张390宽PNG；未启动浏览器或重跑用例。它们始终是词级锚点，未声称逐字发音边界。
- `requireListening:false`用于本地预演的技术可播放评估及候选导入校验；正式`loadBook`/readiness仍默认要求听检，导入不会添加listening批准。`--rehearsal`固定输出到build/xue-er-rehearsal，含本地预演提示；16章technicalPlayable=true但publicationReady全false。当前public/dist仍仅有目录及原三句demo入口，没有预演或新章泄漏。
- 三份预演HTML内嵌app/adapter与冻结源码一致；实际wordGroups及字位与已关闭媒体证据一致。Root的3/15移动标题/停止记录只读引用，HTML指纹相符，未复测。Root四图和本轮三图均为代理视觉检查，不能作为人工验收。

[独立绑定证据](xue-er-rehearsal-evidence.json) · [三图固定副本及指纹](xue-er-rehearsal-evidence/screenshots.json) · [8项专项结果](../../tests/artifacts/xue-er-media/media-focused-result.json) · [真实双字/取消记录](../../tests/artifacts/xue-er-media/real-word-groups.json) · [最终70项原始日志](../../tests/artifacts/xue-er-media/npm-test-media-final.log) · [最终结果](../../tests/artifacts/xue-er-media/npm-test-media-final-result.json)。原日志SHA为 `59d793bfc21d294877810ddbbce9ab77156fa4fb2ea87a9e2e7ca1485687e7a0`；专项8条及完整70条通过记录均已对账。

`humanListeningApproved=false`：A/B仍待本人试听反馈；0新章发布、0新增API。既有1287媒体、235请求、内容和静态矩阵结论保持关闭，本轮仅复用其指纹，未重复媒体解码、浏览器矩阵、测试或构建，也未操作4173/4174/4175服务。仅写docs/reviews。
