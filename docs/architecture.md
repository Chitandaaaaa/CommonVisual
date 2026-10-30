# 代码结构地图（CommonVisual）

> 给「不知道代码长啥样」的人：改页面前先读这份，知道动哪、别动哪。
> 设计决策 / 尺寸常量见 `.workbuddy/memory/MEMORY.md`；验证纪律见 `AGENTS.md`。
> **要拆任务 / 判断能不能并行 → 读 [`docs/arch-standard.md`](arch-standard.md)**（当前 vs 目标架构、组件清单、拆分判据）；看图版 [`arch-standard.html`](arch-standard.html)。
> 本文件讲「代码长什么样」，那份讲「边界在哪、谁能动谁」。

## 一、三层结构

```
根目录 *.html        原语页（gather/scatter/broadcast/reduce/allgather/allreduce/reducescatter/alltoall）
                    + 规范页（anatomy）+ 对照表（layout）+ 算法骨架（algorithms）+ 首页（index）
   ├─ 引入 assets/cv/*.js（通用层）
   └─ 引入 assets/<同名>.js（本页原语：只有 data / geo 差异 / steps / build / paint）

assets/cv/          通用运行时（8 页共用，改了要全量回归，见 AGENTS 第四节）
   ├─ dom.js           DOM 工具（CV.$ 等）
   ├─ tokens.js       【规范参数基线】由 anatomy 调试台「保存到代码」写入；kit 读 CV_PARAM_DEFAULTS 覆盖内置默认
   ├─ kit.js          绘制原语（slot / wire / packet / card）+ CV.geo() 几何助手 + 读默认值
   ├─ controls.js     播放控制（seek / play / duration / pageSpeed）
   ├─ primitive.js    【8 页公用骨架】把取节点/清层/viewBox/双几何切换/860 断点/resize/controls/focus 收成一份
   ├─ focus.js        悬停聚焦
   ├─ relmap.js       关系树 / 对照表
   ├─ gear.js         时序齿轮（按 Δt 分配进度条宽度）
   ├─ pages.js        【每页时序基线】由时序面板「保存到代码」写入
   └─ paramEditor.js  参数调试台（仅规范页 anatomy 用）

assets/*.js          每页原语实现（只在自己文件里写「差异」）
```

## 二、每页的声明契约（primitive.js 规定）

页面 `CV.mount(cfg)` 时只需声明：

| 字段 | 含义 |
|---|---|
| `data` | 数据（默认 `CV.PALETTE`） |
| `geo` | 几何：`CV.geo({desktop:{...}, narrow:{...}})`，**只写各自的位置差异**，其余读基线 |
| `steps` | 字幕步骤（驱动进度条分段） |
| `duration` | 总时长（默认 9000ms） |
| `keepCards` | 悬停聚焦保留哪几张卡（可选） |
| `onReset` | 每轮重建前的重置（可选） |
| `build(S)` | 建舞台（图例/卡/槽/线/包） |
| `paint(S, t)` | 每帧渲染，`t ∈ 0..1` |

`S` 是运行时状态：`{ svg, layers:{bg,cards,chips,wires,fx,labels}, defs, L(当前几何), mode, cards{}, chips, wires, pkts }`。
注意：`cards/chips/wires/pkts` 是**按 key 存的对象（不是数组）**，例如 `Object.keys(S.cards)` 才有卡数；`L` 只在切断点替换，每帧请读 `S.L`。

## 三、规范页 = 单一事实源（重要）

- `anatomy.html`（组件与动效规范）直接调 `assets/cv/` 真实绘制函数 1:1 渲染，是「真值」展示。
- `tokens.js`（参数基线）+ `pages.js`（时序基线）由规范页调试台「保存到代码」经 `tools/serve.mjs` 的 `POST /__cv/save` 落盘，是**可提交的代码基线**。
- 改共享数值的正确顺序：**先在 tokens/pages 改（anatomy 看真值）→ 页面吃基线 → 跑 `tools/verify.mjs` 一次**。
- 当前状态：页面仍把很多几何数字**硬编码在 `CV.geo({...})` 里**，并未全部读 tokens/pages —— 这是「公式/目标模糊」的根：改一个值要翻多个文件。见待办。

