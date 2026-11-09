/* src/assets/scenes/scatter.js · ⑥6.2 的纯数据剧本（gather 的镜像） */
CV.scene('scatter', {
  id: 'scatter',
  cn: 'Scatter · 分散',
  aria: 'Scatter 通信过程动画：rank 0 把整份依次拆给 rank 1、2、3，自己留下第一段',
  preset: 'col34',
  rows: [4, 1, 1, 1],
  badges: ['src', 'dst', 'dst', 'dst'],
  glow: [],
  orch: { intro: 0.60, open: 0.60 },
  rest: {
    intro: '四槽卡四格 A B C D；三张单槽卡各 1 个空格但看不见；3 条弧线灰色',
    open: '四槽卡仍 A B C D；三张单槽卡各 1 个空格',
    r1: '四槽卡：A、C、D + 1 空格；r1 有 B',
    r2: '四槽卡：A、D + 2 空格',
    r3: '四槽卡只剩 A',
    tail: '四槽卡只剩 A；三张单槽卡各 1 段 B / C / D；3 条弧线余辉'
  },
  wireDefs: [
    { id: 'w0', label: '弧线 1', type: 'arc', from: 0, to: 1 },
    { id: 'w1', label: '弧线 2', type: 'arc', from: 0, to: 2 },
    { id: 'w2', label: '弧线 3', type: 'arc', from: 0, to: 3 }
  ],
  hiddenSlots: [
    { r: 1, ri: 0, i: 0 }, { r: 2, ri: 0, i: 0 }, { r: 3, ri: 0, i: 0 }
  ],
  flows: [
    { from: 0, to: 1, wire: 'w0', wireLabel: '弧线 1', kind: 'single', ch: 'B', letter: 'B',
      label: 'B 传递', hole: [{ r: 0, ri: 0, i: 1 }],
      toRecv: [{ r: 1, ri: 0, i: 0 }], land: [{ r: 1, i: 0, code: 'B' }] },
    { from: 0, to: 2, wire: 'w1', wireLabel: '弧线 2', kind: 'single', ch: 'C', letter: 'C',
      label: 'C 传递', hole: [{ r: 0, ri: 0, i: 2 }],
      toRecv: [{ r: 2, ri: 0, i: 0 }], land: [{ r: 2, i: 0, code: 'C' }] },
    { from: 0, to: 3, wire: 'w2', wireLabel: '弧线 3', kind: 'single', ch: 'D', letter: 'D',
      label: 'D 传递', hole: [{ r: 0, ri: 0, i: 3 }],
      toRecv: [{ r: 3, ri: 0, i: 0 }], land: [{ r: 3, i: 0, code: 'D' }] }
  ]
});
