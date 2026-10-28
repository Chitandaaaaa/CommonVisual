/* ============================================================
   CommonVisual · All-to-All（全互换）动态演示
   ------------------------------------------------------------
   唯一「每张卡都要跟每张卡说话」的原语：每卡把自己那份切成 N 片、
   第 j 片给 rank j，结果是一次**转置**（位置不变、来源全换）。

   为什么画两排缓冲：in-place all-to-all 输入槽 j 与输出槽 j 含义不同，
   只有一套格子会一边清空一边被填。上排=待发出，下排=已收到。

   12 条消息按目的地分 4 步（每步 3 条边），否则 12 个包同时飞看不清。
   连线是双向直连（4 正交边 + 2 对角线中心成 X），不画箭头。

   只声明数据 / 时间轴 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  /* ── ② 时间轴（秒）+ 路由 ── */
  var TM = { init: 0.9, fly: 0.95, pop: 0.5, gap: 0.4 };
  var STEPS_N = 4;
  var CYCLE = TM.fly + TM.pop + TM.gap;
  var TOTAL = TM.init + CYCLE * STEPS_N - TM.gap + 0.6;
  function N(sec) { return sec / TOTAL; }

  var R = [];
  (function () {
    for (var q = 0; q < STEPS_N; q++) {
      var s = TM.init + q * CYCLE;
      R.push({ q: q, start: s, arrive: s + TM.fly, popEnd: s + TM.fly + TM.pop });
    }
  })();

  /* FLOWS[q] = 第 q 步在飞的三个包 */
  var FLOWS = R.map(function (rd) {
    var list = [];
    RANKS.forEach(function (s) {
      if (s !== rd.q) list.push({ from: s, to: rd.q, seg: rd.q });
    });
    return list;
  });

  /* ── ③ 文案 ── */
  var X = CV.primText(DATA);
  var rk = X.rk, seg = X.seg, whole = X.whole;

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

  /* ── ④ 几何：2×2 网格 + 两排缓冲（只写位置）── */
  var GEO = CV.geo({
    desktop: { grid: { x: 175, y: 136, dx: 480, dy: 330 }, legendY: 17,  rowGap: 12 },
    narrow:  { grid: { x: 8,   y: 185, dx: 218, dy: 300 }, legendY: 113, rowGap: 8 }
  });

  var EDGES = [
    { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 1, b: 3 },
    { a: 2, b: 3 }, { a: 0, b: 3 }, { a: 1, b: 2 }
  ];

  var upRow = {}, downRow = {}, seen = {};

  function cardGeo(L, r) {
    return { x: L.grid.x + (r & 1) * L.grid.dx, y: L.grid.y + (r >> 1) * L.grid.dy, w: L.card.w, h: L.card.h };
  }

  /* 卡片中心朝对方中心发射，取与矩形边界交点 —— 正交边与对角线共用 */
  function edgeEnds(a, b) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
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

  function linePath(e) { return 'M ' + e.sx + ' ' + e.sy + ' L ' + e.tx + ' ' + e.ty; }

  CV.primitive({
    data: DATA,
    geo: GEO,
    steps: STEPS,
    duration: TOTAL * 1000,

    /* 每张卡都既发又收，聚焦任何一段都不该让别卡褪色 */
    keepCards: function () { return RANKS; },

    onReset: function () { upRow = {}; downRow = {}; seen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, wires = S.wires, pkts = S.pkts;

      CV.drawLegend(layer.bg, { x: L.grid.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      RANKS.forEach(function (r) {
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: cardGeo(L, r), color: DATA[r].color,
          title: 'rank ' + r, badgeText: '4 片',
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

      /* 两排槽：上排待发、下排已收，整体在标题条下区域垂直居中 */
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

      /* 六条无箭头连线 */
      EDGES.forEach(function (ed) {
        var e = edgeEnds(cards[ed.a].geo, cards[ed.b].geo);
        var w = CV.drawWire(layer.wires, { d: linePath(e) });
        wires[ed.a + '_' + ed.b] = { path: w.path, len: w.len, sx: e.sx, sy: e.sy, tx: e.tx, ty: e.ty };
      });

      /* 数据包：每条流一个（12 个），不能按段共用 */
      FLOWS.forEach(function (list, q) {
        list.forEach(function (f) {
          pkts[q + '_' + f.from] = CV.drawPacket(layer.fx, {
            letter: DATA[f.from].letter, color: DATA[f.from].color
          });
        });
      });
    },

    paint: function (S, t) {
      var layer = S.layers, cards = S.cards, wires = S.wires, pkts = S.pkts;
      var sec = t * TOTAL;

      RANKS.forEach(function (r) {
        /* 徽章看下排（结果排）：轮到自己当接收方才 0/4 → 4/4 */
        var bt = (sec >= R[r].arrive ? PARTS : 0) + '/' + PARTS;
        if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;

        /* 上排：第 j 步开始那一刻发出第 j 片 */
        upRow[r].forEach(function (s, j) {
          if (sec >= R[j].start) {
            CV.setSlot(s, null, {});
          } else {
            CV.setSlot(s, { letter: DATA[r].letter, color: DATA[r].color, sub: j }, {});
          }
        });

        /* 下排：只有轮到自己当接收方的第 r 步才一次填满 */
        var filled = sec >= R[r].arrive;
        downRow[r].forEach(function (s, i) {
          if (!filled) {
            CV.setSlot(s, null, sec >= R[r].start ? { active: true } : {});
            delete seen['d' + r + i];
          } else {
            CV.setSlot(s, { letter: DATA[i].letter, color: DATA[i].color, sub: r }, {});
            var key = 'd' + r + i;
            if (!seen[key]) { seen[key] = 1; CV.spawnPulse(layer.fx, s); }
          }
        });
      });

      /* —— 连线 & 数据包 —— */
      Object.keys(pkts).forEach(function (k) { pkts[k].g.setAttribute('opacity', '0'); });

      FLOWS.forEach(function (list, q) {
        /* 先全部退灰，再把本步三条点亮 */
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
          var rev = f.from > f.to;

          if (active) {
            var e = CV.easeInOutQuad((sec - rd.start) / (rd.arrive - rd.start));
            CV.placePacket(p, w, e, rev);
            w.path.setAttribute('stroke', col);
            w.path.setAttribute('stroke-width', '2.6');
            w.path.setAttribute('stroke-dasharray', '9 7');
            w.path.setAttribute('opacity', '1');
          } else if (done) {
            CV.pktFadeOut(p, sec - rd.arrive);
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
  });
})();
