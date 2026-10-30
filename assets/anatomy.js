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
    s.setAttribute('data-title', title);   /* 左侧目录用，别去 DOM 里抠字 */
    var hd = h('div', 'sec-hd', s);
    var t = h('h2', null, hd);
    t.innerHTML = '<span class="sec-no">' + no + '</span>' + title + '<em>' + en + '</em>';
    return s;
  }

  /* 标题行右侧的多选切换：点了就地重画这一节的图。
     host 可以是 .sec 整节，也可以是节内的 .sub-hd（子块各管各的）。
     addTab 是「桌面 / 窄屏」这个最常见的两态，单独的 addTabs 给别的一组标签用。 */
  function addTabs(host, labels, render) {
    var hd = host.classList.contains('sub-hd') ? host : host.querySelector('.sec-hd');
    var tab = h('div', 'tab', hd);
    var btns = labels.map(function (t, i) {
      var b = h('button', null, tab);
      b.textContent = t;
      b.onclick = function () { pick(i); };
      return b;
    });
    function pick(i) {
      btns.forEach(function (b, k) { b.className = k === i ? 'on' : ''; });
      render(i);
    }
    pick(0);
  }

  function addTab(host, render) {
    addTabs(host, ['桌面', '窄屏'], function (i) { render(!!i); });
  }

  /* ── 三个滤镜全站只建一份 ──
     drawCard / drawPacket / drawCalc 里写死了 url(#fCard) / #fGlow / #fTrail，
     所以不能每个 demo 各带一份 defs：本页 22 个 demo 会产生 22 个同 id 的 <filter>
     （非法 HTML，且 url(#fCard) 恒解析到文档里第一个，前一个 demo 被 removeChild
     之后引用会漂到下一个）。改为挂一个 0 尺寸的隐藏 svg 放唯一一份定义，
     参数与 gather.html 逐字一致，观感不变。 */
  (function sharedFilters() {
    var fs = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
    fs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    var d = el('defs', {}, fs);
    var f = el('filter', { id: 'fCard', x: '-40%', y: '-40%', width: '180%', height: '190%' }, d);
    el('feDropShadow', { dx: 0, dy: 6, stdDeviation: 12, 'flood-color': '#2a3352', 'flood-opacity': '.1' }, f);
    var fg = el('filter', { id: 'fGlow', x: '-90%', y: '-90%', width: '280%', height: '280%' }, d);
    el('feDropShadow', { dx: 0, dy: 0, stdDeviation: 8, 'flood-color': '#1a1f36', 'flood-opacity': '.22' }, fg);
    var ft = el('filter', { id: 'fTrail', x: '-90%', y: '-90%', width: '280%', height: '280%' }, d);
    el('feDropShadow', { dx: 0, dy: 0, stdDeviation: 5, 'flood-color': '#1a1f36', 'flood-opacity': '.14' }, ft);
    document.body.appendChild(fs);
  })();

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
    /* 只留空 defs 给 marker / 渐变（它们每次生成的 id 都是唯一的）；
       三个滤镜用上面那份共享的 */
    el('defs', {}, s);
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

  /* 竖向双向箭头：表示「卡片往下长了这么多」，数字用虚线引到旁边空白。
     03 的卡片长高与 07 的计算方框都要说这件事，所以放顶层共用。 */
  function gapV(s, x, y1, y2, lx, ly, label, anchor) {
    var C = '#6d28d9';
    var g = el('g', {}, s);
    el('line', { x1: x, y1: y1, x2: x, y2: y2, stroke: C, 'stroke-width': 1.2 }, g);
    el('path', {
      d: 'M ' + x + ' ' + y1 + ' L ' + (x - 2.4) + ' ' + (y1 + 3.5) + ' L ' + (x + 2.4) + ' ' + (y1 + 3.5) + ' Z',
      fill: C
    }, g);
    el('path', {
      d: 'M ' + x + ' ' + y2 + ' L ' + (x - 2.4) + ' ' + (y2 - 3.5) + ' L ' + (x + 2.4) + ' ' + (y2 - 3.5) + ' Z',
      fill: C
    }, g);
    el('line', {
      x1: x + 2, y1: (y1 + y2) / 2, x2: lx - 4, y2: ly,
      stroke: C, 'stroke-width': .8, 'stroke-dasharray': '2 2'
    }, g);
    el('text', {
      class: 'dim-tx', x: lx, y: ly, fill: C, 'font-size': 10.5, 'font-weight': 600,
      'text-anchor': anchor || 'middle'
    }, g).textContent = label;
  }

  /* ── 动画三件套 ──
     easeIO：所有「长高 / 淡入」都走这一条，别每节自己造一条缓动。
     seg：把绝对时间切成 0~1 的段落。
     anim：循环驱动，返回 stop —— 切 tab 前必须停掉，
           否则旧 rAF 会继续对已经脱离文档的节点写属性（05 的飞行图踩过）。 */
  function easeIO(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  }
  function seg(t, a, b) {
    return t <= a ? 0 : t >= b ? 1 : (t - a) / (b - a);
  }
  function anim(ms, fn) {
    var t0 = performance.now(), id = 0, dead = false, span = ms / 1000;
    function tick(now) {
      if (dead) return;
      fn(((now - t0) / 1000) % span);
      id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return function () { dead = true; cancelAnimationFrame(id); };
  }
  /* 逐帧挪一个块：只改 y（x 与尺寸不变），文字跟着走 */
  function moveSlotY(sl, y) {
    sl.y = y;
    sl.cy = y + sl.h / 2;
    sl.rect.setAttribute('y', y);
    sl.text.setAttribute('y', sl.cy);
    return sl;
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

      /* 右侧：归约结果 —— 规范 09 的标记法：Σ + 下标列字母 + 上标已折进份数。
         这里拿 A 列做代表：四张卡各出一份 A，折进 4 份。 */
      var sig = CV.drawSlot(g, m.sigX, midY - sl.sh / 2, sl.sw, sl.sh);
      CV.setSlot(sig, { letter: 'Σ', sub: 'A', count: 4, color: SIGMA }, {});
      capTx(g, m.txX, m.cap, '归约结果');
      subTx(g, m.txX, m.sub, nr ? 'Σᴀ⁴ · 四卡终态同色' : '四份相加 · 四卡终态都是这一块深紫', '#939bb2', m.fs, 'start');

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
      /* 说明行要落在尺寸数字之后再留 18px，否则两者会叠在一起。
         画布只有 276 宽，一句写完要 293px —— 右端会被画布裁掉，所以拆两行。 */
      var noteY = dimY + 14 + (nr ? 18 : 20);
      var g = demo(s, 276, nr ? 140 : 166,
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

      subTx(g, 40, noteY, '块内字母 ' + Math.round(sz * 0.33) + 'px = 0.33 × 块高，mono 居中', '#939bb2', 10, 'start');
      subTx(g, 40, noteY + 14, '状态标签距块 18（三态同尺寸）', '#939bb2', 10, 'start');
    }

    addTab(s, render);
  })();

  /* ══════════════════════════════════════════════════════════
     03 rank 卡片
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('card', '03', 'rank 卡片', 'card');
    var mainBox = h('div', null, s);
    var cp = function (k) { return CV.params.get('03-card', k); };   /* 卡片动态参数：卡片伸缩 / 单块时长 / 块间隔 */

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

    /* ── 动态拆成两个场景：一排变两排 / 两排变一排 ──
       两场景共用同一组几何（与桌面结构、reduce.js 完全一致）：
       h1 = 170（单排）→ h2 = 203（两排），绕中心上下各让 16.5，宽度 300 不变。
       尺寸标注只在一排变两排那一场景画全套，两排变一排不再重复（标注一次就够了）。 */
    function growGeom() {
      var cw = G.desktop.card.w, hdr = G.desktop.hdr;
      var sw = G.desktop.slot.sw, gap = G.desktop.slot.gap, rowGap = 12;
      var h1 = G.desktop.card.h, h2 = h1 + sw + rowGap - 25;      /* 203 */
      var x = 200, top2 = 104, mid = top2 + h2 / 2;
      var off1 = hdr + (h1 - hdr - 16 - sw) / 2;                  /* 单排居中：72 */
      var off2 = hdr + (h2 - hdr - 2 * sw - rowGap) / 2;           /* 两排第一排：67.5 */
      var rowW = 4 * sw + 3 * gap, rowX = x + (cw - rowW) / 2;
      return { cw: cw, hdr: hdr, sw: sw, gap: gap, rowGap: rowGap,
               h1: h1, h2: h2, x: x, top2: top2, mid: mid,
               off1: off1, off2: off2, rowX: rowX };
    }

    /* 起手式：卡片 + 两排（上排实数据，下排空槽预备），返回要动的部件。
       annotate=true 才画尺寸标注全套（只在一排变两排用，避免两场景重复标）。 */
    function growStage(A, G2, annotate) {
      var card = CV.drawCard(A, {
        key: 0, geo: { x: G2.x, y: G2.top2, w: G2.cw, h: G2.h2 }, color: DATA[0].color,
        title: 'rank 0', role: 'dst', target: true,
        hdr: G2.hdr, titleSize: G.desktop.title, badgeSize: G.desktop.badge
      });
      var row1 = [], row2 = [];
      for (var i = 0; i < 4; i++) {
        var s1 = CV.drawSlot(A, G2.rowX + i * (G2.sw + G2.gap), G2.top2 + G2.off2, G2.sw, G2.sw);
        CV.setSlot(s1, DATA[i], {});
        row1.push(s1);
        var s2 = CV.drawSlot(A, G2.rowX + i * (G2.sw + G2.gap), G2.top2 + G2.off2 + G2.sw + G2.rowGap, G2.sw, G2.sw);
        CV.setSlot(s2, null, {});   /* 空数据块：灰底虚线空槽，不是传输中占位 */
        s2.g.style.opacity = '0';
        row2.push(s2);
      }
      if (annotate) {
        capTx(A, 30, 26, G2.h1 + ' → ' + G2.h2 + '：加第二排空槽，卡片长高 ' + (G2.h2 - G2.h1) +
          '（上下各 ' + (G2.h2 - G2.h1) / 2 + '，中心不动）');
        /* 中心线：只在卡片外面那两截 —— 穿进卡里会横切数据块 */
        [[30, G2.x], [G2.x + G2.cw, 570]].forEach(function (r) {
          el('line', { x1: r[0], y1: G2.mid, x2: r[1], y2: G2.mid, stroke: '#dfe4ef', 'stroke-width': 1, 'stroke-dasharray': '6 5' }, A);
        });
        subTx(A, 30, G2.mid - 7, '中心线（全程不动）', '#b9c0d2', 9.5, 'start');
        /* 起止两态的卡边：上边 −16.5、下边 +16.5，箭头画在卡片左侧空白 */
        var top1 = G2.mid - G2.h1 / 2, bot1 = G2.mid + G2.h1 / 2, bot2 = G2.mid + G2.h2 / 2;
        [G2.top2, top1, bot1, bot2].forEach(function (yy) {
          el('line', { x1: 178, y1: yy, x2: G2.x, y2: yy, stroke: '#d7c7fb', 'stroke-width': 1, 'stroke-dasharray': '2 2' }, A);
        });
        [[G2.top2, top1, '-' + (G2.h2 - G2.h1) / 2], [bot1, bot2, '+' + (G2.h2 - G2.h1) / 2]].forEach(function (r) {
          var y1 = Math.min(r[0], r[1]), y2 = Math.max(r[0], r[1]), ax = 174, C = '#6d28d9';
          el('line', { x1: ax, y1: y1 + 3.5, x2: ax, y2: y2 - 3.5, stroke: C, 'stroke-width': 1.2 }, A);
          el('path', { d: 'M ' + ax + ' ' + y1 + ' L ' + (ax - 2.6) + ' ' + (y1 + 4) + ' L ' + (ax + 2.6) + ' ' + (y1 + 4) + ' Z', fill: C }, A);
          el('path', { d: 'M ' + ax + ' ' + y2 + ' L ' + (ax - 2.6) + ' ' + (y2 - 4) + ' L ' + (ax + 2.6) + ' ' + (y2 - 4) + ' Z', fill: C }, A);
          subTx(A, 166, (y1 + y2) / 2 + 3.5, r[2], C, 10.5, 'end');
        });
      } else {
        capTx(A, 30, 26, '反过来：先逐块撤掉第二排空槽（空数据块），再收回卡片 —— 高度数字见「一排变两排」');
      }
      return { card: card, row1: row1, row2: row2 };
    }

    /* 场景一：一排变两排。
       串行两步：① 卡片先上下变宽（中心不动）；② 再让第二排空槽逐块出现。
       两块之间留间隔，绝不边宽边加。下排空槽 = 空数据块（不带数据色）。
       时序全部走 03-card 参数注册表（卡片伸缩 / 单块时长 / 块间隔），由调试台实时调。 */
    function drawSplit(host) {
      var G2 = growGeom();
      var A = demo(host, 660, 372,
        '一排变两排：卡片先上下变宽，再让第二排的空数据块逐块出现，块间留间隔');
      var st = growStage(A, G2, true);
      var card = st.card, row1 = st.row1, row2 = st.row2;
      var step = el('text', { class: 'dim-tx', x: 30, y: 346, 'text-anchor': 'start', fill: '#5f6780', 'font-size': 10.5 }, A);

      var cardDur = cp('cardDur'), blockDur = cp('blockDur'), blockGap = cp('blockGap');
      var bStep = blockDur + blockGap;
      var bStart = cardDur + 0.3;                 /* ① 长够后再开始放块（衔接 0.3s，页面编排，不进调试台） */
      var lastEnd = bStart + 3 * bStep + blockDur;
      return anim(5000, function (T) {
        var g2 = T < cardDur ? easeIO(seg(T, 0, cardDur)) : 1;  /* ① 卡片上下变宽 */
        var h = G2.h1 + (G2.h2 - G2.h1) * g2;
        var top = G2.mid - h / 2;
        CV.resizeCard(card, { x: G2.x, y: top, w: G2.cw, h: h });

        var r1y = top + G2.off1 + (G2.off2 - G2.off1) * g2;
        var r2y = r1y + G2.sw + G2.rowGap;
        row1.forEach(function (sl) { moveSlotY(sl, r1y); });

        /* ② 第二排空槽逐块出现（串行：卡片长够后才开始）。空数据块只靠透明度现身 */
        row2.forEach(function (sl, k) {
          var p = easeIO(seg(T, bStart + k * bStep, bStart + k * bStep + blockDur));
          moveSlotY(sl, r2y);
          sl.g.style.opacity = p.toFixed(3);
        });

        var label;
        if (T < cardDur) label = '① 卡片上下变宽（中心不动，上下各 ' + (G2.h2 - G2.h1) / 2 + '）';
        else if (T < bStart) label = '① 空间到位 · h2 = ' + G2.h2 + '，第二排还是空槽';
        else if (T < lastEnd) label = '② 第二排空槽逐块出现（空数据块，块间留间隔）';
        else label = '② 两排就位 · h2 = ' + G2.h2 + '（上下各 ' + (G2.h2 - G2.h1) / 2 + '）';
        step.textContent = label;
      });
    }

    /* 场景二：两排变一排（场景一的倒放）。
       串行两步：① 第二排空槽先逐块消失（从右往左）；② 卡片再收回单排。
       尺寸标注已在场景一给过，这里不重复。时序同样走 03-card 参数注册表。 */
    function drawMerge(host) {
      var G2 = growGeom();
      var A = demo(host, 660, 372,
        '两排变一排：第二排空槽先逐块消失，卡片再收回单排（高度见上一场景）');
      var st = growStage(A, G2, false);
      var card = st.card, row1 = st.row1, row2 = st.row2;
      var step = el('text', { class: 'dim-tx', x: 30, y: 346, 'text-anchor': 'start', fill: '#5f6780', 'font-size': 10.5 }, A);

      var cardDur = cp('cardDur'), blockDur = cp('blockDur'), blockGap = cp('blockGap');
      var bStep = blockDur + blockGap;
      var bStart = 0.3;                            /* ① 先撤块（衔接 0.3s） */
      var goneAt = bStart + 3 * bStep + blockDur;   /* 4 块全撤完的时刻 */
      var shrinkAt = goneAt + 0.25;                 /* ② 块撤完再收卡（衔接 0.25s） */
      function vis(k, T) {
        var s0 = bStart + (3 - k) * bStep;          /* 从右往左：k=3 先走 */
        return T < s0 ? 1 : (T >= s0 + blockDur ? 0 : 1 - easeIO(seg(T, s0, s0 + blockDur)));
      }
      return anim(5000, function (T) {
        /* ② 卡片收回：等空槽全撤完再开始（串行，不重叠） */
        var g2 = T < shrinkAt ? 1 : (T >= shrinkAt + cardDur ? 0 : 1 - easeIO(seg(T, shrinkAt, shrinkAt + cardDur)));
        var h = G2.h1 + (G2.h2 - G2.h1) * g2;
        var top = G2.mid - h / 2;
        CV.resizeCard(card, { x: G2.x, y: top, w: G2.cw, h: h });

        var r1y = top + G2.off1 + (G2.off2 - G2.off1) * g2;
        var r2y = r1y + G2.sw + G2.rowGap;
        row1.forEach(function (sl) { moveSlotY(sl, r1y); });
        row2.forEach(function (sl, k) {
          var v = vis(k, T);
          moveSlotY(sl, r2y);
          sl.g.style.opacity = v.toFixed(3);
        });

        var label;
        if (T < goneAt - 0.01) label = '① 第二排空槽逐块消失（空数据块）';
        else if (T < shrinkAt) label = '① 空槽已撤完，卡片还停在两排';
        else if (T < shrinkAt + cardDur) label = '② 卡片收回，变回单排';
        else label = '② 单排就位（高度见上一场景）';
        step.textContent = label;
      });
    }

    var curStop = null;

    /* 结构：桌面 / 窄屏（静态，不带动画） */
    function renderStr(i) {
      if (curStop) { curStop(); curStop = null; }
      var nr = i === 1;
      mainBox.innerHTML = '';
      if (nr) drawNarrow(demo(mainBox, 500, 250, '窄屏 rank 卡片：146×126，一张卡只放一个数据块'));
      else drawDesk(demo(mainBox, 838, 560, 'rank 卡片结构：dst 目标卡与 src 源卡，以及装四个数据块时的块间距与留白'));
    }
    addTabs(s, ['桌面', '窄屏'], renderStr);

    /* 徽章 badge：与时间无关，按桌面画一次 */
    var sub = h('h3', null, s);
    sub.textContent = '徽章 badge · 标题条右上角';
    var badgeBox = h('div', null, s);
    drawBadges(demo(badgeBox, 520, 126, '角色徽章与进度徽章的尺寸'), false);

    /* 动态：拆成两个场景，各自独立播放 */
    var dynSub = h('div', 'sub-hd', s);
    h('h3', null, dynSub).textContent = '动态 · 卡片长高与数据块增减';
    var dynBox = h('div', null, s);
    var stopDyn = null, dynMode = 0;
    function renderDyn(i) {
      dynMode = i;
      if (stopDyn) { stopDyn(); stopDyn = null; }
      dynBox.innerHTML = '';
      if (i === 0) stopDyn = drawSplit(dynBox);
      else stopDyn = drawMerge(dynBox);
    }
    addTabs(dynSub, ['一排变两排', '两排变一排'], renderDyn);

    /* 参数调试台改了「卡片动态」任意键（或重置全部）→ 停掉旧 rAF、重建 demo，实时生效。
       守纪律：重画前必 cancelAnimationFrame，否则多几条循环叠着跑。 */
    CV.params.onChange(function (ch) {
      if ((ch.section === '03-card' || ch.section === '*') && stopDyn) {
        stopDyn(); stopDyn = null;
        dynBox.innerHTML = '';
        stopDyn = dynMode === 0 ? drawSplit(dynBox) : drawMerge(dynBox);
      }
    });
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
    /* 引线只有 150px 可写（610 → 760），文案必须压在 ~125px 内，长句会出界 */
    lead(A, 556, 148, 610, 92, '箭头 11×11 · 尖端接住线端', 'start');
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

    /* ── 下二：动态 · 数据包怎么飞（单个 / 两个 / 四个 / 曲线） ──
       两种语义，别混：
       「单个 / 曲线」是一个 24×24 的单色包；
       「两个 / 四个」是**一份数据有几个块** —— 白底板把 2 块 / 4 块收成**一个**整份包，
       整份一起走一条线、一个落点，不是拆成 2 条 / 4 条线各飞一次。
       动的是真页面的那套：CV.placePacket 按「弧长」取点摆主体，
       两段拖尾沿同一条路径往回退 24 / 46 —— 曲线模式下拖尾会跟着拐弯。 */
    var subFly = h('div', 'sub-hd', s);
    h('h3', null, subFly).textContent = '动态 · 数据包怎么飞';
    var flyBody = h('div', 'sub-body', s);
    var stopFly = null;
    var flyMode = 0;

    addTabs(subFly, ['单个', '两个', '四个', '曲线'], function (mode) {
      flyMode = mode;
      if (stopFly) { stopFly(); stopFly = null; }   /* 先停旧的 rAF，否则切几次 tab 就多几条循环 */
      flyBody.innerHTML = '';
      stopFly = drawFly(flyBody, mode);
    });

    /* 参数调试台改了「数据包·动态」任意键（或重置全部）→ 停掉旧 rAF、重建 demo，实时生效。
       守纪律：切 tab / 重画前必 cancelAnimationFrame，否则多几条循环叠着跑。 */
    CV.params.onChange(function (ch) {
      if ((ch.section === '05-packet' || ch.section === '*') && stopFly) {
        stopFly(); stopFly = null;
        flyBody.innerHTML = '';
        stopFly = drawFly(flyBody, flyMode);
      }
    });

    function drawFly(host, mode) {
      var curved = mode === 3;
      var batch = mode === 1 || mode === 2;                 /* 整份包：2 块 / 4 块装在同一个包里 */
      var items = mode === 1 ? DATA.slice(0, 2) : mode === 2 ? DATA.slice() : [DATA[0]];

      var SX = 118, TX = 542, CY = 132, VH = 218;
      var SW = G.desktop.slot.sw, SG = G.desktop.slot.gap;
      /* 与 drawPacketBatch 内部同一组公式：m = .44×slot · mg = max(2, gap/4) · pad = .30×m */
      var m = Math.round(SW * 0.44);
      var mg = Math.max(2, Math.round(SG * 0.25));
      var pad = Math.round(m * 0.30);
      var tot = items.length * m + (items.length - 1) * mg;
      var bw = tot + pad * 2, bh = m + pad * 2;
      /* 终点没有框：包中心落在线端的箭头上，然后就化开 ——
         落位弹跳是另一节（08）讲的事，两条动效别混在一个图里 */
      var half = 12;                                         /* 包主体半宽（单色包 24） */

      var A = demo(host, 660, VH, batch
        ? '整份数据包的移动：' + items.length + ' 块装在同一个白底板里，整份一起飞到目标'
        : '数据包沿连线飞行：单个包，' + (curved ? '曲线路径' : '直线路径'));
      var defs = A.querySelector('defs');

      var x0 = SX + (batch ? bw / 2 : half);
      var x1 = TX;                                           /* 线端就是落点，箭头指着包心 */
      var dPath = curved
        ? 'M ' + x0 + ' ' + CY + ' C 232 ' + (CY - 74) + ', 428 ' + (CY + 74) + ', ' + x1 + ' ' + CY
        : 'M ' + x0 + ' ' + CY + ' H ' + x1;

      CV.drawMarker(defs, 'fly0');
      /* 一条路径同时用来画和取点：包中心正好停在箭头尖上 */
      var w = CV.drawWire(A, { d: dPath, markerId: 'fly0' });
      var marker = defs.querySelector('#fly0 path');

      var src = null, pkt = null;

      if (batch) {
        /* 源端给一个和包同尺寸的虚线框：46 的槽根本装不下「一份」 */
        el('rect', {
          x: SX - bw / 2, y: CY - bh / 2, width: bw, height: bh, rx: 10,
          fill: '#fff', stroke: '#e3e7f0', 'stroke-width': 1.3, 'stroke-dasharray': '4 3'
        }, A);
        /* 源端常驻一份，表示「这里有一份待发」；起飞时藏起来，这一轮结束再长回来 */
        src = CV.drawPacketBatch(A, G.desktop.slot, items);
        src.head.setAttribute('transform', 'translate(' + SX + ' ' + CY + ')');
        src.t1.setAttribute('opacity', '0');
        src.t2.setAttribute('opacity', '0');
        src.g.setAttribute('opacity', '1');

        pkt = CV.drawPacketBatch(A, G.desktop.slot, items);
      } else {
        var s0 = CV.drawSlot(A, SX - SW / 2, CY - SW / 2, SW, SW);
        CV.setSlot(s0, DATA[0], {});
        pkt = CV.drawPacket(A, { letter: DATA[0].letter, color: DATA[0].color });
      }

      /* 整份包不按字母染色：它代表「一份数据」，染成 A 的紫会被读成只传了 A */
      var WIRE_C = batch ? '#8b93a6' : DATA[0].color;

      function setWire(state) {
        var c = w.path;
        if (state === 'fly') {
          c.setAttribute('stroke', WIRE_C);
          c.setAttribute('stroke-width', '2.6');
          c.setAttribute('stroke-dasharray', '9 7');
          c.setAttribute('opacity', '1');
          marker.setAttribute('fill', WIRE_C);
        } else if (state === 'done') {
          c.setAttribute('stroke', WIRE_C);
          c.setAttribute('stroke-width', '1.8');
          c.setAttribute('stroke-dasharray', '9 7');
          /* dashoffset 不在这里归零：停在落点那一刻，虚线才不会在包底下回跳 */
          c.setAttribute('opacity', '.45');
          marker.setAttribute('fill', WIRE_C);
        } else {
          c.setAttribute('stroke', '#c3cadb');
          c.setAttribute('stroke-width', '2');
          c.setAttribute('stroke-dasharray', '8 7');
          c.setAttribute('stroke-dashoffset', '0');
          c.setAttribute('opacity', '1');
          marker.setAttribute('fill', '#c3cadb');
        }
      }

      /* 时间轴与拖尾全部走参数注册表（CV.params），由调试台实时调 / 锁：
         packDur 飞行 / packFade 送达淡出（同时就是「停留」）/ packLead 起步让出。
         一轮 = 飞 + 淡，没有额外的停留段 —— 包淡完，这一趟就结束了，立刻下一轮。 */
      var P = function (k) { return CV.params.get('05-packet', k); };
      var DUR = P('packDur'), FADE = P('packFade');
      var CYCLE = DUR + FADE;
      /* 起步让出一小段：整份包的左缘本来就贴着线起点，几乎不用让；
         单色 / 曲线包按 packLead 取让出量（封顶 18/路径长），整份包维持原微小让出 */
      var lead = batch ? 0.015 : Math.min(P('packLead'), 18 / w.len);
      var t0 = performance.now(), raf = 0;

      /* 到终点只有一个动作：慢慢淡掉。
         包中心正好压在箭头尖上，不 setSlot、不 spawnPulse、也不留框 */
      function frame(now) {
        var sec = ((now - t0) / 1000) % CYCLE;

        if (sec < DUR) {                                 /* 飞行中 */
          pkt.g.setAttribute('opacity', '1');
          var e = CV.easeInOutQuad(sec / DUR);
          e = lead + e * (1 - lead);
          CV.placePacket(pkt, w, e);
          setWire('fly');
          if (batch) src.g.setAttribute('opacity', '0');
        } else {                                         /* 落到箭头尖上，淡掉 = 这一趟结束 */
          CV.placePacket(pkt, w, 1);
          var f = FADE > 0 ? (sec - DUR) / FADE : 1;
          pkt.g.setAttribute('opacity', f >= 1 ? '0' : (1 - f).toFixed(3));
          setWire('done');
          /* setWire 会把 dashoffset 归零，虚线在落点处回跳一下很难看 —— 停在落点那一刻 */
          w.path.setAttribute('stroke-dashoffset', '-110');
          /* 包已在终点淡，源端那份重新长出来（待发状态常驻，循环里没有空歇） */
          if (batch) src.g.setAttribute('opacity', f > 0.2 ? '1' : '0');
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      /* 说明文字跟着模式换 —— 每种模式想讲的其实是同一件事的不同侧面 */
      var tips = [
        '一个 .pkt = 主体 24×24 + 两段拖尾，按弧长取点前进（easeInOutQuad，单程 ' + DUR + 's）',
        '一份数据 2 块：白底板把它们收成『一个』包，整份一起走 —— 不是两块各飞一条线',
        '一份数据 4 块：底板宽 = 4×20 + 3×3 + 两侧 6 = 101，块越多包越长，仍然只走一条线',
        '路径随便弯：位置与拖尾都按弧长在路径上取点，包身本身不旋转，拖尾自然拐弯'
      ];
      subTx(A, 26, 186, tips[mode], '#5f6780', 10, 'start');
      subTx(A, 26, 204, batch
        ? '终点不放框：包中心正好落在箭头尖上，原地淡出（' + FADE + 's）· 淡完这一趟就结束 · 连线按「一份数据」保持中性灰'
        : '终点不放框：包中心正好落在箭头尖上，原地淡出（' + FADE + 's）· 淡完这一趟就结束 · 飞行中连线染成包的颜色，落下后转 .45 淡色',
        '#939bb2', 9.5, 'start');

      return function () { cancelAnimationFrame(raf); };
    }
  })();

  /* ══════════════════════════════════════════════════════════
     06 控制条
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('controls', '06', '控制条', 'controls');

    /* ── 上：真组件 —— 不是 SVG，就是那套真的 DOM，而且是能按的那一份：
       直接 CV.createControls({ root })，和原语页用的是同一份代码（只把「整页」换成「这个框」）。
       所以播放 / 暂停、上一步 / 下一步、拖进度条、字幕跟着换，全是真的。 ── */
    var sub = h('div', 'sub-hd', s);
    h('h3', null, sub).textContent = '结构 · 字幕 / 分段进度条 / 按钮组（可以按）';
    var body = h('div', null, s);
    var curCtl = null;

    /* 时间轴照抄 gather 的 6 步 —— 段等宽、时长不等这件事在下面那张图里讲，
       这里用同一组 t，播放时就能亲眼看到「第三步走得比第一步久」。
       必须写在 addTab 之前：addTab 会**同步**渲染第一屏，那会儿 STEPS 还没赋值。 */
    function rk(i) { return '<em class="rk r' + i + '">rank' + i + '</em>'; }
    function seg(i) { return '<em class="c' + 'ABCD'[i] + '">' + 'ABCD'[i] + '</em>'; }
    var STEPS = [
      { t: 0.00, text: rk(0) + ' ' + rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 各持一段' },
      { t: 0.10, text: rk(0) + ' 预留 <b>4 份</b> 缓冲' },
      { t: 0.20, text: rk(1) + ' 发送 ' + seg(1) },
      { t: 0.38, text: rk(2) + ' 发送 ' + seg(2) },
      { t: 0.56, text: rk(3) + ' 发送 ' + seg(3) },
      { t: 0.74, text: rk(0) + ' 集齐 ' + seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) }
    ];

    addTab(sub, function (nr) {
      if (curCtl) { curCtl.destroy(); curCtl = null; }   /* 换尺寸就换一份实例，旧的 rAF 要停 */
      body.innerHTML = '';
      drawBar(body, nr);
    });

    function drawBar(host, nr) {
      var w = h('div', 'ctl-demo' + (nr ? ' nr' : ''), host);

      var cap = h('div', 'caption', w);
      h('span', 'cap-text', cap);

      var panel = h('div', 'bar-panel', w);
      var track = h('div', 'track', panel);
      h('div', 'segs', track);                 /* 六段由 createControls 自己建 */
      var scrub = document.createElement('input');
      scrub.type = 'range';
      scrub.className = 'scrub';
      scrub.min = '0'; scrub.max = '1000'; scrub.value = '0';
      scrub.setAttribute('aria-label', '播放进度');
      track.appendChild(scrub);

      var ctrls = h('div', 'ctrls', panel);
      [
        ['ic ic-step prev', 26, '<path d="M6 5h2.4v14H6zM19 5v14l-9.6-7z"/>', '上一步'],
        ['ic ic-main play', 25, '<path d="M7 4.5v15L20 12z"/>', '播放'],
        ['ic ic-step next', 26, '<path d="M15.6 5H18v14h-2.4zM5 5l9.6 7L5 19z"/>', '下一步']
      ].forEach(function (b) {
        var btn = h('button', b[0], ctrls);
        btn.type = 'button';
        btn.setAttribute('aria-label', b[3]);
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="' + b[1] + '" height="' + b[1] +
          '" fill="currentColor">' + b[2] + '</svg>';
      });

      /* 读数行：t / v / 第几段 —— 播放时这两个数不同步走，正是本节要讲的事 */
      var read = h('p', 'ctl-read', w);

      var api = curCtl = CV.createControls({
        root: w,
        steps: STEPS,
        duration: 9000,
        onFrame: function (t) {
          var v = api.tToV(t);
          var k = Math.min(STEPS.length, Math.floor(v * STEPS.length) + 1);
          read.innerHTML = '<b>t</b> ' + t.toFixed(3) +
            ' <i>·</i> <b>v</b> ' + v.toFixed(3) +
            ' <i>·</i> 第 ' + k + ' 段 · <b>v = tToV(t)</b>';
        }
      });
      api.seek(0);   /* 首帧：字幕 / 分段 / 读数先摆到位，别等用户按播放 */
      /* 这一节的组件自己会动，进来就能看到；想停就按暂停，想定格就用步进 */
      api.setPlaying(true);

      /* 数字全部来自 stage.css（含 860px 那条媒体查询），不是估的 */
      var sp = h('p', 'specs', host);
      sp.innerHTML = (nr
        ? '<b>进度条</b> 轨道高 16 · 段高 3 · 段间 5 · 圆角 2 —— 两套尺寸都不变，只有下面的按钮和字变小<br>' +
          '<b>按钮</b> 步进 26（图标 26 · 撑满）· 播放 44 圆（图标 25）· 键距 20 · 行距 12<br>' +
          '<b>字幕</b> 12.5px · 数据字母与 rank 胶囊同桌面（17×17）· 长句优先用 STEPS 的 short 文案<br>' +
          '<b>位置</b> 固定在视口底部（左右 12 · 下 16）—— 上面这个框只是本页的示意框<br>' +
          '<b>交互</b> 循环常开（没有倍速、没有循环开关）· Space 播放暂停 · ← → 步进 · R 回开头'
        : '<b>进度条</b> 轨道高 16 · 段高 3（悬停 4）· 段间 5 · 圆角 2 · 段数 = STEPS.length<br>' +
          '<b>按钮</b> 步进 30（图标 26）· 播放 48 圆（图标 25）· 键距 26 · 行距 14<br>' +
          '<b>字幕</b> 13.5px · 数据字母 17×17 圆角 4 · rank 胶囊 min 17 + 左右 5<br>' +
          '<b>位置</b> 固定在视口底部（左右 30 · 下 24）—— 上面这个框只是本页的示意框<br>' +
          '<b>交互</b> 循环常开（没有倍速、没有循环开关）· Space 播放暂停 · ← → 步进 · R 回开头') +
        '<br><b>上面这份是真的组件</b> <code>CV.createControls({ root })</code> —— 原语页用的是同一个函数，' +
          '只是把「整页」换成了「这个框」：播放/暂停、步进、点或拖进度条、字幕跟着换，全部生效<br>' +
        '<b>为什么读数里 t 和 v 越走越不同</b> 段是等宽的（v 走直线），时间不是（t 各步长短不一）—— ' +
          '下面那张图说的就是这件事；全局快捷键只在原语页生效，这里不抢整页的 Space / ← →';
    }

    /* ── 下：段等宽，时间不等 —— 这套换算才是控制条的核心 ── */
    h('h3', null, s).textContent = '分段条 · 段等宽，时间不等';
    var B = demo(s, 700, 248, '六个等宽分段与各步真实时长的对应关系');

    var T = [0, .10, .20, .38, .56, .74, 1];      /* gather 的真实时间轴 */
    var X0 = 78, X1 = 660, yA = 64, yB = 154;
    var cw = (X1 - X0) / 6;
    function xv(k) { return X0 + cw * k; }
    function xt(v) { return X0 + (X1 - X0) * v; }

    /* 上：视觉轴，六段等宽 —— 这里每一段的宽度一模一样 */
    for (var k = 0; k < 6; k++) {
      el('rect', {
        x: xv(k) + 2.5, y: yA - 5, width: cw - 5, height: 10, rx: 3,
        fill: '#e6e9f0'
      }, B);
      subTx(B, xv(k) + cw / 2, yA - 17, String(k + 1), '#b8c0d4', 9.5);
    }
    subTx(B, X0 - 14, yA - 17, '视觉 v', '#5f6780', 9.5, 'end');

    /* 下：时间轴，刻度落在各步真实的 t 上 */
    el('line', { x1: X0, y1: yB, x2: X1, y2: yB, stroke: '#ccd2e0', 'stroke-width': 1.4 }, B);
    T.forEach(function (v, i) {
      el('line', { x1: xt(v), y1: yB - 5, x2: xt(v), y2: yB + 5, stroke: '#ccd2e0', 'stroke-width': 1.4 }, B);
      subTx(B, xt(v), yB + 18, Math.round(v * 100) + '%', '#939bb2', 9.5);
    });
    subTx(B, X0 - 14, yB + 18, '时间 t', '#5f6780', 9.5, 'end');

    /* 段的边界 → 真实时刻：连线越斜，这一段被拉得越厉害 */
    for (var j = 0; j <= 6; j++) {
      el('line', {
        x1: xv(j), y1: yA + 6, x2: xt(T[j]), y2: yB - 7,
        stroke: '#cbbcf7', 'stroke-width': 1, 'stroke-dasharray': '3 3'
      }, B);
    }

    subTx(B, 30, 206, '段宽一律 1/6 = 16.7%，但第一步真实只占 10%、最后一步占 26% —— 连线越斜，这一段被压/拉得越多', '#939bb2', 9.5, 'start');
    subTx(B, 30, 226, 'tToV / vToT 互为逆运算：点进度条 → 反算 t；t 变了 → 正算填充位置。缺一个，点击处与填充就会错位', '#939bb2', 9.5, 'start');
  })();

  /* ══════════════════════════════════════════════════════════
     07 计算方框
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('calc', '07', '计算方框', 'calc chip');

    var sub = h('div', 'sub-hd', s);
    h('h3', null, sub).textContent = '卡片在下方长高，两排位置不动';
    var body = h('div', null, s);
    addTabs(sub, ['桌面', '窄屏'], function (i) {
      body.innerHTML = '';
      draw(body, i === 1);
    });

    /* ── 07.2 动态：只演「方框那一层」（h2 ↔ h3）──
       原来它是 07.1 的第三个 tab，和「桌面/窄屏」两张静态图挤在一起：
       静态图讲几何（长多少、方框在哪儿居中），动态讲时间（长多久、亮多久、收多久），
       两者量纲不同，而且三段耗时要在调试台里逐秒调 —— 单独成一节才好对着调。 */
    var dynSub = h('div', 'sub-hd', s);
    h('h3', null, dynSub).textContent = '动态 · 方框长出与收回';
    var dynBox = h('div', null, s);
    var stopDyn = null;
    function playDyn() {
      if (stopDyn) { stopDyn(); stopDyn = null; }
      dynBox.innerHTML = '';
      stopDyn = drawGrow(dynBox);
    }
    playDyn();

    /* 参数台改了「方框动态」任意键（或重置全部）→ 停掉旧 rAF、按新时长重播。
       这几段时长是**读一次就定住**的（时间轴在创建时算好），所以不能只改数字，必须重建。 */
    CV.params.onChange(function (ch) {
      if ((ch.section === '07-calc' || ch.section === '*') && stopDyn) playDyn();
    });

    h('p', 'specs', s).innerHTML =
      '<b>三段耗时</b> 卡片伸长（h2 → h3）/ 方框展示 / 卡片缩回（h3 → h2）——' +
        '都在右侧调试台「方框动态」里调，改完这一节立刻按新时长重播<br>' +
      '<b>不进规范</b> 方框那 0.35s 淡入 / 淡出是与伸缩<b>错开</b>的衔接：' +
        '先长空间、再填内容；先灭内容、再收空间 —— 两件事串行，不重叠，所以不算「组件耗时」<br>' +
      '<b>页面同样能调</b> reduce 页那一拍读的是同一组值（伸长 / 缩回直接取，' +
        '展示取「与四段融合的较大者」），这里调到 1.2s，reduce 页也跟着变长';

    /* ── 07.2 动态：只演「方框那一层」（h2 ↔ h3）──
       起点直接给到 h2：h1 → h2（一排变两排）是 03 讲过的，本节的题目是方框，
       不该让半条时间花在别的事上。
       三段耗时全部走规范 07-calc（右侧调试台可调），改完按新时长重播；
       方框那 0.35s 淡入 / 淡出是与伸缩**错开**的衔接，不进规范。
       每帧调 CV.resizeCard，和 reduce.js 改高度是同一条路径。 */
    function drawGrow(host) {
      var Q = { cw: 300, hd: 36, sw: 46, gap: 12, rowGap: 12, calcGap: 10, areaPad: 12,
                chipW: 56, chipH: 22, fs: 11.5, tipFs: 10.5, tipTx: 'sum · avg · max · min' };
      var PRE_WIDEN = 25;
      var h1 = 170;
      var h2 = h1 + Q.sw + Q.rowGap - PRE_WIDEN;              /* 203 */
      var h3 = h2 + Q.calcGap + Q.chipH + Q.areaPad - 16;     /* 231 */
      var x = 130, top = 62;                    /* 顶边钉死：h2 与 h3 共用同一条顶边 */
      var off2 = Q.hd + (h2 - Q.hd - 2 * Q.sw - Q.rowGap) / 2;             /* 67.5 */
      var rowW = 4 * Q.sw + 3 * Q.gap, rowX = x + (Q.cw - rowW) / 2;

      /* ── 时间轴：全部由规范值算出来，改参数 = 改总长 ── */
      var DUR = {
        grow:   CV.params.get('07-calc', 'growDur')   || 0.75,
        hold:   CV.params.get('07-calc', 'holdDur')   || 0.95,
        shrink: CV.params.get('07-calc', 'shrinkDur') || 0.7
      };
      var FADE = 0.35;   /* 方框淡入 / 淡出：与伸缩错开的衔接，不是「组件耗时」 */
      var GAP1 = 0.25;   /* 长够 → 方框才亮：先长空间、再填内容 */
      var GAP2 = 0.2;    /* 方框灭了 → 卡片才收：先灭、再收 */
      var REST = 0.9;    /* 首尾各驻留一下，读得出「起点是两排」 */

      var tA = REST;                        /* 开始伸长 */
      var tB = tA + DUR.grow;               /* 长够 */
      var tC = tB + GAP1;                   /* 方框开始淡入 */
      var tD = tC + FADE;                   /* 方框全亮 */
      var tE = tD + DUR.hold;               /* 开始淡出 */
      var tF = tE + FADE;                   /* 方框没了 */
      var tG = tF + GAP2;                   /* 开始缩回 */
      var tH = tG + DUR.shrink;             /* 缩回 h2 */
      var SPAN = tH + REST;

      var A = demo(host, 520, 352,
        '目标卡从两排（h2）长出计算方框那一层（h3）再收回：顶边钉死，只往下长');

      capTx(A, 24, 26, '只演方框这一层：伸长 ' + DUR.grow.toFixed(2) + 's → 展示 ' +
        DUR.hold.toFixed(2) + 's → 缩回 ' + DUR.shrink.toFixed(2) + 's（右侧调试台可调）');

      var card = CV.drawCard(A, {
        key: 0, geo: { x: x, y: top, w: Q.cw, h: h2 }, color: DATA[0].color,
        title: 'rank 0', role: 'dst', target: true,
        hdr: Q.hd, titleSize: 15, badgeSize: 10
      });

      /* 两条卡底刻度：动画在中间跑，参照线不动。
         h1 不参与本节，不画 —— 三条线挤在 28px 里反而读不出「长了多少」。
         右侧只留 66px 放字（卡右边 430 → 画布 520），所以标签用半角短写法。 */
      [[top + h2, 'h2 ' + h2],
       [top + h3, 'h3 ' + h3 + ' · +' + (h3 - h2)]].forEach(function (r) {
        el('line', {
          x1: x + Q.cw + 4, y1: r[0], x2: 446, y2: r[0],
          stroke: '#b9c0d2', 'stroke-width': 1, 'stroke-dasharray': '3 3'
        }, A);
        subTx(A, 450, r[0] + 3.5, r[1], '#8b93a6', 9.5, 'start');
      });
      /* 顶边钉死：只在卡的左右两侧各挑出一小截，说明这条边整个动画都不动 */
      [[118, x], [x + Q.cw, 448]].forEach(function (r) {
        el('line', {
          x1: r[0], y1: top, x2: r[1], y2: top,
          stroke: '#c9b6f7', 'stroke-width': 1.4
        }, A);
      });
      subTx(A, 452, top + 3.5, '顶边不动', '#b9a4f0', 9, 'start');

      /* 两排都是实块：进入「计算」前提是数据已经到位，空槽那一段归 03 讲。
         行位整个动画不动（顶边钉死 + 两排位置不动），所以画一次就够，不必逐帧挪。 */
      for (var i = 0; i < 4; i++) {
        var colX = rowX + i * (Q.sw + Q.gap);
        CV.setSlot(CV.drawSlot(A, colX, top + off2, Q.sw, Q.sw), DATA[i], {});
        CV.setSlot(CV.drawSlot(A, colX, top + off2 + Q.sw + Q.rowGap, Q.sw, Q.sw), DATA[i], {});
      }

      /* 方牌：位置只用 h3 态的几何算一次，后面只改不透明度 */
      var blankTop = top + off2 + Q.sw + Q.rowGap + Q.sw;      /* 233.5 */
      var calcY = blankTop + Math.max(Q.calcGap, (top + h3 - blankTop - Q.chipH) / 2);
      var calcCx = x + Q.cw / 2;

      /* 占位虚线框：先长空间时这一段还空着，先给个同尺寸的框；
         方框一亮它就退场 —— 「先长空间、再填内容」的两步在图上看得见 */
      var ph = el('rect', {
        x: calcCx - Q.chipW / 2, y: calcY, width: Q.chipW, height: Q.chipH,
        rx: Math.round(Q.chipH * .3), fill: 'none',
        stroke: '#c9b6f7', 'stroke-width': 1.2, 'stroke-dasharray': '4 3'
      }, A);
      ph.style.opacity = '0';

      var chip = CV.drawCalc(A, { w: Q.chipW, h: Q.chipH, fs: Q.fs, tipFs: Q.tipFs, tipText: Q.tipTx });
      chip.wrap.setAttribute('transform', 'translate(' + calcCx + ' ' + calcY + ')');
      chip.wrap.style.opacity = '0';

      var stage = el('text', {
        class: 'dim-tx', x: 24, y: 338, 'text-anchor': 'start',
        fill: '#5f6780', 'font-size': 10.5
      }, A);
      var read = el('text', {
        class: 'dim-tx', x: 496, y: 338, 'text-anchor': 'end',
        fill: '#6d28d9', 'font-size': 10.5, 'font-weight': 600
      }, A);

      /* 时间轴：一轮 = 驻留 → 伸长 → 方框淡入 → 展示 → 方框淡出 → 缩回 → 驻留。
         三段主耗时来自规范（tA~tH 全是 DUR 算出来的），改参数 = 改这两条边界的间隔。 */
      return anim(SPAN * 1000, function (T) {
        var g3, chipOp, label;
        if (T < tA) {
          g3 = 0; chipOp = 0;
          label = '① 两排就位 · h2 = ' + h2 + '（这一层还没长出来）';
        } else if (T < tB) {
          g3 = easeIO(seg(T, tA, tB)); chipOp = 0;
          label = '② 伸长 ' + DUR.grow.toFixed(2) + 's：顶边钉死，只往下长';
        } else if (T < tC) {
          g3 = 1; chipOp = 0;
          label = '② 长够 · h3 = ' + h3 + '，方框位置还空着';
        } else if (T < tD) {
          g3 = 1; chipOp = easeIO(seg(T, tC, tD));
          label = '③ 方框淡入：先长空间，再填内容';
        } else if (T < tE) {
          g3 = 1; chipOp = 1;
          label = '③ 展示 ' + DUR.hold.toFixed(2) + 's · 正在计算';
        } else if (T < tF) {
          g3 = 1; chipOp = 1 - easeIO(seg(T, tE, tF));
          label = '收 1 · 方框先消失（卡片还不动）';
        } else if (T < tG) {
          g3 = 1; chipOp = 0;
          label = '收 1 · 方框已收，h 仍是 ' + h3;
        } else if (T < tH) {
          g3 = 1 - easeIO(seg(T, tG, tH)); chipOp = 0;
          label = '收 2 · 缩回 ' + DUR.shrink.toFixed(2) + 's（顶边仍钉死）';
        } else {
          g3 = 0; chipOp = 0;
          label = '① 回到两排 · h2 = ' + h2 + '（等下一次计算）';
        }

        /* 顶边钉死、两排位置不动：只有卡底在走，行位一个像素都不挪 */
        var h = h2 + (h3 - h2) * g3;
        CV.resizeCard(card, { x: x, y: top, w: Q.cw, h: h });

        chip.wrap.style.opacity = chipOp.toFixed(3);
        chip.wrap.setAttribute('data-on', chipOp > .5 ? '1' : '0');
        /* 占位框只在「正向长空间」时出场：随 g3 淡入，方框一亮就被它盖掉；
           回收时一律不出（tE 起锁 0），否则卡片往回缩时它会挂在卡底外面 */
        var phOp = (T < tE ? 1 - chipOp : 0) * seg(g3, .55, .85);
        ph.style.opacity = phOp.toFixed(3);

        stage.textContent = label;
        read.textContent = 'h = ' + h.toFixed(1);
      });
    }

    function draw(host, nr) {
      /* 全部数字来自 reduce.js 的 GEO 与 cardH()，一个都不另定 */
      var Q = nr
        ? { cw: 146, hd: 28, sw: 25, gap: 5, rowGap: 8, areaPad: 9, calcGap: 7,
            chipW: 40, chipH: 16, fs: 9, tipFs: 8, tipTx: 'sum · avg',
            h1: 126, title: 12.5, badge: 8.5 }
        : { cw: 300, hd: 36, sw: 46, gap: 12, rowGap: 12, areaPad: 12, calcGap: 10,
            chipW: 56, chipH: 22, fs: 11.5, tipFs: 10.5, tipTx: 'sum · avg · max · min',
            h1: 170, title: 15, badge: 10 };

      /* 三个高度与三条基线，与 reduce.js 一一对应 */
      var PRE_WIDEN = 25;
      var h2 = Q.h1 + Q.sw + Q.rowGap - PRE_WIDEN;
      var h3 = h2 + Q.calcGap + Q.chipH + Q.areaPad - 16;
      var pT2 = (h2 - Q.hd - 2 * Q.sw - Q.rowGap) / 2;
      var row1 = Q.hd + pT2;
      var row2 = row1 + Q.sw + Q.rowGap;
      /* 方牌不算「贴着第二排」，而是在「第二排底 → 卡底」这段空白里上下居中 */
      var blankTop = row2 + Q.sw;
      var calcY = blankTop + (h3 - blankTop - Q.chipH) / 2;

      /* ── 图一：两张卡顶边对齐，只有下边在长 ── */
      var y = nr ? 56 : 60;
      var ax = nr ? 40 : 60;
      var bx = ax + Q.cw + (nr ? 26 : 60);
      var A = demo(host, nr ? 420 : 780, nr ? 300 : 380,
        '两张 rank 卡片顶边对齐：左边是预留态，右边多出计算方框并向下长高');

      function rows(sv, x, arrived) {
        var total = 4 * Q.sw + 3 * Q.gap;
        var sx = x + (Q.cw - total) / 2;
        [0, 1].forEach(function (r) {
          for (var i = 0; i < 4; i++) {
            var sl = CV.drawSlot(sv, sx + i * (Q.sw + Q.gap), y + (r ? row2 : row1), Q.sw, Q.sw);
            if (r && !arrived) CV.setSlot(sl, null, { active: true });
            else CV.setSlot(sl, DATA[i], {});
          }
        });
      }

      CV.drawCard(A, {
        key: 0, geo: { x: ax, y: y, w: Q.cw, h: h2 }, color: DATA[0].color,
        title: 'rank 0', role: 'dst', target: true,
        hdr: Q.hd, titleSize: Q.title, badgeSize: Q.badge
      });
      rows(A, ax, false);

      CV.drawCard(A, {
        key: 0, geo: { x: bx, y: y, w: Q.cw, h: h3 }, color: DATA[0].color,
        title: 'rank 0', role: 'dst', target: true,
        hdr: Q.hd, titleSize: Q.title, badgeSize: Q.badge
      });
      rows(A, bx, true);

      /* 方牌：真调用同一份绘制函数 */
      var chip = CV.drawCalc(A, {
        w: Q.chipW, h: Q.chipH, fs: Q.fs,
        tipFs: Q.tipFs, tipText: Q.tipTx
      });
      chip.wrap.setAttribute('transform', 'translate(' + (bx + Q.cw / 2) + ' ' + (y + calcY) + ')');
      chip.wrap.style.opacity = '1';
      chip.wrap.setAttribute('data-on', '1');

      /* 预留态的卡底：被方牌挡住的地方断开，只在两侧留一小截 */
      var lineY = y + h2;
      var half = Q.chipW / 2 + 6;
      var cxB = bx + Q.cw / 2;
      [[bx, cxB - half], [cxB + half, bx + Q.cw]].forEach(function (seg) {
        el('line', {
          x1: seg[0], y1: lineY, x2: seg[1], y2: lineY,
          stroke: '#c9b6f7', 'stroke-width': 1.2, 'stroke-dasharray': '4 3'
        }, A);
      });

      gapV(A, bx + Q.cw + 16, lineY, y + h3, bx + Q.cw + 23, lineY + (h3 - h2) / 2,
        '+' + (h3 - h2));

      capTx(A, ax, y - 16, '预留态 h2 = ' + h2);
      capTx(A, bx, y - 16, '计算态 h3 = ' + h3);

      var nY = y + h3 + 34;
      var gc = Math.round((h3 - blankTop - Q.chipH) / 2 * 100) / 100;
      var notes = nr
        ? ['h2 = h1 + 一格 + 行距 − 25',
           'h3 = h2 + ' + (h3 - h2) + '（间距 ' + Q.calcGap + ' + 方框 ' + Q.chipH +
             ' + 底留白 ' + Q.areaPad + ' − 16）',
           '方牌在下方空白里居中：上下各留 ' + gc]
        : ['h2 = h1 + 一格 + 行距 − 25：两排刚好在标题条以下居中',
           'h3 = h2 + ' + (h3 - h2) + '（方框间距 ' + Q.calcGap + ' + 方框 ' + Q.chipH +
             ' + 底留白 ' + Q.areaPad + ' − 16）：长出来的这段只给方框，两排 y 不动',
           '方牌在「第二排底 → 卡底」之间居中：上下各留 (' + h3 + ' − ' + blankTop +
             ' − ' + Q.chipH + ') ÷ 2 = ' + gc + '（桌面 170 → 203 → 231）'];
      notes.forEach(function (t, i) {
        subTx(A, ax - 8, nY + i * 20, t, i ? '#939bb2' : '#5f6780', 9.5, 'start');
      });

      /* ── 图二：方框本身 —— 只画悬停态，气泡是它的一半信息 ── */
      var B = demo(host, nr ? 360 : 420, nr ? 140 : 150,
        '计算方框：方牌加悬停提示条，标出宽高、圆角与间距');

      var bcx = nr ? 180 : 210;
      var by = 54;
      var c2 = CV.drawCalc(B, {
        w: Q.chipW, h: Q.chipH, fs: Q.fs,
        tipFs: Q.tipFs, tipText: Q.tipTx
      });
      c2.wrap.setAttribute('transform', 'translate(' + bcx + ' ' + by + ')');
      c2.wrap.style.opacity = '1';
      c2.wrap.setAttribute('data-on', '1');

      /* 悬停态：真页面上由 :hover 触发，静态图里手动摆出来 */
      var bg = c2.chip.querySelector('.calc-chip-bg');
      bg.setAttribute('stroke', '#a78bfa');
      bg.setAttribute('fill', '#f7f3ff');
      c2.chip.querySelector('.calc-tx').setAttribute('fill', '#6d28d9');
      c2.tip.style.opacity = '1';

      var tipY = by + Q.chipH + 8;
      var tipH = c2.tipH;
      var tipW = c2.tipW;                 /* 真实绘制函数量出来的宽度，不是估的 */

      dimH(B, bcx - Q.chipW / 2, bcx + Q.chipW / 2, by - 20, String(Q.chipW));
      dimV(B, bcx + Q.chipW / 2 + 16, by, by + Q.chipH, String(Q.chipH));
      gapV(B, bcx, by + Q.chipH, tipY, bcx + tipW / 2 + 40, by + Q.chipH + 4, '8');
      dimH(B, bcx - tipW / 2, bcx + tipW / 2, tipY + tipH + 4, String(tipW));
      dimV(B, bcx + tipW / 2 + 16, tipY, tipY + tipH, String(tipH));

      var sp = h('p', 'specs', host);
      sp.innerHTML =
        '<b>方牌</b> ' + Q.chipW + '×' + Q.chipH + ' · rx = round(h × 0.30) = ' +
          Math.round(Q.chipH * 0.3) + ' · 字「计算」' + Q.fs + 'px sans 600 · 字距 .04em<br>' +
        '<b>气泡</b> 高 = 方牌 + 6 = ' + (Q.chipH + 6) + ' · 距方牌 8 · 宽由文案实测撑开：' +
          '文字长 ' + (tipW - 24) + ' + 左右各 12 = ' + tipW + '（' + Q.tipFs + 'px mono）· ' +
          '底色 #363b4e 96% —— 白底白卡上只有深色才读得出来<br>' +
        '<b>显隐</b> 不用 CSS 过渡：<code>wrap.style.opacity</code> 由时间轴逐帧写，' +
          '<code>data-on</code> 只管 pointer-events；气泡由 <code>:hover</code> 单独控制';
    }
  })();

  /* ══════════════════════════════════════════════════════════
     08 落位弹跳 .slot-pop
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('pop', '08', '落位弹跳', 'slot-pop');
    var sw = G.desktop.slot.sw;

    /* stage.css 里是 cubic-bezier(.2,.9,.3,1.45)：0% scale(.35) → 55% 1.16 → 100% 1。
       浏览器按「每段一条缓动」插值，所以这里也用同一条曲线逐段求值 ——
       图上那条线不是示意，是按公式算出来的。 */
    function ease(p1x, p1y, p2x, p2y) {
      function c(t, a, b) {
        return 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
      }
      return function (x) {
        var lo = 0, hi = 1, t = x, i;
        for (i = 0; i < 30; i++) { t = (lo + hi) / 2; if (c(t, p1x, p2x) < x) lo = t; else hi = t; }
        return c(t, p1y, p2y);
      };
    }
    var E = ease(.2, .9, .3, 1.45);
    var DUR = .55, K1 = DUR * .55;
    function at(t) {
      if (t <= K1) { var p = E(t / K1); return { s: .35 + .81 * p, o: Math.min(1, p) }; }
      return { s: 1.16 - .16 * E((t - K1) / (DUR - K1)), o: 1 };
    }

    var A = demo(s, 700, 330, '落位弹跳的缩放曲线，以及按时间采样的五个数据块');

    var X0 = 70, X1 = 618, YB = 178, YT = 56, S0 = .30, S1 = 1.35;
    function xt(t) { return X0 + t / DUR * (X1 - X0); }
    function yv(v) { return YB - (v - S0) / (S1 - S0) * (YB - YT); }

    /* 三条参考线：1.00 终点、1.16 关键帧、1.29 峰值 */
    [[1, '1.00×'], [1.16, '1.16×'], [1.29, '1.29×']].forEach(function (r) {
      el('line', {
        x1: X0 - 4, y1: yv(r[0]), x2: X1, y2: yv(r[0]),
        stroke: '#d9d2ee', 'stroke-width': 1, 'stroke-dasharray': '3 4'
      }, A);
      subTx(A, X0 - 10, yv(r[0]) + 3.5, r[1], '#b3a8cf', 10, 'end');
    });

    /* 坐标轴 */
    el('path', {
      d: 'M ' + (X0 - 4) + ' ' + (YT - 10) + ' L ' + (X0 - 4) + ' ' + YB + ' L ' + (X1 + 10) + ' ' + YB,
      fill: 'none', stroke: '#d3d8e6', 'stroke-width': 1
    }, A);

    /* 曲线本体：150 点采样 */
    var d = '', i, t;
    for (i = 0; i <= 150; i++) {
      t = DUR * i / 150;
      d += (i ? ' L ' : 'M ') + xt(t).toFixed(2) + ' ' + yv(at(t).s).toFixed(2);
    }
    el('path', { d: d, fill: 'none', stroke: '#7c3aed', 'stroke-width': 2, 'stroke-linejoin': 'round' }, A);

    /* 横轴刻度：只标三个关键点，免得挤 */
    [[0, '0'], [K1, '0.30s · 55%'], [DUR, '0.55s']].forEach(function (k) {
      el('line', { x1: xt(k[0]), y1: YB, x2: xt(k[0]), y2: YB + 5, stroke: '#d3d8e6', 'stroke-width': 1 }, A);
      subTx(A, xt(k[0]), YB + 18, k[1], '#939bb2', 10, k[0] === 0 ? 'start' : (k[0] === DUR ? 'end' : 'middle'));
    });

    /* 峰值 */
    el('circle', { cx: xt(.177), cy: yv(1.29), r: 3.4, fill: '#fff', stroke: '#7c3aed', 'stroke-width': 2 }, A);
    subTx(A, xt(.177) + 10, yv(1.29) - 8, '峰值 1.29× · 0.18s', '#7c3aed', 10, 'start');
    el('circle', { cx: xt(.447), cy: yv(.974), r: 2.6, fill: '#a78bfa' }, A);
    subTx(A, xt(.447) + 8, yv(.974) + 22, '回落到 0.97×', '#a78bfa', 10, 'start');

    /* 五帧：横坐标就是时间，和上面的曲线一一对齐 */
    [0.04, 0.177, 0.3025, 0.447, 0.55].forEach(function (tt) {
      var v = at(tt);
      var w = el('g', {
        transform: 'translate(' + xt(tt).toFixed(1) + ' 250) scale(' + v.s.toFixed(3) + ')',
        opacity: v.o
      }, A);
      CV.setSlot(CV.drawSlot(w, -sw / 2, -sw / 2, sw, sw), DATA[0], {});
      subTx(A, xt(tt), 300, v.s.toFixed(2) + '×', '#5f6780', 10);
      subTx(A, xt(tt), 316, tt.toFixed(2) + 's', '#939bb2', 10);
    });

    /* 说明里的数字跟着滑杆走：写死「.55s / .17s」，改完参数文档就成了假的 */
    function seatDur() {
      var v = CV.params.get('08-seat', 'popDur');
      return typeof v === 'number' ? v : .55;
    }
    function seatGap() {
      var v = CV.params.get('08-seat', 'seatGap');
      return typeof v === 'number' ? v : .5;
    }
    function nx2(v) { return v.toFixed(2).replace(/^0\./, '.'); }

    var sp = h('p', 'specs', s);
    function specHTML() {
      return '<b>关键帧</b> <code>0%</code> scale(.35) opacity 0 → <code>55%</code> scale(1.16) opacity 1 → ' +
        '<code>100%</code> scale(1) · 时长 <code>' + nx2(seatDur()) + 's</code> · 每段都吃同一条缓动<br>' +
      '<b>多块错峰</b> 一批里有多个块时，第 k 个比第 k−1 个晚 <code>' + nx2(seatGap()) + 's</code> 起跳 ' +
        '（规范 08 · <code>seatGap</code>）—— 齐刷刷一起弹读不出「一个一个落」。' +
        '页面用 <code>CV.seatAt(i, base)</code> 算每个块的时刻，<b>不是</b> setTimeout：' +
        '进度条要能来回拖，定时器拖不回来<br>' +
      '<b>不属于规范的间隔</b> 到达终点到开始弹跳之间的「落位延迟」、两趟传递之间停多久，' +
        '都是每页自己排的节奏 —— 在原语页右侧齿轮里直接填秒<br>' +
      '<b>为什么要 1.45</b> 这个缓动的 y 控制点大于 1，中途会冲过头：1.29× 出现在 0.18s，' +
        '回落成 55% 的 1.16×，再下探到 0.97×，最后停在 1 —— 手感的「弹」就是这两下<br>' +
      '<b>重播</b> 删 <code>class</code> → <code>getBoundingClientRect()</code> 强制回流 → 再加回，' +
        '否则第二次起浏览器把「删-加」合并、动画不重播（SVG 没有 <code>offsetWidth</code>）<br>' +
      '<b>涟漪</b> <code>.ring</code> / <code>ringOut</code> 1.05s 代码还在，但 <code>CV.SHOW_RING = false</code>，定稿不显示';
    }
    sp.innerHTML = specHTML();

    /* 下半：真动画，每 2.2s 重播一次 —— 上面那五个静态帧就是从这里采出来的 */
    var liveHd = h('h3', null, s);
    function liveTx() {
      /* 标题给读者看，别用 .50 这种代码腔 —— 小数点太容易漏。
         用 .sub-tx 包裹文字，给二级标题编号（.sub-no）留位置，
         否则 resize 重算时 textContent 会把编号一起清掉。 */
      var sp = liveHd.querySelector('.sub-tx') || h('span', 'sub-tx', liveHd);
      sp.textContent = '实时 · 三个块依次落位，错峰 ' + seatGap().toFixed(2) + 's，每 2.2s 重播';
    }
    liveTx();
    var B = demo(s, 460, 120, '三个数据块依次落位弹跳，真实 CSS 动画');
    var live = DATA.slice(0, 3).map(function (d2, k) {
      var sl = CV.drawSlot(B, 76 + k * 132, 36, sw, sw);
      CV.setSlot(sl, d2, {});   /* setSlot 不返回对象，得自己留着句柄给 spawnPulse */
      return sl;
    });
    function cycle() {
      var g = seatGap() * 1000;
      live.forEach(function (sl, k) {
        setTimeout(function () { CV.spawnPulse(B, sl, DATA[k].color); }, k * g);
      });
    }
    setTimeout(cycle, 500);
    setInterval(cycle, 2200);

    CV.params.onChange(function (ch) {
      if (ch.section !== '08-seat' && ch.section !== '*') return;
      sp.innerHTML = specHTML();
      liveTx();
    });
  })();

  /* ══════════════════════════════════════════════════════════
     09 融合 CV.createMerge
     ------------------------------------------------------------
     两排数据块，下排被上排一列一列「吸」上去 —— reduce 的累加器
     每来一份就逐段折进去，就是这件事。

     它和 08 落位弹跳是**两件相反的事**，所以不能共用一套动效：
       落位 = 无 → 有，scale .35 → 1.29 → 1，靠过冲给手感；
       融合 = 有 → 无，位移向上、缩放变小、透明度变低，三个量全单调。
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('fuse', '09', '融合', 'merge');

    /* 几何与 07 的 h2 同一组数：同一种两排卡，不另定一套 */
    var Q = { cw: 300, hd: 36, sw: 46, gap: 12, rowGap: 12 };
    var h2 = 203;
    var off1 = Q.hd + (h2 - Q.hd - 2 * Q.sw - Q.rowGap) / 2;   /* 67.5 */
    var off2 = off1 + Q.sw + Q.rowGap;                          /* 125.5 */
    var cx0 = 60, cy0 = 58;
    var rowW = 4 * Q.sw + 3 * Q.gap;
    var rowX = cx0 + (Q.cw - rowW) / 2;
    var y1 = cy0 + off1;                    /* 上排块顶边 */
    var y2 = cy0 + off2;                    /* 下排块顶边 */

    /* ── 上：实时。四列从左到右依次融合，2.2s 走完、3.2s 一轮 ── */
    var A = demo(s, 620, 330, '两行四列：下排的块依次被上排吸走，上排融合后变成 Σ + 列字母 + 份数');
    capTx(A, 24, 26, '四列从左到右依次融合 —— 上排是累加器，下排是刚到的一份');

    CV.drawCard(A, {
      key: 0, geo: { x: cx0, y: cy0, w: Q.cw, h: h2 }, color: DATA[0].color,
      title: 'rank 0', role: 'dst', target: true,
      hdr: Q.hd, titleSize: 15, badgeSize: 10
    });

    var top = [];
    for (var i = 0; i < 4; i++) {
      var bx = rowX + i * (Q.sw + Q.gap);
      var t = CV.drawSlot(A, bx, y1, Q.sw, Q.sw);
      CV.setSlot(t, DATA[i], {});
      top.push(t);
      /* 空槽先画：块被吸走以后，这里是它留下的坑 */
      CV.setSlot(CV.drawSlot(A, bx, y2, Q.sw, Q.sw), null, {});
    }

    /* 一份 + 一份 → Σ + 列字母 + 份数：颜色按 (份数−1)/3 向 DEEP 收一格 */
    var merges = DATA.map(function (d, k) {
      return CV.createMerge(A, {
        x: rowX + k * (Q.sw + Q.gap) + Q.sw / 2,
        y0: y2 + Q.sw / 2, y1: y1 + Q.sw / 2, size: Q.sw,
        data: d, target: top[k],
        to: { letter: 'Σ', sub: d.letter, count: 2, color: CV.mix(d.color, SIGMA, 1 / 3) }
      });
    });

    /* 右侧两条引线：一眼分清哪排是谁 */
    [[y1 + Q.sw / 2, '上排 · 累加器', '#6d28d9'],
     [y2 + Q.sw / 2, '下排 · 刚到的一份', '#939bb2']].forEach(function (r) {
      el('line', {
        x1: cx0 + Q.cw + 6, y1: r[0], x2: 392, y2: r[0],
        stroke: '#c9b6f7', 'stroke-width': 1, 'stroke-dasharray': '3 3'
      }, A);
      subTx(A, 396, r[0] + 3.5, r[1], r[2], 10, 'start');
    });

    var read = el('text', {
      class: 'dim-tx', x: 396, y: y2 + Q.sw + 24, 'text-anchor': 'start',
      fill: '#6d28d9', 'font-size': 10.5, 'font-weight': 600
    }, A);

    subTx(A, 24, cy0 + h2 + 30,
      '位移 ↑ · 缩放 ↓ · 不透明度 ↓ —— 三个量都单调，一次回头都没有',
      '#939bb2', 10, 'start');
    subTx(A, 24, cy0 + h2 + 48,
      '目标块自己不缩放，只被一道白光扫过（扫完才换成 Σ + 列字母 + 已折进份数）',
      '#939bb2', 10, 'start');

    var HOLD0 = .55, CYCLE = 3.2, fresh = false;
    /* 单次融合多久（fuseDur）与多列之间错开多久（mergeGap）**都走规范** ——
       这一节只是把规范值拿来示范，不另定一套节奏；reduce 页读的是同一个数。
       HOLD0（开头先亮着不动）才是这一节的编排，不进规范。 */
    function fuseDur() {
      var v = CV.params.get('09-merge', 'fuseDur');
      return typeof v === 'number' ? v : .42;
    }
    function fuseGap() {
      var v = CV.params.get('09-merge', 'mergeGap');
      return typeof v === 'number' ? v : .5;
    }

    anim(CYCLE * 1000, function (T) {
      var DUR = fuseDur(), GAP = fuseGap();
      if (T < .06 && !fresh) {
        fresh = true;
        merges.forEach(function (m) { m.reset(); });
      } else if (T > .30) {
        fresh = false;
      }

      var done = 0;
      merges.forEach(function (m, k) {
        var p = seg(T, HOLD0 + k * GAP, HOLD0 + k * GAP + DUR);
        if (T >= HOLD0 + k * GAP + DUR) done++;
        m.apply(p);
      });

      read.textContent = done < 4
        ? '已融合 ' + done + ' / 4'
        : 'Σ 四列到位 · 下排已空';
    });

    /* ── 下：静态四帧，p 就是这一列融合的进度 ── */
    h('h3', null, s).textContent = '一路走完 · 四个时刻';
    var B = demo(s, 660, 214, '同一列的四个时刻：唤醒、上浮、接触、注入');

    capTx(B, 24, 24, '同一个列：p 是这一列融合的进度，0 → 1');
    var ty = 44, by = 132;
    var framesB = [];
    [[100, .10, '① 唤醒 · p .10', '描边收实、提亮一档'],
     [270, .35, '② 上浮 · p .35', '缩到 .85，还在下方'],
     [440, .62, '③ 消散 · p .62', '缩到 .40、淡到一半'],
     [610, 1, '④ 注入 · p 1.00', '白光扫完，已换 Σᴀ²']].forEach(function (f) {
      var c = f[0];
      var tg = CV.drawSlot(B, c - Q.sw / 2, ty, Q.sw, Q.sw);
      CV.setSlot(tg, DATA[0], {});
      CV.setSlot(CV.drawSlot(B, c - Q.sw / 2, by, Q.sw, Q.sw), null, {});
      var m = CV.createMerge(B, {
        x: c, y0: by + Q.sw / 2, y1: ty + Q.sw / 2, size: Q.sw,
        data: DATA[0], target: tg,
        to: { letter: 'Σ', sub: 'A', count: 2, color: CV.mix(DATA[0].color, SIGMA, 1 / 3) }
      });
      m.apply(f[1]);
      framesB.push({ m: m, p: f[1] });          /* 参数一改要重新 apply 这四个定格 */
      subTx(B, c, 192, f[2], '#5f6780', 10);
      subTx(B, c, 206, f[3], '#b6bdcd', 9);
    });

    var sp = h('p', 'specs', s);

    /* 说明里的数字必须跟着滑杆走 —— 写死一份「.16–.72」，改了参数就变成假文档 */
    function nx(v) { return String(Math.round(v * 100) / 100).replace(/^0\./, '.'); }

    function specHTML() {
      function v(k) { return CV.params.get('09-merge', k); }
      var wake = v('fuseWake'), rise = v('fuseRise'), fade = v('fuseFade'), swap = v('fuseSwap');
      var shrink = v('fuseShrink'), trail = v('fuseTrail'), gloss = v('fuseGloss');
      var gs = Math.max(fade, swap - .23), ge = Math.min(1, swap + .22);
      return '<b>和落位弹跳的区别</b> 那个是「无 → 有」，块从 <code>.35</code> 弹到 <code>1.29</code> 再落回 ' +
        '<code>1</code>，靠<b>过冲</b>给手感；融合是「有 → 无」，三个量全单调，目标块自己也<b>不缩放</b> —— ' +
        '所以两者不能共用一套关键帧<br>' +
      '<b>三段</b> ① 唤醒 <code>0–' + nx(wake) + '</code> 只改颜色与描边（块一步都不挪）· ' +
        '② 上浮 <code>' + nx(wake) + '–' + nx(rise) + '</code> 走 y₀→y₁ 并缩到 <code>' + nx(shrink) + '</code>，' +
        '到 <code>' + nx(fade) + '</code> 开始淡出 · ' +
        '③ 注入 <code>' + nx(gs) + '–' + nx(ge) + '</code> 白光扫过（峰值 <code>' + nx(gloss) + '</code>），' +
        '<code>' + nx(swap) + '</code> 那一刻目标换成 Σ + 列字母 + 已折进份数，并加深<br>' +
      '<b>结果块的写法（规范）</b> 换 Σ 起，块上写三样：大 <code>Σ</code>、该列字母作<b>下标</b>、' +
        '已折进几份作<b>上标</b> —— 两块相加 <code>Σᴀ²</code>、三块 <code>Σᴀ³</code>、四块 <code>Σᴀ⁴</code>，' +
        '每折进一份上标就 +1，份数一眼可数。绘制走 <code>CV.setSlot</code> 的 ' +
        '<code>{ letter:\'Σ\', sub:\'A\', count:2 }</code>，<code>CV.createMerge</code> 的 <code>to</code> 同款<br>' +
      '<b>白光怎么扫</b> 一块和块等大的 <code>rect</code> + 三停渐变（两端全透明），' +
        '只改 <code>gradientTransform</code> 的 <code>translate</code>：<code>−1 → 1</code> 就是一个块宽。' +
        '不用 <code>clipPath</code>，也不会扫出块外<br>' +
      '<b>拖尾</b> 两块残影跟在下方 ' + Math.round(trail) + ' / ' + Math.round(trail * 1.67) +
        '、缩放 .8 / .6，和飞行数据包同一套语言 —— ' +
        '读起来是「被吸走」，不是「跳一下」；静止时它不出现（否则像块底下挂了道影子）<br>' +
      '<b>颜色</b> 一份是字母，两份起才是 Σ：<code>CV.mix(原色, DEEP, (份数−1)/3)</code>，1 份 → 2 份混 1/3<br>' +
      '<b>全程时长</b> 单次融合 <code>' + nx(v('fuseDur')) + 's</code>、多列错峰 <code>' + nx(v('mergeGap')) +
        's</code>（规范 · 所有页面共用，和落位弹跳的 seatGap 同一层级）；' +
        '合起来 = 一列接一列折进去的节奏，页面不该另写一份<br>' +
      '<b>不属于规范的间隔</b> 这一趟折完到下一趟开始之间停多久是页面编排，在原语页齿轮里填秒';
    }
    sp.innerHTML = specHTML();

    CV.params.onChange(function (ch) {
      if (ch.section !== '09-merge' && ch.section !== '*') return;
      /* A 那组是 rAF 常驻，下一帧自己就读到新参数；B 是四个定格，必须重新 apply */
      framesB.forEach(function (f) { f.m.reset(); f.m.apply(f.p); });
      sp.innerHTML = specHTML();
    });
  })();

  /* ══════════════════════════════════════════════════════════
     10 聚焦：hover 临时 / click 钉住
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('focus', '10', '聚焦', 'focus');

    var A = demo(s, 460, 200, '两行四列的数据块：悬停或点击某一块，其余褪成灰');
    A.classList.add('focus-demo');   /* 样式在 anatomy.css，值与 stage.css 逐行对照 */

    var xs = [75, 163, 251, 339], ys = [34, 102];
    DATA.forEach(function (d2, k) {
      ys.forEach(function (y) {
        CV.setSlot(CV.drawSlot(A, xs[k], y, 46, 46), d2, {});
      });
    });

    var fo = CV.attachFocus(A, { keepCards: function () { return []; } });
    var fp = h('p', 'specs', s);
    var hv = '';    /* 自己记一份 hover：attachFocus 的 current() 是 hover||pinned，显示时分不开 */
    function upd() {
      fp.innerHTML =
        '<b>交互</b> 悬停任意一块 → 其余立刻褪色；<b>点一下</b>把当前聚焦钉住（鼠标移走仍保持），' +
        '再点同一块取消 · 当前 <code>hover ' + (hv || '—') + '</code>' +
        ' <code>pinned ' + (fo.pinned() || '—') + '</code><br>' +
        '<b>规则</b> 聚焦 = <code>hover || pinned</code>（指针优先）· 写到 <code>#stage</code> 的 ' +
        '<code>data-focus</code> 上，钉住状态另写 <code>data-pinned</code> · 点舞台空白不改变（有意为之）';
    }
    A.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest('[data-l]') : null;
      hv = t ? t.getAttribute('data-l') : '';
      upd();
    });
    A.addEventListener('pointerleave', function () { hv = ''; upd(); });
    A.addEventListener('click', upd);
    upd();

    /* 图二：褪色的具体色值 —— 不是统一降透明度，那样会糊成一片 */
    h('h3', null, s).textContent = '褪色值 · 只盖 fill，不碰其它属性';
    var B = demo(s, 560, 176, '聚焦时各类元素的原色与褪色色值对照');

    subTx(B, 120, 22, '原色', '#939bb2', 10);
    subTx(B, 186, 22, '聚焦后', '#939bb2', 10);

    [
      ['数据块底',   '#7c3aed', '#e4e8f0'],
      ['块内字母',   '#ffffff', '#b7becc'],
      ['连线',       '#c3cadb', '#ccd2e0'],
      ['卡片标题条', '#7c3aed', '#e8ecf4'],
      ['卡片标题',   '#ffffff', '#aeb6c7'],
      ['卡片边框',   '#e2e6f0', '#eef1f8']
    ].forEach(function (r, k) {
      var y = 40 + k * 22;
      subTx(B, 24, y + 11, r[0], '#5f6780', 10, 'start');
      el('rect', {
        x: 120, y: y, width: 34, height: 14, rx: 4,
        fill: r[1], stroke: '#d3d8e6', 'stroke-width': 1
      }, B);
      el('path', { d: 'M 162 ' + (y + 7) + ' L 174 ' + (y + 7) + ' M 171 ' + (y + 4) + ' L 174 ' + (y + 7) + ' L 171 ' + (y + 10), fill: 'none', stroke: '#c3cadb', 'stroke-width': 1.2 }, B);
      el('rect', {
        x: 186, y: y, width: 34, height: 14, rx: 4,
        fill: r[2], stroke: '#e2e6f0', 'stroke-width': 1
      }, B);
      subTx(B, 232, y + 11, r[1] + '  →  ' + r[2], '#939bb2', 10, 'start');
    });

    var sp = h('p', 'specs', s);
    sp.innerHTML =
      '<b>为什么不用 filter</b> SVG 元素上 <code>filter: grayscale()</code> 实测不生效，' +
        '只能覆盖 <code>fill</code> 再降一点 <code>opacity</code>（.78）<br>' +
      '<b>谁不参与</b> 正在飞的数据包 <code>.pkt</code> 的 opacity 由时间轴逐帧写，' +
        '必须排除在 opacity 规则之外 —— 否则隐藏的包会被强制显示，还晚半拍<br>' +
      '<b>过渡</b> 统一 .5s <code>cubic-bezier(.45,.05,.55,.95)</code>；连线只过渡 <code>stroke</code>，不碰 <code>dash</code>';
  })();

  /* ══════════════════════════════════════════════════════════
     10 舞台分层
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('layers', '11', '舞台分层', 'stage layers');

    /* 六层：文档顺序 = z 序。SVG 没有 z-index，后写的压在先写的上面。 */
    var L = [
      ['#lLabels', '计算方牌 · 悬停气泡 · 尺寸标注'],
      ['#lFx',     '数据包 · 两段拖尾 · 落位涟漪'],
      ['#lWires',  '连线与箭头（虚线 8 7）'],
      ['#lChips',  '数据块（8 个 / 4 个）'],
      ['#lCards',  'rank 卡片（白底 + 标题条）'],
      ['#lBg',     '网格背景 + 图例虚线框']
    ];

    var A = demo(s, 700, 300, '舞台的六个分组，从下往上是文档顺序');

    L.forEach(function (row, i) {
      var y = 38 + i * 40;
      var top = i === 0;
      el('rect', {
        x: 116, y: y, width: 150, height: 32, rx: 8,
        fill: top ? '#f3eeff' : '#fff',
        stroke: top ? '#d7c9fb' : '#e2e6f0', 'stroke-width': 1.2
      }, A);
      subTx(A, 128, y + 20, row[0], top ? '#6d28d9' : '#5f6780', 10, 'start');
      subTx(A, 282, y + 20, row[1], '#939bb2', 10, 'start');
    });

    /* 左侧那条箭头：往上 = 越后写 */
    el('path', {
      d: 'M 78 258 L 78 46 M 74 54 L 78 44 L 82 54',
      fill: 'none', stroke: '#c3cadb', 'stroke-width': 1.2, 'stroke-linecap': 'round'
    }, A);
    subTx(A, 78, 276, '先写', '#b3bacb', 10);
    subTx(A, 78, 32, '后写', '#939bb2', 10);

    var sp = h('p', 'specs', s);
    sp.innerHTML =
      '<b>顺序 = z 序</b> 六个固定的 <code>&lt;g&gt;</code> 写在 <code>#stage</code> 里，' +
        '顺序永不变：<code>lBg → lCards → lChips → lWires → lFx → lLabels</code>。' +
        'SVG 没有 <code>z-index</code>，谁压谁只看文档顺序<br>' +
      '<b>为什么是这个顺序</b> 连线要压在卡片白底上（否则虚线被吃掉）→ 数据包要压在连线上' +
        '（否则飞到中途被线穿过）→ 标注永远最上层（否则气泡被包挡住）<br>' +
      '<b>它同时是重建的边界</b> 回开头 / 切断点时 <code>buildStage()</code> 只做「六层各 ' +
        '<code>innerHTML = \'\'</code> 再按同一顺序重画」，不动页面上别的东西';

    /* 图二：顺序错一步的后果 —— 用最直观的一组：卡片白底 vs 数据块。
       先画块再画卡，四个块会被白底整个吃掉，卡片看起来是空的。 */
    h('h3', null, s).textContent = '顺序错一步，画面就是错的';
    var B = demo(s, 700, 226, '同样的卡片和数据块，两种文档顺序的结果对比');

    function panel(px, wrong) {
      var cardX = px + 20, cardY = 46, w = 180, h = 106;

      function drawCard() {
        CV.drawCard(B, {
          key: px, geo: { x: cardX, y: cardY, w: w, h: h }, color: DATA[0].color,
          title: 'rank 0', role: 'dst', target: true, hdr: 30, titleSize: 11.5, badgeSize: 8.5
        });
      }
      function drawChips() {
        [0, 1, 2, 3].forEach(function (k) {
          var sl = CV.drawSlot(B, cardX + 21 + k * 36, cardY + 38, 30, 30);
          CV.setSlot(sl, DATA[k], {});
        });
      }
      /* 先块后卡（错）时，卡片的白底把四个块整个盖住 */
      if (wrong) { drawChips(); drawCard(); } else { drawCard(); drawChips(); }

      subTx(B, cardX + w / 2, 24, wrong ? '先块后卡 ✗' : '先卡后块 ✓', wrong ? '#b4741a' : '#059669', 10);
      subTx(B, cardX + w / 2, 208, wrong ? '四个块被白底整个吃掉 —— 卡片看起来是空的' : '块画在卡片白底之上，四个都在', '#939bb2', 10);
    }
    panel(20, false);
    panel(354, true);

    var sp2 = h('p', 'specs', s);
    sp2.innerHTML =
      '<b>同样的坑</b> 连线先于卡片画 → 虚线被白底吃掉一截；包先于连线画 → 虚线从包身上横穿过去。<br>' +
      '<b>自查方法</b> 在 DevTools 里临时把某一层的 <code>display</code> 关掉，看还有没有东西被别的层挡着。';
  })();

  /* ══════════════════════════════════════════════════════════
     11 两套尺寸
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('scale', '12', '两套尺寸', 'GEO');
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
     12 施工约定
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('rules', '13', '施工约定', 'rules');

    var ol = h('ol', 'rules', s);
    [
      '尺寸只从本页 <code>GEO</code> 抄。SVG 等比缩放，<b>viewBox 数字越小 → 整页内容越大</b>，改完用 <code>getBoundingClientRect()</code> 量，别凭数字猜。',
      '组件只走 <code>assets/cv/</code> 的绘制函数，不手写 <code>rect</code> / <code>text</code>；要改尺寸改 <code>GEO</code>，不改绘制代码。',
      '卡内三处字号（标题 / 徽章 / 块内字母）由绘制函数写在 <code>font-size</code> 属性上，<b>CSS 里别再写</b> —— class 选择器会盖掉属性，窄屏就会顶着桌面字号（曾经 25 的块里塞着 15 的字）。',
      '断点 860px：<code>&lt; 860</code> 用窄屏一套；切换时重建舞台，再按当前进度重绘。',
      '下标分工：数据块挂 <code>data-l</code>（聚焦），卡片挂 <code>data-card</code>（置灰）。整份数据的连线与箭头不带 <code>data-l</code>，但整份包内部的小方块要带。',
      '新增原语 = 复制 <code>assets/reduce.js</code>，只改 <code>DATA</code> / <code>ROUTE</code> / <code>STEPS</code> / <code>GEO</code>，再加落位那一段。',
      '动效只调函数：落位用 <code>CV.spawnPulse</code>，融合用 <code>CV.createMerge</code>，聚焦用 <code>CV.attachFocus</code>。参数写在 <code>stage.css</code> 里，本页为了不加载它抄了一份 —— <b>改一边必须改另一边</b>。唯一例外是 <code>reduce</code> 的融合：它的整份包外层已有位移 transform，再叠一层会变黑块，所以用 <code>CV.cubicBezier</code> 逐点复刻同一条曲线（<code>POP_EASE</code>）。'
    ].forEach(function (x) { h('li', null, ol).innerHTML = x; });

    h('h3', null, s).textContent = '本轮已按本页对齐（2026-10-27）';
    var ul2 = h('ul', 'todo flat', s);
    [
      ['标题字号', '.gpu-title 写死 18px', '已删 → 走 GEO 的 15 / 12.5'],
      ['徽章字号', '.dst-badge 写死 10px', '已删 → 走 GEO 的 10 / 8.5'],
      ['数据块字母', '.slot-tx 钉死 15px', '已改 0.33 × 块高（15 / 8）'],
      ['All-Reduce 累加器', '52×52 / 30×30', '已改 46 / 25'],
      ['All-to-All 数据块', '44 · 间距 10 · 行距 8', '已改 46 · 12 · 12'],
      ['Reduce 计算态回收', '方框边淡出边收窄', '已改「先灭、再收」两步']
    ].forEach(function (x) {
      var li = h('li', null, ul2);
      h('b', null, li).textContent = x[0];
      var code = h('code', null, li);
      code.textContent = x[1];
      h('span', null, li).textContent = x[2];
    });
  })();

  /* ══════════════════════════════════════════════════════════
     左侧悬浮目录
     ------------------------------------------------------------
     固定在视口左侧、上下居中（CSS 的 top:50% + translateY(-50%)），
     所以跳转前后位置完全一样 —— 它不属于文档流，不会跟着滚。
     滚动时高亮「当前读到哪一节」：把视口 32% 高度处那条线以上的
     最后一节算作当前节。
     ══════════════════════════════════════════════════════════ */
  (function () {
    var secs = [].slice.call(app.querySelectorAll('.sec'));
    if (!secs.length) return;

    var nav = h('nav', 'toc');
    nav.setAttribute('aria-label', '章节导航');
    h('div', 'toc-t', nav).textContent = '章节目录';

    var links = secs.map(function (s2) {
      var a = h('a', null, nav);
      var secNo = (s2.querySelector('.sec-no') || {}).textContent || s2.id;
      a.href = '#sec-' + secNo;
      a.title = s2.getAttribute('data-title') || s2.id;
      var no = s2.querySelector('.sec-no');
      h('i', null, a).textContent = no ? no.textContent : '';
      h('span', null, a).textContent = s2.getAttribute('data-title') || s2.id;
      a.onclick = function (e) {
        e.preventDefault();
        showSection(secNo);          /* 单章视图：点目录 = 切到那一节 */
      };
      return a;
    });
    document.body.appendChild(nav);

    function setOn(a) {
      links.forEach(function (x, k) { x.className = x === a ? 'on' : ''; });
    }

    /* 点击后锁定高亮，直到用户真的手动滚动（滚轮 / 触摸 / 键盘）。 */
    var lockA = null;
    ['wheel', 'touchstart', 'keydown'].forEach(function (t) {
      window.addEventListener(t, function () { lockA = null; }, { passive: true });
    });

    /* 单章视图：同一时刻只显示一节，其余 display:none。
       左侧目录 / 右侧二级导航 / 参数台「定位」都走这里切换章节。 */
    /* 只负责「把某一节显示出来」，返回它在 secs 里的下标（-1 = 没有这一节） */
    function applyNo(no) {
      var idx = -1;
      secs.forEach(function (s2, k) {
        var n = (s2.querySelector('.sec-no') || {}).textContent || '';
        var on = (n === no);
        s2.style.display = on ? '' : 'none';
        s2.classList.toggle('is-active', on);
        if (on) idx = k;
      });
      return idx;
    }

    function showSection(no) {
      var idx = applyNo(no);
      if (idx < 0) {
        /* 锚点指向不存在的节（旧链接 / 手改 hash）：不回退就是整页空白 */
        no = (secs[0].querySelector('.sec-no') || {}).textContent || '01';
        idx = applyNo(no);
      }
      window.scrollTo(0, 0);
      if (idx >= 0) { lockA = links[idx]; setOn(links[idx]); }
      history.replaceState(null, '', '#sec-' + no);
      if (window.CV && window.CV._sectionChanged) window.CV._sectionChanged(no);
    }

    window.CV = window.CV || {};
    window.CV.showSection = showSection;
  })();

  /* ══════════════════════════════════════════════════════════
     二级导航（右侧悬浮）：列出「当前一节」下面的所有二级标题
     —— 与左侧章节目录互补：左 = 01~13 节，右 = 当前节的子标题。
     点按平滑滚动到该子标题；滚动时高亮「当前读到的子标题」。
     无子标题的节（01/02/04/12）右侧导航自动隐藏。
     ══════════════════════════════════════════════════════════ */
  (function () {
    var secs = [].slice.call(app.querySelectorAll('.sec'));
    if (!secs.length) return;

    /* ── 第一步：给每个二级标题编号 + 锚点 id ── */
    function subText(h3) {
      var t = '';
      h3.childNodes.forEach(function (n) {
        if (n.nodeType === 3) t += n.textContent;                       /* 普通文本节点 */
        else if (n.classList && !n.classList.contains('sub-no')) t += n.textContent;
      });
      return t.trim();
    }
    var subMap = {};                       /* secNo -> [{ id, no, text }] */
    secs.forEach(function (s) {
      var no = (s.querySelector('.sec-no') || {}).textContent || '';
      var hs = [].slice.call(s.querySelectorAll('h3'));
      var list = [];
      hs.forEach(function (h3, i) {
        var idx = i + 1;
        var id = 'sub-' + no + '-' + idx;
        h3.id = id;
        var badge = document.createElement('span');
        badge.className = 'sub-no';
        badge.textContent = no + '.' + idx;
        h3.insertBefore(badge, h3.firstChild);
        list.push({ id: id, no: no + '.' + idx, text: subText(h3) });
      });
      if (list.length) subMap[no] = list;
    });

    /* ── 第二步：构建右侧浮动导航 ── */
    var nav = document.createElement('nav');
    nav.className = 'rtoc';
    nav.setAttribute('aria-label', '分节导航');
    var title = document.createElement('div');
    title.className = 'rtoc-t';
    title.textContent = '本节子目录';
    nav.appendChild(title);
    var navBody = document.createElement('div');
    navBody.className = 'rtoc-body';
    nav.appendChild(navBody);
    document.body.appendChild(nav);

    var links = [];
    var lockA = null;
    var hasSubs = false;
    var dockOpen = false;
    function setOn(a) { links.forEach(function (x) { x.className = x === a ? 'on' : ''; }); }
    function applyVis() {
      nav.style.display = (window.innerWidth >= 1280 && hasSubs && !dockOpen) ? 'block' : 'none';
    }
    function build(no) {
      navBody.innerHTML = '';
      links = [];
      var items = subMap[no] || [];
      hasSubs = !!items.length;
      items.forEach(function (it) {
        var a = document.createElement('a');
        a.href = '#' + it.id;
        a.title = it.text;
        var i = document.createElement('i'); i.textContent = it.no;
        var sp = document.createElement('span'); sp.textContent = it.text;
        a.appendChild(i); a.appendChild(sp);
        a.onclick = function (e) {
          e.preventDefault();
          var el = document.getElementById(it.id);
          if (!el) return;
          var top = el.getBoundingClientRect().top + window.pageYOffset - 12;
          window.scrollTo({ top: top, behavior: 'smooth' });
          history.replaceState(null, '', '#' + it.id);
          lockA = a; setOn(a);
        };
        navBody.appendChild(a);
        links.push(a);
      });
      applyVis();
    }

    var shownNo = null;
    /* 右侧二级导航只在本节内部高亮「当前读到的子标题」；
       切节由 showSection（左侧目录 / 定位）统一驱动，不在这里按滚动切。 */
    function spy() {
      if (!links.length) return;
      var y = window.pageYOffset + window.innerHeight * 0.32;
      var cu = 0;
      links.forEach(function (a, k) {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        if (el && el.getBoundingClientRect().top + window.pageYOffset <= y) cu = k;
      });
      if (!lockA) setOn(links[cu]);
    }
    /* 单章视图：左侧目录 / 参数台「定位」切节时，由这里重建右导航 */
    window.CV = window.CV || {};
    window.CV._sectionChanged = function (no) {
      shownNo = no;
      build(no);
      lockA = null;
    };
    ['wheel', 'touchstart', 'keydown'].forEach(function (t) {
      window.addEventListener(t, function () { lockA = null; }, { passive: true });
    });
    /* 滚动停下后再判当前节：html 设了 scroll-behavior:smooth，
       用 rAF 节流只会抓到滚动起点（pageYOffset 还没到位），
       所以改成「滚动停止 ~120ms 后」再跑，保证读到落定后的位置。
       spy 很轻量（只读十几个标题的 rect），且只在切节时重建导航。 */
    var navTo = null;
    function onScroll() { if (navTo) clearTimeout(navTo); navTo = setTimeout(spy, 120); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', spy);
    spy();

    /* 参数台打开时，右侧导航让位（避免压在一起）。
       paramEditor.js 在本文件之后才加载，所以它创建的 .param-dock 此刻可能还不存在；
       轮询等它出现后再挂观察器，并记得每次开/关都要重算显隐。 */
    var dock = null;
    function syncDock() {
      dockOpen = !!(dock && getComputedStyle(dock).display !== 'none');
      applyVis();
    }
    (function setupDockWatch() {
      dock = document.querySelector('.param-dock');
      if (!dock) { setTimeout(setupDockWatch, 50); return; }
      new MutationObserver(syncDock).observe(dock, { attributes: true, attributeFilter: ['style'] });
      syncDock();
    })();
    window.addEventListener('scroll', syncDock, { passive: true });
    window.addEventListener('resize', syncDock);

    /* 单章视图：初始只显示某一节（URL 锚点优先，否则 01） */
    (function initSection() {
      var no = '01';
      var hsh = location.hash.replace(/^#/, '');
      if (hsh) {
        if (hsh.indexOf('sec-') === 0) no = hsh.slice(4);
        else if (hsh.indexOf('sub-') === 0) no = hsh.split('-')[1] || no;
      }
      if (window.CV && window.CV.showSection) window.CV.showSection(no);
      /* 带 #sub-xx-n 进来时：showSection 会滚回顶部并把 hash 重写成 #sec-xx，
         所以子标题必须在它之后再滚一次 —— 否则这个锚点等于没生效 */
      if (hsh.indexOf('sub-') === 0) {
        var t = document.getElementById(hsh);
        if (t) {
          window.scrollTo(0, t.getBoundingClientRect().top + window.pageYOffset - 12);
          /* showSection 把 hash 改成了 #sec-xx，这里补回来：
             否则「复制地址栏」拿到的是整节而不是刚跳到的二级标题，
             与参数台「定位」跳完留下的 #sub-xx-n 也不一致。 */
          history.replaceState(null, '', '#' + hsh);
        }
      }
      spy();                                /* 初始高亮本节首个子标题 */
    })();
  })();
})();
