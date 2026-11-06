# CommonVisual · 项目长期约定

NCCL 八个原语（gather/scatter/broadcast/reduce/allgather/allreduce/reducescatter/alltoall）的 Web 可视化。内容源 `分布式通信原语详解.md` **只作参考、不作标准**：NCCL 底层算法（ring 等）、「本项目映射」场景表都不是本站口径，骨架/段数/文案以 `assets/scenes/*.js` 剧本 + `assets/registry.js`（终态）+ `anatomy.html`（组件规范）+ `docs/narration.html`（文案）为准，冲突时以实现为准（见 AGENTS 三①，2026-10-31 定）。**开工前读仓库根 `AGENTS.md`**（验证方法论）；结构看 `README.md` 目录树，规范清单与关系图看 `docs/specs.html`。本文件记「项目是什么、有哪些约定和坑」。

## 文件构成（2026-11-07 起入库）
- `MEMORY.md`（本文件）= 长期约定与坑，人工提炼，每次开工先读。
- `YYYY-MM-DD.md` = 当天工作日志，**append-only**，只记有跨会话价值的落地与坑，不记临时路径/报错。
- `from-070d080b-20261030/` = 2026-10-30 从已删除开发 worktree 抢救出的旧日志快照，**仅供参考，不是现行约定**。
- `.workbuddy/memory/` 已纳入 git（`.gitignore` 只放行这一支），换设备 `git clone` 即可续用；日志是单机 append-only，别在多台机器同时改同一份日志（会冲突）。
- 日志索引见文末「日志索引」。

## 页面清单（2026-10-31 提根后：根目录即页面集，v1 已删）
- `index.html` 首页原语关系树；8 个原语页 = 薄壳 `<id>.html`（`CV.boot('<id>')`）+ `assets/scenes/<id>.js` 剧本（纯数据：节拍 + 流 + 文案，绘制与时序在引擎/动词层）。
- `layout.html`（对照表）/ `algorithms.html`（实现方式）/ `anatomy.html`（**组件与动效规范，唯一来源**）。原语页样式 `assets/theme/theme.css + stage-page.css`；文档页样式在 `assets/pages/`。
- **终态唯一事实 = `assets/registry.js`**（每页 `pre / post / rel / verbs`）；关系导航、对照表、规范页、探针都读它，别解析动画终态。
- 时序齿轮八页全接（2026-10-30）：`parts/chrome.js` X5 通用件，scene 声明 `gear:true`；family 页（reduce/allreduce/reducescatter/alltoall）的 rows 由各自动词产 `CV.timeRow`（`engine/compile.js`，与 choreo 同源）。改前存 win 基线比对，默认时间轴零漂移。

## anatomy.html 规范（改组件必先改这里）
- 一图胜千表：无表格说明段，一图一节+规则+chip。demo 调 `CV.draw*`，不手写 SVG，1:1 像素。
- 章节 01 完整数据 / 02 数据块 / 03 rank卡片(动态) / 04 连线箭头 / 05 数据包(动态) / 06 控制条 / 07 计算方框(动态) / 08 落位弹跳 / 09 融合 / 10 聚焦 / 11 舞台分层 / 12 两套尺寸 / 13 施工约定。
- tab：`addTabs(host,labels,render)` 通吃多态；只有真有两套尺寸才加 tab，「动态」一律排最后态。
- **03/07 动态**共用顶层 `easeIO/seg/anim/moveSlotY`，切 tab 前必停 rAF。03：h1 170→h2 203 绕中心扩，下排靠 opacity 现身。07：8s 循环，几何与内容拆两步，第二排透明度切换点必须落在 fade=0；占位框 ph 仅正向淡入。
- **05 动态**：`CV.placePacket` 按弧长取点；两个/四个=一份里几个块（整份包），宽=n×20+(n−1)×3+12；终点不放框，包中心落箭头尖(x=542)，停住**原地淡出**（淡的过程即停留）；时间轴 `DUR1.5+FADE.6`；切 tab 先 `cancelAnimationFrame`。
- **08 落位**：`.slot-pop` `.2,.9,.3,1.45`，峰值 1.29×@0.18s；重播 `删class→强制回流→加回`。**涟漪环不要**（`CV.SHOW_RING=false`）。
- **09 融合** `CV.createMerge`：位移↑缩放↓透明度↓三量单调；目标块不缩放只被白光扫；需 `transformBox='view-box'`。
- **10 聚焦** `attachFocus`：`hover||pinned`，状态写 `#stage` data-focus/data-pinned。
- **11 分层**：六固定 `<g>` `#lBg→#lCards→#lChips→#lWires→#lFx→#lLabels`，顺序永不动。
- 左侧 `.toc` 自动生成，<1280px 隐藏；scrollspy 判定线 32% 高，末节触底兜底，点击锁高亮。
- 控制条是 HTML 组件（demo 内死值与 `theme/stage-page.css` 双份，改样式要手动同步 —— BUGS 台账在记）；`CV.chrome.bar` 全局键盘仅 `root===document` 绑，有 `destroy()`。
- 两套几何 `G.desktop`(1130×680, card300×170, slot46/gap12, hdr36, title15, badge10) / `G.narrow`(380×720, 146×126, 25/5, 28, 12.5, 8.5)，断点 860。窄卡装不下四块（115>114）→ 窄屏一张卡只放一个块。
- 标注三档：够宽→灰尺寸线；<20px 缝→紫 `gapH`；贴边无参照→小字不画线。

