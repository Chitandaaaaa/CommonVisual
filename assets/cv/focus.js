/* ============================================================
   CommonVisual · 悬停聚焦 + 点击钉住
   指向某类数据块时，其余同类元素/卡片一起褪色。
   点击数据块可把当前聚焦「钉住」：鼠标移走仍保持，
   再点同一块取消，点别的块改为钉住那一块。
   依赖 DOM 约定：数据块带 data-l="A"，卡片带 data-card="0"
   ============================================================ */
(function (CV) {
  'use strict';

  /**
   * @param {SVGElement} svg
   * @param {Object} o
   * @param {Function} o.keepCards  给定字母，返回要保留颜色的卡片 key 数组
   */
  CV.attachFocus = function (svg, o) {
    var hover = '';          /* 鼠标当前指向的字母 */
    var pinned = '';         /* 被点击钉住的字母（优先于 hover 回落） */
    var applied = '\u0000';  /* 上次写入 DOM 的字母，避免每帧重写 */
    var keep = o.keepCards || function () { return []; };

    /* 鼠标优先：指针在哪就显示哪个；指针离开后回落到钉住的那个 */
    function active() { return hover || pinned; }

    function render(force) {
      var letter = active();

      if (force || letter !== applied) {
        applied = letter;
        if (letter) svg.setAttribute('data-focus', letter);
        else svg.removeAttribute('data-focus');

        var kept = letter ? keep(letter) : [];
        CV.$$('[data-card]', svg).forEach(function (g) {
          var k = Number(g.getAttribute('data-card'));
          if (!letter || kept.indexOf(k) >= 0) g.removeAttribute('data-dim');
          else g.setAttribute('data-dim', '1');
        });
      }

      /* 钉住状态单独暴露，样式层可据此加提示（如外圈） */
      if (pinned) svg.setAttribute('data-pinned', pinned);
      else svg.removeAttribute('data-pinned');
    }

    function letterOf(e) {
      var hit = e.target.closest ? e.target.closest('[data-l]') : null;
      return hit ? hit.getAttribute('data-l') : '';
    }

    svg.addEventListener('pointerover', function (e) {
      var l = letterOf(e);
      if (l === hover) return;
      hover = l;
      render();
    });

    svg.addEventListener('pointerleave', function () {
      if (!hover) return;
      hover = '';
      render();
    });

    /* 点击钉住 / 取消 / 换一块 */
    svg.addEventListener('click', function (e) {
      var l = letterOf(e);
      if (!l) return;
      pinned = (pinned === l) ? '' : l;
      render(true);
    });

    return {
      refresh: function () { render(true); },   /* 舞台重建后调用，恢复置灰状态 */
      current: active,
      pinned: function () { return pinned; }
    };
  };
})(window.CV = window.CV || {});
