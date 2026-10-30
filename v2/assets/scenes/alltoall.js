/* alltoall · 每人发一段收一段：每卡把第 j 片发给 rank j，四步走完（每步 3 条流）。
   12 条流按目的地分 4 步，否则 12 个包同时飞看不清。family:'alltoall'（move 动词）。 */
CV.scene('alltoall', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, whole = T.whole;

  return {
    id: 'alltoall',
    aria: 'All-to-All 通信过程动画：每卡把第 j 片发给 rank j，四步完成一次转置',
    preset: 'grid',
    family: 'alltoall',
    parts: 4,
    gear: true,

    cards: [
      { rank: 0, badgeText: '4 片' },
      { rank: 1, badgeText: '4 片' },
      { rank: 2, badgeText: '4 片' },
      { rank: 3, badgeText: '4 片' }
    ],
    legend: { at: 'grid' },

    keepCards: 'all',

    geo: CV.geo({
      preset: 'grid',
      desktop: { rowGap: 12 },
      narrow: { rowGap: 8 }
    }),

    /* 六条双向直连：4 条正交边 + 2 条对角线中心成 X，不画箭头 */
    wires: [
      { a: 0, b: 1 }, { a: 0, b: 2 }, { a: 1, b: 3 },
      { a: 2, b: 3 }, { a: 0, b: 3 }, { a: 1, b: 2 }
    ],

    captions: (function () {
      var list = [
        rk(0) + rk(1) + rk(2) + rk(3) + ' 各把自己那份切成四片：上排是待发出的片，下排空着'
      ];
      for (var q = 0; q < 4; q++) {
        list.push('第 ' + (q + 1) + ' 步：各卡把第 ' + (q + 1) + ' 片发给 ' + rk(q) + '，自己那片原地不动');
      }
      list.push('四卡下排都成了 ' + whole() + '：位置没变，但每格来自不同的卡 —— 这就是一次转置');
      return list;
    })(),
    shorts: (function () {
      var list = ['四卡各切四片，下排空着'];
      for (var q = 0; q < 4; q++) {
        list.push('第 ' + (q + 1) + ' 步 各卡第 ' + (q + 1) + ' 片 → rank' + q);
      }
      list.push('四卡都是 ' + whole() + '，来源全换');
      return list;
    })(),

    finale: '四卡下排各持 A B C D，来源全换（一次转置）'
  };
})());
