/* src/assets/scenes/allreduce.js · ⑥6.6 的纯数据剧本（倍增互换 · 齐传 + 计算） */
CV.scene('allreduce', {
  id: 'allreduce',
  cn: 'All-Reduce · 全归约',
  aria: 'All-Reduce 通信过程动画：两轮倍增互换并累加，四张卡都拿到相同的和',
  preset: 'grid',
  rows: [4, 4, 4, 4],
  badges: ['4 段', '4 段', '4 段', '4 段'],
  glow: [],
  growCards: [0, 1, 2, 3],
  orch: { intro: 0.90 },
  rest: {
    intro: '四张四槽卡各 4 格 A B C D；6 条直连灰色',
    open: '四张双排卡，上排各 4 块',
    tail: '四张卡各 4 格 Σ⁴'
  },
  wireDefs: [
    { id: 'x01', label: '横直连 0↔1', type: 'side', pair: [0, 1], lane: true },
    { id: 'x23', label: '横直连 2↔3', type: 'side', pair: [2, 3], lane: true },
    { id: 'x02', label: '纵直连 0↔2', type: 'side', pair: [0, 2], lane: true },
    { id: 'x13', label: '纵直连 1↔3', type: 'side', pair: [1, 3], lane: true },
    { id: 'x03', label: '对角 0↔3（闲置）', type: 'diag', pair: [0, 3], muted: true },
    { id: 'x12', label: '对角 1↔2（闲置）', type: 'diag', pair: [1, 2], muted: true }
  ]
});
