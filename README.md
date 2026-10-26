# CommonVisual

**NCCL 集合通信原语的 Web 可视化** —— 把 gather / scatter / broadcast / reduce / all-gather / all-reduce / reduce-scatter / all-to-all 这八个抽象概念，画成看得懂的数据流动画。

零框架、零依赖、零构建：手写内联 SVG + 原生 `requestAnimationFrame` + IIFE。所有页面双击就能在浏览器里打开，不需要 npm install，不需要打包。

---

## 在线访问

启用 GitHub Pages 后，直接打开：

**<https://chitandaaaaa.github.io/CommonVisual/>**

## 页面一览

| 页面 | 说明 |
|---|---|
| [`index.html`](index.html) | **完整版** —— 8 个原语对比表，信息密集，留作参考 |
| [`home.html`](home.html) | **首页** —— 原语关系树，从这儿开始逛 |
| [`gather.html`](gather.html) | 收集 —— N 段拼成一份，只有 rank0 长大 |
| [`scatter.html`](scatter.html) | 分散 —— 一份拆成 N 段分给各人 |
| [`broadcast.html`](broadcast.html) | 广播 —— 一份复制给 N 人，每人都拿整份副本 |
| [`reduce.html`](reduce.html) | 归约 —— N 份相加成一份，累加器逐段折入 |
| [`allgather.html`](allgather.html) | 全收集 —— 2×2 网格顺时针转三轮，四张卡同步集齐 |
| [`allreduce.html`](allreduce.html) | 全归约 —— 2×2 网格互换并累加两轮，四张卡拿到同一份结果 |
| [`reducescatter.html`](reducescatter.html) | 归约分散 —— 递归减半两轮，段数 4→2→1，每卡只留自己那段的和 |
| [`alltoall.html`](alltoall.html) | 全互换 —— 上排待发、下排已收，按目的地分四步，12 条直连消息 |
| [`layout.html`](layout.html) | **前后对照表** —— 八个原语各自「通信前 / 通信后」每张卡的缓冲区，没变化的行置灰 |
| [`algorithms.html`](algorithms.html) | **实现方式** —— 原语 × 六类算法骨架矩阵、八种骨架、All-Reduce 的三条路线、NCCL 选型 |

每个原语页左上角有一块**关系导航**：横向是同族的全体版，纵向是同列的上/下一个，点原语名回首页。八个原语现在都有动画页，导航里不再有虚线灰片。

## 本地运行

```bash
# 方式一：直接双击 html 文件
open index.html

# 方式二：起个静态服务（推荐，避免 file:// 的个别限制）
python3 -m http.server 8000
# 然后访问 http://localhost:8000/home.html
```

## 目录结构

```
CommonVisual/
├── index.html              完整版（保留作参考）
├── home.html               首页：原语关系树
├── gather.html             精简版单屏演示
├── scatter.html
├── broadcast.html
├── reduce.html
├── allgather.html
├── allreduce.html
├── reducescatter.html
├── alltoall.html
├── layout.html             前后对照表（静态，八个原语一页看完）
├── algorithms.html         实现方式（静态，骨架矩阵 + NCCL 选型）
├── 分布式通信原语详解.md    内容源
├── docs/
│   └── 待讨论-Ring与Tree.md
└── assets/
    ├── stage.css           精简版共用的全部样式
    ├── layout.css          对照表样式
    ├── algorithms.js       实现方式的数据（矩阵 / 骨架 / 配方）+ 渲染
    ├── algorithms.css      实现方式的样式（依赖 layout.css 的变量）
    ├── style.css           完整版样式
    ├── app.js              完整版逻辑
    ├── home.css / home.js  首页样式与交互
    ├── gather.js           各原语的数据 / 时间轴 / 渲染规则
    ├── scatter.js
    ├── broadcast.js
    ├── reduce.js
    ├── allgather.js
    ├── allreduce.js
    ├── reducescatter.js
    ├── alltoall.js
    ├── layout.js           对照表数据（PRIMS）+ 渲染
    └── cv/                 公共绘制层
        ├── dom.js          $ / $$ / el / clamp / easeInOutQuad
        │                   / mix(hex+rgb 都吃) / cubicBezier(复刻 CSS 曲线)
        ├── kit.js          drawCard / drawSlot / setSlot / drawWire
        │                   / drawPacket / resizeCard / drawLegend
        ├── controls.js     分段进度条 + 播放步进 + 键盘
        ├── focus.js        悬停聚焦 + 点击钉住
        └── relmap.js       原语页左上角的关系导航
```

## 几个设计决策

**新增一个原语只改四块。** 每个 `assets/*.js` 里都按 ① DATA ② ROUTE ③ STEPS ④ GEO 分区，其余全部复用 `assets/cv/` 公共层和 `assets/stage.css`。

