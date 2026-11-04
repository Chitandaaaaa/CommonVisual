/* ============================================================
   src/assets/facts.js · ②语义与轮次 的逐字转录
   ------------------------------------------------------------
   本文件是 docs/规范/01-语义与轮次.md 的转录；冲突时以文档为准。
   槽位编码：'A'-'D' 数据块 · 'A:0' 分片 · 'S<n>:<字母>' Σ 块 ·
   '-' 空格（可见） · '.' 隐藏。
   ============================================================ */
(function (CV) {
  'use strict';

  var ABCD = ['A', 'B', 'C', 'D'];
  var H4 = ['.', '.', '.', '.'];

  CV.FACTS = {
    gather: {
      en: 'Gather', cn: '收集', dir: 'N → 1',
      act: '拼接', note: '三段汇入 rank 0 拼成整份；源卡保留原段',
      rows: [4, 1, 1, 1],
      pre:  [['A'], ['B'], ['C'], ['D']],
      post: [['A', 'B', 'C', 'D'], ['B'], ['C'], ['D']],
      rounds: {
        formula: 'N − 1', pattern: '链式：第 k 轮卡 k 把自己那段发给卡 0',
        edges: [[[1, 0]], [[2, 0]], [[3, 0]]],
        anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e']
      }
    },
    scatter: {
      en: 'Scatter', cn: '分散', dir: '1 → N',
      act: '拆分', note: '整份拆成四片各发一人；源卡留下第 1 段',
      rows: [4, 1, 1, 1],
      pre:  [['A', 'B', 'C', 'D'], H4, H4, H4],
      post: [['A', '-', '-', '-'], ['B'], ['C'], ['D']],
      rounds: {
        formula: 'N − 1', pattern: '链式：第 k 轮卡 0 把第 k 段发给卡 k（gather 的镜像）',
        edges: [[[0, 1]], [[0, 2]], [[0, 3]]],
        anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e']
      }
    },
    broadcast: {
      en: 'Broadcast', cn: '广播', dir: '1 → N',
      act: '复制', note: '整份复制给三人，人人拿到整份副本；源卡保留',
      rows: [4, 4, 4, 4],
      pre:  [['A', 'B', 'C', 'D'], H4, H4, H4],
      post: [ABCD, ABCD, ABCD, ABCD],
      rounds: {
        formula: 'N − 1', pattern: '逐个直发：第 k 轮卡 0 把整份复制给卡 k',
        edges: [[[0, 1]], [[0, 2]], [[0, 3]]],
        anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e']
      }
    },
    allgather: {
      en: 'All-Gather', cn: '全收集', dir: 'N → N',
      act: '各自拼齐全份', note: '四张卡都拿到完整一份',
      rows: [4, 4, 4, 4],
      pre:  [['A', '.', '.', '.'], ['B', '.', '.', '.'], ['C', '.', '.', '.'], ['D', '.', '.', '.']],
      post: [ABCD, ABCD, ABCD, ABCD],
      rounds: {
        formula: 'N − 1', pattern: '环形：每轮每卡把持有的段顺时针发给下家（环 0→1→3→2），三轮人人齐整份',
        edges: [[[0, 1], [1, 3], [3, 2], [2, 0]],
                [[0, 1], [1, 3], [3, 2], [2, 0]],
                [[0, 1], [1, 3], [3, 2], [2, 0]]],
        anchors: ['r1.e', 'r2.e', 'r3.e', 'tail.e']
      }
    },
    reduce: {
      en: 'Reduce', cn: '归约', dir: 'N → 1',
      act: '相加', note: '四份逐段相加；只有 rank 0 拿到；源卡送完即清空（消耗）',
      rows: [4, 4, 4, 4],
      pre:  [ABCD, ABCD, ABCD, ABCD],
      post: [['S4:A', 'S4:B', 'S4:C', 'S4:D'], ['-'], ['-'], ['-']],
      rounds: {
        formula: 'N − 1', pattern: '链式：第 k 轮卡 k 把整份发给卡 0，卡 0 折进相加',
        edges: [[[1, 0]], [[2, 0]], [[3, 0]]],
        anchors: ['r1calc.e', 'r2calc.e', 'r3calc.e', 'collapse.e']
      }
    },
    allreduce: {
      en: 'All-Reduce', cn: '全归约', dir: 'N → N',
      act: '互换并累加', note: '四份相加，四张卡拿到的和完全一样',
      rows: [4, 4, 4, 4],
      pre:  [ABCD, ABCD, ABCD, ABCD],
      post: [['S4:A', 'S4:B', 'S4:C', 'S4:D'], ['S4:A', 'S4:B', 'S4:C', 'S4:D'],
             ['S4:A', 'S4:B', 'S4:C', 'S4:D'], ['S4:A', 'S4:B', 'S4:C', 'S4:D']],
      rounds: {
        formula: 'log₂ N', pattern: '倍增互换：第 k 轮与距离 2ᵏ 的伙伴互换并相加',
        edges: [[[0, 1], [2, 3]], [[0, 2], [1, 3]]],
        anchors: ['r1merge.e', 'r2merge.e', 'tail.e']
      }
    },
    reducescatter: {
      en: 'Reduce-Scatter', cn: '归约分散', dir: 'N → N',
      act: '相加后切分', note: '四份逐段相加，和切成四段，第 k 张卡只留第 k 段',
      rows: [4, 4, 4, 4],
      pre:  [ABCD, ABCD, ABCD, ABCD],
      post: [['S4:A', '-', '-', '-'], ['-', 'S4:B', '-', '-'],
             ['-', '-', 'S4:C', '-'], ['-', '-', '-', 'S4:D']],
      rounds: {
        formula: 'log₂ N', pattern: '递归减半：第 k 轮与伙伴互换后各留一半',
        edges: [[[0, 2], [1, 3]], [[0, 1], [2, 3]]],
        anchors: ['r1merge.e', 'r2merge.e', 'tail.e']
      }
    },
    alltoall: {
      en: 'All-to-All', cn: '全互换', dir: 'N → N',
      act: '各切四片互换', note: '每卡把第 k 片发给 rank k；回来后手上是四张卡的第 k 片',
      rows: [4, 4, 4, 4],
      pre:  [['A:0', 'A:1', 'A:2', 'A:3'], ['B:0', 'B:1', 'B:2', 'B:3'],
             ['C:0', 'C:1', 'C:2', 'C:3'], ['D:0', 'D:1', 'D:2', 'D:3']],
      post: [['A:0', 'B:0', 'C:0', 'D:0'], ['A:1', 'B:1', 'C:1', 'D:1'],
             ['A:2', 'B:2', 'C:2', 'D:2'], ['A:3', 'B:3', 'C:3', 'D:3']],
      rounds: {
        formula: 'N', pattern: '按目的地分步：第 q 步其余各卡把第 q 片发给卡 q（每步 3 条边）',
        edges: [[[1, 0], [2, 0], [3, 0]], [[0, 1], [2, 1], [3, 1]],
                [[0, 2], [1, 2], [3, 2]], [[0, 3], [1, 3], [2, 3]]],
        anchors: ['r1.e', 'r2.e', 'r3.e', 'r4.e', 'tail.e']
      }
    }
  };

  CV.FACT_ORDER = ['gather', 'scatter', 'broadcast', 'allgather',
                   'reduce', 'allreduce', 'reducescatter', 'alltoall'];

  /* 槽位编码 → 显示状态 */
  CV.slotDecode = function (code) {
    if (code === '.' || code == null) return { type: 'hidden' };
    if (code === '-') return { type: 'empty' };
    if (code.indexOf('S') === 0 && code.indexOf(':') > 0) {
      var p = code.slice(1).split(':');
      return { type: 'sum', n: Number(p[0]), sub: p[1] };
    }
    if (code.indexOf(':') > 0) {
      var q = code.split(':');
      return { type: 'slice', ch: q[0], idx: Number(q[1]) };
    }
    return { type: 'block', ch: code };
  };
})(window.CV = window.CV || {});
