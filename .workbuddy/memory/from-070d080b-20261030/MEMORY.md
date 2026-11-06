# MEMORY.md — 长期项目约定

## 验证纪律与工具（流程归属 AGENTS.md，本项目落实方式）

验证的**流程与通用坑**统一在 `AGENTS.md`（一/二/四节）：先 probe 后截图、最小 3–4 张、共享层回归用 probe 不用全截图。本文件不重复那些，只记**本项目特有**的内容与工具落点。

- **工具在仓库 `tools/`，不再用 `/tmp` 散落脚本**（落实 AGENTS 一/七 的纪律）：
  - `tools/verify.mjs <page> [--frames=0,500,1000] [--no-shot] [--out=DIR]`：一次 Chrome 启动 → 报错检查 + 几何探针（`tools/probes/<page>.mjs` 的 `check(pg)`）+ 最小截图集（初始/飞行中点/终态/窄屏）→ pass/fail 表。改完页面跑一次即可。
  - `tools/probe.mjs <page> <scrub>:<JS>`：随手查一个几何数；表达式里用 `window.CV.lastMount`。
  - `tools/serve.mjs`：本地服务 + 「保存到代码」写盘（白名单仅 tokens.js / pages.js）。
  - 示例探针：`tools/probes/reducescatter.mjs`（导出 `check(pg)`）。
- **验收口径即断言**：把用户给的"终态四卡都应是 Σ"这类直接写成 `probes/<page>.mjs` 的 `check(pg)`，一次就知道过没过。
- **改完只验一次**：写完整个改动 → 跑 `verify` 一次 → 只修红的 → 再跑一次收尾（不要每次 Edit 后截图）。
- **通用 CDP 坑**（端口 / `scrub` 刻度 / `@delay` / `returnByValue` / `--noproxy`）见 `AGENTS.md` 二；下面只列 AGENTS 没覆盖、写探针模块时仍要手写的坑。

### 写探针模块时仍要手写的坑（AGENTS 未覆盖）
- 透明度挂在 SVG `opacity` **属性**上，不是 `style.opacity` → `+el.getAttribute('opacity')`。
- `evaluate` 里用 `window.CV`（bare `CV` 取不到）；挂载是异步的，`verify` 已用 `waitForFunction` 等好，手写 `probe.mjs` 也别在挂载前取值。
- `S.cards/chips/wires/pkts` 是按 key 存的**对象不是数组** → `Object.keys(S.cards).length`。

## 共享层契约（改页面前不必重读，只读差异）

被 8 个原语页共用的文件见 `AGENTS.md` 四（`kit.js` / `controls.js` / `primitive.js` / `relmap.js` / `stage.css`）。
- `CV.setSlot` 会写 `style.opacity`（`hidden?'0':''`），"淡入淡出"必须在它**之后**写，否则被清掉。
- 改以上任一文件 → 八页全部过一遍 probe 回归（用 `tools/probe.mjs` 不用全截图）。

## 分支与合入

- `main` 在 `/Users/lxm/dev/workspace/github/CommonVisual` **另一个 worktree** 检出；开发在 `workbuddy/main-xxxx` 分支，别在两边同时改同一文件。
- 推 GitHub走 **SSH**（通用原因与命令见用户级 MEMORY：`github.com` 被代理挡、HTTPS 报 502）；本仓库无 CI 工作流。
- **推送流程（固化，下次照做不必重新想）**：
  1. 先 `git status` + `git log --oneline -5` 对齐状态（跨会话会丢上下文，别假设分支领先几个提交）。
  2. 提交散落改动 → `git push origin workbuddy/main-xxxx:main`（refspec 把开发分支推到远端 main，避免直接动被另一 worktree 占用的本地 main）。
  3. 推完后让另一 worktree 的本地 main 跟上：`git -C /Users/lxm/dev/workspace/github/CommonVisual fetch origin && git -C /Users/lxm/dev/workspace/github/CommonVisual merge --ff-only origin/main`（工作区须干净，否则跳过并报告）。

### 删除开发 worktree 前必做（.workbuddy 不在 git 里）
- `.workbuddy/` 被 `.gitignore:2` 忽略，**不在版本控制中**；`git worktree remove` 会连同 `memory/` 一起永久删掉，**不可恢复**。
- 删前必须先把 `.workbuddy/memory/` 复制到保留 worktree（main）的备份子目录，确认后再 `git worktree remove <path>` + `git branch -d <branch>`。
- 注意各 worktree 的 `memory/` 是**各自独立**的（当前 worktree 精简版 5KB vs main 旧版 13KB），删前要判断哪份是权威版本并合并。

## 用户发问的最佳方式（约定）

- **多个问题一次说清**：一条消息里把看到的全部问题列完，我一次改完，而不是 N 轮来回。
- **说清"什么时候"**：进度条百分比 / 步骤名 / "终态" / "飞行中点"，比"好像不对"有用十倍。
- **给目标态 + 参照页**："参照 reduce 页，卡片先变宽再出数据块"—— 参照页让我能抄精确数字。
- **给验收标准**："最终四卡都应该是 Σ"，我把它变成断言。
- **标优先级**：哪个必改、哪个凑合。
- **别用没靶子的词**："调一下 / 优化一下"不如"终态 rank2 显示 C 应为 Σ"。

## 任务收尾回顾（用户 2026-10-30 新增规则）

**每次独立任务收尾时，必须回溯本次所有中间步骤，提出改进意见并按优先级列出。** 不是写完就交，要先自省一轮。

- **回溯范围**：本次任务涉及的工具调用、诊断脚本、来回轮次、踩到的坑、低效环节、可复用的经验。
- **改进意见分级**：
  - **P0（立刻堵）**：能直接固化进工具 / 脚本 / MEMORY 坑位表的，避免下次再付同样的税。
  - **P1（值得做）**：收益明显、短期可落地的流程或结构改进。
  - **P2（可选）**：长期优化，不急。
- **落地要求**：P0 的坑必须当场写进对应工具或 `MEMORY.md` 的坑位表（如「写探针模块时仍要手写的坑」）；不要把一次性诊断脚本留在 `/tmp`。
- 回顾结论在最终回复里直接呈现给用户（含优先级），不必等用户问。
