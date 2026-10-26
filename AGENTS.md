# AGENTS.md

给在这个仓库干活的人（和 agent）的操作手册。**只写「怎么做才不会浪费时间」，不重复项目知识** ——
页面清单、设计决策、尺寸常量、踩过的坑，全在 `.workbuddy/memory/MEMORY.md`，开工前先读那个。

---

## 一、验证：先 probe，后截图

这是最大的效率分水岭。2026-10-26 做 Reduce-Scatter + All-to-All 两页，
花了 **34 张截图 / 11 个批次 / 9 次 Chrome 冷启动 / 17 分钟**，
但只定位到 **6 个独立问题** —— 平均 5.7 张图换 1 个问题，其中一整批（5 张）什么问题都没查出来。

### 硬规则

**① 几何断言一律用数字，不用眼睛。**
「两个包叠在一起了吗」「卡片越界了吗」「标题字号对吗」「元素对齐了吗」——
这些都能用 `getBoundingClientRect()` / `getComputedStyle()` 一次量出来，十几秒。
靠截图猜要 3 轮，每轮 40–60 秒。

```js
// /tmp/probe.mjs 用法：第二个参数是一段返回对象的表达式
node /tmp/probe.mjs http://127.0.0.1:PORT/page.html "(()=>{ ... return {...} })()"
```

典型探针：`relmap.gridTemplateRows`、`h1.getComputedStyle().fontSize`、
`wire.getAttribute('d')`、两元素 `rect` 的中心距、`.rel-arrow` 的 `w/h`。

**② 每张截图必须对应一个「待验证的断言」。**
截之前先想清楚：这张图我要判断什么？判断不了就别截。
「再截一张看看」是最贵的动作。

**③ 顺序：写完代码 → probe 全部关键几何 → 只截 3 类帧。**
先把低级错误（尺寸、坐标、行数）用数字清干净，截图只用来确认**观感**（颜色、层次、节奏）。

### 每个新页面的最小截图集（3–4 张，不是 5 张）

| 帧 | scrub | 断言 |
|---|---|---|
| 初始态 | `0@900` | 卡片/槽位/导航/图例都对 |
| 本轮飞行中点 | 见下 | 对向包分离、线色、箭头方向 |
| 终态 | `1000@1200` | 结果一致、徽章、连线收敛 |
| 窄屏 | `0@900` @420×820 | 字幕不截断、不溢出 |

**飞行中点的 scrub 值要算**：`scrub = (k + r) / n * 1000`，`k` = 段序号，`r` = 段内比例。
段边界（如 `v250`）是动画起点，不是中点。想看第 1 段飞行中段用 `v≈310`。

---

## 二、CDP 截图的坑（都真踩过）

**① server 和 Chrome 必须在同一条 Bash 命令里。**
Bash 结束会回收后台进程，所以每次调用都得重新冷启动 Chrome（约 4s）。
一次命令里跑完所有帧，别拆成多次。

**② 端口写错会静默失败。**
2026-10-26 有一批图白截：server 起在 `8813`，请求写的 `8814`，
还加了 `2>/dev/null` 把报错吞了 —— 命令显示成功，图是 `ERR_CONNECTION_REFUSED` 错误页。

- **绝不**给截图命令加 `2>/dev/null`
- 截图脚本应回显 `location.href` 和 `document.title`，一眼看出是不是打到了目标页
- **两张图字节数完全相同 = 一定是废帧**（同一画面），立刻查

**③ 有 CSS 过渡的帧 `@delay` ≥ 800ms。**
`scrub` 跳步后立刻截，会截到 `fill` / `opacity` 的过渡中间态 —— 看起来像 bug，其实只是半透明。
终态尤其要给足（`@1200`）。

**④ `Runtime.evaluate` 必须传 `returnByValue: true`**，否则拿不到 `result.value`。

**⑤ `curl` 要 `--noproxy '*'`**（环境里有系统代理，localhost 之外的请求会被拦）。

---

## 三、返工的两个根因（可预防）

**① 算法选型：草图定了什么就写什么。**
Reduce-Scatter 的草图明确画的是 recursive halving（段数 4→2→1），
实现时我却先试了 ring，理由是「NCCL 默认」。
结果 ring 的段号错开一格，和对照表「卡 k 留第 k 段」对不上，**整个文件重写，5 张截图全废**。

> 骨架选择在上一轮讨论里就该定死。写代码时不要重新评估。

**② 几何公式先在纸上算，不要边截边调。**
All-to-All 的两条对角线端点改了两轮：
- 第一轮：`bend` 正负号写反，弯错方向
- 第二轮：端点用「两卡中心连线求交」，45° 时交点正好落在卡**角**上，视觉上线穿过了卡角

正确做法是**射线与矩形边界求交**（按方向分别除 `w/2` 和 `h/2` 取小者），
这个公式写在纸上 30 秒，试错要 2 轮截图。

---

## 四、改公共层必须全量回归

`assets/cv/kit.js`、`assets/cv/controls.js`、`assets/cv/relmap.js`、`assets/stage.css`
被全部 8 个原语页共用。任何改动都要回归，而且**回归用 probe 不用全截图**：

```bash
for p in gather scatter broadcast reduce allgather allreduce reducescatter alltoall; do
  echo -n "$p: "; node /tmp/probe.mjs "http://127.0.0.1:$PORT/$p.html" \
    "(()=>{const m=document.querySelector('.relmap');return getComputedStyle(m).gridTemplateRows})()"
done
```

实例：给 `relmap` 加「上邻居」时把 `grid-template-rows` 从 `repeat(3,auto)` 改成
`repeat(5,auto)`，All-to-All 的标题位置对了，但所有旧页面的行分配都得复查。

---

## 五、时间预算（用于判断「是不是卡住了」）

| 任务 | 合理耗时 |
|---|---|
| 新建一个原语页（结构照抄现成页） | 20–25 分钟 |
| 其中：读参考代码 | 5 |
| 写 JS + HTML | 10 |
| probe 全部几何 | 2 |
| 截图 3 批 | 4–5 |
| 改公共层 + 回归 | +10 |
| 每次返工 | +8 |

**超过这个量级就是在返工**，应该停下来重新想，而不是接着截图。

---

## 六、别做的事

- 别在没有明确断言时截图
- 别用截图判断「差几像素」
- 别在写代码阶段重新评估已经在草图里定下的算法
- 别给截图/验证命令加 `2>/dev/null`
- 别一次截 5 帧然后逐张读 —— 先截最可能出问题的那 1 帧
- 别改完公共层就直接交付，8 个页面都得过一遍 probe

---

## 七、收尾清单

1. `probe` 回归全部页面（不截图）
2. 更新 `README.md` 的页面表 / 目录树 / 设计决策
3. 新原语要补：`home.html` 节点、`relmap.js` 的 `REL` + `HREF`、`layout.html` 的 `PRIMS`
4. 追加 `.workbuddy/memory/YYYY-MM-DD.md`，长期约定写进 `MEMORY.md`
5. 提交时把「为什么这么改」写进 commit message 正文，不只是标题
