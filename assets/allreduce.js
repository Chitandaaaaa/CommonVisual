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

   ── 每一轮都走 reduce 那套「六拍」，不把外来份直接糊进累加器 ──
     ① 传递：整份包沿虚线飞到卡边
     ② 长高：卡片上下同时扩，下排腾出 4 个接收位（空位淡入）
     ③ 落位：对方那份四段逐个摆进接收位（缩放过冲 → 弹跳）
     ④ 计算：卡片再长高一层，「计算」方框浮在下排下方（reduce 同款）
     ⑤ 合并：逐段被吸到上排累加器，颜色加深，合完那段弹一下
     ⑥ 收回：方框先淡出、两层依次收回 —— 这一拍走完下一轮才允许起飞

   为什么长高不会把版面顶歪：卡片中心固定、上下对称扩；数据两排的位置
   按 (h3−h2)/2 反补，所以「长计算层」时数据块本身不动、只有卡边在扩。
   桌面卡片最高 231，行距压到 300 才装得下（330 时第二排会多出画布 17px），
   行间净空 69 —— 纵向那对车道（相距 108）本来就靠水平错开、不吃这段净空，
   而飞包时卡片已收回原高（净空 130），所以飞行段也不挤。

   只声明数据 / 时间轴 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var el = CV.el, clamp = CV.clamp;

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  var DEEP = '#4c1d95';

  /* 段 s 合了 n 份之后的颜色（4 份时是纯深紫） */
  function colorFor(s, n) {
    return CV.mix(DATA[s].color, DEEP, (n - 1) / (PARTS - 1));
  }

  /* ── ① 时间轴 ──
     融合节奏走规范 09：单段 SEG = fuseDur、段间 GAP = mergeGap，
     和 reduce 同一组数（规范页改了这边立刻跟着变）。
     不属于规范的只有每拍的编排秒：飞多久、长高多久、收回多久、两轮之间停多久。 */
  var SEG  = CV.specVal('fuseDur') || 0.55;
  var MGAP = CV.specVal('mergeGap') || 0.5;
  var POPD = (CV.params && CV.params.get('08-seat', 'popDur')) || 0.55;

  var TM = {
    init: 0.9,
    fly: 1.1,
    grow: 0.5,       /* 卡片长高，腾出下排接收区 */
    pop: 0.5,        /* 单块弹出（缩放过冲） */
    stag: 0.12,      /* 四段之间的小错峰：一块一块落位，但不拖成 4 个 seatGap */
    growCalc: 0.4,   /* 再长一层，给「计算」方框腾位置 */
    merge: SEG + (PARTS - 1) * MGAP,
    shrink: 0.7,     /* 方框淡出 → 计算层收回 → 接收层收回 */
    gap: 0.55
  };
  /* 落位整段长 = 三档错峰 + 最后一块的弹跳尾（弹跳比落位晚 popDur 才开始） */
  var POP_SPAN = (PARTS - 1) * TM.stag + Math.max(TM.pop, POPD);

  function mkRound(start) {
    var r = { start: start };
    r.arrive = r.start + TM.fly;          /* 包到卡边 */
    r.growEnd = r.arrive + TM.grow;       /* 卡片长高完成，接收区就位 */
    r.popStart = r.growEnd;               /* 外来份开始落位 */
    r.popEnd = r.popStart + POP_SPAN;     /* 四块落位并弹完 */
    r.calcStart = r.popEnd;               /* 再长一层，放「计算」方框 */
    r.calcEnd = r.calcStart + TM.growCalc;
    r.mergeStart = r.calcEnd;             /* 方框就位后才开始相加 */
    r.mergeEnd = r.mergeStart + TM.merge; /* 逐段合完 */
    r.end = r.mergeEnd + TM.shrink;       /* 方框淡出、卡片收回原高 = 本轮真正结束 */
    return r;
  }

  var ROUNDS = [mkRound(TM.init)];
  ROUNDS.push(mkRound(ROUNDS[0].end + TM.gap));   /* 上一轮收完才起飞 */
  var TOTAL = ROUNDS[1].end + 0.6;
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
    list.forEach(function (f) { f.start = ROUNDS[q].start; f.arrive = ROUNDS[q].arrive; });
  });

  /* 某段在一次 merge 里的进度：第 i 段晚 i×MGAP 开始，用 SEG 折完 */
  function mergeE(p, i) {
    return clamp((p * TM.merge - i * MGAP) / SEG, 0, 1);
  }

  /* 落位弹跳曲线：0.35 → 1.16（过冲）→ 1，reduce 同款 */
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

  /* 当前处在哪一拍：返回本帧两个撑开量（接收层 lift、计算层 calc）与合并进度 merge */
  function stageOf(sec) {
    var q = -1;
    for (var i = 0; i < ROUNDS.length; i++) if (sec >= ROUNDS[i].arrive) q = i;
    if (q < 0) return { q: -1, lift: 0, calc: 0, merge: 0, calcA: 0 };
    var R = ROUNDS[q];
    if (sec < R.growEnd) {
      return { q: q, lift: CV.easeInOutQuad((sec - R.arrive) / TM.grow), calc: 0, merge: 0, calcA: 0 };
    }
    if (sec < R.popEnd) {
      return { q: q, lift: 1, calc: 0, merge: 0, calcA: 0 };
    }
    if (sec < R.calcEnd) {
      /* 计算层撑开：方框在后半段才淡入（和卡片同时长出来，不会先浮在空旷处） */
      var g = clamp((sec - R.calcStart) / TM.growCalc, 0, 1);
      return { q: q, lift: 1, calc: CV.easeInOutQuad(g), merge: 0,
               calcA: clamp((g - 0.30) / 0.60, 0, 1) };
    }
    if (sec < R.mergeEnd) {
      return { q: q, lift: 1, calc: 1, merge: clamp((sec - R.mergeStart) / TM.merge, 0, 1), calcA: 1 };
    }
    /* 收回：方框先没、计算层再合、接收层最后收 —— 三层依次退，不抢拍 */
    var s = clamp((sec - R.mergeEnd) / TM.shrink, 0, 1);
    return {
      q: q,
      lift: 1 - CV.easeInOutQuad(clamp((s - 0.45) / 0.55, 0, 1)),
      calc: 1 - CV.easeInOutQuad(clamp((s - 0.20) / 0.80, 0, 1)),
      merge: 1,
      calcA: 1 - clamp(s / 0.35, 0, 1)
    };
  }

  /* ── ③ 文案 ── */
  var X = CV.primText(DATA);
  var rk = X.rk, seg = X.seg, whole = X.whole;
  var SIG = '<em class="sig">Σ</em>';

  var STEPS = [
    { t: 0,
      text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一整份 ' + whole() + '，四段都在每张卡上，逐段待相加',
      short: '四卡各持一整份 ' + whole() },
    { t: N(ROUNDS[0].start),
      text: '第 1 轮：' + rk(0) + rk(1) + ' 左右互换整份，' + rk(2) + rk(3) + ' 左右互换整份',
      short: '第 1 轮 横向互换整份' },
    { t: N(ROUNDS[0].growEnd),
      text: '对方那份到了：卡片先长高、腾出下排接收区，再把那四块一块块摆进去',
      short: '卡片长高，对方那份落位' },
    { t: N(ROUNDS[0].calcStart),
      text: '要算了：卡片再长高一层，放下「计算」方框 —— 求和、平均、取最大最小都按段独立算，四段同时进',
      short: '浮出计算方框，四段同时算' },
    { t: N(ROUNDS[0].mergeStart),
      text: seg(0) + ' 只和 ' + seg(0) + ' 加、' + seg(1) + ' 只和 ' + seg(1) + ' 加 —— 逐段被吸进累加器，四段各合 2 份',
      short: '逐段相加，四段各合 2 份' },
    { t: N(ROUNDS[1].start),
      text: '第 2 轮：' + rk(0) + rk(2) + ' 上下互换整份，' + rk(1) + rk(3) + ' 上下互换整份 —— 长高、落位、算法、收回再来一遍',
      short: '第 2 轮 纵向互换整份' },
    { t: N(ROUNDS[1].calcStart),
      text: '这一轮的四段已经是 2 份的中间结果，同样进方框再算一次',
      short: '再算一次：2 份 → 4 份' },
    { t: N(ROUNDS[1].mergeStart),
      text: '仍是按段对位相加：这次把 2 份再合成 4 份，四段各自把四张卡的值加齐',
      short: '再合一遍，四段各合 4 份' },
    { t: N(TOTAL - 0.6),
      text: '四张卡都变成 ' + SIG + SIG + SIG + SIG + '：第 i 段 = 四张卡第 i 段的和，四份结果完全相同',
      short: '四卡都是四段各自的和 ' + SIG + SIG + SIG + SIG }
  ];

  /* ── ④ 几何：2×2 网格（与 All-Gather / Reduce-Scatter 同尺寸）──
     hump 按方向取值：
       横向（左右）传 —— 一对线摆在卡片正文的垂直中线上（见 edgeEnds）。
       线上骑着的包高约 32px，所以两线相距必须明显大于 32px，否则两个包会「相切」
       粘成一坨（间距 24/32 时实测正是相切）。取 HUMP_H=22 → 相距 44px，
       包与包之间留 12px 空隙；整对 76px，卡片正文 135px，上下仍各余 30px。
       纵向（上下）传 —— 包是四段横排的整批，宽约 102px，必须较大法向错开
       （HUMP_V=54）才能避免两条对向包在法向上叠在一起。 */
  var GEO = CV.geo({
    /* 行距 dy 由 330 收到 300：卡片最高长到 h3=231，330 时第二排底部要到 697，
       超出 680 的画布 17px（会真的被裁掉）。收到 300 后底部 667、行间净空 69，
       而飞包那一拍卡片已收回 170（净空 130），纵向车道又是靠水平错开的，
       所以这段收紧只影响「已落位、正在算」的那几帧，观感反而更紧凑。 */
    desktop: {
      grid: { x: 175, y: 136, dx: 480, dy: 300 }, legendY: 17, rowGap: 12,
      calcGap: 10, areaPad: 12,
      calc: { w: 56, h: 22, fs: 11.5, tipFs: 10.5, tipText: 'sum · avg · max · min' }
    },
    narrow: {
      grid: { x: 8, y: 185, dx: 218, dy: 300 }, legendY: 113, rowGap: 8,
      calcGap: 7, areaPad: 9,
      calc: { w: 40, h: 16, fs: 9, tipFs: 8, tipText: 'sum · avg' }
    }
  });

  var HUMP_H = 22, HUMP_V = 54;

  /* 长高时「少长一点」的修正：上排从「整卡居中」挪到「双排里的上排」，
     实际只需要多出 (槽高 + 排距 − PRE)。桌面 46+12−25=33；
     窄屏卡片只有 126 高，沿用 25 就只长 8px、几乎看不出，所以收到 12（长 21px）。 */
  var PRE_WIDEN = { desktop: 25, narrow: 12 };

  /* 页面级状态（build 重建时由 onReset 清空） */
  var HOME = {}, X0 = {}, empties = {}, ghosts = [{}, {}], calcs = {};
  var paintKey = {}, pulseSeen = {};

  function cardGeo(L, r) {
    return { x: L.grid.x + (r & 1) * L.grid.dx, y: L.grid.y + (r >> 1) * L.grid.dy,
             w: L.card.w, h: L.card.h };
  }

  function edgeEnds(a, b, L) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      /* 横向相邻：一对虚线放在「卡片正文（标题条以下）的垂直中线」上。
         卡片中心固定、上下同扩，所以这条中线恒等于 centerY + hdr/2，
         长高时不用挪（见注释「不会把版面顶歪」）。 */
      var cy = a.y + L.hdr + (a.h - L.hdr) / 2;
      var s = dx < 0 ? -1 : 1;
      return { sx: ac.x + s * a.w / 2, sy: cy, tx: bc.x - s * b.w / 2, ty: cy };
    }
    /* 纵向相邻：从这张卡的底边拉到那张卡的顶边 —— 卡片长高时要跟着缩 */
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

  function moveSlot(s, y) {
    if (s.y === y) return;
    s.rect.setAttribute('y', y);
    s.text.setAttribute('y', y + s.h / 2);
    s.y = y;
    s.cy = y + s.h / 2;
  }

  CV.primitive({
    data: DATA,
    geo: GEO,
    steps: STEPS,
    duration: TOTAL * 1000,

    /* 四张卡都持有全部四段 —— 悬停任何一段，四张卡都相关 */
    keepCards: function () { return RANKS; },

    /* 拖回开头：清掉颜色缓存与「这段刚合完」的标记，让它重新落色、重新弹 */
    onReset: function () { paintKey = {}; pulseSeen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;
      var c0 = L.slot;
      var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;
      var pOne = (L.card.h - L.hdr - 16 - c0.sh) / 2;

      CV.drawLegend(layer.bg, { x: L.grid.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      HOME = {}; X0 = {}; empties = {}; ghosts = [{}, {}]; calcs = {};

      RANKS.forEach(function (r) {
        var geo = cardGeo(L, r);
        HOME[r] = { x: geo.x, cy: geo.y + L.card.h / 2 };
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: geo, color: DATA[r].color,
          title: 'rank ' + r, badgeText: '4 段',
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });

        var x0 = geo.x + (geo.w - totalW) / 2;
        X0[r] = x0;
        var y0 = geo.y + L.hdr + pOne;

        /* 上排：累加器（通信前后都是 4 段，变的是每段的份数） */
        var list = [];
        for (var i = 0; i < PARTS; i++) {
          list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y0, c0.sw, c0.sh));
        }
        chips[r] = list;

        /* 下排：接收位。平时隐藏，卡片长高时才淡入 */
        var emp = [];
        for (var j = 0; j < PARTS; j++) {
          var e = CV.drawSlot(layer.chips, x0 + j * (c0.sw + c0.gap), y0 + c0.sh + L.rowGap, c0.sw, c0.sh);
          e.g.style.opacity = '0';
          emp.push(e);
        }
        empties[r] = emp;

        /* 每轮「对方那一份」一组 ghost（颜色随轮次加深：1 份色 → 2 份色）
           画在 fx 层是为了整块做 translate + scale，不被 chips 层裁剪。 */
        ROUNDS.forEach(function (R, q) {
          var set = [];
          var lvl = Math.pow(2, q);
          for (var k = 0; k < PARTS; k++) {
            var out = el('g', { class: 'ghost-g', opacity: 0 }, layer.fx);
            var s = CV.drawSlot(out, x0 + k * (c0.sw + c0.gap), y0 + c0.sh + L.rowGap, c0.sw, c0.sh);
            CV.setSlot(s, { letter: DATA[k].letter, color: colorFor(k, lvl) }, {});
            s.outer = out;
            set.push(s);
          }
          ghosts[q][r] = set;
        });

        /* 「计算」方框：四张卡都要算（all-reduce 每张卡都得出完整结果），
           所以每张卡各挂一个，位置每帧跟着卡片高度走（见 paint）。
           放在 labels 层 = 盖在线和包之上，和 reduce 同一个层。 */
        var cb = CV.drawCalc(layer.labels, {
          w: L.calc.w, h: L.calc.h,
          fs: L.calc.fs, tipFs: L.calc.tipFs, tipText: L.calc.tipText
        });
        cb.wrap.style.opacity = '0';
        calcs[r] = cb;
      });

      /* 每条有向交换一条线 + 一个「整份」包 */
      var mi = 0;
      ROUTE.rounds.forEach(function (list, q) {
        list.forEach(function (f) {
          var e = edgeEnds(cards[f.from].geo, cards[f.to].geo, L);
          var isHoriz = ((f.from >> 1) === (f.to >> 1));
          var hump = isHoriz ? HUMP_H : HUMP_V;
          var id = 'ar' + (mi++);
          CV.drawMarker(defs, id);
          var w = CV.drawWire(layer.wires, { d: wirePath(e, hump), markerId: id });
          var se = shiftEnds(e, hump);
          var k = q + '_' + f.from + '_' + f.to;
          wires[k] = {
            path: w.path, len: w.len, hump: hump, _h: -1,
            marker: defs.querySelector('#' + id + ' path'),
            sx: se.sx, sy: se.sy, tx: se.tx, ty: se.ty
          };
          /* 整份包：四段一排，颜色 = 该段合了 2^q 份时的颜色 */
          pkts[k] = CV.drawPacketBatch(layer.fx, L.slot, DATA.map(function (d, i) {
            return { letter: d.letter, color: colorFor(i, Math.pow(2, q)) };
          }));
        });
      });
    },

    paint: function (S, t) {
      var L = S.L, layer = S.layers;
      var cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var sec = t * TOTAL;

      var c0 = L.slot;
      var rowStep = c0.sh + L.rowGap;
      var h1 = L.card.h;
      var h2 = h1 + c0.sh + L.rowGap - (PRE_WIDEN[S.mode] || 25);
      /* 第三层：下排下方再让出「计算」方框的位置（与 reduce 同一个公式） */
      var h3 = h2 + L.calcGap + L.calc.h + L.areaPad - 16;

      var st = stageOf(sec);
      var lift = st.lift;
      var q = st.q;

      var h = h1 + (h2 - h1) * lift + (h3 - h2) * st.calc;
      var pOne = (h1 - L.hdr - 16 - c0.sh) / 2;
      var pTwo = (h2 - L.hdr - 2 * c0.sh - L.rowGap) / 2;
      /* 卡片是「中心固定、上下对称扩」的：计算层一开，卡顶会再抬高 (h3−h2)/2。
         这里把这段原样补进 pT，数据两排就钉在原地不动 —— 只有卡边在长，
         否则「方框出现」的那一刻四张卡里的数据块会整排往上跳 14px。 */
      var pT = pOne + (pTwo - pOne) * lift + (h3 - h2) / 2 * st.calc;

      /* 份数是**翻倍**不是加一：recursive doubling 里对方也带着刚合好的那份，
         换过去一次就把自己的份数乘 2（1 → 2 → 4）。写成 q+2 终态会停在 3 份，
         颜色够不到纯深紫、字母也切不成 Σ。 */
      var lvl0 = q >= 0 ? Math.pow(2, q) : 1;   /* 本轮开始时每段几份：1 → 2 */
      var lvl1 = q >= 0 ? lvl0 * 2 : 1;         /* 本轮合完：2 → 4 */

      /* —— ① 卡片：中心固定，四张同步长高 / 收回 —— */
      RANKS.forEach(function (r) {
        var C = cards[r], y = HOME[r].cy - h / 2;
        if (C.geo.h !== h || C.geo.y !== y) {
          CV.resizeCard(C, { x: HOME[r].x, y: y, w: L.card.w, h: h });
        }
      });

      /* —— ② 线：卡片高度一变，纵向线端点就得跟着走（横向线其实不变，
         但也顺带重算，省得两套公式）。守卫用 h 而不是 lift —— 计算层撑开
         时 lift 恒为 1，只看 lift 会把「卡边又长了 28px」的帧全跳过。 —— */
      ROUTE.rounds.forEach(function (list, qq) {
        list.forEach(function (f) {
          var W = wires[qq + '_' + f.from + '_' + f.to];
          if (W._h === h) return;
          W._h = h;
          var ne = edgeEnds(cards[f.from].geo, cards[f.to].geo, L);
          W.path.setAttribute('d', wirePath(ne, W.hump));
          W.len = W.path.getTotalLength();
          var se = shiftEnds(ne, W.hump);
          W.sx = se.sx; W.sy = se.sy; W.tx = se.tx; W.ty = se.ty;
        });
      });

      /* 接收区空位的淡入：卡片长高过半才露出来，收窄时先于卡片消失 */
      var areaA = lift <= 0 ? 0 : clamp((lift - 0.15) / 0.45, 0, 1);

      RANKS.forEach(function (r) {
        var topY = cards[r].geo.y + L.hdr + pT;
        var botY = topY + rowStep;

        /* —— ③ 上排累加器：颜色按「合到几份」插值，过半切成 Σ —— */
        chips[r].forEach(function (s, i) {
          var e = st.merge > 0 ? mergeE(st.merge, i) : 0;
          var col = e > 0 ? CV.mix(colorFor(i, lvl0), colorFor(i, lvl1), e) : colorFor(i, lvl0);
          var letter = (lvl1 === PARTS && e >= 0.5) ? 'Σ' : DATA[i].letter;
          moveSlot(s, topY);
          var key = letter + '|' + col;
          if (paintKey['c' + r + i] !== key) {
            paintKey['c' + r + i] = key;
            CV.setSlot(s, { letter: letter, color: col }, {});
          }
          /* 这一段刚合完 → 弹一下（退回去时删标记，正放不会重复弹） */
          var pk = 'p' + r + i + '_' + q;
          if (st.merge > 0 && e >= 0.92) {
            if (!pulseSeen[pk]) { pulseSeen[pk] = 1; CV.spawnPulse(layer.fx, s, col); }
          } else if (pulseSeen[pk]) {
            delete pulseSeen[pk];
          }
        });

        /* —— ④ 下排接收位 —— */
        empties[r].forEach(function (s) {
          moveSlot(s, botY);
          s.g.style.opacity = String(areaA);
        });

        /* —— ④' 计算方框：卡在「下排下方」那段空白里，随卡片高度逐帧走 ——
           位置公式与 reduce 同：至少离下排 calcGap，空间富余就居中。 */
        if (calcs[r]) {
          var blankTop = botY + c0.sh;
          var calcY = blankTop + Math.max(L.calcGap,
                        (cards[r].geo.y + h - blankTop - L.calc.h) / 2);
          calcs[r].wrap.setAttribute('transform',
            'translate(' + (cards[r].geo.x + L.card.w / 2).toFixed(1) + ' ' + calcY.toFixed(1) + ')');
          calcs[r].wrap.style.opacity = String(st.calcA);
          calcs[r].wrap.setAttribute('data-on', st.calcA > 0.5 ? '1' : '0');
        }

        /* —— ⑤ 外来的一份：落位（缩放过冲）→ 逐段上折 → 消失 —— */
        ROUNDS.forEach(function (R, qq) {
          var set = ghosts[qq][r];
          var on = (qq === q) && sec >= R.popStart && sec < R.end;
          set.forEach(function (s, i) {
            if (!on) {
              s.outer.setAttribute('opacity', '0');
              return;
            }
            var popP = clamp((sec - R.popStart - i * TM.stag) / TM.pop, 0, 1);
            var pop = popOf(popP);
            var e = st.merge > 0 ? mergeE(st.merge, i) : 0;
            /* 上折时一起缩小：位移 + 透明 + 缩放三个量都单调，没有回弹 */
            var k = pop.k * (1 - 0.30 * e);
            moveSlot(s, botY);
            s.outer.setAttribute('opacity', String(pop.o * (1 - e)));
            s.outer.setAttribute('transform',
              'translate(' + (s.cx * (1 - k)).toFixed(2) + ' ' +
                              (s.cy * (1 - k) - rowStep * e).toFixed(2) + ') scale(' + k.toFixed(3) + ')');
          });
        });
      });

      /* —— ⑥ 连线 & 数据包 —— */
      ROUTE.rounds.forEach(function (list, qq) {
        list.forEach(function (f) {
          var k = qq + '_' + f.from + '_' + f.to;
          var W = wires[k], p = pkts[k];
          var R = ROUNDS[qq];
          var active = sec >= R.start && sec < R.arrive;
          var color = colorFor(f.from, Math.pow(2, qq));

          if (active) {
            var e = CV.easeInOutQuad((sec - R.start) / (R.arrive - R.start));
            /* 整份包很宽，起步先走出一小段，避免左半压住发卡的数据块 */
            var lead = Math.min(0.32, p.half / W.len);
            e = lead + e * (1 - lead);
            CV.placePacket(p, W, e);
            W.path.setAttribute('stroke', color);
            W.path.setAttribute('stroke-width', '2.6');
            W.path.setAttribute('stroke-dasharray', '9 7');
            W.path.setAttribute('opacity', '1');
            W.marker.setAttribute('fill', color);
          } else if (sec >= R.arrive) {
            /* 线色三档：两轮都完→深紫淡线 / 本轮过但还有轮→中性灰 / 刚落地→保留发送色 */
            var allDone = sec >= ROUNDS[1].end;
            var roundDone = sec >= R.end;
            var strokeCol = allDone ? DEEP : (roundDone ? '#c3cadb' : color);
            var op = allDone ? '.26' : (roundDone ? '.75' : '.42');
            /* 先把包摆到终点再淡出：拖进度条直接跳到「已到达」的帧时，
               飞行帧从没跑过，placePacket 没被调用过，包会停在 SVG 原点（左上角）。 */
            CV.placePacket(p, W, 1);
            CV.pktFadeOut(p, sec - R.arrive);
            W.path.setAttribute('stroke', strokeCol);
            W.path.setAttribute('stroke-width', '1.8');
            W.path.setAttribute('stroke-dasharray', '8 7');
            W.path.setAttribute('opacity', op);
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
    }
  });
})();
