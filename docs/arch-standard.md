# 架构标准：当前 / 目标 / 拆分判据

> 用途：**拆任务前先查这里**。它回答三个问题：
> ① 现在长什么样 ② 应该长什么样 ③ 这个任务能不能和别人同时做。
>
> **看图版：[`arch-standard.html`](arch-standard.html)**（同样的内容，图为主；文本细则以本文为准）
>
> 相关文档：`AGENTS.md`（验证流程）、`docs/blueprint.html`（新页蓝图）、
> `.workbuddy/memory/MEMORY.md`（约定与坑）。
> 本文的数据由 `node tools/arch.mjs` 扫描得出，不是回忆。

---

## 一页速查

**三条不变式**（目标架构的全部要求，不多于此）：

| # | 不变式 | 含义 | 违反了会怎样 |
|---|---|---|---|
| **I1** | **页面独占** | 同一个文件只被一个「任务单元」写 | 两个任务改同一文件 → git 冲突、回归互相甩锅 |
| **I2** | **单向依赖** | 依赖只能向下（页面→装配→骨架→绘制→工具→令牌），不许反向 | 改下层要动上层，拆分边界失效 |
| **I3** | **单一事实源** | 一个概念只有一处定义 | 改一处漏一处，两处慢慢不一致 |

**当前状态**：I2 违反 1 处、I3 违反 3 处、I1 违反 1 处（详见 §2.4）。

**拆任务只看一句话**：
> 只动 `P0x` + 它自己的 `S0x` → 可以并行。碰 `R*`（共享运行时）→ 必须排队。

**标准件**：目标态共 **36 件**，四段编号 `R` 运行时 / `P` 页面 / `S` 样式 / `T` 工具，
数字即层序、依赖只许指向更小的数字 —— 见 §4.0，那一节是目标架构的词汇表。
§4.0–4.1 描述的是**目标态本身**，与现有代码怎么写无关；从现状搬过去见 §4.2。

---

## 二、当前架构

> **⚠️ 时效说明（2026-10-31）**：本章写的「当前」是 v1（`assets/cv/` 体系）。v1 已整体删除、
> v2 提为根目录，本章仅存档对照用；现状请以仓库目录 + `node tools/arch.mjs` 扫描为准。

### 2.1 分层

```
┌─ L6 页面（12 个 html，各自独立，互不引用）────────────────────────────┐
│  8 原语页             anatomy              layout · algorithms · index │
│  gather … alltoall    (规范页)             (静态文档 3 页，不碰 cv/)    │
└────────┬──────────────────┬──────────────────────────┬───────────────┘
         │ 8 页             │ 1 页                     │ 不依赖 cv/
         ▼                  ▼                          ▼
┌─ L5 装配 ────────────────────────────────────────────────────────────┐
│  gear.js（4 页齿轮）        paramEditor.js（仅 anatomy）              │
└────────┬──────────────────┬──────────────────────────────────────────┘
         ▼                  ▼  ⚠ 反向：paramEditor → anatomy.js
┌─ L4 骨架 ────────────────────────────────────────────────────────────┐
│  primitive.js（8 页挂载契约 · 16 API）   relmap.js（8 页导航 · 0 依赖）│
└────────┬─────────────────────────────────────────────────────────────┘
         ▼
┌─ L3 绘制 ────────────────────────────────────────────────────────────┐
│  kit.js   23 API / 897 行 / 12 个使用方                              │
│  ⚠ 混装：draw* 绘制 + CV.params 注册表 + GEO_BASE/geo 几何 + saveFile │
└────────┬─────────────────────────────────────────────────────────────┘
         ▼
┌─ L2 基础 ────────────────────────────────────────────────────────────┐
│  dom.js(8)        controls.js(1)        focus.js(1)                  │
└────────┬─────────────────────────────────────────────────────────────┘
         ▼
┌─ L1 数据 ────────────────────────────────────────────────────────────┐
│  tokens.js（规范数值基线）  pages.js（每页时序基线，4 页共写）        │
└──────────────────────────────────────────────────────────────────────┘

CSS（与 JS 分层平行）：stage.css(8 页) / layout.css(3 页) / anatomy.css / algorithms.css / index.css
⚠ 11 个同名变量有 2–3 份独立定义，`--bg` 三份且 index 的值不同
```

