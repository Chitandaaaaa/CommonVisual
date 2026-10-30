/* ============================================================
   CommonVisual v2 · L3 动词 · sum（归约）
   ------------------------------------------------------------
   数据飞到累加器并逐段折算；计算方框是它的伴生块。两种形态：
   · accumulate（reduce）  上排唯一累加器，来一份折一份；源卡消耗
   · exchange（allreduce） recursive doubling 两轮，四卡互换整份、
     逐段折进自家累加器，份数翻倍 1→2→4，终点四段全 Σ
   时间轴由本动词按规范值 + 编排秒算出，并产出齿轮行（CV.timeRow）。
   ============================================================ */
(function (CV) {
  'use strict';
  var verbs = (window.CV = window.CV).verbs = CV.verbs || {};
  var clamp = CV.clamp;
  verbs.sum = verbs.sum || {};

  var DATA = null;
  function P(i) { return DATA[i]; }

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

  function moveSlot(s, y) {
    if (s.y === y) return;
    s.rect.setAttribute('y', y);
    s.text.setAttribute('y', y + s.h / 2);
    s.y = y;
    s.cy = y + s.h / 2;
  }

  /* ════════════════════ accumulate · reduce ════════════════════ */

  verbs.sum.timelineReduce = function (scene) {
    var SEG = CV.specVal('fuseDur') || 0.55;
    var GAP = CV.specVal('mergeGap') || 0.5;
    var RS = CV.rowSpan(4);
    var GROW = CV.specVal('growDur') || 0.75;
    var SHRINK = CV.specVal('shrinkDur') || 0.7;
    var HOLD = CV.specVal('holdDur') || 0.95;

    /* 齿轮行：说明/预留/收场独立，折一份的五段三趟共用。
       规范值（撑开/收回）走倍数；编排值（飞、弹）与复合值（折进=max(逐段和, 方框展示)）直接填秒。 */
    var rInit = CV.timeRow(scene.id, { key: 'intro', label: '说明', sec: 0.6 });
    var rPre  = CV.timeRow(scene.id, { key: 'pre', label: '预留缓冲', sec: RS.open });
    var rFly  = CV.timeRow(scene.id, { key: 'fly', label: '传递', sec: 1.7 });
    var rPop  = CV.timeRow(scene.id, { key: 'pop', label: '落位弹跳', sec: 0.6 });
    var rGrow = CV.timeRow(scene.id, { key: 'grow', label: '撑开计算层', of: 'growDur' });
    var rMrg  = CV.timeRow(scene.id, { key: 'merge', label: '逐段折进', sec: Math.max(SEG + 3 * GAP, HOLD) });
    var rShr  = CV.timeRow(scene.id, { key: 'shrink', label: '收回计算层', of: 'shrinkDur' });
    var rCol  = CV.timeRow(scene.id, { key: 'collapse', label: '收场', sec: RS.close + 0.5 });
    rInit.no = 1; rPre.no = 2; rCol.no = 9;

    var TM = {
      init: rInit.sec, prealloc: rPre.sec, fly: rFly.sec, pop: rPop.sec,
      grow: rGrow.sec, merge: rMrg.sec, shrink: rShr.sec, collapse: rCol.sec
    };
    var CYCLE = TM.fly + TM.pop + TM.grow + TM.merge + TM.shrink;
    var COLLAPSE_AT = TM.init + TM.prealloc + CYCLE * 3;
    var TOTAL = COLLAPSE_AT + TM.collapse;

    var flows = [];
    (function () {
      var s = TM.init + TM.prealloc;
      for (var i = 1; i <= 3; i++) {
        var f = {
          from: i, start: s, arrive: s + TM.fly, popEnd: s + TM.fly + TM.pop,
          growEnd: s + TM.fly + TM.pop + TM.grow,
          mergeEnd: s + TM.fly + TM.pop + TM.grow + TM.merge,
          end: s + TM.fly + TM.pop + TM.grow + TM.merge + TM.shrink
        };
        flows.push(f);
        s = f.end;
      }
    })();

    var c = scene.captions;
    var raw = [
      { id: 'intro', s: 0, e: TM.init, text: c[0] },
      { id: 'pre', s: TM.init, e: TM.init + TM.prealloc, text: c[1] }
    ];
    flows.forEach(function (f, k) {
      raw.push({ id: 'fly' + k, s: f.start, e: f.popEnd, text: c[2 + k * 2] });
      raw.push({ id: 'calc' + k, s: f.popEnd, e: f.end, text: c[3 + k * 2] });
    });
    raw.push({ id: 'collapse', s: COLLAPSE_AT, e: TOTAL, text: c[8] });

    var steps = [], win = {};
    raw.forEach(function (p) {
      steps.push({ t: p.s / TOTAL, text: p.text });
      win[p.id] = { s: p.s, e: p.e };
    });

    return { total: TOTAL, steps: steps, win: win,
             rows: [rInit, rPre,
               { type: 'group', label: '折一份 ×3', noTxt: '3–8', note: '每趟共用这一组',
                 rows: [rFly, rPop, rGrow, rMrg, rShr] },
               rCol],
             flows: flows, TM: TM, COLLAPSE_AT: COLLAPSE_AT,
             at: function (sec) { return TOTAL ? sec / TOTAL : 0; } };
  };

  /* reduce 的卡高：h1 → h2（预留两排）→ h3（计算层） */
  function reduceHeights(L) {
    var c0 = L.slot;
    var h1 = L.card.h;
    var h2 = h1 + c0.sh + L.rowGap - 25;
    var h3 = h2 + L.calcGap + L.calc.h + L.areaPad - 16;
    return { h1: h1, h2: h2, h3: h3 };
  }

  verbs.sum.buildReduce = function (S, scene) {
    DATA = S.data;
    var L = S.L, layer = S.layers, defs = S.defs;
    var c0 = L.slot;
    var totalW = 4 * c0.sw + 3 * c0.gap;
    var rowStep = c0.sh + L.rowGap;
    S.extra.rowStep = rowStep;
    S.extra.emptyRow = [];
    S.extra.ghost = {};
    S.extra.seen = {};

    var geo = scene.geo.desktop.target;
    S.extra.targetTop0 = geo.cy != null ? geo.cy - L.card.h / 2 : L.target.y;

    /* 槽位初始 y：目标卡按单排居中（后续逐帧挪） */
    function padTop() { return (L.card.h - L.hdr - 16 - c0.sh) / 2; }
    S.extra.padTop = padTop;

    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
      var g0 = S.cards[r].geo;
      var x0 = g0.x + (g0.w - totalW) / 2;
      var y0 = g0.y + L.hdr + padTop();
      var list = [];
      for (var i = 0; i < 4; i++) {
        list.push(CV.cast.slot(layer.chips, x0 + i * (c0.sw + c0.gap), y0, c0.sw, c0.sh));
      }
      S.chips[r] = list;
    });

    /* 目标卡下排：常设 4 个空位（预留缓冲），一开始隐藏 */
    var tGeo = S.cards[0].geo;
    var tX0 = tGeo.x + (tGeo.w - totalW) / 2;
    for (var k = 0; k < 4; k++) {
      var e = CV.cast.slot(layer.chips, tX0 + k * (c0.sw + c0.gap), 0, c0.sw, c0.sh);
      e.g.style.opacity = '0';
      S.extra.emptyRow.push(e);
    }

    /* 待归约的整份：画在 fx 层（可自由移动整块） */
    S.CH.flows.forEach(function (f) {
      var list = [];
      for (var i = 0; i < 4; i++) {
        var out = CV.el('g', { class: 'ghost-g', opacity: 0 }, layer.fx);
        var s = CV.cast.slot(out, tX0 + i * (c0.sw + c0.gap), 0, c0.sw, c0.sh);
        CV.cast.set(s, DATA[i], {});
        s.outer = out;
        list.push(s);
      }
      S.extra.ghost[f.from] = list;
    });

    /* 箭头：整份不对应单一字母，不带 data-l；连线落点每帧重算 */
    var dstRight = S.cards[0].geo.x + S.cards[0].geo.w + 4;
    S.CH.flows.forEach(function (f, k) {
      CV.payload.marker(defs, 'ah' + f.from);
      var src = S.cards[f.from].geo;
      var w = CV.payload.link(layer.wires, { d: 'M 0 0', markerId: 'ah' + f.from });
      S.wires[f.from] = {
        path: w.path, len: 0,
        marker: defs.querySelector('#ah' + f.from + ' path'),
        sx: src.x, sy: src.y + src.h / 2, tx: dstRight, k: k,
        color: DATA[0].color
      };
      S.pkts[f.from] = CV.payload.batch(layer.fx, L.slot, DATA);
    });

    /* 计算方框（气泡宽度按文案实测算） */
    S.extra.calc = CV.beat.calc(layer.labels, {
      w: L.calc.w, h: L.calc.h,
      fs: L.calc.fs, tipFs: L.calc.tipFs, tipText: L.calc.tipText
    });
  };

  verbs.sum.overlayReduce = function (S, scene, CH, sec) {
    var L = S.L, layer = S.layers;
    var EX = S.extra;
    var c0 = L.slot;
    var CHh = reduceHeights(L);
    var TM = CH.TM, flows = CH.flows;

    function mergeE(p, i) { return clamp((p * TM.merge - i * CV.dur('gap')) / (CV.specVal('fuseDur') || 0.55), 0, 1); }
    function doneParts(sec) {
      var n = 1;
      flows.forEach(function (f) { if (sec >= f.mergeEnd) n++; });
      return n;
    }

    /* 阶段一：预留 = 一排变两排；收场是它的倒放 */
    var op = CV.rowOpen(sec - TM.init, 4);
    var cl = CV.rowClose(sec - CH.COLLAPSE_AT, 4);
    var growPre = op.g * cl.g;

    /* 阶段二：计算（长层 → 方框亮 → 收层） */
    var growCal = 0, chipA = 0, cur = null, mergeP = 0;
    flows.forEach(function (f) {
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

    /* 卡片几何：中心固定，上下对称扩 */
    var h = CHh.h1 + (CHh.h2 - CHh.h1) * growPre + (CHh.h3 - CHh.h2) * growCal;
    var cyc = L.target.cy;
    var cardTop = cyc - h / 2 + (CHh.h3 - CHh.h2) * growCal / 2;
    CV.cast.resize(S.cards[0], { x: L.target.x, y: cardTop, w: L.card.w, h: h });
    var tGeo = S.cards[0].geo;

    /* 两排数据的位置（长计算层时数据钉在原地，只有卡边在扩） */
    var topNow = growCal > 0 ? (cyc - CHh.h2 / 2) : cardTop;
    var padTop = EX.padTop();
    var padTop2 = (CHh.h2 - L.hdr - 2 * c0.sh - L.rowGap) / 2;
    var pT = padTop + (padTop2 - padTop) * growPre;
    var rowY = topNow + L.hdr + pT;
    var rowY2 = rowY + EX.rowStep;
    var blankTop = rowY2 + c0.sh;
    var calcY = blankTop + Math.max(L.calcGap, (cardTop + h - blankTop - L.calc.h) / 2);

    CV.cast.moveRow(S.chips[0], rowY);

    /* 下排接收位 */
    var lastMergeEnd = flows[flows.length - 1].mergeEnd;
    var waiting = sec < lastMergeEnd;
    EX.emptyRow.forEach(function (s, k) {
      moveSlot(s, rowY2);
      CV.cast.set(s, null, { active: waiting });
      s.g.style.opacity = (op.v[k] * cl.v[k]).toFixed(3);
    });
    flows.forEach(function (f) {
      EX.ghost[f.from].forEach(function (s) { moveSlot(s, rowY2); });
    });

    var n = doneParts(sec);

    /* 累加器（上排）：越加越浓，折进过半切 Σ + 下标列字母 + 上标份数 */
    S.chips[0].forEach(function (s, i) {
      var base = DATA[i].color;
      var c = CV.toneRich(base, n);
      var eMerge = cur ? mergeE(mergeP, i) : 0;
      if (cur) c = CV.mix(c, CV.toneRich(base, n + 1), eMerge);
      var k = n + (eMerge >= 0.5 ? 1 : 0);
      CV.cast.set(s, k >= 2
        ? { letter: 'Σ', sub: DATA[i].letter, count: k, color: c }
        : { letter: DATA[i].letter, color: c }, {});

      /* 折进完成：累加器那段弹一下 */
      if (cur) {
        var key = 'm' + cur.from + i;
        if (eMerge >= 0.92 && !EX.seen[key]) {
          EX.seen[key] = 1;
          CV.beat.seat(layer.fx, s);
        } else if (eMerge < 0.92 && EX.seen[key]) {
          delete EX.seen[key];
        }
      }
    });

    /* 源卡：交出去就不再留着（消耗语义） */
    [1, 2, 3].forEach(function (r) {
      var f = flows[r - 1];
      var off = sec >= f.start;   /* 交出 = 消耗：包一离开这一格就空（不是等到达） */
      S.chips[r].forEach(function (s, i) {
        CV.cast.set(s, off ? null : DATA[i], {});
      });
    });

    /* 下排：刚飞到的整份，弹出 → 逐段上折 → 消失 */
    flows.forEach(function (f) {
      var list = EX.ghost[f.from];
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
          'translate(' + (s.cx * (1 - k)) + ' ' + (s.cy * (1 - k) - EX.rowStep * e) + ')' +
          ' scale(' + k + ')');
      });
    });

    /* 连线落点：三条线沿目标卡右缘、标题条以下按 25/50/75% 分布 */
    var areaTop = cardTop + L.hdr, areaH = h - L.hdr;
    flows.forEach(function (f) {
      var w = S.wires[f.from];
      var ty = areaTop + areaH * (0.25 + 0.25 * w.k);
      var span = w.sx - w.tx;
      var d = 'M ' + w.sx + ' ' + w.sy +
              ' C ' + (w.sx - span * 0.42) + ' ' + w.sy + ', ' + (w.tx + span * 0.42) + ' ' + ty +
              ', ' + w.tx + ' ' + ty;
      w.path.setAttribute('d', d);
      w.len = w.path.getTotalLength();
    });

    /* 连线 & 数据包 */
    flows.forEach(function (f) {
      var w = S.wires[f.from], p = S.pkts[f.from];
      var color = w.color;
      var active = sec >= f.start && sec < f.arrive;

      if (active) {
        var lead = Math.min(0.32, p.half / w.len);
        var e2 = CV.easeInOutQuad((sec - f.start) / (f.arrive - f.start));
        e2 = lead + e2 * (1 - lead);
        CV.payload.place(p, w, e2);
        w.path.setAttribute('stroke', color);
        w.path.setAttribute('stroke-width', '2.6');
        w.path.setAttribute('stroke-dasharray', '9 7');
        w.path.setAttribute('opacity', '1');
        w.marker.setAttribute('fill', color);
      } else if (sec >= f.arrive) {
        CV.payload.place(p, w, 1);
        CV.payload.fadeOut(p, sec - f.arrive);
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

    /* 计算方框 */
    var calc = EX.calc;
    calc.wrap.setAttribute('transform',
      'translate(' + (tGeo.x + tGeo.w / 2) + ' ' + calcY + ')');
    calc.wrap.style.opacity = String(chipA);
    calc.wrap.setAttribute('data-on', chipA > 0.5 ? '1' : '0');
  };

  /* ════════════════════ exchange · allreduce ════════════════════ */

  verbs.sum.timelineAllreduce = function (scene) {
    var SEG = CV.specVal('fuseDur') || 0.55;
    var MGAP = CV.specVal('mergeGap') || 0.5;
    var POPD = CV.specVal('popDur') || 0.55;
    var RS = CV.rowSpan(4);
    var GROW = CV.specVal('growDur') || 0.75;
    var HOLD = CV.specVal('holdDur') || 0.95;
    var SHRINK = CV.specVal('shrinkDur') || 0.7;
    var CALC_FADE = 0.35;

    /* 齿轮行：说明/预留/终点/收场独立，一轮的六段两轮共用（轮间隔也在组里）。
       弹跳行管整段窗口（3×错峰 + 单块弹跳）；撑开/收回走规范倍数，
       方框浮现的 0.35s 固定衔接不进面板。 */
    var rInit = CV.timeRow(scene.id, { key: 'intro', label: '说明', sec: 0.9 });
    var rExp  = CV.timeRow(scene.id, { key: 'expand', label: '预留两排', sec: RS.open + 0.25 });
    var rFly  = CV.timeRow(scene.id, { key: 'fly', label: '飞行', sec: 1.1 });
    var rPop  = CV.timeRow(scene.id, { key: 'pop', label: '落位弹跳', sec: 3 * 0.12 + Math.max(0.5, POPD) });
    var rGrow = CV.timeRow(scene.id, { key: 'grow', label: '撑开计算层', of: 'growDur' });
    var rMrg  = CV.timeRow(scene.id, { key: 'merge', label: '逐段折进', sec: Math.max(SEG + 3 * MGAP, HOLD) });
    var rDwn  = CV.timeRow(scene.id, { key: 'down', label: '收层收回', of: 'shrinkDur' });
    var rGap  = CV.timeRow(scene.id, { key: 'gap', label: '轮间停顿', sec: 0.55 });
    var rFin  = CV.timeRow(scene.id, { key: 'fin', label: '终点展示', sec: 0.35 });
    var rCol  = CV.timeRow(scene.id, { key: 'collapse', label: '收场', sec: RS.close + 0.6 });
    rInit.no = 1; rExp.no = 2; rFin.no = 10; rCol.no = 11;

    var TM = {
      init: rInit.sec, fly: rFly.sec, land: 0.1, pop: 0.5, stag: 0.12,
      growCalc: rGrow.sec,
      merge: rMrg.sec,
      calcDown: CALC_FADE + rDwn.sec,
      gap: rGap.sec
    };
    var POP_SPAN = rPop.sec;

    function mkRound(start) {
      var r = { start: start };
      r.arrive = r.start + TM.fly;
      r.popStart = r.arrive + TM.land;
      r.popEnd = r.popStart + POP_SPAN;
      r.calcStart = r.popEnd;
      r.calcEnd = r.calcStart + TM.growCalc;
      r.mergeStart = r.calcEnd + CALC_FADE;
      r.mergeEnd = r.mergeStart + TM.merge;
      r.end = r.mergeEnd + TM.calcDown;
      return r;
    }

    var EXPAND_AT = TM.init;
    var ROUNDS = [mkRound(EXPAND_AT + rExp.sec)];
    ROUNDS.push(mkRound(ROUNDS[0].end + TM.gap));
    var COLLAPSE_AT = ROUNDS[1].end + rFin.sec;
    var TOTAL = COLLAPSE_AT + rCol.sec;

    var ROUNDS_DEF = [
      { pairs: [[0, 1], [2, 3]] },
      { pairs: [[0, 2], [1, 3]] }
    ];
    var route = [];
    ROUNDS_DEF.forEach(function (rd, q) {
      var list = [];
      rd.pairs.forEach(function (p) {
        list.push({ from: p[0], to: p[1], round: q });
        list.push({ from: p[1], to: p[0], round: q });
      });
      route.push(list);
    });

    var c = scene.captions;
    var raw = [
      { id: 'intro', s: 0, e: EXPAND_AT, text: c[0] },
      { id: 'expand', s: EXPAND_AT, e: ROUNDS[0].start, text: c[1] },
      { id: 'r0fly', s: ROUNDS[0].start, e: ROUNDS[0].popStart, text: c[2] },
      { id: 'r0pop', s: ROUNDS[0].popStart, e: ROUNDS[0].calcStart, text: c[3] },
      { id: 'r0calc', s: ROUNDS[0].calcStart, e: ROUNDS[0].mergeStart, text: c[4] },
      { id: 'r0merge', s: ROUNDS[0].mergeStart, e: ROUNDS[0].end, text: c[5] },
      { id: 'r1fly', s: ROUNDS[1].start, e: ROUNDS[1].popStart, text: c[6] },
      { id: 'r1calc1', s: ROUNDS[1].popStart, e: ROUNDS[1].mergeStart, text: c[7] },
      { id: 'r1merge', s: ROUNDS[1].mergeStart, e: ROUNDS[1].end, text: c[8] },
      { id: 'fin', s: ROUNDS[1].end, e: COLLAPSE_AT, text: c[9] },
      { id: 'collapse', s: COLLAPSE_AT, e: TOTAL, text: c[10] }
    ];

    var steps = [], win = {};
    raw.forEach(function (p) {
      steps.push({ t: p.s / TOTAL, text: p.text, short: scene.shorts ? scene.shorts[steps.length] : undefined });
      win[p.id] = { s: p.s, e: p.e };
    });

    return { total: TOTAL, steps: steps, win: win,
             rows: [rInit, rExp,
               { type: 'group', label: '互换一轮 ×2', noTxt: '3–9', note: '两轮共用这一组',
                 rows: [rFly, rPop, rGrow, rMrg, rDwn, rGap] },
               rFin, rCol],
             rounds: ROUNDS, route: route, TM: TM, POP_SPAN: POP_SPAN,
             EXPAND_AT: EXPAND_AT, COLLAPSE_AT: COLLAPSE_AT, CALC_FADE: CALC_FADE,
             at: function (sec) { return TOTAL ? sec / TOTAL : 0; } };
  };

  var HUMP_H = 22, HUMP_V = 54;
  var PRE_WIDEN = { desktop: 25, narrow: 12 };

  verbs.sum.buildAllreduce = function (S, scene) {
    DATA = S.data;
    var L = S.L, layer = S.layers;
    var c0 = L.slot;
    var totalW = 4 * c0.sw + 3 * c0.gap;
    var pOne = (L.card.h - L.hdr - 16 - c0.sh) / 2;
    var EX = S.extra;
    EX.HOME = {}; EX.X0 = {}; EX.empties = {}; EX.ghosts = [{}, {}]; EX.calcs = {};
    EX.paintKey = {}; EX.pulseSeen = {};

    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
      var geo = CV.gridCard(L, r);
      EX.HOME[r] = { x: geo.x, cy: geo.y + L.card.h / 2 };

      var x0 = geo.x + (geo.w - totalW) / 2;
      EX.X0[r] = x0;
      var y0 = geo.y + L.hdr + pOne;

      var list = [];
      for (var i = 0; i < 4; i++) {
        list.push(CV.cast.slot(layer.chips, x0 + i * (c0.sw + c0.gap), y0, c0.sw, c0.sh));
      }
      S.chips[r] = list;

      var emp = [];
      for (var j = 0; j < 4; j++) {
        var e = CV.cast.slot(layer.chips, x0 + j * (c0.sw + c0.gap), y0 + c0.sh + L.rowGap, c0.sw, c0.sh);
        e.g.style.opacity = '0';
        emp.push(e);
      }
      EX.empties[r] = emp;

      /* 每轮「对方那一份」一组 ghost（颜色随轮次加深：1 份色 → 2 份色） */
      S.CH.rounds.forEach(function (R, q) {
        var set = [];
        var lvl = Math.pow(2, q);
        for (var k = 0; k < 4; k++) {
          var out = CV.el('g', { class: 'ghost-g', opacity: 0 }, layer.fx);
          var s = CV.cast.slot(out, x0 + k * (c0.sw + c0.gap), y0 + c0.sh + L.rowGap, c0.sw, c0.sh);
          CV.cast.set(s, { letter: DATA[k].letter, color: CV.toneFor(k, lvl) }, {});
          s.outer = out;
          set.push(s);
        }
        EX.ghosts[q][r] = set;
      });

      /* 「计算」方框：四张卡都要算，各挂一枚 */
      var cb = CV.beat.calc(layer.labels, {
        w: L.calc.w, h: L.calc.h,
        fs: L.calc.fs, tipFs: L.calc.tipFs, tipText: L.calc.tipText
      });
      cb.wrap.style.opacity = '0';
      EX.calcs[r] = cb;
    });

    /* 每条有向交换一条线 + 一个整份包（包色 = 该段合了 2^q 份时的颜色） */
    var mi = 0;
    S.CH.route.forEach(function (list, q) {
      list.forEach(function (f) {
        var e = CV.sideEnds(S.cards[f.from].geo, S.cards[f.to].geo, L, true);
        var isHoriz = ((f.from >> 1) === (f.to >> 1));
        var hump = isHoriz ? HUMP_H : HUMP_V;
        var id = 'ar' + (mi++);
        CV.payload.marker(S.defs, id);
        var w = CV.payload.link(layer.wires, { d: CV.humpPath(e, hump), markerId: id });
        var se = CV.shiftEnds(e, hump);
        var k = q + '_' + f.from + '_' + f.to;
        S.wires[k] = {
          path: w.path, len: w.len, hump: hump, _h: -1,
          marker: S.defs.querySelector('#' + id + ' path'),
          sx: se.sx, sy: se.sy, tx: se.tx, ty: se.ty
        };
        S.pkts[k] = CV.payload.batch(layer.fx, L.slot, DATA.map(function (d, i) {
          return { letter: d.letter, color: CV.toneFor(i, Math.pow(2, q)) };
        }));
      });
    });
  };

  verbs.sum.overlayAllreduce = function (S, scene, CH, sec) {
    var L = S.L, layer = S.layers;
    var EX = S.extra;
    var c0 = L.slot;
    var rowStep = c0.sh + L.rowGap;
    var h1 = L.card.h;
    var h2 = h1 + c0.sh + L.rowGap - (PRE_WIDEN[S.mode] || 25);
    var h3 = h2 + L.calcGap + L.calc.h + L.areaPad - 16;
    var TM = CH.TM, ROUNDS = CH.rounds;

    /* ① 一排↔两排：整页只两次；② 轮内「计算」层的收放与合并进度 */
    var op = CV.rowOpen(sec - CH.EXPAND_AT, 4);
    var cl = CV.rowClose(sec - CH.COLLAPSE_AT, 4);
    var lift = op.g * cl.g;
    var rowV = [];
    for (var vi = 0; vi < 4; vi++) rowV.push(op.v[vi] * cl.v[vi]);

    var q = -1;
    for (var i = 0; i < ROUNDS.length; i++) if (sec >= ROUNDS[i].start) q = i;
    var st = { q: q, calc: 0, merge: 0, calcA: 0 };
    if (q >= 0) {
      var R = ROUNDS[q];
      if (sec >= R.calcStart && sec < R.calcEnd) {
        var g = clamp((sec - R.calcStart) / TM.growCalc, 0, 1);
        st = { q: q, calc: CV.easeInOutQuad(g), merge: 0, calcA: 0 };
      } else if (sec >= R.calcEnd && sec < R.mergeStart) {
        st = { q: q, calc: 1, merge: 0, calcA: clamp((sec - R.calcEnd) / CH.CALC_FADE, 0, 1) };
      } else if (sec >= R.mergeStart && sec < R.mergeEnd) {
        st = { q: q, calc: 1, merge: clamp((sec - R.mergeStart) / TM.merge, 0, 1), calcA: 1 };
      } else if (sec >= R.mergeEnd && sec < R.end) {
        var d = sec - R.mergeEnd;
        st = {
          q: q,
          calc: 1 - CV.easeInOutQuad(clamp((d - CH.CALC_FADE) / (TM.calcDown - CH.CALC_FADE), 0, 1)),
          merge: 1,
          calcA: 1 - clamp(d / CH.CALC_FADE, 0, 1)
        };
      } else if (sec >= R.end) {
        st = { q: q, calc: 0, merge: 1, calcA: 0 };
      }
    }

    function mergeE(p, i) {
      return clamp((p * TM.merge - i * CV.dur('gap')) / (CV.specVal('fuseDur') || 0.55), 0, 1);
    }

    var lvl0 = q >= 0 ? Math.pow(2, q) : 1;
    var lvl1 = q >= 0 ? lvl0 * 2 : 1;

    /* ① 卡片：中心固定，四张同步长高/收回 */
    var h = h1 + (h2 - h1) * lift + (h3 - h2) * st.calc;
    [0, 1, 2, 3].forEach(function (r) {
      var y = EX.HOME[r].cy - h / 2;
      if (S.cards[r].geo.h !== h || S.cards[r].geo.y !== y) {
        CV.cast.resize(S.cards[r], { x: EX.HOME[r].x, y: y, w: L.card.w, h: h });
      }
    });

    /* ② 纵向线端点跟着卡框走（守卫用 h） */
    CH.route.forEach(function (list, qq) {
      list.forEach(function (f) {
        var W = S.wires[qq + '_' + f.from + '_' + f.to];
        if (W._h === h) return;
        W._h = h;
        var ne = CV.sideEnds(S.cards[f.from].geo, S.cards[f.to].geo, L, true);
        W.path.setAttribute('d', CV.humpPath(ne, W.hump));
        W.len = W.path.getTotalLength();
        var se = CV.shiftEnds(ne, W.hump);
        W.sx = se.sx; W.sy = se.sy; W.tx = se.tx; W.ty = se.ty;
      });
    });

    var pOne = (h1 - L.hdr - 16 - c0.sh) / 2;
    var pTwo = (h2 - L.hdr - 2 * c0.sh - L.rowGap) / 2;
    var pT = pOne + (pTwo - pOne) * lift + (h3 - h2) / 2 * st.calc;

    [0, 1, 2, 3].forEach(function (r) {
      var topY = S.cards[r].geo.y + L.hdr + pT;
      var botY = topY + rowStep;

      /* ③ 上排累加器：份数翻倍不是加一（1→2→4），过半切 Σ */
      S.chips[r].forEach(function (s, i) {
        var e = st.merge > 0 ? mergeE(st.merge, i) : 0;
        var col = e > 0 ? CV.mix(CV.toneFor(i, lvl0), CV.toneFor(i, lvl1), e) : CV.toneFor(i, lvl0);
        var sig = e >= 0.5 && lvl1 >= 2;
        var letter = sig ? 'Σ' : DATA[i].letter;
        moveSlot(s, topY);
        var key = letter + '|' + col + '|' + (sig ? lvl1 : '');
        if (EX.paintKey['c' + r + i] !== key) {
          EX.paintKey['c' + r + i] = key;
          CV.cast.set(s, sig
            ? { letter: 'Σ', sub: DATA[i].letter, count: lvl1, color: col }
            : { letter: letter, color: col }, {});
        }
        var pk = 'p' + r + i + '_' + q;
        if (st.merge > 0 && e >= 0.92) {
          if (!EX.pulseSeen[pk]) { EX.pulseSeen[pk] = 1; CV.beat.seat(layer.fx, s, col); }
        } else if (EX.pulseSeen[pk]) {
          delete EX.pulseSeen[pk];
        }
      });

      /* ④ 下排接收位 */
      EX.empties[r].forEach(function (s, i) {
        moveSlot(s, botY);
        s.g.style.opacity = String(rowV[i]);
      });

      /* ④' 计算方框：卡在下排下方空白里，随卡片高度逐帧走 */
      var cb = EX.calcs[r];
      if (cb) {
        var blankTop = botY + c0.sh;
        var calcY = blankTop + Math.max(L.calcGap,
                      (S.cards[r].geo.y + h - blankTop - L.calc.h) / 2);
        cb.wrap.setAttribute('transform',
          'translate(' + (S.cards[r].geo.x + L.card.w / 2).toFixed(1) + ' ' + calcY.toFixed(1) + ')');
        cb.wrap.style.opacity = String(st.calcA);
        cb.wrap.setAttribute('data-on', st.calcA > 0.5 ? '1' : '0');
      }

      /* ⑤ 外来的一份：落位（缩放过冲）→ 逐段上折 → 消失 */
      ROUNDS.forEach(function (R, qq) {
        var set = EX.ghosts[qq][r];
        var on = (qq === q) && sec >= R.popStart && sec < R.end;
        set.forEach(function (s, i) {
          if (!on) {
            s.outer.setAttribute('opacity', '0');
            return;
          }
          var popP = clamp((sec - R.popStart - i * TM.stag) / TM.pop, 0, 1);
          var pop = popOf(popP);
          var e = st.merge > 0 ? mergeE(st.merge, i) : 0;
          var k = pop.k * (1 - 0.30 * e);
          moveSlot(s, botY);
          s.outer.setAttribute('opacity', String(pop.o * (1 - e)));
          s.outer.setAttribute('transform',
            'translate(' + (s.cx * (1 - k)).toFixed(2) + ' ' +
                            (s.cy * (1 - k) - rowStep * e).toFixed(2) + ') scale(' + k.toFixed(3) + ')');
        });
      });
    });

    /* ⑥ 连线 & 数据包：线色三档（全完→深紫 / 本轮过→灰 / 刚落地→发送色） */
    var DEEP = CV.TONE.deep;
    CH.route.forEach(function (list, qq) {
      list.forEach(function (f) {
        var k = qq + '_' + f.from + '_' + f.to;
        var W = S.wires[k], p = S.pkts[k];
        var R = ROUNDS[qq];
        var active = sec >= R.start && sec < R.arrive;
        var color = CV.toneFor(f.from, Math.pow(2, qq));

        if (active) {
          var e = CV.easeInOutQuad((sec - R.start) / (R.arrive - R.start));
          var lead = Math.min(0.32, p.half / W.len);
          e = lead + e * (1 - lead);
          CV.payload.place(p, W, e);
          W.path.setAttribute('stroke', color);
          W.path.setAttribute('stroke-width', '2.6');
          W.path.setAttribute('stroke-dasharray', '9 7');
          W.path.setAttribute('opacity', '1');
          W.marker.setAttribute('fill', color);
        } else if (sec >= R.arrive) {
          var allDone = sec >= ROUNDS[1].end;
          var roundDone = sec >= R.end;
          var strokeCol = allDone ? DEEP : (roundDone ? '#c3cadb' : color);
          var op2 = allDone ? '.26' : (roundDone ? '.75' : '.42');
          CV.payload.place(p, W, 1);
          CV.payload.fadeOut(p, sec - R.arrive);
          W.path.setAttribute('stroke', strokeCol);
          W.path.setAttribute('stroke-width', '1.8');
          W.path.setAttribute('stroke-dasharray', '8 7');
          W.path.setAttribute('opacity', op2);
          W.marker.setAttribute('fill', strokeCol);
        } else {
          p.g.setAttribute('opacity', '0');
          W.path.setAttribute('stroke', '#c3cadb');
          W.path.setAttribute('stroke-width', '2');
          W.path.setAttribute('stroke-dasharray', '8 7');
          W.path.setAttribute('opacity', '1');
          W.marker.setAttribute('fill', '#c3cadb');
        }
      });
    });
  };

  /* ══════════ 入口分发 ══════════ */
  verbs.sum.timeline = function (scene) {
    return scene.sumType === 'exchange' ? verbs.sum.timelineAllreduce(scene)
                                        : verbs.sum.timelineReduce(scene);
  };
  verbs.sum.build = function (S, scene) {
    return scene.sumType === 'exchange' ? verbs.sum.buildAllreduce(S, scene)
                                        : verbs.sum.buildReduce(S, scene);
  };
  verbs.sum.overlay = function (S, scene, CH, sec) {
    return scene.sumType === 'exchange' ? verbs.sum.overlayAllreduce(S, scene, CH, sec)
                                        : verbs.sum.overlayReduce(S, scene, CH, sec);
  };
})(window.CV = window.CV || {});
