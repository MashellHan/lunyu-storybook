# A/B真实新媒体最终技术审查

2026-11-03；lunyu-review。**本轮限定技术审查通过，无未解决的数据阻断ID。** A+B共235份成功原始结果对应290份唯一处理后素材，最终候选missing=0；290份全部仍为pendingListening，publicationReady=false。实际真人听检尚未完成，本结论不声明新章可以发布。

[最终独立证据](xue-er-real-media-final.json) · [A逐文件核验](xue-er-real-batch-a-media.json) · [B实际timing/ref核验](xue-er-real-batch-b-media.json) · [235份原始记录](xue-er-real-raw-final.json) · [旧字节保护](xue-er-real-media-final-protection.json)。

| 批次 | 原始成功请求 | 唯一处理后素材 | 实测总时长 | 残片修正 |
| --- | ---: | ---: | ---: | ---: |
| A | 30 | 37（含7齐读） | 127.543秒 | 6 |
| B | 205 | 253（含48齐读） | 835.947秒 | 10 |

A候选SHA为 `ccc09c1709cc707442997d3a4c0e94449cd5166c2d21e7a7a5017e348f51f5af`；最终B候选（包含A+B全部引用）SHA为 `b4e80d04d725e9e092a7a6427b8d540b6fbca0bed802034b3abe263a96616220`。全部1287份新输出已按路径逐文件独立对照，汇总SHA为 `22a67cfc4707c54ea59d41f1c0abc646c2bed6848e2793ec13f2f61665a7abea`，与Lead [全量证据](../../build/xue-er-media-run/all-media-verification.json) 一致。算法为sorted path + TAB + fileSHA256 + LF后SHA256。

- 235个唯一attempt按A后B串行，对应原批准SSML、声音、集合/内容SHA及实际raw MP3，成功结果无遗漏。本地记录0失败、0自动重试、无重复attempt或越出白名单的付费输出；实际账单不由这些本地记录证明。
- 原始wb/details保持原样，42个SDK `textOffset=-1`如实保留未知定位。16处SSML残片均经批准alias、紧前单字事件、连续原文字位及原offset/span唯一回映；实际timing与独立源事件证明一致，修正完整记录原事件、剩余字位和SDK定位。无事件、缺字、多字、错alias、负时间等仍不放行。
- 最终候选有69个新段落目标×5角色及15个新标题，共360个引用；3个既有正文段保持旧媒体。引用、原文字位、raw/processed/timing哈希、复用源批次与精确文件路径一致；重复前缀引用同一源文件。55条齐读保留三原轨来源、实际时长比及0/70/140ms延迟，无额外合成。
- 原始235份及A37份处理后素材已完整解码通过。按最后限定，B最终仅补253份新处理文件的实际格式/时长、哈希及timing/ref比较，复用205份原始解码证据，没有再做全流解码。处理后实际格式为24kHz/mono/64kbps，duration、标点null、全部原文字位及时间范围一致。
- 839项已审字节保持不变，覆盖A全部新文件、A/B原始记录与MP3、批准输入、旧素材及lock（50项）、已发布6份HTML。旧A/v5没有为wordGroups重写，正式public/dist未开放新章。

实际词级锚点共**3处**，已逐条核对生产候选timing中的`wordGroups`，均保留原SDK `sourceDurationSeconds:0`，没有推算词长或末字时间：

| 条目 | 零基原文字位 | 真实共享词首 | 原SDK事件/定位 |
| --- | --- | ---: | --- |
| `xue-er-04-s05-dog` 习乎 | 2、3 | 0.552秒 | wb[2]，textOffset286 / wordLength2 |
| `xue-er-07-s03-dog` 父母 | 1、2 | 0.364秒 | wb[1]，textOffset264 / wordLength2 |
| `xue-er-15-s11-dog` 来者 | 5、6 | 1.070秒 | wb[5]，textOffset268 / wordLength2 |

这些是整词的真实起点，**没有取得词内逐字发音边界**。第三处沿用同一已批准词级约定，无新增重合成。旧的严格字级判定及其诊断已保留为历史，不能再当作当前未解决阻断。

B [免费process结果](../../build/xue-er-media-run/batch-b-process-result.json)真实exit0，paidCallsThisRun=0；源SHA `d74ea3c297bf86dc6968e48af32bdc0a0e0da970c6a3afc8e51ca7f288444cd4`。Lead的23项回归证据仅只读引用，本轮未重跑工具、前端套件或旧矩阵。最终只读命令 `python3 -B docs/reviews/check-xue-er-real-media.py --batch batch-b --timing-ref-only` 退出0。

所有新素材仍需真人核验实际读音、音色、漏读/重读及齐读可懂度；本轮未冒充听检，真机和实际计费也未验证。Engineer的隔离试听与仅build下16章预演需在可运行后另按受影响流程核验，本轮未提前给其通过结论。Reviewer未访问.env、导入SDK、调用API、改媒体/生产源、构建或部署，仅写docs/reviews。