## 四、新增一个原语页的标准步骤

1. 抄一个现成页（如 `reduce.html` + `assets/reduce.js`）为骨架。
2. 改 `data / geo / steps / build / paint`。
3. 补 `index.html` 节点、`relmap.js` 的 `REL` + `HREF`、`layout.html` 的 `PRIMS`。
4. `node tools/verify.mjs <page>` 跑一次：几何探针 + 最小截图集 + 报错检查。
5. 有问题改完再跑一次；收尾更新 `README.md` 页面表。

## 五、验证工具（tools/）

| 工具 | 用途 |
|---|---|
| `tools/serve.mjs` | 本地开发服务；「保存到代码」唯一写盘入口（白名单仅 tokens.js / pages.js） |
| `tools/verify.mjs` | **一次验证**：一次 Chrome 启动，对每个页做 报错检查 + 几何探针（`tools/probes/<page>.mjs` 的 `check()`）+ 最小截图集（初始/飞行中点/终态/窄屏），输出 pass/fail 表 |
| `tools/probe.mjs` | 纯几何探针：`node tools/probe.mjs <page> <scrub>:<JS表达式>`，表达式里直接用 `window.CV.lastMount` |
| `tools/probes/<page>.mjs` | 每页可选断言模块，导出 `async function check(pg) -> [{name,pass,detail}]` |

`verify.mjs` 约定：scrub 是进度条刻度 0..1000（内部除 1000 喂 `controls.seek`）；终态延时给足（默认 1200ms）；桌面 1440×900，窄屏 420×820；相邻两张截图字节数相同 = 废帧预警。

## 六、探针读数坑（已踩）

- **透明度挂在 SVG `opacity` 属性上，不是 `style.opacity`**：读数用 `+el.getAttribute('opacity')`。
- **`CV.lastMount` 是异步挂载的**：evaluate 前要先 `waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls)`。裸 `CV`（非 `window.CV`）在 evaluate 上下文里取不到。
- 页面参数传 `reducescatter` 或 `reducescatter.html` 都行（工具会自动补 `.html`）。

## 七、依赖关系与并行边界

> 本节由 `node tools/arch.mjs`（2026-10-30 加入）扫描得出：它把所有 `CV.xxx` 的定义处与使用处配对，
> 输出真实的「文件 → 文件」边，而不是靠人记。改完公共层后重跑一次，图和本节会同步过期与否。
> `--json` 出结构化结果，便于以后接图渲染。

### 7.1 四族与分层

```
族A 原语动画（8 页）     族B 规范（anatomy）      族C 静态文档（3 页）    族D 工具链
gather..alltoall.html    anatomy.html            layout.html             tools/*.mjs
  各页 *.js                anatomy.js              algorithms.html         probes/<page>.mjs
        ↓ ↓ ↓                  ↓                    index.html                  ↓（只读页面）
   primitive / gear          paramEditor                （互不共享 js）
        ↓ ↓ ↘                 ↓  ↘
        └────→ kit.js ←────────┘   ← 唯一收敛点（23 API / 897 行 / 12 个使用方）
                 ↓
        dom.js · controls.js · focus.js      relmap.js（0 依赖，自执行）
                 ↑
        tokens.js · pages.js（被 kit / primitive 读，也被页面写回）
```

### 7.2 真实依赖边（扫描结果，节选非平凡边）

