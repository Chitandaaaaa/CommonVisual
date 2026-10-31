# CommonVisual

**NCCL 集合通信原语的 Web 可视化** —— 把 gather / scatter / broadcast / reduce / all-gather / all-reduce / reduce-scatter / all-to-all 这八个抽象概念，画成看得懂的数据流动画。

零框架、零依赖、零构建：手写内联 SVG + 原生 `requestAnimationFrame` + IIFE。所有页面双击就能在浏览器里打开；只有跑验证工具才需要 `npm i`（只为装 playwright-core，页面本身不依赖）。

> 2026-10-31 起 v1 页面整套删除，v2 提为根目录 —— 本文档描述的就是 v2。

---

## 在线访问

启用 GitHub Pages 后，直接打开：

**<https://chitandaaaaa.github.io/CommonVisual/>**

## 页面一览

| 页面 | 说明 |
|---|---|
| [`index.html`](index.html) | **首页** —— 原语关系树，从这儿开始逛 |
| [`gather.html`](gather.html) | 收集 —— N 段拼成一份，只有 rank0 长大 |
| [`scatter.html`](scatter.html) | 分散 —— 一份拆成 N 段分给各人 |
| [`broadcast.html`](broadcast.html) | 广播 —— 一份复制给 N 人，每人都拿整份副本 |
| [`reduce.html`](reduce.html) | 归约 —— N 份相加成一份，累加器逐段折入 |
| [`allgather.html`](allgather.html) | 全收集 —— 2×2 网格顺时针转三轮，四张卡同步集齐 |
| [`allreduce.html`](allreduce.html) | 全归约 —— 每卡先持一整份四段，开场长出第二排，2×2 网格整份互换两轮（每轮 传递→落位→计算→合并），四段各自累加到 4 份，收场收回单排，四卡都是 `[Σ Σ Σ Σ]` |
| [`reducescatter.html`](reducescatter.html) | 归约分散 —— 递归减半两轮，每卡先长出第二排接收位，之后每轮「传递 → 落位 → 计算 → 合并」，段数 4→2→1 |
| [`alltoall.html`](alltoall.html) | 全互换 —— 上排待发、下排已收，按目的地分四步，12 条直连消息 |
| [`docs/prepost.html`](docs/prepost.html) | **通信原语语义（前后对照表）** —— 八个原语各自「通信前 / 通信后」每张卡的缓冲区，没变化的行置灰；数据来自 `registry.js` 的 pre / post |
| [`docs/algorithms.html`](docs/algorithms.html) | **算法口径** —— 每条原语五行：通信前 / 骨架 / 轮次 / 终态 / 锚点（占位稿：轮次、锚点待时序标准定稿收编） |
| [`docs/visual.html`](docs/visual.html) | **组件与动效规范** —— 一图一节、1:1 像素示例，右侧参数调试台实时改 |
| [`algorithms-old.html`](algorithms-old.html) | 退役备用 —— 旧「实现方式」页：六类骨架矩阵、八种骨架、All-Reduce 三条路线、NCCL 选型（不在验证范围，内容待并入算法口径） |

每个原语页页角有**关系导航**（`nav/`，数据来自 `registry.js` 的 `rel`）：横向是同族的全体版，纵向是同列的上/下一个，点原语名回首页。

## 本地运行

```bash
# 方式一：本地开发服务（推荐）
node tools/serve.mjs
# 然后访问 http://127.0.0.1:8000/
# 只有这种打开方式，「保存到代码」才能直接写回
#   assets/theme/defaults.js（参数基线）/ assets/scenes/pages-base.js（时序基线）

# 方式二：纯静态预览
python3 -m http.server 8000
# 「保存到代码」退化为下载文件（python 的服务不接受 POST）

# 方式三：直接双击 html 文件

# 跑验证工具（verify / probe）之前：
npm i        # 只装 playwright-core；浏览器自动探测 Chrome/Edge
```

## 架构：三层（剧本 → 引擎 → 动词）

页面是**薄壳**：原语页的 HTML 只做一行 `CV.boot('<id>')`，文档页多挂几个内容块。所有动态行为来自三层：

```
scenes/<id>.js     剧本 = 纯数据：节拍 + 流 + 文案（CV.scene 注册）
      │
engine/compile.js  剧本 → 时间轴。两条路径：
      │              ① choreo（gather/scatter/broadcast/allgather）：
      │                 节拍 wait/move/copy，move|copy 自动展开成
      │                 传递 → 落位延迟 → 落位弹跳 → 间隔 四段；
      │              ② family（reduce/allreduce/reducescatter/alltoall）：
      │                 动词按规范值 + 编排秒算显式分段表
      │              产物 { total, steps, win, rows, beats }
      │
engine/director.js 播放导演：seek / 播放 / 循环回绕，对外挂 CV.lastMount
      │
engine/verbs/      copy / move / sum / split 四个动词 —— 绘制与逐帧状态都在动词里
```

