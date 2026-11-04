# 首页动漫增量 · 阶段 A 独立审查

2026-11-03，lunyu-review。

**冻结 d7179532 版本增量审查通过，无未解决阻断，可进入 Lead 已获授权的发布流程。** 仅覆盖新增首页装饰、遮挡、焦点和动效取消。证据总表：[home-anime-d7179532-final.json](home-anime-d7179532-final.json)。

首页 SHA-256：d7179532783d0405cbece7b4e69069ea7e11a2fa17abbbc77b5bd7341c8313ba。4173 响应与 public/index.html 一致；审查前后 src/home.html、src/home.css、src/home.js 和该产物均匹配工程冻结值，完整 SHA 见总表。

## 实际结果

- 六视口 1440×900、1024×768、768×1024、390×844、320×568、844×390 均实测：装饰与篇名、入口、焦点环无交叠；入口中心命中 first-chapter。390/320 入口底缘为 534.30/508.30px，均在首屏且低于600px。
- 实际逐张查看工程六张静态图、五张动画峰值图，并核对全部11张 SHA 与最终工程指纹一致。小猫脸、耳、胡须可辨，尾尖残片已消除，无新画面阻断。844横屏仅保留静态书签。
- 装饰为 aria-hidden=true、无文字、全部 pointer-events:none；可聚焦项仍仅首章入口，无额外 tabstop。无新增音频、音频请求或预取。
- 猫只创建一次640ms的 transform 动画，完成后无活动动画，点装饰不重播。初始 reduced-motion 不创建动画；运行时切换 reduce 立即取消，恢复设置不重播。hidden 分支取消后恢复可见也不重播。
- **补充真实离页取证已通过：**在 app 监听器之后同步写 sessionStorage，再真实导航到同源首章，只读回记录，没有操作播放器。isTrusted=true、persisted=false、cancelled=1、active=0、动画状态 idle；前后首页 SHA 不变，见 [pagehide记录](home-anime-d7179532-pagehide.json)。

## 截图与测试证据

[1440首页](../../tests/artifacts/home-1440x900.png) · [1024首页](../../tests/artifacts/home-1024x768.png) · [768首页](../../tests/artifacts/home-768x1024.png) · [390首页](../../tests/artifacts/home-390x844.png) · [320首页](../../tests/artifacts/home-320x568.png) · [844横屏](../../tests/artifacts/home-844x390.png)。

[1440峰值](../../tests/artifacts/home-peak-1440x900.png) · [1024峰值](../../tests/artifacts/home-peak-1024x768.png) · [768峰值](../../tests/artifacts/home-peak-768x1024.png) · [390峰值](../../tests/artifacts/home-peak-390x844.png) · [320峰值](../../tests/artifacts/home-peak-320x568.png)。

[独立390键盘焦点图](home-anime-d7179532-focus-390x844.png) · [独立1440键盘焦点图](home-anime-d7179532-focus-1440x900.png) · [尺寸与动效记录](home-anime-d7179532-check.json)。

工程唯一完整套件实际退出0，45 passed (2.3m)、0失败、0跳过。Reviewer读取 [原始日志](../../tests/artifacts/npm-test-home-polish.log)，计得45条通过记录，重算日志 SHA 与 [执行结果](../../tests/artifacts/npm-test-home-polish-result.json) 一致：4cfd0aef897757ff665c7b8968bf39f6042e0d7604ee4ede8c696f3dd1d85d9f。[最终工程指纹](../../tests/artifacts/build-fingerprint.json) 对应同版。Reviewer未运行该套件、构建或部署。

## 方法与边界

独立命令（均显式 workdir /Users/mengxionghan/workspace/lunyu-storybook）：

    node docs/reviews/review-home-anime-polish.mjs
    node docs/reviews/review-home-pagehide.mjs

第一条的六尺寸、单次动画、reduce、hidden均通过；末尾额外 about:blank 探针未从跨文档 console 捕获可信 pagehide，因此原记录保留 passed=false 作为取证诊断，不能当作产品失败。仅补第二条同源 sessionStorage 探针后，该项关闭；未重跑已通过矩阵。

浏览器使用现有完整 Chrome for Testing，headless:true，未改变用户焦点。hidden 为明确标注的受控事件/属性模拟，不冒充真机后台；真实离页记录 persisted=false，不声称新增 BFCache 验证。真机触控、系统后台/锁屏/挂起及人工听检仍未验证。此次无新媒体，无旧播放器专项、安装、付费调用或实现写入。
