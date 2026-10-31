# 回归缺陷记录（BUGS）

> 由「定时全量回归」与人工验证共同维护。**只记录，不改业务代码。**
> 定时任务：automation「全量回归巡检」，每日跑一次下面的命令，把 fail / error 追加到「缺陷」表，全绿也记一行「巡检历史」。

两条命令，按频率分开用（用例分组见 `docs/test-cases.html`）：

```bash
# 每次改完：只跑第 2、3、4 组结构断言，不出图（单页 3–5 秒，11 页约 2 分钟）
node tools/verify.mjs <改到的页> --no-shot

# 每日 09:30 定时：连第 1 组截图比对一起跑（11 页 3–4 分钟，图落系统临时目录 cv-verify）
node tools/verify.mjs index gather scatter broadcast reduce allgather allreduce reducescatter alltoall docs/prepost.html docs/visual.html
```

> 2026-10-31：本文件由 `docs/BUGS.md` 更名 `docs/bugs.md`；layout / anatomy 同日移入 docs/ 改名 prepost / visual。以下历史条目里的旧页名是当时事实，不回改。

## 缺陷

| 日期 | 页面 | 症状 / 断言 | 复现 | 状态 |
|---|---|---|---|---|
| 2026-10-31 | 全站原语页（齿轮） | 「保存到代码」写 `assets/scenes/pages-base.js`，但该文件不存在也未被任何页面引入 —— 保存后刷新即回原值，功能无效 | 齿轮改倍数 → 保存到代码 → 刷新页面 | 待修 |
| 2026-10-31 | allreduce | 3.42「轮后每卡 4 块全 Σᴀ²」、3.43「中段出现计算框（两轮）」采样锚点未定稿（testing.html 已标紫条，此处入账统一跟踪） | `node tools/verify.mjs allreduce --no-shot` | 待时序标准定稿 |
| 2026-10-31 | reducescatter | 3.51「第 1 轮合并结束的帧状态」采样锚点未定稿（同上） | `node tools/verify.mjs reducescatter --no-shot` | 待时序标准定稿 |
| 2026-10-31 | index | W1 节点卡断言 282×64，实测 282×**63**：1px 平台渲染差（校准值出自他机，本机 Windows 实测 63） | `node tools/verify.mjs index --no-shot` | 待复核（按本机重校或断言放宽 1px） |
| 2026-10-31 | anatomy | 组件样式双份：页面抄 `theme/stage-page.css` 一份值（.slot-tx / .calc-tx 等），改真源必须手动同步，无机制保证 | 改 stage-page.css 后开 anatomy 对照 | 技术债（暂不修） |

## 巡检历史

| 日期 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 2026-10-30 | 12 页 `verify --no-shot` | **12/12 通过**，errors=0，probeFail=0 | 首次基线（main@2c912fc），实测 43 秒 |
| 2026-10-31 | 12 页 `verify --no-shot` | 9/12 通过，errors=0，probeFail=4 | v2 提根后首跑（main@93fe546）；4 红＝上表前四行，无迁移引入问题，实测约 2 分钟 |
