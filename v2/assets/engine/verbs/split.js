/* ============================================================
   CommonVisual v2 · L3 动词 · split（拆分）
   ------------------------------------------------------------
   家族形态：reducescatter —— recursive halving 两轮，四卡同时动：
     第 1 轮 同列配对（0↔2, 1↔3），每卡 4 段 → 2 段
     第 2 轮 同行配对（0↔1, 2↔3），每卡 2 段 → 1 段
   边换段边折算，全程没有「先合成整份 Σ 再切开」的中间态；
   段号天然对齐：卡 k 最后留下的就是第 k 段。
   两条铁律与 reduce 相同：上排就是累加器；送出是消耗。
   ============================================================ */
(function (CV) {
  'use strict';
  var verbs = (window.CV = window.CV).verbs = CV.verbs || {};
  var clamp = CV.clamp;
  verbs.split = verbs.split || {};

  var DATA = null;

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

  /* ── 路由：recursive halving 两轮（纯数据事实，与对照表同源） ── */
  var EMIT = [
    [[2, 3], [2, 3], [0, 1], [0, 1]],
    [[1],    [0],    [3],    [2]]
  ];
  var RECV = [
    [[0, 1], [0, 1], [2, 3], [2, 3]],
    [[0],    [1],    [2],    [3]]
  ];
  var PARTNER = [
    [2, 3, 0, 1],
    [1, 0, 3, 2]
  ];

  verbs.split.timeline = function (scene) {
    var POP = CV.dur('pop');
    var SEATG = CV.dur('seatGap');
    var FUSE = CV.dur('fuse');
    var MGAP = CV.dur('gap');
    var RS = CV.rowSpan(4);
    var GROW_D = CV.dur('grow');
    var HOLD_D = CV.dur('hold');
    var SHRINK_D = CV.dur('shrink');
    var CALC_FADE = 0.35;
    var CALC_UP = GROW_D + CALC_FADE;
    var CALC_DOWN = CALC_FADE + SHRINK_D;
    var BLOCKD = CV.dur('blockDur');

    var N1 = RECV[0][0].length, N2 = RECV[1][0].length;
    var SEAT1 = (N1 - 1) * SEATG + POP, SEAT2 = (N2 - 1) * SEATG + POP;
    var MRG1 = Math.max((N1 - 1) * MGAP + FUSE, HOLD_D);
    var MRG2 = Math.max((N2 - 1) * MGAP + FUSE, HOLD_D);

    /* 齿轮行：两轮的段数与秒数都不同（收 2 段 → 收 1 段），平铺不分组，
       行号＝进度条第几段。落位/撑开/折进/收层是窗口（内部动画仍按规范值走），
       只有卡片收窄是纯规范值（走倍数）。 */
    function row(key, label, sec) {
      return CV.timeRow(scene.id, { key: key, label: label, sec: sec });
    }
    var ROWS = [
      row('intro',   '说明', 1.1),
      row('reserve', '预留两排', RS.open),
      row('fly1',    '第1轮飞行', 1.7),
      row('seat1',   '第1轮落位', SEAT1),
      row('calc1',   '第1轮撑开', CALC_UP),
      row('merge1',  '第1轮折进', MRG1),
      row('down1',   '第1轮收层', CALC_DOWN),
      CV.timeRow(scene.id, { key: 'slim', label: '卡片收窄', of: 'blockDur' }),
      row('fly2',    '第2轮飞行', 1.7),
      row('seat2',   '第2轮落位', SEAT2),
      row('calc2',   '第2轮撑开', CALC_UP),
      row('merge2',  '第2轮折进', MRG2),
      row('shrink',  '收层收卡', CALC_DOWN + RS.close),
      row('tail',    '收尾', 2.2)
    ];
    ROWS.forEach(function (r, i) { r.no = i + 1; });

    var c = scene.captions;
    var PLAN = [
      { id: 'intro',   sec: ROWS[0].sec,  text: c[0] },
      { id: 'reserve', sec: ROWS[1].sec,  text: c[1] },
      { id: 'fly1',    sec: ROWS[2].sec,  text: c[2] },
      { id: 'seat1',   sec: ROWS[3].sec,  text: c[3] },
      { id: 'calc1',   sec: ROWS[4].sec,  text: c[4] },
      { id: 'merge1',  sec: ROWS[5].sec,  text: c[5] },
      { id: 'down1',   sec: ROWS[6].sec,  text: c[6] },
      { id: 'slim',    sec: ROWS[7].sec,  text: c[7] },
      { id: 'fly2',    sec: ROWS[8].sec,  text: c[8] },
      { id: 'seat2',   sec: ROWS[9].sec,  text: c[9] },
      { id: 'calc2',   sec: ROWS[10].sec, text: c[10] },
      { id: 'merge2',  sec: ROWS[11].sec, text: c[11] },
      { id: 'shrink',  sec: ROWS[12].sec, text: c[12] },
      { id: 'tail',    sec: ROWS[13].sec, text: c[13] }
    ];

    var AT = {}, TOTAL = 0, acc = 0;
    PLAN.forEach(function (p) {
      AT[p.id] = { s: acc, e: acc + p.sec };
      acc += p.sec;
    });
    TOTAL = acc;
    /* 收窄的淡出时长跟随 slim 行的窗口（默认＝规范 blockDur） */
    BLOCKD = ROWS[7].sec;
    var steps = [], win = {};
    PLAN.forEach(function (p) {
      steps.push({ t: AT[p.id].s / TOTAL, text: p.text, short: scene.shorts ? scene.shorts[steps.length] : undefined });
      win[p.id] = { s: AT[p.id].s, e: AT[p.id].e };
    });

    return { total: TOTAL, steps: steps, win: win, rows: ROWS,
             AT: AT, EMIT: EMIT, RECV: RECV, PARTNER: PARTNER,
             POP: POP, SEATG: SEATG, FUSE: FUSE, MGAP: MGAP,
             CALC_FADE: CALC_FADE, CALC_UP: CALC_UP, CALC_DOWN: CALC_DOWN, BLOCKD: BLOCKD,
             at: function (sec) { return TOTAL ? sec / TOTAL : 0; } };
  };

  /* 三档卡高 + 卡内纵向落位（长高/收窄过程中行顶在 pad1↔pad2 之间插值，不跳） */
  verbs.split.heights = function (L) {
    var s = L.slot;
    var h1 = L.card.h;
    var pad1 = (h1 - L.hdr - 16 - s.sh) / 2;
    var h2 = h1 + s.sh + L.rowGap - L.preWiden;
    var pad2 = (h2 - L.hdr - (2 * s.sh + L.rowGap)) / 2;
    var h3 = L.hdr + pad2 + (2 * s.sh + L.rowGap) + L.calcGap + L.calc.h + L.areaPad;
    return { h1: h1, h2: h2, h3: h3, pad1: pad1, pad2: pad2 };
  };
  verbs.split.inner = function (L, h) {
    var C = verbs.split.heights(L), s = L.slot;
    var f2 = clamp((h - C.h1) / (C.h2 - C.h1), 0, 1);
    var f3 = clamp((h - C.h2) / (C.h3 - C.h2), 0, 1);
    var y1 = L.hdr + C.pad1 + (C.pad2 - C.pad1) * f2;
    var y2 = y1 + s.sh + L.rowGap * f2;
    var yc = y2 + s.sh + L.calcGap * f3;
    return { y1: y1, y2: y2, yc: yc, f2: f2, f3: f3 };
  };

  verbs.split.build = function (S, scene) {
    DATA = S.data;
    var L = S.L, layer = S.layers;
    var c0 = L.slot;
    var totalW = 4 * c0.sw + 3 * c0.gap;
    S.extra.recvRow = {};
    S.extra.ghosts = [];
    S.extra.calcs = {};
    S.extra.seen = {};

    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
      var g0 = CV.gridCard(L, r);
      var x0 = g0.x + (g0.w - totalW) / 2;
      var IN0 = verbs.split.inner(L, g0.h);
      var y1 = g0.y + IN0.y1;

      S.chips[r] = [];
      for (var i = 0; i < 4; i++) {
        S.chips[r].push(CV.cast.slot(layer.chips, x0 + i * (c0.sw + c0.gap), y1, c0.sw, c0.sh));
      }

      S.extra.recvRow[r] = [];
      for (var j = 0; j < 4; j++) {
        var rs = CV.cast.slot(layer.chips, x0 + j * (c0.sw + c0.gap),
                              y1 + c0.sh + L.rowGap, c0.sw, c0.sh);
        rs.g.style.opacity = '0';
        S.extra.recvRow[r].push(rs);
      }

      S.extra.calcs[r] = CV.beat.calc(layer.labels, {
        w: L.calc.w, h: L.calc.h,
        fs: L.calc.fs, tipFs: L.calc.tipFs, tipText: L.calc.tipText
      });
    });

    /* 落位后待折进上排的块：画在 fx 层，位置每帧跟着接收排走 */
    for (var qg = 0; qg < 2; qg++) {
      for (var rg = 0; rg < 4; rg++) {
        var gr = CV.gridCard(L, rg);
        var gx0 = gr.x + (gr.w - totalW) / 2;
        for (var gi = 0; gi < RECV[qg][rg].length; gi++) {
          var gseg = RECV[qg][rg][gi];
          var gOut = CV.el('g', { class: 'ghost-g', opacity: 0 }, layer.fx);
          var gSlot = CV.cast.slot(gOut, gx0 + gseg * (c0.sw + c0.gap), 0, c0.sw, c0.sh);
          CV.cast.set(gSlot, { letter: DATA[gseg].letter, color: CV.toneFor(gseg, qg + 1) }, {});
          S.extra.ghosts.push({ q: qg, r: rg, seg: gseg, idx: gi, outer: gOut, slot: gSlot });
        }
      }
    }

    /* 箭头按「每轮每卡」建：同一轮四条边发的段不同、混色也不同 */
    for (var qm = 0; qm < 2; qm++) {
      for (var rm = 0; rm < 4; rm++) CV.payload.marker(S.defs, 'ars' + qm + '_' + rm);
    }
    for (var q2 = 0; q2 < 2; q2++) {
      for (var r2 = 0; r2 < 4; r2++) {
        var k = q2 + '_' + r2;
        var wp = CV.payload.link(layer.wires, { d: 'M 0 0', markerId: 'ars' + k });
        S.wires[k] = {
          path: wp.path, len: wp.len,
          marker: S.defs.querySelector('#ars' + k + ' path')
        };
        S.pkts[k] = CV.payload.batch(layer.fx, L.slot, EMIT[q2][r2].map(function (g) {
          return { letter: DATA[g].letter, color: CV.toneFor(g, q2 + 1) };
        }));
      }
    }
  };

  verbs.split.overlay = function (S, scene, CH, sec) {
    var L = S.L, layer = S.layers;
    var EX = S.extra;
    var AT = CH.AT, FUSE = CH.FUSE, MGAP = CH.MGAP, POP = CH.POP, SEATG = CH.SEATG;
    var c0 = L.slot;
    var DEEP = CV.TONE.deep;

    function mergeE(q, idx, sec) {
      var w = AT[q === 0 ? 'merge1' : 'merge2'];
      return clamp(((sec - w.s) - idx * MGAP) / FUSE, 0, 1);
    }

    /* 计算层进度：撑开与淡入串行（先长够 h3、方框再浮出） */
    function calcPhase(sec) {
      var ups = [AT.calc1, AT.calc2];
      var downs = [AT.down1, { s: AT.shrink.s, e: AT.shrink.s + CH.CALC_DOWN }];
      var RU = CV.dur('grow') / CH.CALC_UP;
      var RF = CH.CALC_FADE / CH.CALC_DOWN;
      for (var i = 0; i < ups.length; i++) {
        var u = ups[i], d = downs[i];
        if (sec < u.s) return { e: 0, a: 0 };
        if (sec < u.e) {
          var g = (sec - u.s) / (u.e - u.s);
          return { e: CV.easeInOutQuad(clamp(g / RU, 0, 1)),
                   a: clamp((g - RU) / (1 - RU), 0, 1) };
        }
        if (sec < d.s) return { e: 1, a: 1 };
        if (sec < d.e) {
          var s = (sec - d.s) / (d.e - d.s);
          return { e: 1 - CV.easeInOutQuad(clamp((s - RF) / (1 - RF), 0, 1)),
                   a: 1 - clamp(s / RF, 0, 1) };
        }
      }
      return { e: 0, a: 0 };
    }

    /* 这一段此刻几「份」+ 是否正在交出 / 已经交出（消耗语义） */
    function partState(r, i, sec) {
      var n = 1, sending = false, gone = false;
      for (var q = 0; q < 2; q++) {
        var fly = AT[q === 0 ? 'fly1' : 'fly2'];
        var idxE = CH.EMIT[q][r].indexOf(i);
        var idxR = CH.RECV[q][r].indexOf(i);
        if (idxE >= 0) {
          if (sec >= fly.e) { n = 0; gone = true; sending = false; }
          else if (sec >= fly.s) { sending = true; }
        }
        if (idxR >= 0) {
          var before = n > 0 ? n : 1;
          n = before * (1 + mergeE(q, idxR, sec));
        }
      }
      return { n: n, sending: sending, gone: gone };
    }

    /* 这列此刻该不该露出接收位：第一轮要、第二轮不要的列在 slim 撤掉 */
    function recvAlpha(r, i, sec) {
      var inA = CH.RECV[0][r].indexOf(i) >= 0;
      var inB = CH.RECV[1][r].indexOf(i) >= 0;
      if (inA && inB) return 1;
      if (inB) return 1;
      if (!inA) return 0;
      return 1 - CV.easeInOutQuad(clamp((sec - AT.slim.s) / CH.BLOCKD, 0, 1));
    }

    /* ① 预留 = 一排变两排；⑥ 收场（方框先没 → 第二排撤 → 卡片收回） */
    var op = CV.rowOpen(sec - AT.reserve.s, 4);
    var cl = CV.rowClose(sec - AT.shrink.s - CH.CALC_DOWN, 4);
    var cf = calcPhase(sec);

    var C = verbs.split.heights(L);
    var h = C.h1 + (C.h2 - C.h1) * (op.g * cl.g) + (C.h3 - C.h2) * cf.e;
    var IN = verbs.split.inner(L, h);
    var rowStep = c0.sh + L.rowGap;

    /* 卡片几何：中心不动，上下同时长 */
    var R = {};
    [0, 1, 2, 3].forEach(function (r) {
      var b = CV.gridCard(L, r);
      var cyc = b.y + L.card.h / 2;
      R[r] = { x: b.x, y: cyc - h / 2, w: b.w, h: h };
      CV.cast.resize(S.cards[r], R[r]);
    });

    var totalW = 4 * c0.sw + 3 * c0.gap;

    [0, 1, 2, 3].forEach(function (r) {
      var g = R[r];
      var x0 = g.x + (g.w - totalW) / 2;
      var y1 = g.y + IN.y1, y2 = g.y + IN.y2;
      var left = 0;

      for (var i = 0; i < 4; i++) {
        var s = S.chips[r][i];
        moveSlot(s, y1);
        var st = partState(r, i, sec);
        if (st.gone) {
          CV.cast.set(s, null, {});
        } else if (st.sending) {
          CV.cast.set(s, null, {});
        } else {
          var sig = st.n >= 1.5;
          CV.cast.set(s, sig
            ? { letter: 'Σ', sub: DATA[i].letter, count: Math.round(st.n), color: CV.toneFor(i, st.n) }
            : { letter: DATA[i].letter, color: CV.toneFor(i, st.n) }, {});
        }
        if (!st.gone) left++;

        var qNow = sec >= AT.fly2.s ? 1 : 0;
        var idxR = CH.RECV[qNow][r].indexOf(i);
        if (idxR >= 0) {
          var key = 'm' + qNow + r + i;
          var me = mergeE(qNow, idxR, sec);
          if (me >= 0.92 && !EX.seen[key]) { EX.seen[key] = 1; CV.beat.seat(layer.fx, s); }
          else if (me < 0.92 && EX.seen[key]) { delete EX.seen[key]; }
        }
      }

      for (var j = 0; j < 4; j++) {
        var rs = EX.recvRow[r][j];
        moveSlot(rs, y2);
        var qc = sec >= AT.fly2.s ? 1 : 0;
        var fw = AT[qc === 0 ? 'fly1' : 'fly2'];
        var inFlight = sec >= fw.s && sec < fw.e && CH.RECV[qc][r].indexOf(j) >= 0;
        CV.cast.set(rs, null, { active: inFlight });
        rs.g.style.opacity = (recvAlpha(r, j, sec) * op.v[j] * cl.v[j]).toFixed(3);
      }

      var bt = left + ' 段';
      if (S.cards[r].badgeTx.textContent !== bt) S.cards[r].badgeTx.textContent = bt;

      var cb = EX.calcs[r];
      if (cb) {
        cb.wrap.setAttribute('transform',
          'translate(' + (g.x + g.w / 2) + ' ' + (g.y + IN.yc) + ')');
        var ca = cf.a;
        cb.wrap.style.opacity = String(ca);
        cb.wrap.setAttribute('data-on', ca > 0.5 ? '1' : '0');
      }
    });

    /* 落位的块：弹出 → 逐段上折 → 消失 */
    EX.ghosts.forEach(function (gh) {
      var fly = AT[gh.q === 0 ? 'fly1' : 'fly2'];
      var landT = fly.e + gh.idx * SEATG;
      var rowY2 = R[gh.r].y + IN.y2;

      moveSlot(gh.slot, rowY2);

      if (sec < fly.e) {
        gh.outer.setAttribute('opacity', '0');
        return;
      }
      var e = mergeE(gh.q, gh.idx, sec);
      var pop = popOf(clamp((sec - landT) / POP, 0, 1));
      var k = pop.k * (1 - 0.30 * e);
      gh.outer.setAttribute('opacity', String(pop.o * (1 - e)));
      gh.outer.setAttribute('transform',
        'translate(' + (gh.slot.cx * (1 - k)) + ' ' + (gh.slot.cy * (1 - k) - rowStep * e) + ')' +
        ' scale(' + k + ')');
    });

    /* 连线 & 数据包：端点每帧按当前卡框重算（卡片会长高收窄） */
    for (var q = 0; q < 2; q++) {
      var fw = AT[q === 0 ? 'fly1' : 'fly2'];
      var mw = AT[q === 0 ? 'merge1' : 'merge2'];
      for (var r = 0; r < 4; r++) {
        var k2 = q + '_' + r;
        var w = S.wires[k2], p = S.pkts[k2];
        var col = CV.toneFor(CH.EMIT[q][r][0], q + 1);

        var e3 = CV.sideEnds(R[r], R[CH.PARTNER[q][r]]);
        w.path.setAttribute('d', CV.humpPath(e3, e3.horiz ? L.humpH : L.humpV));
        w.len = w.path.getTotalLength();

        var flying = sec >= fw.s && sec < fw.e;
        var fading = sec >= fw.e && sec < fw.e + 0.55;

        if (flying) {
          var lead = Math.min(0.32, (p.half || 0) / (w.len || 1));
          var ep = CV.easeInOutQuad((sec - fw.s) / (fw.e - fw.s));
          CV.payload.place(p, w, lead + ep * (1 - lead));
          w.path.setAttribute('stroke', col);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', col);
        } else if (fading) {
          CV.payload.place(p, w, 1);
          CV.payload.fadeOut(p, sec - fw.e, 0.55);
          w.path.setAttribute('stroke', col);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', '.42');
          w.marker.setAttribute('fill', col);
        } else if (sec >= fw.e) {
          var done = sec >= mw.e;
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', done ? DEEP : col);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', done ? '.26' : '.42');
          w.marker.setAttribute('fill', done ? DEEP : col);
        } else {
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', '#c3cadb');
          w.path.setAttribute('stroke-width', '2');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', '#c3cadb');
        }
      }
    }
  };
})(window.CV = window.CV || {});
