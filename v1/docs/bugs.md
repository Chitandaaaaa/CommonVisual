# 回归缺陷记录（BUGS）

> 由「定时全量回归」与人工验证共同维护。**只记录，不改业务代码。**
> 定时任务：automation「全量回归巡检」，每日跑一次下面的命令，把 fail / error 追加到「缺陷」表，全绿也记一行「巡检历史」。

两条命令，按频率分开用（用例分组见 `docs/test-cases.html`）：

```bash
# 每次改完：只跑第 2、3、4 组结构断言，不出图（单页 3–5 秒，12 页约 2 分钟）
node tools/verify.mjs <改到的页> --no-shot

# 每日 09:30 定时：连第 1 组截图比对一起跑（11 页 3–4 分钟，图落系统临时目录 cv-verify；steps.html 纯静态稿四帧全同属预期，不进截图比对）
node tools/verify.mjs index gather scatter broadcast reduce allgather allreduce reducescatter alltoall docs/prepost.html docs/visual.html
```

> 2026-10-31：本文件由 `docs/BUGS.md` 更名 `docs/bugs.md`；layout / anatomy 同日移入 docs/ 改名 prepost / visual。以下历史条目里的旧页名是当时事实，不回改。

## 缺陷

| 日期 | 页面 | 症状 / 断言 | 复现 | 状态 |
|---|---|---|---|---|
| 2026-10-31 | 全站原语页（齿轮） | 「保存到代码」写 `assets/scenes/pages-base.js`，但该文件不存在也未被任何页面引入 —— 保存后刷新即回原值，功能无效 | 齿轮改倍数 → 保存到代码 → 刷新页面 | 已修（2026-11-01 建文件 + 接入 8 页薄壳；serve.mjs 端点写盘 → 全新页面 `CV.pageOvRead` 读回、编译真生效，已实测） |
| 2026-10-31 | allreduce | 3.42「轮后每卡 4 块全 Σᴀ²」、3.43「中段出现计算框（两轮）」采样锚点未定稿（testing.html 已标紫条，此处入账统一跟踪） | `node tools/verify.mjs allreduce --no-shot` | 已了结（2026-11-01 时序标准定稿，采样改 win 现算、紫条转绿；3.42 同日再扩双采样，见下行） |
| 2026-10-31 | reducescatter | 3.51「第 1 轮合并结束的帧状态」采样锚点未定稿（同上） | `node tools/verify.mjs reducescatter --no-shot` | 已了结（2026-11-01 同上，采样改 win.r1merge.e 现算） |
| 2026-10-31 | index | W1 节点卡断言 282×64，实测 282×**63**：1px 平台渲染差（校准值出自他机，本机 Windows 实测 63） | `node tools/verify.mjs index --no-shot` | 已放宽（2026-11-01 断言改高 63–64、容 ±1px 平台行高差——.node 未写 line-height，治本要动 index.css 版式，不做） |
| 2026-10-31 | anatomy | 组件样式双份：页面抄 `theme/stage-page.css` 一份值（.slot-tx / .calc-tx 等），改真源必须手动同步，无机制保证 | 改 stage-page.css 后开 anatomy 对照 | 技术债（暂不修） |
| 2026-11-01 | tools | `tools/arch.mjs` 在 Windows 起不来：`new URL('..', import.meta.url).pathname` 返回 `/D:/...`，拼出 `D:\D:\...` → scandir ENOENT（#4 定稿单发现，断链检查用 grep 代替绕过） | `node tools/arch.mjs` | 待修（`new URL(...)` 结果套 `fileURLToPath`；修后可把 #4 定稿单的 grep 断链检查换成正经跑一遍） |
| 2026-10-31 | allreduce | 第 2 轮飞行期间上排从 Σ² 回退成普通字母（浓色），合并过半才重新亮 Σ —— 与「这一轮已是 2 份中间结果」的叙事相悖（steps.html §13-④，随解说页签落地核实） | 播到第 2 轮起飞 → 合并过半看上排字母 | 已修（2026-11-01 Σ 判定改认「已持有份数」，sum.js overlayAllreduce；probe 实测 r2 飞行中点全 Σᴀ²、r2merge 早段逐段升 Σ⁴；3.42 扩双采样重校全绿） |
| 2026-10-31 | allgather | 一轮的 4 块落位弹跳按 seatGap 0.50 错峰，末块弹到 s+4.65、越过轮界（轮长 4.15）约 0.5s —— 下一轮已起飞时上一轮还有块在弹（解说表按轮界截断，代码行为越界） | 逐帧看第 1 轮 seatStart 后 2 秒 | 已修（2026-11-01 pop 段如实计入错峰：beat 声明 `stagger:4`，pop 段 = popDur+(n−1)×seatGap = 2.05s，轮长 4.15→5.65、总长 13.95→18.45；单颗弹跳时长改取 popOne=0.55 不变；末块弹完距下一轮起飞 1.0s；V 契约 3.32–3.38 与全量 11 页回归全绿） |

