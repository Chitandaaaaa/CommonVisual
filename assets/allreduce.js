/* ============================================================
   CommonVisual · All-Reduce（全归约）动态演示
   ------------------------------------------------------------
   起点必须是「每卡一整份 [A B C D]」——各卡只持一片那是 All-Gather
   的起点，不同位置的数据相加没有意义（README 那条设计决策对
   reduce / all-reduce / reduce-scatter 一视同仁）。

   算法 recursive doubling（两轮，整份互换 + 逐段相加）：
     第 1 轮 横向配对 0↔1、2↔3 —— 四段各合 2 份
     第 2 轮 纵向配对 0↔2、1↔3 —— 四段各合 4 份
   终点：四张卡都是 [Σ Σ Σ Σ]，第 i 段 = 四张卡第 i 段的和。
   和 reduce-scatter 是同一张网格的正反两面：那边段数 4→2→1，
   这边份数 1→2→4 —— 段数恒为 4，变的是每段的份数。

   颜色表达份数：mix(段原色, 深紫, (份数−1)/3)，4 份纯深紫并显示 Σ。

   包是「整份」四段一排（桌面约 100px 宽），所以车道间距 HUMP
   必须 ≥ 包半宽，否则两条车道上的对向包会叠在一起。

   只声明数据 / 时间轴 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  var DEEP = '#4c1d95';

  /* 段 s 合了 n 份之后的颜色 */
  function colorFor(s, n) {
    return CV.mix(DATA[s].color, DEEP, (n - 1) / (PARTS - 1));
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

  /* 第 i 段此刻合了几份：整份互换，四张卡四段永远同步 */
  function partsAt(sec) {
    if (sec >= ROW_DONE[1]) return 4;
    if (sec >= ROW_DONE[0]) return 2;
    return 1;
  }

  /* ── ③ 文案 ── */
  var X = CV.primText(DATA);
  var rk = X.rk, seg = X.seg, whole = X.whole;
  var SIG = '<em class="sig">Σ</em>';

  var STEPS = [
    { t: 0,
      text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一整份 ' + whole() + '，四段都在每张卡上，逐段待相加',
      short: '四卡各持一整份 ' + whole() },
    { t: N(TM.init),
      text: '第 1 轮：' + rk(0) + rk(1) + ' 左右互换整份，' + rk(2) + rk(3) + ' 左右互换整份 —— ' +
            seg(0) + ' 只和 ' + seg(0) + ' 加、' + seg(1) + ' 只和 ' + seg(1) + ' 加，四段各合 2 份',
      short: '第 1 轮 横向互换，四段各合 2 份' },
    { t: N(TM.init + CYCLE),
      text: '第 2 轮：' + rk(0) + rk(2) + ' 上下互换整份，' + rk(1) + rk(3) + ' 上下互换整份 —— ' +
            '仍是按段对位相加，四段各合 4 份',
      short: '第 2 轮 纵向互换，四段各合 4 份' },
    { t: N(TOTAL - 0.6),
      text: '四张卡都变成 ' + SIG + SIG + SIG + SIG + '：第 i 段 = 四张卡第 i 段的和，四份结果完全相同',
      short: '四卡都是四段各自的和 ' + SIG + SIG + SIG + SIG }
  ];

  /* ── ④ 几何：2×2 网格（与 All-Gather / Reduce-Scatter 同尺寸）──
     hump = 双向交换的法向错开量；总车道间距 = 2*hump，必须大于整份包宽度 */
  var GEO = CV.geo({
    desktop: { grid: { x: 175, y: 136, dx: 480, dy: 330 }, legendY: 17, hump: 62 },
    narrow:  { grid: { x: 8,   y: 185, dx: 218, dy: 300 }, legendY: 113, hump: 34 }
  });

  var seen = {};        /* 'n<rank><段>' → 该段当前是几份；变档才重画 + 弹一下 */

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

    /* 四张卡都持有全部四段 —— 悬停任何一段，四张卡都相关 */
    keepCards: function () { return RANKS; },

    /* 拖回开头：清掉「这一段已经是几份」的标记，让它下次重新到位、重新弹 */
    onReset: function () { seen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;
      var HUMP = L.hump;

      CV.drawLegend(layer.bg, { x: L.grid.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      RANKS.forEach(function (r) {
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: cardGeo(L, r), color: DATA[r].color,
          title: 'rank ' + r, badgeText: '1 份',
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

      /* 缓冲槽：每张卡横排 4 个 —— 通信前后都是 4 段，变的是每段的份数 */
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

      /* 每条有向交换一条线 + 一个「整份」包，各配自己的箭头 marker
         （同一轮四条边发的份数相同但发方不同，颜色按发方 rank 走） */
      var mi = 0;
      ROUTE.rounds.forEach(function (list, q) {
        list.forEach(function (f) {
          var e = edgeEnds(cards[f.from].geo, cards[f.to].geo);
          var id = 'ar' + (mi++);
          CV.drawMarker(defs, id);
          var w = CV.drawWire(layer.wires, { d: wirePath(e, HUMP), markerId: id });
          var se = shiftEnds(e, HUMP);
          var k = q + '_' + f.from + '_' + f.to;
          wires[k] = {
            path: w.path, len: w.len,
            marker: defs.querySelector('#' + id + ' path'),
            sx: se.sx, sy: se.sy, tx: se.tx, ty: se.ty
          };
          /* 整份包：四段一排，颜色 = 该段合了 q+1 份时的颜色 */
          var sendParts = q + 1;
          pkts[k] = CV.drawPacketBatch(layer.fx, L.slot, DATA.map(function (d, i) {
            return { letter: d.letter, color: colorFor(i, sendParts) };
          }));
        });
      });
    },

    paint: function (S, t) {
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var sec = t * TOTAL;
      var parts = partsAt(sec);

      /* —— 槽位：段数恒 4，份数变了才整体换色 ——
         四段不是一齐跳：第 i 段在 ROW_DONE[q] + i×seatGap 那一刻到位并弹一下。
         错峰量取规范 08 的 seatGap，本页不另写一个数；用「时刻」比 sec 而不是
         setTimeout 排队 —— 进度条能来回拖，定时器拖不回来。 */
      var base = parts >= PARTS ? ROW_DONE[1] : (parts >= 2 ? ROW_DONE[0] : 0);
      RANKS.forEach(function (r) {
        var minN = PARTS;                       /* 徽章跟着最后一段走，别提前报数 */
        chips[r].forEach(function (s, i) {
          var want = (parts > 1 && sec >= CV.seatAt(i, base)) ? parts : 1;
          if (want < minN) minN = want;
          var key = 'n' + r + i;
          if (seen[key] === want) return;
          seen[key] = want;
          if (want === PARTS) CV.setSlot(s, { letter: 'Σ', color: DEEP }, {});
          else CV.setSlot(s, { letter: DATA[i].letter, color: colorFor(i, want) }, {});
          if (want > 1) CV.spawnPulse(layer.fx, s);
        });
        var bt = minN + ' 份';
        if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;
      });

      /* —— 连线 & 数据包 —— */
      ROUTE.rounds.forEach(function (list, q) {
        list.forEach(function (f) {
          var k = q + '_' + f.from + '_' + f.to;
          var w = wires[k], p = pkts[k];
          var active = sec >= f.start && sec < f.arrive;

          var sendParts = q + 1;
          var color = colorFor(f.from, sendParts);

          if (active) {
            var e = CV.easeInOutQuad((sec - f.start) / (f.arrive - f.start));
            /* 整份包很宽，起步先走出一小段，避免左半压住发卡的数据块 */
            var lead = Math.min(0.32, p.half / w.len);
            e = lead + e * (1 - lead);
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