### 2.2 四族与引用规模

| 族 | 页面 | 加载的共享文件 | 特征 |
|---|---|---|---|
| **A 原语动画** | 8 个 | stage.css + dom + tokens + kit + controls + focus + relmap + primitive（4 页另加 pages + gear） | 8 个页面 js 之间**零依赖**，最大的可并行资产 |
| **B 规范** | anatomy | layout.css + anatomy.css + dom + tokens + kit + controls + focus + paramEditor | 与 A 族只共享 kit/controls/focus/dom |
| **C 静态文档** | layout / algorithms / index | layout.css（仅 algorithms） | 不碰 `cv/`，天然独立 |
| **D 工具链** | — | 读所有页面；serve.mjs 可写 tokens.js / pages.js | 只读为主，serve 是唯一写盘入口 |

### 2.3 五个全局锁

| 锁文件 | 影响面（扫描值） | 为什么是锁 |
|---|---|---|
| `cv/kit.js` | **12 个 JS 使用方**（8 页 js + anatomy.js + primitive + gear + paramEditor） | 唯一收敛点，四种职责混装 |
| `cv/primitive.js` | 8 页 | `CV.primitive(cfg)` 的 cfg 契约一变，8 页全跟 |
| `assets/stage.css` | 8 页 | 外观 + `.ctl-demo` 死值手抄（改一处要同步两处） |
| `cv/tokens.js` + `cv/pages.js` | 全站 / 4 页 | **单文件多写者**：anatomy 写 tokens，4 个齿轮页共写 pages |
| `cv/relmap.js` | 8 页 | `REL / EN / CN / HREF` 四张表手抄自 index 树，无自动校验 |

### 2.4 违反不变式的地方（只有 5 处，都很小）

| 不变式 | 违反点 | 现状 | 后果 |
|---|---|---|---|
| **I1** | `cv/pages.js` | 4 个齿轮页都往这一个文件写 | 「给剩余 4 页接齿轮」无法并行 |
| **I2** | `cv/paramEditor.js → assets/anatomy.js` | 调 `showSection` 做章节定位 | 工具依赖页面，两边都不能独立拆 |
| **I3** | 色板 `:root` | index / layout / stage 各一份，11 个变量重复 | 改主题要改 3 处 |
| **I3** | 原语拓扑 | relmap 四表（`REL`/`EN`/`CN`/`HREF`）+ index 树 + layout `PRIMS` + README 表 = **7 个定义点** | 新增原语是跨族手术 |
| **I3** | 参数默认值 | 代码内 SCHEMA 默认 + tokens.js 覆盖 | 有意为之（基线覆盖机制），不算缺陷 |

---

## 三、组件清单

锁等级：🔴 全局锁（≥4 页）· 🟡 局部（1–3 使用方）· 🟢 独占（只有它自己）

### 3.1 运行时 `assets/cv/`（10 个文件）

