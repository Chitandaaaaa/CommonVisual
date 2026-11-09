/* src/assets/scenes/reducescatter.js · ⑥6.7 的纯数据剧本（递归减半 + 收窄） */
CV.scene('reducescatter', {
  id: 'reducescatter',
  cn: 'Reduce-Scatter · 归约分散',
  aria: 'Reduce-Scatter 通信过程动画：两轮互换各留一半，最后每张卡只留自己的那一段和',
  preset: 'grid',
  rows: [4, 4, 4, 4],
  badges: ['4 段', '4 段', '4 段', '4 段'],
  glow: [],
  growCards: [0, 1, 2, 3],
  orch: { intro: 1.10 },
  rest: {
    intro: '四张四槽卡各 4 格 A B C D；8 条直连灰色',
    tail: 'r0 只剩 ΣA⁴、r1 只剩 ΣB⁴、r2 只剩 ΣC⁴、r3 只剩 ΣD⁴'
  },
  wireDefs: [
    { id: 'x02', label: '纵直连 0↔2', type: 'side', pair: [0, 2] },
    { id: 'x13', label: '纵直连 1↔3', type: 'side', pair: [1, 3] },
    { id: 'x01', label: '横直连 0↔1', type: 'side', pair: [0, 1] },
    { id: 'x23', label: '横直连 2↔3', type: 'side', pair: [2, 3] },
    { id: 'x03', label: '对角 0↔3（闲置）', type: 'diag', pair: [0, 3], muted: true },
    { id: 'x12', label: '对角 1↔2（闲置）', type: 'diag', pair: [1, 2], muted: true }
  ],
  /* 第 k 轮各卡交出的槽位（②递归减半：第 1 轮各交一半，第 2 轮交最后一段） */
  rsSend: {
    1: { 0: [2, 3], 1: [2, 3], 2: [0, 1], 3: [0, 1] },
    2: { 0: [1], 1: [0], 2: [3], 3: [2] }
  },
  rsKeep: { 0: [0, 1], 1: [0, 1], 2: [2, 3], 3: [2, 3] }
});
