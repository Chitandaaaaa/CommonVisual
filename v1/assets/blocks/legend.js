/* ============================================================
   CommonVisual v2 · L2 页面块 · legend（Bk2 图例）
   ------------------------------------------------------------
   一整份数据 = 若干个数据块拼成。虚线框 + 白底。
   ============================================================ */
(function (CV) {
  'use strict';
  var el = CV.el;

  CV.blocks = CV.blocks || {};

  CV.blocks.legend = function (parent, o) {
    var c = o.slot;
    var pad = Math.round(c.sw * 0.24);
    var n = o.items.length;
    var totalW = n * c.sw + (n - 1) * c.gap;
    var bw = totalW + pad * 2;
    var bh = c.sh + pad * 2;

    var g = el('g', { class: 'whole' }, parent);

    el('rect', {
      x: o.x, y: o.y, width: bw, height: bh, rx: 14,
      fill: '#ffffff', 'fill-opacity': .72,
      stroke: '#c1cadf', 'stroke-width': 1.5, 'stroke-dasharray': '4 3'
    }, g);

    var blocks = [];
    for (var i = 0; i < n; i++) {
      var bx = o.x + pad + i * (c.sw + c.gap);
      var by = o.y + pad;
      var seg = el('g', { 'data-l': o.items[i].letter }, g);
      el('rect', { x: bx, y: by, width: c.sw, height: c.sh, rx: 8, fill: o.items[i].color }, seg);
      el('text', {
        class: 'slot-tx', x: bx + c.sw / 2, y: by + c.sh / 2,
        /* 与 drawSlot 同一条规则：字母随块高，别让 CSS 决定 */
        'font-size': Math.round(c.sh * 0.33),
        'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff'
      }, seg).textContent = o.items[i].letter;
      blocks.push(seg);
    }
    return { g: g, blocks: blocks, box: { x: o.x, y: o.y, w: bw, h: bh } };
  };
  CV.drawLegend = CV.blocks.legend;
})(window.CV = window.CV || {});
