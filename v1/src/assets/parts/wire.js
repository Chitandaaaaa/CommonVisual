/* ============================================================
   src/assets/parts/wire.js · ③组件：连线（唯一画笔，五态）
   ------------------------------------------------------------
   idle / lit / glow / rest / done —— ③§2.2；一切笔画值读④ 04-wire 组。
   不持定时器；状态切换的过渡时长 = wireFade（内联 style，值来自键）。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.wire = function (defs, layer, o) {
    var mk = CV.svgEl('marker', {
      id: 'ar-' + o.id, viewBox: '0 0 8 8', refX: 7, refY: 4,
      markerWidth: 5.5, markerHeight: 5.5, orient: 'auto'
    }, defs);
    CV.svgEl('path', { d: 'M0 1 L7 4 L0 7 Z', fill: CV.spec('toneWireDim') }, mk);

    var p = CV.svgEl('path', {
      d: o.path.d, fill: 'none', 'marker-end': o.hasArrow ? 'url(#ar-' + o.id + ')' : ''
    }, layer);

    var cur = null;
    function apply(st, color) {
      var idleDash = CV.spec('wireDashOn') + ' ' + CV.spec('wireDashOff');
      var litDash = CV.spec('wireDashLitOn') + ' ' + CV.spec('wireDashOff');
      var v = {
        idle: { s: CV.spec('toneWire'), w: o.muted ? CV.spec('wireWMuted') : CV.spec('wireW'),
                d: idleDash, o: CV.spec('wireOpIdle'), m: CV.spec('toneWireDim') },
        lit:  { s: color, w: CV.spec('wireWLit'), d: litDash, o: 1, m: color },
        glow: { s: color, w: CV.spec('wireWGlow'), d: litDash, o: CV.spec('wireGlowOp'), m: color },
        rest: { s: CV.spec('toneWire'), w: CV.spec('wireWGlow'), d: idleDash, o: CV.spec('wireRestOp'), m: CV.spec('toneWireDim') },
        done: { s: CV.spec('toneWire'), w: CV.spec('wireWGlow'), d: idleDash, o: CV.spec('wireDoneOp'), m: CV.spec('toneWireDim') }
      }[st];
      p.setAttribute('stroke', v.s);
      p.setAttribute('stroke-width', v.w);
      p.setAttribute('stroke-dasharray', v.d);
      p.setAttribute('opacity', v.o);
      if (o.hasArrow) mk.querySelector('path').setAttribute('fill', v.m);
    }

    return {
      set: function (st, color) {
        if (cur && cur.st === st && cur.color === color) return;
        p.style.transitionDuration = CV.spec('wireFade') + 's';
        p.style.transitionProperty = 'stroke, opacity';
        apply(st, color);
        cur = { st: st, color: color };
      },
      path: o.path
    };
  };
})(window.CV = window.CV || {});
