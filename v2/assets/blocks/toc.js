/* ============================================================
   CommonVisual v2 · L2 页面块 · toc（Bk3 章节索引 + 滚动跟随）
   ------------------------------------------------------------
   layout 的左栏 rail 与 algorithms 的顶部 jump 同一套组件：
   给一份 {id, label} 列表，渲染锚点导航并跟随滚动高亮。
   判定线：视口 30% 高度处，最后一个越过它的区块即当前区块。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.blocks = CV.blocks || {};

  CV.blocks.toc = function (host, items, cls) {
    var nav = document.createElement('nav');
    nav.className = cls || 'jump';
    nav.setAttribute('aria-label', '章节索引');
    nav.innerHTML = items.map(function (n) {
      return '<a href="#' + n.id + '">' + n.label + '</a>';
    }).join('');
    host.appendChild(nav);

    var links = [].slice.call(nav.querySelectorAll('a'));
    var secs = items.map(function (n) { return document.getElementById(n.id); });

    function spy() {
      var line = window.innerHeight * 0.3;
      var cur = secs[0];
      for (var i = 0; i < secs.length; i++) {
        if (secs[i] && secs[i].getBoundingClientRect().top - line <= 0) cur = secs[i];
      }
      links.forEach(function (a) {
        a.classList.toggle('is-on', cur && a.getAttribute('href') === '#' + cur.id);
      });
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { spy(); ticking = false; });
    }, { passive: true });
    window.addEventListener('resize', spy);
    spy();

    return nav;
  };
})(window.CV = window.CV || {});
