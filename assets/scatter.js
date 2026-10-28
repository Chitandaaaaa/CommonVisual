/* ============================================================
   CommonVisual · Scatter（分散）动态演示
   ------------------------------------------------------------
   与 gather 互为镜像：一个源把整份数据拆开逐个送到各目标。
   只声明数据 / 路由 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;

  /* ── ② 路由：rank 0 把第 i 段送给 rank i ── */
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
  var rk = T.rk, seg = T.seg;

  var STEPS = [
    { t: 0.00, text: rk(0) + ' 持有 ' + seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) },
    { t: 0.10, text: rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 接收位就绪' },
    { t: 0.20, text: rk(0) + ' 发送 ' + seg(1) + ' 给 ' + rk(1) },
    { t: 0.38, text: rk(0) + ' 发送 ' + seg(2) + ' 给 ' + rk(2) },
    { t: 0.56, text: rk(0) + ' 发送 ' + seg(3) + ' 给 ' + rk(3) },
    { t: 0.74, text: rk(0) + ' ' + rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 各持 1 段' }
  ];

  /* ── ④ 几何：与 gather 同套坐标、角色反过来 ── */
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

    keepCards: function (letter) {
      var hit = DATA.filter(function (d) { return d.letter === letter; })[0];
      if (!hit) return [];
      var keep = [ROUTE.source];
      if (hit.r !== ROUTE.source) keep.push(hit.r);
      return keep;
    },

    onReset: function () { popSeen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;

      /* 图例：源卡手里那一整份 */
      CV.drawLegend(layer.bg, { x: L.source.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      /* 卡片：源卡是主角 */
      DATA.forEach(function (d) {
        var isSource = d.r === ROUTE.source;
        var geo = {
          x: isSource ? L.source.x : L.target.x,
          y: isSource ? L.source.y : L.target.ys[d.r - 1],
          w: L.card.w, h: L.card.h
        };
        cards[d.r] = CV.drawCard(layer.cards, {
          key: d.r, geo: geo, color: d.color,
          title: 'rank ' + d.r,
          role: isSource ? 'src' : 'dst',
          target: isSource,
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

      /* 缓冲槽：源卡横排 4 个；目标卡各 1 个（与源卡首格同列） */
      var c0 = L.slot;
      var n = DATA.length;
      var totalW = n * c0.sw + (n - 1) * c0.gap;
      var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;

      DATA.forEach(function (d) {
        var geo = cards[d.r].geo;
        var list = [];
        var y = geo.y + areaY + (areaH - c0.sh) / 2;
        var x0 = geo.x + (geo.w - totalW) / 2;

        if (d.r === ROUTE.source) {
          for (var i = 0; i < n; i++) {
            list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y, c0.sw, c0.sh));
          }
        } else {
          list.push(CV.drawSlot(layer.chips, x0, y, c0.sw, c0.sh));
        }
        chips[d.r] = list;
      });

      /* 箭头 */
      ROUTE.flows.forEach(function (f) {
        CV.drawMarker(defs, 'ah' + f.to, DATA[f.to].letter);
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

        var w = CV.drawWire(layer.wires, { d: d, letter: DATA[f.to].letter, markerId: 'ah' + f.to });
        wires[f.to] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#ah' + f.to + ' path')
        };
      });

      /* 数据包 */
      ROUTE.flows.forEach(function (f) {
        var d = DATA[f.to];
        pkts[f.to] = CV.drawPacket(layer.fx, { letter: d.letter, color: d.color });
      });
    },

    paint: function (S, t) {
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;

      /* —— 源卡：A 留在自己这里，其余一旦起飞就腾空 —— */
      chips[ROUTE.source].forEach(function (s, i) {
        if (i === 0) { CV.setSlot(s, DATA[0], {}); return; }
        var sent = t >= flowOf(i).start;
        CV.setSlot(s, sent ? null : DATA[i], {});
      });

      /* —— 目标卡：收到之前先亮出空位；在飞的那段显示占位 —— */
      DATA.forEach(function (d) {
        if (d.r === ROUTE.source) return;
        var f = flowOf(d.r);
        var inFlight = t >= f.start && t < f.end;
        var got = t >= f.end;
        CV.setSlot(chips[d.r][0], got ? d : null, {
          active: inFlight,
          hidden: t < ROUTE.readyAt
        });
      });

      /* —— 连线 & 数据包 —— */
      ROUTE.flows.forEach(function (f) {
        var w = wires[f.to], p = pkts[f.to];
        var color = DATA[f.to].color;
        var active = t >= f.start && t < f.end;
        var done = t >= f.end;

        if (active) {
          var e = CV.easeInOutQuad((t - f.start) / (f.end - f.start));
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

      /* —— 落地脉冲：在接收方那张卡上 —— */
      ROUTE.flows.forEach(function (f) {
        var key = 'p' + f.to;
        var s = chips[f.to][0];
        if (t >= f.end && !popSeen[key]) {
          popSeen[key] = 1;
          CV.spawnPulse(layer.fx, s, DATA[f.to].color);
        } else if (t < f.end && popSeen[key]) {
          delete popSeen[key];
        }
      });
    }
  });
})();
