/* ============================================================
   CommonVisual v2 · L3 引擎 · 导演（挂载生命周期 + 逐帧分发）
   ------------------------------------------------------------
   一页 = 一个 scene 剧本 + 本文件这套纯机械骨架：
   舞台取节点、清层、viewBox、两套几何切换、860 断点、resize 防抖、
   控件启动、聚焦刷新。剧本不写任何绘制与定时器。
   组件不知道原语；导演按剧本把组件组合起来。
   ============================================================ */
(function (CV) {
  'use strict';
  var $ = CV.$;

  /* ── 通用建场：卡片 / 槽位排 / 图例（剧本只给数据） ── */
  function buildCards(S, scene) {
    var L = S.L;
    scene.cards.forEach(function (cd) {
      var r = cd.rank;
      var geo;
      if (scene.preset === 'grid') {
        geo = CV.gridCard(L, r);
      } else if (cd.col === 'left') {
        if (L.target.cy != null) {
          /* reduce 家族：目标卡按中心定位（长高时上下对称扩） */
          geo = { x: L.target.x, y: L.target.cy - L.card.h / 2, w: L.card.w, h: L.card.h };
        } else {
          geo = { x: L.target.x, y: L.target.y, w: L.card.w, h: L.card.h };
        }
      } else {
        geo = { x: L.source.x, y: L.source.ys[r - 1], w: L.card.w, h: L.card.h };
      }
      S.cards[r] = CV.cast.rank(S.layers.cards, {
        key: r, geo: geo, color: S.data[r].color,
        title: 'rank ' + r,
        role: cd.role || null,
        badgeText: cd.badgeText || null,
        target: !!cd.target,
        hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
      });
    });
  }

  /* scene.rows: {0: n, 1: n, ...} 每卡一排 n 槽（单排页）。家族页自建，跳过 */
  function buildRows(S, scene) {
    if (scene.family || scene.rowsMode === 'custom') return;
    Object.keys(scene.rows).forEach(function (rk) {
      var r = Number(rk);
      var n = scene.rows[rk];
      var row = CV.cast.row(S.layers.chips, S.cards[r].geo, { L: S.L, n: n, align: scene.parts || 4 });
      S.chips[r] = row.list;
    });
  }

  function buildLegend(S, scene) {
    if (!scene.legend) return;
    var L = S.L;
    var x, y;
    if (scene.preset === 'grid') {
      x = L.grid.x + 7; y = L.legendY + 7;
    } else if (scene.legend.at === 'source') {
      x = L.source.x + 7; y = L.legendY + 7;
    } else {
      x = L.target.x + 7; y = L.legendY + 7;
    }
    CV.blocks.legend(S.layers.bg, { x: x, y: y, slot: L.slot, items: S.data });
  }

  CV.director = CV.director || {};

  CV.director.mount = function (scene) {
    var verbs = CV.verbs;
    var svg = $('#stage');
    var layers = {
      bg: $('#lBg'), cards: $('#lCards'), chips: $('#lChips'),
      wires: $('#lWires'), fx: $('#lFx'), labels: $('#lLabels')
    };

    var S = {
      svg: svg, layers: layers, defs: svg.querySelector('defs'),
      L: null, mode: null,
      cards: {}, chips: {}, wires: {}, pkts: {},
      data: scene.data || CV.PALETTE,
      extra: {},
      wireStyle: scene.wireStyle || null
    };
    scene.geo = scene.geo || CV.geo({ preset: scene.preset });
    var family = scene.family ? CV.verbs[scene.family] : null;

    var focus = CV.chrome.focus(svg, {
      keepCards: typeof scene.keepCards === 'function'
        ? scene.keepCards
        : function () { return scene.keepCards === 'all' ? [0, 1, 2, 3] : []; }
    });

    /* ── 编译 ── */
    var CH = CV.engine.compile(scene);
    S.CH = CH;

    /* 全局播放速度：choreo 页作用于时长；家族页不乘（与现页面一致） */
    var speed = (CV.params && CV.params.get('global', 'pageSpeed')) || 1;
    if (!(speed > 0)) speed = 1;
    var duration = CH.raw ? Math.round(CH.total * 1000)
                          : Math.round(CH.total * 1000 / speed);
    S.durSec = duration / 1000;
    S.speed = CH.raw ? 1 : speed;

    /* ── 建场 ── */
    function buildStage() {
      var v = S.L.view;
      CV.stage.viewBox(svg, v);
      CV.stage.clear(S);
      Object.keys(S.cards).forEach(function (k) { delete S.cards[k]; });
      ['chips', 'wires', 'pkts'].forEach(function (k) {
        Object.keys(S[k]).forEach(function (x) { delete S[k][x]; });
      });
      S.extra = {};
      CV.payload.grid(layers.bg, v);
      verbs.move.resetSeen && verbs.move.resetSeen();

      buildCards(S, scene);
      if (family && family.build) family.build(S, scene);
      else if (scene.family === 'alltoall') verbs.move.buildAlltoall(S, scene);
      else {
        buildRows(S, scene);
        verbs.move.build(S, scene);
      }
      buildLegend(S, scene);
      if (scene.onBuild) scene.onBuild(S);
      focus.refresh();
    }

    /* ── 逐帧 ── */
    function paint(S, t) {
      var sec = t * S.durSec;

      if (family && family.overlay) family.overlay(S, scene, CH, sec);
      else if (scene.family === 'alltoall') verbs.move.overlayAlltoall(S, scene, CH, sec);
      else {
        var ov = scene.overlay === 'copy' ? verbs.copy.overlay
                                          : verbs.move.overlays[scene.overlay];
        if (ov) ov(S, scene, CH, sec);
        CH.beats.forEach(function (b) {
          if (b.kind === 'move') verbs.move.render(S, b, CH.win[b.id], sec);
          else if (b.kind === 'copy') verbs.move.render(S, b, CH.win[b.id], sec);
        });
      }
    }

    var controls = CV.chrome.bar({
      steps: CH.steps,
      duration: duration,
      onFrame: function (t) { paint(S, t); }
    });

    /* ── 布局切换（860 断点 + resize 防抖） ── */
    var lastMode = null;
    function syncLayout(force) {
      var mode = window.innerWidth < 860 ? 'narrow' : 'desktop';
      if (!force && mode === lastMode) return;
      lastMode = mode;
      S.mode = mode;
      S.L = scene.geo[mode];
      buildStage();
      paint(S, controls.t());
    }

    syncLayout(true);
    controls.paintChrome(controls.t());

    var rzTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(rzTimer);
      rzTimer = setTimeout(function () { syncLayout(false); }, 160);
    });

    /* ── 齿轮改倍数 → 重编译 → 重排 ── */
    function reload() {
      var nc = CV.engine.compile(scene);
      CH = nc;
      S.CH = CH;
      S.durSec = CH.raw ? CH.total : CH.total / S.speed;
      var nd = Math.round((CH.raw ? CH.total : CH.total / S.speed) * 1000);
      controls.retime(CH.steps, nd);
      buildStage();
      paint(S, controls.t());
      controls.paintChrome(controls.t());
    }

    var api = { S: S, controls: controls, scene: scene };

    /* 齿轮改倍数后由 boot 的 onChange 调用 */
    api.reload = reload;

    /* 探针 / 调试钩子：取本页当前真实时间轴（改过倍数后也是最新的） */
    api.getCh = function () { return CH; };

    CV.lastMount = api;
    return api;
  };
})(window.CV = window.CV || {});
