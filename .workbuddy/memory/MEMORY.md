# CommonVisual · 项目长期约定

NCCL 八原语（gather/scatter/broadcast/reduce/allgather/allreduce/reducescatter/alltoall）的 Web 可视化。两代并存：根目录在写新一代规范，`v1/` 是历史实现与历史规范。

## 仓库布局（2026-11-09 重排）
- 根目录只有四份：`组件文档.md`、`特效动画.md`、`剧本.md`、`gallery.html`（组件×动画画谱，零依赖单文件，双击即看）。根目录不提供站点入口。
- `v1/` = 历史实现 + 历史规范（8 原语页、`assets/`、`docs/`、`tools/`），相对路径在 v1 内自洽。命令都在 v1 里跑：`cd v1 && node tools/verify.mjs <页> --no-shot`。
- `.workbuddy/`、`.zcode/` 留在根（记忆与计划属于整个仓库）。

## 口径（用户定死，最易踩）
- **只有根目录三份 md 是规范**；`v1/` 里的一切（含 `v1/assets/*` 的实现）**都是参考，不是标准**。冲突以根目录文档为准。
- **文档本身对不对由用户裁决**：发现文档与实现/观感冲突，唯一合法动作是摆证据提报 + 等评审，不得自行改稿（2026-11-09 已因擅改 `组件文档.md`/`术语表.md` 回退过一次）。「以实现为准」只适用于旧参考内容源《分布式通信原语详解.md》，不是通用口令。
- v1 有而文档没写的（如舞台卡位），照画时注释须写明「参考实现取值，文档未定义」，别伪装成规范值。

## gallery.html（当前主战场）
- `SEC()` 先插 `h3.sec` 再插 `.note` 再插 `.grid` —— 取样本网格要循环找 `.grid`，`nextElementSibling` 会拿到说明条。
- **样片必须 1:1**：`.tile svg{width:100%}` 会把小件放大到列宽，小件一律自建 tile + 内联 `width:Npx`；大画布挂 `.grid.wide`（800 封顶）。
- 画法函数：`block / slotRow / badge / cardG / packetG / wireCard`；第二部分用 `LOOP(period, render)` 驱动。
- 画谱不引 assets，数值全部照抄文档 —— **改文档数值后要手动同步画谱**。说明条在 h3 的 `<small>` 和 `.note` 各出现一次（是否删其一待定）。

## 几何判据（代码看不出来、跨会话仍成立）
- **空白区中线 = 卡顶 + 95**（标题栏 36 + 空白区 118÷2；数据格 72 + 块 46÷2 同值）。4.x 连线 y 按此，曾误算 103 整组偏高 8px。
- 4.x 卡与卡的空当（横 180 / 纵 160）**文档没定义**，取自 v1，只为比例像真页。
- **上下标偏移是写死的像素**（2026-11-10 用户裁定）：46 基准下 下标 9.3 字下移 3.2、上标 7.8 字上移 6.8，**两者都相对主文字基线**（术语表口径）。tspan 的 dy 逐段累计，所以上标写成 `-(3.2+6.8) = -10`。旧稿 5.1/19.2 是「em × 父级 15」的错值 —— SVG 里 em 按该 tspan **自身**字号换算（实测 0.34em@9.3 = 3.162）。画谱 `const SCRIPT = { sub: 3.2, sup: 6.8 }`，实测 Σ 基线 40 → 下标 43.2 / 上标 33.2，与规范 1:1。
- 弧线（4.1）：控制点沿主轴摆，两端等高时四点共线退化成直线，样片两端必须有高差。
- 4.7 余辉仍是虚线 8 7，只降宽度 1.8、不透明度 0.42。

## 组件判据
- **参数 = 能被独立赋值的自由度**；「A 必然等于 B」或「A 由内容算出来」就不是参数，删掉或写进上一级描述。
- 复用行只写差异 —— 画谱照「复用」画之前先回被复用节看实体（5.2.4 的「拖尾方块」被当成过整组）。
- 送出的那格写「空」不是「接收中」；通信前每卡是**一整份 [A B C D]**；all-reduce 份数翻倍（1→2→4）；reduce-scatter 用 recursive halving，不用 ring。

## 技术坑（SVG / 浏览器）
- SVG 没有 offsetWidth；`<circle>` 不写 fill 是黑的；CSS font-size 会盖掉 SVG 属性。
- **marker 的 id 全局共享**：一条线一个 marker，别共用，否则箭头颜色互相覆盖。
- 逐帧写 opacity 别挂 `transition`（会被反复重启）。
- `feGaussianBlur + feFuncA(slope)` 接在色块上会乘掉**本体** alpha（拖尾曾只剩 0.077）；要补外软影用 `feDropShadow`。
- CSS `drop-shadow` 的 blur = 2×高斯标准差，故 `stdDeviation` 取 blur/2。
- 位移＋缩放要 `transformBox='view-box'; transformOrigin='0 0'`，别叠两层 transform。

## 验证与台账
- v1 用例清单与探针：`v1/docs/test-cases.html` + `v1/tools/probes/`；现状一律实跑为准，本文件不记红绿。
- 缺陷台账 `v1/docs/bugs.md` 是历史台账（记当时真实路径，别改写成新路径）。
- 画谱没有探针，验收靠「多档窗口量渲染尺寸 + 放大截图看观感 + 零 JS 报错」。

## 分支与协作
- 单 worktree（本目录 = main）。`remote.origin.url` 本身是 SSH，**直接 `git push`**（HTTPS 被代理挡，见用户级 MEMORY）。`.workbuddy/memory/` 已入库。
- 本文件只留判据：grep / `ls` / 读表能得到的数字与清单都不抄（抄了必漂）。
- 多个问题一次说清、标优先级、给目标态 + 参照 + 验收标准；每次收尾按 P0/P1/P2 提改进，P0 当场固化。
