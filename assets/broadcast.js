/* ============================================================
   CommonVisual · Broadcast（广播）动态演示
   ------------------------------------------------------------
   一份数据复制给所有人（不是拆开分给各人）：每张卡最终都持有
   完整的 [A B C D]，源卡自己不丢失任何一段。
   只声明数据 / 路由 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];

  /* ── ② 路由：源卡把整份依次复制给其余三张 ── */
  var ROUTE = {
    source: 0,
    readyAt: 0.10,
    flows: [
      { to: 1, start: 0.20, end: 0.38 },
      { to: 2, start: 0.38, end: 0.56 },
      { to: 3, start: 0.56, end: 0.74 }
    ]
  };

  function flowOf(to) {
    return ROUTE.flows.filter(function (f) { return f.to === to; })[0];
  }

  /* ── ③ 文案 ── */
  var T = CV.primText(DATA);
  var rk = T.rk, seg = T.seg, whole = T.whole;

  var STEPS = [
    { t: 0.00, text: rk(0) + ' 持有整份 ' + whole() },
    { t: 0.10, text: rk(1) + rk(2) + rk(3) + ' 接收位就绪' },
    { t: 0.20, text: rk(0) + ' 广播整份给 ' + rk(1) },
    { t: 0.38, text: rk(0) + ' 广播整份给 ' + rk(2) },
    { t: 0.56, text: rk(0) + ' 广播整份给 ' + rk(3) },
    { t: 0.74, text: '四张卡各持整份 ' + whole() }
  ];

  /* ── ④ 几何：四张卡同构，每张都装得下整份 ── */
  var GEO = CV.geo({
    desktop: { source: { x: 10, y: 255 }, target: { x: 820, ys: [50, 255, 460] }, legendY: 50 },
    narrow:  { source: { x: 6,  y: 297 }, target: { x: 226, ys: [40, 297, 554] }, legendY: 40 }
  });

  var popSeen = {};

  CV.primitive({
    data: DATA,
    geo: GEO,
    steps: STEPS,
    duration: 9000,

    /* 每张卡最终都持有全部四段 —— 悬停任何一段四张卡都相关 */
    keepCards: function () { return RANKS; },

    onReset: function () { popSeen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;

      /* 图例：一份数据由四段拼成 */
      CV.drawLegend(layer.bg, { x: L.source.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      /* 卡片：四张同尺寸，源卡强调边框 */
      RANKS.forEach(function (r) {
        var isSource = r === ROUTE.source;
        var geo = {
          x: isSource ? L.source.x : L.target.x,
          y: isSource ? L.source.y : L.target.ys[r - 1],
          w: L.card.w, h: L.card.h
        };
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: geo, color: DATA[r].color,
          title: 'rank ' + r,
          role: isSource ? 'src' : 'dst',
          target: isSource,
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

      /* 缓冲槽：每张卡横排 4 个 */
      var c0 = L.slot;
      var n = DATA.length;
      var totalW = n * c0.sw + (n - 1) * c0.gap;
      var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;

      RANKS.forEach(function (r) {
        var geo = cards[r].geo;
        var y = geo.y + areaY + (areaH - c0.sh) / 2;
        var x0 = geo.x + (geo.w - totalW) / 2;
        var list = [];
        for (var i = 0; i < n; i++) {
          list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y, c0.sw, c0.sh));
        }
        chips[r] = list;
      });

      /* 箭头：不对应单一字母，不带 data-l（否则悬停会误灰） */
      ROUTE.flows.forEach(function (f) {
        CV.drawMarker(defs, 'ah' + f.to);
      });

      /* 连线：源卡右边缘 → 目标卡左边缘 */
      var src = cards[ROUTE.source].geo;
      ROUTE.flows.forEach(function (f) {
        var dst = cards[f.to].geo;
        var sx = src.x + src.w + 4;
        var sy = src.y + src.h * (0.28 + 0.22 * (f.to - 1));
        var tx = dst.x;
        var ty = dst.y + dst.h / 2;
        var span = tx - sx;
        var d = 'M ' + sx + ' ' + sy +
                ' C ' + (sx + span * 0.42) + ' ' + sy + ', ' + (tx - span * 0.42) + ' ' + ty +
                ', ' + tx + ' ' + ty;

        var w = CV.drawWire(layer.wires, { d: d, markerId: 'ah' + f.to });
        wires[f.to] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#ah' + f.to + ' path'),
          /* 三条流运同一份数据 → 统一源色（按目标分色会被误读成「只收到 B」） */
          color: DATA[ROUTE.source].color
        };
      });

      /* 数据包：每条流一个「整份」包 */
      ROUTE.flows.forEach(function (f) {
        pkts[f.to] = CV.drawPacketBatch(layer.fx, L.slot, DATA);
      });
    },

    paint: function (S, t) {
      var layer = S.layers, chips = S.chips, wires = S.wires, pkts = S.pkts;

      /* —— 源卡：原件一直留着 —— */
      chips[ROUTE.source].forEach(function (s, i) {
        CV.setSlot(s, DATA[i], {});
      });

      /* —— 目标卡：就绪前隐藏 → 传输中占位 → 到达后整份填满 —— */
      RANKS.forEach(function (r) {
        if (r === ROUTE.source) return;
        var f = flowOf(r);
        var inFlight = t >= f.start && t < f.end;
        var got = t >= f.end;
        chips[r].forEach(function (s, i) {
          CV.setSlot(s, got ? DATA[i] : null, {
            active: inFlight,
            hidden: t < ROUTE.readyAt
          });
        });
      });

      /* —— 连线 & 数据包 —— */
      ROUTE.flows.forEach(function (f) {
        var w = wires[f.to], p = pkts[f.to];
        var color = w.color;
        var active = t >= f.start && t < f.end;
        var done = t >= f.end;

        if (active) {
          /* 整份包很宽，起步先走出一小段，避免左半压住源卡数据块 */
          var lead = Math.min(0.32, p.half / w.len);
          var e = CV.easeInOutQuad((t - f.start) / (f.end - f.start));
          e = lead + e * (1 - lead);
          CV.placePacket(p, w, e);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', color);
        } else if (done) {
          CV.pktFadeOut(p, (t - f.end) * S.durSec);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('stroke-dashoffset', '0');
          w.path.setAttribute('opacity', '.4');
          w.marker.setAttribute('fill', color);
        } else {
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', '#c3cadb');
          w.path.setAttribute('stroke-width', '2');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('stroke-dashoffset', '0');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', '#c3cadb');
        }
      });

      /* —— 落位脉冲：整组 4 格一起弹一下 —— */
      ROUTE.flows.forEach(function (f) {
        var key = 'p' + f.to;
        if (t >= f.end && !popSeen[key]) {
          popSeen[key] = 1;
          chips[f.to].forEach(function (s, i) {
            CV.spawnPulse(layer.fx, s, DATA[i].color);
          });
        } else if (t < f.end && popSeen[key]) {
          delete popSeen[key];
        }
      });
    }
  });
})();
