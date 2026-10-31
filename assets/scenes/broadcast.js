/* broadcast · 复制：卡 0 把整份数据发给其余三张（不是拆开，源卡不丢任何一段）。
   包是「整份」批包；连线/箭头统一源色，不按目标分色。 */
CV.scene('broadcast', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, whole = T.whole;

  return {
    id: 'broadcast',
    aria: 'Broadcast 通信过程动画：rank 0 把整份数据复制给其余三个 rank',
    preset: 'col34',
    overlay: 'copy',            /* 槽位读法：源卡常满；目标行就绪前隐藏 → 占位 → 整份填满 */
    wireStyle: 'scatter',
    target: 0,                  /* 源 rank */
    preAt: 'ready',

    cards: [
      { rank: 0, col: 'left',  role: 'src', target: true },
      { rank: 1, col: 'right', role: 'dst' },
      { rank: 2, col: 'right', role: 'dst' },
      { rank: 3, col: 'right', role: 'dst' }
    ],
    rows: { 0: 4, 1: 4, 2: 4, 3: 4 },
    legend: { at: 'source' },

    /* 每张卡最终都持有全部四段 —— 悬停任何一段四张卡都相关 */
    keepCards: 'all',

    gear: true,

    /* 逐动作解说的静止行文案（docs/steps.html） */
    narr: {
      rest: {
        intro: 'r0 四格 A B C D；r1 / r2 / r3 各 4 个空格但看不见；3 条弧线灰色',
        ready: 'r0 满 A B C D；其余三张各 4 个空格',
        send1: 'r0 与 r1 都是 A B C D',
        send2: 'r0 / r1 / r2 都是 A B C D',
        send3: '四张卡都是 A B C D',
        tail: '四张卡各 4 格满 A B C D；3 条弧线余辉'
      }
    },

    beats: [
      { id: 'intro', kind: 'wait', label: '说明', sec: 0.6,
        text: rk(0) + ' 持有整份 ' + whole() },

      { id: 'ready', kind: 'wait', label: '接收位就绪', sec: 0.6,
        text: rk(1) + rk(2) + rk(3) + ' 接收位就绪' },

      { id: 'send1', kind: 'copy', label: '广播给 B', text: rk(0) + ' 广播整份给 ' + rk(1),
        flows: [{ from: [0, 0], to: [1, 0], whole: 0 }] },
      { id: 'send2', kind: 'copy', label: '广播给 C', text: rk(0) + ' 广播整份给 ' + rk(2),
        flows: [{ from: [0, 0], to: [2, 0], whole: 0 }] },
      { id: 'send3', kind: 'copy', label: '广播给 D', text: rk(0) + ' 广播整份给 ' + rk(3),
        flows: [{ from: [0, 0], to: [3, 0], whole: 0 }] },

      { id: 'tail', kind: 'wait', label: '收尾', sec: 2,
        text: '四张卡各持整份 ' + whole() }
    ],

    finale: '四张卡各持整份 A B C D'
  };
})());