| 使用方 | 依赖 | 用到的成员 |
|---|---|---|
| `cv/kit.js` | `cv/dom.js` | clamp / easeInOutQuad / el / mix |
| `cv/controls.js` | `cv/dom.js` | $ / clamp / h |
| `cv/focus.js` | `cv/dom.js` | $$ |
| `cv/primitive.js` | dom · kit · controls · focus | `$` / `drawGrid`,`params` / `createControls` / `attachFocus` |
| `cv/gear.js` | primitive · kit | `pageOvRaw/Read/Save/Clear` / `saveFile` |
| `cv/paramEditor.js` | kit · **anatomy.js** | `params`,`saveFile` / `showSection` ← **反向依赖** |
| `assets/anatomy.js` | kit · controls · focus · dom | 约 18 个成员 |
| 8 个页面 js | primitive · kit · dom · gear(仅 4 页) | 每页约 8–14 个成员 |

8 个页面 js **之间没有任何边**（各自 `CV.primitive(cfg)`，不互相 import）—— 这是并行化的本钱。

### 7.3 全局锁（改一处牵连多页）

| 文件 | 影响面 | 说明 |
|---|---|---|
| `cv/kit.js` | 12 个使用方 | 绘制 23 个 API + `CV.params` 注册表 + `geo/GEO_BASE/PALETTE` + `saveFile`，**四种职责混一个文件** |
| `cv/primitive.js` | 8 页 | `CV.primitive(cfg)` 的 cfg 契约（data/geo/steps/duration/retime/keepCards/onReset/build/paint） |
| `assets/stage.css` | 8 页 | 外观与 `.ctl-demo`（死值手抄自 stage.css，改一处要同步两处） |
| `cv/tokens.js` + `cv/pages.js` | 全站 / 4 页 | **单文件多写者**：anatomy 调试台写 tokens，4 个齿轮页共写 pages → 两个并行任务同改必冲突 |
| `cv/relmap.js` | 5 页 | `REL` + `HREF` 手抄自 index 的原语树，无自动校验 |

### 7.4 已知架构异味（按修复收益排序）

1. **kit.js 职责混装**：`saveFile`（存档 IO）、`CV.params`（配置注册表）跟绘制无关，却住在 43KB 的绘制文件里 → 任何页想加绘制能力都得动锁文件。拆成 `cv/save.js` + `cv/params.js` 后，kit 只剩 draw*。
2. **配置单文件多写者**：`pages.js` 被 4 页齿轮写。按页拆 `cv/pages/<page>.js` 可把「给 4 页都接齿轮」变成 4 条真正的并行任务。
3. **色板多副本**：`index.css` / `layout.css` / `stage.css` 各自 `:root` 定义同名变量 —— 扫出 **11 个变量有 2–3 份独立定义**（`--bg` 三份，index 是 `#f7f7f9`、layout/stage 是 `#f4f6fb`；`--tx`/`--line`/`--panel`/`--accent` 等 layout 与 stage 各写一遍）。名义共享、实则复制 → 改主题色要改 3 处且不会自动同步。`anatomy.css`/`algorithms.css` 自己一个变量都不定义，全靠 link `layout.css`。应收敛为一份 `cv/tokens.css`，其余只 link。
4. **原语拓扑手抄 4 处**：`index.html` 树、`relmap.js` 的 `REL/HREF`、`layout.js` 的 `PRIMS`、`README` 页面表。抽 `cv/graph.js` 单一来源。
5. **`paramEditor.js` 反向依赖 `anatomy.js`**：工具依赖页面（调 `showSection` 定位），方向反了。应把「章节锚点跳转」下沉到 dom/一个小工具里。
6. **`anatomy.js` 2367 行单文件**：13 个章节共享顶层 `easeIO/seg/anim/moveSlotY`，拆章前先把这段公共动画工具抽成 `cv/anim.js`。

### 7.5 拆任务时的判据

- 只动 `<page>.html` + `assets/<page>.js` → **可并行**，验证只跑 `verify <page>`。
- 动 7.3 任一文件 → **串行**，改完当次跑八页全量 probe（不等每日定时回归）。
- 新增一个原语 → 跨族手术（4 个共享文件 + 4 处手抄），不能拆成并行子任务。
