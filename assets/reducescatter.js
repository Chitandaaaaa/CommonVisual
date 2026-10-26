/* ============================================================
   CommonVisual · Reduce-Scatter（归约分散）动态演示
   ------------------------------------------------------------
   它是 All-Reduce 的前半段：先把 N 份逐段相加，再把结果按段切开
   分给各卡 —— 每张卡只留下一段的和，其余三段落在别的卡上。

   和 reduce 的差别：reduce 只有 rank0 拿到完整的四段和；
   Reduce-Scatter 是**每张卡各拿一段**，四卡合起来才是完整结果。
   和 all-reduce 的差别：all-reduce 最后每卡都有一整份，
   reduce-scatter 只走它的前半段，然后故意停在那里。

   算法用 recursive halving（递归减半），两轮：
     第 1 轮  同列配对 rank0↔rank2、rank1↔rank3
              各把「不属于自己那半边」的两段交给对家 —— 段数 4 → 2
     第 2 轮  同行配对 rank0↔rank1、rank2↔rank3
              各把剩下的一段交出，只留自己编号那段 —— 段数 2 → 1
   终态每卡一格深紫 Σ，且它已经被累加四次。

   为什么不用环形：ring reduce-scatter 同样正确，但它的段号会错开
   一格（卡 k 最后拿到的是第 k+1 段），和对照表「卡 k 留第 k 段」
   对不上；递归减半的配对天然对齐，而且和 all-reduce 页共用同一张
   2×2 网格、同一套配对，正着看是「越加越多」，倒着看是「越切越少」。

   颜色表达份数：mix(段原色, 深紫, (份数−1)/3)。
   1 份是原色，4 份是纯深紫并显示 Σ。
   ============================================================ */
