# 2026-10-30 · v2 四个 family 页接上时序齿轮

## 做了什么
reduce / allreduce / reducescatter / alltoall 四页补齐时序齿轮（原来只有 gather/scatter/broadcast/allgather 有）：
- `compile.js`：把 `CV.choreo` 里的行构造抽成 `CV.timeRow(page, p)`（逐字搬运，abs 行不四舍五入、spec 行保留原逻辑），choreo 与 family 共用。
- `sum.js` / `split.js` / `move.js`：三个 `timeline()` 改为每段先建行再取秒（`rX.sec`），rows 交给齿轮。win 键名与进度条分段**一根手指都没动**。
- 四个 scene 加 `gear: true`；boot / compile / sum 头部过时注释（「不接齿轮，与现页面一致」）已清。

## 行设计（family 页）
- 有规范值的段给倍数：reduce/allreduce 的 grow/shrink、reducescatter 的 slim（blockDur）。
- 编排值（fly/pop/intro/tail/gap）和复合值（merge=max(逐段和,hold)、prealloc/collapse=rowSpan、落位窗口）直接填秒，def=计算值，规范改了跟着变。
- reduce：2 平铺 + 「折一份 ×3」组(段3–8) + 1 平铺；allreduce：2 + 「互换一轮 ×2」组(3–9，含轮间停顿) + 2；alltoall：1 + 「发送一步 ×4」组(2–5) + 1；reducescatter：14 行全平铺（行号=进度条段号）。
- 坑：reduce 的 collapse 行 sec 含尾部 0.5s（TOTAL=COLLAPSE_AT+TM.collapse，不再外加）；allreduce 的 rPop 行管整段窗口 POP_SPAN，单块弹跳 0.5/错峰 0.12 是内部常数。

## 验证
- 改前先 `node tools/probe.mjs v2/<页> 0:"JSON.stringify(getCh())"` 存 win 基线，改后 diff：四页全部一致（allreduce/alltoall 只差 1e-15 浮点累加序）。
- `verify.mjs v2/八页 --no-shot`：choreo 四页 0 红；family 三页 7 红（见下）。
- 齿轮冒烟（probe 里 pageOvSave→reload→pageOvClear）：四页 + gather 全过——面板行数/编号、abs 改值、spec ×2、重置还原都对。

## 7 个红条 = 探针旧页标定债，不是这次弄坏的
探针是按旧页标定的（`v2:false, chAvail:false` + `OLD.reduce` 实测表，旧页 TOTAL 24.75s vs v2 24.36s）：reduce 3.21/3.23/3.25/V4、allreduce 3.37/3.38、reducescatter 3.45。典型如 3.23：v2 常设「预留缓冲」空槽排被 `every()` 扫进去，旧页没这排。win 键名其实和旧 PLAN 一致（原预判的红点原因不成立，真实原因是旧页标定值）。**待办：family 探针按 v2 口径重标（含 `_common.mjs` 2.10a 的 grp4 写死 travel,delay,pop,hold，family 页组结构不同），并删 OLD 刻度表。**

## 顺手
testing.html 2.2/2.10/2.11 的「4 个齿轮页」口径改成 8 页（2.10 断言措辞改为模式无关：行号并起来=段数、改一行值看总时长/段宽）。
