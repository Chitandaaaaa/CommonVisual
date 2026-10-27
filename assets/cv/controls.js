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

    /* 分段条是等宽的，但各步时长不等 —— 在「视觉位置」与「时间」之间做互逆换算，
       这样点击位置、填充位置、滑块位置三者一致 */
    function tToV(v) {
      var n = steps.length, k = 0;
      for (var i = 0; i < n; i++) if (v >= steps[i].t) k = i;
      var s = steps[k].t, e = stepEnd(k);
      var r = e > s ? clamp((v - s) / (e - s), 0, 1) : 1;
      return (k + r) / n;
    }
    function vToT(x) {
      var n = steps.length;
      var k = clamp(Math.floor(x * n), 0, n - 1);
      var r = clamp(x * n - k, 0, 1);
      var s = steps[k].t, e = stepEnd(k);
      return s + r * (e - s);
    }

    function buildSegs() {
      var box = elSegs;
      if (!box) return;
      box.innerHTML = '';
      segFills = steps.map(function () { return h('i', '', h('div', 'seg', box)); });
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

    return {
      seek: seek,
      setPlaying: setPlaying,
      toggle: function () { setPlaying(!playing); },
      isPlaying: function () { return playing; },
      t: function () { return t; },
      tToV: tToV,
      vToT: vToT,
      paintChrome: paintChrome,
      /* 容器实例销毁：停掉 rAF，否则切 tab 换掉 DOM 后旧循环还在跑 */
      destroy: function () { setPlaying(false); }
    };
  };
})(window.CV = window.CV || {});
