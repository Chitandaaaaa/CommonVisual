/* allreduce · 相加后每人一份：recursive doubling 两路配对（横向先、纵向后），
   份数翻倍 1→2→4，终点四张卡四段全是 Σ。family:'sum' + sumType:'exchange'。 */
CV.scene('allreduce', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, seg = T.seg, whole = T.whole;
  var SIG = T.sig;

  return {
    id: 'allreduce',
    aria: 'All-Reduce 通信过程动画：recursive doubling 两轮互换整份，四卡各自折出四段 Σ',
    preset: 'grid',
    family: 'sum',
    sumType: 'exchange',
    gear: true,

    cards: [
      { rank: 0, badgeText: '4 段' },
      { rank: 1, badgeText: '4 段' },
      { rank: 2, badgeText: '4 段' },
      { rank: 3, badgeText: '4 段' }
    ],
    legend: { at: 'grid' },

    keepCards: 'all',

    geo: CV.geo({
      preset: 'grid',
      desktop: {
        grid: { dx: 480, dy: 300 },
        rowGap: 12, calcGap: 10, areaPad: 12,
        calc: { w: 56, h: 22, fs: 11.5, tipFs: 10.5, tipText: 'sum · avg · max · min' }
      },
      narrow: {
        rowGap: 8, calcGap: 7, areaPad: 9,
        calc: { w: 40, h: 16, fs: 9, tipFs: 8, tipText: 'sum · avg' }
      }
    }),

    captions: [
      rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一整份 ' + whole() + '，四段都在每张卡上，逐段待相加',
      '开场先预留：四张卡同时「一排变两排」—— 卡片上下扩开，第二排接收位逐块亮出（整页只做一次）',
      '第 1 轮：' + rk(0) + rk(1) + ' 左右互换整份，' + rk(2) + rk(3) + ' 左右互换整份',
      '对方那份到了：四块一块块摆进第二排接收区',
      '要算了：卡片再长高一层，放下「计算」方框 —— 求和、平均、取最大最小都按段独立算，四段同时进',
      seg(0) + ' 只和 ' + seg(0) + ' 加、' + seg(1) + ' 只和 ' + seg(1) + ' 加 —— 逐段被吸进累加器，四段各合 2 份',
      '第 2 轮：' + rk(0) + rk(2) + ' 上下互换整份，' + rk(1) + rk(3) + ' 上下互换整份 —— 还是落位、算法、收层这三拍',
      '这一轮的四段已经是 2 份的中间结果，同样进方框再算一次',
      '仍是按段对位相加：这次把 2 份再合成 4 份，四段各自把四张卡的值加齐',
      '四张卡都变成 ' + SIG + SIG + SIG + SIG + '：第 i 段 = 四张卡第 i 段的和，四份结果完全相同',
      '轮次走完才收场：第二排空位逐块撤走，卡片收回单排 —— 结果就是上排那四个 ' + SIG
    ],
    shorts: [
      '四卡各持一整份 ' + whole(),
      '四卡同时长出第二排',
      '第 1 轮 横向互换整份',
      '对方那份落位',
      '浮出计算方框，四段同时算',
      '逐段相加，四段各合 2 份',
      '第 2 轮 纵向互换整份',
      '再算一次：2 份 → 4 份',
      '再合一遍，四段各合 4 份',
      '四卡都是四段各自的和 ' + SIG + SIG + SIG + SIG,
      '撤掉第二排，卡片收回单排'
    ],

    finale: '四张卡各持 [Σ Σ Σ Σ]'
  };
})());
