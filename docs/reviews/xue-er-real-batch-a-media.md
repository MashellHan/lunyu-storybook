# A批真实新媒体技术审查

2026-11-03；lunyu-review。**A批技术检查通过，可交真人试听；尚未完成人工听检，不声明可发布。** 候选清单SHA为 `ccc09c1709cc707442997d3a4c0e94449cd5166c2d21e7a7a5017e348f51f5af`。实际37份处理后文件共127.543秒：30条配音（含第2、3章两标题）及7条免费齐读，含6处有原始证据的HD残片修正。

[完整逐文件检查与SHA](xue-er-real-batch-a-media.json) · [SDK逐事件/原文字位](xue-er-real-batch-a-boundaries.json) · [有界残片判定及反例](xue-er-media-a-alignment.md) · [MP3解码记录](xue-er-real-media-codec-cache.json)。37份处理后文件指纹集合（sorted path + TAB + SHA + LF）为 `adfc0310d5f2f9e0cf2e64f81ca48a2a0e70974459840b51677390fc281b7553`。

- 30份原始attempt/result逐条对应批准白名单、SSML SHA、集合SHA、内容SHA和原始MP3 SHA；本地账本无重复ID/attempt、额外输出或自动重试记录。全部30条raw succeeded。B开始时间晚于最后A成功时间；进行中B条目不计为失败。
- 30份raw与37份处理后MP3均由本机ffmpeg完整解码，退出0；ffprobe实测分别为24kHz/mono/96kbps与24kHz/mono/64kbps。未播放给自己听，也未把可解码当作音质/读音通过。
- SDK原始wb/details原样保留。14个真实SDK `textOffset=-1`如实记为未知；6处修正经批准SSML、紧前alias、连续原文字位和原offset/span唯一证明。处理后全部`t`与独立逐事件映射一致，标点null，汉字有序且无越界；实际duration与timing一致，raw/请求/内容来源哈希吻合。
- 7条齐读指向小兔/猫/狗三份真实源文件；按实际时长核对小兔长度基准、tempo比和0/70/140ms延迟，无新增付费请求。标题只引用批准的第2、3章大象标题，原首章标题及v5保持既有引用。
- 候选中18个段落目标、2个标题共92个引用，指向37份唯一文件；跨章前缀复用保持同一源文件/源批次，不额外付费。present/missing精确分区匹配：268个missing属于尚未完成的B相关引用，不是A缺漏。37份唯一文件全部标记not-listened，publicationReady=false，没有伪造listening。

首次免费process拒绝真实SDK未知定位的原记录仍在 `build/xue-er-media-run/batch-a-process-result.json`；修后仅复核真实产物与修正记录，未重开工具全审或62项前端套件。已发布目录的6份HTML仍与前次冻结指纹一致。

复现本次只读检查：`python3 -B docs/reviews/check-xue-er-real-media.py --batch batch-a`。脚本只在docs/reviews写证据/解码缓存，按实际MP3 SHA复用已完成的解码结果；未访问.env、导入SDK、调用API、改媒体/生产源、构建或部署。实际音色、声调、漏读/重读、齐读可懂度、真机及计费仍须相应真人/服务证据；本轮没有冒充听检。B零时长词不影响A结论。
