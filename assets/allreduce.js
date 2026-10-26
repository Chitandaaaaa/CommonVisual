/* ============================================================
   CommonVisual · All-Reduce（全归约）动态演示
   ------------------------------------------------------------
   和 reduce 的差别：reduce 只有 rank0 拿到归约结果；
   All-Reduce 是**四张卡都拿到同一个结果** —— 四卡平等。

   算法用 recursive doubling（交换并累加），两轮搞定：
     第 1 轮：横向两条边配对  rank0 ↔ rank1、rank2 ↔ rank3
     第 2 轮：纵向两条边配对  rank0 ↔ rank2、rank1 ↔ rank3
   每轮双方**对向各发一份**，收到就折进自己的累加器。
   1 份 → 2 份 → 4 份，两轮之后四张卡都是完整归约结果。

   为什么箭头成对：交换是双向的，同一条边上两个包对向而行，
   路径各偏 6px 错开，看起来才不糊成一团。

   累加器的颜色随份数向深紫收敛：
   1 份 = 自己那段的原色 → 2 份 = 掺 1/3 深紫 → 4 份 = 纯深紫。
   所以终态四张卡颜色完全一致，这正是 All-Reduce 的语义。
   ============================================================ */
(function () {
  'use strict';

  var $ = CV.$, el = CV.el, clamp = CV.clamp;

  /* ══════════════════════════════════════════════════════════
     ① 数据：rank i 一开始持有第 i 段
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

  /* 双向交换的法向错开量（px）：两侧各偏一份，总间距 = 2 * HUMP。
     包主体 24px（外发光后视觉 ~30），HUMP=15 只是刚好不叠，两包贴在一起
     加拖尾仍然糊成一团 —— 留一道明显的缝才看得出「各走各的车道」。 */
  var HUMP = 22;

  /* 已含 n 份时的颜色：1 份原色，4 份纯深紫 */
  function colorFor(r, n) {
    return CV.mix(DATA[r].color, DEEP, (n - 1) / (PARTS - 1));
  }

  /* ══════════════════════════════════════════════════════════
     ② 时间轴（一律用秒）＋ 路由
     ══════════════════════════════════════════════════════════ */
  var T = {
    init:  0.9,   /* 开场：四卡各持一段 */
    fly:   1.1,   /* 单程飞行 */
    merge: 0.65,  /* 落位 + 融合（算在本轮里） */
    gap:   0.55   /* 轮间停顿 */
  };
  var CYCLE = T.fly + T.merge + T.gap;
  var TOTAL = T.init + CYCLE * 2 - T.gap + 0.6;
  function N(sec) { return sec / TOTAL; }

  /* 两轮配对：第一轮走横边，第二轮走竖边 */
  var ROUNDS_DEF = [
    { pairs: [[0, 1], [2, 3]], label: '横向配对' },
    { pairs: [[0, 2], [1, 3]], label: '纵向配对' }
  ];

  /* ROUTE.rounds[q] = 该轮所有「有向交换」 */
  var ROUTE = { rounds: [] };
  ROUNDS_DEF.forEach(function (rd, q) {
    var list = [];
    rd.pairs.forEach(function (p) {
      var a = p[0], b = p[1];
      /* 双向各一份 */
      list.push({ from: a, to: b, round: q });
      list.push({ from: b, to: a, round: q });
    });
    ROUTE.rounds.push(list);
  });

  /* 每条流的时间点；每轮的完成时刻 = 最后一个包融合完 */
  ROUTE.rounds.forEach(function (list, q) {
    var s = T.init + q * CYCLE;
    list.forEach(function (f) {
      f.start = s;
      f.arrive = s + T.fly;
      f.mergeEnd = s + T.fly + T.merge;
    });
  });
  var ROW_DONE = ROUTE.rounds.map(function (list) { return list[0].mergeEnd; });

  /* 某时刻每张卡已经含了几份 */
  function partsAt(sec) {
    if (sec >= ROW_DONE[1]) return 4;
    if (sec >= ROW_DONE[0]) return 2;
    return 1;
  }

  /* ══════════════════════════════════════════════════════════
     ③ 文案
     ══════════════════════════════════════════════════════════ */
  function rk(n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; }
  function seg(n) { return '<em class="c' + DATA[n].letter + '">' + DATA[n].letter + '</em>'; }
  function whole() { return seg(0) + seg(1) + seg(2) + seg(3); }

  var STEPS = [
    { t: 0,
      text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一段 ' + whole(),
      short: '四卡各持一段 ' + whole() },
    { t: N(T.init),
      text: '第 1 轮：' + rk(0) + rk(1) + ' 左右互换，' + rk(2) + rk(3) + ' 左右互换，各自合成 2 份',
      short: '第 1 轮 横向互换，各合成 2 份' },
    { t: N(T.init + CYCLE),
      text: '第 2 轮：' + rk(0) + rk(2) + ' 上下互换，' + rk(1) + rk(3) + ' 上下互换，各自合成 4 份',
      short: '第 2 轮 纵向互换，各合成 4 份' },
    { t: N(TOTAL - 0.6),
      text: '四张卡都拿到同一份归约结果 ' + whole(),
      short: '四卡拿到同一结果 ' + whole() }
  ];

  /* ══════════════════════════════════════════════════════════
     ④ 几何：2×2 网格（与 All-Gather 同一套尺寸）
     ══════════════════════════════════════════════════════════ */
  var GEO = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      grid: { x: 175, y: 136, dx: 480, dy: 330 },
      legendY: 17,
      slot: { sw: 52, sh: 52, gap: 12 },
      hdr: 36,
      title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      grid: { x: 8, y: 185, dx: 218, dy: 300 },
      legendY: 113,
      slot: { sw: 30, sh: 30, gap: 5 },
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
  var cards = {}, acc = {}, wires = {}, pkts = {};

  var focus = CV.attachFocus(svg, {
    /* 终态四卡都有同一份结果，聚焦任何一段都不该让卡褪色 */
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

  /* 连线用三次贝塞尔，两端切线顺着连线方向；off = 法向偏移（双向错开用） */
  function wirePath(e, off) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return 'M ' + (e.sx + nx) + ' ' + (e.sy + ny) +
           ' C ' + (e.sx + dx * 0.42 + nx) + ' ' + (e.sy + dy * 0.42 + ny) + ', ' +
                 (e.tx - dx * 0.42 + nx) + ' ' + (e.ty - dy * 0.42 + ny) + ', ' +
                 (e.tx + nx) + ' ' + (e.ty + ny);
  }

  /* 用于数据包定位的端点也要跟着偏移，否则包会脱离自己的线 */
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
    cards = {}; acc = {}; wires = {}; pkts = {};

    var defs = svg.querySelector('defs');

    CV.drawGrid(layer.bg, v);

    CV.drawLegend(layer.bg, {
      x: L.grid.x + 7, y: L.legendY + 7,
      slot: L.slot, items: DATA
    });

    /* 卡片：四张平等，徽章显示已合成的份数 */
    RANKS.forEach(function (r) {
      cards[r] = CV.drawCard(layer.cards, {
        key: r, geo: cardGeo(r), color: DATA[r].color,
        title: 'rank ' + r,
        badgeText: '1/' + PARTS,
        hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
      });
    });

    /* 每卡一个累加器，居中 */
    var c0 = L.slot;
    var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;

    RANKS.forEach(function (r) {
      var geo = cards[r].geo;
      var x = geo.x + (geo.w - c0.sw) / 2;
      var y = geo.y + areaY + (areaH - c0.sh) / 2;
      acc[r] = CV.drawSlot(layer.chips, x, y, c0.sw, c0.sh);
    });

    /* 每条有向交换一条线 + 一个包，各配一个自己的箭头 marker
       （marker 不能共用：颜色要随累加状态变） */
    var mi = 0;
    ROUTE.rounds.forEach(function (list, q) {
      list.forEach(function (f) {
        var e = edgeEnds(cards[f.from].geo, cards[f.to].geo);
        /* 法向偏移的符号由行进方向自动反转 —— 同一条边上两个方向都取 +HUMP，
           到了对向因为 dx/dy 反向，偏移自然变成一上一下。
           （之前按 from<to 再乘 ±HUMP，符号被抵消，两边偏到同一侧，
             包就永远叠在一起。） */
        var off = HUMP;
        var id = 'ar' + (mi++);
        CV.drawMarker(defs, id);
        var w = CV.drawWire(layer.wires, { d: wirePath(e, off), markerId: id });
        var seg2 = shiftEnds(e, off);
        wires[q + '_' + f.from + '_' + f.to] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#' + id + ' path'),
          sx: seg2.sx, sy: seg2.sy, tx: seg2.tx, ty: seg2.ty
        };
        pkts[q + '_' + f.from + '_' + f.to] = CV.drawPacket(layer.fx, {
          letter: DATA[f.from].letter, color: DATA[f.from].color
        });
      });
    });

    focus.refresh();
  }

  /* ══════════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════════ */
  var lastParts = -1;

  function paint(t) {
    var sec = t * TOTAL;
    var parts = partsAt(sec);

    /* —— 累加器：份数变了才改颜色，让 CSS 过渡自己渐变 —— */
    if (parts !== lastParts) {
      lastParts = parts;
      RANKS.forEach(function (r) {
        var col = colorFor(r, parts);
        acc[r].rect.setAttribute('fill', col);
        acc[r].rect.setAttribute('stroke', 'none');
        acc[r].rect.setAttribute('stroke-dasharray', 'none');
        acc[r].text.setAttribute('fill', '#fff');
        acc[r].text.textContent = parts === 1 ? DATA[r].letter : 'Σ';
        /* 聚焦用的 data-l：1 份时是它自己那段，融合后就没有单一归属了 */
        if (parts === 1) acc[r].g.setAttribute('data-l', DATA[r].letter);
        else acc[r].g.removeAttribute('data-l');

        if (parts === PARTS) CV.spawnPulse(layer.fx, acc[r]);
      });
      /* 徽章 */
      var bt = parts + '/' + PARTS;
      RANKS.forEach(function (r) {
        if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;
      });
    }

    /* —— 连线 & 数据包 —— */
    ROUTE.rounds.forEach(function (list, q) {
      list.forEach(function (f) {
        var k = q + '_' + f.from + '_' + f.to;
        var w = wires[k], p = pkts[k];
        var active = sec >= f.start && sec < f.arrive;

        /* 发出的那份带的是「发送方此刻的颜色」：第 1 轮是原色，第 2 轮已掺深紫 */
        var sendParts = q === 0 ? 1 : 2;
        var color = colorFor(f.from, sendParts);
        var letter = q === 0 ? DATA[f.from].letter : 'Σ';

        if (active) {
          p.head.querySelector('text').textContent = letter;
          p.head.querySelector('rect').setAttribute('fill', color);
          p.t1.querySelector('rect').setAttribute('fill', color);
          p.t2.querySelector('rect').setAttribute('fill', color);
          p.g.setAttribute('data-l', DATA[f.from].letter);

          var e = CV.easeInOutQuad((sec - f.start) / (f.arrive - f.start));
          CV.placePacket(p, w, e);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', color);
        } else if (sec >= f.arrive) {
          /* 线色分三档，避免上一轮的彩线留在画面上抢戏：
             ① 全部归约完 → 统一深紫淡线（四卡已经一致，线不该再带各自的旧色）
             ② 本轮已过，但后面还有轮 → 退成中性灰，只作为「走过的路」
             ③ 本轮刚落地、正在融合 → 保留发送方颜色 */
          var allDone = sec >= ROW_DONE[1];
          var roundDone = sec >= ROW_DONE[f.round];
          var strokeCol = allDone ? DEEP : (roundDone ? '#c3cadb' : color);
          var op = allDone ? '.26' : (roundDone ? '.75' : '.42');
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', strokeCol);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', op);
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
    lastParts = -1;
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
