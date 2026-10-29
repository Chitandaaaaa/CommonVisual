/* ============================================================
   CommonVisual · Reduce-Scatter（归约分散）动态演示
   ------------------------------------------------------------
   算法仍是 recursive halving（两轮），四张卡同时动：
     第 1 轮 同列配对（0↔2, 1↔3），每卡 4 段 → 2 段
     第 2 轮 同行配对（0↔1, 2↔3），每卡 2 段 → 1 段
   段号天然对齐对照表：卡 k 最后留下的就是第 k 段。

   ★ 每一轮都照 reduce 页把「五拍」写全，少一拍就看不懂：
     ① 预留  卡片长出第二排接收位，计算框亮起（只做一次，四卡同时）
     ② 传递  对家那几段打成一份飞过来
     ③ 落位  收到的段依次弹进第二排（规范 seatGap 错峰）
     ④ 合并  一块块折进上排同列，颜色随之加深（1 份 → 2 份 → 4 份 Σ）
     ⑤ 收窄  最后收掉空行与计算框，每卡只留自己编号那一段

   两条语义铁律与 reduce 相同：
     · 没有「先堆起来再压缩」的中间态：上排就是累加器，来一份立刻折进去
     · 送出是消耗：交出去的段不再留在源卡上（所以 4 段会一格一格空掉）

   时间轴按「秒」写成显式分段表（同 reduce 页，本页未接齿轮）；
   落位弹跳 / 多块错峰 / 单次融合 / 多列错峰四项取规范值，改规范这里跟着变。
   ============================================================ */
