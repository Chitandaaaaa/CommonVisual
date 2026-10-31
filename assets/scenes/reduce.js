/* reduce · 相加：上排唯一累加器，来一份折一份（源卡消耗）。
   family:'sum' + sumType:'accumulate' —— 时间轴由 sum 动词按规范值算出，
   剧本只给九段文案（顺序与进度条一一对应）。 */
CV.scene('reduce', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, whole = T.whole;

  return {
    id: 'reduce',
    aria: 'Reduce 通信过程动画：rank 1、2、3 的整份数据依次送往 rank 0 逐段相加',
    preset: 'col34',
    family: 'sum',
    sumType: 'accumulate',
    gear: true,

    /* 逐动作解说的静止行文案（docs/steps.html） */
    narr: {
      rest: {
        intro: '四张四槽卡各 4 格：都是 A B C D（四份形状相同的数据）',
        collapse: '四槽卡四格 ΣA⁴ ΣB⁴ ΣC⁴ ΣD⁴；三张源卡空着'
      }
    },

    cards: [
      { rank: 0, col: 'left',  role: 'dst', target: true },
      { rank: 1, col: 'right', role: 'src' },
      { rank: 2, col: 'right', role: 'src' },
      { rank: 3, col: 'right', role: 'src' }
    ],
    legend: { at: 'target' },

    keepCards: 'all',

    geo: CV.geo({
      preset: 'col34',
      desktop: {
        target: { x: 10, cy: 340 },
        areaPad: 12, rowGap: 12, calcGap: 10,
        calc: { w: 56, h: 22, fs: 11.5, tipFs: 10.5, tipText: 'sum · avg · max · min' }
      },
      narrow: {
        target: { x: 6, cy: 360 },
        areaPad: 9, rowGap: 8, calcGap: 7,
        calc: { w: 40, h: 16, fs: 9, tipFs: 8, tipText: 'sum · avg' }
      }
    }),

    captions: [
      rk(0) + rk(1) + rk(2) + rk(3) + ' 各持整份 ' + whole(),
      rk(0) + ' 预留 4 份缓冲：卡片先长高，再逐块亮出第二排空位',
      rk(1) + ' 的整份送往 ' + rk(0),
      '逐段相加，累加到 2 份',
      rk(2) + ' 的整份送往 ' + rk(0),
      '逐段相加，累加到 3 份',
      rk(3) + ' 的整份送往 ' + rk(0),
      '逐段相加，累加到 4 份',
      '结果定在 ' + rk(0) + '：撤掉空位，卡片收回单排'
    ],

    finale: 'rank 0 四段各自是 Σ'
  };
})());
