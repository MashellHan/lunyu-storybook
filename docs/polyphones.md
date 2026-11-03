# 多音字处理

本章需要特殊读音的字：

| 字 | 句子 | 正确读音 | 神经声音（Neural）做法 | HD 声音（小狗）做法 |
|---|---|---|---|---|
| 说 | 不亦说乎 | yuè | `<phoneme alphabet="sapi" ph="yue 4">说</phoneme>` | `<sub alias="悦">说</sub>` |
| 乐 | 不亦乐乎 | lè | `<phoneme alphabet="sapi" ph="le 4">乐</phoneme>` | 不处理（HD 默认读 lè） |
| 愠 | 人不知而不愠 | yùn | `<phoneme alphabet="sapi" ph="yun 4">愠</phoneme>` | `<sub alias="运">愠</sub>` |
| 论 | 论语 | lún | `<phoneme alphabet="sapi" ph="lun 2">论</phoneme>` | （小狗不读标题） |

- `config.py` 里用 `{字}` 标记需要处理的字，`gen.py` 的 `mark()` 按声音类型展开。
- HD（Dragon）声音会忽略 `<phoneme>`，所以改用同音字 `<sub alias>`。
- 用别名时 Azure 返回的词边界文本是别名（悦/运），`process.py` 用 `ALIAS_BACK` 映射回原字，卡拉 OK 才能对上。
- 屏幕上的拼音写在 `src/app.js` 的 `SENT[].py`（说→yuè、乐→lè、愠→yùn），与发音保持一致。
- 新增句子时：只给默认读错的字加标注（拿不准就先只渲染一句试听，避免批量付费调用）；渲染后由人工听检（代理无法听音频）。
