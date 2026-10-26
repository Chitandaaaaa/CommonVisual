/* ============================================================
   CommonVisual · 组件与动效规范
   ------------------------------------------------------------
   这一页是全站基础组件的「唯一来源」：名字、尺寸、配色都在这里约定。

   版式原则（2026-10-26 改版）：一图胜千表。
   每一节 = 一张真实渲染的图 + 图上的尺寸/颜色标注，
   不写说明段、不铺表格 —— 信息全部落在图上，读图即读规范。

   demo 不手写 SVG —— 直接调 assets/cv/ 里真实的绘制函数
   （CV.drawLegend / CV.drawSlot / CV.setSlot / CV.drawCard），
   保证「规范即实现」：改绘制函数，这一页同时跟着变。

   已定稿的三个基础组件：
     ① 完整数据（whole）  一份 = 4 个数据块
     ② 数据块（slot）     卡里的一个缓冲槽，三态
     ③ rank 卡片（card）  白底 + 彩色标题条 + 角色徽章
   ============================================================ */
(function () {
  'use strict';
  var el = CV.el, h = CV.h, $ = CV.$;

  /* ══════════════════════════════════════════════════════════
     规范数据
     ══════════════════════════════════════════════════════════ */

  /* 一份完整数据 = 4 段，rank 与它持有的那段同色 */
  var DATA = [
    { letter: 'A', color: '#7c3aed', rank: 0 },
    { letter: 'B', color: '#0891b2', rank: 1 },
    { letter: 'C', color: '#059669', rank: 2 },
    { letter: 'D', color: '#d97706', rank: 3 }
  ];
  var SIGMA = '#4c1d95';          /* 归约结果：深紫 */

  /* 宽窄两套几何，一个数字都不允许页面级自定义 */
  var G = {
    desktop: { view: { w: 1130, h: 680 }, card: { w: 300, h: 170 }, slot: { sw: 46, sh: 46, gap: 12 }, hdr: 36, title: 15, badge: 10 },
    narrow:  { view: { w: 380,  h: 720 }, card: { w: 146, h: 126 }, slot: { sw: 25, sh: 25, gap: 5  }, hdr: 28, title: 12.5, badge: 8.5 }
  };

  /* ══════════════════════════════════════════════════════════
     小工具
     ══════════════════════════════════════════════════════════ */

  var app = $('#app');

  function sec(id, no, title, en) {
    var s = h('section', 'sec', app);
    s.id = id;
    var hd = h('div', 'sec-hd', s);
    var t = h('h2', null, hd);
    t.innerHTML = '<span class="sec-no">' + no + '</span>' + title + '<em>' + en + '</em>';
    return s;
  }

  /* 标题行右侧的「桌面 / 窄屏」切换：点了就地重画这一节的图。
     host 可以是 .sec 整节，也可以是节内的 .sub-hd（子块各管各的）。 */
  function addTab(host, render) {
    var hd = host.classList.contains('sub-hd') ? host : host.querySelector('.sec-hd');
    var tab = h('div', 'tab', hd);
    var b1 = h('button', 'on', tab);
    var b2 = h('button', null, tab);
    b1.textContent = '桌面';
    b2.textContent = '窄屏';
    function pick(nr) {
      b1.className = nr ? '' : 'on';
      b2.className = nr ? 'on' : '';
      render(nr);
    }
    b1.onclick = function () { pick(false); };
    b2.onclick = function () { pick(true); };
    pick(false);
  }

  /* 示例面板：里面放一个真实绘制函数渲染的 SVG（1:1 像素） */
  function demo(host, vbW, vbH, aria) {
    var box = h('div', 'demo', host);
    var s = el('svg', {
      viewBox: '0 0 ' + vbW + ' ' + vbH,
      width: vbW, height: vbH,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': aria || ''
    });
    box.appendChild(s);
    /* drawCard / drawPacket 硬编码引用 #fCard / #fGlow / #fTrail，
       每个 demo 自带一份 defs（参数与 gather.html 里的一致） */
    var d = el('defs', {}, s);
    var f = el('filter', { id: 'fCard', x: '-40%', y: '-40%', width: '180%', height: '190%' }, d);
    el('feDropShadow', { dx: 0, dy: 6, stdDeviation: 12, 'flood-color': '#2a3352', 'flood-opacity': '.1' }, f);
    var fg = el('filter', { id: 'fGlow', x: '-90%', y: '-90%', width: '280%', height: '280%' }, d);
    el('feDropShadow', { dx: 0, dy: 0, stdDeviation: 8, 'flood-color': '#1a1f36', 'flood-opacity': '.22' }, fg);
    var ft = el('filter', { id: 'fTrail', x: '-90%', y: '-90%', width: '280%', height: '280%' }, d);
    el('feDropShadow', { dx: 0, dy: 0, stdDeviation: 5, 'flood-color': '#1a1f36', 'flood-opacity': '.14' }, ft);
    return s;
  }

  /* ── SVG 标注：尺寸线 / 引线 / 文字 ── */
  function dimH(s, x1, x2, y, label) {
    var g = el('g', { class: 'dim' }, s);
    el('line', { x1: x1, y1: y, x2: x2, y2: y }, g);
    [x1, x2].forEach(function (x) { el('line', { x1: x, y1: y - 4, x2: x, y2: y + 4 }, g); });
    el('text', { class: 'dim-tx', x: (x1 + x2) / 2, y: y + 14, 'text-anchor': 'middle' }, g)
      .textContent = label;
  }
  function dimV(s, x, y1, y2, label, left) {
    var g = el('g', { class: 'dim' }, s);
    el('line', { x1: x, y1: y1, x2: x, y2: y2 }, g);
    [y1, y2].forEach(function (y) { el('line', { x1: x - 4, y1: y, x2: x + 4, y2: y }, g); });
    el('text', {
      class: 'dim-tx', x: left ? x - 7 : x + 7, y: (y1 + y2) / 2,
      'text-anchor': left ? 'end' : 'start', 'dominant-baseline': 'central'
    }, g).textContent = label;
  }
  /* 虚线引线 + 末端文字 */
  function lead(s, x1, y1, x2, y2, label, anchor) {
    var g = el('g', { class: 'dim' }, s);
    el('path', { d: 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2, fill: 'none', 'stroke-dasharray': '2 2' }, g);
    el('text', {
      class: 'dim-tx', x: x2, y: y2,
      'text-anchor': anchor || 'start', 'dominant-baseline': 'central'
    }, g).textContent = label;
  }
  function capTx(s, x, y, text) {
    el('text', { class: 'cap-tx', x: x, y: y }, s).textContent = text;
  }
  function subTx(s, x, y, text, fill, size, anchor) {
    var a = { class: 'dim-tx', x: x, y: y, 'text-anchor': anchor || 'middle' };
    if (fill) a.fill = fill;
    if (size) a['font-size'] = size;
    el('text', a, s).textContent = text;
  }

  /* 间隙标注：在缝里画一个双向箭头，数字用引线拉到最近的空白。
     12px 的缝放不下字，但箭头本身就说明了「这是两物之间的距离」，
     比延长线干净得多。 */
  function gapH(s, x1, x2, y, lx, ly, label, anchor, yEnd, fs) {
    var C = '#6d28d9';
    var g = el('g', {}, s);
    el('line', { x1: x1, y1: y, x2: x2, y2: y, stroke: C, 'stroke-width': 1.2 }, g);
    el('path', {
      d: 'M ' + x1 + ' ' + y + ' L ' + (x1 + 3.5) + ' ' + (y - 2.4) + ' L ' + (x1 + 3.5) + ' ' + (y + 2.4) + ' Z',
      fill: C
    }, g);
    el('path', {
      d: 'M ' + x2 + ' ' + y + ' L ' + (x2 - 3.5) + ' ' + (y - 2.4) + ' L ' + (x2 - 3.5) + ' ' + (y + 2.4) + ' Z',
      fill: C
    }, g);
    if (yEnd != null) {
      el('line', {
        x1: (x1 + x2) / 2, y1: ly + 4, x2: (x1 + x2) / 2, y2: yEnd,
        stroke: C, 'stroke-width': .8, 'stroke-dasharray': '2 2'
      }, g);
    }
    var t = el('text', {
      class: 'dim-tx', x: lx, y: ly, fill: C, 'font-size': fs || 10.5, 'font-weight': 600,
      'text-anchor': anchor || 'middle'
    }, g);
    t.textContent = label;
  }

  /* 连线路径：两种取控制点的方式，和 gather / allreduce 里逐字一致。
     S 形——控制点与端点同 y，两端切线水平，适合左右错开的卡；
     直线——控制点落在连线上，正对的边退化成直线。off = 法向偏移（双向错开用）。 */
  function wireS(sx, sy, tx, ty, off) {
    var dx = tx - sx, dy = ty - sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return 'M ' + (sx + nx) + ' ' + (sy + ny) +
      ' C ' + (sx + dx * 0.42 + nx) + ' ' + (sy + ny) + ', ' +
              (tx - dx * 0.42 + nx) + ' ' + (ty + ny) + ', ' +
              (tx + nx) + ' ' + (ty + ny);
  }
  function wireL(sx, sy, tx, ty, off) {
    var dx = tx - sx, dy = ty - sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return 'M ' + (sx + nx) + ' ' + (sy + ny) +
      ' C ' + (sx + dx * 0.42 + nx) + ' ' + (sy + dy * 0.42 + ny) + ', ' +
              (tx - dx * 0.42 + nx) + ' ' + (ty - dy * 0.42 + ny) + ', ' +
              (tx + nx) + ' ' + (ty + ny);
  }

  /* ══════════════════════════════════════════════════════════
     01 完整数据
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('whole', '01', '完整数据', 'whole');

    /* 左：一份完整数据（虚线框）；右：归约后的那一块 */
    var M = {
      desktop: { w: 640, h: 200, bx: 50, by: 56, rank: 140, hex: 154, dim: 176,
                 sigX: 396, txX: 456, cap: 82, sub: 98, note: null,
                 fs: 10, fx: 9, gapLab: 40, padLab: 6, arrow: true },
      narrow:  { w: 340, h: 124, bx: 30, by: 30, rank: null, hex: null, dim: 100,
                 sigX: 196, txX: 231, cap: 43, sub: 54, note: 84,
                 fs: 8.5, fx: 8, gapLab: 14, padLab: 4, arrow: false }
    };

    /* 一条细虚线箭头，表示「归约成右边这一块」 */
    function flow(g, x1, x2, y, label, fs) {
      var C = '#b8c0d4';
      el('line', { x1: x1, y1: y, x2: x2, y2: y, stroke: C, 'stroke-width': 1, 'stroke-dasharray': '3 3' }, g);
      el('path', {
        d: 'M ' + x2 + ' ' + y + ' L ' + (x2 - 5) + ' ' + (y - 3) + ' L ' + (x2 - 5) + ' ' + (y + 3) + ' Z',
        fill: C
      }, g);
      if (label) {
        el('text', {
          class: 'dim-tx', x: (x1 + x2) / 2, y: y - 7,
          'text-anchor': 'middle', 'font-size': fs || 9
        }, g).textContent = label;
      }
    }

    function render(nr) {
      var old = s.querySelector('.demo');
      if (old) s.removeChild(old);

      var m = nr ? M.narrow : M.desktop;
      var sl = nr ? G.narrow.slot : G.desktop.slot;
      var pad = Math.round(sl.sw * 0.24);            /* 11 / 6 */
      var bw = 4 * sl.sw + 3 * sl.gap + 2 * pad;     /* 242 / 127 */
      var bh = sl.sh + 2 * pad;                      /* 68 / 37 */
      var g = demo(s, m.w, m.h, '一份完整数据（左）与它的归约结果（右），标出块间距、内边距与整体长宽');

      CV.drawLegend(g, { x: m.bx, y: m.by, slot: sl, items: DATA });

      if (!nr) {
        DATA.forEach(function (d, i) {
          var cx = m.bx + pad + sl.sw / 2 + i * (sl.sw + sl.gap);
          subTx(g, cx, m.rank, 'rank ' + d.rank, d.color, m.fs);
          subTx(g, cx, m.hex, d.color, '#939bb2', m.fx);
        });
      }

      var midY = m.by + pad + sl.sh / 2;
      var gapX = m.bx + pad + sl.sw;
      gapH(g, gapX, gapX + sl.gap, midY, gapX + sl.gap / 2, m.gapLab,
        String(sl.gap), 'middle', midY - 7, m.fs);
      gapH(g, m.bx + bw - pad, m.bx + bw, midY, m.bx + bw + m.padLab, midY + 3,
        String(pad), 'start', null, m.fs);

      /* 长与宽 */
      dimV(g, m.bx - (nr ? 8 : 16), m.by, m.by + bh, String(bh), true);
      dimH(g, m.bx, m.bx + bw, m.dim, String(bw));

      if (m.note) subTx(g, m.bx, m.note, 'A→r0 · B→r1 · C→r2 · D→r3', '#939bb2', m.fs, 'start');

      /* 右侧：归约结果 */
      var sig = CV.drawSlot(g, m.sigX, midY - sl.sh / 2, sl.sw, sl.sh);
      CV.setSlot(sig, { letter: 'Σ', color: SIGMA }, {});
      capTx(g, m.txX, m.cap, '归约结果');
      subTx(g, m.txX, m.sub, nr ? '四卡终态同色' : '四卡终态都是这一块深紫', '#939bb2', m.fs, 'start');

      if (m.arrow) {
        var ax1 = m.bx + bw + 24, ax2 = m.sigX - 12;
        flow(g, ax1, ax2, midY, '归约后', 9);
      } else {
        flow(g, m.bx + bw + 14, m.sigX - 9, midY, null, 9);
      }
    }

    addTab(s, render);
  })();

  /* ══════════════════════════════════════════════════════════
     02 数据块
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('slot', '02', '数据块', 'slot');

    function render(nr) {
      var old = s.querySelector('.demo');
      if (old) s.removeChild(old);

      var sz = nr ? G.narrow.slot.sw : G.desktop.slot.sw;
      var xs = nr ? [40, 82, 124] : [40, 126, 212];
      var capY = 12, topY = 24, labY = topY + sz + 18, dimY = labY + 14;
      /* 说明行要落在尺寸数字之后再留 18px，否则两者会叠在一起 */
      var noteY = dimY + 14 + (nr ? 18 : 20);
      var g = demo(s, 276, nr ? 128 : 152,
        '数据块的三种状态，' + (nr ? '窄屏 25' : '桌面 46') + ' 真实尺寸');

      capTx(g, 40, capY, (nr ? '窄屏 ' : '桌面 ') + sz + ' × ' + sz);

      var slots = xs.map(function (x) { return CV.drawSlot(g, x, topY, sz, sz); });
      CV.setSlot(slots[0], DATA[0], {});
      CV.setSlot(slots[1], null, { active: true });
      CV.setSlot(slots[2], null, {});
      ['有数据', '传输中', '空'].forEach(function (tx, i) {
        subTx(g, slots[i].cx, labY, tx);
      });
      dimH(g, 40, 40 + sz, dimY, String(sz));

      subTx(g, 40, noteY, '块内字母 15px mono 居中 · 状态标签距块 18', '#939bb2', 10, 'start');
    }

    addTab(s, render);
  })();

  /* ══════════════════════════════════════════════════════════
     03 rank 卡片
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('card', '03', 'rank 卡片', 'card');
    var mainBox = h('div', null, s);
    var sub = h('h3', null, s);
    sub.textContent = '徽章 badge · 标题条右上角';
    var badgeBox = h('div', null, s);

    /* 徽章几何，与 CV.drawCard 里的 badgeGeo 同一套规则 */
    function badgeW(role, text, size) {
      if (text) return Math.max(30, Math.round(text.length * size * 0.6) + 18);
      return role === 'dst' ? 30 : 28;
    }

    /* 一行卡头：彩色标题条片段 + 一个徽章，下面标实际宽度 */
    function drawBadges(g, nr) {
      var fs = nr ? 8.5 : 10;
      var hdrH = nr ? 28 : 36;
      var barW = 84, gap = 12, y = 24;
      var items = [{ role: 'src' }, { role: 'dst' }, { text: '0/4' }, { text: '1/4' }, { text: '12/16' }];

      items.forEach(function (it, i) {
        var x = 26 + i * (barW + gap);
        /* 标题条片段：上两角圆、下边平直，和真卡片的 card-bar 同形状 */
        var r = 10;
        el('path', {
          d: 'M ' + x + ' ' + (y + hdrH) + ' L ' + x + ' ' + (y + r) +
             ' A ' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y +
             ' L ' + (x + barW - r) + ' ' + y +
             ' A ' + r + ' ' + r + ' 0 0 1 ' + (x + barW) + ' ' + (y + r) +
             ' L ' + (x + barW) + ' ' + (y + hdrH) + ' Z',
          fill: DATA[0].color
        }, g);

        var w = badgeW(it.role, it.text, fs);
        var bx = x + barW - 14 - w;
        var by = y + (hdrH - 18) / 2;
        el('rect', { x: bx, y: by, width: w, height: 18, rx: 6, fill: 'rgba(255,255,255,.26)' }, g);
        el('text', {
          class: 'dst-badge', x: bx + w / 2, y: by + 9 + fs * 0.3,
          'text-anchor': 'middle', 'font-size': fs, fill: '#fff'
        }, g).textContent = it.text || it.role;

        subTx(g, x + barW / 2, y + hdrH + 16, (it.text || it.role) + ' · ' + w, '#939bb2', 9.5);
      });

      /* 高 18：从第一个徽章的顶边引到条上方 */
      var w0 = badgeW('src', null, fs);
      var x0 = 26 + barW - 14 - w0 / 2;
      lead(g, x0, y + (hdrH - 18) / 2, x0, y - 10, '18', 'middle');

      var noteY = y + hdrH + 38;
      subTx(g, 26, noteY, '右距卡边 14 · 圆角 6 · 底色 26% 白 · 白色 mono', '#939bb2', 9.5, 'start');
      subTx(g, 26, noteY + 14, '有文字时按字数撑宽：max(30, 字数 × 字号 × 0.6 + 18)', '#939bb2', 9.5, 'start');
    }

    /* ── 桌面：两张卡讲结构，第三张讲四块时的间距 ── */
    function drawDesk(g) {
      var cw = G.desktop.card.w, ch = G.desktop.card.h, hdr = G.desktop.hdr;
      var sw = G.desktop.slot.sw, sh = G.desktop.slot.sh;
      var x1 = 132, y = 44;

      capTx(g, x1, 26, 'dst 目标卡 · 描边加深，等着被填');
      capTx(g, 520, 26, 'src 源卡 · 持有自己那一段');

      CV.drawCard(g, {
        key: 0, geo: { x: x1, y: y, w: cw, h: ch }, color: DATA[0].color,
        title: 'rank 0', role: 'dst', target: true,
        hdr: hdr, titleSize: G.desktop.title, badgeSize: G.desktop.badge
      });
      var areaY = y + hdr + (ch - hdr - 16 - sh) / 2;
      CV.setSlot(CV.drawSlot(g, x1 + (cw - sw) / 2, areaY, sw, sh), null, { active: true });

      CV.drawCard(g, {
        key: 1, geo: { x: 520, y: y, w: cw, h: ch }, color: DATA[1].color,
        title: 'rank 1', role: 'src',
        hdr: hdr, titleSize: G.desktop.title, badgeSize: G.desktop.badge
      });
      CV.setSlot(CV.drawSlot(g, 520 + (cw - sw) / 2, areaY, sw, sh), DATA[1], {});

      dimH(g, x1, x1 + cw, 238, String(cw));
      dimV(g, 452, y, y + ch, String(ch));
      dimV(g, 110, y, y + hdr, String(hdr), true);
      dimV(g, 110, y + hdr, y + ch - 16, String(ch - hdr - 16), true);
      lead(g, x1 + cw - 14 - 15, y, x1 + cw - 15, 24, '徽章 30×18', 'middle');
      lead(g, 792, y, 818, 24, '徽章 28×18', 'end');

      /* 四块卡：块间距与四周留白 */
      var bx = 269, by = 310;
      capTx(g, bx, 296, '装四个数据块时 · 块间距与四周留白');

      CV.drawCard(g, {
        key: 2, geo: { x: bx, y: by, w: cw, h: ch }, color: DATA[0].color,
        title: 'rank 0', role: 'dst', target: true,
        hdr: hdr, titleSize: G.desktop.title, badgeSize: G.desktop.badge
      });

      var areaH = ch - hdr - 16;
      var rowW = 4 * sw + 3 * G.desktop.slot.gap;
      var rowX = bx + (cw - rowW) / 2;
      var rowY = by + hdr + (areaH - sh) / 2;
      DATA.forEach(function (d, i) {
        CV.setSlot(CV.drawSlot(g, rowX + i * (sw + G.desktop.slot.gap), rowY, sw, sh), d, {});
      });

      dimV(g, 250, by + hdr, rowY, String((areaH - sh) / 2), true);
      dimV(g, 250, rowY + sh, by + ch, String((areaH - sh) / 2 + 16), true);
      dimH(g, bx, rowX, rowY - 26, String((cw - rowW) / 2));
      dimH(g, rowX, rowX + sw, rowY + sh + 20, String(sw));
      dimH(g, bx, bx + cw, by + ch + 28, String(cw));

      var gapC = rowX + sw + G.desktop.slot.gap / 2;
      gapH(g, rowX + sw, rowX + sw + G.desktop.slot.gap, rowY + sh / 2,
        gapC, rowY - 14, '间距 ' + G.desktop.slot.gap, 'middle', rowY + sh / 2 - 7);
    }

    /* ── 窄屏：卡只有 146 宽，装不下四个块 ── */
    function drawNarrow(g) {
      var cw = G.narrow.card.w, ch = G.narrow.card.h, hdr = G.narrow.hdr;
      var sw = G.narrow.slot.sw;
      var x1 = 60, x2 = 280, y = 44;

      capTx(g, x1, 26, 'dst 目标卡 · 只放一个块');
      capTx(g, x2, 26, 'src 源卡');

      CV.drawCard(g, {
        key: 0, geo: { x: x1, y: y, w: cw, h: ch }, color: DATA[0].color,
        title: 'rank 0', role: 'dst', target: true,
        hdr: hdr, titleSize: G.narrow.title, badgeSize: G.narrow.badge
      });
      CV.drawCard(g, {
        key: 1, geo: { x: x2, y: y, w: cw, h: ch }, color: DATA[1].color,
        title: 'rank 1', role: 'src',
        hdr: hdr, titleSize: G.narrow.title, badgeSize: G.narrow.badge
      });

      var areaY = y + hdr + (ch - hdr - 16 - sw) / 2;
      CV.setSlot(CV.drawSlot(g, x1 + (cw - sw) / 2, areaY, sw, sw), null, { active: true });
      CV.setSlot(CV.drawSlot(g, x2 + (cw - sw) / 2, areaY, sw, sw), DATA[1], {});

      dimV(g, 40, y, y + hdr, String(hdr), true);
      dimV(g, 40, y + hdr, y + ch - 16, String(ch - hdr - 16), true);
      dimH(g, x1, x1 + cw, y + ch + 24, String(cw));
      dimV(g, 240, y, y + ch, String(ch));

      subTx(g, x1, 232, '窄屏一张卡只放一个块：四个块要 115px，内容区只有 114px', '#939bb2', 9, 'start');
    }

    function render(nr) {
      mainBox.innerHTML = '';
      badgeBox.innerHTML = '';
      if (nr) {
        drawNarrow(demo(mainBox, 500, 250, '窄屏 rank 卡片：146×126，一张卡只放一个数据块'));
      } else {
        drawDesk(demo(mainBox, 838, 560, 'rank 卡片结构：dst 目标卡与 src 源卡，以及装四个数据块时的块间距与留白'));
      }
      drawBadges(demo(badgeBox, 520, nr ? 118 : 126, '角色徽章与进度徽章的尺寸'), nr);
    }

    addTab(s, render);
  })();

  /* ══════════════════════════════════════════════════════════
     04 连线与箭头
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('wire', '04', '连线与箭头', 'wire & arrow');

    /* ── 上：一条连线的解剖 ── */
    var A = demo(s, 760, 212, '一条连线的结构：S 形三次贝塞尔、2px 虚线、11px 箭头，标出控制点与切线');
    var dA = A.querySelector('defs');
    CV.drawMarker(dA, 'ahA');

    var sw = G.desktop.slot.sw;
    var sx = 40 + sw, sy = 26 + sw / 2;                 /* 86, 49 */
    var tx = 556, ty = 132 + sw / 2;                    /* 556, 155 */
    var dx = tx - sx;
    var c1x = sx + dx * 0.42, c2x = tx - dx * 0.42;

    var wA = CV.drawWire(A, { d: wireS(sx, sy, tx, ty), markerId: 'ahA' });
    CV.setSlot(CV.drawSlot(A, 40, 26, sw, sw), DATA[0], {});
    CV.setSlot(CV.drawSlot(A, 556, 132, sw, sw), DATA[1], {});

    /* 两条切线 + 两个控制点：曲线为什么是这个形状，全在这四个点上。
       用淡紫画成「构造线」，和灰色的真连线区分开。 */
    var hd = el('g', {}, A);
    el('line', {
      x1: sx, y1: sy, x2: c1x, y2: sy,
      stroke: '#cbbcf7', 'stroke-width': .9, 'stroke-dasharray': '3 3'
    }, hd);
    el('line', {
      x1: c2x, y1: ty, x2: tx, y2: ty,
      stroke: '#cbbcf7', 'stroke-width': .9, 'stroke-dasharray': '3 3'
    }, hd);
    [c1x, c2x].forEach(function (cx, i) {
      el('circle', {
        cx: cx, cy: i ? ty : sy, r: 3,
        fill: '#fff', stroke: '#a78bfa', 'stroke-width': 1.4
      }, hd);
    });

    capTx(A, 40, 16, '源卡右缘');
    /* 引线直接落在曲线上：取曲线中点，不靠算，靠 getPointAtLength */
    var mid = wA.path.getPointAtLength(wA.len * 0.5);
    lead(A, mid.x, mid.y, 321, 30, '线宽 2 · 虚线 8 7 · 端点 round', 'middle');
    lead(A, 556, 148, 610, 92, '箭头 11×11 · 尖端对齐终点', 'start');
    subTx(A, 40, 200, '控制点 = 起点 + 0.42 × 跨距，两端切线水平 → S 形曲线', '#939bb2', 9.5, 'start');

    /* ── 下：四种走线 ── */
    var B = demo(s, 800, 212, '四种走线：S 形曲线、直线、双向成对、双向直连');
    var dB = B.querySelector('defs');
    var PX = [10, 208, 406, 604];
    var CAP = [['S 形', '左右错位'], ['直线', '正对的边'], ['双向成对', '各偏 22'], ['双向直连', '不加箭头']];

    function dot(x, y) { el('circle', { cx: x, cy: y, r: 3.5, fill: '#c3cadb' }, B); }

    /* ① S 形 */
    var x = PX[0];
    CV.drawMarker(dB, 'p1');
    CV.drawWire(B, { d: wireS(x + 40, 56, x + 148, 106), markerId: 'p1' });
    dot(x + 40, 56); dot(x + 148, 106);

    /* ② 直线：端点同样错位，只是控制点换了取法 */
    x = PX[1];
    CV.drawMarker(dB, 'p2');
    CV.drawWire(B, { d: wireL(x + 40, 56, x + 148, 106), markerId: 'p2' });
    dot(x + 40, 56); dot(x + 148, 106);

    /* ③ 双向成对：同一条边上两个方向，法向偏移符号由行进方向自动反转 */
    x = PX[2];
    CV.drawMarker(dB, 'p3a');
    CV.drawMarker(dB, 'p3b');
    CV.drawWire(B, { d: wireS(x + 40, 81, x + 148, 81, 22), markerId: 'p3a' });
    CV.drawWire(B, { d: wireS(x + 148, 81, x + 40, 81, 22), markerId: 'p3b' });
    dot(x + 40, 81); dot(x + 148, 81);
    dimV(B, x + 94, 59, 103, '44');

    /* ④ 双向直连：一条没有方向的边，加箭头会指错一边 */
    x = PX[3];
    CV.drawWire(B, { d: 'M ' + (x + 40) + ' 81 L ' + (x + 148) + ' 81' });
    dot(x + 40, 81); dot(x + 148, 81);

    PX.forEach(function (px, i) {
      capTx(B, px, 150, CAP[i][0]);
      subTx(B, px, 166, CAP[i][1], '#939bb2', 9, 'start');
    });

    subTx(B, 10, 190, '连线颜色取自数据：按段走各段色；整份流取源色（broadcast）或目标色（reduce）；宽窄两套走线一致', '#939bb2', 9.5, 'start');
    subTx(B, 10, 206, '带 data-l 的连线与箭头随聚焦褪色；整份数据的流不带 data-l，但它内部的小方块要带', '#939bb2', 9.5, 'start');
  })();

  /* ══════════════════════════════════════════════════════════
     05 数据包
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('packet', '05', '数据包', 'packet');

    /* ── 上：单色包的解剖 ── */
    h('h3', null, s).textContent = '单色包 .pkt · 一次只搬一段';
    var A = demo(s, 620, 226, '单色数据包：24px 主体 + 两段拖尾，标出退后距离与透明度');
    var dA = A.querySelector('defs');
    CV.drawMarker(dA, 'pk1');

    var wire = CV.drawWire(A, { d: 'M 60 100 H 400', markerId: 'pk1' });
    var pkt = CV.drawPacket(A, { letter: 'B', color: DATA[1].color });
    CV.placePacket(pkt, wire, 0.85);          /* 主体落在 349，拖尾退到 325 / 303 */

    /* 两段拖尾共用一个标签 + 两个引线 */
    subTx(A, 314, 44, '两段拖尾', null, 9.5);
    lead(A, 303, 90, 303, 52, '', 'middle');
    lead(A, 325, 90, 325, 52, '', 'middle');
    subTx(A, 349, 74, '主体', null, 9.5);
    lead(A, 378, 92, 470, 58, '字母 13px 白 · rx 6.5', 'start');

    /* 退后距离：22 + 24 = 46 */
    dimH(A, 303, 325, 134, '22');
    dimH(A, 325, 349, 134, '24');

    subTx(A, 60, 172, '主体 24×24（常量，不随断点变）· 白色 mono 13px · 外发光 fGlow', '#939bb2', 9.5, 'start');
    subTx(A, 60, 192, '拖尾 = 主体的色块缩小再降透明度：20×20×.8 / 16×16×.6，退后 24 / 46px（图上 24 + 22），55% / 28%', '#939bb2', 9.5, 'start');
    subTx(A, 60, 212, '不画底板、不带字母；三段同属一个 .pkt，只有一份 data-l —— 整组一起飞、一起聚焦', '#939bb2', 9.5, 'start');

    /* ── 下：整份包（桌面 / 窄屏两套尺寸，各挂一个 tab） ── */
    var sub = h('div', 'sub-hd', s);
    h('h3', null, sub).textContent = '整份包 .pkt.batch · 一次搬一「份」';
    var body = h('div', 'sub-body', s);

    addTab(sub, function (nr) {
      body.innerHTML = '';
      drawBatch(body, nr);
    });

    function drawBatch(host, nr) {
      var geo = nr ? G.narrow : G.desktop;
      var m = Math.round(geo.slot.sw * 0.44);
      var mg = Math.max(2, Math.round(geo.slot.gap * 0.25));
      var total = DATA.length * m + (DATA.length - 1) * mg;
      var pad = Math.round(m * 0.30);
      var bw = total + pad * 2, bh = m + pad * 2;

      var B = demo(host, 640, 300,
        '整份包：' + (nr ? '窄屏' : '桌面') + ' m = ' + m + '，主体与两段拖尾的尺寸，1:1 真实像素');

      /* 左列拆开画三行：主体 / 拖尾① / 拖尾②，各标各的尺寸 */
      var cx = 200;
      var y1 = 58, y2 = 124, y3 = 180;

      function batchAt(cy) {
        var b = CV.drawPacketBatch(B, geo.slot, DATA);
        b.g.setAttribute('opacity', '1');
        b.g.setAttribute('transform', 'translate(' + cx + ' ' + cy + ')');
        return b;
      }

      var b1 = batchAt(y1);                       /* 主体：白底板 + 字母 */
      b1.t1.setAttribute('opacity', '0');
      b1.t2.setAttribute('opacity', '0');

      var b2 = batchAt(y2);                       /* 拖尾①：只有色块，缩 0.8 */
      b2.head.setAttribute('opacity', '0');
      b2.t1.setAttribute('transform', 'scale(.8)');
      b2.t2.setAttribute('opacity', '0');

      var b3 = batchAt(y3);                       /* 拖尾②：缩 0.6 */
      b3.head.setAttribute('opacity', '0');
      b3.t1.setAttribute('opacity', '0');
      b3.t2.setAttribute('transform', 'scale(.6)');

      var w1 = bw, h1 = bh;
      var w2 = total * 0.8, h2 = m * 0.8;
      var w3 = total * 0.6, h3 = m * 0.6;

      /* 行标题 + 尺寸 */
      [[y1, '主体 · 白底板 + 字母', bw, bh],
       [y2, '拖尾 ① · 缩 0.8 · 48%', w2, h2],
       [y3, '拖尾 ② · 缩 0.6 · 24%', w3, h3]
      ].forEach(function (r) {
        var y = r[0], w = r[2], hh = r[3];
        subTx(B, 32, y - 2, r[1], '#5f6780', 9.5, 'start');
        dimH(B, cx - w / 2, cx + w / 2, y + hh / 2 + 10, String(Math.round(w)));
        dimV(B, cx + w / 2 + 11, y - hh / 2, y + hh / 2, String(Math.round(hh)));
      });

      /* 右：真实叠加 —— 三者同心，拖尾大半被白底板挡住 */
      var ox = 500, oy = 128;
      var ob = batchAt(oy);
      ob.g.setAttribute('transform', 'translate(' + ox + ' ' + oy + ')');
      ob.head.setAttribute('transform', 'translate(0 0)');
      ob.t1.setAttribute('transform', 'translate(-24 0) scale(.8)');
      ob.t2.setAttribute('transform', 'translate(-46 0) scale(.6)');
      /* 只有露出白底板左边的那一小截描轮廓，别让虚线横穿字母 */
      var plateL = ox - bw / 2;
      [[-24, w2, h2], [-46, w3, h3]].forEach(function (t) {
        var x0 = ox + t[0] - t[1] / 2, x1 = Math.min(plateL + 2, ox + t[0] + t[1] / 2);
        el('rect', {
          x: x0, y: oy - t[2] / 2, width: Math.max(3, x1 - x0), height: t[2], rx: 3,
          fill: 'none', stroke: '#8b5cf6', 'stroke-width': 1.2,
          'stroke-dasharray': '3 3', 'stroke-opacity': .95
        }, B);
      });
      subTx(B, ox, 66, '实际飞行 · 三者同心', '#5f6780', 9.5);
      subTx(B, ox, 82, '退后 24 / 46，大半落在白底板后面', '#939bb2', 9, 'middle');

      subTx(B, 32, 238, (nr ? '窄屏 · m = 11（slot 25）' : '桌面 · m = 20（slot 46）') +
        ' · 拖尾尺寸 = 主体数据区（不含底板留白）× 0.8 / 0.6', '#5f6780', 10, 'start');
      subTx(B, 32, 258, '拖尾大半被白底板挡住，它是运动模糊、不是第二份数据；只画色块不画底板，叠起来才不会糊', '#939bb2', 9.5, 'start');
      subTx(B, 32, 276, 'm = 0.44 × slot.sw · mg = max(2, gap/4) · pad = 0.30 × m · 底板 rx = 0.32 × 高 · 字母 = m × 0.55', '#939bb2', 9.5, 'start');
    }
  })();

  /* ══════════════════════════════════════════════════════════
     06 两套尺寸
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('scale', '06', '两套尺寸', 'GEO');
    var s1 = demo(s, 700, 268, '桌面与窄屏两套尺寸并排，1:1 真实像素');
    var D = G.desktop, N = G.narrow;

    capTx(s1, 60, 30, '桌面 · 视口 ≥ 860px');
    capTx(s1, 470, 30, '窄屏 · 视口 < 860px');

    /* 桌面卡：内容区摆 4 个块，块间距 12 */
    var dy = 48;
    CV.drawCard(s1, {
      key: 0, geo: { x: 60, y: dy, w: D.card.w, h: D.card.h }, color: DATA[0].color,
      title: 'rank 0', role: 'dst', target: true,
      hdr: D.hdr, titleSize: D.title, badgeSize: D.badge
    });
    var dAreaY = dy + D.hdr;
    var dAreaH = D.card.h - D.hdr - 16;
    var dTotalW = 4 * D.slot.sw + 3 * D.slot.gap;
    var dX = 60 + (D.card.w - dTotalW) / 2;
    var dY = dAreaY + (dAreaH - D.slot.sh) / 2;
    DATA.forEach(function (d, i) {
      CV.setSlot(CV.drawSlot(s1, dX + i * (D.slot.sw + D.slot.gap), dY, D.slot.sw, D.slot.sh), d, {});
    });

    /* 窄屏卡：只放一个块，展示 25px 的尺寸 */
    var ny = 48;
    CV.drawCard(s1, {
      key: 1, geo: { x: 470, y: ny, w: N.card.w, h: N.card.h }, color: DATA[1].color,
      title: 'rank 1', role: 'src',
      hdr: N.hdr, titleSize: N.title, badgeSize: N.badge
    });
    var nAreaY = ny + N.hdr;
    var nAreaH = N.card.h - N.hdr - 16;
    CV.setSlot(
      CV.drawSlot(s1, 470 + (N.card.w - N.slot.sw) / 2, nAreaY + (nAreaH - N.slot.sh) / 2, N.slot.sw, N.slot.sh),
      DATA[1], {}
    );

    /* 标注：卡 300×170 / 146×126，块 46 / 25，标题条 36 / 28 */
    dimH(s1, 60, 360, 240, '300');
    dimV(s1, 372, ny, ny + D.card.h, '170');
    dimH(s1, 470, 616, 196, '146');
    dimV(s1, 628, ny, ny + N.card.h, '126');
    dimH(s1, dX, dX + D.slot.sw, dY + D.slot.sh + 16, '46');
    dimH(s1, 470 + (N.card.w - N.slot.sw) / 2, 470 + (N.card.w + N.slot.sw) / 2, nAreaY + (nAreaH - N.slot.sh) / 2 + N.slot.sh + 12, '25');
    dimV(s1, 40, dy, dy + D.hdr, String(D.hdr), true);
    dimV(s1, 456, ny, ny + N.hdr, String(N.hdr), true);
  })();

  /* ══════════════════════════════════════════════════════════
     07 施工约定
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('rules', '07', '施工约定', 'rules');

    var ol = h('ol', 'rules', s);
    [
      '尺寸只从本页 <code>GEO</code> 抄。SVG 等比缩放，<b>viewBox 数字越小 → 整页内容越大</b>，改完用 <code>getBoundingClientRect()</code> 量，别凭数字猜。',
      '组件只走 <code>assets/cv/</code> 的绘制函数，不手写 <code>rect</code> / <code>text</code>；要改尺寸改 <code>GEO</code>，不改绘制代码。',
      '断点 860px：<code>&lt; 860</code> 用窄屏一套；切换时重建舞台，再按当前进度重绘。',
      '下标分工：数据块挂 <code>data-l</code>（聚焦），卡片挂 <code>data-card</code>（置灰）。整份数据的连线与箭头不带 <code>data-l</code>，但整份包内部的小方块要带。',
      '新增原语 = 复制 <code>assets/reduce.js</code>，只改 <code>DATA</code> / <code>ROUTE</code> / <code>STEPS</code> / <code>GEO</code>，再加落位那一段。'
    ].forEach(function (x) { h('li', null, ol).innerHTML = x; });

    h('h3', null, s).textContent = '待整改';
    var ul2 = h('ul', 'todo flat', s);
    [
      ['All-Reduce 累加器', '52×52 / 30×30', '应为 46 / 25'],
      ['数据块文字 15px', '.slot-tx 钉死', '应随块高'],
      ['徽章字号 10 / 10.5', 'reduce 与其余页不一致', '统一 10']
    ].forEach(function (x) {
      var li = h('li', null, ul2);
      h('b', null, li).textContent = x[0];
      var code = h('code', null, li);
      code.textContent = x[1];
      h('span', null, li).textContent = x[2];
    });
  })();

  /* ══════════════════════════════════════════════════════════
     08 待补充
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('todo', '08', '待补充', 'roadmap');

    var ul = h('ul', 'todo', s);
    [
      ['落位弹跳', '.slot-pop', '0.55s，不要涟漪环'],
      ['聚焦', 'cv/focus.js', 'hover / pinned'],
      ['控制条', 'cv/controls.js', '段数 = STEPS.length'],
      ['舞台分层', '#lBg … #lLabels', '建场顺序固定'],
      ['计算方框', '.calc-wrap', 'opacity 逐帧写']
    ].forEach(function (x) {
      var li = h('li', null, ul);
      h('b', null, li).textContent = x[0];
      var code = h('code', null, li);
      code.textContent = x[1];
      h('span', null, li).textContent = x[2];
    });
  })();
})();
