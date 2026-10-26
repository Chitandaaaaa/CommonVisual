# CommonVisual

**NCCL 集合通信原语的 Web 可视化** —— 把 gather / scatter / broadcast / reduce / all-gather / all-reduce 这些抽象概念，画成看得懂的数据流动画。

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
| [`layout.html`](layout.html) | **前后对照表** —— 六个原语各自「通信前 / 通信后」每张卡的缓冲区，没变化的行置灰 |

每个原语页左上角有一块**关系导航**：横向是同族的全体版，纵向是同列的上/下一个，点原语名回首页。还没实现的邻居（Reduce-Scatter、All-to-All）画成虚线灰片。

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
├── layout.html             前后对照表（静态，六个原语一页看完）
├── 分布式通信原语详解.md    内容源
├── docs/
│   └── 待讨论-Ring与Tree.md
└── assets/
    ├── stage.css           精简版共用的全部样式
    ├── layout.css          对照表样式
    ├── style.css           完整版样式
    ├── app.js              完整版逻辑
    ├── home.css / home.js  首页样式与交互
    ├── gather.js           各原语的数据 / 时间轴 / 渲染规则
    ├── scatter.js
    ├── broadcast.js
    ├── reduce.js
    ├── allgather.js
    ├── allreduce.js
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

**对照表用三档行状态说话。** `layout.html` 把六个原语统一成同一套读法：左边四行是通信前的缓冲区，中间一个动作词，右边四行是通信后的缓冲区。行只有三种状态 —— 结果落在这张卡上（紫色描边）、通信前后没变化（整行退到 40%）、变了但结果不在它身上（正常显示）。

**对照表里 reduce 的起点必须是「每卡一份完整数据」。** 数据切成四片、各卡只持一片时，reduce 根本用不了：不同位置的数据相加没有意义，那属于 gather 的场景。所以 gather / all-gather 的「通信前」是各卡 1 片，reduce / all-reduce 的「通信前」是各卡一整份 —— 两个原语的起点本来就不同，不能为了对齐而硬拉平。

## 交互

- 循环播放常开，进度条分段数 = 步骤数，可拖动跳步
- 悬停任意数据块 → 同类保持彩色，其余缓缓褪成灰；点击可「钉住」聚焦
- 键盘可操作：Tab 走节点，Enter/Space 触发

## 许可

MIT
