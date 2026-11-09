/* ============================================================
   CommonVisual v2 · L2 关系 · nav.mini（N2 页角邻居卡）
   ------------------------------------------------------------
   原语页左上角：当前原语（h1）+ 它在首页树里的直接邻居。
   只画向下和向右两种关系（向上的邻居、向左的箭头一律不画），
   标题恒定占据左上角第一格。
   关系数据读 registry（不再像 v1 那样手抄一份 REL 表）。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.nav = CV.nav || {};

  CV.nav.mini = function (hd, h1, current) {
    var reg = {
      byId: CV.registryById,
      edges: CV.registryEdges
    };
    var me = reg.byId(current);
    if (!me || !hd || !h1) return null;

    /* 出边：down = 同列下一条竖边；side = 横向伙伴 */
    var down = null, side = null;
    reg.edges.forEach(function (e) {
      if (e.from !== current) return;
      if (e.axis === 'v' && !down) down = e.to;
      if (e.axis === 'h' && !side) side = e.to;
    });

    function el(tag, cls, txt) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (txt != null) e.textContent = txt;
      return e;
    }
    function svgEl(tag, attrs) {
      var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    /* 箭头：只有 down 和 right 两种 */
    function arrow(dir) {
      var vert = dir === 'down';
      var s = svgEl('svg', {
        'viewBox': vert ? '0 0 14 16' : '0 0 22 14',
        'width': vert ? 22 : 30,
        'height': vert ? 25 : 19,
        'aria-hidden': 'true',
        'class': 'rel-arrow rel-arrow-' + dir
      });
      var ln, tip;
      if (dir === 'down') {
        ln = 'M7 1.5V10'; tip = 'M3.4 7.2 7 11.6 10.6 7.2';
      } else {
        ln = 'M1.5 7H15'; tip = 'M10.6 3.4 15.6 7 10.6 10.6';
      }
      s.appendChild(svgEl('path', { 'class': 'rel-arrow-ln', 'pathLength': 1, 'd': ln }));
      s.appendChild(svgEl('path', { 'class': 'rel-arrow-hd', 'd': tip }));
      return s;
    }

    function chip(k) {
      var href = reg.byId(k) ? k + '.html' : null;
      var box = el(href ? 'a' : 'span', 'rel-chip' + (href ? '' : ' rel-chip-off'));
      if (href) {
        box.href = href;
        box.title = reg.byId(k).en + ' · ' + reg.byId(k).cn;
      }
      box.appendChild(el('span', 'rel-chip-en', reg.byId(k).en));
      if (!href) box.appendChild(el('span', 'rel-chip-tag', '待实现'));
      return box;
    }

    var map = el('div', 'relmap');
    map.setAttribute('data-rel', current);

    function put(node, col, row) {
      node.style.gridColumn = col;
      node.style.gridRow = row;
      map.appendChild(node);
    }

    var home = el('a', 'rel-now');
    home.href = 'index.html';
    home.title = '回到首页原语树';
    put(home, 1, 1);

    if (side) {
      var sideBox = el('span', 'rel-side');
      sideBox.appendChild(arrow('right'));
      sideBox.appendChild(chip(side));
      put(sideBox, 2, 1);
    }

    if (down) {
      put(arrow('down'), 1, 2);
      put(chip(down), 1, 3);
    }

    hd.replaceChild(map, h1);
    home.appendChild(h1);
    return map;
  };
})(window.CV = window.CV || {});
