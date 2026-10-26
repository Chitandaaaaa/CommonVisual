/* ============================================================
   CommonVisual · All-to-All（全互换）动态演示
   ------------------------------------------------------------
   它是八个原语里唯一「每张卡都要跟每张卡说话」的一个：
   每卡把自己那份切成 N 片、第 j 片专给 rank j，然后把所有片
   一次性全部发出去，收回来的正好是「其他卡发给自己的那一片」。
   结果是**一次转置**：卡 k 的四格 = Aₖ Bₖ Cₖ Dₖ，
   位置没变，来源全换了。

   为什么必须画两排缓冲：
   All-to-All 是原地转置，输入槽 j 装的是「自己要发出去的第 j 片」，
   输出槽 j 装的是「别人发给自己的第 j 片」—— 同一个位置前后含义不同。
   只有一套格子的话，第 j 步会一边清空一边被填，怎么排都会自相矛盾。
   所以每张卡画两排：
     上排 = 待发出的四片（每步清空一格）
     下排 = 收到的四片（轮到自己当接收方时一次填满）
   这也是真实的做法：in-place 的 all-to-all 必须有一个临时缓冲。

   12 条消息按**目的地**分成 4 步，每步只有 3 条边在动：
     第 j 步 —— 各卡把第 j 片发给 rank j，自己那片原地不动
   不分步的话 12 个包同时飞，谁也看不清。

   连线是双向直连（2×2 网格的 4 条边 + 2 条对角线，中心成 X 交叉），
   不画箭头 —— 每条边两个方向都用，箭头只会指向其中一半的事实。
   方向交给数据包的拖尾表达。

   对角线走直线而非弧线：12 个包按目的地分 4 步，每一步里**最多只有
   一条对角线在动**（其余两条是正交边），所以中心交叉点不会出现两个
   包相撞的情况，直线既是真实拓扑，视觉上也更干净。
   ============================================================ */
