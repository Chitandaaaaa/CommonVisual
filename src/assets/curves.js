/* ============================================================
   src/assets/curves.js · ③组件 的曲线（全站唯一一份）
   ------------------------------------------------------------
   弹跳三停点 + 贝塞尔缓动（③§3.2）；飞行缓入缓出。
   CSS 与 JS 都从这一份采样，禁止第二副本。
   ============================================================ */
(function (CV) {
  'use strict';

  /* 三次贝塞尔缓动（标准实现） */
  CV.cubicBezier = function (x1, y1, x2, y2) {
    function A(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function B(a1, a2) { return 3 * a2 - 6 * a1; }
    function C(a1) { return 3 * a1; }
    function calc(a, t) { return ((A(a, 1) * t + B(a, 1)) * t + C(a)) * t; }
    function slope(a, t) { return 3 * A(a, 1) * t * t + 2 * B(a, 1) * t + C(a); }
    function solveT(x, eps) {
      var t = x, i, d;
      for (i = 0; i < 8; i++) {
        d = slope(1, t);   /* x 用控制点 1 */
        if (Math.abs(d) < 1e-6) break;
        t -= (calc(1, t) - x) / d;
      }
      t = Math.max(0, Math.min(1, t));
      for (i = 0; i < 16; i++) {
        var xx = calc(1, t) - x;
        if (Math.abs(xx) < (eps || 1e-5)) break;
        d = slope(1, t);
        if (Math.abs(d) < 1e-6) break;
        t -= xx / d;
      }
      return t;
    }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return calc(2, solveT(x));
    };
  };

  /* ── 弹跳曲线（③§3.2 逐字转录）── */
  CV.POP_CURVE = {
    stops: [{ t: 0, k: 0.35, o: 0 }, { t: 0.55, k: 1.16, o: 1 }, { t: 1, k: 1, o: 1 }],
    bez: [0.2, 0.9, 0.3, 1.45]
  };
  CV.POP_CURVE.ease = CV.cubicBezier(0.2, 0.9, 0.3, 1.45);

  /* 按进度 q∈[0,1] 采样：相邻停点之间过 ease，透明度钳 1 */
  CV.popAt = function (q) {
    var S = CV.POP_CURVE.stops;
    q = q < 0 ? 0 : (q > 1 ? 1 : q);
    if (q <= S[0].t) return { k: S[0].k, o: S[0].o };
    if (q >= S[S.length - 1].t) return { k: S[S.length - 1].k, o: S[S.length - 1].o };
    var i = 0;
    while (i < S.length - 2 && q > S[i + 1].t) i++;
    var a = S[i], b = S[i + 1];
    var e = CV.POP_CURVE.ease((q - a.t) / (b.t - a.t));
    return { k: a.k + (b.k - a.k) * e, o: Math.min(1, a.o + (b.o - a.o) * e) };
  };

  /* ── 飞行缓动：缓入缓出（③§2.3 非匀速）── */
  CV.flightEase = function (q) {
    q = q < 0 ? 0 : (q > 1 ? 1 : q);
    return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
  };

  /* 通用线性 */
  CV.lerp = function (a, b, u) { return a + (b - a) * u; };
})(window.CV = window.CV || {});
