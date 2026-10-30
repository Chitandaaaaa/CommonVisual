/* ============================================================
   CommonVisual v2 · L2 载荷（P1 link / P2 edge / P3 packet / P4 trace）
   ------------------------------------------------------------
   在动的数据及其通路：
   · link   潜在通路（虚线弧/直线，两端端口语义在 verb 层）
   · edge   有方向的箭头 marker（一条边一个，id 全局唯一）
   · packet 运动体（单段 / 整份批），飞行 + 送达淡出
   · trace  拖尾（包自带的递减尾巴）
   ============================================================ */
(function (CV) {
  'use strict';
  var el = CV.el;

  /* ---------- 背景网格（bg 层第一笔） ---------- */
  CV.payload = CV.payload || {};

  CV.payload.grid = function (parent, v) {
    el('rect', { x: 0, y: 0, width: v.w, height: v.h, fill: 'url(#gGrid)' }, parent);
  };
  CV.drawGrid = CV.payload.grid;

  /* ---------- P2 箭头 marker（放 defs，每个数据流一个） ----------
     尖端是「线宽那么宽的小平头」：viewBox 8 宽里钝掉最后 ~2px，
     markerUnits=strokeWidth 下宽度恰等于线端直径，圆帽被盖住。 */
  CV.payload.marker = function (defs, id, letter) {
    var mk = el('marker', {
      id: id, viewBox: '0 0 8 8', refX: 8, refY: 4,
      markerWidth: 5.5, markerHeight: 5.5, orient: 'auto'
    }, defs);
    var attrs = { class: 'arw', d: 'M0,0 L8,3.27 L8,4.73 L0,8 Z', fill: '#c3cadb' };
    if (letter) attrs['data-l'] = letter;
    var p = el('path', attrs, mk);
    return { marker: mk, path: p };
  };
  CV.drawMarker = CV.payload.marker;

  /* ---------- P1 连线 ----------
     letter 可省略：整份数据的流不对应单一字母，不参与聚焦灰化；
     markerId 可省略：双向直连的边画箭头反而指错方向。 */
  CV.payload.link = function (parent, o) {
    var attrs = {
      class: 'wire', d: o.d, fill: 'none',
      stroke: '#c3cadb', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-dasharray': '8 7'
    };
    if (o.markerId) attrs['marker-end'] = 'url(#' + o.markerId + ')';
    if (o.letter) attrs['data-l'] = o.letter;
    var p = el('path', attrs, parent);
    return { path: p, len: p.getTotalLength() };
  };
  CV.drawWire = CV.payload.link;

  /* ---------- 拖尾浓度倍数（规范 05 trailScale） ---------- */
  function trailK() {
    var s = CV.params && CV.params.get('05-packet', 'trailScale');
    return (typeof s === 'number') ? s : 1;
  }

  /* ---------- P3/P4 飞行数据包：主体 + 两段递减拖尾 ---------- */
  CV.payload.packet = function (parent, o) {
    var k = trailK();
    var g = el('g', { class: 'pkt', 'data-l': o.letter, opacity: 0 }, parent);
    var t2 = el('g', { opacity: .28 * k }, g);
    el('rect', { x: -8, y: -8, width: 16, height: 16, rx: 4.5, fill: o.color, filter: 'url(#fTrail)' }, t2);
    var t1 = el('g', { opacity: .55 * k }, g);
    el('rect', { x: -10, y: -10, width: 20, height: 20, rx: 5.5, fill: o.color, filter: 'url(#fTrail)' }, t1);
    var head = el('g', {}, g);
    el('rect', { x: -12, y: -12, width: 24, height: 24, rx: 6.5, fill: o.color, filter: 'url(#fGlow)' }, head);
    el('text', { class: 'pkt-tx', x: 0, y: 4.5, 'text-anchor': 'middle' }, head).textContent = o.letter;
    return { g: g, head: head, t1: t1, t2: t2 };
  };
  CV.drawPacket = CV.payload.packet;

  /* ---------- 整份数据包：一份里若干块（白底板收成「一份」） ----------
     slot = { sw, gap } 决定小块尺寸；items = [{letter, color}] */
  CV.payload.batch = function (parent, slot, items) {
    var m  = Math.round(slot.sw * 0.44);
    var mg = Math.max(2, Math.round(slot.gap * 0.25));
    var rx = Math.max(3, Math.round(m * 0.25));
    var total = items.length * m + (items.length - 1) * mg;
    var pad = Math.round(m * 0.30);

    var g = el('g', { class: 'pkt batch', opacity: 0 }, parent);

    /* 每个小方块各自带 data-l，悬停时才跟着高亮/变灰；拖尾不带字（会糊） */
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
          tx.style.fontSize = Math.max(7, Math.round(m * 0.55)) + 'px';
          tx.textContent = d.letter;
        }
      });
    }

    var k = trailK();
    var t2 = el('g', { opacity: .24 * k }, g);
    var t1 = el('g', { opacity: .48 * k }, g);
    blocks(t2, 'url(#fTrail)');
    blocks(t1, 'url(#fTrail)');

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
  CV.drawPacketBatch = CV.payload.batch;

  /* ---------- 把包放到路径 e（0~1）处；rev = 沿路径反向 ----------
     入场渐显前 8% 行程（写在 JS，不交给 CSS——会跟逐帧淡出抢同一属性）。
     拖尾永远在「来路」上，退后距离 = 规范 trailDist。 */
  CV.payload.place = function (pkt, wire, e, rev) {
    var Lp = wire.len;
    var pos = rev ? 1 - e : e;
    var at = pos * Lp;
    var pt = wire.path.getPointAtLength(at);
    pkt.g.setAttribute('opacity', String(e <= 0 ? 0 : Math.min(1, e / 0.08)));
    pkt.head.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')');
    var step = rev ? 1 : -1;
    var near = (CV.params && CV.params.get('05-packet', 'trailDist')) || 24;
    var far = near * (46 / 24);
    var a = wire.path.getPointAtLength(Math.max(0, Math.min(Lp, at + step * near)));
    var b = wire.path.getPointAtLength(Math.max(0, Math.min(Lp, at + step * far)));
    pkt.t1.setAttribute('transform', 'translate(' + a.x + ' ' + a.y + ') scale(.8)');
    pkt.t2.setAttribute('transform', 'translate(' + b.x + ' ' + b.y + ') scale(.6)');
    /* 拖尾随行进方向略微拉长，速度感 */
    wire.path.setAttribute('stroke-dashoffset', String(-e * 110));
  };
  CV.placePacket = CV.payload.place;

  /* ---------- 送达后淡出：包停在终点，透明度线性降到 0 ----------
     durSec：页面把「传递」当一整段给了倍数时传自己算好的墙钟秒；
     不传则按规范 packFade / pageSpeed。 */
  CV.payload.fadeOut = function (pkt, elapsedSec, durSec) {
    var d;
    if (typeof durSec === 'number') {
      d = durSec;
    } else {
      var sp = (CV.params && CV.params.get('global', 'pageSpeed')) || 1;
      d = ((CV.params && CV.params.get('05-packet', 'packFade')) || 0) / (sp > 0 ? sp : 1);
    }
    if (!(d > 0)) { pkt.g.setAttribute('opacity', '0'); return; }
    var o = 1 - elapsedSec / d;
    pkt.g.setAttribute('opacity', o <= 0 ? '0' : String(Math.round(o * 100) / 100));
  };
  CV.pktFadeOut = CV.payload.fadeOut;
})(window.CV = window.CV || {});
