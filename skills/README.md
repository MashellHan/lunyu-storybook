# Skills（可复用的做法）

做这个绘本时实际用过的方法，整理成“代理技能”格式：每个文件夹一个技能，`SKILL.md` 顶部 YAML 写 `name` 和 `description`（什么时候用），正文是可直接照做的步骤、命令和踩过的坑；辅助脚本放在同一文件夹，用相对路径引用。人也可以直接当操作手册读。

| 技能 | 什么时候用 |
|---|---|
| [character-image-gen](character-image-gen/SKILL.md) | 生成或修改角色插画（GitHub Copilot CLI 的图像生成工具） |
| [layered-character-animation](layered-character-animation/SKILL.md) | 把一张角色图切成可动的图层，做眨眼/说话/大动作，并遵守动画规范 |
| [azure-tts-voices](azure-tts-voices/SKILL.md) | 选声音、渲染配音、处理多音字、做齐读和卡拉 OK 时间 |
| [animal-sfx-sourcing](animal-sfx-sourcing/SKILL.md) | 找 CC0 动物叫声、截取、调响度、登记来源 |
| [cloudflare-deploy](cloudflare-deploy/SKILL.md) | 构建、检查、部署到 Cloudflare Workers |
| [herdr-team](herdr-team/SKILL.md) | 用本机 herdr 多代理团队继续开发本仓库 |

通用规则见根目录 [AGENTS.md](../AGENTS.md)：不使用真实儿童照片；叫声只用 CC0；付费 API、部署、push 先问负责人；不打印密钥。
