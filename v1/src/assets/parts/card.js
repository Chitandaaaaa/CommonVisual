/* ============================================================
   src/assets/parts/card.js · ③组件：参与者卡（rank 卡 / 槽位排 / 角标 / 计算框）
   ------------------------------------------------------------
   只认参数，不知道「原语」；不持定时器，只有被设值的句柄。
   不透明度归导演管（tween 采样），本文件只管结构与状态外观。
   卡高 = dtCardH + (排数-1)×层高 +（计算层? 层高），顶边钉死（⑥§4.5）。
   ============================================================ */
(function (CV) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  CV.svgEl = el;

  /* hex 混色（Σ 越加越浓：rank 色 → toneDeep，④色板派生） */
  function mix(h1, h2, u) {
    function p(h, i) { return parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); }
    var r = Math.round(p(h1, 0) + (p(h2, 0) - p(h1, 0)) * u);
    var g = Math.round(p(h1, 1) + (p(h2, 1) - p(h1, 1)) * u);
    var b = Math.round(p(h1, 2) + (p(h2, 2) - p(h1, 2)) * u);
    return '#' + [r, g, b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  CV.mixColor = mix;

  var RADIUS = 14;   /* 结构常量（③未单列键） */

  CV.card = function (parent, o) {
    var g = el('g', { 'data-card': o.rank }, parent);
    var body = el('rect', { rx: RADIUS, ry: RADIUS, fill: '#ffffff', 'stroke-width': 1.4, filter: 'url(#cvSh)' }, g);
    var hdrH = CV.spec('dtHdr');
    var hdr = el('path', { fill: o.color }, g);
    var title = el('text', { fill: '#ffffff', 'font-size': CV.spec('dtTitleFs'), 'font-weight': 600 }, g);
    title.textContent = o.title;
    var badgeR = el('rect', { rx: 9, ry: 9, fill: '#ffffff', 'fill-opacity': 0.22 }, g);
    var badgeT = el('text', { fill: '#ffffff', 'font-size': CV.spec('dtBadgeFs'), 'text-anchor': 'middle' }, g);
    badgeT.textContent = o.badge || '';
    var calcG = el('g', { opacity: 0 }, g);
    var calcR = el('rect', { rx: 8, ry: 8, fill: '#fafbfd', stroke: o.color, 'stroke-dasharray': '4 3' }, calcG);
    var calcT = el('text', { fill: o.color, 'text-anchor': 'middle', 'font-size': CV.spec('dtBadgeFs') + 1 }, calcG);
    calcT.textContent = 'sum · avg · max · min';
    var slotsG = el('g', {}, g);

    var cur = { x: 0, y: 0, w: 0, h: 0, row1: null, calc: false };
    var slots = [];
    function hdrPath(w) {
      return 'M0 ' + (RADIUS + hdrH) + ' L0 ' + RADIUS +
        ' Q0 0 ' + RADIUS + ' 0 L' + (w - RADIUS) + ' 0 Q' + w + ' 0 ' + w + ' ' + RADIUS +
        ' L' + w + ' ' + (RADIUS + hdrH) + ' Z';
    }

    function mkSlot(rowIdx, idx) {
      var sg = el('g', { opacity: 0 }, slotsG);
      var rect = el('rect', { rx: 6, ry: 6 }, sg);
      var text = el('text', { 'text-anchor': 'middle', fill: '#ffffff', 'font-weight': 600 }, sg);
      var s = { g: sg, rect: rect, text: text, rowIdx: rowIdx, idx: idx, px: 0, py: 0, cx: 0, cy: 0 };
      slots[rowIdx * 4 + idx] = s;
    }
    for (var row = 0; row < o.maxRows; row++) for (var i = 0; i < 4; i++) mkSlot(row, i);

    /* 行内可见槽序：row0 = 0..本卡槽数；row1 = cur.row1（null = 全 4） */
    function rowList(ri) {
      if (ri === 0) {
        var n0 = o.rows;
        var a = []; for (var i = 0; i < n0; i++) a.push(i); return a;
      }
      if (cur.row1) return cur.row1.slice();
      return [0, 1, 2, 3];
    }
    function layout() {
      [0, 1].forEach(function (ri) {
        var vis = rowList(ri);
        vis.forEach(function (idx, order) {
          var s = slots[ri * 4 + idx];
          var sw = CV.spec('dtSlotSw'), sh = CV.spec('dtSlotSh');
          var pos = CV.slotPos({ w: cur.w }, vis.length, ri, order, vis.length);
          if (ri === 1 && cur.calc) pos.y += CV.layerH();   /* 计算层插在两排之间（③计算态卡） */
          s.px = pos.x; s.py = pos.y;
          s.cx = pos.x + sw / 2; s.cy = pos.y + sh / 2;
          s.g.setAttribute('transform', 'translate(' + pos.x + ',' + pos.y + ')');
          s.rect.setAttribute('width', sw); s.rect.setAttribute('height', sh);
          if (!s.laid) { s.text.setAttribute('x', sw / 2); s.text.setAttribute('y', sh * 0.68); s.laid = true; }
        });
      });
      var bandY = CV.spec('dtHdr') + CV.spec('dtSlotGap') + CV.layerH();
      calcR.setAttribute('x', 10); calcR.setAttribute('y', bandY);
      calcR.setAttribute('width', cur.w - 20); calcR.setAttribute('height', CV.spec('dtSlotSh'));
      calcT.setAttribute('x', cur.w / 2); calcT.setAttribute('y', bandY + CV.spec('dtSlotSh') * 0.66);
    }

    var api = {
      rank: o.rank,
      setGeo: function (x, y, w, h) {
        cur.x = x; cur.y = y; cur.w = w; cur.h = h;
        g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
        body.setAttribute('width', w); body.setAttribute('height', h);
        hdr.setAttribute('d', hdrPath(w));
        title.setAttribute('x', 12); title.setAttribute('y', hdrH * 0.68);
        var bw = Math.max(30, Math.round(badgeT.textContent.length * CV.spec('dtBadgeFs') * 0.62) + 16);
        badgeR.setAttribute('width', bw); badgeR.setAttribute('height', 18);
        badgeR.setAttribute('x', w - 12 - bw); badgeR.setAttribute('y', (hdrH - 18) / 2);
        badgeT.setAttribute('x', w - 12 - bw / 2); badgeT.setAttribute('y', (hdrH + CV.spec('dtBadgeFs')) / 2 - 1);
        layout();
      },
      setH: function (h) { cur.h = h; body.setAttribute('height', h); },
      setRow1: function (vis) { cur.row1 = vis; layout(); },
      setCalc: function (on) { cur.calc = !!on; layout(); },   /* 计算层占位（高度由 grow tween 承担） */
      setCalcOp: function (v) { calcG.setAttribute('opacity', v); },
      setOpacity: function (v) { g.setAttribute('opacity', v); },
      setGlow: function (on) {
        body.setAttribute('stroke', on ? o.color : CV.spec('toneWireDim'));
        body.setAttribute('stroke-width', on ? 2.2 : 1.4);
      },
      /* 槽位外观：state = {type, ch, idx, n, sub}（opacity 由导演另设） */
      setSlot: function (ri, i, state) {
        var s = slots[ri * 4 + i];
        var sw = CV.spec('dtSlotSh');
        s.text.setAttribute('font-size', Math.round(sw * 0.42));
        if (state.type === 'hidden') {
          s.rect.setAttribute('fill', 'none'); s.rect.setAttribute('stroke', 'none');
          s.text.textContent = '';
        } else if (state.type === 'empty') {
          s.rect.setAttribute('fill', CV.spec('toneSlotBg'));
          s.rect.setAttribute('stroke', CV.spec('toneWireDim'));
          s.rect.setAttribute('stroke-dasharray', '3 3');
          s.text.textContent = '';
        } else if (state.type === 'recv') {
          s.rect.setAttribute('fill', CV.spec('toneSlotHot'));
          s.rect.setAttribute('stroke', CV.spec('rankA'));
          s.rect.setAttribute('stroke-dasharray', 'none');
          s.text.setAttribute('fill', CV.spec('rankA'));
          s.text.textContent = '···';
        } else if (state.type === 'block' || state.type === 'slice') {
          s.rect.setAttribute('fill', CV.spec('rank' + state.ch));
          s.rect.setAttribute('stroke', 'none');
          s.text.setAttribute('fill', '#ffffff');
          s.text.textContent = state.type === 'slice' ? state.ch + CV.SUB[state.idx] : state.ch;
        } else if (state.type === 'sum') {
          s.rect.setAttribute('fill', mix(CV.spec('rank' + state.sub[0]), CV.spec('toneDeep'), (state.n - 1) / 3));
          s.rect.setAttribute('stroke', 'none');
          s.text.setAttribute('fill', '#ffffff');
          s.text.textContent = 'Σ' + state.sub + CV.SUP[state.n];
        }
      },
      setSlotOp: function (ri, i, v) {
        var s = slots[ri * 4 + i];
        var visRow = rowList(ri);
        s.g.setAttribute('opacity', (state2vis(s) && visRow.indexOf(s.idx) >= 0) ? v : (state2vis(s) ? v : 0));
      },
      setSlotScale: function (ri, i, k) {
        var s = slots[ri * 4 + i];
        var sw = CV.spec('dtSlotSw'), sh = CV.spec('dtSlotSh');
        s.g.setAttribute('transform', 'translate(' + s.px + ',' + s.py + ')' +
          ' translate(' + sw / 2 + ',' + sh / 2 + ') scale(' + k + ')' +
          ' translate(' + (-sw / 2) + ',' + (-sh / 2) + ')');
      },
      slotCenter: function (ri, i) {
        var s = slots[ri * 4 + i];
        return { x: cur.x + s.cx, y: cur.y + s.cy };
      }
    };
    function state2vis(s) { return s.g.getAttribute('data-vis') !== '0'; }
    /* hidden 判定交给导演传 op=0；这里只做行可见性裁剪 */
    api.setSlotOp = function (ri, i, v) {
      var s = slots[ri * 4 + i];
      s.g.setAttribute('opacity', v);
    };
    return api;
  };
})(window.CV = window.CV || {});