支撑层：

- `parts/` 舞台部件 —— `cast`（rank 卡 / 槽 / 数据块）、`payload`（连线 / 箭头 / 数据包）、`beat`（落位脉冲 / 融合）、`chrome`（时序齿轮面板 / 悬停聚焦 / 保存到代码）、`stage`（舞台骨架与图层）
- `prim/` 基础 —— `dom`（h/el/cubicBezier）、`geom`（几何常量）、`motion`（弹跳曲线 POP_EASE、`specVal`/`dur` 读规范值）
- `registry.js` **终态唯一事实** —— 每页的 `pre / post / rel / verbs`，关系导航、对照表、规范页、探针都读它，不解析动画终态
- `theme/defaults.js` 参数基线（规范页调试台「保存到代码」写入；读取顺序：代码基线 ← localStorage 临时改动）
- `nav/` 页角关系导航；`blocks/` 文档页内容块（head / table / toc / legend / anatomy / paramEditor）

## 目录结构

```
CommonVisual/
├── index.html              首页：原语关系树
├── gather.html … alltoall.html   8 个原语动画页（薄壳）
├── algorithms-old.html     退役备用：旧「实现方式」页（不在验证范围）
├── 分布式通信原语详解.md    内容源（仅作参考，不作标准 —— 口径以 scenes/*.js + registry.js 为准，见 AGENTS.md 三①）
├── docs/                   规范页：经 ../assets/ 引用底层组件，与业务代码两条线互不依赖
│   ├── architecture.html   架构标准：组件库与代码架构（分层 / 组件 / 扩展点）
│   ├── specs.html          规范清单与关系图（11 条）
│   ├── prepost.html      语义：前后数据布局对照表（registry 投影，原根 layout.html）
│   ├── algorithms.html     算法口径：每原语五行（通信前/骨架/轮次/终态/锚点，占位稿）
│   ├── visual.html         组件与动效规范：1:1 真值 + 参数调试台（原根 anatomy.html）
│   ├── steps.html          原语动态步骤规范：名词表 + 逐动作解说文案（原 docs/action.html）
│   ├── test-cases.html     验证用例清单（96 条，含旧编号映射）
│   └── bugs.md             缺陷台账（回归与人工验证统一追加）
├── tools/
│   ├── serve.mjs           开发服务 + 「保存到代码」写盘端点（POST /__cv/save，白名单两个基线文件）
│   ├── verify.mjs          页面验证：报错检查 + 几何探针 + 最小截图集
│   ├── probe.mjs           单点几何探针（查一个数，十几秒）
│   ├── browser.mjs         playwright-core / 浏览器装载（不写死任何机器的路径）
│   ├── arch.mjs            依赖扫描：HTML 引用 / CV.* 配对 / CSS 变量归属
│   └── probes/<页>.mjs     每页断言，与页面同名自动配对；_common.mjs 是全站通用 20 条 + V1–V8
├── assets/
│   ├── boot.js             CV.boot：建页壳 → 挂导航 → 导演挂剧本 → 需要时挂齿轮
│   ├── registry.js         终态唯一事实（pre / post / rel / verbs）
│   ├── scenes/             8 个原语页剧本（纯数据）
│   ├── engine/
│   │   ├── compile.js      剧本 → 时间轴（choreo / family 两条路径）
│   │   ├── director.js     播放导演
│   │   └── verbs/          copy / move / sum / split
│   ├── parts/              cast / payload / beat / chrome / stage
│   ├── prim/               dom / geom / motion
│   ├── nav/                edge / node / mini
│   ├── blocks/             head / table / toc / legend / anatomy / paramEditor
│   ├── pages/              文档页样式（index / docs / anatomy / algorithms）
│   └── theme/              theme.js/css + stage-page.css（舞台样式真源）
│                           + defaults.js（参数基线）
└── package.json            仅验证工具需要（playwright-core）
```

## 验证

验证纪律（先 probe 后截图、验收分频、CDP 坑）见 [`AGENTS.md`](AGENTS.md)；用例清单是 [`docs/test-cases.html`](docs/test-cases.html)（96 条：通用 3 + 全站通用 20 + 原语页 60 + index 与规范页 13，全部已实现）。一图流：

