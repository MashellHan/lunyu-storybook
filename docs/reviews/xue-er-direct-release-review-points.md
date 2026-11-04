# 直接发布授权：限定拒绝场景审点

2026-11-03；lunyu-review。已只读核对授权 `9dcafa05a26b38c05c14c5c770221d7c3de7d7bcc2a6324d4aa26e23d54b51c2`，原话“直接全部部署”；16个有序chapter IDs、内容与manifest均精确匹配。370引用及既有运行片段对应305音频/291时间轴，集合SHA及逐文件SHA与已关闭媒体证据一致；未重复媒体解码或逐文件重审。`allowPublicationWithoutListening=true`，`humanListeningApproved=false`，manifest没有listening批准。

仅核对以下4类边界，供工程既有专项覆盖；Reviewer不另跑测试：

1. 无适用授权、volume/chapter顺序或范围不符、布尔授权无效时，不能自动获得本次听检豁免；保持默认严格路径。
2. 内容或manifest字节改变、未来增加/替换引用时，旧记录的精确匹配不能继续成立；不得仅凭同一篇名/章号沿用豁免。
3. 音频/时间轴路径、文件集合或任一SHA不符时，不得放行该记录所未覆盖的数据；包括同路径替换和更改仍处于合法时间范围内的timing。
4. 适用例外只影响当前`loadBook`对听检要求的选择；直接调用`verifyClip`/`assessReadiness`默认仍严格，内容、来源/声音/复用、原文字位、时间范围与实际解码/时长校验保持。授权不写回listening或把humanListeningApproved设为true。

以上是授权边界核查，不是新的人工签字或审批步骤；已授权且精确匹配的当前16章无需重复确认。实现与本轮实际退出已完成绑定：71通过、0失败、0跳过，49输入逐文件一致；见[正式结论](xue-er-direct-release.md)及[接入证据](xue-er-direct-release-integration-check.json)。
