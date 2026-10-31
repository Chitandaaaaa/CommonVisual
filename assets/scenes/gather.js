/* gather · 拼：三张源卡各送一段到目标卡，源卡保留（复制，不是消耗）。
   纯数据：节拍 + 流 + 文案。绘制与时序展开在引擎/动词层。 */
CV.scene('gather', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, seg = T.seg;

  return {
    id: 'gather',
    aria: 'Gather 通信过程动画：rank 1、2、3 的数据依次汇入 rank 0',
    preset: 'col34',
    overlay: 'gather',          /* 槽位读法：目标卡 count 从 1 起跳 */
    wireStyle: 'gather',        /* 源卡左缘 → 目标卡右缘，落点按槽位分布 */
    target: 0,                  /* 汇聚到 rank 0 */
    preAt: 'pre',               /* 「预留缓冲」这一步开始时，空槽才显形 */

    cards: [
      { rank: 0, col: 'left',  role: 'dst', target: true },
      { rank: 1, col: 'right', role: 'src' },
      { rank: 2, col: 'right', role: 'src' },
      { rank: 3, col: 'right', role: 'src' }
    ],
    rows: { 0: 4, 1: 1, 2: 1, 3: 1 },
    legend: { at: 'target' },

    /* 悬停聚焦：保留目的地 + 数据所在的源卡 */
    keepCards: function (letter) {
      var hit = CV.PALETTE.filter(function (d) { return d.letter === letter; })[0];
      if (!hit) return [];
      var keep = [0];
      if (hit.r !== 0) keep.push(hit.r);
      return keep;
    },

    gear: true,

    /* 逐动作解说的静止行文案（docs/steps.html；主体/动作由引擎词表拼） */
    narr: {
      rest: {
        intro: '四槽卡-1 装 A，-2/-3/-4 是空格但看不见；三张单槽卡各 1 块 B / C / D；3 条弧线灰色；图例 4 块',
        pre: '四槽卡：A + 3 个空格',
        send1: '四槽卡：A、B + 2 个空格',
        send2: '四槽卡：A、B、C + 1 个空格',
        send3: '四槽卡四格填满',
        tail: '四槽卡四格 A B C D；三张单槽卡各留原块；3 条弧线余辉'
      }
    },

    beats: [
      { id: 'intro', kind: 'wait', label: '说明', sec: 0.6,
        text: rk(0) + ' ' + rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 分别持有 ' +
              seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) },

      { id: 'pre', kind: 'wait', label: '预留缓冲', sec: 0.6,
        text: rk(0) + ' 预留 <b>4 份</b> 缓冲' },

      { id: 'send1', kind: 'move', label: 'B 传递', text: rk(1) + ' 发送 ' + seg(1),
        flows: [{ from: [1, 0], to: [0, 1], letter: 'B', color: 1 }] },
      { id: 'send2', kind: 'move', label: 'C 传递', text: rk(2) + ' 发送 ' + seg(2),
        flows: [{ from: [2, 0], to: [0, 2], letter: 'C', color: 2 }] },
      { id: 'send3', kind: 'move', label: 'D 传递', text: rk(3) + ' 发送 ' + seg(3),
        flows: [{ from: [3, 0], to: [0, 3], letter: 'D', color: 3 }] },

      { id: 'tail', kind: 'wait', label: '收尾', sec: 2,
        text: rk(0) + ' 集齐 ' + seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) }
    ],

    finale: 'rank 0 集齐 A B C D，其余三张卡各留自己那段'
  };
})());
