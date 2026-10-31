# AGENTS.md

给在这个仓库干活的 agent 的规矩。项目知识（页面清单、设计决策、尺寸常量）在
`.workbuddy/memory/MEMORY.md`，规范文件清单与关系图在 `docs/specs.html`——这里只写「怎么做才不浪费时间」。

## 一、项目速览

CommonVisual 是零构建的静态可视化站点，用逐步动画讲清 8 种分布式通信原语（gather / scatter / broadcast / reduce / allgather / allreduce / reducescatter / alltoall）。技术栈是纯 HTML + CSS + 原生 JS：全局命名空间 `window.CV` + defer 脚本，不用框架、不用 ESM、不用打包——「双击 html 就能看」是硬需求（file:// 下 ESM 被 CORS 拦）。核心入口是根目录 9 个 HTML（8 原语页 + index），每页是薄壳、只调 `CV.boot('<id>')`，内容全在 `assets/scenes/<id>.js` 纯数据剧本里；**规范页在 `docs/`**（prepost / algorithms / visual / specs / steps / test-cases），经 `../assets/` 引用底层组件——规范与业务代码两条线互不依赖，都只向下用组件。单一事实源是 `assets/registry.js`（每条原语的 pre / post 语义 + algo + rel + verbs），公共层 `assets/engine/`（compile / director / verbs）、`parts/`、`prim/`、`theme/` 被八页共用。唯一 dev 依赖 playwright-core，`tools/` 用无头 Chrome 跑几何断言与截图；仓库没有 build、没有 lint。

## 二、关键命令

```bash
npm i                                              # 首次：装 playwright-core（唯一依赖）；浏览器路径特殊时用 CV_CHROME / CV_PLAYWRIGHT_CORE
node tools/verify.mjs gather --no-shot             # 每次改完：结构断言 + 报错回显（单页 5–15 秒，11 页约 2 分钟）
node tools/verify.mjs gather scatter reduce ...    # 提交前 / 每日 09:30 定时：去掉 --no-shot 加截图比对（11 页 3–4 分钟）
node tools/probe.mjs gather 310:"(()=>{ ... })()"  # 写断言前量真值（十几秒）；刻度是 0–1000 的 scrub
```

分频规则（按 `docs/test-cases.html` 的用例组分频，不按改动大小）：

| 什么时候 | 跑什么 |
|---|---|
| 每次改完 | `verify <改到的页> --no-shot`（第 2/3/4 组 93 条结构断言）；**改公共层例外**：当次传 8 原语页 + index + docs/prepost.html + docs/visual.html |
| 提交前 / 09:30 定时 | 去掉 `--no-shot`：截图比对 + 人工观感（第 1 组 3 条） |
| 写断言前 | probe 量真值，再落成 `tools/probes/<页>.mjs`（与页面同名即自动配对） |

- 改哪页传哪页，别无脑全量；docs 规范页带路径传参（`verify docs/prepost.html`）。verify 顺带回显 `problems`（页面报错不用另开工具），退出码非 0 即失败——它就是本仓库的「测试」。
- 同一页的多条断言共用一次时间轴扫描，别各自 seek，否则「每次改完都跑」守不住。
- 顺序铁律：写完代码 → probe 量全部关键几何 → 只截 4 类帧确认观感（初始 `0@900` / 飞行中点 / 终态 `1000@1200` / 窄屏 `420×820`）。几何一律用数字量，截图只看颜色层次节奏；先截最可能出问题的 1 帧，别一次截 5 帧逐张读。

## 三、代码规范

- **薄壳页面**：HTML 只含 `CV.boot('<id>')`；内容、文案、时序全在 scenes 剧本，剧本必须是纯数据（能过 `JSON.stringify`）。加新页全流程见 `docs/architecture.html`。
- **单一事实源**：原语语义（pre / post / algo / rel / verbs）只写 `registry.js` 一份；动画终态唯一来源是 registry 的 `post`，页面和探针都读它，不许解析动画终态当事实。
- **命名对齐**：页面 id 贯穿全套——`gather.html` ↔ `scenes/gather.js` ↔ `probes/gather.mjs`；docs 规范页按文件名配对探针（prepost.mjs / visual.mjs），boot id 是分发键不随文件名（prepost.html 仍 `CV.boot('layout')`）；全局只经 `window.CV` 与约定数据位（如 `CV_PARAM_DEFAULTS`），不另起全局变量。
- **跨页零引用**：8 个页面 JS 互不引用，要复用就下沉公共层；公共层改动必须 8 页回归（用 probe，不用全截图）。
- **只有引擎碰时间**：时间轴编译一次，播放 / seek / 循环只是改 t 的推进方式；组件不自组合。
- **不硬编码**：尺寸、颜色、耗时走 theme 令牌与 `defaults.js`；scrub 用 0–1000 刻度、`controls.seek()` 用 0–1，换算交给页面 `getCh()`。
- **口径有出处**：文案与动态步骤看 `docs/steps.html`，组件真值看 `docs/visual.html`，算法口径看 `docs/algorithms.html`，用例清单以 `docs/test-cases.html` 为准（96 条＝通用 3 + 全站 20 + 原语页 60 + index 4 + 规范页 9，只有能判「过 / 不过」的验证动作才占编号）；改验证规则先改那一页，再同步本文件。
- **收尾五件事**：probe 回归 → README 页面表 / 目录树同步 → 新原语补四件套（薄壳 HTML + scenes 剧本 + registry 登记 + probes 断言）→ `.workbuddy/memory/` 当日日志（长期约定进 MEMORY.md）→ commit 正文写清「为什么这么改」。

