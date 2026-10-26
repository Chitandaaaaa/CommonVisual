/* ============================================================
   CommonVisual · 组件与动效规范
   ------------------------------------------------------------
   这一页是全站基础组件的「唯一来源」：名字、尺寸、配色都在这里约定。

   demo 不手写 SVG —— 直接调用 assets/cv/ 里真实的绘制函数
   （CV.drawLegend / CV.drawSlot / CV.setSlot / CV.drawCard），
   保证「规范即实现」：改绘制函数，这一页同时跟着变。

   已定稿的三个基础组件：
     ① 完整数据（whole）  一份 = 4 个数据块
     ② 数据块（slot）     卡里的一个缓冲槽，三态
     ③ rank 卡片（card）  白底 + 彩色标题条 + 角色徽章
   后续章节（连线 / 数据包 / 动效曲线 / 聚焦 / 控制条）
   按本页同一格式陆续补充，见「待补充」一节。
   ============================================================ */
(function () {
  'use strict';
  var el = CV.el, h = CV.h, $ = CV.$;

  /* ══════════════════════════════════════════════════════════
     规范数据
     ══════════════════════════════════════════════════════════ */

  /* 一份完整数据 = 4 段，rank 与它持有的那段同色 */
  var DATA = [
    { letter: 'A', color: '#7c3aed', rank: 0, cn: '紫' },
    { letter: 'B', color: '#0891b2', rank: 1, cn: '青' },
    { letter: 'C', color: '#059669', rank: 2, cn: '绿' },
    { letter: 'D', color: '#d97706', rank: 3, cn: '橙' }
  ];
  var SIGMA = '#4c1d95';          /* 归约结果：深紫 */

  /* 宽窄两套几何，一个数字都不允许页面级自定义 */
  var G = {
    desktop: { view: { w: 1130, h: 680 }, card: { w: 300, h: 170 }, slot: { sw: 46, sh: 46, gap: 12 }, hdr: 36, title: 15, badge: 10 },
    narrow:  { view: { w: 380,  h: 720 }, card: { w: 146, h: 126 }, slot: { sw: 25, sh: 25, gap: 5  }, hdr: 28, title: 12.5, badge: 8.5 }
  };

  var SECTIONS = [
    { id: 'whole',  no: '01', title: '完整数据',  en: 'whole' },
    { id: 'slot',   no: '02', title: '数据块',    en: 'slot' },
    { id: 'card',   no: '03', title: 'rank 卡片', en: 'card' },
    { id: 'global', no: '04', title: '全局约定',  en: 'GEO & rules' },
    { id: 'todo',   no: '05', title: '待补充',    en: 'roadmap' }
  ];

  /* ══════════════════════════════════════════════════════════
     小工具
     ══════════════════════════════════════════════════════════ */

  var app = $('#app');

  function sec(id, no, title, en, lead) {
    var s = h('section', 'sec', app);
    s.id = id;
    var hd = h('div', 'sec-hd', s);
    var t = h('h2', null, hd);
    t.innerHTML = '<span class="sec-no">' + no + '</span>' + title + '<em>' + en + '</em>';
    h('p', null, hd).innerHTML = lead;
    return s;
  }

  /* 表格：与 algorithms 页同一套 .tbl 语言。单元格传 HTML 字符串 */
  function tbl(host, head, rows) {
    var wrap = h('div', 'tbl-wrap', host);
    var t = h('table', 'tbl', wrap);
    var tr = h('tr', null, h('thead', null, t));
    head.forEach(function (x) { h('th', null, tr).textContent = x; });
    var tb = h('tbody', null, t);
    rows.forEach(function (r) {
      var line = h('tr', null, tb);
      r.forEach(function (c) {
        var td = h('td', null, line);
        if (typeof c === 'string') td.innerHTML = c;
        else td.textContent = String(c);
      });
    });
    return t;
  }

  /* 示例面板：里面放一个真实绘制函数渲染的 SVG */
  function demo(host, vbW, vbH, cap, aria) {
    var box = h('div', 'demo', host);
    if (cap) h('p', 'demo-cap', box).textContent = cap;
    var s = el('svg', {
      viewBox: '0 0 ' + vbW + ' ' + vbH,
      width: vbW, height: vbH,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': aria || cap || ''
    });
    box.appendChild(s);
    /* drawCard 硬编码引用 #fCard，每个 demo 自带一份 defs */
    var d = el('defs', {}, s);
    var f = el('filter', { id: 'fCard', x: '-40%', y: '-40%', width: '180%', height: '190%' }, d);
    el('feDropShadow', { dx: 0, dy: 6, stdDeviation: 12, 'flood-color': '#2a3352', 'flood-opacity': '.1' }, f);
    return s;
  }

  /* ── SVG 标注：尺寸线 / 引线 / 小标题 ── */
  function dimH(s, x1, x2, y, label) {
    var g = el('g', { class: 'dim' }, s);
    el('line', { x1: x1, y1: y, x2: x2, y2: y }, g);
    [x1, x2].forEach(function (x) { el('line', { x1: x, y1: y - 4, x2: x, y2: y + 4 }, g); });
    var t = el('text', { class: 'dim-tx', x: (x1 + x2) / 2, y: y + 14, 'text-anchor': 'middle' }, g);
    t.textContent = label;
  }
  function dimV(s, x, y1, y2, label, left) {
    var g = el('g', { class: 'dim' }, s);
    el('line', { x1: x, y1: y1, x2: x, y2: y2 }, g);
    [y1, y2].forEach(function (y) { el('line', { x1: x - 4, y1: y, x2: x + 4, y2: y }, g); });
    var t = el('text', {
      class: 'dim-tx', x: left ? x - 7 : x + 7, y: (y1 + y2) / 2,
      'text-anchor': left ? 'end' : 'start', 'dominant-baseline': 'central'
    }, g);
    t.textContent = label;
  }
  function lead(s, x1, y1, x2, y2, label, anchor) {
    var g = el('g', { class: 'dim' }, s);
    el('path', { d: 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2, fill: 'none', 'stroke-dasharray': '2 2' }, g);
    var t = el('text', {
      class: 'dim-tx', x: x2, y: y2,
      'text-anchor': anchor || 'start', 'dominant-baseline': 'central'
    }, g);
    t.textContent = label;
  }
  function capTx(s, x, y, text) {
    var t = el('text', { class: 'cap-tx', x: x, y: y }, s);
    t.textContent = text;
  }
  function labelTx(s, cx, y, text) {
    var t = el('text', { class: 'dim-tx', x: cx, y: y, 'text-anchor': 'middle' }, s);
    t.textContent = text;
  }
  function sw(color) { return '<i class="sw" style="--c:' + color + '"></i>'; }

  /* ══════════════════════════════════════════════════════════
     索引
     ══════════════════════════════════════════════════════════ */
  var jump = $('#jump');
  SECTIONS.forEach(function (x) {
    var a = h('a', null, jump);
    a.href = '#' + x.id;
    a.textContent = x.no + ' ' + x.title;
  });

  /* ══════════════════════════════════════════════════════════
     01 完整数据
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('whole', '01', '完整数据', 'whole',
      '所有原语操作的对象都是「一份完整数据」= <b>4 个数据块</b>。它是全站最小的完整单位：' +
      '图例、broadcast 的整份包、reduce 的累加器，用的都是它。');

    var slot = G.desktop.slot;
    var s1 = demo(s, 300, 140,
      '桌面尺寸 1:1 —— 由 CV.drawLegend() 真实渲染，不是示意图',
      '一份完整数据：四个数据块并排，外侧一圈虚线框');
    CV.drawLegend(s1, { x: 29, y: 18, slot: slot, items: DATA });
    /* 图例盒：pad = round(46×0.24) = 11，总宽 4×46 + 3×12 = 220，盒宽 242、高 68 */
    dimH(s1, 40, 86, 100, '46');
    dimH(s1, 29, 271, 124, '242');

    tbl(s, ['段', '数据字母', '色值', '同色 rank', '角色'], [
      ['第 1 段', sw(DATA[0].color) + '<b>A</b>', '<code>#7c3aed</code>', 'rank 0', '紫'],
      ['第 2 段', sw(DATA[1].color) + '<b>B</b>', '<code>#0891b2</code>', 'rank 1', '青'],
      ['第 3 段', sw(DATA[2].color) + '<b>C</b>', '<code>#059669</code>', 'rank 2', '绿'],
      ['第 4 段', sw(DATA[3].color) + '<b>D</b>', '<code>#d97706</code>', 'rank 3', '橙'],
      ['归约结果', sw(SIGMA) + '<b>Σ</b>', '<code>#4c1d95</code>', '——', '深紫，多卡终态同色']
    ]);

    h('h3', null, s).textContent = '命名';
    tbl(s, ['叫什么', '代码', '说明'], [
      ['完整数据', '<code>DATA</code> 数组', '每项 <code>{ letter, color }</code>，全站唯一来源，各原语页照抄'],
      ['画出来', '<code>CV.drawLegend()</code>', 'assets/cv/kit.js，返回 <code>.whole</code> 组'],
      ['字幕里的字母', '<code>em.cA ~ cD</code>', '与画面中的数据块同色，一眼对上'],
      ['字幕里的 rank', '<code>em.rk.r0 ~ r3</code>', 'rank 编号与它持有的那段同色'],
      ['归约结果', '<code>Σ</code> / <code>#4c1d95</code>', 'All-Reduce 终态四卡同一块深紫，颜色就是语义']
    ]);
  })();

  /* ══════════════════════════════════════════════════════════
     02 数据块
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('slot', '02', '数据块', 'slot',
      '数据块是 rank 卡片里的一个缓冲槽，只有<b>三种状态</b>。所有页面共用同一套尺寸与三态配色，' +
      '不允许页面级自定义；建场一律走 <code>CV.drawSlot</code>，改状态一律走 <code>CV.setSlot</code>。');

    var s1 = demo(s, 360, 248,
      '桌面 46×46 与窄屏 25×25 两套，1:1 真实尺寸，由 CV.drawSlot() + CV.setSlot() 渲染',
      '数据块的三种状态：有数据、传输中、空');
    var D = G.desktop.slot, N = G.narrow.slot;

    capTx(s1, 0, 12, '桌面 ' + D.sw + ' × ' + D.sh);
    var xs1 = [10, 96, 182], y1 = 26;
    var a1 = CV.drawSlot(s1, xs1[0], y1, D.sw, D.sh);
    var b1 = CV.drawSlot(s1, xs1[1], y1, D.sw, D.sh);
    var c1 = CV.drawSlot(s1, xs1[2], y1, D.sw, D.sh);
    CV.setSlot(a1, DATA[0], {});
    CV.setSlot(b1, null, { active: true });
    CV.setSlot(c1, null, {});
    labelTx(s1, xs1[0] + D.sw / 2, y1 + D.sh + 18, '有数据');
    labelTx(s1, xs1[1] + D.sw / 2, y1 + D.sh + 18, '传输中');
    labelTx(s1, xs1[2] + D.sw / 2, y1 + D.sh + 18, '空');
    dimH(s1, xs1[0], xs1[0] + D.sw, y1 + D.sh + 34, String(D.sw));

    capTx(s1, 0, 148, '窄屏 ' + N.sw + ' × ' + N.sh);
    var xs2 = [10, 65, 120], y2 = 162;
    var a2 = CV.drawSlot(s1, xs2[0], y2, N.sw, N.sh);
    var b2 = CV.drawSlot(s1, xs2[1], y2, N.sw, N.sh);
    var c2 = CV.drawSlot(s1, xs2[2], y2, N.sw, N.sh);
    CV.setSlot(a2, DATA[0], {});
    CV.setSlot(b2, null, { active: true });
    CV.setSlot(c2, null, {});
    labelTx(s1, xs2[0] + N.sw / 2, y2 + N.sh + 16, '有数据');
    labelTx(s1, xs2[1] + N.sw / 2, y2 + N.sh + 16, '传输中');
    labelTx(s1, xs2[2] + N.sw / 2, y2 + N.sh + 16, '空');
    dimH(s1, xs2[0], xs2[0] + N.sw, y2 + N.sh + 30, String(N.sw));

    h('h3', null, s).textContent = '三种状态';
    tbl(s, ['状态', '底色', '描边', '文字', '什么时候出现'], [
      ['有数据', '该段自身色', '无', '白色字母', '本卡持有这一段'],
      ['传输中', '<code>#f3eeff</code>', '<code>#a78bfa</code> 实线', '「···」<code>#a78bfa</code>', '正在收发，位子先占着（与 gather 的接收位同一种语言）'],
      ['空', '<code>#f7f8fc</code>', '<code>#d5dae8</code> 虚线 4 3', '无', '本卡没有这段']
    ]);

    h('h3', null, s).textContent = '命名';
    tbl(s, ['叫什么', '代码', '说明'], [
      ['创建', '<code>CV.drawSlot(parent, x, y, w, h)</code>', '返回 <code>.slot-g</code>（内含 <code>.slot-bg</code> + <code>.slot-tx</code>），圆角固定 8'],
      ['改状态', '<code>CV.setSlot(slot, data, { active, hidden })</code>', '<code>data</code> 有值 = 有数据；<code>data</code> 为空时按 <code>active</code> 区分传输中 / 空；<code>hidden</code> 供预留淡入'],
      ['聚焦标记', '<code>data-l="A"</code>', '挂在 <code>.slot-g</code> 上，cv/focus.js 靠它把其余字母灰掉'],
      ['落地弹跳', '<code>.slot-pop</code>', '0.55s <code>cubic-bezier(.2,.9,.3,1.45)</code>，scale .35 → 1.16 → 1；涟漪环 <code>SHOW_RING = false</code> 已定稿关闭'],
      ['文字字号', '<code>.slot-tx</code> 15px', 'CSS 会盖掉 SVG 属性，15px 是全站生效值（建场传的 <code>round(h×0.34)</code> 只是兜底）—— 已登记的待整改项']
    ]);
  })();

  /* ══════════════════════════════════════════════════════════
     03 rank 卡片
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('card', '03', 'rank 卡片', 'card',
      '一张 rank 卡片 = 白底 + 彩色标题条 + 标题 + 角色徽章，标题条以下的内容区放数据块。' +
      '四张卡初始必须<b>完全同构</b>（同高、数据块同位置），之后才允许按原语语义长高。');

    var s1 = demo(s, 840, 280,
      '桌面尺寸 1:1 —— CV.drawCard() 真实渲染，内容区各放一个数据块',
      'rank 卡片结构：dst 目标卡与 src 源卡，带尺寸标注');
    var cw = G.desktop.card.w, ch = G.desktop.card.h, hdr = G.desktop.hdr;

    /* dst 目标卡：开场是等待中的接收位 */
    var c1 = CV.drawCard(s1, {
      key: 0, geo: { x: 60, y: 40, w: cw, h: ch }, color: DATA[0].color,
      title: 'rank 0', role: 'dst', target: true,
      hdr: hdr, titleSize: G.desktop.title, badgeSize: G.desktop.badge
    });
    var areaY = 40 + hdr + (ch - hdr - 16 - G.desktop.slot.sh) / 2;
    var t1 = CV.drawSlot(s1, 60 + (cw - G.desktop.slot.sw) / 2, areaY, G.desktop.slot.sw, G.desktop.slot.sh);
    CV.setSlot(t1, null, { active: true });

    /* src 源卡：持有自己的那段 */
    var c2 = CV.drawCard(s1, {
      key: 1, geo: { x: 460, y: 40, w: cw, h: ch }, color: DATA[1].color,
      title: 'rank 1', role: 'src',
      hdr: hdr, titleSize: G.desktop.title, badgeSize: G.desktop.badge
    });
    var t2 = CV.drawSlot(s1, 460 + (cw - G.desktop.slot.sw) / 2, areaY, G.desktop.slot.sw, G.desktop.slot.sh);
    CV.setSlot(t2, DATA[1], {});

    /* 标注 */
    dimH(s1, 60, 60 + cw, 240, String(cw));
    dimV(s1, 40, 40, 40 + hdr, String(hdr), true);
    dimV(s1, 790, 40, 40 + ch, String(ch));
    lead(s1, 112, 62, 150, 20, '标题 ' + G.desktop.title + 'px');
    lead(s1, 348, 58, 400, 30, '徽章 dst 30×18');
    lead(s1, 750, 58, 776, 30, '徽章 src 28×18', 'end');

    h('h3', null, s).textContent = '结构（从外到内）';
    tbl(s, ['部件', '类名', '规格'], [
      ['白底', '<code>.card-base</code>', '<code>#fff</code>，圆角 14；普通卡描边 <code>#e3e7f0</code> 1px，目标卡 <code>#c9b6f7</code> 1.8px；投影 <code>#fCard</code>'],
      ['标题条', '<code>.card-bar</code>', 'rank 自身颜色，高 = <code>GEO.hdr</code>；上两角随卡片圆角、下边平直'],
      ['标题', '<code>.gpu-title</code>', '「rank N」，白色，<code>GEO.title</code> px，左偏 16'],
      ['徽章底', '<code>.card-badge-bg</code>', '<code>rgba(255,255,255,.26)</code>，圆角 6；src 28×18 / dst 30×18'],
      ['徽章字', '<code>.dst-badge</code>', '「src / dst」，白色 mono，<code>GEO.badge</code> px'],
      ['内容区', '（无独立元素）', '标题条以下、去掉 16 底留白：<code>card.h − hdr − 16</code> = 118（桌面）/ 82（窄屏）；数据块在其中上下居中']
    ]);

    h('h3', null, s).textContent = '命名';
    tbl(s, ['叫什么', '代码', '说明'], [
      ['创建', '<code>CV.drawCard(layer, opts)</code>', 'opts：<code>key / geo / color / title / role / target / hdr / titleSize / badgeSize</code>'],
      ['长高', '<code>CV.resizeCard(card, geo)</code>', '白底、标题条、标题、徽章全部重算 —— 别只改 rect 的 height（踩过的坑）'],
      ['卡片标记', '<code>data-card="0"</code>', 'focus.js 置灰用；数据块挂 <code>data-l</code>，两者不要混'],
      ['置灰态', '<code>data-dim="1"</code>', '由 <code>CV.attachFocus</code> 打上，CSS 只认这个属性'],
      ['长高规则', '中心固定', 'reduce 定稿：长高时上下同时扩，数据块位置全程常量，融合时不漂']
    ]);
  })();

  /* ══════════════════════════════════════════════════════════
     04 全局约定
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('global', '04', '全局约定', 'GEO & rules',
      '每个原语页的 <code>GEO</code> 只有两套值，逐项抄齐，一个数字都不允许自己定。');

    tbl(s, ['项目', '桌面', '窄屏', '代码名'], [
      ['舞台 viewBox', G.desktop.view.w + ' × ' + G.desktop.view.h, G.narrow.view.w + ' × ' + G.narrow.view.h, '<code>GEO.view</code>'],
      ['rank 卡片', G.desktop.card.w + ' × ' + G.desktop.card.h, G.narrow.card.w + ' × ' + G.narrow.card.h, '<code>GEO.card</code>'],
      ['标题条高', G.desktop.hdr, G.narrow.hdr, '<code>GEO.hdr</code>'],
      ['数据块', G.desktop.slot.sw + ' × ' + G.desktop.slot.sh, G.narrow.slot.sw + ' × ' + G.narrow.slot.sh, '<code>GEO.slot</code>'],
      ['块间距', G.desktop.slot.gap, G.narrow.slot.gap, '<code>GEO.slot.gap</code>'],
      ['标题字', G.desktop.title, G.narrow.title, '<code>GEO.title</code>'],
      ['徽章字', G.desktop.badge, G.narrow.badge, '<code>GEO.badge</code>'],
      ['两套切换断点', '≥ 860px', '&lt; 860px', '<code>syncLayout()</code>']
    ]);

    h('h3', null, s).textContent = '六条规则';
    var ol = h('ol', 'rules', s);
    [
      '尺寸只从本页 <code>GEO</code> 抄。SVG 是 <code>preserveAspectRatio="xMidYMid meet"</code> 等比缩放，' +
      '<b>viewBox 越小 → 缩放倍率越大 → 整页内容都变大</b>（踩过：850×530 比 1130×680 大 27%）。改完用像素探针量 <code>getBoundingClientRect()</code>，别凭 viewBox 猜。',
      '组件一律走 <code>assets/cv/</code> 的绘制函数，不手写 rect / text；要改尺寸改 <code>GEO</code>，不改绘制代码。',
      '断点 860px：<code>window.innerWidth &lt; 860</code> 用 narrow，否则 desktop；切换时重建舞台再重绘当前进度。',
      '下标约定：数据块挂 <code>data-l</code>（聚焦），卡片挂 <code>data-card</code>（置灰）；' +
      '整份数据的连线与箭头<b>不带</b> <code>data-l</code>，但整份包内部的每个小方块要带。',
      '新增原语页 = 复制 <code>assets/reduce.js</code>，只改 ① <code>DATA</code> ② <code>ROUTE</code> ③ <code>STEPS</code> ④ <code>GEO</code>，再加 <code>paint()</code> 里「槽位怎么落位」那一段。',
      '动效已定稿（用户确认）：落位只做放大弹跳，<b>不要涟漪扩散环</b>；CSS 过渡不和逐帧插值打架，连续渐隐渐现由 JS 每帧写 <code>style.opacity</code>。'
    ].forEach(function (x) { h('li', null, ol).innerHTML = x; });

    h('h3', null, s).textContent = '已知偏差登记';
    tbl(s, ['偏差', '现状', '处置'], [
      ['All-Reduce 累加器 52×52 / 30×30', '与规范的 46 / 25 不一致', '待整改为规范值'],
      ['数据块文字固定 15px', '窄屏 25 的块上明显偏大', '待改为随块高 <code>round(h×0.34)</code>'],
      ['徽章字号 10 / 10.5 并存', 'reduce 用 10.5，其余页面 10', '待统一为 10'],
      ['gather / scatter 源卡送完保留，reduce 清空', '复制 vs 消耗，语义不同', '非偏差，登记备查']
    ]);
  })();

  /* ══════════════════════════════════════════════════════════
     05 待补充
     ══════════════════════════════════════════════════════════ */
  (function () {
    var s = sec('todo', '05', '待补充', 'roadmap',
      '以下章节按本页同一格式陆续补上：<b>真实组件渲染 + 尺寸表 + 命名表 + 已知偏差</b>。');

    var ul = h('ul', 'todo', s);
    [
      ['连线与箭头', '.wire / .arw', 'drawWire / drawMarker，线色三档'],
      ['数据包', '.pkt', 'drawPacket，单色方块 24px + 两段拖尾'],
      ['整份包', '.pkt.batch', 'drawPacketBatch，一份的缩略条'],
      ['落位弹跳', '.slot-pop', 'spawnPulse，曲线已定稿'],
      ['悬停 / 钉住聚焦', 'cv/focus.js', 'data-focus / data-pinned / data-dim'],
      ['分段进度条', 'cv/controls.js', '段数 = STEPS.length，vToT 互逆换算'],
      ['舞台六层', '#lBg #lCards #lChips #lWires #lFx #lLabels', '建场顺序固定'],
      ['计算方框', '.calc-wrap', 'reduce 专用，显隐由 JS 逐帧给']
    ].forEach(function (x) {
      var li = h('li', null, ul);
      h('b', null, li).textContent = x[0];
      var code = h('code', null, li);
      code.textContent = x[1];
      h('span', null, li).textContent = x[2];
    });

    h('p', 'tail', s).innerHTML =
      '三个基础组件（完整数据 / 数据块 / rank 卡片）已定稿。整改现有页面时，' +
      '以本页 04 节的「已知偏差登记」为清单，逐项对齐。';
  })();
})();