(function () {
  'use strict';

  var $ = CV.$, el = CV.el, clamp = CV.clamp;

  /* ══════════════════════════════════════════════════════════
     ① 数据：rank i 的数据色是第 i 种，它被切成 4 片
     ══════════════════════════════════════════════════════════ */
  var DATA = [
    { letter: 'A', color: '#7c3aed' },
    { letter: 'B', color: '#0891b2' },
    { letter: 'C', color: '#059669' },
    { letter: 'D', color: '#d97706' }
  ];
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  /* ══════════════════════════════════════════════════════════
     ② 时间轴（一律用秒）＋ 路由
     ══════════════════════════════════════════════════════════ */
  var T = {
    init: 0.9,    /* 开场：上排四片，下排全空 */
    fly:  0.95,   /* 单程飞行 */
    pop:  0.5,    /* 落位弹跳（算在本步里） */
    gap:  0.4     /* 步间停顿 */
  };
  var STEPS_N = 4;                   /* N 步，按目的地分组 */
  var CYCLE = T.fly + T.pop + T.gap;
  var TOTAL = T.init + CYCLE * STEPS_N - T.gap + 0.6;
  function N(sec) { return sec / TOTAL; }

  /* R[q] = 第 q 步（目的地是 rank q）的时间点 */
  var R = [];
  (function () {
    for (var q = 0; q < STEPS_N; q++) {
      var s = T.init + q * CYCLE;
      R.push({ q: q, start: s, arrive: s + T.fly, popEnd: s + T.fly + T.pop });
    }
  })();

  /* FLOWS[q] = 第 q 步在飞的三个包：from → rank q，携带 from 的第 q 片 */
  var FLOWS = R.map(function (rd) {
    var list = [];
    RANKS.forEach(function (s) {
      if (s !== rd.q) list.push({ from: s, to: rd.q, seg: rd.q });
    });
    return list;
  });

  /* ══════════════════════════════════════════════════════════
     ③ 文案
     ══════════════════════════════════════════════════════════ */
  function rk(n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; }
  function seg(n) { return '<em class="c' + DATA[n].letter + '">' + DATA[n].letter + '</em>'; }
  function whole() { return seg(0) + seg(1) + seg(2) + seg(3); }

  var STEPS = [
    { t: 0,
      text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各把自己那份切成四片：上排是待发出的片，下排空着',
      short: '四卡各切四片，下排空着' }
  ];
  R.forEach(function (rd) {
    STEPS.push({
      t: N(rd.start),
      text: '第 ' + (rd.q + 1) + ' 步：各卡把第 ' + (rd.q + 1) + ' 片发给 ' + rk(rd.q) + '，自己那片原地不动',
      short: '第 ' + (rd.q + 1) + ' 步 各卡第 ' + (rd.q + 1) + ' 片 → rank' + rd.q
    });
  });
  STEPS.push({
    t: N(TOTAL - 0.6),
    text: '四卡下排都成了 ' + whole() + '：位置没变，但每格来自不同的卡 —— 这就是一次转置',
    short: '四卡都是 ' + whole() + '，来源全换'
  });

  /* ══════════════════════════════════════════════════════════
     ④ 几何：2×2 网格 + 两排缓冲
     ══════════════════════════════════════════════════════════ */
  var GEO = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      grid: { x: 175, y: 136, dx: 480, dy: 330 },
      legendY: 17,
      slot: { sw: 44, sh: 44, gap: 10 },
      rowGap: 8,
      hdr: 36,
      title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      grid: { x: 8, y: 185, dx: 218, dy: 300 },
      legendY: 113,
      slot: { sw: 25, sh: 25, gap: 5 },
      rowGap: 5,
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
  var cards = {}, upRow = {}, downRow = {}, wires = {}, pkts = {};

  var focus = CV.attachFocus(svg, {
    /* 每张卡都既发又收，聚焦任何一段都不该让别卡褪色 */
    keepCards: function () { return RANKS; }
  });

  function cardGeo(r) {
    return {
      x: L.grid.x + (r & 1) * L.grid.dx,
      y: L.grid.y + (r >> 1) * L.grid.dy,
      w: L.card.w, h: L.card.h
    };
  }

  /* 从卡片中心朝对方中心发射，取与矩形边界的交点 —— 正交边和对角线共用一套 */
  function edgeEnds(a, b) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;

    /* 注意两端方向相反：a 顺着 u 出去，b 要逆着 u 回来，否则会取到
       b 卡「远端」的那个交点，线就横穿整张卡 */
    function hit(c, dx, dy, w, h) {
      var sx = dx === 0 ? Infinity : (w / 2) / Math.abs(dx);
      var sy = dy === 0 ? Infinity : (h / 2) / Math.abs(dy);
      var t = Math.min(sx, sy);
      return { x: c.x + dx * t, y: c.y + dy * t };
    }
    var s = hit(ac, ux, uy, a.w, a.h);
    var t2 = hit(bc, -ux, -uy, b.w, b.h);
    return { sx: s.x, sy: s.y, tx: t2.x, ty: t2.y };
  }

  /* 两端点直连。四条正交边和两条对角线共用 —— 对角线就是网格的
     真·几何对角线，在中心自然交叉成 X。 */
  function linePath(e) {
    return 'M ' + e.sx + ' ' + e.sy + ' L ' + e.tx + ' ' + e.ty;
  }

  /* 六条边：四正交 + 两对角（中心交叉） */
  var EDGES = [
    { a: 0, b: 1 },
    { a: 0, b: 2 },
    { a: 1, b: 3 },
    { a: 2, b: 3 },
    { a: 0, b: 3 },
    { a: 1, b: 2 }
  ];

  function edgeOf(x, y) {
    var lo = Math.min(x, y), hi = Math.max(x, y);
    for (var i = 0; i < EDGES.length; i++) {
      if (EDGES[i].a === lo && EDGES[i].b === hi) return EDGES[i];
    }
    return null;
  }

  function buildStage() {
    var v = L.view;
    svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);

    ['bg', 'cards', 'wires', 'chips', 'fx', 'labels'].forEach(function (k) {
      layer[k].innerHTML = '';
    });
    cards = {}; upRow = {}; downRow = {}; wires = {}; pkts = {};

    CV.drawGrid(layer.bg, v);

    CV.drawLegend(layer.bg, {
      x: L.grid.x + 7, y: L.legendY + 7,
      slot: L.slot, items: DATA
    });

    RANKS.forEach(function (r) {
      cards[r] = CV.drawCard(layer.cards, {
        key: r, geo: cardGeo(r), color: DATA[r].color,
        title: 'rank ' + r,
        badgeText: '4 片',
        hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
      });
    });

    /* 两排槽：上排待发、下排已收。整体在标题条以下的区域里垂直居中 */
    var c0 = L.slot;
    var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;
    var blockH = c0.sh * 2 + L.rowGap;
    var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;
    var padTop = (areaH - blockH) / 2;

    RANKS.forEach(function (r) {
      var geo = cards[r].geo;
      var x0 = geo.x + (geo.w - totalW) / 2;
      var yUp = geo.y + areaY + padTop;
      var yDn = yUp + c0.sh + L.rowGap;
      var up = [], dn = [];
      for (var i = 0; i < PARTS; i++) {
        up.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), yUp, c0.sw, c0.sh));
        dn.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), yDn, c0.sw, c0.sh));
      }
      upRow[r] = up; downRow[r] = dn;
    });

    /* 六条无箭头连线：每条边两个方向都要用，画箭头只会说对一半 */
    EDGES.forEach(function (ed) {
      var e = edgeEnds(cards[ed.a].geo, cards[ed.b].geo);
      var w = CV.drawWire(layer.wires, { d: linePath(e) });
      wires[ed.a + '_' + ed.b] = {
        path: w.path, len: w.len,
        sx: e.sx, sy: e.sy, tx: e.tx, ty: e.ty
      };
    });

    /* 数据包：每条流一个（12 个），不能按段共用 */
    FLOWS.forEach(function (list, q) {
      list.forEach(function (f) {
        pkts[q + '_' + f.from] = CV.drawPacket(layer.fx, {
          letter: DATA[f.from].letter, color: DATA[f.from].color
        });
      });
    });

    focus.refresh();
  }

  /* ══════════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════════ */
  var seen = {};

  function paint(t) {
    var sec = t * TOTAL;

    RANKS.forEach(function (r) {
      /* 徽章看的是下排（结果排）：轮到自己当接收方才从 0/4 变 4/4。
         用分数而不是「剩几片」，是因为上排递减到最后会显示「0 片」，
         看起来像出了问题，而 0/4 → 4/4 的读法没有歧义。 */
      var bt = (sec >= R[r].arrive ? PARTS : 0) + '/' + PARTS;
      if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;

      /* —— 上排：自己那份切出来的四片，第 j 步开始那一刻发出第 j 片 —— */
      upRow[r].forEach(function (s, j) {
        if (sec >= R[j].start) {
          CV.setSlot(s, null, {});
        } else {
          CV.setSlot(s, { letter: DATA[r].letter, color: DATA[r].color, sub: j }, {});
        }
      });

      /* —— 下排：只有轮到自己当接收方的第 r 步才一次填满 —— */
      var filled = sec >= R[r].arrive;
      downRow[r].forEach(function (s, i) {
        if (!filled) {
          CV.setSlot(s, null, sec >= R[r].start ? { active: true } : {});
          delete seen['d' + r + i];
        } else {
          /* 第 i 格 = 卡 i 发来的第 r 片：颜色跟着来源卡走 */
          CV.setSlot(s, { letter: DATA[i].letter, color: DATA[i].color, sub: r }, {});
          var key = 'd' + r + i;
          if (!seen[key]) {
            seen[key] = 1;
            CV.spawnPulse(layer.fx, s);
          }
        }
      });
    });

    /* —— 连线 & 数据包 —— */
    /* 先把所有包藏起来，只有本步在飞的那三个会重新显形 */
    Object.keys(pkts).forEach(function (k) { pkts[k].g.setAttribute('opacity', '0'); });

    FLOWS.forEach(function (list, q) {
      /* 先全部退灰，再把本步的三条点亮 */
      EDGES.forEach(function (ed) {
        var w = wires[ed.a + '_' + ed.b];
        w.path.setAttribute('stroke', '#c3cadb');
        w.path.setAttribute('stroke-width', '1.4');
        w.path.setAttribute('stroke-dasharray', '6 6');
        w.path.setAttribute('opacity', '.9');
      });

      var rd = R[q];
      var active = sec >= rd.start && sec < rd.arrive;
      var done = sec >= rd.popEnd;

      list.forEach(function (f) {
        var w = wires[Math.min(f.from, f.to) + '_' + Math.max(f.from, f.to)];
        var p = pkts[q + '_' + f.from];
        var col = DATA[f.from].color;
        var rev = f.from > f.to;   /* 边是按 a<b 画的，流可能反着走 */

        if (active) {
          var e = CV.easeInOutQuad((sec - rd.start) / (rd.arrive - rd.start));
          CV.placePacket(p, w, e, rev);
          w.path.setAttribute('stroke', col);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
        } else if (done) {
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', col);
          w.path.setAttribute('stroke-width', '1.6');
          w.path.setAttribute('stroke-dasharray', '6 6');
          w.path.setAttribute('opacity', '.3');
        } else {
          p.g.setAttribute('opacity', '0');
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
