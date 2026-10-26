/* ============================================================
   CommonVisual · 原语关系导航（左上角）
   ------------------------------------------------------------
   在页面左上角画出当前原语与它在首页原语树里的直接邻居：
     · 当前原语（h1）就是树里那个节点，点它 → 回首页
     · 下   = 同列下一个（树里箭头一律向下）
     · 横向 = 伙伴（树里箭头一律向右；伙伴在左边时 chip 放左侧、箭头指回来）
   已实现页面的邻居是链接可点击；还没实现的画成静态标签 +「待实现」。

   关系表与 home.html 的原语树严格一致，改树时这里也要同步改。
   ============================================================ */
(function () {
  'use strict';

  /* down = 同列下一个（首页树里纵向箭头永远向下）
     side = { key, dir } 横向伙伴；dir = 箭头方向（right = 当前 → 伙伴，
     left = 伙伴 → 当前，即伙伴在首页树里排在当前左边那一列） */
  var REL = {
    broadcast:     { down: 'scatter',       side: null },
    scatter:       { down: 'gather',        side: null },
    gather:        { down: 'reduce',        side: { key: 'allgather', dir: 'right' } },
    reduce:        { down: null,            side: { key: 'allreduce', dir: 'right' } },
    allgather:     { down: 'allreduce',     side: { key: 'gather',    dir: 'left' } },
    allreduce:     { down: 'reducescatter', side: { key: 'reduce',    dir: 'left' } },
    /* 树下最右一列，左边没有伙伴，只有纵向 */
    reducescatter: { down: 'alltoall',      side: null },
    alltoall:      { up: 'reducescatter',   down: null, side: null }
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

  /* 箭头：dir = down | up | right | left
     down  = 首页树里的纵向箭头（永远向下）
     up    = 同列上一个（只有树下最末一个节点才需要）
     right = 当前原语 → 伙伴
     left  = 伙伴 → 当前原语（伙伴在首页树里排在当前左边时） */
  function arrow(dir) {
    var vert = dir === 'down' || dir === 'up';
    /* 竖向箭头放大到 18×20：下方 chip 用 15px 字号后，原来 14px 的箭头太轻 */
    var s = svgEl('svg', {
      'viewBox': vert ? '0 0 14 16' : '0 0 22 14',
      'width': vert ? 18 : 22,
      'height': vert ? 20 : 14,
      'aria-hidden': 'true',
      'class': 'rel-arrow rel-arrow-' + dir
    });
    var ln, tip;
    if (dir === 'down') {
      ln = 'M7 1.5V10'; tip = 'M3.4 7.2 7 11.6 10.6 7.2';
    } else if (dir === 'up') {
      ln = 'M7 14.5V6'; tip = 'M3.4 8.8 7 4.4 10.6 8.8';
    } else if (dir === 'right') {
      ln = 'M1.5 7H15'; tip = 'M10.6 3.4 15.6 7 10.6 10.6';
    } else {
      ln = 'M20.5 7H7'; tip = 'M11.4 3.4 6.4 7 11.4 10.6';
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
     第 2 行                ↓ 箭头
     第 3 行                下邻居
     某项不存在时对应网格单元留空（高度 0），不留空隙。
     树最末一个节点（All-to-All）没有下邻居，只有上一个 ——
     这时在前面插「↑ 上邻居」两行，总行数变 5。 */
  var rel = REL[key];
  var map = el('div', 'relmap');
  map.setAttribute('data-rel', key);

  function put(node, col, row) {
    node.style.gridColumn = col;
    node.style.gridRow = row;
    map.appendChild(node);
  }

  var row0 = 1;                   /* 当前原语所在行 */

  /* 上邻居：树最末一个节点没有下邻居，只有上一个。
     箭头和 chip 挤在同一行，整体只多占一行 */
  if (rel.up) {
    var up = el('span', 'rel-up');
    up.appendChild(arrow('up'));
    up.appendChild(chip(rel.up));
    put(up, 1, 1);
    row0 = 2;
  }

  /* 当前原语：h1 → 链接首页 */
  var home = el('a', 'rel-now');
  home.href = 'home.html';
  home.title = '回到首页原语树';
  put(home, 1, row0);

  /* 横向伙伴：放在当前原语右边，箭头方向忠实于首页树
     dir=right → 当前 → 伙伴；dir=left → 伙伴 → 当前（伙伴在树里是左邻） */
  if (rel.side) {
    var side = el('span', 'rel-side');
    side.appendChild(arrow(rel.side.dir));
    side.appendChild(chip(rel.side.key));
    put(side, 2, row0);
  }

  /* 下邻居 */
  if (rel.down) {
    put(arrow('down'), 1, row0 + 1);
    put(chip(rel.down), 1, row0 + 2);
  }

  /* 换掉原来 h1 的位置，再把 h1 塞进「当前」链接里 */
  hd.replaceChild(map, h1);
  home.appendChild(h1);
})();
