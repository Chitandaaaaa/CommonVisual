/* ============================================================
   CommonVisual v2 · L1 运动
   ------------------------------------------------------------
   只做「时间 → 进度」的数学，不碰 DOM：
   · 缓动曲线（easeInOutQuad 在 dom.js；落位过冲曲线在这里）
   · 落位弹跳 popOf / 批内错峰 seatAt
   · 一排↔两排 rowOpen / rowClose / rowSpan（规范 03）
   · 规范秒的记号表 dur()：剧本里写记号，编译时换成秒
   ============================================================ */
(function (CV) {
  'use strict';

  function seg01(T, a, b) { return b <= a ? 1 : CV.clamp((T - a) / (b - a), 0, 1); }
  CV.seg01 = seg01;

  /* 落位弹跳曲线：0.35 → 1.16（过冲）→ 1，与 CSS .slot-pop 同一条 cubic-bezier */
  var POP_EASE = CV.cubicBezier(.2, .9, .3, 1.45);
  CV.popOf = function (q) {
    if (q <= 0) return { k: 0.35, o: 0 };
    if (q >= 1) return { k: 1, o: 1 };
    if (q < 0.55) {
      var e = POP_EASE(q / 0.55);
      return { k: 0.35 + (1.16 - 0.35) * e, o: Math.min(1, e) };
    }
    var e2 = POP_EASE((q - 0.55) / 0.45);
    return { k: 1.16 + (1 - 1.16) * e2, o: 1 };
  };

  /* 一批块依次落位：第 i 个的时刻 = base + i × 规范 seatGap。
     用「时刻」比 sec，不用 setTimeout —— 进度条能来回拖，定时器拖不回来。 */
  CV.seatAt = function (i, base) {
    var g = CV.params ? CV.params.get('08-seat', 'seatGap') : undefined;
    if (typeof g !== 'number') g = 0.5;
    return base + i * Math.max(0, g);
  };

  /* ── 一排 ↔ 两排（规范 03）────────────────────────
     开（一排变两排）：卡片绕中心上下变宽 cardDur → 衔接 0.3s → 第二排空块逐块淡入
     收（两排变一排）：第二排从右往左逐块淡出 → 衔接 0.25s → 卡片收回
     「先长够再放块 / 撤完再收卡」两段衔接是页面编排，固定 0.3 / 0.25，不进参数表。 */
  function rowSpec() {
    function g(k, d) {
      var v = CV.params.get('03-card', k);
      return (typeof v === 'number') ? v : d;
    }
    return { cardDur: g('cardDur', 0.8), blockDur: g('blockDur', .4), blockGap: g('blockGap', .15) };
  }

  CV.rowSpan = function (n) {
    var S = rowSpec(), step = S.blockDur + S.blockGap;
    var blocks = (n - 1) * step + S.blockDur;
    return { open: S.cardDur + 0.3 + blocks, close: blocks + 0.25 + S.cardDur,
             blocks: blocks, cardDur: S.cardDur, step: step };
  };

  /* T = 这一步开始以来的秒数。g = 卡片高度进度 0→1，v[i] = 第 i 块的可见度 */
  CV.rowOpen = function (T, n) {
    var S = rowSpec(), step = S.blockDur + S.blockGap, b0 = S.cardDur + 0.3, v = [];
    for (var i = 0; i < n; i++) {
      var s0 = b0 + i * step;
      v.push(CV.easeInOutQuad(seg01(T, s0, s0 + S.blockDur)));
    }
    return { g: CV.easeInOutQuad(seg01(T, 0, S.cardDur)), v: v };
  };

  /* 倒放：块先从右往左逐个撤走，全撤完才收卡片。g = 1→0 */
  CV.rowClose = function (T, n) {
    var S = rowSpec(), step = S.blockDur + S.blockGap;
    var goneAt = (n - 1) * step + S.blockDur, shrinkAt = goneAt + 0.25, v = [];
    for (var i = 0; i < n; i++) {
      var s0 = (n - 1 - i) * step;
      v.push(T <= s0 ? 1 : 1 - CV.easeInOutQuad(seg01(T, s0, s0 + S.blockDur)));
    }
    return { g: 1 - CV.easeInOutQuad(seg01(T, shrinkAt, shrinkAt + S.cardDur)), v: v };
  };

  /* ── 规范秒记号表 ──
     剧本（plan 段）里写记号而不是秒数，编译时在这里换成真秒 ——
     规范一改，全站跟着变，剧本不用动。
     编排秒（页面自己的节奏：飞多久、停多久）不进这张表，剧本里直接写数字。 */
  CV.dur = function (key, opt) {
    opt = opt || {};
    var P = opt.parts || 4;
    switch (key) {
      case 'grow':    return CV.specVal('growDur')   || 0.75;
      case 'hold':    return CV.specVal('holdDur')   || 0.95;
      case 'shrink':  return CV.specVal('shrinkDur') || 0.7;
      case 'pop':     return CV.specVal('popDur')    || 0.55;
      case 'seatGap': return CV.specVal('seatGap')   || 0.5;
      case 'blockDur':return CV.specVal('blockDur')  || 0.4;
      case 'fuse':    return CV.specVal('fuseDur')   || 0.55;
      case 'gap':     return CV.specVal('mergeGap')  || 0.5;
      /* 归并窗口 = 逐段折进去的整段，同时是「方框亮着」的那段：不低于 holdDur */
      case 'merge':   return Math.max(CV.dur('fuse') + (P - 1) * CV.dur('gap'), CV.dur('hold'));
      case 'prealloc':return CV.rowSpan(P).open;
      case 'collapse':return CV.rowSpan(P).close;
      default: return 0;
    }
  };
})(window.CV = window.CV || {});
