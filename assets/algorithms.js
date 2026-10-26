/* ============================================================
   CommonVisual · 实现方式与算法骨架
   ------------------------------------------------------------
   这一页只讲「怎么走」，不重复讲「要什么结果」——
   语义与前后状态在 layout.html，动态过程在原语页。
   ============================================================ */
(function () {
  'use strict';

  /* ── 矩阵的六列骨架 ── */
  var COLS = ['链 / 树', 'Ring', '倍增 / 减半', 'Bruck', '全连接', '分层 / 网内'];
  /* 窄屏胶囊用简称，不然四个胶囊放不下一行 */
  var COLS_S = ['链 / 树', 'Ring', '减半 / 加倍', 'Bruck', '全连接', '分层'];

  /* def = NCCL 常见默认 / ok = 可以用 / none = 走不通 */
  var MATRIX = [
    { k: 'Broadcast',      v: ['def', 'ok', 'ok', 'ok', 'ok', 'def'] },
    { k: 'Scatter',        v: ['def', 'ok', 'ok', 'ok', 'ok', 'def'] },
    { k: 'Gather',         v: ['def', 'ok', 'ok', 'ok', 'none', 'def'] },
    { k: 'Reduce',         v: ['def', 'ok', 'ok', 'none', 'ok', 'def'] },
    { k: 'All-Gather',     v: ['ok', 'def', 'def', 'ok', 'none', 'def'] },
    { k: 'All-Reduce',     v: ['ok', 'def', 'def', 'none', 'ok', 'def'] },
    { k: 'Reduce-Scatter', v: ['ok', 'def', 'def', 'none', 'none', 'def'] },
    { k: 'All-to-All',     v: ['none', 'ok', 'none', 'ok', 'def', 'def'] }
  ];

  /* ── 八种骨架 ── */
  var ALGOS = [
    {
      cn: '链式', en: 'Chain',
      one: '收到就往后传，每张卡只跟左右两家说话。',
      rounds: 'N−1 步',
      good: '实现最简单，只要点对点',
      bad: '延迟线性增长，末尾的卡等最久'
    },
    {
      cn: '树', en: 'Tree',
      one: '每轮把扇出翻倍，一层层往下铺。',
      rounds: 'log₂N 轮',
      good: '延迟低，小包最快',
      bad: '内部节点负载重，要用双树摊平'
    },
    {
      cn: '环', en: 'Ring',
      one: '只和左右邻居走，数据分块绕圈流水。',
      rounds: 'N−1 轮',
      good: '带宽最优，没有 root，随便扩',
      bad: '延迟随 N 增长，小包吃亏'
    },
    {
      cn: '递归加倍', en: 'Doubling',
      one: '按距离 1、2、4… 找伙伴，整份互换。',
      rounds: 'log₂N 轮',
      good: '轮数少，4 张卡两轮就够',
      bad: '每轮数据翻倍，要求 N 是 2 的幂'
    },
    {
      cn: '递归减半', en: 'Halving',
      one: '每轮砍掉一半数据，只发给一半伙伴。',
      rounds: 'log₂N 轮',
      good: 'Reduce-Scatter 的最优解',
      bad: '同样要求 N 是 2 的幂'
    },
    {
      cn: 'Bruck', en: 'Bruck',
      one: '每轮按不同偏移循环移位，发不同的块。',
      rounds: 'log₂N 轮',
      good: '支持任意 N，不要求 2 的幂',
      bad: '要移位缓冲区，实现最绕'
    },
    {
      cn: '全连接', en: 'Direct',
      one: '两两直接发，谁也不用中转。',
      rounds: '1 步',
      good: '小 N 最快，NVSwitch 上近乎无敌',
      bad: 'O(N²) 条消息，规模一大就爆炸'
    },
    {
      cn: '分层 / 网内', en: 'Hierarchical',
      one: '节点内 NVLink 一套、跨节点 IB 一套；或让交换机直接做归约。',
      rounds: '两级叠加',
      good: '大集群唯一现实解，SHARP 能把 reduce 流量砍半',
      bad: '要感知拓扑，调优复杂'
    }
  ];

  /* ── All-Reduce 的三条路线 ── */
  var PATHS = [
    {
      name: '环形 Ring', sub: 'NCCL 默认的大包路径', def: true,
      steps: ['Reduce-Scatter · 环', '每卡只剩 1 段 Σ', 'All-Gather · 环'],
      m1: '2(N−1) 步', m2: '流量 2(N−1)/N · S'
    },
    {
      name: 'Rabenseifner', sub: '2004 年的最优解，轮数最省',
      steps: ['Reduce-Scatter · 减半', '每卡只剩 1 段 Σ', 'All-Gather · 加倍'],
      m1: '2 log₂N 轮', m2: '流量 2(N−1)/N · S'
    },
    {
      name: '直接递归加倍', sub: '不切前后段，边换边加',
      steps: ['段数 1 → 2 → 4 直接长满'],
      m1: 'log₂N 轮', m2: '流量 S · log₂N'
    }
  ];

  /* ── 每个原语的常用实现 ── */
  var PICK = [
    { p: 'Broadcast', a: '二叉树（小包）/ 链式流水（大包）', n: 'Scatter + All-Gather 也等价，但没人这么写' },
    { p: 'Scatter', a: '链式 / 树', n: 'Gather 的镜像，方向反过来' },
    { p: 'Gather', a: '链式 / 树', n: 'Scatter 的镜像，方向反过来' },
    { p: 'Reduce', a: '二叉树 / 环形', n: '环上要先把数据绕满，最后才收拢' },
    { p: 'All-Gather', a: '环形 / 递归加倍 / Bruck', n: 'N 不是 2 的幂时用 Bruck' },
    { p: 'All-Reduce', a: '环形（RS+AG）/ Rabenseifner', n: '两者总流量都是 2(N−1)/N · S，同属最优' },
    { p: 'Reduce-Scatter', a: '环形 / 递归减半', n: '就是 All-Reduce 的前半段' },
    { p: 'All-to-All', a: '全连接 / 2D 分层', n: '大 N 时拆成两个维度、两阶段走' }
  ];

  /* ── NCCL_ALGO ── */
  var NCCL = [
    { k: 'Ring', w: '大包、跨节点，带宽优先 —— 默认多数情况选它' },
    { k: 'Tree', w: '小包、延迟敏感，比如几百字节的梯度同步' },
    { k: 'NVLS / NVLS_TREE', w: 'NVLink Switch 内部做 multicast 与归约，省一次往返' },
    { k: 'CollNetDirect / CollNetChain', w: 'IB 交换机支持 SHARP 时，把归约下推到网络' },
    { k: 'PAT', w: '用离线调优出的调度表，即 TACCL 那条路线' }
  ];

  /* ══════════════ 渲染 ══════════════ */

  function sec(id, title, lead, body) {
    return '<section class="sec" id="' + id + '">' +
             '<div class="sec-hd"><h2>' + title + '</h2>' +
               (lead ? '<p>' + lead + '</p>' : '') +
             '</div>' + body +
           '</section>';
  }

  function matrixBlock() {
    var head = '<div class="mtx-hd"><span></span>' +
      COLS.map(function (c) { return '<span>' + c + '</span>'; }).join('') +
      '</div>';

    var rows = MATRIX.map(function (r) {
      return '<div class="mtx-row">' +
               '<span class="mtx-name">' + r.k + '</span>' +
               r.v.map(function (s) { return '<span class="d ' + s + '"><i></i></span>'; }).join('') +
             '</div>';
    }).join('');

    var key = '<ul class="mtx-key">' +
      '<li><b></b>NCCL 常见默认</li>' +
      '<li><b class="k-ok"></b>也可以用，看规模与包大小</li>' +
      '<li><b class="k-none"></b>这条路走不通</li>' +
      '</ul>';

    var list = '<ul class="mtx-list">' + MATRIX.map(function (r) {
      var chips = r.v.map(function (s, i) {
        if (s === 'none') return '';
        return '<span class="chip ' + s + '">' + COLS_S[i] + '</span>';
      }).join('');
      return '<li><b>' + r.k + '</b><span class="chips">' + chips + '</span></li>';
    }).join('') + '</ul>';

    return '<div class="mtx">' + head + rows + key + '</div>' + list;
  }

  function algoBlock() {
    return '<div class="algo-grid">' + ALGOS.map(function (a) {
      return '<article class="algo-card">' +
               '<h3>' + a.cn + '<em>' + a.en + '</em></h3>' +
               '<p class="one">' + a.one + '</p>' +
               '<dl>' +
                 '<dt>轮数</dt><dd>' + a.rounds + '</dd>' +
                 '<dt>强项</dt><dd>' + a.good + '</dd>' +
                 '<dt>软肋</dt><dd>' + a.bad + '</dd>' +
               '</dl>' +
             '</article>';
    }).join('') + '</div>';
  }

  function pathBlock() {
    var rows = PATHS.map(function (p) {
      var flow = p.steps.map(function (s, i) {
        var tag = (i === 1 && p.steps.length === 3)
          ? '<u class="mid">' + s + '</u>'
          : '<u>' + s + '</u>';
        return (i ? '<s>→</s>' : '') + tag;
      }).join('');
      return '<div class="path' + (p.def ? ' is-default' : '') + '">' +
               '<div class="path-a"><b>' + p.name + '</b><em>' + p.sub + '</em></div>' +
               '<div class="path-flow">' + flow + '</div>' +
               '<div class="path-m"><b>' + p.m1 + '</b>' + p.m2 + '</div>' +
             '</div>';
    }).join('');
    return '<div class="paths">' + rows + '</div>';
  }

  function tableBlock(head, rows) {
    return '<table class="tbl"><thead><tr>' +
             head.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
           '</tr></thead><tbody>' +
             rows.map(function (r) {
               return '<tr>' + r.map(function (c, i) {
                 return i === 0 ? '<td><b>' + c + '</b></td>' : '<td>' + c + '</td>';
               }).join('') + '</tr>';
             }).join('') +
           '</tbody></table>';
  }

  var NAV = [
    ['matrix', '骨架矩阵'],
    ['algos', '八种骨架'],
    ['combo', 'RS+AG 与 Rabenseifner'],
    ['pick', '常用实现'],
    ['nccl', 'NCCL 怎么选']
  ];

  document.getElementById('jump').innerHTML = NAV.map(function (n) {
    return '<a href="#' + n[0] + '">' + n[1] + '</a>';
  }).join('');

  document.getElementById('app').innerHTML =
    sec('matrix', '八个原语，六类骨架',
      '深色点是 NCCL 里常见的默认走法，浅灰点表示可行、但要看你手里的规模与包大小，极浅的小点代表这条路走不通。',
      matrixBlock()) +

    sec('algos', '八种骨架怎么走',
      '前六种是原子的拓扑结构；后两种是放到真实集群上必须叠加的维度 —— 一台机器内 8 张卡走 NVLink、跨机器走 IB，本来就是两套网络。',
      algoBlock()) +

    sec('combo', 'RS + AG、Rabenseifner 不是骨架，是配方',
      '这两个名字常被当成算法提起，其实是「拿已有的原语拼出第三个」。All-Reduce 有三条主流路线，前两条能同时做到流量最优 —— 所以它们不该出现在上面的矩阵里。',
      pathBlock() +
      '<p class="tail"><b>RS + AG 的关键是融合。</b>中间那步「每卡只剩 1 段和」如果写回显存再调第二个 kernel，就白省了；NCCL 把它压进同一个 kernel，中间结果只在寄存器里过一下 —— 这正是 All-Reduce 不等于「先 Reduce 再 Broadcast」的原因。</p>' +
      '<p class="tail"><b>Rabenseifner 的规律是距离翻倍。</b>前半段距离 1、2、4… 每轮折掉一半、段数减半；后半段按同样的距离把和铺回去。总流量与环形相同，只是把「N−1 圈」压成了「2 log₂N 轮」；卡多时轮数优势明显，四张卡这种小规模反而是环形更简单。</p>' +
      '<p class="tail"><b>直接加倍快在轮数少。</b>四张卡只要 2 轮，但每轮每张卡都收发整份数据，总流量 S · log₂N，卡一多就比前两条贵。「allreduce.html」画的就是这一种。</p>') +

    sec('pick', '每个原语的常用实现',
      '同一行里的几种实现结果完全一样，差别只在耗时由谁决定。',
      tableBlock(['原语', '常用实现', '备注'],
        PICK.map(function (r) { return [r.p, r.a, r.n]; }))) +

    sec('nccl', 'NCCL 到底怎么选',
      '自动的 —— 内部按「包大小 × 拓扑 × 协议」算代价，大多数时候轮不到你操心。想强制可以用环境变量。',
      tableBlock(['NCCL_ALGO', '什么时候用'], NCCL.map(function (r) { return [r.k, r.w]; })) +
      '<p class="tail">另外 <b>NCCL_PROTO</b>（Simple / LL / LL128）管的是传输协议而不是算法，但它同样决定小包的延迟，常和 NCCL_ALGO 一起调。</p>');
})();
