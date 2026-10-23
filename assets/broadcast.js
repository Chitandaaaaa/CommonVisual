/* ============================================================
   CommonVisual · Broadcast（广播）动态演示
   ------------------------------------------------------------
   与 gather / scatter 的区别：一份数据**复制**给所有人，而不是拆开分给各人。
   所以每张卡最终都持有完整的 [A B C D]，源卡自己不丢失任何一段。
   只改「数据 / 路由 / 文案 / 几何 / 落位规则」，绘制与控件复用 assets/cv/。
   ============================================================ */
(function () {
  'use strict';

  var $ = CV.$;

  /* ══════════════════════════════════════════════════════════
     ① 数据：一份完整数据由 4 段组成，全组一起被复制
     ══════════════════════════════════════════════════════════ */
  var DATA = [
    { letter: 'A', color: '#7c3aed' },
    { letter: 'B', color: '#0891b2' },
    { letter: 'C', color: '#059669' },
    { letter: 'D', color: '#d97706' }
  ];

  var RANKS = [0, 1, 2, 3];

  /* ══════════════════════════════════════════════════════════
     ② 路由：源卡把整份数据依次复制给其余三张卡
     ══════════════════════════════════════════════════════════ */
  var ROUTE = {
    source: 0,                     /* rank 0 持有原件并负责广播 */
    readyAt: 0.10,                 /* 目标卡在这一刻亮出接收位 */
    flows: [
      { to: 1, start: 0.20, end: 0.38 },
      { to: 2, start: 0.38, end: 0.56 },
      { to: 3, start: 0.56, end: 0.74 }
    ]
  };

  function flowOf(to) {
    return ROUTE.flows.filter(function (f) { return f.to === to; })[0];
  }

  /* ══════════════════════════════════════════════════════════
     ③ 文案
     ══════════════════════════════════════════════════════════ */
  function rk(n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; }
  function seg(n) { return '<em class="c' + DATA[n].letter + '">' + DATA[n].letter + '</em>'; }
  function whole() { return seg(0) + seg(1) + seg(2) + seg(3); }

  var STEPS = [
    { t: 0.00, text: rk(0) + ' 持有整份 ' + whole() },
    { t: 0.10, text: rk(1) + rk(2) + rk(3) + ' 接收位就绪' },
    { t: 0.20, text: rk(0) + ' 广播整份给 ' + rk(1) },
    { t: 0.38, text: rk(0) + ' 广播整份给 ' + rk(2) },
    { t: 0.56, text: rk(0) + ' 广播整份给 ' + rk(3) },
    { t: 0.74, text: '四张卡各持整份 ' + whole() }
  ];

  /* ══════════════════════════════════════════════════════════
     ④ 几何：四张卡完全同构 —— 每张都装得下整份数据
     ══════════════════════════════════════════════════════════ */
  var GEO = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      source: { x: 10,  y: 255 },
      target: { x: 820, ys: [50, 255, 460] },
      legendY: 50,
      slot: { sw: 46, sh: 46, gap: 12 },
      hdr: 36,
      title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      source: { x: 6,   y: 297 },
      target: { x: 226, ys: [40, 297, 554] },
      legendY: 40,
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
    wires:  $('#lWires'),
    chips:  $('#lChips'),
    fx:     $('#lFx'),
    labels: $('#lLabels')
  };

  var L = GEO.desktop;
  var cards = {}, chips = {}, wires = {}, pkts = {};

  var focus = CV.attachFocus(svg, {
    /* 每张卡最终都持有全部四段 —— 悬停某段时四张卡都与它有关，全部保留 */
    keepCards: function () { return RANKS; }
  });

  function buildStage() {
    var v = L.view;
    svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);

    ['bg', 'cards', 'wires', 'chips', 'fx', 'labels'].forEach(function (k) {
      layer[k].innerHTML = '';
    });
    cards = {}; chips = {}; wires = {}; pkts = {};

    var defs = svg.querySelector('defs');

    CV.drawGrid(layer.bg, v);

    /* 图例：一份数据由四段拼成 */
    CV.drawLegend(layer.bg, {
      x: L.source.x + 7, y: L.legendY + 7,
      slot: L.slot, items: DATA
    });

    /* 卡片：四张同尺寸，源卡用强调边框 */
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

    /* 缓冲槽：每张卡都是横排 4 个 */
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

    /* 箭头：不对应单一字母，因此不带 data-l（否则悬停会让它误灰） */
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
        /* 三条流运的是**同一份**数据，所以统一用源色；
           若按目标卡分色（青/绿/橙），会正好对应 B/C/D，
           容易被误读成「rank1 只收到 B」 */
        color: DATA[ROUTE.source].color
      };
    });

    /* 数据包：每条流一个「整份」包 */
    ROUTE.flows.forEach(function (f) {
      pkts[f.to] = CV.drawPacketBatch(layer.fx, L.slot, DATA);
    });

    focus.refresh();
  }

  /* ══════════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════════ */
  var popSeen = {};

  function paint(t) {
    /* —— 源卡：原件一直留着，广播不会让它少任何一段 —— */
    chips[ROUTE.source].forEach(function (s, i) {
      CV.setSlot(s, DATA[i], {});
    });

    /* —— 目标卡：就绪前隐藏 → 传输中 4 格一起占位 → 到达后整份填满 —— */
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
        /* 整份包比单段包宽得多（半宽约 50 单位），中心停在路径起点时
           左半会压住源卡里的数据块 —— 因此起步就先走出一小段，
           偏移量按「半包宽 / 路径长度」换算，宽窄屏都不会重叠 */
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
        p.g.setAttribute('opacity', '0');
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

  /* ══════════════════════════════════════════════════════════
     启动
     ══════════════════════════════════════════════════════════ */
  var controls = CV.createControls({
    steps: STEPS,
    duration: 9000,
    onFrame: paint
  });

  var lastMode = null;
  function syncLayout(force) {
    var mode = window.innerWidth < 860 ? 'narrow' : 'desktop';
    if (!force && mode === lastMode) return;
    lastMode = mode;
    L = GEO[mode];
    popSeen = {};
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