(function () {
  'use strict';

  var clamp = CV.clamp;

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  /* 四份相加的终点色（与 all-reduce 的 Σ 同色） */
  var DEEP = '#4c1d95';

  /* 份数 → 颜色：1 份是原色、4 份是深紫。n 允许小数 ——
     合并时 n 从上一步连续涨到下一步，颜色跟着一起变深，不是跳一下。 */
  function colorFor(seg, n) {
    return CV.mix(DATA[seg].color, DEEP, (clamp(n, 1, PARTS) - 1) / (PARTS - 1));
  }

  /* ── ① 路由：recursive halving 两轮 ──
     EMIT[q][r]  第 q 轮 rank r 交出去的段
     RECV[q][r]  同一轮 rank r 收下的段（正好是对家 EMIT 的那几条） */
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
  var ROUNDS = 2;

  /* 双向交换的法向错开量（px）：两个方向各走一条车道。
     桌面整份包宽约 100，抬到 34 两条道之间才留得出缝；窄屏卡片窄，减半。 */
  /* ── 规范值：只有组件自己的耗时/节奏走规范，编排秒数本页自己排 ── */
  function specNum(k, d) {
    var g = CV.specGroup(k);
    var v = g ? CV.params.get(g, k) : undefined;
    return (typeof v === 'number') ? v : d;
  }
  var POP    = specNum('popDur', 0.55);      /* 一次落位弹多久 */
  var SEATG  = specNum('seatGap', 0.5);      /* 同一批多块依次落位错开多久 */
  var FUSE   = specNum('fuseDur', 0.55);     /* 一次融合多久 */
  var MGAP   = specNum('mergeGap', 0.5);     /* 多列依次融合错开多久 */
  var FADE   = 0.55;                         /* 包飞到后原地淡掉的秒数（编排） */

  var X = CV.primText(DATA);
  var rk = X.rk, seg = X.seg, whole = X.whole;

  /* ── ② 时间轴：显式分段表 ──
     每一段 = 进度条的一段 = 一条字幕。sec 是这个动作真正花掉几秒，
     steps 的 t 由它累加算出 —— 段宽与时间等价，不会出现「0.2s 和 2.2s 画得一样宽」。 */
  var PLAN = [], AT = {}, TOTAL = 0;
  function plan(id, sec, text, short) {
    PLAN.push({ id: id, sec: sec, text: text, short: short });
  }

  /* 一轮里「几块依次落位 / 几块依次融合」的窗口长度 —— 批内错峰，不是页面节奏 */
  var N1 = RECV[0][0].length, N2 = RECV[1][0].length;
  var SEAT1 = (N1 - 1) * SEATG + POP, SEAT2 = (N2 - 1) * SEATG + POP;
  var MRG1  = (N1 - 1) * MGAP  + FUSE, MRG2  = (N2 - 1) * MGAP + FUSE;

  plan('intro', 1.1,
    rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一整份 ' + whole() + '，四段各 1 份，待逐段相加',
    '四卡各持一整份 ' + whole());
  plan('reserve', 1.3,
    '四卡同时预留接收位：卡片长出第二排，计算框亮起',
    '预留第二排 + 计算框');
  plan('fly1', 1.7,
    '第 1 轮 传递：同列互换 —— ' + rk(0) + '↔' + rk(2) + '、' + rk(1) + '↔' + rk(3) +
    '，各把对方要的两段送出',
    '第 1 轮 同列互换');
  plan('seat1', SEAT1,
    '落位：收下的两段依次弹进第二排',
    '收下两段，依次落位');
  plan('merge1', MRG1,
    '合并：两段依次折进上排，这两段加到 2 份',
    '折进上排，各段 2 份');
  plan('fly2', 1.7,
    '第 2 轮 传递：同行互换 —— ' + rk(0) + '↔' + rk(1) + '、' + rk(2) + '↔' + rk(3) +
    '，交出最后一段、收下对方那段',
    '第 2 轮 同行互换');
  plan('seat2', SEAT2,
    '落位：这一轮每卡只收一段',
    '收下一段，落位');
  plan('merge2', MRG2,
    '合并：折进上排，这一段四份相加变 Σ',
    '折进 → Σ');
  plan('shrink', 1.0,
    '收窄：收掉空行与计算框，每卡只留自己编号那一段',
    '卡片收窄，只留一段');
  plan('tail', 2.2,
    '每张卡只留一段的和：' + rk(0) + ' 留 ' + seg(0) + '，' + rk(1) + ' 留 ' + seg(1) +
    '，四卡拼起来才是整份结果',
    '四卡各留一段，拼起来才是整份');

  (function () {
    var acc = 0;
    PLAN.forEach(function (p) { AT[p.id] = { s: acc, e: acc + p.sec }; acc += p.sec; });
    TOTAL = acc;
  })();

  var STEPS = PLAN.map(function (p) {
    return { t: AT[p.id].s / TOTAL, text: p.text, short: p.short };
  });

  /* ── ③ 几何：2×2 网格（与 All-Gather / All-Reduce 同尺寸）──
     preWiden：长出第二排时先挤掉多少留白，卡片就不会突然胖一圈；
     与 reduce 同一套数字，两页的「长高」看起来才是同一个动作。

     hump 按方向分开取值（两条对向车道在法向各偏 hump，间距 = 2×hump）：
       · 横向（左右）—— 线上骑着的包高约 32px，间距一旦小于包高，两个包就
         边缘相切、糊成一坨，看着"挤"。桌面取 22（相距 44px，包间留 12px）；
         窄屏卡片本身就窄，取 18（viewBox 36，屏幕上约 39px）。
       · 纵向（上下）—— 包是横排的整批（第 1 轮两段宽约 104），必须靠法向
         让开，取 40（相距 80px）。横向的紧凑规则不能照搬到这里。 */
  var GEO = CV.geo({
    desktop: {
      grid: { x: 175, y: 136, dx: 480, dy: 330 }, legendY: 17,
      humpH: 22, humpV: 40, areaPad: 12, rowGap: 12, calcGap: 10, preWiden: 25,
      calc: { w: 56, h: 22, fs: 11.5, tipFs: 10.5, tipText: 'sum · avg · max · min' }
    },
    narrow: {
      grid: { x: 8, y: 185, dx: 218, dy: 300 }, legendY: 113,
      humpH: 18, humpV: 40, areaPad: 11, rowGap: 8, calcGap: 7, preWiden: 13,
      calc: { w: 40, h: 16, fs: 9, tipFs: 8, tipText: 'sum · avg' }
    }
  });

  /* 页面级状态（每轮重建前由 onReset 清空） */
  var L = null;
  var recvRow = {};   /* 每卡的四个接收位（第二排） */
  var ghosts = [];    /* [{q, r, seg, idx, outer, slot}] 落位后待折进上排的块 */
  var calcs = {};
  var seen = {};

  function baseRect(r) {
    return {
      x: L.grid.x + (r & 1) * L.grid.dx,
      y: L.grid.y + (r >> 1) * L.grid.dy,
      w: L.card.w, h: L.card.h
    };
  }

  /* 三档卡高：一排 → 两排 → 两排 + 计算框（中心不动，上下同时长）。
     单排时的行顶与 all-gather / all-reduce 完全一致（hdr + (h-hdr-16-sh)/2），
     切页时数据块不会跳一下；两排时用 pad2 重新分配，卡片长高才不会胖一圈。 */
  function heights() {
    var s = L.slot;
    var h1 = L.card.h;
    var pad1 = (h1 - L.hdr - 16 - s.sh) / 2;
    var h2 = h1 + s.sh + L.rowGap - L.preWiden;
    var pad2 = (h2 - L.hdr - (2 * s.sh + L.rowGap)) / 2;
    var h3 = L.hdr + pad2 + (2 * s.sh + L.rowGap) + L.calcGap + L.calc.h + L.areaPad;
    return { h1: h1, h2: h2, h3: h3, pad1: pad1, pad2: pad2 };
  }

  /* 卡内纵向落位：行顶在 pad1 → pad2 之间插值，所以长高 / 收窄过程中不会跳 */
  function inner(h) {
    var C = heights(), s = L.slot;
    var f2 = clamp((h - C.h1) / (C.h2 - C.h1), 0, 1);
    var f3 = clamp((h - C.h2) / (C.h3 - C.h2), 0, 1);
    var y1 = L.hdr + C.pad1 + (C.pad2 - C.pad1) * f2;
    var y2 = y1 + s.sh + L.rowGap * f2;
    var yc = y2 + s.sh + L.calcGap * f3;
    return { y1: y1, y2: y2, yc: yc, f2: f2, f3: f3 };
  }

  function moveSlot(s, y) {
    s.rect.setAttribute('y', y);
    s.text.setAttribute('y', y + s.h / 2);
    s.y = y;
    s.cy = y + s.h / 2;
  }

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

  /* 两卡连线端点：横向相邻走左右边，纵向相邻走上下边。
     返回值带 horiz 标志，调用处据此选 humpH / humpV。 */
  function edgeEnds(a, b) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      /* 横向相邻：一对虚线放在「卡片正文（标题条以下）」的垂直中线上，
         不是整张卡的中线 —— 卡片标题条是实色，线压在标题条上看着像穿过去。
         又因为卡片是「中心固定、上下对称长高」的，这条中线恒等于
         卡中心 + hdr/2，与高度无关：长高 / 收窄过程中线不会上下跳。 */
      var cy = a.y + L.hdr + (a.h - L.hdr) / 2;
      var s = dx < 0 ? -1 : 1;
      return { sx: ac.x + s * a.w / 2, sy: cy, tx: bc.x - s * b.w / 2, ty: cy, horiz: true };
    }
    var t = dy < 0 ? -1 : 1;
    return { sx: ac.x, sy: ac.y + t * a.h / 2, tx: bc.x, ty: bc.y - t * b.h / 2, horiz: false };
  }

  /* 法向偏移：两个方向各偏 +hump（方向本身已相反，不要再补符号） */
  function wirePath(e, off) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return 'M ' + (e.sx + nx) + ' ' + (e.sy + ny) +
           ' C ' + (e.sx + dx * 0.42 + nx) + ' ' + (e.sy + dy * 0.42 + ny) + ', ' +
                 (e.tx - dx * 0.42 + nx) + ' ' + (e.ty - dy * 0.42 + ny) + ', ' +
                 (e.tx + nx) + ' ' + (e.ty + ny);
  }

  /* 某一轮某卡某段的融合进度：第 idx 块比第 0 块晚 idx × mergeGap */
  function mergeE(q, idx, sec) {
    var w = AT[q === 0 ? 'merge1' : 'merge2'];
    return clamp(((sec - w.s) - idx * MGAP) / FUSE, 0, 1);
  }

  /* 这一段此刻几「份」+ 是否正在交出 / 已经交出（消耗语义） */
  function partState(r, i, sec) {
    var n = 1, sending = false, gone = false;
    for (var q = 0; q < ROUNDS; q++) {
      var fly = AT[q === 0 ? 'fly1' : 'fly2'];
      var idxE = EMIT[q][r].indexOf(i);
      var idxR = RECV[q][r].indexOf(i);
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

  /* 这一列此刻该不该露出接收位：本轮要收 → 1，上一轮收过而本轮不收 → 淡出 */
  function recvAlpha(r, i, sec) {
    var inA = RECV[0][r].indexOf(i) >= 0;
    var inB = RECV[1][r].indexOf(i) >= 0;
    if (inA && inB) return 1;
    var tSwitch = AT.fly2.s;
    if (inA) return 1 - clamp((sec - (tSwitch - 0.3)) / 0.3, 0, 1);
    if (inB) return clamp((sec - (tSwitch - 0.3)) / 0.3, 0, 1);
    return 0;
  }

  CV.primitive({
    data: DATA,
    geo: GEO,
    steps: STEPS,
    duration: TOTAL * 1000,

    keepCards: function () { return RANKS; },

    onReset: function () { recvRow = {}; ghosts = []; calcs = {}; seen = {}; },

    build: function (S) {
      L = S.L;
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;

      CV.drawLegend(layer.bg, { x: L.grid.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      var c0 = L.slot;
      var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;

      RANKS.forEach(function (r) {
        var g0 = baseRect(r);
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: g0, color: DATA[r].color,
          title: 'rank ' + r, badgeText: '4 段',
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });

        var x0 = g0.x + (g0.w - totalW) / 2;
        var IN0 = inner(g0.h);
        var y1 = g0.y + IN0.y1;

        /* 上排：累加器（4 段恒在，交出后变空格） */
        chips[r] = [];
        for (var i = 0; i < PARTS; i++) {
          chips[r].push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y1, c0.sw, c0.sh));
        }

        /* 第二排：接收位（一开始收起，预留那一步才淡入） */
        recvRow[r] = [];
        for (var j = 0; j < PARTS; j++) {
          var rs = CV.drawSlot(layer.chips, x0 + j * (c0.sw + c0.gap),
                               y1 + c0.sh + L.rowGap, c0.sw, c0.sh);
          rs.g.style.opacity = '0';
          recvRow[r].push(rs);
        }
      });

      /* 计算框：每卡一枚，压在第二排下面（与 reduce 同一组件） */
      RANKS.forEach(function (r) {
        calcs[r] = CV.drawCalc(layer.labels, {
          w: L.calc.w, h: L.calc.h,
          fs: L.calc.fs, tipFs: L.calc.tipFs, tipText: L.calc.tipText
        });
      });

      /* 落位后待折进上排的块：画在 fx 层，位置每帧跟着接收排走 */
      for (var qg = 0; qg < ROUNDS; qg++) {
        for (var rg = 0; rg < RANKS.length; rg++) {
          var gr = baseRect(rg);
          var gx0 = gr.x + (gr.w - totalW) / 2;
          for (var gi = 0; gi < RECV[qg][rg].length; gi++) {
            var gseg = RECV[qg][rg][gi];
            var gOut = CV.el('g', { class: 'ghost-g', opacity: 0 }, layer.fx);
            var gSlot = CV.drawSlot(gOut, gx0 + gseg * (c0.sw + c0.gap), 0, c0.sw, c0.sh);
            CV.setSlot(gSlot, { letter: DATA[gseg].letter, color: colorFor(gseg, qg + 1) }, {});
            ghosts.push({ q: qg, r: rg, seg: gseg, idx: gi, outer: gOut, slot: gSlot });
          }
        }
      }

      /* 箭头按「每条边」各建一个：同一轮的 4 条边发的段不同、混色也不同 */
      for (var qm = 0; qm < ROUNDS; qm++) {
        for (var rm = 0; rm < RANKS.length; rm++) CV.drawMarker(defs, 'ars' + qm + '_' + rm);
      }

      /* 连线：端点每帧按当前卡框重算（卡片会长高收窄） */
      for (var q2 = 0; q2 < ROUNDS; q2++) {
        for (var r2 = 0; r2 < RANKS.length; r2++) {
          var k = q2 + '_' + r2;
          var wp = CV.drawWire(layer.wires, { d: 'M 0 0', markerId: 'ars' + k });
          wires[k] = {
            path: wp.path, len: wp.len,
            marker: defs.querySelector('#ars' + k + ' path')
          };
          pkts[k] = CV.drawPacketBatch(layer.fx, L.slot, EMIT[q2][r2].map(function (g) {
            return { letter: DATA[g].letter, color: colorFor(g, q2 + 1) };
          }));
        }
      }
    },

    paint: function (S, t) {
      L = S.L;
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var sec = t * TOTAL;   /* 本页时间轴一律按「规划秒」走：AT 里的窗口没乘以 pageSpeed，
                                全局加速由控件推进 t 的速度负责，不在这里换算 */
      var c0 = L.slot;

      /* —— ① 预留：先长到两排，再让出计算框 —— */
      var pRes = clamp((sec - AT.reserve.s) / (AT.reserve.e - AT.reserve.s), 0, 1);
      var e1 = CV.easeInOutQuad(clamp(pRes / 0.62, 0, 1));
      var e2 = CV.easeInOutQuad(clamp((pRes - 0.62) / 0.38, 0, 1));
      var rowA = clamp((pRes - 0.30) / 0.30, 0, 1);
      var calcA = clamp((pRes - 0.62) / 0.38, 0, 1);

      /* —— ⑤ 收窄：先把第二排和计算框淡掉，再收卡片 ——
         两件事不能同时做：卡片一矮，计算框就跑到卡片外面去了（会看见一圈虚影）。 */
      var pShRaw = clamp((sec - AT.shrink.s) / (AT.shrink.e - AT.shrink.s), 0, 1);
      var pFade = clamp(pShRaw / 0.35, 0, 1);
      var pSh = CV.easeInOutQuad(clamp((pShRaw - 0.32) / 0.68, 0, 1));

      var C = heights();
      var h = C.h1 + (C.h2 - C.h1) * e1 + (C.h3 - C.h2) * e2 - (C.h3 - C.h1) * pSh;
      var IN = inner(h);
      var rowStep = c0.sh + L.rowGap;

      /* —— 卡片几何 —— */
      var R = {};
      RANKS.forEach(function (r) {
        var b = baseRect(r);
        var cyc = b.y + L.card.h / 2;
        R[r] = { x: b.x, y: cyc - h / 2, w: b.w, h: h };
        CV.resizeCard(cards[r], R[r]);
      });

      var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;

      /* —— 上排累加器 / 第二排接收位 —— */
      RANKS.forEach(function (r) {
        var g = R[r];
        var x0 = g.x + (g.w - totalW) / 2;
        var y1 = g.y + IN.y1, y2 = g.y + IN.y2;
        var left = 0;

        for (var i = 0; i < PARTS; i++) {
          var s = chips[r][i];
          moveSlot(s, y1);
          var st = partState(r, i, sec);
          if (st.gone) {
            CV.setSlot(s, null, {});
          } else if (st.sending) {
            CV.setSlot(s, null, { active: true });
          } else {
            CV.setSlot(s, {
              letter: st.n >= PARTS - 0.02 ? 'Σ' : DATA[i].letter,
              color: colorFor(i, st.n)
            }, {});
          }
          if (!st.gone) left++;

          /* 折进来的那一刻，上排这一段弹一下；拖回去要清标记，否则不复播 */
          var qNow = sec >= AT.fly2.s ? 1 : 0;
          var idxR = RECV[qNow][r].indexOf(i);
          if (idxR >= 0) {
            var key = 'm' + qNow + r + i;
            var me = mergeE(qNow, idxR, sec);
            if (me >= 0.92 && !seen[key]) { seen[key] = 1; CV.spawnPulse(layer.fx, s); }
            else if (me < 0.92 && seen[key]) { delete seen[key]; }
          }
        }

        /* 第二排：本轮要收的那几列亮出来，其余收起。
           注意 setSlot 会把 opacity 写回 ''（它自己管显隐），所以先设状态、再写透明度。 */
        for (var j = 0; j < PARTS; j++) {
          var rs = recvRow[r][j];
          moveSlot(rs, y2);
          var qc = sec >= AT.fly2.s ? 1 : 0;
          var inFlight = sec >= AT[qc === 0 ? 'fly1' : 'fly2'].s &&
                         sec < AT[qc === 0 ? 'fly1' : 'fly2'].e &&
                         RECV[qc][r].indexOf(j) >= 0;
          CV.setSlot(rs, null, { active: inFlight });
          rs.g.style.opacity = (recvAlpha(r, j, sec) * rowA * (1 - pFade)).toFixed(3);
        }

        var bt = left + ' 段';
        if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;

        /* —— 计算框：贴第二排下面，随卡片一起长 / 收 —— */
        var cb = calcs[r];
        if (cb) {
          cb.wrap.setAttribute('transform',
            'translate(' + (g.x + g.w / 2) + ' ' + (g.y + IN.yc) + ')');
          var ca = calcA * (1 - pFade);
          cb.wrap.style.opacity = String(ca);
          cb.wrap.setAttribute('data-on', ca > 0.5 ? '1' : '0');
        }
      });

      /* —— ③④ 落位的块：弹出 → 逐段上折 → 消失 —— */
      ghosts.forEach(function (gh) {
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

      /* —— 连线 & 数据包 —— */
      for (var q = 0; q < ROUNDS; q++) {
        var fw = AT[q === 0 ? 'fly1' : 'fly2'];
        var mw = AT[q === 0 ? 'merge1' : 'merge2'];
        for (var r = 0; r < RANKS.length; r++) {
          var k2 = q + '_' + r;
          var w = wires[k2], p = pkts[k2];
          var col = colorFor(EMIT[q][r][0], q + 1);

          /* 卡片在长高 / 收窄，端点每帧重算；hump 按这条边的方向取 */
          var e3 = edgeEnds(R[r], R[PARTNER[q][r]]);
          w.path.setAttribute('d', wirePath(e3, e3.horiz ? L.humpH : L.humpV));
          w.len = w.path.getTotalLength();

          var flying = sec >= fw.s && sec < fw.e;
          var fading = sec >= fw.e && sec < fw.e + FADE;

          if (flying) {
            var lead = Math.min(0.32, (p.half || 0) / (w.len || 1));
            var ep = CV.easeInOutQuad((sec - fw.s) / (fw.e - fw.s));
            CV.placePacket(p, w, lead + ep * (1 - lead));
            w.path.setAttribute('stroke', col);
            w.path.setAttribute('stroke-width', '2.6');
            w.path.setAttribute('stroke-dasharray', '9 7');
            w.path.setAttribute('opacity', '1');
            w.marker.setAttribute('fill', col);
          } else if (fading) {
            CV.placePacket(p, w, 1);
            CV.pktFadeOut(p, sec - fw.e, FADE);
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
    }
  });
})();
