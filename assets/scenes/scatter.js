/* scatter · 拆：卡 0 把自己四段分给四张卡（源段起飞即腾空，A 留在自己这里）。
   纯数据：节拍 + 流 + 文案。 */
CV.scene('scatter', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, seg = T.seg;

  return {
    id: 'scatter',
    aria: 'Scatter 通信过程动画：rank 0 把整份数据拆开逐个送到各 rank',
    preset: 'col34',
    overlay: 'scatter',         /* 槽位读法：源卡逐段腾空 */
    wireStyle: 'scatter',       /* 源卡右缘 → 目标卡左缘 */
    target: 0,                  /* target 字段存「源」rank（scatter 的主角） */
    preAt: 'ready',             /* 「接收位就绪」这一步开始时，空槽显形 */

    cards: [
      { rank: 0, col: 'left',  role: 'src', target: true },
      { rank: 1, col: 'right', role: 'dst' },
      { rank: 2, col: 'right', role: 'dst' },
      { rank: 3, col: 'right', role: 'dst' }
    ],
    rows: { 0: 4, 1: 1, 2: 1, 3: 1 },
    legend: { at: 'source' },

    keepCards: function (letter) {
      var hit = CV.PALETTE.filter(function (d) { return d.letter === letter; })[0];
      if (!hit) return [];
      var keep = [0];
      if (hit.r !== 0) keep.push(hit.r);
      return keep;
    },

    gear: true,

    beats: [
      { id: 'intro', kind: 'wait', label: '说明', sec: 0.6,
        text: rk(0) + ' 持有 ' + seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) },

      { id: 'ready', kind: 'wait', label: '接收位就绪', sec: 0.6,
        text: rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 接收位就绪' },

      { id: 'send1', kind: 'move', label: 'B 传递', text: rk(0) + ' 发送 ' + seg(1) + ' 给 ' + rk(1),
        flows: [{ from: [0, 1], to: [1, 0], letter: 'B', color: 1 }] },
      { id: 'send2', kind: 'move', label: 'C 传递', text: rk(0) + ' 发送 ' + seg(2) + ' 给 ' + rk(2),
        flows: [{ from: [0, 2], to: [2, 0], letter: 'C', color: 2 }] },
      { id: 'send3', kind: 'move', label: 'D 传递', text: rk(0) + ' 发送 ' + seg(3) + ' 给 ' + rk(3),
        flows: [{ from: [0, 3], to: [3, 0], letter: 'D', color: 3 }] },

      { id: 'tail', kind: 'wait', label: '收尾', sec: 2,
        text: rk(0) + ' ' + rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 各持 1 段' }
    ],

    finale: '每人一段，源卡只留 A'
  };
})());
