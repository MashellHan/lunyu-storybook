# 架构：场景流程、状态机与时间线

## 总览
- 动漫首页、篇内目录和《学而》16章完整内容已发布；当前逐段注解版本为 `72de80fb-d111-41e1-959d-41fd77f592ca`，本地完整回归73项通过，线上限定套件30项通过、43项配置跳过，见 [注解实施记录](annotations-build.md)。本次为72段添加白话释义和163条词注，并使长页面的开场播放键保持首屏可见。既有235次合成、290份处理后音频及26页场景未变；媒体按负责人“直接全部部署”的精确授权发布，人工听检仍未确认，首次完整发布证据见 [逐章实施记录](xue-er-build.md)。
- 首页与章节都是静态 HTML，无框架、无运行时依赖。首页源码为 `src/home.html`、`src/home.css`、`src/home.js`；篇目录为 `src/volume.html`、`src/volume.css`；章节沿用 `src/index.html`、`src/styles.css`、`src/app.js`，新章另接分页和场景适配器。
- `src/catalog.json` 记录二十篇与真实可用入口。构建时生成目录标记，首页和篇目录关闭 JavaScript 仍可导航；当前《学而》16章均可播放，其余篇目保持不可用状态。
- `scripts/build.mjs` 用 Node 标准库分别把 CSS/JS 内联进首页和章节，并填占位符；媒体校验调用本机 FFmpeg/ffprobe，浏览器不需要这些工具。
  - `__AUDIO__`：旧 demo 的15段，或新章清单中已核验的片段，**以 data URI 内嵌**（原因见下）
  - `__TIMINGS__`：旧 `assets/audio/timings.json` 或对应新片段的时长与逐字时间
  - `__ELEPHANT__ __CAT__ __BUNNY_EAR__ __BUNNY_BASE__ __DOG_TAIL__ __DOG_BODY__ __DOG_HEAD__ __ICON__`：图片地址（站点版为 `assets/img/*.webp`，单文件版为 data URI）
  - 留下未填的占位符会让构建失败。
- 站点产物：`public/index.html` 是不含章节音频的首页，`public/learn/xue-er/index.html` 是篇目录，`public/learn/xue-er/1/` 至 `/16/` 各含完整章节的 `index.html`；共用 `public/assets/img/`，同时发布 CREDITS.md 与 _headers。首章已补齐「子曰」，静态深链可以直接打开。
- 离线产物：`dist/index.html` 为内嵌插画的首页，`dist/xue-er.html` 为篇目录，16章均自包含，使用相对链接往返。首章为 `dist/index-single.html`，其余为 `xue-er-02.html` 至 `xue-er-16.html`；单独拷贝一章仍可阅读、播放和互动，返回目录需要同时保留索引文件。
- 在线入口 `/` → `/learn/xue-er/` → `/learn/xue-er/<章号>/`；首页只按篇导航，「学而」整行进入16章目录，不再混入首章直达入口。离线使用包内相对路径，首页和篇目录不创建 Audio、不内嵌或预取章节音频。

## 《学而》多章接入

