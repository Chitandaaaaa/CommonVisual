# 回归缺陷记录（BUGS）

> 由「定时全量回归」与人工验证共同维护。**只记录，不改业务代码。**
> 定时任务：automation「全量回归巡检」，每日跑一次下面的命令，把 fail / error 追加到「缺陷」表，全绿也记一行「巡检历史」。

全量回归命令（一次 Chrome 启动跑完所有页面，只查报错 + probes，不截图）：

```bash
node tools/verify.mjs index gather scatter broadcast reduce allgather allreduce reducescatter alltoall layout algorithms anatomy --no-shot
```

## 缺陷

| 日期 | 页面 | 症状 / 断言 | 复现 | 状态 |
|---|---|---|---|---|
| — | — | （暂无） | — | — |

## 巡检历史

| 日期 | 命令 | 结果 | 备注 |
|---|---|---|---|
| 2026-10-30 | 12 页 `verify --no-shot` | **12/12 通过**，errors=0，probeFail=0 | 首次基线（main@2c912fc） |
