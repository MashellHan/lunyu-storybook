# 隔离 TTS 工具独立审查

2026-11-03；lunyu-review。**通过，未发现需要修改实现的问题。工具可待安全凭据就绪后，由 Lead 在已授权 A+B 共235条、US$10总上限内按先A后B执行。**

| 文件 | 本次审查 SHA-256 |
| --- | --- |
| `scripts/tts/batch.py` | `5cc282ec213c832b0f252f16a7b7820cc0dd002e53094d888ced806cda08525e` |
| `scripts/tts/test_batch.py` | `67f889d11d267f5cdf239711fb602f2c6c5405847091b1496f07aedb5b4770ab` |

已完整读取实现、测试和 [接口](../tts/xue-er-batch-interface.md)，核对 [17项原始测试日志](../tts/batch-tests.log) 与 [exit0及源码绑定](../tts/batch-tests-result.json)。另完成22项独立离线检查，exit0，见 [独立证据](tts-batch-tool.json) 与 [检查器](check-tts-batch-independent.py)。

- 精确清单/SSML/声音白名单、显式选择、A先于B、持久attempt、失败/未知不重试及路径隔离符合接口；并发同条目仅触发一次模拟调用。
- 原始wb与SDK定位保留；真实B多音字按原字位映射，缺字阻止处理产物落盘。旧HD残片只在限定条件下处理，其余片段被拒绝。免费齐读、A→B及B内前缀复用、15个新标题索引及缺失记录均符合约定。
- 候选始终非ready，不填造listening；49件旧素材、锁文件、审核输入及Lead脚本字节未变，四个生产新媒体目录仍不存在。本轮0 SDK导入、0真实API，仅临时夹具和模拟renderer。

首轮探针误加实际反斜杠，工具已正确拒绝；原始失败保存在 [诊断记录](tts-batch-tool-probe-diagnostic.json)，原因见 [说明](tts-batch-tool-probe-diagnostic-note.json)。修正版分别验证真实 `">` 形态和带反斜杠的拒绝分支，未改生产代码。

真实服务接受行为、实际新媒体/读音、真实SDK词边界、设备播放及人工听检尚未验证。US$10是已授权总上限；本次验证请求数与应用层零自动重试，未核实供应商最终计费或账单，规划参考值不作实际费用结论。

工具审查到此收束。等待工程冻结快照后，仅复核B目录生产隔离、标点修复和最终产物匹配；不扩大样本、不重复套件。
