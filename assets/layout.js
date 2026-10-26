/* ============================================================
   CommonVisual · 通信前后数据布局对照
   ------------------------------------------------------------
   把八个原语统一成同一套读法：
       左边「通信前」四行 = 四张卡的缓冲区
       中间一个动作词   = 这一步到底做了什么
       右边「通信后」四行 = 通信完每张卡手上剩什么

   三档行状态（这是整页的核心表达）：
       is-hot   结果落在这张卡上  → 紫色描边
       is-dim   通信前后没变化    → 整行退掉
       默认     变了但没落在这卡上 → 正常显示

   注意 reduce / all-reduce 的「通信前」必须是每张卡一份**完整**数据。
   数据被切成四片、各卡只持一片时，reduce 根本用不了 —— 不同位置的
   数据相加没有意义，那是 gather 的场景。
   ============================================================ */
(function () {
  'use strict';

  /* 一格里能放的东西 */
  var CELL = {
    A: { t: 'A', c: '#7c3aed' },
    B: { t: 'B', c: '#0891b2' },
    C: { t: 'C', c: '#059669' },
    D: { t: 'D', c: '#d97706' },
    S: { t: 'Σ', c: '#4c1d95' }
  };

  var RANKS = ['rank 0', 'rank 1', 'rank 2', 'rank 3'];
  var WHOLE = ['A', 'B', 'C', 'D'];   /* 完整一份 = 四段 */
  var SUM4 = ['S', 'S', 'S', 'S'];    /* 四段各自的和 */

  var ARR_H = '<svg class="arr-h" viewBox="0 0 120 12" aria-hidden="true">' +
    '<path d="M1 6H106"/><path d="M99 1.4 110 6l-11 4.6"/></svg>';
  var ARR_V = '<svg class="arr-v" viewBox="0 0 12 34" aria-hidden="true">' +
    '<path d="M6 1v24"/><path d="M1.4 19 6 30l4.6-11"/></svg>';

  /* 一格的内容：
       'A'     单字母            → 实心色块
       'A:0'   字母 : 切片下标    → A 加小号下标，用来区分「同一份的第几片」
       '-'     空位              → 虚线空格（这段不在本卡） */
  function chip(k) {
    if (k === '-') return '<i class="cell is-blank"></i>';
    var p = k.split(':');
    var d = CELL[p[0]];
    var sub = p.length > 1 ? '<sub>' + p[1] + '</sub>' : '';
    return '<i class="cell" style="--c:' + d.c + '">' + d.t + sub + '</i>';
  }

  /* ── 八个原语 ──
     pre / post 里每一项对应一张卡，顺序恒为 rank0→rank3
     字段：c 数据格数组 / flag 右侧小字 / empty 空缓冲 / hot 结果卡 / dim 未变化 */
  var PRIMS = [
    {
      key: 'gather', en: 'Gather', cn: '收集', tag: 'N → 1',
      act: '拼接',
      note: '四片拼成一片，结果变长；只有 rank0 拿到',
      pre: [
        { c: ['A'], flag: '只有 1 片' },
        { c: ['B'], flag: '只有 1 片' },
        { c: ['C'], flag: '只有 1 片' },
        { c: ['D'], flag: '只有 1 片' }
      ],
      post: [
        { c: WHOLE, flag: '拼成 4 段', hot: true },
        { c: ['B'], flag: '原样不动', dim: true },
        { c: ['C'], flag: '原样不动', dim: true },
        { c: ['D'], flag: '原样不动', dim: true }
      ]
    },

    {
      key: 'scatter', en: 'Scatter', cn: '分散', tag: '1 → N',
      act: '拆分',
      note: '一份拆成四片，每人一段；源卡自己留下第一段',
      pre: [
        { c: WHOLE, flag: '完整一份' },
        { empty: true, flag: '空' },
        { empty: true, flag: '空' },
        { empty: true, flag: '空' }
      ],
      post: [
        { c: ['A'], flag: '留下第 1 段' },
        { c: ['B'], flag: '各得 1 段' },
        { c: ['C'], flag: '各得 1 段' },
        { c: ['D'], flag: '各得 1 段' }
      ]
    },

    {
      key: 'broadcast', en: 'Broadcast', cn: '广播', tag: '1 → N',
      act: '复制',
      note: '一份复制给四个人，人人拿到整份副本',
      pre: [
        { c: WHOLE, flag: '完整一份' },
        { empty: true, flag: '空' },
        { empty: true, flag: '空' },
        { empty: true, flag: '空' }
      ],
      post: [
        { c: WHOLE, flag: '本来就是整份', dim: true },
        { c: WHOLE, flag: '整份副本' },
        { c: WHOLE, flag: '整份副本' },
        { c: WHOLE, flag: '整份副本' }
      ]
    },

    {
      key: 'reduce', en: 'Reduce', cn: '归约', tag: 'N → 1',
      act: '相加',
      note: '四份形状相同、数值不同的数据逐段相加；只有 rank0 拿到',
      pre: [
        { c: WHOLE, flag: '第 1 份' },
        { c: WHOLE, flag: '第 2 份' },
        { c: WHOLE, flag: '第 3 份' },
        { c: WHOLE, flag: '第 4 份' }
      ],
      post: [
        { c: SUM4, flag: '四段各自的和', hot: true },
        { c: WHOLE, flag: '原样不动', dim: true },
        { c: WHOLE, flag: '原样不动', dim: true },
        { c: WHOLE, flag: '原样不动', dim: true }
      ]
    },

    {
      key: 'reducescatter', en: 'Reduce-Scatter', cn: '归约分散', tag: 'N → N',
      act: '相加后切分',
      note: '四份逐段相加，再把和切成四段，第 k 张卡只留下第 k 段',
      pre: [
        { c: WHOLE, flag: '第 1 份' },
        { c: WHOLE, flag: '第 2 份' },
        { c: WHOLE, flag: '第 3 份' },
        { c: WHOLE, flag: '第 4 份' }
      ],
      post: [
        { c: ['S', '-', '-', '-'], flag: '只留第 1 段' },
        { c: ['-', 'S', '-', '-'], flag: '只留第 2 段' },
        { c: ['-', '-', 'S', '-'], flag: '只留第 3 段' },
        { c: ['-', '-', '-', 'S'], flag: '只留第 4 段' }
      ]
    },

    {
      key: 'allgather', en: 'All-Gather', cn: '全收集', tag: 'N → N',
      act: '各自拼齐全份',
      note: '四片拼齐，四张卡都拿到完整一份',
      pre: [
        { c: ['A'], flag: '只有 1 片' },
        { c: ['B'], flag: '只有 1 片' },
        { c: ['C'], flag: '只有 1 片' },
        { c: ['D'], flag: '只有 1 片' }
      ],
      post: [
        { c: WHOLE, flag: '集齐 4 段' },
        { c: WHOLE, flag: '集齐 4 段' },
        { c: WHOLE, flag: '集齐 4 段' },
        { c: WHOLE, flag: '集齐 4 段' }
      ]
    },

    {
      key: 'allreduce', en: 'All-Reduce', cn: '全归约', tag: 'N → N',
      act: '互换并累加',
      note: '四份相加，四张卡拿到的和完全一样',
      pre: [
        { c: WHOLE, flag: '第 1 份' },
        { c: WHOLE, flag: '第 2 份' },
        { c: WHOLE, flag: '第 3 份' },
        { c: WHOLE, flag: '第 4 份' }
      ],
      post: [
        { c: SUM4, flag: '同一份和' },
        { c: SUM4, flag: '同一份和' },
        { c: SUM4, flag: '同一份和' },
        { c: SUM4, flag: '同一份和' }
      ]
    },

    {
      key: 'alltoall', en: 'All-to-All', cn: '全交换', tag: 'N → N',
      act: '各切四片互换',
      note: '每张卡把自己的那份切成四片，第 k 片发给 rank k；回来后手上是四张卡的第 k 片',
      pre: [
        { c: ['A:0', 'A:1', 'A:2', 'A:3'], flag: '切成 4 片' },
        { c: ['B:0', 'B:1', 'B:2', 'B:3'], flag: '切成 4 片' },
        { c: ['C:0', 'C:1', 'C:2', 'C:3'], flag: '切成 4 片' },
        { c: ['D:0', 'D:1', 'D:2', 'D:3'], flag: '切成 4 片' }
      ],
      post: [
        { c: ['A:0', 'B:0', 'C:0', 'D:0'], flag: '四卡的第 0 片' },
        { c: ['A:1', 'B:1', 'C:1', 'D:1'], flag: '四卡的第 1 片' },
        { c: ['A:2', 'B:2', 'C:2', 'D:2'], flag: '四卡的第 2 片' },
        { c: ['A:3', 'B:3', 'C:3', 'D:3'], flag: '四卡的第 3 片' }
      ]
    }
  ];

  /* ── 渲染 ── */

  function row(rk, r) {
    var cls = 'row';
    if (r.dim) cls += ' is-dim';
    if (r.hot) cls += ' is-hot';
    if (r.empty) cls += ' is-empty';

    var cells;
    if (r.empty) {
      cells = '<i class="cell is-blank"></i>';
    } else {
      cells = r.c.map(chip).join('');
    }

    var flag = r.flag ? '<span class="flag">' + r.flag + '</span>' : '';

    return '<div class="' + cls + '">' +
             '<span class="rk">' + rk + '</span>' +
             '<span class="cells">' + cells + '</span>' +
             flag +
           '</div>';
  }

  function side(cap, list) {
    return '<div class="side">' +
             '<div class="cap">' + cap + '</div>' +
             '<div class="rows">' +
               list.map(function (r, i) { return row(RANKS[i], r); }).join('') +
             '</div>' +
           '</div>';
  }

  function block(p) {
    return '<section class="prim" id="' + p.key + '">' +
             '<div class="prim-hd">' +
               '<h2><span class="en">' + p.en + '</span>' +
                   '<span class="cn">' + p.cn + '</span>' +
                   '<span class="tag">' + p.tag + '</span></h2>' +
               '<p class="note">' + p.note + '</p>' +
             '</div>' +
             '<div class="pair">' +
               side('通信前', p.pre) +
               '<div class="flow"><span class="act">' + p.act + '</span>' + ARR_H + ARR_V + '</div>' +
               side('通信后', p.post) +
             '</div>' +
           '</section>';
  }

  document.getElementById('app').innerHTML =
    '<nav class="jump" aria-label="原语索引">' +
      PRIMS.map(function (p) {
        return '<a href="#' + p.key + '">' + p.en + '</a>';
      }).join('') +
    '</nav>' +
    PRIMS.map(block).join('');
})();
