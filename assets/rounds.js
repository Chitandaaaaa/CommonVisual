/* ============================================================
   CommonVisual v2 · L4 轮次声明（算法数据层首件）
   ------------------------------------------------------------
   CV.rounds = 每条原语的轮次口径：几轮（公式）、每轮动哪些边、
   轮内分几个相。它把动词里写死的展开逻辑抄成纯数据表——逐字
   转录、不重新选骨架：
     · choreo 四页 ← scenes/<id>.js 的 beats（send1… / r0…）
     · family 四页 ← engine/verbs/{sum,split,move}.js 的展开代码
   edges 是 [from, to] 的卡号对；phases 是齿轮行的轮内相名。
   消费者：docs/algorithms.html（渲染「轮次」行）。锚点（验哪
   一帧）是 win 名表的引用，键已存在（如 win.r0merge.e），待
   时序标准统一命名后并入本文件；探针对账、齿轮「第 k 轮」
   分组标签是后续接线对象。
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
      src: 'scenes/gather.js send1–send3'
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
      src: 'scenes/scatter.js send1–send3'
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
      src: 'scenes/broadcast.js send1–send3'
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
      src: 'engine/verbs/move.js R / flows（alltoall）'
    }
  };
})(window.CV = window.CV || {});
