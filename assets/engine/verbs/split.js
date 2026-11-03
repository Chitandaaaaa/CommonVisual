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

  /* 弹跳曲线读全局单源 CV.beat.popAt（parts/beat.js 的 CV.POP_CURVE） */

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
    var FUSE = CV.dur('fuse');
    var MGAP = CV.dur('gap');
    var RS = CV.rowSpan(4);
    var GROW_D = CV.dur('grow');
    var HOLD_D = CV.dur('hold');
    var SHRINK_D = CV.dur('shrink');
    var CALC_FADE = CV.spec('calcFade');   /* 方框过渡 = 规范 07 的 calcFade */
    var CALC_UP = GROW_D + CALC_FADE;
    var CALC_DOWN = CALC_FADE + SHRINK_D;
    var BLOCKD = CV.dur('blockDur');
    var PACKFADE = CV.spec('packFade');   /* 包淡出 = 规范 05 的 packFade */

    var N1 = RECV[0][0].length, N2 = RECV[1][0].length;
    /* 落位窗口 = 单颗弹跳时长：同轮各段同飞同弹（齐传齐弹，2026-11-03 拍板
       再确认），of 行接 k 杆：窗口秒从行现取，ghost 弹跳与行同一来源。
       串行律（steps 2.6）：抵达→淡出→停 0.5→才弹——落位字幕段覆盖
       淡出+延迟+弹跳三相，各相窗另立 AT 键（见 AT 追加段）。 */
    var rSeat1 = CV.timeRow(scene.id, { key: 'seat1', label: '落位弹跳（齐弹）', of: 'popDur' });
    var rSeat2 = CV.timeRow(scene.id, { key: 'seat2', label: '落位弹跳（齐弹）', of: 'popDur' });
    var POP = rSeat1.sec;   /* ghost 弹跳秒 = 落位行秒（齐弹：窗口即单颗） */
    var MRG1 = Math.max((N1 - 1) * MGAP + FUSE, HOLD_D);
    var MRG2 = Math.max((N2 - 1) * MGAP + FUSE, HOLD_D);

    /* 齿轮行（2026-11-03 全站统一）：飞行行 = 纯飞行 + 送达淡出（PACKFADE 规范现读）；
       落位/计算三行是窗口（内部动画仍按规范值走），落位延迟全站 0.50（steps 2.6），
       只有卡片收窄是纯规范值（走倍数）。两轮各成一组，行标签全站同词。 */
    function row(key, label, sec) {
      return CV.timeRow(scene.id, { key: key, label: label, sec: sec });
    }
    var rFly1  = row('fly1',    '飞行（数据包）', 1.7 + PACKFADE);
    var rDly1  = row('delay1',  '落位延迟', CV.spec('seatDelay'));
    var rFly2  = row('fly2',    '飞行（数据包）', 1.7 + PACKFADE);
    var rDly2  = row('delay2',  '落位延迟', CV.spec('seatDelay'));
    var ROWS = [
      row('intro',   '说明', 1.1),
      row('reserve', '预留缓冲', RS.open),
      rFly1, rDly1, rSeat1,
      row('calc1',   '计算开始', CALC_UP),
      row('merge1',  '计算中', MRG1),
      row('down1',   '计算结束', CALC_DOWN),
      CV.timeRow(scene.id, { key: 'slim', label: '卡片收窄', of: 'blockDur' }),
      rFly2, rDly2, rSeat2,
      row('calc2',   '计算开始', CALC_UP),
      row('merge2',  '计算中', MRG2),
      row('shrink',  '计算结束', CALC_DOWN),
      row('collapse', '收场', RS.close),
      row('fin',     '完成', 2.2)
    ];

    /* 面板行：两轮各成一组（行号并起来仍是进度条第几段）。
       时长键不变，本机调参不失效。 */
    var PANEL_ROWS = CV.numberGearRows([
      ROWS[0], ROWS[1],
      { type: 'group', label: '发送数据 · 第 1 轮', note: '这一轮的六个相',
        rows: ROWS.slice(2, 8) },
      ROWS[8],
      { type: 'group', label: '发送数据 · 第 2 轮', note: '这一轮的六个相',
        rows: ROWS.slice(9, 15) },
      ROWS[15], ROWS[16]
    ]);

    var c = scene.captions;
    /* 键名按时序标准（assets/rounds.js 头注释）：r<轮号 1 起><相>；
       整页拍 intro/open/collapse/tail 不带轮号。字幕段保持 14 段（剧本
       captions 不动）：r1fly = 纯飞行（行秒去掉并入的淡出），r1seat = 淡出+
       延迟+弹跳（三相合一）；collapse = 计算结束 + 收场复原，tail = 终态停驻。
       齿轮行的时长键（row('fly1',…)）是另一套命名空间（localStorage），不改。 */
    var PLAN = [
      { id: 'intro',   sec: ROWS[0].sec,  text: c[0] },
      { id: 'open',    sec: ROWS[1].sec,  text: c[1] },
      { id: 'r1fly',   sec: rFly1.sec - PACKFADE,    text: c[2] },
      { id: 'r1seat',  sec: PACKFADE + rDly1.sec + rSeat1.sec, text: c[3] },
      { id: 'r1calc',  sec: ROWS[5].sec,  text: c[4] },
      { id: 'r1merge', sec: ROWS[6].sec,  text: c[5] },
      { id: 'r1down',  sec: ROWS[7].sec,  text: c[6] },
      { id: 'r2open',  sec: ROWS[8].sec,  text: c[7] },
      { id: 'r2fly',   sec: rFly2.sec - PACKFADE,    text: c[8] },
      { id: 'r2seat',  sec: PACKFADE + rDly2.sec + rSeat2.sec, text: c[9] },
      { id: 'r2calc',  sec: ROWS[12].sec, text: c[10] },
      { id: 'r2merge', sec: ROWS[13].sec, text: c[11] },
      { id: 'r2down',  sec: ROWS[14].sec, text: c[12] },
      { id: 'collapse', sec: ROWS[15].sec, text: c[13] },
      { id: 'tail',    sec: ROWS[16].sec, text: c[14] }
    ];

    var AT = {}, TOTAL = 0, acc = 0;
    PLAN.forEach(function (p) {
      AT[p.id] = { s: acc, e: acc + p.sec };
      acc += p.sec;
    });
    TOTAL = acc;
    /* 收窄的淡出时长跟随 slim 行的窗口（默认＝规范 blockDur） */
    BLOCKD = ROWS[9].sec;
    var steps = [], win = {};
    PLAN.forEach(function (p) {
      steps.push({ t: AT[p.id].s / TOTAL, text: p.text, short: scene.shorts ? scene.shorts[steps.length] : undefined });
      win[p.id] = { s: AT[p.id].s, e: AT[p.id].e };
    });
    /* 串行链的相窗（2.6）：落位字幕段三相切开，键同时进 AT（narration 用）
       与 win（时序标准 r<轮号><相>，探针 / 2.29 从这取） */
    [['r1', PACKFADE, rDly1.sec], ['r2', PACKFADE, rDly2.sec]].forEach(function (p) {
      var t = AT[p[0] + 'seat'].s;
      AT[p[0] + 'fade'] = win[p[0] + 'fade'] = { s: t, e: t += p[1] };
      AT[p[0] + 'dly']  = win[p[0] + 'dly']  = { s: t, e: t += p[2] };   /* 弹跳起点 = dly.e */
    });

    return { total: TOTAL, steps: steps, win: win, rows: PANEL_ROWS,
             AT: AT, EMIT: EMIT, RECV: RECV, PARTNER: PARTNER,
             POP: POP, FUSE: FUSE, MGAP: MGAP, PACKFADE: PACKFADE,
             CALC_FADE: CALC_FADE, CALC_UP: CALC_UP, CALC_DOWN: CALC_DOWN, BLOCKD: BLOCKD,
             at: function (sec) { return TOTAL ? sec / TOTAL : 0; } };
  };

  /* 三档卡高走 CV.cardGeo 单源（#5；preWiden 由 geo 的 L.preWiden 给）；
     行内纵向落位：行顶在 pad1↔pad2 之间插值，行距/计算层距不缩放
     （与 sum 族同一约定，2026-11-03 统一）。 */
  verbs.split.heights = function (L, mode) {
    return CV.cardGeo(L, mode);
  };
  verbs.split.inner = function (L, h, mode) {
    var C = verbs.split.heights(L, mode), s = L.slot;
    var f2 = clamp((h - C.h1) / (C.h2 - C.h1), 0, 1);
    var f3 = clamp((h - C.h2) / (C.h3 - C.h2), 0, 1);
    var y1 = L.hdr + C.pad1 + (C.pad2 - C.pad1) * f2;
    var y2 = y1 + s.sh + L.rowGap;
    var yc = y2 + s.sh + L.calcGap;
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
    S.extra.fuseCol = {};   /* 方案 A：折进飞行实例（key = 轮_卡_列） */
    /* 每张卡「第几个有效接收格」→ 全局列号的反查表。
       各卡收到的列不一样（第 1 轮 r0/r1 收 0,1、r2/r3 收 2,3），
       显形/撤块要按本卡序号同步，不能按列号，否则左右两组错拍。 */
    S.extra.order = {};
    var RECV = S.CH.RECV;
    /* 两套序号：
       order     —— 全历史有效格（第一轮 ∪ 第二轮），管「显形」（op）
       orderLast —— 只剩最后一轮那一格的序号，管「收场撤块」（cl）
       收场时每张卡只留自己那一格，若仍按全历史序号，r0 是 0、r3 是 3，
       四张卡就会一格一格依次消失；按 orderLast 全是 0，才同时消失。 */
    S.extra.orderLast = {};
    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk), seenCol = {}, cols = [];
      RECV[0][r].concat(RECV[1][r]).forEach(function (i) {
        if (!seenCol[i]) { seenCol[i] = 1; cols.push(i); }
      });
      cols.sort(function (a, b) { return a - b; });
      var m = {};
      cols.forEach(function (c, i) { m[c] = i; });
      S.extra.order[r] = m;

      var lastCols = RECV[1][r].slice().sort(function (a, b) { return a - b; });
      var m2 = {};
      lastCols.forEach(function (c, i) { m2[c] = i; });
      S.extra.orderLast[r] = m2;
    });

    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
      var g0 = CV.gridCard(L, r);
      var x0 = g0.x + (g0.w - totalW) / 2;
      var IN0 = verbs.split.inner(L, g0.h, S.mode);
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
    var AT = CH.AT, FUSE = CH.FUSE, MGAP = CH.MGAP, POP = CH.POP, PACKFADE = CH.PACKFADE;
    var c0 = L.slot;
    var DEEP = CV.TONE.deep;

    function mergeE(q, idx, sec) {
      var w = AT[q === 0 ? 'r1merge' : 'r2merge'];
      return clamp(((sec - w.s) - idx * MGAP) / FUSE, 0, 1);
    }

    /* rs 折进目标在份数 n 时的形态（颜色走 toneFor；≥1.5 份切 Σ）——
       fuse 的复位态/终态都从这里出 */
    function rsChipState(i, n) {
      return n < 1.5
        ? { letter: DATA[i].letter, color: CV.toneFor(i, n) }
        : { letter: 'Σ', sub: DATA[i].letter, count: Math.round(n), color: CV.toneFor(i, n) };
    }

    /* 计算层进度：撑开与淡入串行（先长够 h3、方框再浮出） */
    function calcPhase(sec) {
      var ups = [AT.r1calc, AT.r2calc];
      var downs = [AT.r1down, { s: AT.collapse.s, e: AT.collapse.s + CH.CALC_DOWN }];
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
        var fly = AT[q === 0 ? 'r1fly' : 'r2fly'];
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
      return 1 - CV.easeInOutQuad(clamp((sec - AT.r2open.s) / CH.BLOCKD, 0, 1));
    }

    /* ① 预留 = 一排变两排；⑥ 收场（方框先没 → 第二排撤 → 卡片收回） */
    var op = CV.rowOpen(sec - AT.open.s, 4);
    var cl = CV.rowClose(sec - AT.collapse.s - CH.CALC_DOWN, 4);
    var cf = calcPhase(sec);

    var C = verbs.split.heights(L, S.mode);
    var h = C.h1 + (C.h2 - C.h1) * (op.g * cl.g) + (C.h3 - C.h2) * cf.e;
    var IN = verbs.split.inner(L, h, S.mode);
    var rowStep = c0.sh + L.rowGap;

    /* 卡片几何：**顶边钉死，只往下长**（全站统一，2026-11-03）
       预留第二排和计算层都加在卡片下方，上面不留空。 */
    var R = {};
    [0, 1, 2, 3].forEach(function (r) {
      var b = CV.gridCard(L, r);
      R[r] = { x: b.x, y: b.y, w: b.w, h: h };
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
        /* 方案 A：折进中（0<e<1）该列交给 beat.fuse 接管（换 Σ/白光在它那里） */
        var foldE = -1;
        for (var qg2 = 0; qg2 < 2; qg2++) {
          var idxG = CH.RECV[qg2][r].indexOf(i);
          if (idxG >= 0) {
            var eG = mergeE(qg2, idxG, sec);
            if (eG > 0 && eG < 1) { foldE = eG; break; }
          }
        }
        if (foldE >= 0) {
          /* beat.fuse 驱动中：chip 保持折进前形态，换 Σ 在 fuseSwap */
        } else if (st.gone) {
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

        var qNow = sec >= AT.r2fly.s ? 1 : 0;
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
        var qc = sec >= AT.r2fly.s ? 1 : 0;
        var fw = AT[qc === 0 ? 'r1fly' : 'r2fly'];
        var dlyT = AT[qc === 0 ? 'r1dly' : 'r2dly'].e;   /* 落位时刻才交棒给 ghost */
        /* 接收位保持到**落位**，不是到「飞行结束」——中途变回空块会看成
           「这块没人要了」（2026-11-03 修）。 */
        var inFlight = sec >= fw.s && sec < dlyT && CH.RECV[qc][r].indexOf(j) >= 0;
        CV.cast.set(rs, null, { active: inFlight });
        /* 显形 / 撤块都按「本卡第几个有效格」走，不按全局列号：
           各卡有效列不同（r0 拿 0,1；r2 拿 2,3），按列号索引会让
           左边两张先冒头、右边两张后冒头，看起来像不同步。
           不归本卡的列（order 里没有）直接隐藏——否则 op.v[undefined] 是
           NaN，写进 style.opacity 会被浏览器丢掉，格子反而全程可见。 */
        var ord = EX.order[r][j];
        var alpha = 0;
        if (ord != null) {
          var ordL = EX.orderLast[r][j];
          var clv = ordL == null ? cl.v[ord] : cl.v[ordL];
          alpha = recvAlpha(r, j, sec) * op.v[ord] * clv;
        }
        rs.g.style.opacity = alpha.toFixed(3);
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

    /* 落位的块：同飞同弹 → 逐段上折 → 消失
       （串行律：抵达→淡出→延迟期间第二排保持接收位，弹从 dly.e 起） */
    EX.ghosts.forEach(function (gh) {
      var dly = AT[gh.q === 0 ? 'r1dly' : 'r2dly'];
      var landT = dly.e;                 /* 同轮各段同刻落位（齐弹拍板）＋ 串行律起点 */
      var rowY2 = R[gh.r].y + IN.y2;
      var fk = 'rs' + gh.q + '_' + gh.r + '_' + gh.idx;

      moveSlot(gh.slot, rowY2);

      if (sec < landT) {
        if (EX.fuseCol[fk]) { EX.fuseCol[fk].g.remove(); delete EX.fuseCol[fk]; }
        gh.outer.setAttribute('opacity', '0');
        return;
      }
      var e = mergeE(gh.q, gh.idx, sec);
      /* 齐弹（2026-11-03 拍板再确认）：同轮各段同刻起弹，无段间错峰。 */
      var pop = CV.beat.popAt(clamp((sec - landT) / POP, 0, 1));
      /* 方案 A（2026-11-02）：折进的块飞行交给规范函数 beat.fuse ——
         rs 每列份数翻倍：resetTo=Σ^(已持有)、to=Σ^(×2)，换 Σ 在 fuseSwap。 */
      if (e > 0 && e < 1) {
        if (!EX.fuseCol[fk]) {
          /* 折进目标与换 Σ 身份认全局列号 gh.seg（2026-11-03 修 3.12 bug：
             旧用本卡接收序号 gh.idx，r2/r3 第 1 轮收列 2/3（idx=0/1）时
             C/D 块飞去 A/B 列融合、下标也错；r0/r1 恰好 idx==seg 掩盖了它）。
             错峰节奏仍按本卡接收序（mergeE 的 idx 不动）。 */
          var chp = S.chips[gh.r][gh.seg];
          var nb = 1;
          for (var qq2 = 0; qq2 < gh.q; qq2++) {
            if (CH.RECV[qq2][gh.r].indexOf(gh.seg) >= 0) nb *= 2;
          }
          EX.fuseCol[fk] = CV.beat.fuse(layer.fx, {
            x: chp.cx, y0: gh.slot.cy, y1: chp.cy, size: c0.sh,
            data: { letter: DATA[gh.seg].letter, color: CV.toneFor(gh.seg, gh.q + 1) },
            resetTo: rsChipState(gh.seg, nb), to: rsChipState(gh.seg, nb * 2), target: chp
          });
        }
        var pk2 = 'm' + gh.q + gh.r + gh.seg;
        if (e >= 0.92 && !EX.seen[pk2]) { EX.seen[pk2] = 1; CV.beat.seat(layer.fx, S.chips[gh.r][gh.seg]); }
        else if (e < 0.92 && EX.seen[pk2]) { delete EX.seen[pk2]; }
        EX.fuseCol[fk].apply(e);
        gh.outer.setAttribute('opacity', '0');
        return;
      }
      if (EX.fuseCol[fk] && (e === 0 || e >= 1)) {
        EX.fuseCol[fk].g.remove();
        delete EX.fuseCol[fk];
      }
      var k = pop.k * (1 - 0.30 * e);
      gh.outer.setAttribute('opacity', String(pop.o * (1 - e)));
      gh.outer.setAttribute('transform',
        'translate(' + (gh.slot.cx * (1 - k)) + ' ' + (gh.slot.cy * (1 - k) - rowStep * e) + ')' +
        ' scale(' + k + ')');
    });

    /* 连线 & 数据包：端点每帧按当前卡框重算（卡片会长高收窄） */
    for (var q = 0; q < 2; q++) {
      var fw = AT[q === 0 ? 'r1fly' : 'r2fly'];
      var mw = AT[q === 0 ? 'r1merge' : 'r2merge'];
      for (var r = 0; r < 4; r++) {
        var k2 = q + '_' + r;
        var w = S.wires[k2], p = S.pkts[k2];
        var col = CV.toneFor(CH.EMIT[q][r][0], q + 1);

        var e3 = CV.sideEnds(R[r], R[CH.PARTNER[q][r]]);
        w.path.setAttribute('d', CV.humpPath(e3, e3.horiz ? L.humpH : L.humpV));
        w.len = w.path.getTotalLength();

        var flying = sec >= fw.s && sec < fw.e;
        var fading = sec >= fw.e && sec < fw.e + PACKFADE;

        if (flying) {
          var lead = Math.min(0.32, (p.half || 0) / (w.len || 1));
          var ep = CV.easeInOutQuad((sec - fw.s) / (fw.e - fw.s));
          CV.payload.place(p, w, lead + ep * (1 - lead));
          CV.wire.paint(w.path, 'lit', col);
          CV.wire.arrow(w.marker, col);
          CV.beat.dim(S.cards[r], true);   /* 方案 A：发送中变暗全站生效 */
        } else if (fading) {
          CV.beat.dim(S.cards[r], false);
          CV.payload.place(p, w, 1);
          CV.payload.fadeOut(p, sec - fw.e, PACKFADE);
          CV.wire.paint(w.path, 'glow', col);
          CV.wire.arrow(w.marker, col);
        } else if (sec >= fw.e) {
          var done = sec >= mw.e;
          /* 余辉计时回灰（orch·trailRatio）：抵达后保留数据色 ratio×飞行时长 */
          var residS = (fw.e - fw.s) * CV.spec('trailRatio');
          var glowingS = sec - fw.e <= residS;
          CV.beat.dim(S.cards[r], false);
          p.g.setAttribute('opacity', '0');
          if (done) {
            CV.wire.paint(w.path, 'done', DEEP); CV.wire.arrow(w.marker, DEEP);
          } else if (glowingS) {
            CV.wire.paint(w.path, 'glow', col); CV.wire.arrow(w.marker, col);
          } else if ((sec - fw.e - residS) / CV.spec('wireFade') < 1) {
            CV.wire.fade(w.path, w.marker, col, (sec - fw.e - residS) / CV.spec('wireFade'));
          } else {
            CV.wire.paint(w.path, 'idle'); CV.wire.arrow(w.marker, null);
          }
        } else {
          CV.beat.dim(S.cards[r], false);
          p.g.setAttribute('opacity', '0');
          CV.wire.paint(w.path, 'idle');
          CV.wire.arrow(w.marker, null);
        }
      }
    }
  };
})(window.CV = window.CV || {});