(function () {
  'use strict';

  var $ = CV.$, el = CV.el, clamp = CV.clamp;

  /* ══════════════════════════════════════════════════════════
     ① 数据：一份完整数据由 4 段组成，每张卡都持有一整份
     ══════════════════════════════════════════════════════════ */
  var DATA = [
    { letter: 'A', color: '#7c3aed' },
    { letter: 'B', color: '#0891b2' },
    { letter: 'C', color: '#059669' },
    { letter: 'D', color: '#d97706' }
  ];
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  /* 归约结果的收敛色：四份揉在一起之后就是它 */
  var DEEP = '#4c1d95';

  /* 双向交换的法向错开量（px）。第 1 轮的包是「两段并排」的缩略条
     （宽约 54px），22 会让两个包在通道中点糊成一团，34 才有明显车道缝。
     两个方向都传同一个正值，符号由行进方向自动反转 —— 别再按 from<to
     补正负号，那样会和 dx/dy 的方向二次抵消。 */
  var HUMP = 34;

  function colorFor(seg, n) {
    return CV.mix(DATA[seg].color, DEEP, (n - 1) / (PARTS - 1));
  }

  /* ══════════════════════════════════════════════════════════
     ② 时间轴（一律用秒）＋ 路由
     ══════════════════════════════════════════════════════════ */
  var T = {
    init: 0.9,    /* 开场：四卡各持一整份 */
    fly:  1.2,    /* 单程飞行 */
    pop:  0.6,    /* 落位弹跳（算在本轮里） */
    gap:  0.5     /* 轮间停顿 */
  };
  var ROUNDS = 2;                    /* log2(N) */
  var CYCLE = T.fly + T.pop + T.gap;
  var TOTAL = T.init + CYCLE * ROUNDS - T.gap + 0.6;
  function N(sec) { return sec / TOTAL; }

  /* 每轮每张卡发出哪几段：
     第 1 轮走「不属于自己那半边」的两段（看 bit1）
     第 2 轮走「自己那半边里不属于自己的」一段（看 bit0）
     留下的永远是卡自己编号那一段。 */
  var EMIT = [
    [[2, 3], [2, 3], [0, 1], [0, 1]],
    [[1],    [0],    [3],    [2]]
  ];
  var PARTNER = [
    [2, 3, 0, 1],      /* 第 1 轮：同列 */
    [1, 0, 3, 2]       /* 第 2 轮：同行 */
  ];

  /* R[q] = 第 q 轮的时间点 */
  var R = [];
  (function () {
    for (var q = 0; q < ROUNDS; q++) {
      var s = T.init + q * CYCLE;
      R.push({ q: q, start: s, arrive: s + T.fly, popEnd: s + T.fly + T.pop });
    }
  })();

  /* ══════════════════════════════════════════════════════════
     ③ 文案
     ══════════════════════════════════════════════════════════ */
  function rk(n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; }
  function seg(n) { return '<em class="c' + DATA[n].letter + '">' + DATA[n].letter + '</em>'; }
  function whole() { return seg(0) + seg(1) + seg(2) + seg(3); }

  var STEPS = [
    { t: 0,
      text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一整份 ' + whole() + '，四份逐段待相加',
      short: '四卡各持一整份 ' + whole() },
    { t: N(R[0].start),
      text: '第 1 轮：同列互换 —— ' + rk(0) + rk(2) + ' 一对、' + rk(1) + rk(3) + ' 一对，各把对家的两段收下累加，段数 4 → 2',
      short: '第 1 轮 同列互换，各剩 2 段' },
    { t: N(R[1].start),
      text: '第 2 轮：同行互换 —— 各把最后一段交出，只留自己编号那一段，段数 2 → 1',
      short: '第 2 轮 同行互换，只剩 1 段' },
    { t: N(TOTAL - 0.6),
      text: '每张卡只留一段的和：' + rk(0) + ' 留 ' + seg(0) + '，' + rk(1) + ' 留 ' + seg(1) + '，四卡拼起来才是整份结果',
      short: '四卡各留一段，拼起来才是整份' }
  ];

  /* ══════════════════════════════════════════════════════════
     ④ 几何：2×2 网格（与 All-Gather / All-Reduce 同一套尺寸）
     ══════════════════════════════════════════════════════════ */
  var GEO = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      grid: { x: 175, y: 136, dx: 480, dy: 330 },
      legendY: 17,
      slot: { sw: 46, sh: 46, gap: 12 },
      hdr: 36,
      title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      grid: { x: 8, y: 185, dx: 218, dy: 300 },
      legendY: 113,
      slot: { sw: 25, sh: 25, gap: 5 },
      hdr: 28,
      title: 12.5, badge: 8.5
    }
  };

  /* ══════════════════════════════════════════════════════════
     舞台
     ══════════════════════════════════════════════════════════ */
  var svg = $('#stage');
  var layer = {
    bg:     $('#lBg'),
    cards:  $('#lCards'),
    chips:  $('#lChips'),
    wires:  $('#lWires'),
    fx:     $('#lFx'),
    labels: $('#lLabels')
  };

  var L = GEO.desktop;
  var cards = {}, chips = {}, wires = {}, pkts = {};

  var focus = CV.attachFocus(svg, {
    /* 四张卡都参与归约，聚焦任何一段都不该让别卡褪色 */
    keepCards: function () { return RANKS; }
  });

  function cardGeo(r) {
    return {
      x: L.grid.x + (r & 1) * L.grid.dx,
      y: L.grid.y + (r >> 1) * L.grid.dy,
      w: L.card.w, h: L.card.h
    };
  }

  /* 两张卡之间的连线端点：横向相邻走左右边，纵向相邻走上下边 */
  function edgeEnds(a, b) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      var s = dx < 0 ? -1 : 1;
      return { sx: ac.x + s * a.w / 2, sy: ac.y, tx: bc.x - s * b.w / 2, ty: bc.y };
    }
    var t = dy < 0 ? -1 : 1;
    return { sx: ac.x, sy: ac.y + t * a.h / 2, tx: bc.x, ty: bc.y - t * b.h / 2 };
  }

  /* 三次贝塞尔，off = 法向偏移（双向车道用） */
  function wirePath(e, off) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return 'M ' + (e.sx + nx) + ' ' + (e.sy + ny) +
           ' C ' + (e.sx + dx * 0.42 + nx) + ' ' + (e.sy + dy * 0.42 + ny) + ', ' +
                 (e.tx - dx * 0.42 + nx) + ' ' + (e.ty - dy * 0.42 + ny) + ', ' +
                 (e.tx + nx) + ' ' + (e.ty + ny);
  }

  function shiftEnds(e, off) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return { sx: e.sx + nx, sy: e.sy + ny, tx: e.tx + nx, ty: e.ty + ny };
  }

  function buildStage() {
    var v = L.view;
    svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);

    ['bg', 'cards', 'wires', 'chips', 'fx', 'labels'].forEach(function (k) {
      layer[k].innerHTML = '';
    });
    cards = {}; chips = {}; wires = {}; pkts = {};

    var defs = svg.querySelector('defs');

    CV.drawGrid(layer.bg, v);

    /* 图例：一份数据 = 四段 */
    CV.drawLegend(layer.bg, {
      x: L.grid.x + 7, y: L.legendY + 7,
      slot: L.slot, items: DATA
    });

    /* 卡片：四张平等，徽章显示当前还剩几段 */
    RANKS.forEach(function (r) {
      cards[r] = CV.drawCard(layer.cards, {
        key: r, geo: cardGeo(r), color: DATA[r].color,
        title: 'rank ' + r,
        badgeText: '4 段',
        hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
      });
    });

    /* 缓冲槽：每张卡固定四个位置，按 A B C D 排 */
    var c0 = L.slot;
    var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;
    var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;

    RANKS.forEach(function (r) {
      var geo = cards[r].geo;
      var x0 = geo.x + (geo.w - totalW) / 2;
      var y = geo.y + areaY + (areaH - c0.sh) / 2;
      var list = [];
      for (var i = 0; i < PARTS; i++) {
        list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y, c0.sw, c0.sh));
      }
      chips[r] = list;
    });

    /* 箭头按份数分 4 档，同一轮里所有包份数相同，可共用 */
    for (var i = 0; i < PARTS; i++) CV.drawMarker(defs, 'ars' + i);

    /* 连线与数据包：每轮四条有向边，一条都不能共用
       （共用会让后面的轮次未激活时把前一轮正在飞的包也置 0） */
    R.forEach(function (rd) {
      RANKS.forEach(function (r) {
        var to = PARTNER[rd.q][r];
        var e = edgeEnds(cards[r].geo, cards[to].geo);
        var k = rd.q + '_' + r;
        var w = CV.drawWire(layer.wires, { d: wirePath(e, HUMP), markerId: 'ars' + rd.q });
        var se = shiftEnds(e, HUMP);
        wires[k] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#ars' + rd.q + ' path'),
          sx: se.sx, sy: se.sy, tx: se.tx, ty: se.ty
        };
        /* 第 1 轮走两段，第 2 轮走一段 —— 都用「整份缩略条」，
           段数不同就换内容，形状语言一致 */
        var segs = EMIT[rd.q][r];
        pkts[k] = CV.drawPacketBatch(layer.fx, L.slot, segs.map(function (g) {
          return { letter: DATA[g].letter, color: colorFor(g, rd.q + 1) };
        }));
      });
    });

    focus.refresh();
  }

  /* ══════════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════════ */

  /* 卡 r 的第 i 段此刻有几份：0 = 已交出去（空槽），1/2/4 = 在手上
     送出是**消耗**语义 —— 包一起飞，那张卡上就没有这段了，
     不能等落地才清空，否则同一份数据会同时出现在包和卡上 */
  function segParts(r, i, sec) {
    var keep1 = ((i >> 1) === (r >> 1));   /* 第 1 轮后是否还在自己这半边 */
    var keep2 = (i === r);                 /* 最终是不是自己那一段 */

    if (!keep1) return sec >= R[0].start ? 0 : 1;
    if (!keep2) {
      if (sec >= R[1].start) return 0;
      if (sec >= R[0].arrive) return 2;
      return 1;
    }
    if (sec >= R[1].arrive) return PARTS;
    if (sec >= R[0].arrive) return 2;
    return 1;
  }

  var seen = {};

  function paint(t) {
    var sec = t * TOTAL;

    /* —— 槽位：份数决定颜色，0 份就是空槽 —— */
    RANKS.forEach(function (r) {
      var left = 0;
      chips[r].forEach(function (s, i) {
        var n = segParts(r, i, sec);

        if (n === 0) {
          CV.setSlot(s, null, {});
        } else if (n === PARTS) {
          CV.setSlot(s, { letter: 'Σ', color: DEEP }, {});
        } else {
          CV.setSlot(s, { letter: DATA[i].letter, color: colorFor(i, n) }, {});
        }

        if (n > 0) left++;

        /* 落位弹跳：份数往上跳就弹一下 */
        var key = 'p' + r + i;
        if (n > 1) {
          if (seen[key] !== n) {
            seen[key] = n;
            CV.spawnPulse(layer.fx, s);
          }
        } else if (n === 0) {
          delete seen[key];
        }
      });

      var bt = left + ' 段';
      if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;
    });

    /* —— 连线 & 数据包 —— */
    R.forEach(function (rd) {
      RANKS.forEach(function (r) {
        var k = rd.q + '_' + r;
        var w = wires[k], p = pkts[k];
        var col = colorFor(EMIT[rd.q][r][0], rd.q + 1);
        var active = sec >= rd.start && sec < rd.arrive;

        if (active) {
          var e = CV.easeInOutQuad((sec - rd.start) / (rd.arrive - rd.start));
          CV.placePacket(p, w, e);
          w.path.setAttribute('stroke', col);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', col);
        } else if (sec >= rd.arrive) {
          /* 全部走完之后线统一收成深紫淡线 —— 四卡已经各自定稿，
             再留四条各带段色的线会让人以为还有数据在流动 */
          var allDone = sec >= R[ROUNDS - 1].popEnd;
          var strokeCol = allDone ? DEEP : col;
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', strokeCol);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', allDone ? '.26' : '.45');
          w.marker.setAttribute('fill', strokeCol);
        } else {
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', '#c3cadb');
          w.path.setAttribute('stroke-width', '2');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', '#c3cadb');
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     启动
     ══════════════════════════════════════════════════════════ */
  var controls = CV.createControls({
    steps: STEPS,
    duration: TOTAL * 1000,
    onFrame: paint
  });

  var lastMode = null;
  function syncLayout(force) {
    var mode = window.innerWidth < 860 ? 'narrow' : 'desktop';
    if (!force && mode === lastMode) return;
    lastMode = mode;
    L = GEO[mode];
    seen = {};
    buildStage();
    paint(controls.t());
  }

  syncLayout(true);
  controls.paintChrome(controls.t());

  var rzTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () { syncLayout(false); }, 160);
  });
})();
