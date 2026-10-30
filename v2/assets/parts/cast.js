/* ============================================================
   CommonVisual v2 · L2 演员（C1 cast.rank / C2 cast.row / C3 cast.slot / C4 cast.badge）
   ------------------------------------------------------------
   参与者卡、数据槽、角标。只认参数，不知道「原语」这个词。
   参与者 = rank 卡片；row = 卡里的一排数据槽；slot = 一块数据；
   badge = 头部角标（src/dst 角色或 n/4 进度）。
   尺寸一律由 geom 基线经参数传入；字号写在 SVG 属性上，CSS 不许再写。
   ============================================================ */
(function (CV) {
  'use strict';
  var el = CV.el;

  /* ---------- 角标几何：drawCard 与 resizeCard 共用 ----------
     传 text 则按文字长度算宽度（进度徽章「1/4」「4 段」比角色徽章宽）。 */
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
  CV.cast = CV.cast || {};
  CV.cast.badgeGeo = badgeGeo;

  /* ---------- C1 rank：参与者卡（白底 + 彩色标题条 + 角色徽章） ---------- */
  CV.cast.rank = function (parent, o) {
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
  CV.drawCard = CV.cast.rank;   /* 旧名别名：规范页/探针沿用 */

  /* ---------- 卡片尺寸变化时重画（卡片随时间轴长高的场景） ---------- */
  CV.cast.resize = function (card, geo) {
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
  CV.resizeCard = CV.cast.resize;

  /* ---------- C2/C3 row + slot：一块数据（缓冲槽） ---------- */
  CV.cast.slot = function (parent, x, y, w, h) {
    var g = el('g', { class: 'slot-g' }, parent);
    var rect = el('rect', {
      class: 'slot-bg', x: x, y: y, width: w, height: h, rx: 8,
      fill: '#f7f8fc', stroke: '#d5dae8', 'stroke-width': 1.3, 'stroke-dasharray': '4 3'
    }, g);
    var text = el('text', {
      class: 'slot-tx', x: x + w / 2, y: y + h / 2, 'text-anchor': 'middle',
      'dominant-baseline': 'central',
      /* 字母 = 0.33 × 块高 —— 46 → 15 / 25 → 8。CSS 里别再钉字号 */
      'font-size': Math.round(h * 0.33), fill: '#b9c0d2'
    }, g);
    return { g: g, rect: rect, text: text, x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2 };
  };
  CV.drawSlot = CV.cast.slot;

  /* 三种状态：有数据 / 传输中占位 / 空。
     data.sub = 右下角小下标（all-to-all 标第几片）；data.count = Σ 上标「已折进几份」 */
  CV.cast.set = function (s, data, opt) {
    opt = opt || {};
    if (data) {
      s.rect.setAttribute('fill', data.color);
      s.rect.setAttribute('stroke', 'none');
      s.rect.setAttribute('stroke-dasharray', 'none');
      s.text.setAttribute('fill', '#fff');
      s.text.textContent = data.letter;
      if (data.sub != null) {
        var sp = el('tspan', { 'font-size': '0.62em', dy: '0.34em' }, s.text);
        sp.textContent = data.sub;
      }
      /* 上标份数：Σ 块规范写法 = Σ + 下标列字母 + 上标「已折进几份」。
         dy 是累计的：有下标时要从下标位置拉回基线上方。 */
      if (data.count != null) {
        var su = el('tspan', {
          'font-size': '0.52em', 'font-weight': '600',
          dy: data.sub != null ? '-1.28em' : '-0.9em'
        }, s.text);
        su.textContent = String(data.count);
      }
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
    /* 预留中的空位可以先隐藏（数据块淡入用）；淡入淡出必须在 set 之后写 */
    s.g.style.opacity = opt.hidden ? '0' : '';
  };
  CV.setSlot = CV.cast.set;

  /* 卡内一排 n 个槽（水平居中）。at = 'mid' 在标题条下区域垂直居中；'top' 紧贴标题条 */
  CV.cast.row = function (parent, geo, o) {
    var L = o.L, n = o.n;
    var c0 = L.slot;
    /* align：居中计算所用的格数基准（旧页单槽卡与 4 格网格首列对齐，不按 1 格居中） */
    var m = o.align || n;
    var totalW = m * c0.sw + (m - 1) * c0.gap;
    var areaY = L.hdr, areaH = geo.h - L.hdr - 16;
    var y = o.y != null ? o.y : geo.y + areaY + (areaH - c0.sh) / 2;
    var x0 = geo.x + (geo.w - totalW) / 2;
    var list = [];
    for (var i = 0; i < n; i++) {
      list.push(CV.cast.slot(parent, x0 + i * (c0.sw + c0.gap), y, c0.sw, c0.sh));
    }
    return { list: list, x0: x0, y: y, totalW: totalW, step: c0.sw + c0.gap };
  };

  /* 纵向挪一排（长高/收窄时逐帧对位，不碰 x） */
  CV.cast.moveRow = function (list, y) {
    list.forEach(function (s) {
      if (s.y === y) return;
      s.rect.setAttribute('y', y);
      s.text.setAttribute('y', y + s.h / 2);
      s.y = y;
      s.cy = y + s.h / 2;
    });
  };
})(window.CV = window.CV || {});
