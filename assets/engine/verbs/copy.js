/* ============================================================
   CommonVisual v2 · L3 动词 · copy（整份复制）
   ------------------------------------------------------------
   一份原样复制到另一张卡（只有 broadcast 用）。
   包是「整份」批包；连线与箭头统一源色（按目标分色会被误读成「只收到 B」）。
   目标行在落位那一刻整行填满、四格一起弹。
   ============================================================ */
(function (CV) {
  'use strict';
  var verbs = (window.CV = window.CV).verbs = CV.verbs || {};
  verbs.copy = verbs.copy || {};

  /* 建场复用 move 的 scatter 几何（wireStyle:'scatter'，箭头不带字母），
     包由 move.build 按 kind:'copy' 建成批包 —— copy 只补槽位与弹跳的覆盖层。 */

  verbs.copy.overlay = function (S, scene, CH, sec) {
    var seenM = verbs.move.seenMap();
    var readyAt = scene.preAt ? CH.win[scene.preAt].s : 0;
    var source = scene.target;
    var P4 = S.data.length;

    /* 源卡：原件一直留着 */
    S.chips[source].forEach(function (s, i) {
      CV.cast.set(s, S.data[i], {});
    });

    /* 目标卡：就绪前隐藏 → 传输中占位 → 落位后整份填满 */
    Object.keys(S.chips).forEach(function (rk) {
      var r = Number(rk);
      if (r === source) return;
      var w = null;
      scene.beats.forEach(function (b) {
        if (b.kind !== 'copy') return;
        b.flows.forEach(function (f) { if (f.to[0] === r) w = CH.win[b.id]; });
      });
      var inFlight = w && sec >= w.s && sec < w.seatStart;
      var got = w && sec >= w.seatStart;
      S.chips[r].forEach(function (s, i) {
        CV.cast.set(s, got ? S.data[i] : null, { active: inFlight, hidden: sec < readyAt });
      });
    });

    /* 落位脉冲：整组 4 格一起弹一下 */
    scene.beats.forEach(function (b) {
      if (b.kind !== 'copy') return;
      var w = CH.win[b.id];
      b.flows.forEach(function (f, fi) {
        var key = 'p' + b.id + '_' + fi;
        if (sec >= w.seatStart && !seenM[key]) {
          seenM[key] = 1;
          S.chips[f.to[0]].forEach(function (s, i) {
            CV.beat.seat(S.layers.fx, s, S.data[i].color, w.popSec);
          });
        } else if (sec < w.seatStart && seenM[key]) {
          delete seenM[key];
        }
      });
    });

    /* 行数引用（P4 未直接用，留作剧本校验） */
    void P4;
  };
})(window.CV = window.CV || {});