```bash
node tools/verify.mjs <页> --no-shot   # 结构断言，每次改完跑（改哪页传哪页）
node tools/verify.mjs <页>             # + 最小截图集，提交前跑
node tools/probe.mjs <页> <刻度>:"<表达式>"   # 单点几何，写断言前量真值
```

## 设计决策

**规范是唯一来源。** 组件的名字、尺寸、配色、耗时都在 `docs/visual.html` 约定；参数基线写在 `theme/defaults.js`（调试台「保存到代码」直接覆盖）。原语页在**加载时**读规范值算时间轴（`CV.specVal` / `CV.dur`），改规范要刷新页面才生效。

**齿轮已接入八页。** 右上角齿轮（`parts/chrome.js`）按页列时序行：有规范值的段调「倍数」（规范一改全站跟），没约定的段直接填秒。改动两级存：localStorage `cv.page.<页>.v1` 立即重排，点「保存到代码」写入基线（`node tools/serve.mjs` 下直写 `assets/scenes/pages-base.js`，静态服务退化为下载）。

**一个 transfer 段 = 「一趟传递」，不是「一条流」。** choreo 的 `move` / `copy` 自动展开成四段：传递（规范·数据包整段）→ 落位延迟（自定秒）→ 落位弹跳（规范）→ 间隔（自定秒），严格串行。all-gather 每轮四条边同时发，一轮就是**一个**段；gather / broadcast / scatter 的三趟串行，所以是三个段。

**时间轴用「秒」写。** 归一化进度容易算错间隔，compile / verbs / 探针全部用秒，进度条刻度（0–1000）只在控件层换算。

**送出是消耗语义（move），broadcast 才是复制（copy）。** sum 是归约（累加器逐段折入，Σ 上标可见），split 是切分。四个动词对应四种数据语义，页面不自己发明。

**槽位三态语言。** ① 实心彩色块 = 有数据；② 浅紫底「···」= 接收位（只给等着收的格子）；③ 浅灰虚线框 = 空。**送出的那一格是「空」，不是「接收位」。**

**reduce 家族通信前每卡一整份。** 数据切成四片、各卡只持一片时 reduce 根本用不了 —— 那是 all-gather 的起点。gather / all-gather 通信前是各卡 1 片；reduce / all-reduce / reduce-scatter 通信前是各卡一整份。

**All-Reduce 的「双车道」。** 交换是双向的，同一条边上两个包对向而行，法向偏移的符号由行进方向自动反转；偏移量必须 ≥ 包半宽才看得出是两条道（数值见 `engine/verbs/sum.js` 的 HUMP 常量）。

**Reduce-Scatter 用递归减半，不用环形。** ring 的段号会错开一格（卡 k 最后拿到第 k+1 段），和对照表「卡 k 留第 k 段」对不上；递归减半的两轮配对（先同列、再同行）天然对齐，还和 all-reduce 共用同一张 2×2 网格。

**All-to-All 必须画两排缓冲。** 原地转置：上排待发（每步清空一格）、下排已收（轮到自己时一次填满）。12 条消息按目的地分 4 步；连线不画箭头 —— 每条边两个方向都要用，方向交给数据包表达。

**「一排 ↔ 两排」整页只做两次。** 三页（reduce 家族）统一：开场预留（长出第二排，只一次）→ 循环「传递 → 落位 → 计算 → 合并」→ 收场收窄（逐块撤 → 收卡，只一次）。循环期间卡片停在两排高，只在「计算」那一拍临时长一层放方框。

**字号写在属性上，CSS 只留字体族。** 标题 / 徽章 / 块内字母的 `font-size` 由绘制函数（`parts/cast.js`）按参数写在属性里；CSS 再写一条会盖掉属性，窄屏就会顶着桌面字号。

**CSS 曲线用 JS 复刻。** 落位弹跳是 `cubic-bezier(.2, .9, .3, 1.45)`，`CV.cubicBezier()` 在 JS 里逐点复刻（`prim/motion.js` 的 `POP_EASE`）—— 不给 SVG 元素套 CSS 动画（双层 transform 会让 Chrome 提合成层并丢填充色，渲染成黑块）。

**首页按屏宽等比放大。** `assets/pages/index.css` 有缩放系数 `--s`（≤1499 为 1，逐档放大），所有尺寸写成 `calc(Npx * var(--s))`；加新尺寸别再写字面 px。

## 交互

- 循环播放常开，进度条分段数 = 步骤数，可拖动跳步
- 悬停任意数据块 → 同类保持彩色，其余缓缓褪成灰；点击可「钉住」聚焦
- 键盘可操作：Tab 走节点，Enter/Space 触发

## 许可

MIT