- 正文和逐字拼音来自 `docs/content/xue-er.json`，保留16章、72段、493个汉字和167个标点位置。`docs/design/xue-er-scene-config.json` 提供26页、49个朗读组以及场景、道具与动作；分页只引用段号，不复制或改写原文。
- `docs/content/xue-er-annotations.json` 按原段ID提供 `meaning` 和 `terms`，绑定原内容SHA。`validateAnnotations` 检查完整段集合、非空释义及词条属于对应原文；`loadBook` 将注解挂到正文副本，`playerData` 随当前页传入。注解默认显示在朗读按钮外，文字可选择、不会触发点读；同一朗读组的释义连续排版，仍保留逐段标识。在线、离线、预览及无脚本正文均展示对应注解，不新增音频或运行时依赖。
- `scripts/chapter-data.mjs` 检查固定内容和场景的指纹、完整段序、连续原文字位、引语归组和互动引用。`src/chapter-media.json` 单独记录媒体、实际字位时间、已批准请求批次和听检证据。
- `scripts/build.mjs` 生成篇内目录 `/learn/xue-er/`，列出16章，并依据实际就绪状态给出入口。默认需通过真实媒体、内容、时间轴和听检检查；本次负责人明确要求直接发布，`loadBook` 仅在 [精确授权记录](xue-er-release-authorization.json) 与内容、manifest、305份音频及291份时间轴全部匹配时免除听检先行条件。其余技术校验及底层函数默认行为保持不变，`humanListeningApproved` 仍为false；授权缺失回到默认检查，记录或素材不匹配则拒绝构建。
- 在线按章输出 `/learn/xue-er/<章号>/index.html`。离线目录新增 `dist/xue-er.html`，首章仍为 `index-single.html`，其余章使用 `xue-er-02.html` 等相对路径；每章内嵌自身音频和图片，首页与篇目录不带音频。
- `node scripts/build.mjs --preview` 只生成 `build/xue-er-preview/` 的开发预览，显示完整原文、拼音、分页和场景。缺配音时禁用朗读/点读，不内嵌声音，也不进入 `public/` 或正式离线包；此预览不算章节成品。
- `node scripts/build.mjs --rehearsal` 生成 `build/xue-er-rehearsal/` 的真实媒体预演，`node scripts/serve.mjs --rehearsal` 仅在 `127.0.0.1:4175` 提供该目录。它复用原播放器及全部媒体、内容、哈希与时间轴校验，仅将技术可播放状态与人工听检分开；不写听检记录，不进入 `public/`、`dist/` 或部署。预演里的16个可播放入口不改变正式目录状态。
- `src/chapter-player.js` 复用 `app.js` 的单 Audio、执行编号、活动时间、取消和暂停机制。当前页依次领读/跟读、再独读，全部成功才自动翻页；播放失败或超时不会计为新章读完。手动翻页先取消旧播放，再进入新页自由模式；返回和刷新恢复当前页的位置。
- 场景布局由 `src/chapter.css` 与配置中的视口参数共同决定；复用原创动物图层，静态 SVG 道具和有限的 transform/opacity 动作按页绑定。停止、翻页、离开、减弱动态变化会清理相应动作。

新配音由隔离批次流程制作，A/B共235次合成已成功，含离线齐读混音共290份处理后音频，已导入媒体清单。独立媒体审查见 [实际媒体核验](reviews/xue-er-real-media.md)；人工听检仍未通过，本批发布依据是负责人的明确指令。首章原有定稿音频保持原样，新增「子曰」作为独立片段。此次例外仅覆盖记录中的现有16章与固定素材，后续新内容或新媒体不会自动继承。

## 音频播放
- 全页只有一个 `<audio>` 元素（`au`），每段 `au.src = AUD[key]`。iOS Safari 只解锁“在用户手势里 play() 过”的那个元素，所以始终复用它。
- 第一次点 ▶ 时在手势内播放标题配音（若加载时已自动播过，则静音播一下来解锁）。
- **章节音频继续内嵌**：本项目曾遇到 Cloudflare Workers 静态资源的 Range 请求返回 200 而非 206，导致 iOS Safari 直接播 mp3 URL 可能失败。章节 HTML 因此较大，首页独立加载；实际体积见构建日志。
- `playClip(key, {kara, talkers, strict})`：播放并驱动卡拉 OK 高亮和“说话”动画。旧 demo 保留非严格播放时按时长计时的兼容回退；新章采用严格播放，失败或超过 `dur + 2.5 s` 即返回失败并结束本轮，不补发读完进度。

## 原 demo 剧本 / 状态机
`#book` 的 `data-step` 记录当前状态（测试也靠它）。以下是保留的三句流程；新章按前述页和朗读组执行：

```
title ──(加载后尝试自动播 title；被浏览器拦截则等第一下点击)──> title-voice
  └─ 点 ▶ ─> 标题淡出 ─> intro（四个角色依次弹一下）
        ─> trumpet（大象叫 ~2 s）
        ─> 每句 i=1..3：e{i}（大象领读）─ 350 ms ─> u{i}（小兔+小猫+小狗齐读）─ 650 ms
        ─> again（大象：“我们再来一遍吧”）
        ─> solo-bunny ─> sound-bunny（第 1 句 + 吱吱～，亮第 1 颗星）
        ─> solo-cat   ─> sound-cat  （第 2 句 + 喵～，第 2 颗星）
        ─> solo-dog   ─> sound-dog  （第 3 句 + 汪汪！+ 翻跟头，第 3 颗星）
        ─> celebrate（全体大动作 + 大象叫，等 2100 ms）
        ─> free
free（自由模式）：
  点大象 ─> trumpet ─> e1 ─> e2 ─> e3 ─> free
  点小兔/小猫/小狗 ─> solo-x ─> sound-x ─> free
  点句子卡 i ─> e{i} ─> u{i} ─> free
```

