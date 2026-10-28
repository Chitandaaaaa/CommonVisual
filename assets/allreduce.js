/* ============================================================
   CommonVisual · All-Reduce（全归约）动态演示
   ------------------------------------------------------------
   四张卡都拿到同一归约结果（四卡平等）。recursive doubling 两轮：
     第 1 轮 横向配对 0↔1、2↔3
     第 2 轮 纵向配对 0↔2、1↔3
   每轮对向各发一份，收到就折进累加器，1→2→4 份。

   箭头成对：同一边两包对向而行，路径各偏 HUMP 错开。
   累加器颜色随份数向深紫 #4c1d95 收敛。

   只声明数据 / 时间轴 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  var DEEP = '#4c1d95';

  /* 双向交换法向错开量：总间距 = 2*HUMP，留一道车道缝 */
  var HUMP = 22;

  function colorFor(r, n) {
    return CV.mix(DATA[r].color, DEEP, (n - 1) / (PARTS - 1));
  }

  /* ── ② 时间轴（秒）+ 路由 ── */
  var TM = { init: 0.9, fly: 1.1, merge: 0.65, gap: 0.55 };
  var CYCLE = TM.fly + TM.merge + TM.gap;
  var TOTAL = TM.init + CYCLE * 2 - TM.gap + 0.6;
  function N(sec) { return sec / TOTAL; }

  var ROUNDS_DEF = [
    { pairs: [[0, 1], [2, 3]], label: '横向配对' },
    { pairs: [[0, 2], [1, 3]], label: '纵向配对' }
  ];

  var ROUTE = { rounds: [] };
  ROUNDS_DEF.forEach(function (rd, q) {
    var list = [];
    rd.pairs.forEach(function (p) {
      var a = p[0], b = p[1];
      list.push({ from: a, to: b, round: q });
      list.push({ from: b, to: a, round: q });
    });
    ROUTE.rounds.push(list);
  });

  ROUTE.rounds.forEach(function (list, q) {
    var s = TM.init + q * CYCLE;
    list.forEach(function (f) { f.start = s; f.arrive = s + TM.fly; f.mergeEnd = s + TM.fly + TM.merge; });
  });
  var ROW_DONE = ROUTE.rounds.map(function (list) { return list[0].mergeEnd; });

  function partsAt(sec) {
    if (sec >= ROW_DONE[1]) return 4;
    if (sec >= ROW_DONE[0]) return 2;
    return 1;
  }

  /* ── ③ 文案 ── */
  var X = CV.primText(DATA);
  var rk = X.rk, whole = X.whole;

  var STEPS = [
    { t: 0,
      text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一段 ' + whole(),
      short: '四卡各持一段 ' + whole() },
    { t: N(TM.init),
      text: '第 1 轮：' + rk(0) + rk(1) + ' 左右互换，' + rk(2) + rk(3) + ' 左右互换，各自合成 2 份',
      short: '第 1 轮 横向互换，各合成 2 份' },
    { t: N(TM.init + CYCLE),
      text: '第 2 轮：' + rk(0) + rk(2) + ' 上下互换，' + rk(1) + rk(3) + ' 上下互换，各自合成 4 份',
      short: '第 2 轮 纵向互换，各合成 4 份' },
    { t: N(TOTAL - 0.6),
      text: '四张卡都拿到同一份归约结果 ' + whole(),
      short: '四卡拿到同一结果 ' + whole() }
  ];

  /* ── ④ 几何：2×2 网格（与 All-Gather 同尺寸）── */
  var GEO = CV.geo({
    desktop: { grid: { x: 175, y: 136, dx: 480, dy: 330 }, legendY: 17 },
    narrow:  { grid: { x: 8,   y: 185, dx: 218, dy: 300 }, legendY: 113 }
  });

  var lastParts = -1;

  function cardGeo(L, r) {
    return { x: L.grid.x + (r & 1) * L.grid.dx, y: L.grid.y + (r >> 1) * L.grid.dy, w: L.card.w, h: L.card.h };
  }

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

  CV.primitive({
    data: DATA,
    geo: GEO,
    steps: STEPS,
    duration: TOTAL * 1000,

    keepCards: function () { return RANKS; },

    onReset: function () { lastParts = -1; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;

      CV.drawLegend(layer.bg, { x: L.grid.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      RANKS.forEach(function (r) {
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: cardGeo(L, r), color: DATA[r].color,
          title: 'rank ' + r, badgeText: '1/' + PARTS,
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
        chips[r] = CV.drawSlot(layer.chips, x, y, c0.sw, c0.sh);
      });

      /* 每条有向交换一条线 + 一个包，各配自己的箭头 marker（颜色随累加状态变） */
      var mi = 0;
      ROUTE.rounds.forEach(function (list, q) {
        list.forEach(function (f) {
          var e = edgeEnds(cards[f.from].geo, cards[f.to].geo);
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
    },

    paint: function (S, t) {
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var sec = t * TOTAL;
      var parts = partsAt(sec);

      /* —— 累加器：份数变了才改颜色 —— */
      if (parts !== lastParts) {
        lastParts = parts;
        RANKS.forEach(function (r) {
          var col = colorFor(r, parts);
          var a = chips[r];
          a.rect.setAttribute('fill', col);
          a.rect.setAttribute('stroke', 'none');
          a.rect.setAttribute('stroke-dasharray', 'none');
          a.text.setAttribute('fill', '#fff');
          a.text.textContent = parts === 1 ? DATA[r].letter : 'Σ';
          if (parts === 1) a.g.setAttribute('data-l', DATA[r].letter);
          else a.g.removeAttribute('data-l');

          if (parts === PARTS) CV.spawnPulse(layer.fx, a);
        });
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
            /* 线色三档：全完成→深紫淡线 / 本轮过但还有轮→中性灰 / 刚落地融合→保留发送色 */
            var allDone = sec >= ROW_DONE[1];
            var roundDone = sec >= ROW_DONE[f.round];
            var strokeCol = allDone ? DEEP : (roundDone ? '#c3cadb' : color);
            var op = allDone ? '.26' : (roundDone ? '.75' : '.42');
            CV.pktFadeOut(p, sec - f.arrive);
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
  });
})();