## 四、边界与禁区

不要碰：

- `.workbuddy/memory/` 只追加不删改；`docs/bugs.md` 是缺陷台账——每日 09:30 定时巡检只记账不改码，人工发现的缺陷也记那里，别散落在聊天里。
- v1 已彻底删除：不存在 `assets/cv/*`，arch-standard / architecture.md 等 v1 旧文档不要恢复；现行架构标准是 `docs/architecture.html`（结构以 README 目录树为准）。
- 内容源 `分布式通信原语详解.md` 只读：NCCL 底层算法与「本项目映射」场景表都不是本站口径，内容源与实现冲突以实现为准；想引用它的说法，先改规范页再改代码。

禁止操作：

- 不引入框架 / 构建 / ESM，不升级、不新增依赖。
- 不做静默重构：公共层（engine / parts / prim / theme / boot / registry）一改 8 页几何全变，回归没跑不算完，红了的当场修。
- 不发无断言的截图；不给截图 / 验证命令加 `2>/dev/null`；不用 `/tmp` 散落脚本；工具不写死任何机器的路径。
- 不在写码阶段重新评估草图已定的算法骨架；几何公式先纸上算，不边截边调。

## 五、历史问题与注意点（一句话一条）

1. server 和 Chrome 必须在同一条 Bash 命令里——Bash 结束回收后台进程，拆开跑就每次 4 秒冷启动。
2. 端口写错加 `2>/dev/null` = 命令成功、图是错误页（8813/8814 事故）——截图脚本必须回显 `location.href` 和 `document.title`。
3. 两张截图字节数完全相同 = 一定是废帧，立刻查。
4. 把 0–1000 的 scrub 直接喂给 `seek()` 会被 clamp 成终态还报成功——识别法：截的是飞行中段、字幕却是收尾那句。
5. 有 CSS 过渡的帧 `@delay` ≥ 800ms、终态给足 1200ms，否则截到 fill / opacity 中间态，看着像 bug 其实不是。
6. `Runtime.evaluate` 必须 `returnByValue: true`，否则拿不到 `result.value`。
7. `curl` 要 `--noproxy '*'`——环境有系统代理，localhost 之外的请求会被拦。
8. Chrome remote-debugging-port 写死 9333：verify.mjs 已内置端口管理可一次多页，手写 probe 仍要一次一页，上一实例没退净会卡 15 秒后报错。
9. 飞行中点的 scrub 别手算——页面挂 `getCh()`，探针 `_common.mjs` 的 `sc(sec, total)` 现算；段边界（如 v250）是动画起点不是中点。
10. 算法骨架在写码阶段重新选型，代价是整文件重写 + 5 张截图全废（Reduce-Scatter 草图定的 recursive halving 被换成 ring）。
11. alltoall 对角线用直线中心交叉的前提是「每步最多一条对角线在动」——分步规则一改就会两包相撞，届时改回弧线或加法向偏移。
12. verify 的挂载超时是静默的（8 秒后照常跑）——头部行 `dur=null` 冒充通过，看 dur 是否为 null 才能识破。
13. 探针固定大步长会漏小窗口阶段（reducescatter 计算框只在合并段亮，step=120 漏拍被误判回归）——细扫或按页面 STEPS 定位阶段中点。
14. 写断言前先读 paint 里的初值，别从路由和步骤反推（gather `count` 从 1 起跳等 7 处口径修正的教训）。
15. 时间预算：新原语页 20–25 分钟、公共层改动回归 +10、每次返工 +8——超预算就是在返工，停下来重新想，别接着截图。
