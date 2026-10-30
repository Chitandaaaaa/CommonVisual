/* ============================================================
   CommonVisual v2 · L2 页面块 · head（Bk1 页头：返回 + 标题 + 导语/图例）
   ============================================================ */
(function (CV) {
  'use strict';

  CV.blocks = CV.blocks || {};

  CV.blocks.head = function (o) {
    var hd = document.createElement('header');
    hd.className = 'hd';

    var back = document.createElement('a');
    back.className = 'back';
    back.href = o.backHref || 'index.html';
    back.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">' +
      '<path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      (o.backLabel || '原语关系树');
    hd.appendChild(back);

    var h1 = document.createElement('h1');
    h1.textContent = o.title;
    hd.appendChild(h1);

    if (o.legendHtml) {
      var ul = document.createElement('ul');
      ul.className = 'legend';
      ul.innerHTML = o.legendHtml;
      hd.appendChild(ul);
    }
    if (o.lead) {
      var p = document.createElement('p');
      p.className = 'lead';
      p.textContent = o.lead;
      hd.appendChild(p);
    }
    return hd;
  };
})(window.CV = window.CV || {});
