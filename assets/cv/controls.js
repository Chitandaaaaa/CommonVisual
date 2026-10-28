/* ============================================================
   CommonVisual · 播放控制
   分段进度条 + 播放/步进 + 键盘 + 字幕
   与原语无关：只认 steps（{t, text} 数组）和 duration
   ============================================================ */
(function (CV) {
  'use strict';
  var $ = CV.$, h = CV.h, clamp = CV.clamp;

  var ICON_PLAY  = '<svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M7 4.5v15L20 12z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>';

  /**
   * @param {Object} o
   * @param {Array}  o.steps      [{ t: 0~1, text: html }]
   * @param {Number} o.duration   一轮播放时长（ms）
   * @param {Function} o.onFrame  时间变化时回调，用来重绘舞台
   * @param {Element} o.root      可选：组件所在容器。不传就是整页（真页面一直这么用）；
   *                              传了就只在这块里找 play / prev / next / scrub / segs / cap-text，
   *                              也不注册全局键盘 —— 规范页的演示实例就是这么来的。
   * @param {Boolean} o.autoplay  可选：进来就播。不传时**整页实例默认播、容器实例默认不播** ——
   *                              原语页打开即动，规范页的 demo 由 tab 自己决定要不要动。
   */
  CV.createControls = function (o) {
    var steps = o.steps;
    var duration = o.duration || 9000;
    var onFrame = o.onFrame || function () {};
    var root = o.root || document;
    var isPage = root === document;

    /* 页面里是 id，容器里用类名 —— 同一套组件的两种挂法 */
    function q(sel, cls) { return root.querySelector(sel) || (cls && root.querySelector(cls)); }
    var elPlay = q('#play', '.play');
    var elPrev = q('#prev', '.prev');
    var elNext = q('#next', '.next');
    var elScrub = q('#scrub', '.scrub');
    var elSegs = q('#segs', '.segs');
    var elCap = q('#capText', '.cap-text');

    var t = 0, playing = false, rafId = null, lastTs = 0;
    var segFills = [];

    function stepEnd(i) { return i + 1 < steps.length ? steps[i + 1].t : 1; }

    /* 分段条宽度 = 该段真实时长。
       steps[i].t 本身就是「规范时间」的比例（页面按秒拼出时间轴再归一化），
       所以这里按 (下一段 t − 本段 t) 分配宽度，进度条才不会撒谎；
       视觉位置与时间因此等价，vToT / tToV 退化成恒等 —— 滑块拖到哪，时间就是哪。 */
    function tToV(v) { return clamp(v, 0, 1); }
    function vToT(x) { return clamp(x, 0, 1); }

    function buildSegs() {
      var box = elSegs;
      if (!box) return;
      box.innerHTML = '';
      segFills = steps.map(function (s, i) {
        var fill = h('i', '', h('div', 'seg', box));
        var span = stepEnd(i) - s.t;
        box.lastChild.style.flexGrow = String(Math.max(span, 0.001));
        return fill;
      });
    }

    /* 进度条填充 + 字幕 */
    function paintChrome(v) {
      var sc = elScrub;
      if (sc && document.activeElement !== sc) sc.value = String(Math.round(tToV(v) * 1000));

      steps.forEach(function (s, i) {
        var fill = segFills[i];
        if (!fill) return;
        var end = stepEnd(i);
        var r = v <= s.t ? 0 : (v >= end ? 1 : (v - s.t) / (end - s.t));
        fill.style.width = (r * 100).toFixed(2) + '%';
      });

      var si = 0;
      for (var i = 0; i < steps.length; i++) if (v >= steps[i].t) si = i;
      var cap = elCap;
      if (cap) {
        var st = steps[si];
        /* 窄屏一行放不下长句（All-Reduce 那种要塞四个 rank 胶囊的），
           有短版就用短版，没有就照原样渲 —— 截断留给 CSS 兜底 */
        var narrow = window.innerWidth < 860;
        cap.innerHTML = (narrow && st.short) ? st.short : st.text;
      }
    }

    function setPlaying(v) {
      playing = v;
      var btn = elPlay;
      if (btn) {
        btn.innerHTML = v ? ICON_PAUSE : ICON_PLAY;
        btn.setAttribute('aria-label', v ? '暂停' : '播放');
        btn.setAttribute('title', v ? '暂停' : '播放');
      }
      if (v) { lastTs = performance.now(); rafId = requestAnimationFrame(tick); }
      else if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function tick(ts) {
      if (!playing) return;
      var dt = Math.min(ts - lastTs, 80);
      lastTs = ts;
      t += dt / duration;
      if (t >= 1) t = 0;                 /* 循环播放 */
      onFrame(t);
      paintChrome(t);
      rafId = requestAnimationFrame(tick);
    }

    function seek(v) {
      t = clamp(v, 0, 1);
      onFrame(t);
      paintChrome(t);
    }

    /* 时序改了就重排：步骤与总时长都可能变（原语页齿轮调倍数后走这里）。
       保留的是「播到第几毫秒」，不是比例 —— 改了某段时长，位置才有物理意义。 */
    function retime(newSteps, newDur) {
      var ms = t * duration;
      steps = newSteps;
      duration = newDur || duration;
      t = clamp(duration ? ms / duration : 0, 0, 1);
      buildSegs();
      onFrame(t);
      paintChrome(t);
    }

    function bind() {
      var play = elPlay, prev = elPrev, next = elNext, scrub = elScrub;

      if (play) play.addEventListener('click', function () { setPlaying(!playing); });

      if (prev) prev.addEventListener('click', function () {
        setPlaying(false);
        var i = 0;
        for (var k = 0; k < steps.length; k++) if (steps[k].t <= t + 0.001) i = k;
        seek(i > 0 ? steps[i - 1].t + 0.005 : 0);
      });

      if (next) next.addEventListener('click', function () {
        setPlaying(false);
        var target = 1;
        for (var k = 0; k < steps.length; k++) {
          if (steps[k].t > t + 0.004) { target = steps[k].t + 0.005; break; }
        }
        seek(target);
      });

      if (scrub) scrub.addEventListener('input', function (e) {
        setPlaying(false);
        seek(vToT(e.target.value / 1000));
      });

      /* 全局快捷键只属于「整页那一份」；容器实例（规范页演示）绑了会抢走整页的 Space / 方向键 */
      if (!isPage) return;
      document.addEventListener('keydown', function (e) {
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
        if (e.code === 'ArrowRight') { e.preventDefault(); if (next) next.click(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); if (prev) prev.click(); }
        if (e.code === 'KeyR') { setPlaying(false); seek(0); }
      });
    }

    buildSegs();
    bind();
    paintChrome(0);
    /* 进页面就动起来：首帧已经画好了 t=0，这里只负责踩油门 —— 按钮图标也一并切成「暂停」 */
    if (o.autoplay != null ? o.autoplay : isPage) setPlaying(true);

    return {
      seek: seek,
      retime: retime,
      setPlaying: setPlaying,
      toggle: function () { setPlaying(!playing); },
      isPlaying: function () { return playing; },
      t: function () { return t; },
      /* 取当前值（retime 会改它），不要缓存成固定数字 */
      get duration() { return duration; },
      tToV: tToV,
      vToT: vToT,
      paintChrome: paintChrome,
      /* 容器实例销毁：停掉 rAF，否则切 tab 换掉 DOM 后旧循环还在跑 */
      destroy: function () { setPlaying(false); }
    };
  };
})(window.CV = window.CV || {});
