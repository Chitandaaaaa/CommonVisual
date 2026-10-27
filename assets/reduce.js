/* ============================================================
   CommonVisual · Reduce（归约）动态演示
   ------------------------------------------------------------
   和 gather 的差别：gather 是把 N 段**拼**起来（数据量变大）；
   reduce 是把 N 份**加起来**（数据量不变，结果还是 4 格，颜色越加越浓）。

   两条语义铁律：
   ① 不存在「先把 N 份堆起来再压缩」的中间态。rank0 始终只有一个累加器，
      每飞过来一份，就立刻逐段折进去。
   ② reduce 是**消耗**数据的操作，不是复制。源卡把数据交出去之后缓冲区就空了
      （broadcast 才是复制，源卡留着不动）。

   目标卡的三个状态：
     一份数据   → 卡片与源卡**完全同构**（同高、数据块同位置）
     两份数据   → 卡片上下同时拉宽，多出的一排放进来，两排整体居中
     计算中     → 卡片再上下拉宽，底部多出一行放「计算」方框
     计算完成   → 方框消失，卡片收回两份数据的高度

   卡片**中心固定**，高度变化时上下同时扩。
   第一排数据永远挂在「标题条 + padTop」处（padTop 与源卡同一套算法），
   所以预留拉宽时旧数据块只是随顶边上移一小段，位置结构不变。
   计算拉宽时两排**冻结**，卡片扩宽纯粹是给方框腾地方，数据一点不漂。
   ============================================================ */
