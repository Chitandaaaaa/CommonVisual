/* ============================================================
   src/assets/scenes/reduce.js · ⑥6.5 的纯数据剧本（连发 + 计算相链）
   ============================================================ */
CV.scene('reduce', {
  id: 'reduce',
  cn: 'Reduce · 归约',
  aria: 'Reduce 通信过程动画：rank 1、2、3 的整份数据依次发给 rank 0 折进相加，源卡清空',
  preset: 'col34',
  rows: [4, 4, 4, 4],
  badges: ['dst', '4 段', '4 段', '4 段'],
  glow: [0],
  growCards: [0],
  orch: { intro: 0.60 },
  rest: {
    intro: '四张四槽卡各 4 格：都是 A B C D（四份形状相同的数据）',
    tail: '四槽卡四格 ΣA⁴ ΣB⁴ ΣC⁴ ΣD⁴；三张源卡空着'
  },
  wireDefs: [
    { id: 'w0', label: '弧线 1', type: 'arc', from: 1, to: 0 },
    { id: 'w1', label: '弧线 2', type: 'arc', from: 2, to: 0 },
    { id: 'w2', label: '弧线 3', type: 'arc', from: 3, to: 0 }
  ]
});
