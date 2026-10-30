/* ============================================================
   CommonVisual v2 · L2 舞台（S1 stage.mount / S2 stage.layer）
   ------------------------------------------------------------
   建根节点 + 六个固定层（顺序锁死）+ 公共 defs（网格 / 滤镜）。
   组件不知道「原语」存在；重建时只清层和 marker，不动 pattern。
   ============================================================ */
(function (CV) {
  'use strict';

  var LAYERS = ['lBg', 'lCards', 'lChips', 'lWires', 'lFx', 'lLabels'];

  /* 舞台骨架：与旧页面逐字同构（stage.css 靠这些 id / class 生效） */
  CV.stage = CV.stage || {};

  CV.stage.mount = function () {
    var el = CV.el, h = CV.h;
    var wrap = h('main', 'stagewrap', document.body);
    var box = h('div', 'stagebox', wrap);
    var svg = el('svg', {
      id: 'stage', viewBox: '0 0 1130 680',
      preserveAspectRatio: 'xMidYMid meet', role: 'img'
    }, box);

    var defs = el('defs', {}, svg);
    /* 背景网格 pattern：gGrid 这个 id 被每页引用，重建时绝不能清 defs.innerHTML */
    var pat = el('pattern', { id: 'gGrid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M40 0H0v40', fill: 'none', stroke: '#8b93aa', 'stroke-opacity': '.1', 'stroke-width': 1 }, pat);
    /* 滤镜三件：卡片投影 / 包体发光 / 拖尾 */
    function filter(id, dx, dy, std, op) {
      var f = el('filter', { id: id, x: '-40%', y: '-40%', width: '180%', height: '190%' }, defs);
      if (dx === 0 && dy === 0) f.setAttribute('x', '-90%'), f.setAttribute('width', '280%'), f.setAttribute('height', '280%');
      el('feDropShadow', { dx: dx, dy: dy, stdDeviation: std, 'flood-color': '#2a3352', 'flood-opacity': op }, f);
    }
    filter('fCard', 0, 6, 12, .1);
    filter('fGlow', 0, 0, 8, .22);
    filter('fTrail', 0, 0, 5, .14);

    var layers = {};
    LAYERS.forEach(function (id) { layers[id] = el('g', { id: id }, svg); });

    return { svg: svg, defs: defs, layers: layers };
  };

  /* 设置 viewBox（切桌面/窄屏时换几何 preset） */
  CV.stage.viewBox = function (svg, v) {
    svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);
  };

  /* 重建：清六层 + 清 marker（marker 靠 id 引用，重build会堆出第二套同名 id；
     pattern / filter 在 defs 里，绝不能清 defs.innerHTML） */
  CV.stage.clear = function (S) {
    Object.keys(S.layers).forEach(function (k) { S.layers[k].innerHTML = ''; });
    [].slice.call(S.defs.querySelectorAll('marker')).forEach(function (m) {
      m.parentNode.removeChild(m);
    });
    /* createMerge 每次建场会往 defs 里加一个白光渐变，也要一起清 */
    [].slice.call(S.defs.querySelectorAll('linearGradient[id^="fGloss"]')).forEach(function (g) {
      g.parentNode.removeChild(g);
    });
  };
})(window.CV = window.CV || {});