## 八原语速记
语义：gather 拼 / scatter 拆 / broadcast 复制 / reduce 相加 / allgather 集齐 / allreduce 相加后每人一份 / reducescatter 分拆累加 / alltoall 每人发一段收一段。
- 段落数 6/6/6/9/5/4/4/4；前四页卡位「左目标+右三源一列」，ag/ar/rs/at 为 2×2 网格。
- reduce 铁律：上排唯一累加器，每来一份立刻折进。
- all-gather 环 N−1 轮（0→1→3→2→0）；all-reduce recursive doubling 两路。
- 源卡送完：reduce 清空（消耗），其余保留（复制）。

## 不能反悔的决策
- 整份包连线不按目标卡分色（会被读成「只收到 B/C/D」）；连线/箭头/整份包不带 `data-l`，包内小方块要带。
- 落地只做弹跳不要涟漪环。文案只写语义不暗示算法。骨架与配方是两层，别混表。
- 数据色 A`#7c3aed`/B`#0891b2`/C`#059669`/D`#d97706`，rank 与数据同色；终态深紫 `#4c1d95`(Σ)；整份包 `#8b93a6`。聚焦=hover||pinned。循环常开，倍速/循环开关已移除。
- **组件文档判据：参数 = 能被独立赋值的自由度**。凡「A 必然等于 B」或「A 由内容算出来」，A 不是参数：删掉、关系写进上一级描述，或换成真正决定它的量。已按此削：1.1.2 无 宽度/圆角（随卡片）、3.2.1 无 宽度（内边距 9 + 最小宽度 30）、层序搬到 `0.5`。

## 参数与时序（v2）
- 组件规范参数表在 `assets/theme/theme.js`（03-card / 05-packet / 07-calc / 08-seat / 09-merge / global），取值入口 `CV.specVal(key)` / `CV.dur(记号)`；规范值走记号/倍数，页面编排值直接写秒。
- 覆盖链 = 代码基线 ← localStorage：参数基线 `assets/theme/defaults.js`（`CV_PARAM_DEFAULTS`，须在 theme.js 前加载）← `localStorage('cv.params.v1')`；每页时序基线 `assets/scenes/pages-base.js`（`CV_PAGE_DEFAULTS`）← `localStorage('cv.page.<页>.v1')`。**两个基线文件在但尚未被任何页面加载 ——「保存到代码」落盘无效（BUGS 已记，待修）**。
- 齿轮 = `parts/chrome.js` X5：规范行填倍数（规范键/规范值/×k/秒），abs 行直接填秒；改值 → boot 的 onChange → `director.reload()`；**面板内改值只更新秒数列，别重建 DOM（失焦）**。
- `CV.choreo`（compile.js）：wait/transfer 节拍 → 显式分段表；transfer 自动展开 传递→落位延迟→落位弹跳→间隔（串行 travelEnd→fadeEnd→seatStart→seatEnd）。family 页 timeline（sum/split/move 动词）自算分段并产齿轮 rows；reduce/allreduce/alltoall 重复段共用一组（组头标进度条段号区间），reducescatter 平铺 14 行（行号=段号）。
- **逐动作解说**（2026-10-31 落地）：`assets/engine/narration.js` = 词表 CV.NARR_LEX（表外动作抛错）+ 五种时间轴生成器，秒数只从编译产物现取；齿轮第二页签渲染，高亮走 bar 的 onPaint 钩子。改文案：动作加词表、静止行写 scene `narr.rest`，别在生成器外手写句子。口径细则见 docs/steps.html §12。
- 进度条段宽 = 真实秒数（`steps[].t` 已按秒归一化）。等宽分段是错的。

## 技术坑（v2 仍适用）
- SVG 无 offsetWidth（用 getBoundingClientRect）；CSS `filter:grayscale` 对 SVG 不生效；`<circle>` 不写 fill 是黑的；CSS font-size 盖 SVG 属性 → 不给 `.gpu-title`/`.dst-badge`/`.slot-tx` 写 font-size，字号由 draw* 写属性。
- `CV.mix` 同时吃 hex/rgb 返回 rgb；二次混合只认 hex 会 NaN→纯黑。
- SVG 别叠两层 transform；位移缩放要先 `transformBox='view-box';transformOrigin='0 0'`。
- 卡片改高用 `CV.cast.resize`；连续渐隐渐现逐帧写 opacity 别用 transition；多段时间轴用秒写。
- **SVG marker 靠 id 全局共享**：一条边/一条流一个 marker，别按字母/轮次共用（否则箭头颜色互相覆盖）。
- 槽位淡入淡出在 `CV.cast.set` 之后写 opacity（set 会写 `style.opacity`）。
- 对照表 `'A'`/`'A:0'`/`'-'`；Σ 不加下标。收无头 Chrome：`lsof -nP -iTCP:$port -sTCP:LISTEN -t` 取 pid kill，别 `pkill -f`。

