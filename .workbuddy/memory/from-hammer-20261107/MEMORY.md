# CommonVisual · 长期项目约定

验证流程 / 时间预算 / CDP 踩坑手册在 `AGENTS.md`（开工前先读）。用例编号以 `docs/testing.html` 为准（2026-10-31 拆分重排 83→100 条，旧编号映射在该页页末——旧会话/旧提交里引用的是旧编号）。本文件只记**跨会话仍成立**的设计决策与组件约定。

## 页面

- 8 个原语页：broadcast / scatter / gather / reduce / allgather / allreduce / reducescatter / alltoall
- 三张专题页：`anatomy.html`（解剖 + 参数调试台，规范唯一来源）、`layout.html`（前后布局对照表）、`algorithms.html`
- 共享层：`assets/cv/`（primitive / kit / controls / focus / gear / paramEditor / relmap / tokens / pages）
  —— 改任意一个都要八页回归（用 probe，不要全截图）

## 规范是唯一来源（kit.js 的 CV.params）

| 组 | 管什么 | 键 |
|---|---|---|
| `03-card` | rank 卡片**一排 ↔ 两排** | `cardDur` 0.8 / `blockDur` .4 / `blockGap` .15 |
| `05-packet` | 数据包飞行 + 送达淡出 + 拖尾 | `packDur` `packFade` `packLead` `trailDist` `trailScale` |
| `07-calc` | 计算方框那层（h2 ↔ h3）的伸缩 | `growDur` .75 / `holdDur` .95 / `shrinkDur` .7 |
| `08-seat` | 落位弹跳 | `popDur` .55 / `seatGap` .5 |
| `09-merge` | 融合（唤醒→上浮→注入） | `fuseDur` + `mergeGap` + 关键帧 + 特效 |
| `global` | 整页播放速度 | `pageSpeed` |

取值顺序：内置 def → `tokens.js`（代码基线）→ localStorage（调试台）。原语页在**加载时**读规范值算时间轴
（`CV.specVal(key)` 按键名找组），改规范要刷新页面才生效。

**不进规范、属于页面编排的**：落位延迟、两趟传递之间停多久、长高到放块的衔接（.3s）、撤完块到收卡的衔接（.25s）、
方框自身 0.35s 淡入淡出（与卡片伸缩错开的衔接）。规范页 07.2 专演那层伸缩，右侧调试台三根滑杆实时改。

## 一排 ↔ 两排 组件（kit.js）

```js
CV.rowSpan(n)            // { open, close } 这一步要排多少秒
CV.rowOpen(T, n)         // { g: 卡片高度 0→1, v: [每块可见度] }
CV.rowClose(T, n)        // 倒放：块从右往左逐个撤 → 再收卡
```

顺序是**串行的两步**，绝不边宽边加 / 边撤边收：
开 = ① 卡片绕中心长够 → ② 第二排空块逐块出现；收 = ① 空块从右往左逐块撤 → ② 卡片收回。
消费页：`reduce.js` / `allreduce.js` / `reducescatter.js` —— 三页统一 **开场一次 open + 收场一次 close**，
循环期间卡片停在两排高（只在「计算」那一拍临时长一层放方框，算完即收）。

## 三页的步骤顺序（用户定死，别改）

**预留（一排变两排，只一次）→ 循环「传递 → 落位 → 计算 → 合并」→ 收场（两排变一排，只一次）。**

- 不要每轮重来一次「长高 / 收回」：那样看着像每轮都在搬家，还多算两遍 `rowOpen+rowClose`。
- 「计算」是循环里独立的一拍，必须在传递之后：方框**不能**在预留时就点亮并常亮到收尾（等于先算再传）。
  每轮走 `CALC_UP 0.4`（长 h3 + 方框淡入）→ 合并 → `CALC_DOWN 0.7`（前 .35 只淡方框，之后 h3→h2）。
- 收场必须「计算层先退 → 第二排逐块撤 → 卡片收回」三层依次，方框早于卡片退场，
  否则卡片一矮计算框就跑到卡外（一圈虚影）。

## 槽位三态（`CV.setSlot`，别混用）

| 状态 | 调用 | 长相 | 语义 |
|---|---|---|---|
| 有数据 | `setSlot(s, {letter,color})` | 实色块 + 字母 | 这一格装着数据 |
| 接收中 | `setSlot(s, null, {active:true})` | 紫底 `#f3eeff` + 紫框 + `···` | **只给接收位**：等着收 |
| 空 | `setSlot(s, null, {})` | 灰底 + 灰虚线框 + 无字 | 没有数据 |

**送出的那一格是「空」，不是「接收中」。** reduce / reduce-scatter 的源卡交出后必须写空，
早期误用了 `{active:true}`，看着像"这一格要收数据"，语义正好反了。

## Σ 结果块标记法（09 融合规范，2026-10-30 定）

折进 2 份起的块显示 **Σ + 下标列字母 + 上标已折进份数**：`setSlot` 传
`{ letter:'Σ', sub:'A', count:2 }`（`count` 是上标 tspan，dy 已按两级字号换算）。
份数随每次相加 +1（reduce 累加器 2→3→4 逐次可见；allreduce 每级过半切 Σ；
reduce-scatter 的 n 过 1.5 切 Σ、取整上标）。`createMerge` 的 `to` 同款。

## reduce-scatter 特有：轮次之间要「撤掉多余的空位」

第 1 轮每卡交 2 段收 2 段（第二排亮 2 格），第 2 轮只交 1 段收 1 段。
两轮之间是**独立一拍** `slim`（= 规范 03 的 `blockDur`，现 .4s，从右往左撤 1 格），
由 `recvAlpha()` 按 `AT.slim.s` 算 —— 不要在第二轮飞行时顺带淡掉（会被读成"第二轮也收两段"）。

## 已定下的设计决策（别推翻）

- reduce / all-reduce / reduce-scatter 的**通信前必须是每卡一整份 [A B C D]**（各卡一片是 all-gather 的起点）。
- all-reduce / reduce-scatter 用 recursive doubling / halving；reduce-scatter **不用 ring**（段号会错开一格）。
- all-reduce 份数是**翻倍**（1→2→4），不是加一。
- 送出是**消耗**语义（broadcast 才是复制）。
- `.pkt` 不能有 `transition: opacity`（逐帧写 opacity 会把过渡反复重启）。
- 「保存到代码」靠 `node tools/serve.mjs` 的 `POST /__cv/save` 直写磁盘；静态服务下退回下载。

## docs/visual.html 版式约定（2026-11-01 定）

- **全页无 tab**：桌面/窄屏两态与动画模式一律 `subBlock()` 生成 .sub-hd + h3 小二级标题纵向堆叠；动态 demo **堆叠常播**，纪律是「重画前必停 rAF」。
- **数据块四态口径**：own（自己那段）/ done（已收到，与 own 刻意同款）/ waiting（···）/ empty（虚线空槽），出处 move.js overlayRing；hidden 是 empty 的显示开关，不是第五种样式。
- **h3 数量 ↔ 调试台锚点耦合**：右侧子目录编号 = 节号.出现序，theme.js SCHEMA 的 anchor（03-card→sub-03-5、05-packet→sub-05-4、07-calc→sub-07-3）随之顺延——增删 visual 页 h3 必查这张表。
- **规范页副本对齐**：anatomy.js 的滤镜三件/网格参数抄自 stage.js，改一边必须改另一边（flood 全 #2a3352）。
- **探针量几何的坑**：单章视图下 display:none 的节 getBBox 返回空、出界检查会静默跳过——先临时展开全部节再量；rAF 守恒判定要等 >500ms（计数窗 500ms）。