(function () {
  'use strict';

  var $ = CV.$, el = CV.el, clamp = CV.clamp;

  /* ══════════════════════════════════════════════════════════
     ① 数据：一份完整数据由 4 段组成，每张卡都持有一整份
     ══════════════════════════════════════════════════════════ */
  var DATA = [
    { letter: 'A', color: '#7c3aed' },
    { letter: 'B', color: '#0891b2' },
    { letter: 'C', color: '#059669' },
    { letter: 'D', color: '#d97706' }
  ];

  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  /* ══════════════════════════════════════════════════════════
     ② 时间轴：一律用**秒**写，最后再归一化
     ══════════════════════════════════════════════════════════ */
  var T = {
    init:     0.6,   /* 第一步：四卡各持整份 */
    prealloc: 0.7,   /* 第二步：预留 4 份缓冲 */
    fly:      1.7,   /* 单程飞行 */
    pop:      0.6,   /* 落位弹跳（算在「传递」这一步里） */
    grow:     0.4,   /* 计算步：拉宽卡片、亮出计算方框 */
    merge:    1.3,   /* 计算步：ABCD 逐段融合 */
    shrink:   0.4    /* 计算步：方框消失、卡片收窄 */
  };

  /* 融合节奏：单段融合 SEG 秒，段与段之间隔 GAP 秒。
     旧版折算成秒是「间隔 0.15s、单段 0.55s」，
     现在间隔加到 0.25s（正好 +0.1s），单段时长不变。 */
  var SEG = 0.55, GAP = 0.25;

  var CYCLE = T.fly + T.pop + T.grow + T.merge + T.shrink;
  var TOTAL = T.init + T.prealloc + CYCLE * 3 + 0.5;   /* 一轮总时长（秒） */
  function N(sec) { return sec / TOTAL; }

  /* 每份分四拍：飞过去 → 落位弹跳 → 拉宽出方框 → 融合 */
  var ROUTE = { target: 0, flows: [] };
  (function () {
    var s = T.init + T.prealloc;
    for (var i = 1; i <= 3; i++) {
      var f = {
        from: i,
        start: s,
        arrive: s + T.fly,
        popEnd: s + T.fly + T.pop,
        growEnd: s + T.fly + T.pop + T.grow,
        mergeEnd: s + T.fly + T.pop + T.grow + T.merge,
        end: s + T.fly + T.pop + T.grow + T.merge + T.shrink
      };
      ROUTE.flows.push(f);
      s = f.end;
    }
  })();

  function flowOf(from) {
    return ROUTE.flows.filter(function (f) { return f.from === from; })[0];
  }

  /* 折进进度：A~D 依次错开，每段用 SEG 秒走完自己的融合 */
  function mergeE(p, i) {
    return clamp((p * T.merge - i * GAP) / SEG, 0, 1);
  }

  /* 已经完整折进累加器的份数（rank0 自己那份算 1） */
  function doneParts(sec) {
    var n = 1;
    ROUTE.flows.forEach(function (f) { if (sec >= f.mergeEnd) n++; });
    return n;
  }

  /* 越加越浓：同一种颜色叠加多份 = 更深、更饱和 */
  function sumColor(base, n) {
    return CV.mix(base, '#190d33', 0.19 * (n - 1));
  }

  /* 落位弹跳：与 gather / scatter / broadcast 的 CSS `.slot-pop` 完全同一条曲线。
     CSS 里是 animation: slotPop .55s cubic-bezier(.2,.9,.3,1.45)，
     关键帧 0% scale(.35) → 55% scale(1.16) → 100% scale(1)，
     每个区间都用这条带过冲的弹性缓动 —— 所以是"啪"一下弹出来再收回。
     这里用 JS 算而不用 CSS 动画，是因为 ghost 外层还有融合位移的 transform，
     两层 transform 叠加会让 Chrome 把 SVG 分组提成合成层、填充色渲染成黑块。
     POP_EASE 就是把那条 cubic-bezier 原样搬过来。 */
  var POP_EASE = CV.cubicBezier(.2, .9, .3, 1.45);
  function popOf(q) {
    if (q <= 0) return { k: 0.35, o: 0 };
    if (q >= 1) return { k: 1, o: 1 };
    if (q < 0.55) {
      var e = POP_EASE(q / 0.55);
      /* opacity 会被 CSS 钳到 [0,1]，曲线过冲的那段要自己钳 */
      return { k: 0.35 + (1.16 - 0.35) * e, o: Math.min(1, e) };
    }
    var e2 = POP_EASE((q - 0.55) / 0.45);
    return { k: 1.16 + (1 - 1.16) * e2, o: 1 };
  }

  /* ══════════════════════════════════════════════════════════
     ③ 文案
     ══════════════════════════════════════════════════════════ */
  function rk(n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; }
  function seg(n) { return '<em class="c' + DATA[n].letter + '">' + DATA[n].letter + '</em>'; }
  function whole() { return seg(0) + seg(1) + seg(2) + seg(3); }

  var STEPS = [
    { t: 0, text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持整份 ' + whole() },
    { t: N(T.init), text: rk(0) + ' 预留 4 份缓冲' }
  ];
  ROUTE.flows.forEach(function (f) {
    STEPS.push({ t: N(f.start), text: rk(f.from) + ' 的整份送往 ' + rk(0) });
    STEPS.push({ t: N(f.popEnd), text: '逐段相加，累加到 ' + (f.from + 1) + ' 份' });
  });
  STEPS.push({ t: N(ROUTE.flows[ROUTE.flows.length - 1].end), text: '结果只留在 ' + rk(0) });

  /* ══════════════════════════════════════════════════════════
     ④ 几何
     目标卡**中心固定**，三个高度：
       h1 = 源卡高度    = 标题条 + 上留白 + 一排 + 下留白（与源卡逐像素同构）
       h2 = h1 + 一排   = 两排 + 上下留白，整体居中，**不含**计算方框的位置
       h3 = h2 + 方框行 = 源卡底部那 16 的固定留白换成「方框 + 底留白」
     内容位置：
       第一排   = 卡片顶 + 标题条 + padTop（预留阶段随顶边上移，计算阶段冻结）
       第二排   = 第一排 + 行距
       计算方框 = 第二排 + 一格 + 方框间距
     所以：初始态四卡完全一致；预留后两排在「标题条以下的空白部分」严格居中；
     计算中方框卡在第二排下面，数据块位置一点不漂。
     三个箭头落点同样分布在这片空白部分里（25% / 50% / 75%）。
     ══════════════════════════════════════════════════════════ */
  var GEO = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      target: { x: 10,  cy: 340 },
      source: { x: 820, ys: [50, 255, 460] },
      legendY: 50,
      slot: { sw: 46, sh: 46, gap: 12 },
      hdr: 36,
      areaPad: 12,      /* 内容区上下留白 */
      rowGap: 12,       /* 第一排 → 第二排 */
      calcGap: 10,      /* 第二排 → 计算方框 */
      calc: { w: 56, h: 22, fs: 11.5, tipFs: 10.5, tipText: 'sum · avg · max · min' },
      title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      target: { x: 6,   cy: 360 },
      source: { x: 226, ys: [40, 297, 554] },
      legendY: 40,
      slot: { sw: 25, sh: 25, gap: 5 },
      hdr: 28,
      areaPad: 9,
      rowGap: 8,
      calcGap: 7,
      calc: { w: 40, h: 16, fs: 9, tipFs: 8, tipText: 'sum · avg' },
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
    chips:  $('#lChips'),
    wires:  $('#lWires'),
    fx:     $('#lFx'),
    labels: $('#lLabels')
  };

  var L = GEO.desktop;
  var cards = {}, chips = {}, wires = {}, pkts = {}, ghost = {}, emptyRow = [], calc = null;
  var rowStep = 0;              /* 两排之间的中心距，融合位移用它 */

  var focus = CV.attachFocus(svg, {
    /* 归约时每张卡都参与，聚焦任何一段都不该让别卡褪色 */
    keepCards: function () { return RANKS; }
  });

  /* ---------- 数据排距卡片顶的距离：与源卡同一套算法 ----------
     源卡的结构是「标题条 + 上留白 + 一排 + 下留白（多 16）」，
     目标卡初始态必须和源卡长得一模一样，所以直接用同一个 padTop。 */
  function padTop() { return (L.card.h - L.hdr - 16 - L.slot.sh) / 2; }

  /* 两排态的上留白：让两排在「标题条以下的空白部分」里严格上下居中。
     和 padTop() 的差别就在底部那 16 —— 两排态不再留那份富余。 */
  function padTop2(CH) {
    return (CH.h2 - L.hdr - 2 * L.slot.sh - L.rowGap) / 2;
  }

  /* ---------- 目标卡的三个高度 ---------- */
  /* ② 预留缓冲的长高量：一整排（sh + rowGap）再收掉 PRE_WIDEN。
     收掉的就是源卡「底部多 16」那一套的富余 —— 两排态不需要那么大底留白。
     （desktop 58→33，narrow 33→8） */
  var PRE_WIDEN = 25;
  function cardH() {
    var c0 = L.slot;
    var h1 = L.card.h;                                   /* ① 与源卡同高 */
    var h2 = h1 + c0.sh + L.rowGap - PRE_WIDEN;          /* ② 多出不到一整排 */
    /* ③ 源卡底部那 16 的固定留白，换成「方框 + 底留白」 */
    var h3 = h2 + L.calcGap + L.calc.h + L.areaPad - 16;
    return { h1: h1, h2: h2, h3: h3 };
  }

  /* ---------- 移动一个槽位（x 不变，只改 y） ---------- */
  function moveSlot(s, y) {
    s.rect.setAttribute('y', y);
    s.text.setAttribute('y', y + s.h / 2);
    s.y = y;
    s.cy = y + s.h / 2;
  }

  /* ---------- 计算方框：实现在 cv/kit.js（规范页要 1:1 复用同一份） ----------
     这里只负责选层：方框属于标注层，永远压在卡片与数据包上面 */
  function drawCalc(o) {
    return CV.drawCalc(layer.labels, o);
  }

  function buildStage() {
    var v = L.view;
    svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);

    ['bg', 'cards', 'wires', 'chips', 'fx', 'labels'].forEach(function (k) {
      layer[k].innerHTML = '';
    });
    cards = {}; chips = {}; wires = {}; pkts = {}; ghost = {}; emptyRow = []; calc = null;

    var defs = svg.querySelector('defs');

    CV.drawGrid(layer.bg, v);

    /* 图例：一份数据由四段拼成 */
    CV.drawLegend(layer.bg, {
      x: L.target.x + 7, y: L.legendY + 7,
      slot: L.slot, items: DATA
    });

    /* 卡片 */
    RANKS.forEach(function (r) {
      var isTarget = r === ROUTE.target;
      var geo = {
        x: isTarget ? L.target.x : L.source.x,
        y: isTarget ? L.target.cy - L.card.h / 2 : L.source.ys[r - 1],
        w: L.card.w,
        h: L.card.h                      /* 四张卡初始同高，目标卡随后再长 */
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
        /* 目标卡上排 = 累加器（常驻）。初始位置与源卡同构 */
        for (var i = 0; i < PARTS; i++) {
          list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap),
                                geo.y + L.hdr + padTop(), c0.sw, c0.sh));
        }
      } else {
        /* 源卡单排：同一套 padTop，保证初始态四张卡数据块对齐 */
        var y = geo.y + L.hdr + padTop();
        for (var j = 0; j < PARTS; j++) {
          list.push(CV.drawSlot(layer.chips, x0 + j * (c0.sw + c0.gap), y, c0.sw, c0.sh));
        }
      }
      chips[r] = list;
    });

    /* 目标卡下排：常设 4 个空位（预留缓冲），一开始隐藏，预留那一步淡入 */
    var tX0 = cards[ROUTE.target].geo.x + (cards[ROUTE.target].geo.w - totalW) / 2;
    for (var k = 0; k < PARTS; k++) {
      var e = CV.drawSlot(layer.chips, tX0 + k * (c0.sw + c0.gap), 0, c0.sw, c0.sh);
      e.g.style.opacity = '0';
      emptyRow.push(e);
    }

    /* 待归约的整份：画在 fx 层（可自由移动），数据先填好，靠 opacity 控制显隐 */
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
    ROUTE.flows.forEach(function (f) {
      CV.drawMarker(defs, 'ah' + f.from);
    });

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

    /* 计算方框：气泡宽度由 kit 按文案实测算（左右各留 12），这里不再写死 */
    calc = drawCalc({
      w: L.calc.w, h: L.calc.h,
      fs: L.calc.fs, tipFs: L.calc.tipFs, tipText: L.calc.tipText
    });

    focus.refresh();
  }

  /* 连线落点：三条线沿目标卡右缘、在「标题条以下的空白部分」里
     按 25% / 50% / 75% 均匀分布 —— 既不会挤成一团，
     也不会偏到卡片外或压到标题条上。卡片长高时落点跟着空白部分走。 */
  function layoutWires(cardTop, cardH) {
    var areaTop = cardTop + L.hdr, areaH = cardH - L.hdr;
    ROUTE.flows.forEach(function (f) {
      var w = wires[f.from];
      var ty = areaTop + areaH * (0.25 + 0.25 * w.k);
      var span = w.sx - w.tx;
      var d = 'M ' + w.sx + ' ' + w.sy +
              ' C ' + (w.sx - span * 0.42) + ' ' + w.sy + ', ' + (w.tx + span * 0.42) + ' ' + ty +
              ', ' + w.tx + ' ' + ty;
      w.path.setAttribute('d', d);
      w.len = w.path.getTotalLength();
    });
  }

  /* ══════════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════════ */
  var seen = {};

  function paint(t) {
    var sec = t * TOTAL;             /* 换算成秒，方便和 T 对照 */
    var c0 = L.slot;
    var CH = cardH();

    /* —— 阶段一：预留缓冲 ——
       卡片上下同时拉宽到两份数据的高度，第二排的 4 个空位跟着淡入 */
    var pPre = clamp((sec - T.init) / T.prealloc, 0, 1);
    var growPre = CV.easeInOutQuad(clamp(pPre / 0.72, 0, 1));
    /* 空位等卡片长出足够空间再出现，否则会先露在卡片底边外面 */
    var rowA = clamp((growPre - 0.15) / 0.3, 0, 1);

    /* —— 阶段二：计算 ——
       拉宽 → 融合 → 收窄。收窄时方框先淡出，免得压到数据上 */
    var growCal = 0, chipA = 0, cur = null, mergeP = 0;
    ROUTE.flows.forEach(function (f) {
      if (sec < f.popEnd || sec >= f.end) return;
      if (sec < f.growEnd) {
        var g = (sec - f.popEnd) / T.grow;
        growCal = CV.easeInOutQuad(g);
        chipA = clamp((g - 0.35) / 0.5, 0, 1);   /* 卡片快撑满了再亮方框 */
      } else if (sec < f.mergeEnd) {
        growCal = 1; chipA = 1;
        mergeP = (sec - f.growEnd) / T.merge;
        cur = f;
      } else {
        /* 回收分两步（规范页 07 的节奏）：方框先灭，卡还在 h3 上站一会儿；
           方框彻底没了再收空间 —— 同步收窄会让方框瞬间掉到卡外，露在外面很难看 */
        var s = clamp((sec - f.mergeEnd) / T.shrink, 0, 1);
        var FADE = 0.45;                                   /* 前 45% 只做「方框灭」 */
        chipA = 1 - clamp(s / FADE, 0, 1);
        growCal = 1 - CV.easeInOutQuad(clamp((s - FADE) / (1 - FADE), 0, 1));
      }
    });

    /* —— 卡片几何 ——
       预留阶段：绕中心上下同时扩，两排才能在内容区里保持上下居中；
       计算阶段：改成**只往下长**，顶边钉死 —— 长出来的那 28 就是方框的位置。
       （对齐规范页 07 的「卡片在下方长高，两排位置不动」） */
    var h = CH.h1 + (CH.h2 - CH.h1) * growPre + (CH.h3 - CH.h2) * growCal;
    var cardTop = L.target.cy - h / 2 + (CH.h3 - CH.h2) * growCal / 2;
    CV.resizeCard(cards[ROUTE.target], {
      x: L.target.x, y: cardTop, w: L.card.w, h: h
    });
    var tGeo = cards[ROUTE.target].geo;

    /* —— 两排数据的位置 ——
       初始态：第一排与源卡同构（padTop，底部那份 16 的富余要保留）；
       预留完成：两排改在「标题条以下的空白部分」严格上下居中（padTop2）；
       计算阶段：两排**冻结**在预留完成时的位置，卡片再拉宽只是给方框腾地方 */
    var topNow = growCal > 0 ? (L.target.cy - CH.h2 / 2) : cardTop;
    var pT = padTop() + (padTop2(CH) - padTop()) * growPre;
    var rowY = topNow + L.hdr + pT;            /* 第一排（累加器） */
    var rowY2 = rowY + rowStep;                /* 第二排（刚到的整份） */
    /* 计算方框：在「第二排底 → 当前卡底」这段空白里上下居中。
       卡长高时它跟着下移一点点，永远不贴边；calcGap 只当最小间距兜底。 */
    var blankTop = rowY2 + c0.sh;
    var calcY = blankTop + Math.max(L.calcGap, (cardTop + h - blankTop - L.calc.h) / 2);

    chips[ROUTE.target].forEach(function (s) { moveSlot(s, rowY); });

    /* —— 下排接收位的状态 ——
       预留完成后这一排就是「缓冲区待命」，显示「···」（和 gather 的接收位同一种语言）；
       数据落位时彩色块盖在上面；融合把数据折进累加器后，这一格又空出来继续等下一份。
       全部归约完成后不再等数据，恢复成空槽。 */
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

    /* —— 累加器（上排）：份数越多颜色越浓；正在折进的那一段做插值 —— */
    chips[ROUTE.target].forEach(function (s, i) {
      var base = DATA[i].color;
      var c = sumColor(base, n);
      if (cur) c = CV.mix(c, sumColor(base, n + 1), mergeE(mergeP, i));
      CV.setSlot(s, { letter: DATA[i].letter, color: c }, {});
    });

    /* —— 源卡：数据交出去就不再留着（reduce 消耗数据，不是复制） —— */
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

    /* —— 下排：刚飞到的整份，弹出来 → 逐段向上折进 → 消失 —— */
    ROUTE.flows.forEach(function (f) {
      var list = ghost[f.from];
      var on = sec >= f.arrive && sec < f.mergeEnd;
      var p = (on && sec >= f.growEnd) ? (sec - f.growEnd) / T.merge : 0;
      var pop = popOf(clamp((sec - f.arrive) / T.pop, 0, 1));

      list.forEach(function (s, i) {
        if (!on) {
          s.outer.setAttribute('opacity', '0');
          s.outer.removeAttribute('transform');
          return;
        }
        var e = mergeE(p, i);
        var k = pop.k * (1 - 0.30 * e);      /* 弹跳 × 边缩边升 */
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
        /* 整份包很宽，起点就让出一小段，别压住源卡里的数据块 */
        var lead = Math.min(0.32, p.half / w.len);
        var e = CV.easeInOutQuad((sec - f.start) / (f.arrive - f.start));
        e = lead + e * (1 - lead);
        CV.placePacket(p, w, e);
        w.path.setAttribute('stroke', color);
        w.path.setAttribute('stroke-width', '2.6');
        w.path.setAttribute('stroke-dasharray', '9 7');
        w.path.setAttribute('opacity', '1');
        w.marker.setAttribute('fill', color);
      } else if (sec >= f.arrive) {
        p.g.setAttribute('opacity', '0');
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

    /* —— 折进完成：累加器那一段弹一下，表示这一份吃进去了 —— */
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

    /* —— 计算方框：在第二排以下的空白里上下居中（calcY 已按当前卡高算好），
       方牌局部坐标已居中，所以平移到卡片水平中心即可 —— */
    if (calc) {
      calc.wrap.setAttribute('transform',
        'translate(' + (tGeo.x + tGeo.w / 2) + ' ' + calcY + ')');
      calc.wrap.style.opacity = String(chipA);
      calc.wrap.setAttribute('data-on', chipA > 0.5 ? '1' : '0');
    }
  }

  /* ══════════════════════════════════════════════════════════
     启动
     ══════════════════════════════════════════════════════════ */
  var controls = CV.createControls({
    steps: STEPS,
    duration: TOTAL * 1000,
    onFrame: paint
  });

  var lastMode = null;
  function syncLayout(force) {
    var mode = window.innerWidth < 860 ? 'narrow' : 'desktop';
    if (!force && mode === lastMode) return;
    lastMode = mode;
    L = GEO[mode];
    seen = {};
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