## 新增一个原语（v2 流程，全流程见 docs/blueprint.html）
1. `assets/scenes/<id>.js` 剧本 + 薄壳 `<id>.html`（脚本列表照抄现成页）。
2. `assets/registry.js` 登记 `pre / post / rel / verbs`。
3. `tools/probes/<id>.mjs` 断言 + `docs/testing.html` 补用例行。

## 验证（流程在 AGENTS，这里只记落点）
- **用例清单唯一来源 = `docs/testing.html`**（**100 条**：① 通用 3 ② 全站通用 20 ③ 原语页 60 ④ 静态页 17；2026-10-31 由 83 条拆分重排而来，旧编号映射见其页尾）。
- 全部已实现于 `tools/probes/<页>.mjs`（与页面同名自动配对；`_common.mjs` = 全站 20 条 + V1–V8 视觉契约，期望值 2026-10-30 实测；V4 空槽两态合法：`#f7f8fc` 空闲 / `#f3eeff` 接收中）。
- 当前门禁仅 3 紫：3.42 / 3.43（allreduce 采样锚点被字幕误匹配）、3.51（reducescatter 结束帧 −20 提前量）—— 待时序标准定稿后采样改 `win.*` 现算；另有审计发现登记在 testing.html 顶部③（只记录未排期，含 2.13a sum 族四页齿轮漏跑：场景声明 gear:true、探针写死 false）。
- 实测：12 页 `--no-shot` 约 2 分 20 秒。缺陷统一记 `docs/BUGS.md`（只记录，不改业务代码）。
- 写探针的坑：同卡多排槽位必须先按 y 再按 x（同 x 上下两排会交错）；t0 快照前先 seek(0)（页面自动播放）；rs/ar 块色走 `CV.mix` 输出 rgb() 串，比色前要归一；reduce 系槽→卡归属用「中心落卡内 + 底边 12px 容差」；`pg.goto` 只吃绝对 URL；anatomy 是单章视图（目录点击=切节，无真实 sec-NN 锚元素）。
- 依赖扫描：`node tools/arch.mjs [--json]`，改完公共层重跑（`docs/specs.html` 的图会过期）。

## 分支与推送
- 单 worktree（本目录 = main）。`remote.origin.url` 本身就是 SSH（`git@github.com:Chitandaaaaa/CommonVisual.git`），**直接 `git push` 即可**，不必手拼地址、也不必设 pushurl（HTTPS 被代理挡，见用户级 MEMORY）。
- 推前 `git status` + `git log --oneline -5` 对齐状态。
- `.workbuddy/memory/` 2026-11-07 起入库，删 worktree 不再需要手工备份 memory（旧约定作废）。

## 协作约定
- 多个问题一次说清；说清「什么时候」（进度条百分比/步骤名/终态）；给目标态+参照页；给验收标准（能直接变断言）；标优先级；别用「优化一下」这类没靶子的词。
- **每次任务收尾必须回溯本次所有中间步骤，给出 P0/P1/P2 分级改进意见**；P0 当场固化进工具或本文件。

## 日志索引（按时间，旧 → 新）
| 文件 | 主题 |
|---|---|
| 2026-10-22.md | 立项：Gather 页设计 |
| 2026-10-23.md | Broadcast 页（1→N，复制整份） |
| 2026-10-26.md | All-Reduce 页 |
| 2026-10-27.md | 首页原语树悬停高亮方向 bug |
| 2026-10-28.md | 规范页与对齐改造，提交推送 |
| 2026-10-29.md | anatomy 03 rank 卡片动态拆两场景 |
| 2026-10-30.md | 验证工具与文档提交 |
| 2026-10-30-gear-family.md | 四个 family 页接时序齿轮 |
| 2026-10-30-probes.md | 断言探针全套（tools/probes） |
| 2026-10-31.md | specs 清单对齐，提根到根目录 |
| 2026-11-02.md | 方案 A 校准收尾 + 05 组全绿 |
| 2026-11-03.md | 时序步骤名全站统一 |
| 2026-11-05.md | docs/组件文档.md 结构调整 |
| 2026-11-06.md | 组件文档规范收敛（参数单值化 / 复用规则 / 层序提通用） |
| 2026-11-07.md | memory 入库（本文件改为入库口径） |
