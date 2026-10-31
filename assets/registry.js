/* ============================================================
   CommonVisual v2 · L4 事实表（唯一事实来源）
   ------------------------------------------------------------
   CV.registry = 一条原语一条记录的数组（按 id 字母序排列 ——
   §08 的并行约定：两个人同时加原语，冲突粒度落在各自段落）。
   每条：{ id, en, cn, dir, oneWord, ranks, verbs, algo, pick, rel, pre, post }
     · rel[]  边列表（axis v=纵向 / h=横向）——首页树与页角导航共用；
       All-Reduce 有两条入边，单亲指针写不下，所以是边的集合
     · pre/post  通信前后四张卡各持什么（对照表用）
     · algo  算法矩阵一行；pick  常用实现
   显示顺序与派生：
     · CV.REG_ORDER      首页树的先序（对照表 / 算法矩阵共用这一份）
     · CV.registryById   id → 记录
     · CV.registryEdges  全部关系边（8 条）
   五个投影页从这里渲染，不许任何页面自己再抄一份 —— v1 同一桩
   事实抄了 4 处，改一处漏三处（含「全互换 / 全交换」这种分叉）。
   ============================================================ */
(function (CV) {
  'use strict';

  var W = ['A', 'B', 'C', 'D'];          /* 完整一份 = 四段 */
  var S4 = ['S', 'S', 'S', 'S'];         /* 四段各自的和 */

  /* 按 id 字母序排列（§08 并行约定） */
  CV.registry = [
    {
      id: 'allgather', en: 'All-Gather', cn: '全收集', dir: 'N → N',
      act: '各自拼齐全份',
      note: '四片拼齐，四张卡都拿到完整一份',
      oneWord: '四家各有四片',
      ranks: [0, 1, 2, 3],
      verbs: ['move'],
      algo: ['ok', 'def', 'def', 'ok', 'none', 'def'],
      pick: { a: '环形 / 递归加倍 / Bruck', n: 'N 不是 2 的幂时用 Bruck' },
      rel: [{ to: 'allreduce', axis: 'v' }],
      pre:  [ { c: ['A'] }, { c: ['B'] }, { c: ['C'] }, { c: ['D'] } ],
      post: [ { c: W }, { c: W }, { c: W }, { c: W } ]
    },
    {
      id: 'allreduce', en: 'All-Reduce', cn: '全归约', dir: 'N → N',
      act: '互换并累加',
      note: '四份相加，四张卡拿到的和完全一样',
      oneWord: '四家各有 Σ',
      ranks: [0, 1, 2, 3],
      verbs: ['move', 'sum'],
      algo: ['ok', 'def', 'def', 'none', 'ok', 'def'],
      pick: { a: '环形（RS+AG）/ Rabenseifner', n: '两者总流量都是 2(N−1)/N · S，同属最优' },
      rel: [{ to: 'reducescatter', axis: 'v' }],
      pre:  [ { c: W, flag: '第 1 份' }, { c: W, flag: '第 2 份' }, { c: W, flag: '第 3 份' }, { c: W, flag: '第 4 份' } ],
      post: [ { c: S4 }, { c: S4 }, { c: S4 }, { c: S4 } ]
    },
    {
      id: 'alltoall', en: 'All-to-All', cn: '全互换', dir: 'N → N',
      act: '各切四片互换',
      note: '每张卡把自己的那份切成四片，第 k 片发给 rank k；回来后手上是四张卡的第 k 片',
      oneWord: '每家各一段',
      ranks: [0, 1, 2, 3],
      verbs: ['move', 'split'],
      algo: ['none', 'ok', 'none', 'ok', 'def', 'def'],
      pick: { a: '全连接 / 2D 分层', n: '大 N 时拆成两个维度、两阶段走' },
      rel: [],
      pre:  [
        { c: ['A:0', 'A:1', 'A:2', 'A:3'] },
        { c: ['B:0', 'B:1', 'B:2', 'B:3'] },
        { c: ['C:0', 'C:1', 'C:2', 'C:3'] },
        { c: ['D:0', 'D:1', 'D:2', 'D:3'] }
      ],
      post: [
        { c: ['A:0', 'B:0', 'C:0', 'D:0'], flag: '四卡的第 0 片' },
        { c: ['A:1', 'B:1', 'C:1', 'D:1'], flag: '四卡的第 1 片' },
        { c: ['A:2', 'B:2', 'C:2', 'D:2'], flag: '四卡的第 2 片' },
        { c: ['A:3', 'B:3', 'C:3', 'D:3'], flag: '四卡的第 3 片' }
      ]
    },
    {
      id: 'broadcast', en: 'Broadcast', cn: '广播', dir: '1 → N',
      act: '复制',
      note: '一份复制给四个人，人人拿到整份副本',
      oneWord: '三家各一份',
      ranks: [0],
      verbs: ['copy'],
      algo: ['ok', 'ok', 'ok', 'ok', 'ok', 'def'],
      pick: { a: '二叉树（小包）/ 链式流水（大包）', n: 'Scatter + All-Gather 也等价，但没人这么写' },
      rel: [{ to: 'scatter', axis: 'v' }],
      pre:  [ { c: W, flag: '完整一份' }, { empty: true, flag: '空' }, { empty: true, flag: '空' }, { empty: true, flag: '空' } ],
      post: [ { c: W, dim: true }, { c: W }, { c: W }, { c: W } ]
    },
    {
      id: 'gather', en: 'Gather', cn: '收集', dir: 'N → 1',
      act: '拼接',
      note: '四片拼成一片，结果变长；只有 rank0 拿到',
      oneWord: 'rank0 集齐四片',
      ranks: [0],
      verbs: ['move'],
      algo: ['def', 'ok', 'ok', 'ok', 'none', 'def'],
      pick: { a: '链式 / 树', n: 'Scatter 的镜像，方向反过来' },
      rel: [{ to: 'reduce', axis: 'v' }, { to: 'allgather', axis: 'h' }],
      pre:  [ { c: ['A'] }, { c: ['B'] }, { c: ['C'] }, { c: ['D'] } ],
      post: [ { c: W, flag: '拼成 4 段', hot: true }, { c: ['B'], dim: true }, { c: ['C'], dim: true }, { c: ['D'], dim: true } ]
    },
    {
      id: 'reduce', en: 'Reduce', cn: '归约', dir: 'N → 1',
      act: '相加',
      note: '四份形状相同、数值不同的数据逐段相加；只有 rank0 拿到',
      oneWord: 'rank0 四段 Σ',
      ranks: [0],
      verbs: ['move', 'sum'],
      algo: ['def', 'ok', 'ok', 'none', 'ok', 'def'],
      pick: { a: '二叉树 / 环形', n: '环上要先把数据绕满，最后才收拢' },
      rel: [{ to: 'allreduce', axis: 'h' }],
      pre:  [ { c: W, flag: '第 1 份' }, { c: W, flag: '第 2 份' }, { c: W, flag: '第 3 份' }, { c: W, flag: '第 4 份' } ],
      /* 源卡送完即清空（消耗）——与动画、探针 3.26/3.29、steps.html 一致；
         旧口径「原样变暗」是错的（2026-10-31 对齐） */
      post: [ { c: S4, flag: '四段各自的和', hot: true }, { empty: true, flag: '已交出' }, { empty: true, flag: '已交出' }, { empty: true, flag: '已交出' } ]
    },
    {
      id: 'reducescatter', en: 'Reduce-Scatter', cn: '归约分散', dir: 'N → N',
      act: '相加后切分',
      note: '四份逐段相加，再把和切成四段，第 k 张卡只留下第 k 段',
      oneWord: '每家一段 Σ',
      ranks: [0, 1, 2, 3],
      verbs: ['move', 'split', 'sum'],
      algo: ['ok', 'def', 'def', 'none', 'none', 'def'],
      pick: { a: '环形 / 递归减半', n: '就是 All-Reduce 的前半段' },
      rel: [{ to: 'alltoall', axis: 'v' }],
      pre:  [ { c: W, flag: '第 1 份' }, { c: W, flag: '第 2 份' }, { c: W, flag: '第 3 份' }, { c: W, flag: '第 4 份' } ],
      post: [
        { c: ['S', '-', '-', '-'], flag: '只留第 1 段' },
        { c: ['-', 'S', '-', '-'], flag: '只留第 2 段' },
        { c: ['-', '-', 'S', '-'], flag: '只留第 3 段' },
        { c: ['-', '-', '-', 'S'], flag: '只留第 4 段' }
      ]
    },
    {
      id: 'scatter', en: 'Scatter', cn: '分散', dir: '1 → N',
      act: '拆分',
      note: '一份拆成四片，每人一段；源卡自己留下第一段',
      oneWord: '每人一片',
      ranks: [0],
      verbs: ['move', 'split'],
      algo: ['def', 'ok', 'ok', 'ok', 'ok', 'def'],
      pick: { a: '链式 / 树', n: 'Gather 的镜像，方向反过来' },
      rel: [{ to: 'gather', axis: 'v' }],
      pre:  [ { c: W, flag: '完整一份' }, { empty: true, flag: '空' }, { empty: true, flag: '空' }, { empty: true, flag: '空' } ],
      post: [ { c: ['A'], flag: '留下第 1 段' }, { c: ['B'] }, { c: ['C'] }, { c: ['D'] } ]
    }
  ];

  /* 首页树的先序（与旧 index 手排时代的文档序一致） */
  CV.REG_ORDER = ['broadcast', 'scatter', 'gather', 'allgather',
                  'reduce', 'allreduce', 'reducescatter', 'alltoall'];

  CV.registryById = function (id) {
    for (var i = 0; i < CV.registry.length; i++) if (CV.registry[i].id === id) return CV.registry[i];
    return null;
  };

  /* 全部关系边（8 条）：首页树与页角导航共用 */
  CV.registryEdges = (function () {
    var out = [];
    CV.REG_ORDER.forEach(function (id) {
      var r = CV.registryById(id);
      (r.rel || []).forEach(function (e) { out.push({ from: id, to: e.to, axis: e.axis }); });
    });
    return out;
  })();
})(window.CV = window.CV || {});