| 文件 | 行 | 职责 | 对外 API | 依赖 | 使用方 | 锁 |
|---|---|---|---|---|---|---|
| `dom.js` | 88 | DOM/SVG 小工具：`$` `$$` `el` `h` `clamp` `mix` `easeInOutQuad` `cubicBezier` | 8 | 无 | 9 页 + kit/controls/focus/primitive | 🟡 |
| `tokens.js` | 40 | 规范数值基线 `window.CV_PARAM_DEFAULTS`（anatomy 回写） | 0（纯数据） | 无 | kit 读（9 页加载） | 🟡 |
| `kit.js` | 897 | 绘制原语：卡片/槽位/连线/包/图例/弹跳/融合/**+ 参数注册表 + 几何 + 存档** | 23 | dom | 12 个 JS | 🔴 |
| `controls.js` | 189 | 播放控制：分段进度条、播放/步进、键盘、字幕 | 1 | dom | primitive、anatomy.js | 🟡 |
| `focus.js` | 78 | 悬停聚焦 + 点击钉住（读 `data-l` / `data-card`） | 1 | dom | primitive、anatomy.js | 🟡 |
| `relmap.js` | 154 | 左上角关系导航；读 `body[data-rel]`，**自执行无导出** | 0 | 无 | 8 页 | 🔴 |
| `pages.js` | 12 | 每页时序基线 `window.CV_PAGE_DEFAULTS`（齿轮回写） | 0（纯数据） | 无 | primitive 读、gear 写 | 🔴 |
| `primitive.js` | 438 | 8 页公用骨架：舞台/清层/viewBox/双几何/860 断点/resize/controls/focus + `CV.choreo` 时序 | 16 | dom, kit, controls, focus | 8 页 + gear | 🔴 |
| `gear.js` | 344 | 每页右上角时序齿轮（行首编号=进度条第几段） | 1 | primitive, kit | 4 页 | 🟡 |
| `paramEditor.js` | 398 | 规范页右侧调试台（手风琴 + 保存到代码） | 1 | kit, **anatomy.js** ⚠ | 1 页 | 🟡 |

### 3.2 页面脚本 `assets/*.js`（12 个，全部 🟢 独占）

| 文件 | 行 | 职责 | 依赖 | 导出 |
|---|---|---|---|---|
| `gather.js` | 283 | 拼：4 段汇入 rank0 | primitive, kit, dom, gear | 0 |
| `scatter.js` | 268 | 拆：rank0 一份拆 4 段 | primitive, kit, dom, gear | 0 |
| `broadcast.js` | 266 | 复制：一份发给 4 人 | primitive, kit, dom, gear | 0 |
| `reduce.js` | 461 | 归约：4 份相加，累加器逐段折入 | primitive, kit, dom | 0 |
| `allgather.js` | 318 | 全收集：环 N−1 轮 | primitive, kit, dom, gear | 0 |
| `allreduce.js` | 588 | 全归约：2×2 两轮整份互换 | primitive, kit, dom | 0 |
| `reducescatter.js` | 603 | 归约分散：recursive halving 两轮 | primitive, kit, dom | 0 |
| `alltoall.js` | 273 | 全互换：12 条直连消息 | primitive, kit, dom | 0 |
| `anatomy.js` | 2367 | 13 章组件规范（唯一事实源） | kit, controls, focus, dom | `showSection` |
| `layout.js` | 281 | 前后对照表，数据在 `PRIMS` | 无 | 0 |
| `algorithms.js` | 246 | 原语 × 算法骨架矩阵 | 无 | 0 |
| `index.js` | 96 | 首页原语树的交互 | 无 | 0 |

> 每个页面 js 都只声明：`data / geo / steps / duration / retime / keepCards / onReset / build(S) / paint(S,t)`。
> **互不引用**是这个项目最值钱的结构性质，任何改动都不许破坏它。

### 3.3 样式 `assets/*.css`（5 个）

| 文件 | 行 | 职责 | 定义 `:root` | 页数 | 锁 |
|---|---|---|---|---|---|
| `stage.css` | 668 | 8 原语页外观 + 控制条 + 聚焦态 | ✅（复制 layout 的色板 + 控制条色） | 8 | 🔴 |
| `layout.css` | 323 | 文档型页面基线（对照表/规范页共用） | ✅ | 3 | 🟡 |
| `anatomy.css` | 638 | 规范页增量（TOC、调试台、demo 网格） | ❌ 全靠 layout.css | 1 | 🟢 |
| `algorithms.css` | 233 | 算法页增量 | ❌ 全靠 layout.css | 1 | 🟢 |
| `index.css` | 545 | 首页外观 + `--s` 大屏缩放系数 | ✅（与另两份同名不同值） | 1 | 🟢 |

### 3.4 工具链 `tools/`（5 个，全部 🟢 只读，除 serve）

| 文件 | 职责 | 写盘 |
|---|---|---|
| `serve.mjs` | 本地服务 + `POST /__cv/save`，**唯一写盘入口**（白名单：tokens.js / pages.js） | 可写 2 个配置 |
| `verify.mjs` | 一次 Chrome 启动：报错检查 + 几何探针 + 最小截图集 | 截图文件 |
| `probe.mjs` | 单点几何查询 | 无 |
| `arch.mjs` | 依赖扫描（本文数据来源） | 无 |
| `probes/<page>.mjs` | 每页断言，`check(pg)` 被 verify 调用；**当前仅 reducescatter 有** | 无 |

---

## 四、目标架构

**前提：哲学不变。** 仍是零框架、零构建、IIFE、全局 `CV` 命名空间、双击可开。

下面 4.0–4.1 描述的是 **目标态本身**（与现有代码怎么写无关），是后续所有讨论的词汇表。
怎么从现状搬过去，见 4.2 的五次搬家。

### 4.0 标准件目录（36 件 · 编号即层序）

**这是目标架构的唯一词汇表。** 目标态的一切讨论都用编号，不用文件名。
每件只回答三件事：**干什么**、**对外露出什么**、**读谁 / 被谁读**。

编号规则三条（可机械检查，不需要画图）：

1. **数字 = 层序**：`R01` 在最低层（令牌），`R14` 在最高层（装配）。看编号就知道它在第几层。
2. **依赖只许指向更小的数字**：`R08 → R05 → R03 → R01` 合法；`R05 → R08` 非法。反向依赖不用画图，比大小即可。
3. **落盘只写三件**：`R01` / `R02` / `R07`，一律经 `T01`；其中 `R07` 按页分文件 → I1 成立。其余 33 件运行时只读。

前缀：`R` 运行时 · `P` 页面 · `S` 样式 · `T` 工具链。

| 编号 | 文件 | 层 | 干什么 | 契约（对外露出什么） | 读谁 / 被谁读 |
|---|---|---|---|---|---|
| **R01** | `cv/tokens.css` | L0 | 全站唯一 `:root`：色板 / 圆角 / 字号 / 间距。任何样式表不再自带变量定义 | CSS 变量 `--bg --panel --line --tx --accent …`（无 JS API） | 无 / S01–S05 |
| **R02** | `cv/tokens.js` | L0 | 参数的出厂值，所有参数从它起步 | `window.CV_PARAM_DEFAULTS` | 无 / R05 R06 R07 |
| **R03** | `cv/dom.js` | L1 | DOM/SVG 的构造与查询，8 个 API，无业务语义，可整体替换 | `CV.el · attr · box · showSection` | 无 / R04 R05 R08 R09 R10 R14 |
| **R04** | `cv/save.js` | L1 | 存档 IO：写成代码、POST `/__cv/save`、导出日志；无服务端时退化成下载 | `CV.saveFile(target, payload)` | R03 / R14 |
| **R05** | `cv/kit.js` | L2 | 唯一会画东西的件：`draw*` 原语、几何 `geo/GEO_BASE`、色板 `PALETTE` | `CV.drawCard · drawSlot · drawWire · drawPacket · geo` | R03 / R08 R13 R14 · P01–P08 |
| **R06** | `cv/params.js` | L3 | 参数注册表：SCHEMA 分节、取默认值、读写、onChange、localStorage 覆盖 | `CV.params.get · set · specVal · specGroup · onChange` | R02 / R13 R14 · 全部页面 |
| **R07** | `cv/pages/<page>.js` | L3 | 每页的时序基线，一页一个文件 | `CV_PAGE_DEFAULTS`（按页一份，互不可见） | R02 / R08 R13 |
| **R08** | `cv/primitive.js` | L4 | 8 页共用骨架：`buildStage` + `mount`，卡 / 槽 / 线 / 包 / 落位 / 时钟 | `CV.primitive(cfg) → { reload, … }` | R03 R05 R09 R10 / P01–P08 · R13 |
| **R09** | `cv/controls.js` | L4 | 进度条、播放暂停、字幕、全局键盘，带 `destroy()` | `CV.createControls({ root }) → { destroy }` | R03 / R08 · 全部 12 页 |
| **R10** | `cv/focus.js` | L4 | 悬停聚焦 + 点击钉住（靠 `data-l` / `data-card` 契约） | `CV.attachFocus(stage)` | R03 / R08 · P01–P08 |
| **R11** | `cv/relmap.js` | L4 | 顶部关系导航，纯渲染器，自身不含任何原语数据 | `CV.relmap(host, current)` | R12 / P01–P08 |
| **R12** | `cv/graph.js` | L4 | 原语拓扑的唯一事实源：关系、中英名、页址 | `CV.graph.prims · rel · href` | 无 / R11 P10 P12 |
| **R13** | `cv/gear.js` | L5 | 每页齿轮：按章节列时序参数，改值即重挂载；`CV.choreo` 把步骤展开成真实秒数 | `CV.choreo(page) · CV.gear.mount()` | R05 R06 R07 R08 / 4 个齿轮页 |
| **R14** | `cv/paramEditor.js` | L5 | 规范页右侧整高抽屉调试台，收起成 ⚙ FAB | `CV.paramEditor.mount()` | R03 R04 R05 R06 / P09 |
| **P01–P08** | `assets/{gather,scatter,broadcast,reduce,allgather,allreduce,reducescatter,alltoall}.js` | L6 | 8 个原语页：只声明 `data / geo / steps / build / paint` | 交给 R08 的 cfg 五段 | R06 R07 R08 R09 R10 R11 / 无（互不引用） |
| **P09** | `assets/anatomy.js` | L6 | 规范页：组件与动效的唯一来源 | 13 章 demo，各调 `CV.draw*` | R09 R14 / 无 |
| **P10** | `assets/layout.js` | L6 | 静态对照表 | 读 R12 的拓扑 | R11 R12 / 无 |
| **P11** | `assets/algorithms.js` | L6 | 静态实现方式页 | R09 实例 | R09 / 无 |
| **P12** | `assets/index.js` | L6 | 首页原语关系树 | 读 R12 的拓扑 | R11 R12 / 无 |
| **S01** | `assets/stage.css` | 样式 | 8 原语页外观 + 控制条 | 只 link R01 | R01 / P01–P08 |
| **S02** | `assets/layout.css` | 样式 | 文档型页面基线 | 只 link R01 | R01 / P09 P10 P11 |
| **S03** | `assets/anatomy.css` | 样式 | 规范页增量 | 只 link R01 | R01 / P09 |
| **S04** | `assets/algorithms.css` | 样式 | 算法页增量 | 只 link R01 | R01 / P11 |
| **S05** | `assets/index.css` | 样式 | 首页样式 + 大屏缩放 | 只 link R01 | R01 / P12 |
| **T01** | `tools/serve.mjs` | 工具 | 本地服务 + 唯一写盘端点（白名单 R01 / R02 / R07） | `POST /__cv/save` | — / R13 R14 |
| **T02** | `tools/verify.mjs` | 工具 | 报错检查 + 几何探针 + 最小截图集 | CLI | — / 人 |
| **T03** | `tools/probe.mjs` | 工具 | 单点几何查询 | CLI | — / 人 |
| **T04** | `tools/arch.mjs` | 工具 | 依赖扫描，本文与图版的数据源 | CLI `--json` | — / 人 |
| **T05** | `tools/probes/<page>.mjs` | 工具 | 每页断言，`verify` 自动加载 | 导出的断言函数 | — / T02 |

一件装配链长什么样（以 gather 为例，注意编号一路变小）：

```
P01 gather.js
  └─ 建舞台 → R08 primitive ─ 画 → R05 kit ─ 建元素 → R03 dom ─ 取样式 → R01 tokens.css
                ↑
     旁支：R06 params（读参数）· R07 pages/gather（读本页时序）
           R09 controls（控制条）· R10 focus（聚焦）· R11 relmap → R12 graph
```

**运行时能写的地方只有三处**，其余 33 件只能由人用编辑器改：

| 写什么 | 谁写 | 影响范围 |
|---|---|---|
| `R07` | R13 齿轮（经 T01 落盘） | 只这一页 |
| `R02` | R14 调试台（经 T01 落盘） | 全站组件规范 |
| `R01` | T01（手工，或未来由 R14 生成） | 全站外观 |
| `localStorage` | R06 · R13 | 本机本页临时值，不落盘 |

### 4.1 目标分层（7 层，每层只被上层读）

```
L6 页面    P01–P08 八个原语页  │  P09 规范页  │  P10–P12 静态三页
                    ↓ 引用（编号一路变小）
L5 装配    R13 gear              │  R14 paramEditor
L4 骨架    R12 graph  R08 primitive  R09 controls  R10 focus  R11 relmap ←R12
L3 配置    R06 params  │  R07 pages/<page> ×4        ← 页内配置，一页一个文件
L2 绘制    R05 kit（draw* / geo / PALETTE）
L1 工具    R03 dom     │  R04 save
L0 令牌    R01 tokens.css（唯一 :root）  │  R02 tokens.js

皮肤       S01–S05（只 link R01，不自带 :root）
离线       T01–T05（只读，除 T01 的写盘白名单）
```

**目标状态的读写方向**（这是 I2 的核心）：

```
P01 ──读──▶ R08 ──读──▶ R05 ──读──▶ R03 ──读──▶ R01
 │           │
 └──读配置──▶ R06 / R07 ──读──▶ R02
```

即：**写只发生在 L3 配置，读只向下**。配置是唯一可写层，且按页分文件 → I1 成立。

### 4.2 五次搬家（全部一次性、纯机械、不改行为）

| # | 从 | 到 | 解决 | 影响面 | 风险 |
|---|---|---|---|---|---|
| **M1** | `R05` 里的 `CV.params` | **`R06`** `cv/params.js` | kit 混装 | kit 内 3 处引用 + 8 页读 `CV.params` | 低（改加载顺序 + 一处引用） |
| **M2** | `R05` 里的 `saveFile` | **`R04`** `cv/save.js` | kit 混装（IO 与绘制无关） | gear、paramEditor 各 1 处 | 极低 |
| **M3** | `pages.js` 单文件 | **`R07`** `cv/pages/<page>.js` ×4 + 索引 | **I1** 多写者 | primitive 的 `pageOv*` 4 个函数 | 中（涉及写盘路径与 serve 白名单） |
| **M4** | `S01`/`S02`/`S05` 三份 `:root` | **`R01`** `cv/tokens.css` | **I3** 色板 3 副本 | 5 个 css + 12 个 html 的 link | 中（要逐页核对变量是否齐全） |
| **M5** | `R11` 四表 + `P12` 树 + `P10` 的 `PRIMS` | **`R12`** `cv/graph.js` | **I3** 拓扑 7 个定义点 | relmap 8 页、index、layout | 中（layout 的 `pre/post` 是内容不是清单，仍留本地） |

做完 M1–M5 后的效果：

| 指标 | 现在 | 目标 |
|---|---|---|
| 改 `R05` 的影响面 | 12 个使用方（含配置、IO 改动也牵连） | 只剩「新增绘制能力」，纯加法 |
| 「给某页接 R13」能否并行 | ❌ 4 页共写 `pages.js` | ✅ 各写 `R07` |
| 改主题色 | 改 3 处，且值不一致 | 改 `R01` 一处 |
| 新增原语要动几处 | **9 个编辑点**（2 新建 + 7 处同步清单） | **3–4 个**（2 新建 + `R12` 注册一行 + `P10` 内容一项） |
| 反向依赖 | 1 处（`R14` → `P09`） | 0（`showSection` 下沉到 `R03`） |

> M5 落地时顺便消掉 I2 那 1 处：把 `showSection` 的锚点跳转逻辑移进 `cv/dom.js`（`R03`，纯选择器操作），
> `R14` 就不再需要认识 `P09`。

### 4.3 目标状态下一个原语页的「五件套」

全部按页命名 → 五个文件互不相交，任两页任务天然并行：

```
gather.html                        页面结构
P01  assets/gather.js              内容：data / geo / steps / build / paint
R07  cv/pages/gather.js            时序基线（R13 齿轮写这里）
T05  tools/probes/gather.mjs       验收断言
localStorage['cv.page.gather.v1']  运行时临时改动（不落盘）
```

---

## 五、拆分判据（后续拆任务就用这节）

### 5.1 判定树

```
Q1  只动 P0x + 它自己的 S0x（+ 该页 T05）？
    ├─ 是 → ✅ 并行。验收只跑 node tools/verify.mjs <page>
    └─ 否 ↓
Q2  动的是 L3 配置（R06 params / R07 pages/<page>）？
    ├─ R07（M3 之后）→ ✅ 并行（另外几页互不影响）
    ├─ R07（M3 之前）→ ⚠ 4 页共写一个文件，排在「齿轮」串里
    └─ R06 / R02 → 🔴 串行（全站参数，12 页都受影响）
Q3  动的是 L1/L2/L4（R03 R05 R08 R09 R10 R11 R12）或 S01–S05？
    └─ 🔴 串行。改完当次跑八页全量 probe（不等每日定时回归）
Q4  动的是 L0 令牌（R01 / R02）？
    └─ 🔴 串行。改完跑 12 页全量验证
```

### 5.2 文件归属矩阵（谁能动什么）

| 并行单元 | 可写 | 只读 | 禁止 |
|---|---|---|---|
| `P0x` 原语页 | `P0x` · 它自己的 `S0x` · `T05` 的该页 · `R07` 的该页（M3 后） | 其余 `R*` | 其他 `P` |
| `P09` 规范页 | `P09` · `S03` · `T05` 的该页 | 其余 `R*` | 其他 `P` |
| `P10` layout | `P10` · `T05` 的该页 | `S02` · `R11` · `R12` | 其他 `P` |
| `P11` algorithms | `P11` · `S04` | `S02` · `R03` · `R09` | 其他 `P` |
| `P12` index | `P12` · `S05` | `R11` · `R12` | 其他 `P` |
| `R06` params | `R06` | 其余全部 | — |
| `R07` pages/* | 只有自己那一页的文件 | 其余全部 | 别人那页的 `R07` |
| `R03` `R05` `R08` `S01` `S02` | **共享区：必须单独排队**，改完跑全量 | — | — |

### 5.3 任务卡模板

```markdown
任务：<一句话，可验收>
层：L6 页面（或 L2 绘制 / L3 配置 …）
可写：P08 · assets/alltoall.js
禁写：R* / S* / 其他 P
依赖：R08（只读）；或「需先完成 M3」
验收：node tools/verify.mjs alltoall；断言「终态四卡都是 Σ」
```

### 5.4 五类任务的标准做法

| 任务类型 | 允许动 | 禁止动 | 验收 |
|---|---|---|---|
| 单页动画/文案调整 | `P0x` + 该页 html | 所有 `R*` | 该页 `verify` |
| 给某页接齿轮 | 该页 html、`P0x`、`R07` 的该页 | `R13` 本体 | 该页 `verify`，检查进度条段宽 = 真实秒数 |
| 组件规范变更 | `P09`、`R05` 对应 `draw*`、`R06` 的 SCHEMA | 各页 paint | 八页全量 probe + 逐页目视终态 |
| 全局视觉/主题 | `R01` | 各页内联色值、`S0x` 的 `:root` | 12 页全量 |
| 新增原语 | 新 html、新 `P`、`R12` 注册一行、（新 `T05`） | 其他页 | 新页 `verify` + 八页 probe 回归 |

### 5.5 现在就能并行的（不需要等 M1–M5）

1. **补 `T05` 断言**：12 件里只有 `reducescatter` 有 `probes/*.mjs`，其余 11 件是 0 断言。文件互不重叠 → 最多 11 条并行。
2. **任意单页调整**：`P01–P08` + `P10–P12`，只要不碰 `R*`。
3. **文档类**：`README`、`docs/*.md`（除本文勿同时改）。

---

## 六、附：数据怎么复现

```bash
node tools/arch.mjs          # 人读：HTML 引用、JS 依赖边、CSS 变量归属、每文件 API 数
node tools/arch.mjs --json   # 机读：结构化结果，可接图渲染或回归对比
```

改完任何公共层后重跑一次。**本文的表格会过期，扫描结果不会** —— 两者不一致时以扫描为准，再回来改表。
