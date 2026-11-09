/* ============================================================
   src/assets/engine/narrate.js · ⑤句式校验 + 解说行展平
   ------------------------------------------------------------
   compile 已内置闭合断言（行序/步末/总长）；这里补两件事：
   ① 词表校验——行谓语必须是 ⑤§1 的词（剥离括注后）；
   ② 展平 rows 供面板渲染（同刻合并由 chrome 做）。
   ============================================================ */
(function (CV) {
  'use strict';

  /* 词 → 是否合法（LEX 的 value 是词；比对时归一化空格） */
  var WORDS = {};
  Object.keys(CV.LEX).forEach(function (k) {
    if (k === 'word') return;
    WORDS[CV.LEX[k].replace(/\s/g, '')] = true;
  });

  CV.narrate = function (T) {
    var flat = [];
    T.steps.forEach(function (st, gi) {
      st.rows.forEach(function (r, ri) {
        var what = String(r[2]);
        /* 去括注 → 归一化空格 → 与词表做「全等或 ·后缀」匹配 */
        var base = what.replace(/（[^）]*）/g, '').replace(/\s/g, '');
        var stems = base.split('→');
        stems.forEach(function (seg) {
          seg = seg.trim();
          if (!seg) return;
          var hit = Object.keys(WORDS).some(function (w) {
            return seg === w || seg.indexOf('·' + w) === seg.length - w.length - 1;
          });
          if (!hit) {
            throw new Error('narrate: 表外动作「' + seg + '」（' + what + '）——先补 docs/规范/04-文案.md');
          }
        });
        flat.push({ g: gi, ri: ri, s: r[0], e: r[1], what: r[2], res: r[3], step: st });
      });
    });
    return { total: T.total, steps: T.steps, flat: flat };
  };
})(window.CV = window.CV || {});
