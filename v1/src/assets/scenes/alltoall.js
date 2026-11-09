/* src/assets/scenes/alltoall.js · ⑥6.8 的纯数据剧本（分步互换 · 汇传错峰） */
CV.scene('alltoall', {
  id: 'alltoall',
  cn: 'All-to-All · 全互换',
  aria: 'All-to-All 通信过程动画：每张卡把第 k 片发给 rank k，四步换完',
  preset: 'grid',
  rows: [4, 4, 4, 4],
  badges: ['4 片', '4 片', '4 片', '4 片'],
  glow: [],
  orch: { intro: 0.90, open: 0.60 },
  rest: {
    intro: '四张卡上排 A0–A3（各带下标），下排看不见；6 条直连灰色',
    open: '四张卡上排 A0–A3、下排 4 个空格；6 条直连灰色',
    tail: '四张卡上排空、下排 A B C D（来源全换）'
  },
  wireDefs: [
    { id: 'w01', label: '直连 0↔1', type: 'side', pair: [0, 1], muted: true },
    { id: 'w02', label: '直连 0↔2', type: 'side', pair: [0, 2], muted: true },
    { id: 'w13', label: '直连 1↔3', type: 'side', pair: [1, 3], muted: true },
    { id: 'w23', label: '直连 2↔3', type: 'side', pair: [2, 3], muted: true },
    { id: 'w03', label: '对角 0↔3', type: 'diag', pair: [0, 3], muted: true },
    { id: 'w12', label: '对角 1↔2', type: 'diag', pair: [1, 2], muted: true }
  ],
  hiddenSlots: (function () {
    var out = [];
    [0, 1, 2, 3].forEach(function (r) {
      for (var i = 0; i < 4; i++) out.push({ r: r, ri: 1, i: i });
    });
    return out;
  })()
});
