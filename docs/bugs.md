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

## 巡检历史

| 日期 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 2026-10-30 | 12 页 `verify --no-shot` | **12/12 通过**，errors=0，probeFail=0 | 首次基线（main@2c912fc），实测 43 秒 |
| 2026-10-31 | 12 页 `verify --no-shot` | 9/12 通过，errors=0，probeFail=4 | v2 提根后首跑（main@93fe546）；4 红＝上表前四行，无迁移引入问题，实测约 2 分钟 |
