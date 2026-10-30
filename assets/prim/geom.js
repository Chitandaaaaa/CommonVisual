/* ============================================================
   CommonVisual v2 · L1 几何
   ------------------------------------------------------------
   坐标只有这里会算：
   · GEO_BASE   两套尺寸（桌面 1130×680 / 窄屏 380×720）+ 公共尺寸
   · CV.geo     页面只写差异，基线别抄
   · preset     两种布局：col34（左 1 + 右 3 竖列）、grid（2×2）
   · 端点/路径   弧线、法向偏移（双向车道）、直线中心交叉（alltoall）
   ============================================================ */
(function (CV) {
  'use strict';

  /* ── 公共尺寸基线：8 页的卡片/槽位/字号/画布完全一致 ── */
  CV.GEO_BASE = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      slot: { sw: 46, sh: 46, gap: 12 },
      hdr: 36, title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      slot: { sw: 25, sh: 25, gap: 5 },
      hdr: 28, title: 12.5, badge: 8.5
    }
  };

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

  /* 页面用：CV.geo({ preset:'col34', desktop:{...差异}, narrow:{...} }) */
  var PRESETS = {
    /* 左 1 张 + 右 3 张竖列（gather/scatter/broadcast/reduce） */
    col34: {
      desktop: { target: { x: 10, y: 255 }, source: { x: 820, ys: [50, 255, 460] }, legendY: 50 },
      narrow:  { target: { x: 6,  y: 297 }, source: { x: 226, ys: [40, 297, 554] }, legendY: 40 }
    },
    /* 2×2 网格（allgather/allreduce/reducescatter/alltoall） */
    grid: {
      desktop: { grid: { x: 175, y: 136, dx: 480, dy: 330 }, legendY: 17 },
      narrow:  { grid: { x: 8,   y: 185, dx: 218, dy: 300 }, legendY: 113 }
    }
  };

  CV.geo = function (o) {
    o = o || {};
    var pre = PRESETS[o.preset] || {};
    return {
      desktop: mergeMode(mergeMode(CV.GEO_BASE.desktop, pre.desktop), o.desktop),
      narrow:  mergeMode(mergeMode(CV.GEO_BASE.narrow,  pre.narrow),  o.narrow)
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

  /* 弧线：控制点在两端 42% 处（全站同一条曲率） */
  CV.arcPath = function (sx, sy, tx, ty) {
    var dx = tx - sx, dy = ty - sy;
    return 'M ' + sx + ' ' + sy +
           ' C ' + (sx + dx * 0.42) + ' ' + (sy + dy * 0.42) + ', ' +
                 (tx - dx * 0.42) + ' ' + (ty - dy * 0.42) + ', ' +
                 tx + ' ' + ty;
  };

  /* 法向偏移后的弧线：双向交换的两条车道各偏 +off（方向本身已相反，不再补符号） */
  CV.humpPath = function (e, off) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (off || 0), ny = dx / len * (off || 0);
    return 'M ' + (e.sx + nx) + ' ' + (e.sy + ny) +
           ' C ' + (e.sx + dx * 0.42 + nx) + ' ' + (e.sy + dy * 0.42 + ny) + ', ' +
                 (e.tx - dx * 0.42 + nx) + ' ' + (e.ty - dy * 0.42 + ny) + ', ' +
                 (e.tx + nx) + ' ' + (e.ty + ny);
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