- 打断：每次自由点击通过 `interrupt()` 调用统一的 `cancelRun()`，使旧执行编号失效，取消音频、可取消的等待、延迟动作、说话动画、气泡及字幕焦点。标题异步链也检查执行编号，避免被取消后重新开始剧本。
- 非自由模式下点角色只做一个小摆动反馈，不打断剧本。
- 暂停键（⏸/▶，给大人用）：`setPaused` 暂停音频、所有 WAAPI 动画和 CSS 动画；页面隐藏（切后台）时自动暂停。`wait()`、音频 fallback 与超时保护共用 `activeNow()`，扣除累计暂停时长，避免后台回调停顿后恢复时提前跳句。
- 停止键（■）：`stopToFree()` 取消自动流程，退出标题并直接进入自由点击模式，保留已经获得的星星。没有按过 ▶ 的路径也在首次点击中解锁同一个 Audio。
- 返回目录先清理本章播放。页面恢复时不能复活已取消的自动流程；浏览器返回的处理与证据见 [首页实施记录](homepage-build.md)。

## 布局与首页动画
- 首页使用现有四动物插画和两页连续目录；手机按标题、角色、二十篇目录顺序排布。目录顶边加入小猫探头、书签与纸飞机，宽屏另有静态小兔；只有探头小猫执行一次 640ms 点头。减弱动态、初始后台或短横屏时静止，隐藏页面或离开时取消动作，返回不重播。装饰不接受点击或键盘焦点，不加载音频。
- 章节的控制区、角色区和句子卡分别排版，不再缩放整个 1180px 画布。手机角色采用 2×2，当前页原文纵向排列，正文与拼音保持独立可读尺寸；长章使用连续分页。
- 具体视觉与触控要求见 [首页设计](design/homepage.md)，基线问题与本轮浏览器验收见 [首页实施记录](homepage-build.md)。

## 时间线 / 卡拉 OK
- 当前页句子卡就是字幕：原文 + 拼音，逐字高亮；旧 demo 固定三张，新章按朗读组生成。
- 逐字时间来自 Azure 词边界（word boundary）：一个词的时长分给它包含的汉字。旧 `scripts/tts/process.py` 和 u1–u3 的小兔词边界 + 50 ms 保持原样；新流程按各片段明确的原文字位处理 alias，无法对齐时拒绝产出有效时间轴，见 [批次接口](tts/xue-er-batch-interface.md)。
- 对 SDK 返回时长为0的多字词，只保留真实词首时间；`wordGroups` 记录原事件、SDK定位和原文字位，相关字共享该起点并一起高亮，不推算词内逐字边界。实际共有「习乎」「父母」「来者」3处，原始事件与处理依据见 [媒体审查](reviews/xue-er-real-media.md)。
- 叫声（squeak/meow/woof/trumpet）在 timings.json 里只有 `dur`，没有字。

## 测试钩子
- `#book[data-step]`、`window.__log`（播过的 clip key + 时间）、`window.__demo`（`stop()`、`enterFree()`、`react()`、`audio` 等，仅供测试/截图）；`enterFree()` 测试入口也走完整停止逻辑。
- 阅读页元素 id：`#startBtn #pauseBtn #stopBtn #homeBtn #elephant #bunny #cat #dog #cards #stars #title`。首页篇入口为 `.volume-index`，所属篇锚点为 `#xue-er`；返回首页时焦点恢复到「学而」篇入口。
- 新章另有 `#tocBtn #prevPage #nextPage #readBtn #pageNumber`、`#book[data-page][data-scene][data-preview][data-playable][data-rehearsal][data-publication-ready]` 和 `window.__demo.chapter`；原文字节点保留 `data-segment` 与 `data-source-index`。隔离的测试页位于 `build/`，不进入生产包。

## 构建产物为什么不提交
`public/` 与 `dist/` **不提交**，由 `npm run build` 生成：
1. 构建使用 Node 标准库，媒体校验还需 FFmpeg/ffprobe；产物可从源码和已核验素材重建，无需提交；
2. 章节产物内嵌音频，每次改一行 JS 都会产生大块二进制式 diff，仓库会迅速膨胀；
3. 避免“改了 src 忘了重新构建”导致源码和产物不一致；
4. `npm run deploy` 和 Cloudflare Workers Builds（如以后接 Git 自动部署，构建命令填 `npm run build`）都会先构建。
