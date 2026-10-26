/* ============================================================
   CommonVisual · 原语关系导航（左上角）
   ------------------------------------------------------------
   在页面左上角画出当前原语与它在首页原语树里的直接邻居：
     · 当前原语（h1）永远在左上角第一行，点它 → 回首页
     · 下   = 同列下一个（树里箭头一律向下）
     · 右   = 横向伙伴（只画「当前 → 伙伴」这一个方向）
   只保留向下和向右两种关系 —— 向上的邻居、向左的箭头一律不画，
   保证标题恒定占据左上角第一格，任何页面都不会被邻居顶掉。
   已实现页面的邻居是链接可点击；还没实现的画成静态标签 +「待实现」。

   关系表与 home.html 的原语树一致，改树时这里也要同步改。
   ============================================================ */
(function () {
  'use strict';

  /* down = 同列下一个（首页树里纵向箭头永远向下）
     side = 横向伙伴；箭头恒为「当前 → 伙伴」向右 */
  var REL = {
    broadcast:     { down: 'scatter' },
    scatter:       { down: 'gather' },
    gather:        { down: 'reduce',        side: 'allgather' },
    reduce:        {                        side: 'allreduce' },
    allgather:     { down: 'allreduce' },
    allreduce:     { down: 'reducescatter' },
    reducescatter: { down: 'alltoall' },
    /* 树下最末一个：向下没有邻居，向左的 reducescatter 也不再画 */
    alltoall:      {}
  };

  /* 中文名 */
  var CN = {
    broadcast: '广播', scatter: '分散', gather: '收集', reduce: '归约',
    allgather: '全收集', allreduce: '全归约',
    reducescatter: '归约分散', alltoall: '全互换'
  };

  /* 已实现页面的链接；没有的键 = 还没做，只画静态标签 */
  var HREF = {
    broadcast:     'broadcast.html',
    scatter:       'scatter.html',
    gather:        'gather.html',
    reduce:        'reduce.html',
    allgather:     'allgather.html',
    allreduce:     'allreduce.html',
    reducescatter: 'reducescatter.html',
    alltoall:      'alltoall.html'
  };

  var key = document.body.getAttribute('data-rel');
  if (!key || !REL[key]) return;

  var hd = document.querySelector('.hd');
  var h1 = hd && hd.querySelector('h1');
  if (!hd || !h1) return;

  /* ───────────── 小工具 ───────────── */
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

  /* 箭头：只有 down 和 right 两种，与「只保留向下和向右」的规则一致。
     想加别的方向前先想清楚：那会破坏「标题恒在左上角」这个前提。 */
  function arrow(dir) {
    var vert = dir === 'down';
    /* 与 28px 的 chip 字号配套：竖向 22×25、横向 30×19，
       viewBox 不变，等比放大即可 */
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

  /* 邻居标签：能跳转的就是链接，不能跳的就是静态标签 */
  function chip(k) {
    var box = el(HREF[k] ? 'a' : 'span', 'rel-chip' + (HREF[k] ? '' : ' rel-chip-off'));
    if (HREF[k]) {
      box.href = HREF[k];
      box.title = (CN[k] || k) + ' · ' + k;
    }
    box.appendChild(el('span', 'rel-chip-en', k));
    if (!HREF[k]) box.appendChild(el('span', 'rel-chip-tag', '待实现'));
    return box;
  }

  /* ───────────── 组装：2 列 × 3 行 ─────────────
     第 1 行  当前原语 h1  |  → 横向伙伴
     第 2 行                ↓
     第 3 行                下邻居
     标题恒在第 1 行第 1 格 —— 没有上邻居就不需要往上让位。
     某项不存在时对应网格单元留空（高度 0），不留空隙。 */
  var rel = REL[key];
  var map = el('div', 'relmap');
  map.setAttribute('data-rel', key);

  function put(node, col, row) {
    node.style.gridColumn = col;
    node.style.gridRow = row;
    map.appendChild(node);
  }

  /* 当前原语：h1 → 链接首页，永远在左上角第一格 */
  var home = el('a', 'rel-now');
  home.href = 'home.html';
  home.title = '回到首页原语树';
  put(home, 1, 1);

  /* 横向伙伴：放在标题右边，箭头恒为「当前 → 伙伴」 */
  if (rel.side) {
    var side = el('span', 'rel-side');
    side.appendChild(arrow('right'));
    side.appendChild(chip(rel.side));
    put(side, 2, 1);
  }

  /* 下邻居 */
  if (rel.down) {
    put(arrow('down'), 1, 2);
    put(chip(rel.down), 1, 3);
  }

  /* 换掉原来 h1 的位置，再把 h1 塞进「当前」链接里 */
  hd.replaceChild(map, h1);
  home.appendChild(h1);
})();
