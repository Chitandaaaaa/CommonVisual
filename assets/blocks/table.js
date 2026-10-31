/* ============================================================
   CommonVisual v2 · L2 页面块 · table（Bk4 等宽列表格）
   ------------------------------------------------------------
   一个渲染器，数据全部来自 registry（不再各抄一份 PRIMS / MATRIX）：
   · layoutApp   前后对照表：左「通信前」右「通信后」，中间动作词
   （原第二个渲染器 algorithmsApp——算法矩阵 / 八种骨架 / 三条路线 /
     NCCL 选型——2026-11-01 随 algorithms-old 页退役，收编进
     docs/algorithms.html；六列骨架名进 registry 的 CV.ALGO_COLS。）
   ============================================================ */
(function (CV) {
  'use strict';

  CV.blocks = CV.blocks || {};

  var CELL = {
    A: { t: 'A', c: '#7c3aed' },
    B: { t: 'B', c: '#0891b2' },
    C: { t: 'C', c: '#059669' },
    D: { t: 'D', c: '#d97706' },
    S: { t: 'Σ', c: '#4c1d95' }
  };
  var RANKS = ['rank 0', 'rank 1', 'rank 2', 'rank 3'];

  var ARR_H = '<svg class="arr-h" viewBox="0 0 120 12" aria-hidden="true">' +
    '<path d="M1 6H106"/><path d="M99 1.4 110 6l-11 4.6"/></svg>';
  var ARR_V = '<svg class="arr-v" viewBox="0 0 12 34" aria-hidden="true">' +
    '<path d="M6 1v24"/><path d="M1.4 19 6 30l4.6-11"/></svg>';

  /* 一格：'A' 单字母 / 'A:0' 字母:切片下标 / '-' 空位 */
  function chip(k) {
    if (k === '-') return '<i class="cell is-blank"></i>';
    var p = k.split(':');
    var d = CELL[p[0]];
    var sub = p.length > 1 ? '<sub>' + p[1] + '</sub>' : '';
    return '<i class="cell" style="--c:' + d.c + '">' + d.t + sub + '</i>';
  }

  function row(rk, r) {
    var cls = 'row';
    if (r.dim) cls += ' is-dim';
    if (r.hot) cls += ' is-hot';
    if (r.empty) cls += ' is-empty';
    var cells = r.empty ? '<i class="cell is-blank"></i>' : r.c.map(chip).join('');
    var flag = r.flag ? '<span class="flag">' + r.flag + '</span>' : '';
    return '<div class="' + cls + '"><span class="rk">' + rk + '</span>' +
           '<span class="cells">' + cells + '</span>' + flag + '</div>';
  }

  function side(list) {
    return '<div class="side"><div class="rows">' +
      list.map(function (r, i) { return row(RANKS[i], r); }).join('') +
      '</div></div>';
  }

  /* ── layout 页：对照表主体 ── */
  CV.blocks.layoutApp = function (host) {
    var reg = { list: CV.REG_ORDER.map(CV.registryById) };
    host.innerHTML =
      '<nav class="rail" aria-label="原语索引"><p class="rail-hd">八个原语</p>' +
      reg.list.map(function (p) { return '<a href="#' + p.id + '">' + p.en + '</a>'; }).join('') +
      '</nav>' +
      reg.list.map(function (p) {
        return '<section class="prim" id="' + p.id + '">' +
          '<div class="prim-hd">' +
            '<h2><span class="en">' + p.en + '</span>' +
                '<span class="cn">' + p.cn + '</span>' +
                '<span class="tag">' + p.dir + '</span></h2>' +
            '<p class="note">' + p.note + '</p>' +
          '</div>' +
          '<div class="pair">' +
            side(p.pre) +
            '<div class="flow"><span class="act">' + p.act + '</span>' + ARR_H + ARR_V + '</div>' +
            side(p.post) +
          '</div>' +
        '</section>';
      }).join('');

    /* rail 的滚动跟随（rail 本身就是章节索引） */
    (function () {
      var links = [].slice.call(host.querySelectorAll('.rail a'));
      var secs = reg.list.map(function (p) { return document.getElementById(p.id); });
      function spy() {
        var line = window.innerHeight * 0.3;
        var cur = secs[0];
        for (var i = 0; i < secs.length; i++) {
          if (secs[i].getBoundingClientRect().top - line <= 0) cur = secs[i];
        }
        links.forEach(function (a) {
          a.classList.toggle('is-on', a.getAttribute('href') === '#' + cur.id);
        });
      }
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { spy(); ticking = false; });
      }, { passive: true });
      window.addEventListener('resize', spy);
      spy();
    })();
  };

})(window.CV = window.CV || {});
