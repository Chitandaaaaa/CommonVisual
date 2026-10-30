# 回归缺陷记录（BUGS）

> 由「定时全量回归」与人工验证共同维护。**只记录，不改业务代码。**
> 定时任务：automation「全量回归巡检」，每日跑一次下面的命令，把 fail / error 追加到「缺陷」表，全绿也记一行「巡检历史」。

两条命令，按频率分开用（用例分组见 `docs/testing.html`）：

```bash
# 每次改完：只跑第 2、3 组结构断言，不出图（单页 3–5 秒，12 页约 43 秒）
node tools/verify.mjs <改到的页> --no-shot

# 每日 09:30 定时：连第 1 组截图比对一起跑（12 页 3–4 分钟，图落 /tmp/cv-verify）
node tools/verify.mjs index gather scatter broadcast reduce allgather allreduce reducescatter alltoall layout algorithms anatomy
```

## 缺陷

| 日期 | 页面 | 症状 / 断言 | 复现 | 状态 |
|---|---|---|---|---|
| — | — | （暂无） | — | — |

## 巡检历史

| 日期 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 2026-10-30 | 12 页 `verify --no-shot` | **12/12 通过**，errors=0，probeFail=0 | 首次基线（main@2c912fc），实测 43 秒 |
