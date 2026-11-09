/* ============================================================
   src/assets/geom.js · ③组件 的几何与版式公式
   ------------------------------------------------------------
   版式 col34 / grid 的卡位、槽位、弧线 S 形（主轴进出）、
   互换车道（法向偏移）。一切尺寸读 spec geo 组键。
   ============================================================ */
(function (CV) {
  'use strict';

  function S(k) { return CV.spec(k); }

  /* ── 卡位（基础态；长高在渲染时另加层高）── */
  CV.layoutCards = function (scene) {
    var W = S('dtCardW'), H = S('dtCardH');
    if (scene.preset === 'col34') {
      var sy = [S('c34dtSy1'), S('c34dtSy2'), S('c34dtSy3')];
      return [
        { x: S('c34dtTx'), y: S('c34dtTy'), w: W, h: H },
        { x: S('c34dtSx'), y: sy[0], w: W, h: H },
        { x: S('c34dtSx'), y: sy[1], w: W, h: H },
        { x: S('c34dtSx'), y: sy[2], w: W, h: H }
      ];
    }
    var x0 = S('grdtX'), y0 = S('grdtY'), dx = S('grdtDx'), dy = S('grdtDy');
    return [
      { x: x0, y: y0, w: W, h: H },
      { x: x0 + dx, y: y0, w: W, h: H },
      { x: x0, y: y0 + dy, w: W, h: H },
      { x: x0 + dx, y: y0 + dy, w: W, h: H }
    ];
  };

  CV.legendPos = function (scene) {
    return scene.preset === 'col34'
      ? { x: S('c34dtTx') + 7, y: S('c34dtLy') + 7 }
      : { x: S('grdtX') + 7, y: S('grdtLy') + 7 };
  };

  /* ── 槽位 ── 卡高：基础 dtCardH，每多一排 / 计算层各加一层（slotSh+slotGap），顶边钉死 */
  CV.layerH = function () { return S('dtSlotSh') + S('dtSlotGap'); };
  CV.cardH = function (rows, calc) {
    return S('dtCardH') + (rows - 1) * CV.layerH() + (calc ? CV.layerH() : 0);
  };
  /* 第 rowIdx 排（0 起）第 i 槽的左上角（卡内相对坐标） */
  CV.slotPos = function (card, n, rowIdx, i, visibleN) {
    var sw = S('dtSlotSw'), gap = S('dtSlotGap');
    var total = visibleN * sw + (visibleN - 1) * gap;
    var x0 = (card.w - total) / 2;
    return {
      x: x0 + i * (sw + gap),
      y: S('dtHdr') + S('dtSlotGap') + rowIdx * CV.layerH()
    };
  };

  /* ── 卡缘点：side = left|right|top|bottom，t = 沿缘比例（0..1）── */
  CV.edgePoint = function (c, side, t) {
    t = (t == null) ? 0.5 : t;
    if (side === 'left') return { x: c.x, y: c.y + c.h * t };
    if (side === 'right') return { x: c.x + c.w, y: c.y + c.h * t };
    if (side === 'top') return { x: c.x + c.w * t, y: c.y };
    return { x: c.x + c.w * t, y: c.y + c.h };
  };

  /* ── 弧线 S 形（③§3.1 逐字）：控制点沿主轴摆 ── */
  function cubicD(p0, p1, p2, p3) {
    return 'M ' + p0.x + ' ' + p0.y +
           ' C ' + p1.x + ' ' + p1.y + ', ' + p2.x + ' ' + p2.y + ', ' + p3.x + ' ' + p3.y;
  }
  function evalCubic(p0, p1, p2, p3, q) {
    var u = 1 - q;
    return {
      x: u * u * u * p0.x + 3 * u * u * q * p1.x + 3 * u * q * q * p2.x + q * q * q * p3.x,
      y: u * u * u * p0.y + 3 * u * u * q * p1.y + 3 * u * q * q * p2.y + q * q * q * p3.y
    };
  }
  function makePath(p0, p1, p2, p3) {
    var pts = [], i, len = 0;
    for (i = 0; i <= 24; i++) pts.push(evalCubic(p0, p1, p2, p3, i / 24));
    for (i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return {
      d: cubicD(p0, p1, p2, p3), len: len,
      at: function (q) { return evalCubic(p0, p1, p2, p3, q); }
    };
  }
  function linePath(a, b) {
    return {
      d: 'M ' + a.x + ' ' + a.y + ' L ' + b.x + ' ' + b.y,
      len: Math.hypot(b.x - a.x, b.y - a.y),
      at: function (q) { return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q }; }
    };
  }

  CV.arcPath = function (a, b) {
    var k = S('arcK'), dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return makePath(a, { x: a.x + dx * k, y: a.y }, { x: b.x - dx * k, y: b.y }, b);
    }
    return makePath(a, { x: a.x, y: a.y + dy * k }, { x: b.x, y: b.y - dy * k }, b);
  };

  CV.line = function (a, b) { return linePath(a, b); };

  /* 法向偏移车道（互换两方向各偏 +off；方向已相反，法向自然相对） */
  CV.lanePath = function (a, b, off) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    var n = { x: -dy / len * off, y: dx / len * off };
    var a2 = { x: a.x + n.x, y: a.y + n.y }, b2 = { x: b.x + n.x, y: b.y + n.y };
    return CV.arcPath(a2, b2);
  };

  /* grid 邻接端点：横对走左右缘、纵对走上下缘、对角走中心（⑥§4.9 前提下唯一对角在动） */
  CV.gridEnds = function (cards, from, to) {
    var a = cards[from], b = cards[to];
    var horiz = Math.abs(a.x - b.x) > Math.abs(a.y - b.y);
    if (horiz) {
      var l = a.x < b.x ? a : b, r = a.x < b.x ? b : a;
      return [CV.edgePoint(l, 'right'), CV.edgePoint(r, 'left')];
    }
    if (Math.abs(a.x - b.x) < 1) {   /* 同列：竖对 */
      var t = a.y < b.y ? a : b, d = a.y < b.y ? b : a;
      return [CV.edgePoint(t, 'bottom'), CV.edgePoint(d, 'top')];
    }
    return [{ x: a.x + a.w / 2, y: a.y + a.h / 2 }, { x: b.x + b.w / 2, y: b.y + b.h / 2 }];
  };
})(window.CV = window.CV || {});
