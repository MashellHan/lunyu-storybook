# Lunyu team 代码交付流程

2026-11-04，大雄明确要求：“注意让lunyu team 主动commit和发pr，积极review merge code；功能完成就commit，不要留code在本地”。此持续授权适用于现有仓库 `MashellHan/lunyu-storybook`；无需每次再次询问commit、push、创建PR或按规则merge。

1. 完成一个逻辑完整的功能，核对改动范围并通过适用检查。源代码和素材变化遵守项目完整测试要求；已有测试仍对应相同输入时可复用，文档调整无需重复全跑。
2. Lead默认独占共享工作区的Git index、分支和集成操作。成员完成后立即交接，Lead在功能分支commit、push并创建或更新PR，不等全书完成，不按句数机械拆PR。作者沿用 `Mengxiong Han <mxhan@outlook.com>`，提交信息用英文祈使句。
3. PR描述说明实际问题、最终行为、验证及实质限制。Reviewer独立审查实际head SHA，给出明确结论；修复后的变更重新核对相关范围。
4. 无未解决阻断问题且仓库要求满足后，由Lead主动merge并同步本地main。遵守分支保护；不能把同账号代理的review comment写成另一GitHub用户的批准，不能用admin绕过要求。
5. 交付报告PR链接、commit、review和merge状态，确认已完成功能已进入远端。云端部署与Git交付分别核实，不能将已上线等同于已提交。

提交前检查实际文件集合，排除 `.env`、密钥、构建产物、工具缓存及本地测试输出；不要把他人的未完成改动顺带提交。已批准并验证的源码、内容和媒体应完整进入仓库，保证从干净checkout能够构建。调用付费服务、全局安装、新建公开仓库、改发布目标等超出当前授权的操作仍按相应约定处理。

本次接手时，该批首页、《学而》16章72段和注解尚无新增commit或PR，远端只有早期demo的6个commit，最新为 `cf214146043158bd74817d0002f4b34f06e40d65`。此次由Lead补齐Git交付，Reviewer独立审查；历史发布和测试记录保留原事实。
