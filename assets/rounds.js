/* ============================================================
   CommonVisual v2 · L4 轮次声明（算法数据层首件）
   ------------------------------------------------------------
   CV.rounds = 每条原语的轮次口径：几轮（公式）、每轮动哪些边、
   轮内分几个相、验证采样哪些锚点。它把动词里写死的展开逻辑
   抄成纯数据表——逐字转录、不重新选骨架：
     · choreo 四页 ← scenes/<id>.js 的 beats（r1…）
     · family 四页 ← engine/verbs/{sum,split,move}.js 的展开代码
   edges 是 [from, to] 的卡号对；phases 是齿轮行的轮内相名。

   ── 时序标准 · win 键命名（2026-11-01 定稿）──
   每一拍的 win 键 = 「第几轮 + 轮内相」，三条规则：
   ① 轮号 1 起：键里的数字 = 文案里的「第 k 轮/第 k 步」。
     alltoall 步号跟段号错位由文案解决（步说「第 1 步」、段照写 A0）。
   ② 相名全局唯一（同一语义不许有第二个拼法）：
     intro 开场说明 · open 预留（一排变两排/接收位亮出）·
     fly 飞行/传递 · seat 落位弹跳 · calc 撑开计算层 ·
     merge 逐段折进 · down 轮间收层 · collapse 收场 ·
     tail 终态展示。
   ③ 键语法：轮内拍 r<k><相>（r1fly / r1merge…），choreo/move 的
     整轮拍裸 r<k>（r1/r2/r3）；无轮号的整页拍只有
     intro / open / collapse / tail 四个。
   键的居住地：verbs 的 PLAN/raw 与 scenes 的 beats（win 由
   compile 现建）；齿轮行的时长键（row('fly1',…) 等）是另一套
   命名空间（localStorage 持久化），不随本标准改名。
   anchors 是 win 引用字符串（'<键>.<s|e>'），验证探针按它采样，
   docs/algorithms.html「锚点」行据本表现渲染。

   消费者：docs/algorithms.html（轮次/锚点两行）。探针对账、
   齿轮「第 k 轮」分组标签是后续接线对象。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.rounds = {
    gather: {
      formula: 'N − 1',
      pattern: '链式：第 k 轮，卡 k 把自己那段发给卡 0',
      phases: ['传递', '落位延迟', '落位弹跳', '间隔'],
      rounds: [
        { edges: [[1, 0]] },
        { edges: [[2, 0]] },
        { edges: [[3, 0]] }
      ],
      anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e'],
      src: 'scenes/gather.js beats r1–r3'
    },
    scatter: {
      formula: 'N − 1',
      pattern: '链式：第 k 轮，卡 0 把第 k 段发给卡 k（Gather 的镜像）',
      phases: ['传递', '落位延迟', '落位弹跳', '间隔'],
      rounds: [
        { edges: [[0, 1]] },
        { edges: [[0, 2]] },
        { edges: [[0, 3]] }
      ],
      anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e'],
      src: 'scenes/scatter.js beats r1–r3'
    },
    broadcast: {
      formula: 'N − 1',
      pattern: '逐个直发：第 k 轮，卡 0 把整份复制给卡 k',
      phases: ['传递', '落位延迟', '落位弹跳', '间隔'],
      rounds: [
        { edges: [[0, 1]] },
        { edges: [[0, 2]] },
        { edges: [[0, 3]] }
      ],
      anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e'],
      src: 'scenes/broadcast.js beats r1–r3'
    },
    allgather: {
      formula: 'N − 1',
      pattern: '环形：每轮每卡把持有的段顺时针发给下家（环 0→1→3→2），三轮人人齐整份',
      phases: ['传递', '落位延迟', '落位弹跳', '间隔'],
      rounds: [
        { edges: [[0, 1], [1, 3], [3, 2], [2, 0]] },
        { edges: [[0, 1], [1, 3], [3, 2], [2, 0]] },
        { edges: [[0, 1], [1, 3], [3, 2], [2, 0]] }
      ],
      anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e'],
      src: 'scenes/allgather.js ROUND_FLOWS'
    },
    reduce: {
      formula: 'N − 1',
      pattern: '链式：第 k 轮，卡 k 把整份发给卡 0，卡 0 折进相加',
      phases: ['传递', '落位弹跳', '撑开计算层', '逐段折进', '收回计算层'],
      rounds: [
        { edges: [[1, 0]] },
        { edges: [[2, 0]] },
        { edges: [[3, 0]] }
      ],
      anchors: ['r1calc.e', 'r2calc.e', 'r3calc.e', 'collapse.e'],
      src: 'engine/verbs/sum.js timelineReduce（accumulate）'
    },
    allreduce: {
      formula: 'log₂ N',
      pattern: '倍增互换：第 k 轮与距离 2ᵏ 的伙伴互换并相加——第 1 轮 0↔1、2↔3，第 2 轮 0↔2、1↔3',
      phases: ['飞行', '落位弹跳', '撑开计算层', '逐段折进', '收层收回'],
      rounds: [
        { edges: [[0, 1], [2, 3]] },
        { edges: [[0, 2], [1, 3]] }
      ],
      anchors: ['r1merge.e', 'r2merge.e', 'tail.e'],   /* 3.42 采 r1merge.e */
      src: 'engine/verbs/sum.js ROUNDS_DEF（exchange）'
    },
    reducescatter: {
      formula: 'log₂ N',
      pattern: '递归减半：第 k 轮与伙伴互换后各留一半——第 1 轮 0↔2、1↔3 各收两段，第 2 轮 0↔1、2↔3 各收一段',
      phases: ['飞行', '落位', '撑开', '折进', '收层'],
      rounds: [
        { edges: [[0, 2], [1, 3]] },
        { edges: [[0, 1], [2, 3]] }
      ],
      anchors: ['r1merge.e', 'r2merge.e', 'tail.e'],   /* 3.51 采 r1merge.e */
      src: 'engine/verbs/split.js EMIT / RECV / PARTNER'
    },
    alltoall: {
      formula: 'N',
      pattern: '按目的地分步：第 q 步，其余各卡把第 q 段发给卡 q（每步 3 条边）',
      phases: ['飞行', '落位窗口', '步间停顿'],
      rounds: [
        { edges: [[1, 0], [2, 0], [3, 0]] },
        { edges: [[0, 1], [2, 1], [3, 1]] },
        { edges: [[0, 2], [1, 2], [3, 2]] },
        { edges: [[0, 3], [1, 3], [2, 3]] }
      ],
      anchors: ['r1.e', 'r2.e', 'r3.e', 'r4.e', 'tail.e'],
      src: 'engine/verbs/move.js R / flows（alltoall）'
    }
  };
})(window.CV = window.CV || {});
