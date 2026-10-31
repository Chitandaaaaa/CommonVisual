/* allgather · 集齐：环状 3 轮（0→1→3→2→0），人人拿到全集（复制，源卡保留）。
   四条边固定，每轮复用同一条线，携带的字母不同。 */
CV.scene('allgather', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, whole = T.whole;

  /* 环：左上 → 右上 → 右下 → 左下。
     每轮 RING[k] 发「自己手上最新的一段」（carried[from]），
     收方把它放进对应字母的槽。三轮后 carried 人人齐全。 */
  var RING = [0, 1, 3, 2];
  var D = CV.PALETTE;

  var ROUND_FLOWS = (function () {
    var carried = [0, 1, 2, 3], out = [];
    for (var r = 0; r < 3; r++) {
      var list = [];
      for (var k = 0; k < 4; k++) {
        var from = RING[k], to = RING[(k + 1) % 4], seg = carried[from];
        list.push({ wire: 'e' + k, from: [from, seg], to: [to, seg],
                    letter: D[seg].letter, color: seg });
      }
      var nxt = carried.slice();
      list.forEach(function (f) { nxt[f.to[0]] = f.color; });
      carried = nxt;
      out.push(list);
    }
    return out;
  })();

  return {
    id: 'allgather',
    aria: 'All-Gather 通信过程动画：四张卡沿环三轮互换，各自集齐 A B C D',
    preset: 'grid',
    overlay: 'ring',            /* 槽位四态：own / done / waiting / empty */
    wireStyle: 'ring',
    rounds: 3,
    parts: 4,

    cards: [
      { rank: 0, badgeText: '1/4' },
      { rank: 1, badgeText: '1/4' },
      { rank: 2, badgeText: '1/4' },
      { rank: 3, badgeText: '1/4' }
    ],
    rows: { 0: 4, 1: 4, 2: 4, 3: 4 },
    legend: { at: 'grid' },

    keepCards: 'all',

    gear: true,

    /* 逐动作解说的静止行文案（docs/steps.html）；轮内收包/块数由 flows 现推 */
    narr: {
      rest: {
        intro: '四张卡各 1 块（A / B / C / D）+ 3 个空格；4 条环边灰色',
        tail: '四张卡四格满 A B C D；4 条环边余辉'
      }
    },

    /* 四条边固定（箭头按「边」建，颜色逐帧跟当前轮次走） */
    wires: [
      { key: 'e0', a: 0, b: 1 },
      { key: 'e1', a: 1, b: 3 },
      { key: 'e2', a: 3, b: 2 },
      { key: 'e3', a: 2, b: 0 }
    ],

    beats: [
      { id: 'init', kind: 'wait', label: '说明', sec: 0.9,
        text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一段 ' + whole() },

      /* 三轮：流由上面的环算法推导（数据，不是绘制逻辑） */
      { id: 'r0', kind: 'move', label: '第 1 轮', text: '第 1 轮：顺时针各发一份', flows: ROUND_FLOWS[0] },
      { id: 'r1', kind: 'move', label: '第 2 轮', text: '第 2 轮：顺时针各发一份', flows: ROUND_FLOWS[1] },
      { id: 'r2', kind: 'move', label: '第 3 轮', text: '第 3 轮：顺时针各发一份', flows: ROUND_FLOWS[2] },

      { id: 'tail', kind: 'wait', label: '收尾', sec: 0.6,
        text: '四张卡都集齐 ' + whole() }
    ],

    finale: '四张卡各持整份 A B C D'
  };
})());
