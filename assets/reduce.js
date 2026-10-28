/* ============================================================
   CommonVisual · Reduce（归约）动态演示
   ------------------------------------------------------------
   gather 把 N 段「拼」起来（数据量变大）；reduce 把 N 份「加」起来
   （数据量不变，结果还是 4 格，颜色越加越浓）。

   两条语义铁律：
   ① 不存在「先堆起来再压缩」的中间态：rank0 只有一个累加器，每来一份立刻折进。
   ② reduce 是**消耗**数据，源卡交出去缓冲区就空（broadcast 才是复制）。

   目标卡三态：一份同构 → 预留长高放第二排 → 计算再长高放方框 → 收窄。
   卡片中心固定，高度变化上下同时扩。

   只声明数据 / 时间轴 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var el = CV.el, clamp = CV.clamp;

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  /* 融合节奏全走规范 09：单段 SEG = fuseDur（一段折多久）、段间 GAP = mergeGap
     （多段依次折时相邻两段错开多久）。两个都在规范页右侧调试台改，本页不另存一份 ——
     否则规范页把融合调快了，这一页还是原速。
     不属于规范的只有「这一趟折完到下一趟开始停多久」（TM.fly 那些编排秒）。 */
  var SEG = CV.specVal('fuseDur') || 0.55;
  var GAP = CV.specVal('mergeGap') || 0.5;

  /* ── ② 时间轴（秒）── */
  var TM = {
    init: 0.6, prealloc: 0.7, fly: 1.7, pop: 0.6, grow: 0.4,
    merge: SEG + 3 * GAP, shrink: 0.4
  };

  var CYCLE = TM.fly + TM.pop + TM.grow + TM.merge + TM.shrink;
  var TOTAL = TM.init + TM.prealloc + CYCLE * 3 + 0.5;
  function N(sec) { return sec / TOTAL; }

  var ROUTE = { target: 0, flows: [] };
  (function () {
    var s = TM.init + TM.prealloc;
    for (var i = 1; i <= 3; i++) {
      var f = {
        from: i,
        start: s,
        arrive: s + TM.fly,
        popEnd: s + TM.fly + TM.pop,
        growEnd: s + TM.fly + TM.pop + TM.grow,
        mergeEnd: s + TM.fly + TM.pop + TM.grow + TM.merge,
        end: s + TM.fly + TM.pop + TM.grow + TM.merge + TM.shrink
      };
      ROUTE.flows.push(f);
      s = f.end;
    }
  })();

  function flowOf(from) {
    return ROUTE.flows.filter(function (f) { return f.from === from; })[0];
  }

  function mergeE(p, i) { return clamp((p * TM.merge - i * GAP) / SEG, 0, 1); }

  function doneParts(sec) {
    var n = 1;
    ROUTE.flows.forEach(function (f) { if (sec >= f.mergeEnd) n++; });
    return n;
  }

  /* 越加越浓 */
  function sumColor(base, n) { return CV.mix(base, '#190d33', 0.19 * (n - 1)); }

  var POP_EASE = CV.cubicBezier(.2, .9, .3, 1.45);
  function popOf(q) {
    if (q <= 0) return { k: 0.35, o: 0 };
    if (q >= 1) return { k: 1, o: 1 };
    if (q < 0.55) {
      var e = POP_EASE(q / 0.55);
      return { k: 0.35 + (1.16 - 0.35) * e, o: Math.min(1, e) };
    }
    var e2 = POP_EASE((q - 0.55) / 0.45);
    return { k: 1.16 + (1 - 1.16) * e2, o: 1 };
  }

  /* ── ③ 文案 ── */
  var X = CV.primText(DATA);
  var rk = X.rk, whole = X.whole;

  var STEPS = [
    { t: 0, text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持整份 ' + whole() },
    { t: N(TM.init), text: rk(0) + ' 预留 4 份缓冲' }
  ];
  ROUTE.flows.forEach(function (f) {
    STEPS.push({ t: N(f.start), text: rk(f.from) + ' 的整份送往 ' + rk(0) });
    STEPS.push({ t: N(f.popEnd), text: '逐段相加，累加到 ' + (f.from + 1) + ' 份' });
  });
  STEPS.push({ t: N(ROUTE.flows[ROUTE.flows.length - 1].end), text: '结果只留在 ' + rk(0) });

  /* ── ④ 几何 ── */
  var GEO = CV.geo({
    desktop: {
      target: { x: 10, cy: 340 }, source: { x: 820, ys: [50, 255, 460] }, legendY: 50,
      areaPad: 12, rowGap: 12, calcGap: 10,
      calc: { w: 56, h: 22, fs: 11.5, tipFs: 10.5, tipText: 'sum · avg · max · min' }
    },
    narrow: {
      target: { x: 6, cy: 360 }, source: { x: 226, ys: [40, 297, 554] }, legendY: 40,
      areaPad: 9, rowGap: 8, calcGap: 7,
      calc: { w: 40, h: 16, fs: 9, tipFs: 8, tipText: 'sum · avg' }
    }
  });

  /* 页面级状态（每轮重建前由 onReset 清空） */
  var L = null;
  var ghost = {}, emptyRow = [], calc = null, seen = {}, rowStep = 0;

  function padTop() { return (L.card.h - L.hdr - 16 - L.slot.sh) / 2; }
  function padTop2(CH) { return (CH.h2 - L.hdr - 2 * L.slot.sh - L.rowGap) / 2; }

  var PRE_WIDEN = 25;
  function cardH() {
    var c0 = L.slot;
    var h1 = L.card.h;
    var h2 = h1 + c0.sh + L.rowGap - PRE_WIDEN;
    var h3 = h2 + L.calcGap + L.calc.h + L.areaPad - 16;
    return { h1: h1, h2: h2, h3: h3 };
  }

  function moveSlot(s, y) {
    s.rect.setAttribute('y', y);
    s.text.setAttribute('y', y + s.h / 2);
    s.y = y;
    s.cy = y + s.h / 2;
  }

  /* 连线落点：三条线沿目标卡右缘、在标题条以下空白里按 25/50/75% 分布 */
  function layoutWires(cardTop, cardHgt) {
    var areaTop = cardTop + L.hdr, areaH = cardHgt - L.hdr;
    ROUTE.flows.forEach(function (f) {
      var w = wiresFn(f.from);
      var ty = areaTop + areaH * (0.25 + 0.25 * w.k);
      var span = w.sx - w.tx;
      var d = 'M ' + w.sx + ' ' + w.sy +
              ' C ' + (w.sx - span * 0.42) + ' ' + w.sy + ', ' + (w.tx + span * 0.42) + ' ' + ty +
              ', ' + w.tx + ' ' + ty;
      w.path.setAttribute('d', d);
      w.len = w.path.getTotalLength();
    });
  }
  /* wires 在 paint 里由 S 提供，layoutWires 通过闭包变量取 */
  var wiresFn = function () { return null; };

  CV.primitive({
    data: DATA,
    geo: GEO,
    steps: STEPS,
    duration: TOTAL * 1000,

    keepCards: function () { return RANKS; },

    onReset: function () { ghost = {}; emptyRow = []; calc = null; seen = {}; },

    build: function (S) {
      L = S.L;
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;

      /* 图例 */
      CV.drawLegend(layer.bg, { x: L.target.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      /* 卡片：四张初始同高 */
      RANKS.forEach(function (r) {
        var isTarget = r === ROUTE.target;
        var geo = {
          x: isTarget ? L.target.x : L.source.x,
          y: isTarget ? L.target.cy - L.card.h / 2 : L.source.ys[r - 1],
          w: L.card.w, h: L.card.h
        };
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: geo, color: DATA[r].color,
          title: 'rank ' + r,
          role: isTarget ? 'dst' : 'src',
          target: isTarget,
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

      /* 缓冲槽 */
      var c0 = L.slot;
      var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;
      rowStep = c0.sh + L.rowGap;

      RANKS.forEach(function (r) {
        var geo = cards[r].geo;
        var x0 = geo.x + (geo.w - totalW) / 2;
        var list = [];
        if (r === ROUTE.target) {
          for (var i = 0; i < PARTS; i++) {
            list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap),
                                  geo.y + L.hdr + padTop(), c0.sw, c0.sh));
          }
        } else {
          var y = geo.y + L.hdr + padTop();
          for (var j = 0; j < PARTS; j++) {
            list.push(CV.drawSlot(layer.chips, x0 + j * (c0.sw + c0.gap), y, c0.sw, c0.sh));
          }
        }
        chips[r] = list;
      });

      /* 目标卡下排：常设 4 个空位（预留缓冲），一开始隐藏 */
      var tGeo0 = cards[ROUTE.target].geo;
      var tX0 = tGeo0.x + (tGeo0.w - totalW) / 2;
      for (var k = 0; k < PARTS; k++) {
        var e = CV.drawSlot(layer.chips, tX0 + k * (c0.sw + c0.gap), 0, c0.sw, c0.sh);
        e.g.style.opacity = '0';
        emptyRow.push(e);
      }

      /* 待归约的整份：画在 fx 层（可自由移动） */
      ROUTE.flows.forEach(function (f) {
        var list = [];
        for (var i = 0; i < PARTS; i++) {
          var out = el('g', { class: 'ghost-g', opacity: 0 }, layer.fx);
          var s = CV.drawSlot(out, tX0 + i * (c0.sw + c0.gap), 0, c0.sw, c0.sh);
          CV.setSlot(s, DATA[i], {});
          s.outer = out;
          list.push(s);
        }
        ghost[f.from] = list;
      });

      /* 箭头：整份数据不对应单一字母，不带 data-l */
      ROUTE.flows.forEach(function (f) { CV.drawMarker(defs, 'ah' + f.from); });

      /* 连线：源卡左边缘 → 目标卡右边缘，落点每帧重算 */
      ROUTE.flows.forEach(function (f, k) {
        var src = cards[f.from].geo;
        var sx = src.x;
        var sy = src.y + src.h / 2;
        var tx = cards[ROUTE.target].geo.x + cards[ROUTE.target].geo.w + 4;
        var w = CV.drawWire(layer.wires, { d: 'M 0 0', markerId: 'ah' + f.from });
        wires[f.from] = {
          path: w.path, len: 0,
          marker: defs.querySelector('#ah' + f.from + ' path'),
          sx: sx, sy: sy, tx: tx, k: k,
          color: DATA[ROUTE.target].color
        };
      });

      /* 数据包：每条流一个「整份」包 */
      ROUTE.flows.forEach(function (f) {
        pkts[f.from] = CV.drawPacketBatch(layer.fx, L.slot, DATA);
      });

      /* 计算方框（气泡宽度由 kit 按文案实测算） */
      calc = CV.drawCalc(layer.labels, {
        w: L.calc.w, h: L.calc.h,
        fs: L.calc.fs, tipFs: L.calc.tipFs, tipText: L.calc.tipText
      });
    },

    paint: function (S, t) {
      L = S.L;
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      wiresFn = function (from) { return wires[from]; };

      var sec = t * TOTAL;
      var c0 = L.slot;
      var CH = cardH();

      /* —— 阶段一：预留缓冲 —— */
      var pPre = clamp((sec - TM.init) / TM.prealloc, 0, 1);
      var growPre = CV.easeInOutQuad(clamp(pPre / 0.72, 0, 1));
      var rowA = clamp((growPre - 0.15) / 0.3, 0, 1);

      /* —— 阶段二：计算 —— */
      var growCal = 0, chipA = 0, cur = null, mergeP = 0;
      ROUTE.flows.forEach(function (f) {
        if (sec < f.popEnd || sec >= f.end) return;
        if (sec < f.growEnd) {
          var g = (sec - f.popEnd) / TM.grow;
          growCal = CV.easeInOutQuad(g);
          chipA = clamp((g - 0.35) / 0.5, 0, 1);
        } else if (sec < f.mergeEnd) {
          growCal = 1; chipA = 1;
          mergeP = (sec - f.growEnd) / TM.merge;
          cur = f;
        } else {
          var s = clamp((sec - f.mergeEnd) / TM.shrink, 0, 1);
          var FADE = 0.45;
          chipA = 1 - clamp(s / FADE, 0, 1);
          growCal = 1 - CV.easeInOutQuad(clamp((s - FADE) / (1 - FADE), 0, 1));
        }
      });

      /* —— 卡片几何 —— */
      var h = CH.h1 + (CH.h2 - CH.h1) * growPre + (CH.h3 - CH.h2) * growCal;
      var cardTop = L.target.cy - h / 2 + (CH.h3 - CH.h2) * growCal / 2;
      CV.resizeCard(cards[ROUTE.target], { x: L.target.x, y: cardTop, w: L.card.w, h: h });
      var tGeo = cards[ROUTE.target].geo;

      /* —— 两排数据的位置 —— */
      var topNow = growCal > 0 ? (L.target.cy - CH.h2 / 2) : cardTop;
      var pT = padTop() + (padTop2(CH) - padTop()) * growPre;
      var rowY = topNow + L.hdr + pT;
      var rowY2 = rowY + rowStep;
      var blankTop = rowY2 + c0.sh;
      var calcY = blankTop + Math.max(L.calcGap, (cardTop + h - blankTop - L.calc.h) / 2);

      chips[ROUTE.target].forEach(function (s) { moveSlot(s, rowY); });

      /* —— 下排接收位 —— */
      var lastMergeEnd = ROUTE.flows[ROUTE.flows.length - 1].mergeEnd;
      var waiting = sec < lastMergeEnd;
      emptyRow.forEach(function (s) {
        moveSlot(s, rowY2);
        CV.setSlot(s, null, { active: waiting });
        s.g.style.opacity = String(rowA);
      });
      ROUTE.flows.forEach(function (f) {
        ghost[f.from].forEach(function (s) { moveSlot(s, rowY2); });
      });

      var n = doneParts(sec);

      /* —— 累加器（上排）—— */
      chips[ROUTE.target].forEach(function (s, i) {
        var base = DATA[i].color;
        var c = sumColor(base, n);
        if (cur) c = CV.mix(c, sumColor(base, n + 1), mergeE(mergeP, i));
        CV.setSlot(s, { letter: DATA[i].letter, color: c }, {});
      });

      /* —— 源卡：交出去就不再留着（消耗语义）—— */
      RANKS.forEach(function (r) {
        if (r === ROUTE.target) return;
        var f = flowOf(r);
        var sending = f && sec >= f.start && sec < f.arrive;
        var gone = f && sec >= f.arrive;
        chips[r].forEach(function (s, i) {
          if (gone) CV.setSlot(s, null, {});
          else if (sending) CV.setSlot(s, null, { active: true });
          else CV.setSlot(s, DATA[i], {});
        });
      });

      /* —— 下排：刚飞到的整份，弹出 → 逐段上折 → 消失 —— */
      ROUTE.flows.forEach(function (f) {
        var list = ghost[f.from];
        var on = sec >= f.arrive && sec < f.mergeEnd;
        var p = (on && sec >= f.growEnd) ? (sec - f.growEnd) / TM.merge : 0;
        var pop = popOf(clamp((sec - f.arrive) / TM.pop, 0, 1));

        list.forEach(function (s, i) {
          if (!on) {
            s.outer.setAttribute('opacity', '0');
            s.outer.removeAttribute('transform');
            return;
          }
          var e = mergeE(p, i);
          var k = pop.k * (1 - 0.30 * e);
          s.outer.setAttribute('opacity', String(pop.o * (1 - e)));
          s.outer.setAttribute('transform',
            'translate(' + (s.cx * (1 - k)) + ' ' + (s.cy * (1 - k) - rowStep * e) + ')' +
            ' scale(' + k + ')');
        });
      });

      /* —— 连线 & 数据包 —— */
      layoutWires(cardTop, h);

      ROUTE.flows.forEach(function (f) {
        var w = wires[f.from], p = pkts[f.from];
        var color = w.color;
        var active = sec >= f.start && sec < f.arrive;

        if (active) {
          var lead = Math.min(0.32, p.half / w.len);
          var e2 = CV.easeInOutQuad((sec - f.start) / (f.arrive - f.start));
          e2 = lead + e2 * (1 - lead);
          CV.placePacket(p, w, e2);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', color);
        } else if (sec >= f.arrive) {
          CV.pktFadeOut(p, sec - f.arrive);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('stroke-dashoffset', '0');
          w.path.setAttribute('opacity', '.45');
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

      /* —— 折进完成：累加器那段弹一下 —— */
      if (cur) {
        chips[ROUTE.target].forEach(function (s, i) {
          var key = 'm' + cur.from + i;
          var e = mergeE(mergeP, i);
          if (e >= 0.92 && !seen[key]) {
            seen[key] = 1;
            CV.spawnPulse(layer.fx, s);
          } else if (e < 0.92 && seen[key]) {
            delete seen[key];
          }
        });
      }

      /* —— 计算方框 —— */
      if (calc) {
        calc.wrap.setAttribute('transform',
          'translate(' + (tGeo.x + tGeo.w / 2) + ' ' + calcY + ')');
        calc.wrap.style.opacity = String(chipA);
        calc.wrap.setAttribute('data-on', chipA > 0.5 ? '1' : '0');
      }
    }
  });
})();