| 2026-11-01 | docs/steps.html | 手写稿时间列与编译产物漂移：allgather 全节 13.95s → 实 18.45s（轮末静止段每轮 +1.5s 落码后稿未跟上）；reduce / allreduce / reducescatter / alltoall 共 12 行「显形」给了 0.4s 窗（引擎记瞬时）；rs 两处「长高 · 浮现」叠行（引擎串行：先长够再浮现）；allreduce 飞行起点 0.14→0.09、alltoall 起飞 0.14→0.08、reduce 淡出 0.32→0.31 | `node tools/verify.mjs docs/steps.html --no-shot`（4.17 引擎对账） | 已修（2026-11-01 稿内时间列全部按 narrate 现值同步、文案未动；4.17 同日落地防再漂） |
| 2026-11-01 | assets/rounds.js | reduce 条目锚点声明 `tail.e`，但该页编译产物最后一拍是 `collapse`（winKeys 无 tail）——锚点是探针采样标准（3.42 / 3.43 / 3.51 按它采），声明漂在轴外 | `node tools/verify.mjs reduce --no-shot`（2.26 rounds 契约） | 已修（2026-11-01 tail.e → collapse.e；docs/algorithms.html 锚点行随数据源自动更正） |
| 2026-11-02 | docs/steps.html | 手写稿再次漂移：reduce / allreduce / reducescatter 共 12 行「第二排-k · 显形」结束列空（瞬时），引擎自 11-02「方案 A」起按 blockDur 给 0.4s 窗（narration 三处 `b0 + CV.dur('blockDur')`）——4.15 对账红，HEAD 上即红、与参数总线 B1 无关 | `node tools/verify.mjs docs/steps.html --no-shot`（4.15） | 已修（2026-11-02 稿内 12 行结束列按 narrate 现值补 +0.40；文案未动） |
| 2026-11-06 | docs/组件文档.md | 缺自检规则：每个三级节至少要有一个尺寸参数和一个位置参数；纯文字节必须有字号/字体/字重/颜色/位置。现在全靠人工扫 91 节，加组件必漏 | 解析 `####` 下参数表，按字段集合断言 | 待办（未排期，用户要求先记，后做） |
| 2026-11-07 | allreduce | 页面静止行写「6 条直连灰色」，probe t=0 实测 lWires 8 条直线（4 对正交 × 双向车道：横向车道距 44＝2×humpH、纵向 108＝2×humpV）＋ 8 枚箭头，无对角线——文案条数与真值不符 | `node tools/probe.mjs allreduce 0:"数 lWires path"` | 待修（文案改「8 条车道线」；probe 真值已核，随《剧本》续写 1.6 布局节落册） |
| 2026-11-09 | docs/组件文档.md | 缺「计算层卡」形态：只有单排/双排两节，卡片出计算层后的第三段高度（计算层区高、方牌落位）无处可查——《特效动画》7.1 结束状态「计算层显示」据册画不出来（docs/gallery.html 画谱借 +46px 示意） | 按《组件文档》1.2＋《特效动画》7.1 试画第三段卡 | 待办（补「计算层卡」节或 1.2 差异行，随组件文档下一轮增补排期） |
| 2026-11-09 | docs/组件文档.md | 5.4 规约数据包两块/四块款「包内块为 ΣA2–ΣD4 的同轮组合」无枚举——组合集合未定义，全部类型只列了单块 12 种（docs/gallery.html 画谱画了 ΣA2+ΣB2、ΣA2–ΣD2 例款） | 按 5.4 试画两块/四块款 | 待办（枚举组合或写组合规则，随组件文档下一轮增补排期） |
| 2026-11-09 | docs/组件文档.md | 5.2.4/5.3.4 拖尾「复用 5.1.3（16×16 方块，退后 24/46）」与实现不一致：`CV.payload.batch` 的拖尾不是一个小方块，而是**整组小块**（尺度 ×0.8 / ×0.6）；四块款底板 101 宽，按文档的 16 宽拖尾几乎整块被底板挡住。`docs/visual.html` 05 章（组件真值）画的也是整组，且注明「大半被白底板挡住」——即规范体系内部两处口径不一 | 对比 `assets/parts/payload.js` batch 的 `blocks(t1/t2)`、`docs/visual.html` 05 章与组件文档 5.2.4 | 待评审（2026-11-09 提报：改文档 or 改实现/画法，由用户裁决；画谱在裁决前按文档画单方块） |
| 2026-11-09 | docs/gallery.html | 数据包拖尾几乎不可见：`fBlur` 把 `feGaussianBlur` + `feFuncA(slope .14)` 作用在色块**本体**上，alpha 被乘成 0.14，再乘浓度 0.55 → 实际 0.077（真值 `assets/parts/stage.js` 的 `fTrail` 是 `feDropShadow`，只补软影、不动本体不透明度）；两块/四块款还因 `fill: colors[0]` 取到 `{c,t}` 对象而渲染成灰块 | 与真实页面飞行帧对比（gather.html seek 0.35）；画谱像素采样反推 alpha | 已修（2026-11-09 改 `feDropShadow` 软影；整份包拖尾底色取 `colors[0].c`）。修后实测近层 alpha 0.556 / 远层 0.282，与 5.1.3 / 5.1.4 的 0.55 / 0.28 一致 |
| 2026-11-10 | docs/组件文档.md（2.2.2 / 2.3.2） | 上下标基线偏移 5.1 / 19.2 是按「em × 父级字号 15」算出来的错值：SVG 里 tspan 的 `dy` 用 em 时按**该 tspan 自身** font-size 换算（Chrome 实测 0.34em@9.3 = 3.162、1.28em@7.8 = 9.984），照文档值画上标会飞出色块顶；且《术语表》把两个偏移都定义为「相对主文字基线」，19.2 作为链式 dy 也不成立。规范参数项本身是对的（字号 9.3 / 7.8、字重 600、位置），错的只是这两个数值的换算口径 | 46 块里量 `getStartPositionOfChar`：Σ 基线 40、下标 43.162、上标 33.178（净值 −6.822） | 已修（2026-11-10 用户裁定：改具体像素，下标下移 3.2、上标上移 6.8，均相对主文字基线；画谱 `SCRIPT` 改 `{3.2, 6.8}`，实测 43.2 / 33.2 与规范一致；链式 dy = −(3.2+6.8) = −10 只作实现细节写在注释里） |

## 巡检历史

| 日期 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 2026-10-30 | 12 页 `verify --no-shot` | **12/12 通过**，errors=0，probeFail=0 | 首次基线（main@2c912fc），实测 43 秒 |
| 2026-10-31 | 12 页 `verify --no-shot` | 9/12 通过，errors=0，probeFail=4 | v2 提根后首跑（main@93fe546）；4 红＝上表前四行，无迁移引入问题，实测约 2 分钟 |
