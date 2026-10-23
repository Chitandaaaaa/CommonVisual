/* ============================================================
   CommonVisual · Gather（收集）动态演示
   ------------------------------------------------------------
   本文件只放「这个原语特有的东西」：数据、时间轴、文案、几何、渲染规则。
   绘制与控件在 assets/cv/ 下复用。

   新增原语（Scatter / All-Gather …）时：
     1. 复制本文件改名
     2. 改 ① 数据 / ② 路由 / ③ 文案 / ④ 几何
     3. 改 paint() 里「槽位怎么落位」这一段
     4. 复用 cv/kit.js、cv/controls.js、cv/focus.js
   ============================================================ */
(function () {
  'use strict';

  var el = CV.el, $ = CV.$, clamp = CV.clamp;

  /* ══════════════════════════════════════════════════════════
     ① 数据：每个 rank 持有的那一段
     ══════════════════════════════════════════════════════════ */
  var DATA = [
    { r: 0, letter: 'A', color: '#7c3aed' },
    { r: 1, letter: 'B', color: '#0891b2' },
    { r: 2, letter: 'C', color: '#059669' },
    { r: 3, letter: 'D', color: '#d97706' }
  ];

  /* ══════════════════════════════════════════════════════════
     ② 路由：谁在什么时刻把数据送到哪里
     ══════════════════════════════════════════════════════════ */
  var ROUTE = {
    target: 0,                     /* 收集到 rank 0 */
    preallocAt: 0.10,              /* 目标卡在这一刻预留接收位 */
    flows: [
      { from: 1, start: 0.20, end: 0.38 },
      { from: 2, start: 0.38, end: 0.56 },
      { from: 3, start: 0.56, end: 0.74 }
    ]
  };

  /* ══════════════════════════════════════════════════════════
     ③ 文案：一步一条，rank 编号与数据字母都用色块
     ══════════════════════════════════════════════════════════ */
  function rk(n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; }
  function seg(n) { return '<em class="c' + DATA[n].letter + '">' + DATA[n].letter + '</em>'; }

  var STEPS = [
    { t: 0.00, text: rk(0) + ' ' + rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 分别持有 ' +
                       seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) },
    { t: 0.10, text: rk(0) + ' 预留 <b>4 份</b> 缓冲' },
    { t: 0.20, text: rk(1) + ' 发送 ' + seg(1) },
    { t: 0.38, text: rk(2) + ' 发送 ' + seg(2) },
    { t: 0.56, text: rk(3) + ' 发送 ' + seg(3) },
    { t: 0.74, text: rk(0) + ' 集齐 ' + seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) }
  ];

  /* ══════════════════════════════════════════════════════════
     ④ 几何：宽窄两套，卡片尺寸一致
     ══════════════════════════════════════════════════════════ */
  var GEO = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      target: { x: 10,  y: 255 },
      source: { x: 820, ys: [50, 255, 460] },
      legendY: 50,
      slot: { sw: 46, sh: 46, gap: 12 },
      hdr: 36,
      title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      target: { x: 6,   y: 297 },
      source: { x: 226, ys: [40, 297, 554] },
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
    bg:    $('#lBg'),
    cards: $('#lCards'),
    wires: $('#lWires'),
    chips: $('#lChips'),
    fx:    $('#lFx'),
    labels: $('#lLabels')
  };

  var L = GEO.desktop;
  var cards = {}, chips = {}, wires = {}, pkts = {};
  var slotOfRank = {};                     /* rank → 目标卡里的槽位下标 */
  DATA.forEach(function (d, i) { slotOfRank[d.r] = i; });

  var focus = CV.attachFocus(svg, {
    keepCards: function (letter) {
      var hit = DATA.filter(function (d) { return d.letter === letter; })[0];
      if (!hit) return [];
      var keep = [ROUTE.target];
      if (hit.r !== ROUTE.target) keep.push(hit.r);
      return keep;
    }
  });

  function buildStage() {
    var v = L.view;
    svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);

    ['bg', 'cards', 'wires', 'chips', 'fx', 'labels'].forEach(function (k) {
      layer[k].innerHTML = '';
    });
    cards = {}; chips = {}; wires = {}; pkts = {};

    var defs = svg.querySelector('defs');

    /* 背景网格 */
    CV.drawGrid(layer.bg, v);

    /* 图例：一整份数据由若干块拼成 */
    CV.drawLegend(layer.bg, {
      x: L.target.x + 7, y: L.legendY + 7,
      slot: L.slot, items: DATA
    });

    /* 箭头：每条流一个 */
    ROUTE.flows.forEach(function (f) {
      var m = CV.drawMarker(defs, 'ah' + f.from, DATA[slotOfRank[f.from]].letter);
      wires[f.from] = { markerPath: m.path };
    });

    /* 卡片 */
    DATA.forEach(function (d) {
      var isTarget = d.r === ROUTE.target;
      var geo = {
        x: isTarget ? L.target.x : L.source.x,
        y: isTarget ? L.target.y : L.source.ys[d.r - 1],
        w: L.card.w, h: L.card.h
      };
      var c = CV.drawCard(layer.cards, {
        key: d.r, geo: geo, color: d.color,
        title: 'rank ' + d.r,
        role: isTarget ? 'dst' : 'src',
        target: isTarget,
        hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
      });
      cards[d.r] = c;
    });

    /* 缓冲槽：目标卡横排铺满，源卡只有一个（与目标卡首格同列） */
    var c0 = L.slot;
    var totalW = DATA.length * c0.sw + (DATA.length - 1) * c0.gap;
    var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;

    DATA.forEach(function (d) {
      var geo = cards[d.r].geo;
      var list = [];
      if (d.r === ROUTE.target) {
        var y0 = geo.y + areaY + (areaH - c0.sh) / 2;
        var x0 = geo.x + (geo.w - totalW) / 2;
        for (var i = 0; i < DATA.length; i++) {
          list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y0, c0.sw, c0.sh));
        }
      } else {
        var y = geo.y + areaY + (areaH - c0.sh) / 2;
        var x = geo.x + (geo.w - totalW) / 2;
        list.push(CV.drawSlot(layer.chips, x, y, c0.sw, c0.sh));
      }
      chips[d.r] = list;
    });

    /* 连线：源卡左边缘 → 目标卡右边缘 */
    var dst = cards[ROUTE.target].geo;
    ROUTE.flows.forEach(function (f) {
      var src = cards[f.from].geo;
      var sx = src.x, sy = src.y + src.h / 2;
      var tx = dst.x + dst.w + 4;
      var ty = dst.y + dst.h * (0.28 + 0.22 * (slotOfRank[f.from] - 1));
      var span = sx - tx;
      var d = 'M ' + sx + ' ' + sy +
              ' C ' + (sx - span * 0.42) + ' ' + sy + ', ' + (tx + span * 0.42) + ' ' + ty +
              ', ' + tx + ' ' + ty;
      var w = CV.drawWire(layer.wires, {
        d: d, letter: DATA[slotOfRank[f.from]].letter, markerId: 'ah' + f.from
      });
      wires[f.from] = { path: w.path, len: w.len, marker: wires[f.from].markerPath };
    });

    /* 数据包 */
    ROUTE.flows.forEach(function (f) {
      var d = DATA[slotOfRank[f.from]];
      pkts[f.from] = CV.drawPacket(layer.fx, { letter: d.letter, color: d.color });
    });

    focus.refresh();
  }

  /* ══════════════════════════════════════════════════════════
     渲染：给定时间 t（0~1）画出当下状态
     ══════════════════════════════════════════════════════════ */
  var popSeen = {};

  function paint(t) {
    /* 目标卡已收到几份、正在收哪一份 */
    var count = 1, activeRank = -1;
    ROUTE.flows.forEach(function (f) {
      if (t >= f.end) count += 1;
      else if (t >= f.start) activeRank = f.from;
    });

    /* —— 槽位 —— */
    DATA.forEach(function (d) {
      chips[d.r].forEach(function (s, i) {
        var data = null, active = false, hidden = false;

        if (d.r === ROUTE.target) {
          if (i < count) data = DATA[i];
          else if (i === slotOfRank[activeRank]) {
            active = true;
            /* 目标卡在预分配之前还没有这些接收位 */
            hidden = t < ROUTE.preallocAt;
          } else {
            hidden = t < ROUTE.preallocAt;
          }
        } else if (i === 0) {
          data = d;
        }

        CV.setSlot(s, data, { active: active, hidden: hidden });
      });

      /* 发出去的那张卡压暗一点 */
      var sending = ROUTE.flows.some(function (f) {
        return f.from === d.r && t >= f.start && t < f.end;
      });
      cards[d.r].g.setAttribute('opacity', sending ? '.6' : '1');
    });

    /* —— 连线 & 数据包 —— */
    ROUTE.flows.forEach(function (f) {
      var w = wires[f.from], p = pkts[f.from];
      var idx = slotOfRank[f.from];
      var color = DATA[idx].color;
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

    /* —— 落地脉冲 —— */
    ROUTE.flows.forEach(function (f) {
      var key = 'p' + f.from;
      var s = chips[ROUTE.target][slotOfRank[f.from]];
      if (t >= f.end && !popSeen[key]) {
        popSeen[key] = 1;
        CV.spawnPulse(layer.fx, s, DATA[slotOfRank[f.from]].color);
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
