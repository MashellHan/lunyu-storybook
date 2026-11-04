# 《学而》语音批次 B 独立审查

2026-11-03；lunyu-review。**通过，B 精确输入审查关闭；未发现遗漏、重复付费或字位映射缺陷。** 主会话已明确授权 A+B 共235条共享 US$10 总上限，按先A后B执行，无须另设用户确认。凭据仍未就绪；本审查未导入/执行 SDK，未合成或修改任何媒体。审核包内准备时的授权状态字段保留原样，不作为新增审批关卡。

审核对象：[B JSON](../tts/xue-er-generation-request-b.json) 与 [B 说明](../tts/xue-er-generation-request-b.md)。逐条证据见 [xue-er-tts-b.json](xue-er-tts-b.json)；可复现的独立只读检查器见 [check-xue-er-tts-b.py](check-xue-er-tts-b.py)。

| 绑定项 | SHA-256 |
| --- | --- |
| B 精确 entries 集合 | `ff9384ff4d805bdab7567bda65d12c0101ec4007d10b17ee00a55b06ee6ea54f` |
| B JSON 完整文件 | `26b79e3aa570877d917ce741079d0b67140ce1b33a29db7557b83d133396ead4` |
| 冻结内容 | `85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73` |
| A JSON 完整文件，逐字节未变 | `0c0a0fc0ee93868a91fcb76765a906c2bbe79d7a4a3e88c8cf60e462132be6da` |

集合摘要按审核包声明的 UTF-8 / ensure_ascii=False / sort_keys=True / 紧凑逗号冒号序列化重算。A 的30条集合摘要仍为 `472d68446e3209689037534c3e9dedab710503b1036719d07a0e22752f672296`。内容、声音配置和两个清单在检查前后字节完全一致。

通过项：

- 205条 XML 均可解析，SSML SHA 全吻合；XML文字逐码点等于对应段落或标题，包含所有引语标识和标点。声音、风格、角色、语速、pitch与A及既有 `config.py` 一致；小狗仅在各段首个逗号后加100ms。
- 48个新正文/引语段×4声音＋13个大象标题＝205条；分布为大象61、小兔48、小猫48、小狗48。205 ID、410 raw/processed路径各自唯一，和A无冲突，410个B目标均尚不存在；A+B共235个SSML请求无完全重复。
- 84处SAPI和18处HD alias逐项对齐冻结稿的 `suggestedForNewSpeech` 和原字位；未建议强制的字保留原字，没有全篇字符替换。13个标题的 `titleSourcePositions`、`titlePinyin` 与原章逐位相符，含跨标点提取的第11/12章，标题“论”单独标为lún。
- 13处引语复用均与源段文字、拼音、说话人一致，每处四个角色都有明确A/B源请求，节省52次请求。第4–16章61段全部恰好归入新录或复用；与A及首章旧素材计划合并，72个正文段、16章标题均有明确来源，每次正文中的前缀仍保留。
- Markdown分章数量、总数、摘要和预算算术与JSON一致。B的字符参考值为US$0.034916，整串SSML规划参考为US$1.086569；A+B相应为US$0.040204 / US$1.266060。仅核算算术，未把Dragon SKU及供应商计费规则未定的参考值当账单。

重点字位抽核（0起始段内码点索引）：`xue-er-06-s02` 的弟[0]为dì原字、弟[8]为tì/替；`xue-er-10-s03` 的与[2,7]为yú/于，与[5]仍为yǔ；`xue-er-11-s02` 的没[8]为mò/墨、行[12]为xìng/性；`xue-er-13-s03` 的远[5]为yuàn/愿。完整条目、标题映射与复用目标范围均保存在证据JSON。

复现命令（显式目标目录，不构建、不访问服务）：

```sh
cd /Users/mengxionghan/workspace/lunyu-storybook
python3 docs/reviews/check-xue-er-tts-b.py > docs/reviews/xue-er-tts-b.json
```

生产接入仍需核实际新媒体、word boundary与HD alias回映、齐读混音及人工听检。此处通过的是精确请求输入，不能据清单路径或候选同音字标记章节ready。既有冻结内容校核已满足内容审校，不要求额外用户逐章文字签字；冻结JSON中的历史 `humanTextReview` 字段不应变成生产关卡。真机、实际声音、听检和B运行流程本轮未验证；A/B精确输入、生产数据、旧v5及媒体均未改动。