**GEO 必须逐项抄齐。** SVG 用 `preserveAspectRatio="xMidYMid meet"` 等比缩放，**viewBox 越小 → 缩放倍率越大 → 整页内容都变大**。所以新增页面时 `view / card / slot / hdr / title / badge` 一个都不能自己定，改完用 `getBoundingClientRect()` 量一遍渲染像素。

**时间轴用「秒」写。** 归一化进度容易让人算错实际间隔，所以每个原语的 `T` 对象都是秒。

**CSS 曲线用 JS 复刻。** 落位弹跳的 `.slot-pop` 是 `cubic-bezier(.2, .9, .3, 1.45)`，y 控制点 > 1 会过冲。`CV.cubicBezier()` 在 JS 里原样复刻，这样弹跳与纯 CSS 版本逐点一致，又不用给 SVG 元素套 CSS 动画（双层 transform 会让 Chrome 提合成层并丢掉填充色，渲染成黑块）。

**槽位三态语言。** ① 实心彩色块 = 有数据；② 浅紫底「···」= 传输中/待命；③ 浅灰虚线框 = 空。

**All-Reduce 的「双车道」。** 交换是双向的，同一条边上两个包对向而行，各走一条车道。法向偏移的符号**由行进方向自动反转**：两个方向都取 `+HUMP` 就够，不要按 `from < to` 再补正负号 —— 那样 `dx/dy` 已经反向，符号被二次抵消，两个包会永远叠在同一侧。`HUMP = 22px`，包主体 24px，留一道明显的缝才看得出是两条道。

**对照表用三档行状态说话。** `layout.html` 把八个原语统一成同一套读法：左边四行是通信前的缓冲区，中间一个动作词，右边四行是通信后的缓冲区。行只有三种状态 —— 结果落在这张卡上（紫色描边）、通信前后没变化（整行退到 40%）、变了但结果不在它身上（正常显示）。格子里的角标表示「同一份数据被切成的第几片」，All-to-All 全靠它区分：通信后 rank k 手上是四张卡的**第 k 片**，四行竖着看下标递增。

**对照表里 reduce 的起点必须是「每卡一份完整数据」。** 数据切成四片、各卡只持一片时，reduce 根本用不了：不同位置的数据相加没有意义，那属于 gather 的场景。所以 gather / all-gather 的「通信前」是各卡 1 片，reduce / all-reduce / reduce-scatter 的「通信前」是各卡一整份 —— 这些原语的起点本来就不同，不能为了对齐而硬拉平。

**Reduce-Scatter 是「加完再切」，All-to-All 是「切片转置」。** Reduce-Scatter 先把四份逐段相加得到四段的和，再按段切开、第 k 张卡只留第 k 段，所以通信后每卡只剩一格；All-to-All 完全不求和，每卡把自己那份切成四片、第 k 片发给 rank k，回来时四格都在，只是每格来自不同卡。

**「骨架」和「配方」要分开讲。** `algorithms.html` 的矩阵只放原子骨架 —— 链/树、环、倍增/减半、Bruck、全连接、分层与网内。`RS+AG` 和 `Rabenseifner` 是「拿两个原语拼出第三个」的配方，单独一节讲，不进矩阵；混在一起会让人以为它们又是两种新拓扑。

**Reduce-Scatter 动画用递归减半，不用环形。** 环形的 ring reduce-scatter 同样正确，但它的段号会错开一格（卡 k 最后拿到的是第 k+1 段），和对照表「卡 k 留第 k 段」对不上。递归减半的两轮配对（先同列、再同行）天然对齐，而且和 `allreduce.html` 共用同一张 2×2 网格、同一套配对 —— 正着看是「份数 1→2→4」，倒着看是「段数 4→2→1」。

**All-to-All 必须画两排缓冲。** 它是原地转置：输入槽 j 装「自己要发出去的第 j 片」，输出槽 j 装「别人发给自己的第 j 片」，同一个位置前后含义不同。只画一套格子的话，第 j 步会一边清空一边被填，怎么排步骤都自相矛盾。所以上排是待发的四片（每步清空一格），下排是收到的四片（轮到自己当接收方时一次填满）—— 这也是真实做法：in-place all-to-all 必须有一个临时缓冲。12 条消息按目的地分 4 步，每步只有 3 条边在动。

**All-to-All 的连线不画箭头。** 每条边两个方向都要用（第 0 步是 1→0，第 1 步是 0→1），画一个箭头只会说对一半。方向交给数据包的拖尾表达。

## 交互

- 循环播放常开，进度条分段数 = 步骤数，可拖动跳步
- 悬停任意数据块 → 同类保持彩色，其余缓缓褪成灰；点击可「钉住」聚焦
- 键盘可操作：Tab 走节点，Enter/Space 触发

## 许可

MIT
