/* src/assets/scenes/allgather.js · ⑥6.4 的纯数据剧本（环形 · 齐传） */
CV.scene('allgather', {
  id: 'allgather',
  cn: 'All-Gather · 全收集',
  aria: 'All-Gather 通信过程动画：环上三轮互传，四张卡都拼齐整份',
  preset: 'grid',
  rows: [4, 4, 4, 4],
  badges: ['1/4', '1/4', '1/4', '1/4'],
  glow: [],
  orch: { intro: 0.90, open: 0.60 },
  rest: {
    intro: '四张卡各 1 块（A / B / C / D），3 个空格看不见；4 条环边灰色',
    open: '四张卡各 1 块 + 3 个空格；4 条环边灰色',
    tail: '四张卡四格满 A B C D；4 条环边余辉'
  },
  wireDefs: [
    { id: 'w01', label: '环边 0→1', type: 'side', pair: [0, 1] },
    { id: 'w13', label: '环边 1→3', type: 'side', pair: [1, 3] },
    { id: 'w32', label: '环边 3→2', type: 'side', pair: [3, 2] },
    { id: 'w20', label: '环边 2→0', type: 'side', pair: [2, 0] }
  ],
  hiddenSlots: (function () {
    var out = [];
    [0, 1, 2, 3].forEach(function (r) {
      for (var i = 1; i < 4; i++) out.push({ r: r, ri: 0, i: i });
    });
    return out;
  })(),
  recvLists: [
    'r1 收 A、r3 收 B、r2 收 D、r0 收 C',
    'r1 收 C、r3 收 A、r2 收 B、r0 收 D',
    'r1 收 D、r3 收 C、r2 收 A、r0 收 B'
  ]
});
