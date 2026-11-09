/* ============================================================
   CommonVisual · DOM / SVG 小工具
   无依赖，挂到 window.CV 供后续脚本使用
   ============================================================ */
(function (CV) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  CV.$  = function (sel, root) { return (root || document).querySelector(sel); };
  CV.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* 创建 SVG 元素 */
  CV.el = function (tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* 创建 HTML 元素 */
  CV.h = function (tag, cls, parent, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  };

  CV.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* 缓入缓出，用于数据包沿路径的行进曲线 */
  CV.easeInOutQuad = function (r) {
    return r < .5 ? 2 * r * r : 1 - Math.pow(-2 * r + 2, 2) / 2;
  };

  /* CSS cubic-bezier(x1,y1,x2,y2) 的求值 —— 用来在 JS 里复刻 CSS 动画曲线。
     落位弹跳的曲线是 cubic-bezier(.2,.9,.3,1.45)，带明显过冲的弹性感；
     用 easeOutQuad 近似会显得很"软"，观感对不上。 */
  CV.cubicBezier = function (x1, y1, x2, y2) {
    function A(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function B(a1, a2) { return 3 * a2 - 6 * a1; }
    function C(a1) { return 3 * a1; }
    function calc(t, a1, a2) { return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t; }
    function slope(t, a1, a2) { return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1); }

    /* 求参数 t，使 X(t) = x（牛顿迭代，不收敛时二分兜底） */
    function tForX(x) {
      var t = x, i, s, xx;
      for (i = 0; i < 8; i++) {
        s = slope(t, x1, x2);
        if (s === 0) break;
        xx = calc(t, x1, x2) - x;
        if (Math.abs(xx) < 1e-6) return t;
        t -= xx / s;
      }
      var lo = 0, hi = 1;
      t = x;
      for (i = 0; i < 20; i++) {
        xx = calc(t, x1, x2);
        if (Math.abs(xx - x) < 1e-6) break;
        if (xx > x) hi = t; else lo = t;
        t = (lo + hi) / 2;
      }
      return t;
    }

    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return calc(tForX(x), y1, y2);
    };
  };

  /* 按比例混合两个十六进制颜色（0 = a，1 = b） */
  CV.mix = function (a, b, k) {
    function hex(c) {
      /* 也接受 mix 自己产出的 rgb()/rgba() —— 否则二次混合会把 'rg' 当十六进制解析成 NaN */
      var m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(c);
      if (m) return [+m[1], +m[2], +m[3]];
      c = c.replace('#', '');
      if (c.length === 3) c = c.split('').map(function (x) { return x + x; }).join('');
      return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
    }
    var A = hex(a), B = hex(b);
    return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * k); }).join(',') + ')';
  };
})(window.CV = window.CV || {});
