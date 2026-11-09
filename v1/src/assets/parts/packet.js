/* ============================================================
   src/assets/parts/packet.js · ③组件：数据包 + 两层残影
   ------------------------------------------------------------
   单体包（1 块）/ 整份包（4 块并排）/ 分片包（带下标）。
   残影永远在来路上（③§1）；位置由 director 按 t 采样路径设置。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.packet = function (layer, o) {
    var g = CV.svgEl('g', { opacity: 0 }, layer);
    var ghosts = [];
    var i;
    for (i = 0; i < 2; i++) ghosts.push(CV.svgEl('g', { opacity: 0 }, layer));

    function paint(parent, scale, op) {
      var inner = CV.svgEl('g', { opacity: op }, parent);
      var sh = Math.round(CV.spec('dtSlotSh') * 0.44);
      if (o.kind === 'whole') {
        var bw = Math.round(sh * 0.7), gap = 3;
        for (var j = 0; j < 4; j++) {
          var r = CV.svgEl('rect', { rx: 3, ry: 3, width: bw, height: sh,
            x: -((4 * bw + 3 * gap) / 2) + j * (bw + gap), y: -sh / 2,
            fill: CV.spec('rank' + o.letters[j]) }, inner);
          r.setAttribute('stroke', 'none');
        }
      } else {
        var w = Math.round(sh * 1.35);
        var rect = CV.svgEl('rect', { rx: 4, ry: 4, width: w, height: sh, x: -w / 2, y: -sh / 2, fill: o.color }, inner);
        var t = CV.svgEl('text', { 'text-anchor': 'middle', fill: '#ffffff', 'font-weight': 600,
          'font-size': Math.round(sh * 0.52), y: sh * 0.19 }, inner);
        t.textContent = o.kind === 'sum'
          ? 'Σ' + o.sub + CV.SUP[o.sumN]
          : (o.kind === 'slice' ? o.ch + CV.SUB[o.idx] : o.ch);
      }
      return inner;
    }

    var main = paint(g, 1, 1);
    var g1 = paint(ghosts[0], 0.8, 0.35 * CV.spec('trailScale'));
    var g2 = paint(ghosts[1], 0.65, 0.16 * CV.spec('trailScale'));

    return {
      id: o.id,
      setMain: function (x, y, op) {
        if (op <= 0.01) { g.setAttribute('opacity', 0); return; }
        g.setAttribute('opacity', 1);
        main.setAttribute('opacity', op);
        g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
      },
      setGhost: function (k, x, y, op) {
        var gg = ghosts[k];
        if (op <= 0.01) { gg.setAttribute('opacity', 0); return; }
        gg.setAttribute('opacity', 1);
        gg.firstChild.setAttribute('opacity', op);
        gg.setAttribute('transform', 'translate(' + x + ',' + y + ')');
      },
      hide: function () {
        g.setAttribute('opacity', 0);
        ghosts.forEach(function (gg) { gg.setAttribute('opacity', 0); });
      }
    };
  };

  /* 图例（③§1）：色块 + 字母 */
  CV.legend = function (layer, pos) {
    var letters = ['A', 'B', 'C', 'D'];
    var sw = Math.round(CV.spec('dtSlotSw') * 0.5);
    var g = CV.svgEl('g', {}, layer);
    g.setAttribute('transform', 'translate(' + pos.x + ',' + pos.y + ')');
    CV.svgEl('text', { 'font-size': CV.spec('dtBadgeFs') + 1, fill: CV.spec('toneWireDim'),
      x: 0, y: sw * 0.4, text: '图例' }, g).textContent = '图例';
    letters.forEach(function (ch, i) {
      var x = 30 + i * (sw + 22);
      CV.svgEl('rect', { x: x, y: 0, width: sw, height: sw, rx: 4,
        fill: CV.spec('rank' + ch) }, g);
      var t = CV.svgEl('text', { x: x + sw + 4, y: sw * 0.75, 'font-size': CV.spec('dtBadgeFs') + 1,
        fill: CV.spec('toneInk') }, g);
      t.textContent = ch;
    });
  };
})(window.CV = window.CV || {});
