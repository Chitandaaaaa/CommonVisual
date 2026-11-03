/* ============================================================
   CommonVisual v2 · L1 运动
   ------------------------------------------------------------
   只做「时间 → 进度」的数学，不碰 DOM：
   · 缓动曲线（easeInOutQuad 在 dom.js；落位过冲曲线在 parts/beat.js 的
     CV.POP_CURVE / CV.beat.popAt —— 全站单源，这里不再有副本）
   · 批内错峰 seatAt
   · 一排↔两排 rowOpen / rowClose / rowSpan（规范 03）
   · 规范秒的记号表 dur()：剧本里写记号，编译时换成秒
   ============================================================ */
(function (CV) {
  'use strict';

  function seg01(T, a, b) { return b <= a ? 1 : CV.clamp((T - a) / (b - a), 0, 1); }
  CV.seg01 = seg01;

  /* 一批块依次落位：第 i 个的时刻 = base + i × 错峰间隔。
     gap 不传读规范 08 的 seatGap；传了就用调用方算好的（如 seatGap × k，
     k 杆缩放后动画与窗口同源）。用「时刻」比 sec，不用 setTimeout ——
     进度条能来回拖，定时器拖不回来。 */
  CV.seatAt = function (i, base, gap) {
    var g = (typeof gap === 'number') ? gap : CV.spec('seatGap');
    return base + i * Math.max(0, g);
  };

  /* ── 一排 ↔ 两排（规范 03）────────────────────────
     开（一排变两排）：卡片绕中心上下变宽 cardDur → 衔接 rowLull → 第二排空块逐块淡入
     收（两排变一排）：第二排从右往左逐块淡出 → 衔接 rowPause → 卡片收回
     「先长够再放块 / 撤完再收卡」两段衔接已入规范 03-calc（2026-11-01 包 C：
     rowLull 0.3 / rowPause 0.25，调试台可调）。 */
  function rowSpec() {
    return { cardDur: CV.spec('cardDur'), blockDur: CV.spec('blockDur'), blockGap: CV.spec('blockGap'),
             lull: CV.spec('rowLull'), pause: CV.spec('rowPause'), preHold: CV.spec('preHold') };
  }

  CV.rowSpan = function (n) {
    var S = rowSpec(), step = S.blockDur + S.blockGap;
    var blocks = (n - 1) * step + S.blockDur;
    /* open 末尾挂 preHold（2026-11-03 新参）：末格显形后停一拍再进下一步，
       预留缓冲与后续动作的衔接不再突兀；close 侧不加（撤完→收卡已有 rowPause） */
    return { open: S.cardDur + S.lull + blocks + S.preHold, close: blocks + S.pause + S.cardDur,
             blocks: blocks, cardDur: S.cardDur, step: step, preHold: S.preHold };
  };

  /* T = 这一步开始以来的秒数。g = 卡片高度进度 0→1，v[i] = 第 i 块的可见度 */
  CV.rowOpen = function (T, n) {
    var S = rowSpec(), step = S.blockDur + S.blockGap, b0 = S.cardDur + S.lull, v = [];
    for (var i = 0; i < n; i++) {
      var s0 = b0 + i * step;
      v.push(CV.easeInOutQuad(seg01(T, s0, s0 + S.blockDur)));
    }
    return { g: CV.easeInOutQuad(seg01(T, 0, S.cardDur)), v: v };
  };

  /* 倒放：块先从右往左逐个撤走，全撤完才收卡片。g = 1→0 */
  CV.rowClose = function (T, n) {
    var S = rowSpec(), step = S.blockDur + S.blockGap;
    var goneAt = (n - 1) * step + S.blockDur, shrinkAt = goneAt + S.pause, v = [];
    for (var i = 0; i < n; i++) {
      var s0 = (n - 1 - i) * step;
      v.push(T <= s0 ? 1 : 1 - CV.easeInOutQuad(seg01(T, s0, s0 + S.blockDur)));
    }
    return { g: 1 - CV.easeInOutQuad(seg01(T, shrinkAt, shrinkAt + S.cardDur)), v: v };
  };

  /* ── 三档卡高与行内边距（统一批次 #5）────────────────────────
     reduce / allreduce / reducescatter 共用一份公式（此前三页各写一份，
     「顶边钉死只往下长」统一时 allreduce 漏改过一回）：
     · h1 单排 → h2 双排（长高增量扣 preWiden：第二排往卡内既有留白里放）
     · h3 双排 + 计算层（calcGap + calc.h + areaPad，由 pad2 精确推导，
       卡底 = 计算框底 + areaPad，不再各自写 -16 类补差）
     · pad1 / pad2 = 单排 / 双排状态下的行顶内边距
     preWiden 取 geo 的 L.preWiden（RS 显式给），没给按模式默认桌面 25 / 窄屏 12。
     纯数学不碰 DOM；调用方拿 h 做 CV.cast.resize、拿 pad 定行顶。 */
  CV.cardGeo = function (L, mode) {
    var s = L.slot;
    var preWiden = (L.preWiden != null) ? L.preWiden : (mode === 'narrow' ? 12 : 25);
    var h1 = L.card.h;
    var pad1 = (h1 - L.hdr - 16 - s.sh) / 2;
    var h2 = h1 + s.sh + L.rowGap - preWiden;
    var pad2 = (h2 - L.hdr - 2 * s.sh - L.rowGap) / 2;
    /* h3 需要计算层参数（L.calc）；没有计算层的页（alltoall 只用 h1/h2）给 null */
    var h3 = L.calc ? L.hdr + pad2 + 2 * s.sh + L.rowGap + L.calcGap + L.calc.h + L.areaPad : null;
    return { h1: h1, h2: h2, h3: h3, pad1: pad1, pad2: pad2 };
  };

  /* ── 规范秒记号表 ──
     剧本（plan 段）里写记号而不是秒数，编译时在这里换成真秒 ——
     规范一改，全站跟着变，剧本不用动。
     编排秒（页面自己的节奏：飞多久、停多久）不进这张表，剧本里直接写数字。 */
  CV.dur = function (key, opt) {
    opt = opt || {};
    var P = opt.parts || 4;
    switch (key) {
      case 'grow':    return CV.spec('growDur');
      case 'hold':    return CV.spec('holdDur');
      case 'shrink':  return CV.spec('shrinkDur');
      case 'pop':     return CV.spec('popDur');
      case 'seatGap': return CV.spec('seatGap');
      case 'blockDur':return CV.spec('blockDur');
      case 'fuse':    return CV.spec('fuseDur');
      case 'gap':     return CV.spec('mergeGap');
      /* 归并窗口 = 逐段折进去的整段，同时是「方框亮着」的那段：不低于 holdDur */
      case 'merge':   return Math.max(CV.dur('fuse') + (P - 1) * CV.dur('gap'), CV.dur('hold'));
      case 'prealloc':return CV.rowSpan(P).open;
      case 'collapse':return CV.rowSpan(P).close;
      default: return 0;
    }
  };
})(window.CV = window.CV || {});
