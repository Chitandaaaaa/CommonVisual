/* ============================================================
   src/assets/scenes/gather.js · ⑥6.1 的纯数据剧本
   ------------------------------------------------------------
   治理文档：docs/规范/05-过程.md §6.1。编排秒/静止行均为⑥转录。
   ============================================================ */
CV.scene('gather', {
  id: 'gather',
  cn: 'Gather · 收集',
  aria: 'Gather 通信过程动画：rank 1、2、3 的数据依次汇入 rank 0',
  preset: 'col34',
  rows: [4, 1, 1, 1],
  badges: ['dst', 'src', 'src', 'src'],
  glow: [0],
  orch: { intro: 0.60, open: 0.60 },   /* ⑥6.1 编排秒 */
  rest: {
    intro: '四槽卡-1 装 A，-2/-3/-4 是空格但看不见；三张单槽卡各 1 块 B / C / D；3 条弧线灰色；图例 4 块',
    open: '四槽卡：A + 3 个空格',
    r1: '四槽卡：A、B + 2 个空格',
    r2: '四槽卡：A、B、C + 1 个空格',
    r3: '四槽卡四格填满',
    tail: '四槽卡四格 A B C D；三张单槽卡各留原块；3 条弧线余辉'
  },
  wireDefs: [
    { id: 'w0', label: '弧线 1', type: 'arc', from: 1, to: 0 },
    { id: 'w1', label: '弧线 2', type: 'arc', from: 2, to: 0 },
    { id: 'w2', label: '弧线 3', type: 'arc', from: 3, to: 0 }
  ],
  hiddenSlots: [
    { r: 0, ri: 0, i: 1 }, { r: 0, ri: 0, i: 2 }, { r: 0, ri: 0, i: 3 }
  ],
  flows: [
    { from: 1, to: 0, wire: 'w0', wireLabel: '弧线 1', kind: 'single', ch: 'B', letter: 'B',
      label: 'B 传递', toRecv: [{ r: 0, ri: 0, i: 1 }], land: [{ r: 0, i: 1, code: 'B' }] },
    { from: 2, to: 0, wire: 'w1', wireLabel: '弧线 2', kind: 'single', ch: 'C', letter: 'C',
      label: 'C 传递', toRecv: [{ r: 0, ri: 0, i: 2 }], land: [{ r: 0, i: 2, code: 'C' }] },
    { from: 3, to: 0, wire: 'w2', wireLabel: '弧线 3', kind: 'single', ch: 'D', letter: 'D',
      label: 'D 传递', toRecv: [{ r: 0, ri: 0, i: 3 }], land: [{ r: 0, i: 3, code: 'D' }] }
  ]
});
