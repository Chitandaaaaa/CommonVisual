/* ============================================================
   CommonVisual v2 · L2 关系 · 树装配（首页 #tree）
   ------------------------------------------------------------
   树是 8 节点 8 连线的固定图。位置不手排：从 registry 的 rel[] 边列表
   用固定算法推出与旧页完全相同的行列——
     · 列：竖向链在同一列（步进 2），横向伙伴挂到父列 +2
     · 行：竖向子节点 = 父行 +2；横向子节点 = 父行
   交互：悬停只点亮「从该节点射出」的边；树进视口重播描边动画。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.nav = CV.nav || {};

  /* 行列分配：col/row 都是 CSS grid 的 1 基数字。
     根 = (1,1)；竖边 → 同列、行 +2；横边 → 列 +2、同行。
     后遍历到的节点若已有位置则跳过（All-Reduce 两条入边只挂一次）。 */
  CV.nav.treeLayout = function () {
    var edges = CV.registryEdges;
    var pos = {};
    var placed = {};
    var roots = CV.REG_ORDER.filter(function (id) {
      return !edges.some(function (e) { return e.to === id; });
    });

    function walk(id, col, row) {
      if (placed[id]) return;
      placed[id] = true;
      pos[id] = { col: col, row: row };
      edges.filter(function (e) { return e.from === id; }).forEach(function (e) {
        walk(e.to, e.axis === 'v' ? col : col + 2, e.axis === 'v' ? row + 2 : row);
      });
    }
    /* 每个根各占一条竖链；链的起始行 = 1（第二列的链由横边挂进来，行随父） */
    roots.forEach(function (id) { walk(id, 1, 1); });
    return pos;
  };

  CV.nav.tree = function (host) {
    var registry = {
      order: CV.REG_ORDER,
      edges: CV.registryEdges,
      byId: CV.registryById
    };
    var pos = CV.nav.treeLayout();
    var maxRow = 0, maxCol = 0;
    Object.keys(pos).forEach(function (id) {
      maxRow = Math.max(maxRow, pos[id].row);
      maxCol = Math.max(maxCol, pos[id].col);
    });
    /* 列：链列 = minmax(0,1fr)（第一条链）/ minmax(0,1.14fr)（其余链，稍宽），
       连接列 = 64px；行：节点行 auto，箭头行 34px（与 .conn-v svg 高度同步）。 */
    var cols = [];
    var chainSeen = 0;
    for (var c = 1; c <= maxCol; c++) {
      if (c % 2 === 1) {
        chainSeen += 1;
        cols.push(chainSeen === 1 ? 'minmax(0, 1fr)' : 'minmax(0, 1.14fr)');
      } else {
        cols.push('calc(64px * var(--s))');
      }
    }
    var rows = [];
    for (var r = 1; r <= maxRow; r++) {
      rows.push(r % 2 === 1 ? 'auto' : 'calc(34px * var(--s))');
    }
    host.style.gridTemplateColumns = cols.join(' ');
    host.style.gridTemplateRows = rows.join(' ');

    /* 连线放在两节点之间：竖边占 (col, row+1)，横边占 (col+1, row)。
       描边动画的延迟按先序递增（与旧页同款 0.40 → 0.925s）。 */
    var frags = [];
    var order = [];
    var placedEdges = {};
    registry.edges.forEach(function (e) {
      var key = e.from + '>' + e.to;
      if (placedEdges[key]) return;
      placedEdges[key] = true;
      order.push(e);
    });

    var delay = 0.40, step = 0.075;
    order.forEach(function (e) {
      var fromId = 'n-' + e.from;
      var p = pos[e.from], q = pos[e.to];
      var col = e.axis === 'v' ? p.col : p.col + 1;
      var row = e.axis === 'v' ? p.row + 1 : p.row;
      var div = CV.nav.edge(e, fromId, delay);
      div.style.gridColumn = col;
      div.style.gridRow = row;
      frags.push(div);
      delay += step;
    });
    registry.order.forEach(function (id) {
      var n = CV.nav.node(registry.byId(id));
      n.style.gridColumn = pos[id].col;
      n.style.gridRow = pos[id].row;
      frags.push(n);
    });
    frags.forEach(function (f) { host.appendChild(f); });

    /* ── 交互（与旧首页同款）：悬停点亮出边；进视口重播描边 ── */
    var nodes = [].slice.call(host.querySelectorAll('.node'));
    var conns = [].slice.call(host.querySelectorAll('.conn'));

    function highlight(id) {
      nodes.forEach(function (n) { n.classList.toggle('is-lit', n.id === id); });
      conns.forEach(function (c) {
        c.classList.toggle('is-lit', c.getAttribute('data-from') === id);
      });
    }
    function clearHighlight() {
      nodes.forEach(function (n) { n.classList.remove('is-lit'); });
      conns.forEach(function (c) { c.classList.remove('is-lit'); });
    }
    nodes.forEach(function (n) {
      n.addEventListener('mouseenter', function () { highlight(n.id); });
      n.addEventListener('mouseleave', clearHighlight);
      n.addEventListener('focus', function () { highlight(n.id); });
      n.addEventListener('blur', clearHighlight);
    });

    if ('IntersectionObserver' in window) {
      var played = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting || played) return;
          played = true;
          io.disconnect();
          conns.forEach(function (c) {
            var ln = c.querySelector('.ln'), fl = c.querySelector('.fl'), hd = c.querySelector('.hd');
            [ln, fl, hd].forEach(function (n) {
              if (!n) return;
              n.style.animation = 'none';
              void n.getBoundingClientRect();
              n.style.animation = '';
            });
          });
        });
      }, { threshold: .15 });
      io.observe(host);
    }

    return { pos: pos, nodes: nodes, conns: conns };
  };
})(window.CV = window.CV || {});
