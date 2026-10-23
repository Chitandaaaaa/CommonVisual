/* ============================================================
   CommonVisual · 绘制原语
   卡片 / 数据块 / 连线 / 数据包 / 图例 / 落位脉冲
   全部只依赖参数，不含任何原语特有的时间轴逻辑
   ============================================================ */
(function (CV) {
  'use strict';
  var el = CV.el;

  /* ---------- 徽章几何：drawCard 与 resizeCard 共用 ----------
     「src」三个字母挤在 22×14 的小框里，文字几乎贴着边框。
     这里把框放大到 28×18，并让文字的垂直位置按新框高重算。
     传 text 则按文字长度算宽度（all-gather 用「1/4」这种进度徽章）。 */
  function badgeGeo(geo, role, text, size, hdr) {
    var h = 18, w;
    if (text) w = Math.max(30, Math.round(text.length * size * 0.60) + 18);
    else w = role === 'dst' ? 30 : 28;
    return {
      w: w, h: h,
      x: geo.x + geo.w - 14 - w,
      y: geo.y + (hdr - h) / 2
    };
  }

  /* ---------- 卡片：白底 + 彩色标题条 + 角色徽章 ---------- */
  CV.drawCard = function (parent, o) {
    var geo = o.geo, r = o.radius == null ? 14 : o.radius;
    var hdr = o.hdr, isTarget = !!o.target;

    var g = el('g', { class: 'gpu-card', 'data-card': o.key }, parent);

    var base = el('rect', {
      class: 'card-base',
      x: geo.x, y: geo.y, width: geo.w, height: geo.h, rx: r,
      fill: '#fff', stroke: isTarget ? '#c9b6f7' : '#e3e7f0',
      'stroke-width': isTarget ? 1.8 : 1, filter: 'url(#fCard)'
    }, g);

    /* 标题条：上两角随卡片圆角，下边平直 */
    var bar = el('path', {
      class: 'card-bar',
      d: 'M ' + geo.x + ' ' + (geo.y + hdr) +
         ' L ' + geo.x + ' ' + (geo.y + r) +
         ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + r) + ' ' + geo.y +
         ' L ' + (geo.x + geo.w - r) + ' ' + geo.y +
         ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + geo.w) + ' ' + (geo.y + r) +
         ' L ' + (geo.x + geo.w) + ' ' + (geo.y + hdr) + ' Z',
      fill: o.color
    }, g);

    var title = el('text', {
      class: 'gpu-title', x: geo.x + 16, y: geo.y + hdr * 0.68,
      'text-anchor': 'start', 'font-size': o.titleSize, fill: '#fff'
    }, g);
    title.textContent = o.title;

    var badgeBg = null, badgeTx = null;
    if (o.role || o.badgeText) {
      var bg = badgeGeo(geo, o.role, o.badgeText, o.badgeSize, hdr);
      badgeBg = el('rect', {
        class: 'card-badge-bg',
        x: bg.x, y: bg.y, width: bg.w, height: bg.h, rx: 6,
        fill: 'rgba(255,255,255,.26)'
      }, g);
      badgeTx = el('text', {
        class: 'dst-badge', x: bg.x + bg.w / 2, y: bg.y + bg.h / 2 + o.badgeSize * 0.25,
        'text-anchor': 'middle', 'font-size': o.badgeSize, fill: '#fff'
      }, g);
      badgeTx.textContent = o.badgeText || o.role;
    }

    return { g: g, geo: geo, base: base, bar: bar, title: title, badgeBg: badgeBg, badgeTx: badgeTx,
             radius: r, hdr: hdr, role: o.role, badgeText: o.badgeText, badgeSize: o.badgeSize };
  };

  /* ---------- 卡片尺寸变化时重画 ----------
     白底矩形、彩色标题条、标题文字、角色徽章都要跟着新的 geo 走。
     用于「卡片随时间轴长高」这类场景（reduce 的目标卡要预留第二排缓冲）。 */
  CV.resizeCard = function (card, geo) {
    var r = card.radius, hdr = card.hdr, g = card.geo;

    card.base.setAttribute('x', geo.x);
    card.base.setAttribute('y', geo.y);
    card.base.setAttribute('width', geo.w);
    card.base.setAttribute('height', geo.h);

    card.bar.setAttribute('d',
      'M ' + geo.x + ' ' + (geo.y + hdr) +
      ' L ' + geo.x + ' ' + (geo.y + r) +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + r) + ' ' + geo.y +
      ' L ' + (geo.x + geo.w - r) + ' ' + geo.y +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + geo.w) + ' ' + (geo.y + r) +
      ' L ' + (geo.x + geo.w) + ' ' + (geo.y + hdr) + ' Z');

    card.title.setAttribute('x', geo.x + 16);
    card.title.setAttribute('y', geo.y + hdr * 0.68);

    if (card.badgeBg) {
      var bg = badgeGeo(geo, card.role, card.badgeText, card.badgeSize, hdr);
      card.badgeBg.setAttribute('x', bg.x);
      card.badgeBg.setAttribute('y', bg.y);
      card.badgeBg.setAttribute('width', bg.w);
      card.badgeBg.setAttribute('height', bg.h);
      card.badgeTx.setAttribute('x', bg.x + bg.w / 2);
      card.badgeTx.setAttribute('y', bg.y + bg.h / 2 + card.badgeSize * 0.25);
    }

    g.x = geo.x; g.y = geo.y; g.w = geo.w; g.h = geo.h;
  };

  /* ---------- 数据块（缓冲槽） ---------- */
  CV.drawSlot = function (parent, x, y, w, h) {
    var g = el('g', { class: 'slot-g' }, parent);
    var rect = el('rect', {
      class: 'slot-bg', x: x, y: y, width: w, height: h, rx: 8,
      fill: '#f7f8fc', stroke: '#d5dae8', 'stroke-width': 1.3, 'stroke-dasharray': '4 3'
    }, g);
    var text = el('text', {
      class: 'slot-tx', x: x + w / 2, y: y + h / 2, 'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': Math.round(h * 0.34), fill: '#b9c0d2'
    }, g);
    return { g: g, rect: rect, text: text, x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2 };
  };

  /* 三种状态：有数据 / 传输中占位 / 空 */
  CV.setSlot = function (s, data, opt) {
    opt = opt || {};
    if (data) {
      s.rect.setAttribute('fill', data.color);
      s.rect.setAttribute('stroke', 'none');
      s.rect.setAttribute('stroke-dasharray', 'none');
      s.text.setAttribute('fill', '#fff');
      s.text.textContent = data.letter;
      if (s.g.getAttribute('data-l') !== data.letter) s.g.setAttribute('data-l', data.letter);
    } else if (opt.active) {
      s.rect.setAttribute('fill', '#f3eeff');
      s.rect.setAttribute('stroke', '#a78bfa');
      s.rect.setAttribute('stroke-dasharray', 'none');
      s.text.setAttribute('fill', '#a78bfa');
      s.text.textContent = '···';
      if (s.g.hasAttribute('data-l')) s.g.removeAttribute('data-l');
    } else {
      s.rect.setAttribute('fill', '#f7f8fc');
      s.rect.setAttribute('stroke', '#d5dae8');
      s.rect.setAttribute('stroke-dasharray', '4 3');
      s.text.setAttribute('fill', '#b9c0d2');
      s.text.textContent = '';
      if (s.g.hasAttribute('data-l')) s.g.removeAttribute('data-l');
    }
    /* 预留中的空位可以先隐藏（数据块淡入用） */
    s.g.style.opacity = opt.hidden ? '0' : '';
  };

  /* ---------- 箭头 marker（放在 defs 里，每个数据流一个） ---------- */
  CV.drawMarker = function (defs, id, letter) {
    var mk = el('marker', {
      id: id, viewBox: '0 0 8 8', refX: 8, refY: 4,
      markerWidth: 5.5, markerHeight: 5.5, orient: 'auto'
    }, defs);
    var attrs = { class: 'arw', d: 'M0,0 L8,4 L0,8 Z', fill: '#c3cadb' };
    if (letter) attrs['data-l'] = letter;
    var p = el('path', attrs, mk);
    return { marker: mk, path: p };
  };

  /* ---------- 连线 ---------- */
  /* letter 可省略：broadcast 这类「整份数据」的流不对应单一字母，不该参与聚焦灰化 */
  CV.drawWire = function (parent, o) {
    var attrs = {
      class: 'wire', d: o.d, fill: 'none',
      stroke: '#c3cadb', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-dasharray': '8 7',
      'marker-end': 'url(#' + o.markerId + ')'
    };
    if (o.letter) attrs['data-l'] = o.letter;
    var p = el('path', attrs, parent);
    return { path: p, len: p.getTotalLength() };
  };

  /* ---------- 飞行中的数据包：主体 + 两段拖尾 ---------- */
  CV.drawPacket = function (parent, o) {
    var g = el('g', { class: 'pkt', 'data-l': o.letter, opacity: 0 }, parent);
    var t2 = el('g', { opacity: .28 }, g);
    el('rect', { x: -8, y: -8, width: 16, height: 16, rx: 4.5, fill: o.color, filter: 'url(#fTrail)' }, t2);
    var t1 = el('g', { opacity: .55 }, g);
    el('rect', { x: -10, y: -10, width: 20, height: 20, rx: 5.5, fill: o.color, filter: 'url(#fTrail)' }, t1);
    var head = el('g', {}, g);
    el('rect', { x: -12, y: -12, width: 24, height: 24, rx: 6.5, fill: o.color, filter: 'url(#fGlow)' }, head);
    el('text', { class: 'pkt-tx', x: 0, y: 4.5, 'text-anchor': 'middle' }, head).textContent = o.letter;
    return { g: g, head: head, t1: t1, t2: t2 };
  };

  /* ---------- 整份数据包：「一份」数据的缩略条 ----------
     结构与 drawPacket 一致（g / head / t1 / t2），可直接交给 placePacket。
     用于 broadcast / reduce 这类以「整份数据」为单位移动的原语。
     half = 主体半宽，用于算起步偏移，避免大包从卡片边缘起步时压住卡片内容。 */
  CV.drawPacketBatch = function (parent, slot, items) {
    var m  = Math.round(slot.sw * 0.44);              /* 正方形边长，与槽位块同一形状语言 */
    var mg = Math.max(2, Math.round(slot.gap * 0.25));
    var rx = Math.max(3, Math.round(m * 0.25));
    var total = items.length * m + (items.length - 1) * mg;
    var pad = Math.round(m * 0.30);

    var g = el('g', { class: 'pkt batch', opacity: 0 }, parent);

    /* 每个小方块各自带 data-l，悬停时才跟着一起高亮 / 变灰。
       withText：只有主体带字母，拖尾是模糊影，带字会糊。 */
    function blocks(host, extra, withText) {
      items.forEach(function (d, i) {
        var bg = el('g', { 'data-l': d.letter }, host);
        var bx = -total / 2 + i * (m + mg);
        var attrs = { x: bx, y: -m / 2, width: m, height: m, rx: rx, fill: d.color };
        if (extra) attrs.filter = extra;
        el('rect', attrs, bg);
        if (withText) {
          var tx = el('text', {
            class: 'pkt-tx', x: bx + m / 2, y: 0,
            'text-anchor': 'middle', 'dominant-baseline': 'central'
          }, bg);
          /* .pkt-tx 的 CSS 固定 13px 是按 24px 方块调的，这里块更小，
             用内联 style 覆盖字号（style 优先级高于类） */
          tx.style.fontSize = Math.max(7, Math.round(m * 0.55)) + 'px';
          tx.textContent = d.letter;
        }
      });
    }

    /* 拖尾：只画色块，不画底板，否则白色底板叠在一起会糊成一片 */
    var t2 = el('g', { opacity: .24 }, g);
    var t1 = el('g', { opacity: .48 }, g);
    blocks(t2, 'url(#fTrail)');
    blocks(t1, 'url(#fTrail)');

    /* 主体：白底板把几段收成「一份」 */
    var head = el('g', {}, g);
    el('rect', {
      x: -total / 2 - pad, y: -m / 2 - pad,
      width: total + pad * 2, height: m + pad * 2,
      rx: Math.round((m + pad * 2) * 0.32),
      fill: '#fff', 'fill-opacity': .97, filter: 'url(#fGlow)'
    }, head);
    blocks(head, null, true);

    return { g: g, head: head, t1: t1, t2: t2, half: total / 2 + pad };
  };

  /* 把数据包放到路径的 e（0~1）处 */
  CV.placePacket = function (pkt, wire, e) {
    var Lp = wire.len;
    var pt = wire.path.getPointAtLength(e * Lp);
    pkt.g.setAttribute('opacity', '1');
    pkt.head.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')');
    var a = wire.path.getPointAtLength(Math.max(0, e * Lp - 24));
    var b = wire.path.getPointAtLength(Math.max(0, e * Lp - 46));
    pkt.t1.setAttribute('transform', 'translate(' + a.x + ' ' + a.y + ') scale(.8)');
    pkt.t2.setAttribute('transform', 'translate(' + b.x + ' ' + b.y + ') scale(.6)');
    /* 拖尾随行进方向略微拉长，速度感更足 */
    wire.path.setAttribute('stroke-dashoffset', String(-e * 110));
  };

  /* ---------- 图例：一整份数据 = 若干个数据块拼成 ---------- */
  CV.drawLegend = function (parent, o) {
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
        'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff'
      }, seg).textContent = o.items[i].letter;
      blocks.push(seg);
    }
    return { g: g, blocks: blocks, box: { x: o.x, y: o.y, w: bw, h: bh } };
  };

  /* ---------- 落位脉冲：色块弹跳（涟漪环可选） ---------- */
  CV.SHOW_RING = false;      /* 涟漪扩散环开关，置 true 可恢复 */

  CV.spawnPulse = function (popLayer, slot, color) {
    slot.g.classList.remove('slot-pop');
    /* SVG 元素没有 offsetWidth，必须用 getBoundingClientRect 强制回流，
       否则第二次起「删-加 class」被合并，动画不会重播 */
    void slot.g.getBoundingClientRect();
    slot.g.classList.add('slot-pop');

    if (!CV.SHOW_RING) return;

    var ring = el('circle', {
      class: 'ring', cx: slot.cx, cy: slot.cy, r: Math.round(slot.w / 2),
      stroke: color, opacity: .8
    }, popLayer);
    setTimeout(function () {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 1100);
  };

  /* ---------- 背景网格 ---------- */
  CV.drawGrid = function (parent, v) {
    el('rect', { x: 0, y: 0, width: v.w, height: v.h, fill: 'url(#gGrid)' }, parent);
  };
})(window.CV = window.CV || {});
