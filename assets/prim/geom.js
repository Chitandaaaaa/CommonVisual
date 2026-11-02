/* ============================================================
   CommonVisual v2 · L1 几何
   ------------------------------------------------------------
   坐标只有这里会算：
   · geo 组     两套尺寸（桌面 1130×680 / 窄屏 380×720）+ 公共尺寸 + 预设坐标
                  全部从 spec.js 现读（B4a 入表），页面只写差异
   · CV.geo     页面只写差异，基线别抄
   · preset     两种布局：col34（左 1 + 右 3 竖列）、grid（2×2）
   · 端点/路径   弧线、法向偏移（双向车道）、直线中心交叉（alltoall）
   ============================================================ */
(function (CV) {
  'use strict';

  /* ── 公共尺寸基线：从 spec.js 的 geo 组现读（B4a 入表，改值重建舞台） ── */
  function geoBase() {
    function mode(vw, vh, cw, ch, sw, sh, sg, hd, ti, bd) {
      return { view: { w: CV.spec(vw), h: CV.spec(vh) },
               card: { w: CV.spec(cw), h: CV.spec(ch) },
               slot: { sw: CV.spec(sw), sh: CV.spec(sh), gap: CV.spec(sg) },
               hdr: CV.spec(hd), title: CV.spec(ti), badge: CV.spec(bd) };
    }
    /* 键名显式列出（不拼接）：5.1a 靠字面量对账消费点 */
    return {
      desktop: mode('dtViewW', 'dtViewH', 'dtCardW', 'dtCardH', 'dtSlotSw', 'dtSlotSh', 'dtSlotGap', 'dtHdr', 'dtTitleFs', 'dtBadgeFs'),
      narrow:  mode('nrViewW', 'nrViewH', 'nrCardW', 'nrCardH', 'nrSlotSw', 'nrSlotSh', 'nrSlotGap', 'nrHdr', 'nrTitleFs', 'nrBadgeFs')
    };
  }

  /* 深合并两套几何：base 打底，overrides 覆盖（嵌套一层展开，不递归） */
  function mergeMode(base, ov) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (ov) Object.keys(ov).forEach(function (k) {
      var bv = base[k], ovv = ov[k];
      if (bv && ovv && typeof bv === 'object' && typeof ovv === 'object' &&
          !Array.isArray(bv) && !Array.isArray(ovv)) {
        var merged = {};
        Object.keys(bv).forEach(function (x) { merged[x] = bv[x]; });
        Object.keys(ovv).forEach(function (x) { merged[x] = ovv[x]; });
        out[k] = merged;
      } else {
        out[k] = ovv;
      }
    });
    return out;
  }

  /* 页面用：CV.geo({ preset:'col34', desktop:{...差异}, narrow:{...} })
     坐标预设同样从 spec.js 的 geo 组现读；__src 记住页面差异，
     供导演在每次 buildStage 重建几何（调试台改坐标即时生效）。 */
  function preset(o) {
    if (o === 'col34') return {
      desktop: { target: { x: CV.spec('c34dtTx'), y: CV.spec('c34dtTy') },
                 source: { x: CV.spec('c34dtSx'), ys: [CV.spec('c34dtSy1'), CV.spec('c34dtSy2'), CV.spec('c34dtSy3')] }, legendY: CV.spec('c34dtLy') },
      narrow:  { target: { x: CV.spec('c34nrTx'), y: CV.spec('c34nrTy') },
                 source: { x: CV.spec('c34nrSx'), ys: [CV.spec('c34nrSy1'), CV.spec('c34nrSy2'), CV.spec('c34nrSy3')] }, legendY: CV.spec('c34nrLy') }
    };
    if (o === 'grid') return {
      desktop: { grid: { x: CV.spec('grdtX'), y: CV.spec('grdtY'), dx: CV.spec('grdtDx'), dy: CV.spec('grdtDy') }, legendY: CV.spec('grdtLy') },
      narrow:  { grid: { x: CV.spec('grnrX'), y: CV.spec('grnrY'), dx: CV.spec('grnrDx'), dy: CV.spec('grnrDy') }, legendY: CV.spec('grnrLy') }
    };
    return {};
  }

  CV.geo = function (o) {
    o = o || {};
    var pre = preset(o.preset);
    var base = geoBase();
    return {
      desktop: mergeMode(mergeMode(base.desktop, pre.desktop), o.desktop),
      narrow:  mergeMode(mergeMode(base.narrow,  pre.narrow),  o.narrow),
      __src: o
    };
  };

  /* 2×2 网格的卡位：列 = r&1，行 = r>>1 */
  CV.gridCard = function (L, r) {
    return { x: L.grid.x + (r & 1) * L.grid.dx, y: L.grid.y + (r >> 1) * L.grid.dy,
             w: L.card.w, h: L.card.h };
  };

  /* ── 连线端点 ──
     sideEnds：按中心连线取左右边或上下边（allgather 的环、allreduce/reducescatter 的配对）。
     body 选项：横向相邻时纵坐标落在「标题条以下的正文垂直中线」上（长高时线不上下跳）。 */
  CV.sideEnds = function (a, b, L, body) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      var cy = body && L ? a.y + L.hdr + (a.h - L.hdr) / 2 : ac.y;
      var s = dx < 0 ? -1 : 1;
      return { sx: ac.x + s * a.w / 2, sy: cy, tx: bc.x - s * b.w / 2, ty: cy, horiz: true };
    }
    var t = dy < 0 ? -1 : 1;
    return { sx: ac.x, sy: ac.y + t * a.h / 2, tx: bc.x, ty: bc.y - t * b.h / 2, horiz: false };
  };

  /* 弧线 · S 形（全站唯一曲率，spec geo.arcK）
     ------------------------------------------------------------
     控制点沿**主轴**摆，不沿弦摆：横长的线水平进 / 水平出，纵长的线
     垂直进 / 垂直出。这样线从卡片边缘是「平着拉出去」的，中途再弯；
     若把控制点放在弦上（起点 + 弦×k），四个点共线，贝塞尔退化成直线
     —— 2026-11-03 之前那版就是这么写的，全站连线一直是直的。 */
  CV.arcPath = function (sx, sy, tx, ty) {
    var k = CV.spec('arcK');
    var dx = tx - sx, dy = ty - sy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return 'M ' + sx + ' ' + sy +
             ' C ' + (sx + dx * k) + ' ' + sy + ', ' +
                   (tx - dx * k) + ' ' + ty + ', ' +
                   tx + ' ' + ty;
    }
    return 'M ' + sx + ' ' + sy +
           ' C ' + sx + ' ' + (sy + dy * k) + ', ' +
                 tx + ' ' + (ty - dy * k) + ', ' +
                 tx + ' ' + ty;
  };

  /* 法向偏移后的弧线：双向交换的两条车道各偏 +off（方向本身已相反，不再补符号）。
     弧型与 arcPath 同源（S 形），只是整条线沿法向平移 off。 */
  CV.humpPath = function (e, off) {
    var k = CV.spec('arcK');
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    var ax = e.sx + nx, ay = e.sy + ny, bx = e.tx + nx, by = e.ty + ny;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return 'M ' + ax + ' ' + ay +
             ' C ' + (ax + dx * k) + ' ' + ay + ', ' +
                   (bx - dx * k) + ' ' + by + ', ' +
                   bx + ' ' + by;
    }
    return 'M ' + ax + ' ' + ay +
           ' C ' + ax + ' ' + (ay + dy * k) + ', ' +
                 bx + ' ' + (by - dy * k) + ', ' +
                 bx + ' ' + by;
  };

  /* 端点随法向平移（包的起终点要跟着车道走） */
  CV.shiftEnds = function (e, off) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return { sx: e.sx + nx, sy: e.sy + ny, tx: e.tx + nx, ty: e.ty + ny };
  };

  /* 直线中心交叉（alltoall）：卡中心朝对方中心发射，取与矩形边界的交点。
     wireY：横向相邻时落在两排缓冲之间的空白带居中处，避开数据块。 */
  CV.hitEnds = function (a, b, wireY) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    function hit(c, dx, dy, w, h) {
      var sx = dx === 0 ? Infinity : (w / 2) / Math.abs(dx);
      var sy = dy === 0 ? Infinity : (h / 2) / Math.abs(dy);
      var t = Math.min(sx, sy);
      return { x: c.x + dx * t, y: c.y + dy * t };
    }
    var s = hit(ac, ux, uy, a.w, a.h);
    var t = hit(bc, -ux, -uy, b.w, b.h);
    if (Math.abs(dy) < 1) { s.y = wireY; t.y = wireY; }
    return { sx: s.x, sy: s.y, tx: t.x, ty: t.y };
  };

  CV.linePath = function (e) { return 'M ' + e.sx + ' ' + e.sy + ' L ' + e.tx + ' ' + e.ty; };

  /* 一排槽的几何：给定卡框与槽数，返回首槽 x/y（水平居中、在标题条下区域垂直居中） */
  CV.rowGeom = function (geo, hdr, n, slot) {
    var totalW = n * slot.sw + (n - 1) * slot.gap;
    var areaY = hdr, areaH = geo.h - hdr - 16;
    return {
      x0: geo.x + (geo.w - totalW) / 2,
      y: geo.y + areaY + (areaH - slot.sh) / 2,
      totalW: totalW
    };
  };
})(window.CV = window.CV || {});
