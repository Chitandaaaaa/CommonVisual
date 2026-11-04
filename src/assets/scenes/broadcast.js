/* src/assets/scenes/broadcast.js · ⑥6.3 的纯数据剧本（整份包 · 连发） */
CV.scene('broadcast', {
  id: 'broadcast',
  cn: 'Broadcast · 广播',
  aria: 'Broadcast 通信过程动画：rank 0 把整份依次复制给 rank 1、2、3，自己保留',
  preset: 'col34',
  rows: [4, 4, 4, 4],
  badges: ['src', 'dst', 'dst', 'dst'],
  glow: [],
  orch: { intro: 0.60, open: 0.60 },
  rest: {
    intro: 'r0 四格 A B C D；r1 / r2 / r3 各 4 个空格但看不见；3 条弧线灰色',
    open: 'r0 满 A B C D；其余三张各 4 个空格',
    r1: 'r0 与 r1 都是 A B C D',
    r2: 'r0 / r1 / r2 都是 A B C D',
    r3: '四张卡都是 A B C D',
    tail: '四张卡各 4 格满 A B C D；3 条弧线余辉'
  },
  wireDefs: [
    { id: 'w0', label: '弧线 1', type: 'arc', from: 0, to: 1 },
    { id: 'w1', label: '弧线 2', type: 'arc', from: 0, to: 2 },
    { id: 'w2', label: '弧线 3', type: 'arc', from: 0, to: 3 }
  ],
  hiddenSlots: (function () {
    var out = [];
    [1, 2, 3].forEach(function (r) {
      for (var i = 0; i < 4; i++) out.push({ r: r, ri: 0, i: i });
    });
    return out;
  })(),
  flows: [
    { from: 0, to: 1, wire: 'w0', wireLabel: '弧线 1', kind: 'whole', letter: 'A',
      letters: ['A', 'B', 'C', 'D'], label: '广播给 r1',
      toRecv: [{ r: 1, ri: 0, i: 0 }, { r: 1, ri: 0, i: 1 }, { r: 1, ri: 0, i: 2 }, { r: 1, ri: 0, i: 3 }],
      land: [{ r: 1, i: 0, code: 'A' }, { r: 1, i: 1, code: 'B' }, { r: 1, i: 2, code: 'C' }, { r: 1, i: 3, code: 'D' }] },
    { from: 0, to: 2, wire: 'w1', wireLabel: '弧线 2', kind: 'whole', letter: 'A',
      letters: ['A', 'B', 'C', 'D'], label: '广播给 r2',
      toRecv: [{ r: 2, ri: 0, i: 0 }, { r: 2, ri: 0, i: 1 }, { r: 2, ri: 0, i: 2 }, { r: 2, ri: 0, i: 3 }],
      land: [{ r: 2, i: 0, code: 'A' }, { r: 2, i: 1, code: 'B' }, { r: 2, i: 2, code: 'C' }, { r: 2, i: 3, code: 'D' }] },
    { from: 0, to: 3, wire: 'w2', wireLabel: '弧线 3', kind: 'whole', letter: 'A',
      letters: ['A', 'B', 'C', 'D'], label: '广播给 r3',
      toRecv: [{ r: 3, ri: 0, i: 0 }, { r: 3, ri: 0, i: 1 }, { r: 3, ri: 0, i: 2 }, { r: 3, ri: 0, i: 3 }],
      land: [{ r: 3, i: 0, code: 'A' }, { r: 3, i: 1, code: 'B' }, { r: 3, i: 2, code: 'C' }, { r: 3, i: 3, code: 'D' }] }
  ]
});
