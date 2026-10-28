/* ============================================================
   CommonVisual · Reduce-Scatter（归约分散）动态演示
   ------------------------------------------------------------
   All-Reduce 的前半段：逐段相加后按段切开分给各卡，
   每卡只留一段的和，四卡合起来才是完整结果。

   算法 recursive halving（两轮）：
     第 1 轮 同列配对（0↔2,1↔3），段数 4 → 2
     第 2 轮 同行配对（0↔1,2↔3），段数 2 → 1
   颜色表达份数：mix(段原色, 深紫, (份数−1)/3)，4 份纯深紫并显示 Σ。

   只声明数据 / 时间轴 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  var DEEP = '#4c1d95';

  /* 双向交换法向错开量（px）：第 1 轮两段并排的缩略条宽约 54px */
  var HUMP = 34;

  function colorFor(seg, n) {
    return CV.mix(DATA[seg].color, DEEP, (n - 1) / (PARTS - 1));
  }

  /* ── ② 时间轴（秒）+ 路由 ── */
  var TM = { init: 0.9, fly: 1.2, pop: 0.6, gap: 0.5 };
  var ROUNDS = 2;
  var CYCLE = TM.fly + TM.pop + TM.gap;
  var TOTAL = TM.init + CYCLE * ROUNDS - TM.gap + 0.6;
  function N(sec) { return sec / TOTAL; }

  var EMIT = [
    [[2, 3], [2, 3], [0, 1], [0, 1]],
    [[1],    [0],    [3],    [2]]
  ];
  var PARTNER = [
    [2, 3, 0, 1],
    [1, 0, 3, 2]
  ];

  var R = [];
  (function () {
    for (var q = 0; q < ROUNDS; q++) {
      var s = TM.init + q * CYCLE;
      R.push({ q: q, start: s, arrive: s + TM.fly, popEnd: s + TM.fly + TM.pop });
    }
  })();

  /* ── ③ 文案 ── */
  var X = CV.primText(DATA);
  var rk = X.rk, seg = X.seg, whole = X.whole;

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

  /* ── ④ 几何：2×2 网格（与 All-Gather / All-Reduce 同尺寸）── */
  var GEO = CV.geo({
    desktop: { grid: { x: 175, y: 136, dx: 480, dy: 330 }, legendY: 17 },
    narrow:  { grid: { x: 8,   y: 185, dx: 218, dy: 300 }, legendY: 113 }
  });

  var seen = {};

  function cardGeo(L, r) {
    return { x: L.grid.x + (r & 1) * L.grid.dx, y: L.grid.y + (r >> 1) * L.grid.dy, w: L.card.w, h: L.card.h };
  }

  /* 两卡连线端点：横向相邻走左右边，纵向相邻走上下边 */
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

    onReset: function () { seen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;

      CV.drawLegend(layer.bg, { x: L.grid.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      RANKS.forEach(function (r) {
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: cardGeo(L, r), color: DATA[r].color,
          title: 'rank ' + r, badgeText: '4 段',
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

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

      /* 箭头按「每条边」各建一个：同一轮的 4 条边发的段不同、混色也不同，
         共用一个 marker 的话 4 个箭头会被最后一条染成同一个颜色。 */
      R.forEach(function (rd) {
        RANKS.forEach(function (r) { CV.drawMarker(defs, 'ars' + rd.q + '_' + r); });
      });

      /* 每轮四条有向边，一条都不能共用 */
      R.forEach(function (rd) {
        RANKS.forEach(function (r) {
          var to = PARTNER[rd.q][r];
          var e = edgeEnds(cards[r].geo, cards[to].geo);
          var k = rd.q + '_' + r;
          var w = CV.drawWire(layer.wires, { d: wirePath(e, HUMP), markerId: 'ars' + rd.q + '_' + r });
          var se = shiftEnds(e, HUMP);
          wires[k] = {
            path: w.path, len: w.len,
            marker: defs.querySelector('#ars' + rd.q + '_' + r + ' path'),
            sx: se.sx, sy: se.sy, tx: se.tx, ty: se.ty
          };
          var segs = EMIT[rd.q][r];
          pkts[k] = CV.drawPacketBatch(layer.fx, L.slot, segs.map(function (g) {
            return { letter: DATA[g].letter, color: colorFor(g, rd.q + 1) };
          }));
        });
      });
    },

    paint: function (S, t) {
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var sec = t * TOTAL;

      /* 卡 r 第 i 段此刻几份：0=已交出，1/2/4=在手上（送出是消耗语义）
         升到 2 份 / 4 份那一刻，第 i 段比第 i−1 段晚 seatGap（规范 08） ——
         四段依次到位并依次弹一下，不是一齐跳。 */
      function segParts(r, i) {
        var keep1 = ((i >> 1) === (r >> 1));
        var keep2 = (i === r);
        var at2 = CV.seatAt(i, R[0].arrive), at4 = CV.seatAt(i, R[1].arrive);
        if (!keep1) return sec >= R[0].start ? 0 : 1;
        if (!keep2) {
          if (sec >= R[1].start) return 0;
          if (sec >= at2) return 2;
          return 1;
        }
        if (sec >= at4) return PARTS;
        if (sec >= at2) return 2;
        return 1;
      }

      /* —— 槽位：份数决定颜色 —— */
      RANKS.forEach(function (r) {
        var left = 0;
        chips[r].forEach(function (s, i) {
          var n = segParts(r, i);
          if (n === 0) {
            CV.setSlot(s, null, {});
          } else if (n === PARTS) {
            CV.setSlot(s, { letter: 'Σ', color: DEEP }, {});
          } else {
            CV.setSlot(s, { letter: DATA[i].letter, color: colorFor(i, n) }, {});
          }
          if (n > 0) left++;

          /* 退回 1 份也要清标记 —— 否则拖回开头再播，这一段再也不弹了 */
          var key = 'p' + r + i;
          if (n > 1) {
            if (seen[key] !== n) { seen[key] = n; CV.spawnPulse(layer.fx, s); }
          } else {
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
            var allDone = sec >= R[ROUNDS - 1].popEnd;
            var strokeCol = allDone ? DEEP : col;
            CV.pktFadeOut(p, sec - rd.arrive);
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
  });
})();
